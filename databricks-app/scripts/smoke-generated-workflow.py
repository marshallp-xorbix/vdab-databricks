#!/usr/bin/env python3
"""Execute a generated VDAB workflow bundle with local Streamlit and HTTP mocks.

Input is one JSON object on stdin with a ``files`` array. Each entry has a
relative ``path`` and generated source ``content``. The harness executes the
actual ``app.py`` and its adjacent module files; it does not contact Databricks.
"""

from __future__ import annotations

import json
import os
import runpy
import sys
import tempfile
import types
import urllib.request
import traceback
from collections.abc import Callable, Mapping
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, cast

from generated_workflow_test_support import (
    ACCESS_TOKEN,
    FakeDataFrame,
    FakeHttp,
    FakeStreamlit,
    REQUIRED_CLICK_ACTIONS,
    WAREHOUSE_ID,
    WORKFLOW_SQL_BYTE_LIMIT,
    WORKFLOW_SQL_ROW_LIMIT,
    WORKSPACE_HOST,
    WORKSPACE_ID,
    read_mapping,
)

from lakebase_postgres_test_support import run_lakebase_postgres_scenarios


def main() -> int:
    """Run success/failure scenarios and emit a machine-readable result."""
    completed: list[str] = []
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        payload = json.load(sys.stdin)
        files = _read_source_bundle(payload)
        scenario = payload.get("scenario") if isinstance(payload, dict) else None
        if scenario == "lakebase":
            checks = _run_lakebase_scenarios(files)
        elif scenario == "lakebase-postgres":
            connection = payload.get("connection") if isinstance(payload, dict) else None
            component_files = _read_source_bundle({
                "files": payload.get("componentFiles"),
            }) if isinstance(payload, dict) else {}
            checks = run_lakebase_postgres_scenarios(
                files,
                connection,
                component_files,
                _execute_app,
                _mock_http,
                _validate_workflow_contract,
            )
        else:
            checks = _run_scenarios(files)
        completed.extend(checks)
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({
            "event": "generated-workflow-smoke.failed",
            "error": str(error),
            "checks": completed,
        }), file=sys.stderr)
        return 1
    print(json.dumps({
        "event": "generated-workflow-smoke.passed",
        "checks": completed,
    }))
    return 0


def _read_source_bundle(value: object) -> dict[str, str]:
    if not isinstance(value, dict) or not isinstance(value.get("files"), list):
        raise ValueError("Input must be a JSON object with a files array.")
    sources: dict[str, str] = {}
    allowed_paths = {
        "app.py",
        "custom_modules.py",
        "prebuilt_modules_library.py",
        "requirements.txt",
    }
    for entry in value["files"]:
        if not isinstance(entry, dict):
            raise ValueError("Every bundle file must be an object.")
        path = entry.get("path")
        content = entry.get("content")
        if (
            not isinstance(path, str)
            or path not in allowed_paths
            or not isinstance(content, str)
        ):
            raise ValueError("Bundle paths must be supported generated Python files.")
        if path in sources:
            raise ValueError(f"Bundle contains duplicate file path: {path}")
        sources[path] = content
    if "app.py" not in sources:
        raise ValueError("Bundle is missing app.py.")
    return sources


def _run_lakebase_scenarios(sources: Mapping[str, str]) -> list[str]:
    """Exercise generated Lakebase reads, writes, identity, and SQL safety."""
    if sources.get("requirements.txt") != "asyncpg==0.32.0\n":
        raise AssertionError("Lakebase output omitted the approved runtime requirement.")
    with tempfile.TemporaryDirectory(prefix="vdab-lakebase-smoke-") as directory:
        bundle_directory = Path(directory)
        for relative_path, content in sources.items():
            if relative_path != "requirements.txt":
                (bundle_directory / relative_path).write_text(content, encoding="utf-8")
        _validate_workflow_contract(sources)
        http = FakeHttp()
        streamlit = FakeStreamlit()
        with _mock_http(http):
            namespace = _execute_app(bundle_directory, http, streamlit)
            _exercise_lakebase_sql_lexer(namespace)
            _exercise_lakebase_workflow(namespace, http, streamlit)
            _exercise_lakebase_identity_and_limits(namespace, http, streamlit)
    return [
        "lakebase-postgres-sql-lexer",
        "lakebase-viewer-authorized-read-write",
        "lakebase-identity-and-result-bounds",
    ]


def _exercise_lakebase_sql_lexer(namespace: Mapping[str, object]) -> None:
    """Check dialect conversion only changes quoted identifiers."""
    convert_sql = namespace.get("_vdab_postgres_sql")
    if not callable(convert_sql):
        raise AssertionError("Generated source omitted the Lakebase SQL converter.")
    tick = chr(96)
    source = (
        "SELECT " + tick + "odd" + tick + tick + "name" + tick
        + ", 'literal " + tick + "name" + tick + "', $$" + tick + "body" + tick
        + "$$, \"already quoted\" /* " + tick + "comment" + tick + " */ FROM "
        + tick + "public" + tick + "." + tick + "orders" + tick + " -- "
        + tick + "line" + tick
    )
    expected = (
        "SELECT \"odd" + tick + "name\", 'literal " + tick + "name" + tick
        + "', $$" + tick + "body" + tick + "$$, \"already quoted\" /* "
        + tick + "comment" + tick + " */ FROM \"public\".\"orders\" -- " + tick + "line" + tick
    )
    if convert_sql(source) != expected:
        raise AssertionError("Lakebase SQL conversion changed text outside identifiers.")
    try:
        convert_sql("SELECT " + tick + "unterminated")
    except RuntimeError:
        pass
    else:
        raise AssertionError("Lakebase SQL accepted an unterminated identifier.")
    query_dataframe = namespace.get("_vdab_lakebase_query_df")
    if not callable(query_dataframe):
        raise AssertionError("Generated source omitted the Lakebase query helper.")
    write_error = _capture_runtime_error(lambda: query_dataframe(
        "public",
        "orders",
        10,
        "DELETE FROM public.orders",
        "builder",
        "projects/workspace-project/branches/production/endpoints/read-write",
    ))
    if "accepts read-only SELECT queries" not in write_error:
        raise AssertionError("Lakebase query execution accepted a write statement.")


def _exercise_lakebase_workflow(
    namespace: Mapping[str, object],
    http: FakeHttp,
    streamlit: FakeStreamlit,
) -> None:
    """Run BuildSql, RunSql, and SaveToTable through generated Python."""
    execute_action = namespace.get("_vdab_workflow_execute_action")
    if not callable(execute_action):
        raise AssertionError("Generated source omitted workflow actions.")
    tick = chr(96)
    sql = (
        "SELECT " + tick + "customer_name" + tick + ", score FROM "
        + tick + "public" + tick + "." + tick + "orders" + tick
    )
    build_node = {
        "id": "build",
        "actionType": "buildSql",
        "params": {
            "sqlSourceKind": "lakebaseAutoscaling",
            "sqlTemplate": sql,
            "lakebaseDatabaseName": "builder",
            "lakebaseProjectId": "workspace-project",
            "lakebaseBranchId": "production",
            "lakebaseEndpointId": "read-write",
        },
    }
    build_result = read_mapping(execute_action(build_node, {}, "save-form"))
    build_output = read_mapping(build_result.get("output"))
    if (
        build_result.get("status") != "success"
        or build_output.get("sqlSourceKind") != "lakebaseAutoscaling"
        or build_output.get("lakebaseEndpoint")
        != "projects/workspace-project/branches/production/endpoints/read-write"
    ):
        raise AssertionError("BuildSql did not retain its selected Lakebase endpoint.")
    run_node = {
        "id": "run",
        "actionType": "runSql",
        "params": {"statement": {"nodeId": "build"}},
    }
    run_result = read_mapping(execute_action(run_node, {"build": build_result}, "save-form"))
    if run_result.get("status") != "success":
        raise AssertionError(f"RunSql failed for Lakebase: {run_result.get('error')}")
    if not http.asyncpg.connections or not http.credential_requests:
        raise AssertionError("Lakebase reads did not exchange a viewer-scoped credential.")
    read_connection = http.asyncpg.connections[0]
    read_statement = " ".join(read_connection.cursor_statements)
    if (
        'SELECT "customer_name", score FROM "public"."orders"' not in read_statement
        or read_connection.transaction_options != [
            {"isolation": "repeatable_read", "readonly": True}
        ]
    ):
        raise AssertionError("RunSql did not use quoted SQL in a read-only snapshot.")

    state = cast(dict[str, object], streamlit.module.session_state)
    component_registry = cast(
        dict[str, object],
        state.setdefault("_vdab_component_registry", {}),
    )
    component_registry["customer-field"] = {
        "key": "customer-field",
        "code_name": "customerName",
        "component_type": "TextInput",
        "widget_key": "widget_customer_name",
    }
    state["widget_customer_name"] = "O'Brien"
    save_node = {
        "id": "save",
        "actionType": "saveToTable",
        "params": {
            "sourceFormComponentKey": "save-form",
            "targetTable": {
                "tableType": "lakebaseAutoscaling",
                "catalog": None,
                "schema": "public",
                "table": "orders",
                "database": "builder",
                "projectId": "workspace-project",
                "branchId": "production",
                "endpointId": "read-write",
            },
            "columnMappings": [{
                "formChildComponentKey": "customer-field",
                "targetColumnName": "customer name",
            }],
        },
    }
    save_result = read_mapping(execute_action(save_node, {}, "save-form"))
    if save_result.get("status") != "success":
        raise AssertionError(f"SaveToTable failed for Lakebase: {save_result.get('error')}")
    write_connection = http.asyncpg.connections[-1]
    if len(write_connection.executed_statements) != 1:
        raise AssertionError("SaveToTable did not issue exactly one parameterized write.")
    statement, parameters = write_connection.executed_statements[0]
    if (
        'INSERT INTO "public"."orders" ("customer name") VALUES ($1)' not in statement
        or parameters != ("O'Brien",)
        or write_connection.settings.get("server_settings") != {}
        or write_connection.transaction_options != [{}]
        or write_connection.committed_transactions != 1
    ):
        raise AssertionError(
            "Lakebase SaveToTable transaction evidence did not match: "
            + repr((statement, parameters, write_connection.settings.get("server_settings"),
                    write_connection.transaction_options, write_connection.committed_transactions))
        )
    if any(
        connection.settings.get("user") != "viewer@example.com"
        or connection.settings.get("password") != "offline-lakebase-credential"
        or connection.settings.get("ssl") != "require"
        for connection in http.asyncpg.connections
    ):
        raise AssertionError("Lakebase connections did not use the forwarded viewer identity.")


def _exercise_lakebase_identity_and_limits(
    namespace: Mapping[str, object],
    http: FakeHttp,
    streamlit: FakeStreamlit,
) -> None:
    """Reject missing viewer consent and over-sized result rows before loading."""
    query_dataframe = namespace.get("_vdab_lakebase_query_df")
    if not callable(query_dataframe):
        raise AssertionError("Generated source omitted the Lakebase query helper.")
    headers = cast(dict[str, str], streamlit.module.context.headers)
    headers.pop("x-forwarded-email", None)
    connection_count = len(http.asyncpg.connections)
    credential_count = len(http.credential_requests)
    identity_error = _capture_runtime_error(lambda: query_dataframe(
        "public",
        "orders",
        10,
        "SELECT 1",
        "builder",
        "projects/workspace-project/branches/production/endpoints/read-write",
    ))
    if (
        "did not grant Lakebase user authorization" not in identity_error
        or len(http.asyncpg.connections) != connection_count
        or len(http.credential_requests) != credential_count
    ):
        raise AssertionError("Lakebase connected after viewer authorization was absent.")
    headers["x-forwarded-email"] = "viewer@example.com"

    http.asyncpg.rows = [{"payload": "x" * 1_000_001}]
    oversized_error = _capture_runtime_error(lambda: query_dataframe(
        "public",
        "orders",
        10,
        "SELECT payload FROM public.orders",
        "builder",
        "projects/workspace-project/branches/production/endpoints/read-write",
    ))
    if "row exceeds its configured size limit" not in oversized_error:
        raise AssertionError("Lakebase loaded a row beyond its configured byte bound.")
    if http.asyncpg.connections[-1].cursor_statements[-1].startswith(
        "SELECT * FROM (SELECT payload"
    ):
        raise AssertionError("Lakebase fetched row data before checking the row-size bound.")

    http.asyncpg.rows = [{"customer_name": "Ada"}, {"customer_name": "Grace"}]
    row_limit_error = _capture_runtime_error(lambda: query_dataframe(
        "public",
        "orders",
        1,
        "SELECT customer_name FROM public.orders",
        "builder",
        "projects/workspace-project/branches/production/endpoints/read-write",
    ))
    if "exceeded its configured row limit" not in row_limit_error:
        raise AssertionError("Lakebase loaded more rows than its configured result bound.")


def _run_scenarios(sources: Mapping[str, str]) -> list[str]:
    with tempfile.TemporaryDirectory(prefix="vdab-workflow-smoke-") as directory:
        bundle_directory = Path(directory)
        for relative_path, content in sources.items():
            (bundle_directory / relative_path).write_text(content, encoding="utf-8")
        _validate_workflow_contract(sources)
        checks = [
            _run_button_case(bundle_directory, "click-success"),
            _run_button_case(bundle_directory, "sql-failure"),
            _run_button_case(bundle_directory, "job-failure"),
            _run_form_case(bundle_directory, "save-success"),
            _run_form_case(bundle_directory, "save-failure"),
            _run_story_empty_state_case(bundle_directory),
            _run_redirect_security_case(bundle_directory),
            _run_sql_response_bounds_case(bundle_directory),
        ]
        return checks


def _run_story_empty_state_case(directory: Path) -> str:
    """Execute all eight generated story empty-result paths under local mocks."""
    http = FakeHttp(empty_sql_results=True)
    streamlit = FakeStreamlit()
    _execute_app(directory, http, streamlit)
    expected_messages = {
        "No AmoebaStory records returned. Check bindings and field mappings.",
        "No flow records returned. Check bindings and field mappings.",
        "No geographic areas returned. Check bindings and field mappings.",
        "No HoneycombStory records returned. Check bindings and field mappings.",
        "No network edges returned. Check bindings and field mappings.",
        "No time-series points returned. Check bindings and field mappings.",
        "No spiral milestones returned. Check bindings and field mappings.",
        "No terrain cells returned. Check bindings and field mappings.",
    }
    if not expected_messages.issubset(set(streamlit.infos)):
        missing_messages = expected_messages.difference(streamlit.infos)
        raise AssertionError(
            "Generated story empty-result paths did not show all guidance: "
            + ", ".join(sorted(missing_messages))
        )
    if len(http.sql_requests) < len(expected_messages):
        raise AssertionError("Generated story previews omitted workspace SQL requests.")
    if streamlit.errors:
        raise AssertionError(
            "Empty story results unexpectedly emitted runtime errors: "
            + "; ".join(streamlit.errors)
        )
    return "all-eight-generated-stories-empty-results"


def _run_button_case(directory: Path, scenario: str) -> str:
    http = FakeHttp(
        sql_failure=scenario == "sql-failure",
        job_failure=scenario == "job-failure",
    )
    streamlit = FakeStreamlit()
    namespace = _execute_app(directory, http, streamlit)
    workflow, button_key = _find_workflow(
        namespace,
        event_key="onClick",
        component_type="Button",
        required_actions=REQUIRED_CLICK_ACTIONS,
    )
    callback = _find_button_callback(streamlit, button_key)
    callback_function = cast(Callable[..., object], callback["callback"])
    callback_arguments = callback["args"]
    if not isinstance(callback_arguments, tuple):
        raise AssertionError("Generated Button callback arguments are invalid.")
    with _mock_http(http):
        callback_function(*callback_arguments)
    workflow_state = _read_workflow_state(streamlit, workflow)
    toast_result = _assert_action_result(
        workflow,
        workflow_state,
        "triggerToast",
        "success",
    )
    if read_mapping(toast_result.get("output")).get("shown") is not True:
        raise AssertionError("TriggerToast did not report success.")
    modal_result = _assert_action_result(
        workflow,
        workflow_state,
        "showModal",
        "success",
    )
    if read_mapping(modal_result.get("output")).get("visible") is not True:
        raise AssertionError("ShowModal did not report success.")
    build_result = _assert_action_result(
        workflow,
        workflow_state,
        "buildSql",
        "success",
    )
    built_sql = read_mapping(build_result.get("output")).get("sql")
    if not isinstance(built_sql, str) or "'Ada'" not in built_sql:
        raise AssertionError("BuildSql did not bind the current Form value safely.")
    sql_status = "error" if scenario == "sql-failure" else "success"
    _assert_action_result(workflow, workflow_state, "runSql", sql_status)
    _assert_routes(workflow, workflow_state, "runSql", sql_status)

    if scenario == "sql-failure":
        _assert_not_executed(workflow, workflow_state, {
            "setBinding",
            "startDatabricksJob",
            "callCustomModule",
            "callPrebuiltModule",
        })
        _assert_sanitized_errors(streamlit, ACCESS_TOKEN)
        return "button-callback-sql-failure-route"

    binding_result = _assert_action_result(
        workflow,
        workflow_state,
        "setBinding",
        "success",
    )
    if read_mapping(binding_result.get("output")).get("applied") is not True:
        raise AssertionError("SetBinding did not receive the successful SQL result.")
    job_status = "error" if scenario == "job-failure" else "success"
    job_result = _assert_action_result(
        workflow,
        workflow_state,
        "startDatabricksJob",
        job_status,
    )
    _assert_routes(workflow, workflow_state, "startDatabricksJob", job_status)
    if scenario == "job-failure":
        _assert_not_executed(workflow, workflow_state, {
            "callCustomModule",
            "callPrebuiltModule",
        })
        _assert_sanitized_errors(streamlit, ACCESS_TOKEN)
        return "button-callback-job-failure-route"

    _assert_action_result(workflow, workflow_state, "callCustomModule", "success")
    _assert_action_result(workflow, workflow_state, "callPrebuiltModule", "success")
    if read_mapping(job_result.get("output")).get("runId") != "987654":
        raise AssertionError("StartDatabricksJob did not return the mocked run ID.")
    _assert_workflow_side_effects(streamlit, namespace, http)
    return "button-callback-all-actions-success"


def _run_form_case(directory: Path, scenario: str) -> str:
    http = FakeHttp(sql_failure=scenario == "save-failure")
    streamlit = FakeStreamlit(submit_form=True)
    namespace = _execute_app(directory, http, streamlit)
    workflow, _ = _find_workflow(
        namespace,
        event_key="onSubmit",
        component_type="Form",
        required_actions={"saveToTable"},
    )
    workflow_state = _read_workflow_state(streamlit, workflow)
    save_status = "error" if scenario == "save-failure" else "success"
    _assert_action_result(workflow, workflow_state, "saveToTable", save_status)
    _assert_routes(workflow, workflow_state, "saveToTable", save_status)
    if scenario == "save-success":
        if not any(
            statement.upper().startswith("INSERT INTO")
            for statement, _ in http.sql_requests
        ):
            raise AssertionError("SaveToTable did not issue an INSERT statement.")
        save_output = read_mapping(_assert_action_result(
            workflow,
            workflow_state,
            "saveToTable",
            "success",
        ).get("output"))
        if save_output.get("rowsAffected") != 1:
            raise AssertionError("SaveToTable did not report its successful write.")
        return "form-save-to-table-success"
    _assert_sanitized_errors(streamlit, ACCESS_TOKEN)
    return "form-save-to-table-failure-route"


def _run_redirect_security_case(directory: Path) -> str:
    """Prove SQL and Volume calls reject redirects and sanitize their errors."""
    http = FakeHttp()
    streamlit = FakeStreamlit()
    namespace = _execute_app(directory, http, streamlit)
    sql_request = namespace.get("_vdab_sql_request")
    upload_to_volume = namespace.get("_vdab_upload_to_volume")
    if not callable(sql_request) or not callable(upload_to_volume):
        raise AssertionError("Generated source omitted a secured workspace helper.")

    upload_bytes = b"small offline upload"
    with _mock_http(http):
        upload_to_volume(
            upload_bytes,
            "Volumes/main/landing/incoming/imports/2026",
            "report.csv",
        )
    expected_upload_url = (
        WORKSPACE_HOST
        + "/api/2.0/fs/files/Volumes/main/landing/incoming/"
        + "imports/2026/report.csv?overwrite=true"
    )
    if http.upload_requests != [(expected_upload_url, upload_bytes)]:
        raise AssertionError("Generated Volume upload did not use the safe opener.")

    for api_name, status_code, redirect_location, invoke in _redirect_cases(
        sql_request,
        upload_to_volume,
    ):
        request_count = len(http.request_urls)
        http.redirect_next = (status_code, redirect_location)
        with _mock_http(http):
            error_message = _capture_runtime_error(invoke)
        if f"HTTP {status_code}" not in error_message:
            raise AssertionError(f"{api_name} did not surface its redirect status.")
        if any(secret in error_message for secret in (
            ACCESS_TOKEN,
            redirect_location,
            "private redirect response details",
        )):
            raise AssertionError(f"{api_name} exposed redirect response details.")
        if len(http.request_urls) != request_count + 1:
            raise AssertionError(
                f"{api_name} followed a redirect with another request."
            )
        if not http.request_urls[-1].startswith(WORKSPACE_HOST + "/"):
            raise AssertionError(f"{api_name} escaped the installed workspace.")
        if http.redirect_next is not None:
            raise AssertionError(f"{api_name} did not consume its redirect response.")

    if http.redirect_target_requests or http.direct_urlopen_calls != 0:
        raise AssertionError("Generated workspace calls bypassed redirect protection.")
    if not http.redirect_policy_checked:
        raise AssertionError("No generated redirect policy was exercised.")
    return "viewer-sql-and-volume-redirects-denied"


def _run_sql_response_bounds_case(directory: Path) -> str:
    """Check per-response bytes, aggregate bytes, and accumulated row limits."""
    streamlit = FakeStreamlit()
    response_limit_namespace = _execute_app(
        directory,
        FakeHttp(),
        FakeStreamlit(),
    )
    response_limit = response_limit_namespace.get(
        "_VDAB_SQL_MAX_HTTP_RESPONSE_BYTES"
    )
    if not isinstance(response_limit, int):
        raise AssertionError("Generated SQL omitted its HTTP response limit.")
    response_limit_http = FakeHttp(sql_responses=[b"{" + b"x" * response_limit])
    sql_request = response_limit_namespace.get("_vdab_sql_request")
    if not callable(sql_request):
        raise AssertionError("Generated source omitted SQL request handling.")
    with _mock_http(response_limit_http):
        response_error = _capture_runtime_error(lambda: sql_request(
            "POST",
            "/api/2.0/sql/statements",
            {"statement": "SELECT 1", "warehouse_id": WAREHOUSE_ID},
        ))
    if "response is too large" not in response_error:
        raise AssertionError("Generated SQL did not reject an oversized HTTP body.")

    row_namespace = _execute_app(directory, FakeHttp(), FakeStreamlit())
    query_dataframe = row_namespace.get("_vdab_sql_query_df")
    if not callable(query_dataframe):
        raise AssertionError("Generated source omitted the bounded SQL query helper.")
    too_many_rows = {
        "statement_id": "bounded-row-query",
        "status": {"state": "SUCCEEDED"},
        "manifest": {"schema": {"columns": [{"name": "value"}]}},
        "result": {"data_array": [["one"], ["two"], ["three"]]},
    }
    row_limit_http = FakeHttp(sql_responses=[too_many_rows])
    with _mock_http(row_limit_http):
        row_error = _capture_runtime_error(lambda: query_dataframe(
            "main",
            "default",
            "customers",
            2,
            query_statement="SELECT value FROM main.default.customers",
            warehouse_id_override=WAREHOUSE_ID,
        ))
    if "exceeded its configured row limit" not in row_error:
        raise AssertionError("Generated SQL accumulated rows beyond its configured limit.")
    if not row_limit_http.sql_requests or row_limit_http.sql_requests[0][1].get("row_limit") != 2:
        raise AssertionError("Generated SQL omitted the requested API row limit.")

    truncated_result = {
        "statement_id": "truncated-default-query",
        "status": {"state": "SUCCEEDED"},
        "truncated": True,
        "manifest": {"schema": {"columns": [{"name": "value"}]}},
        "result": {"data_array": [["bounded"]]},
    }
    truncated_http = FakeHttp(sql_responses=[truncated_result])
    with _mock_http(truncated_http):
        truncated_error = _capture_runtime_error(lambda: query_dataframe(
            "main",
            "default",
            "customers",
            0,
            query_statement="SELECT value FROM main.default.customers",
            warehouse_id_override=WAREHOUSE_ID,
        ))
    if "result was truncated" not in truncated_error:
        raise AssertionError("Generated SQL accepted a row-limited partial result.")
    truncated_request = truncated_http.sql_requests[0][1]
    if (
        truncated_request.get("row_limit") != WORKFLOW_SQL_ROW_LIMIT
        or truncated_request.get("byte_limit") != WORKFLOW_SQL_BYTE_LIMIT
    ):
        raise AssertionError("Generated SQL omitted its safe default row or byte limit.")

    initial_chunk = {
        "statement_id": "bounded-byte-query",
        "status": {"state": "SUCCEEDED"},
        "manifest": {"schema": {"columns": [{"name": "value"}]}},
        "result": {"data_array": [["one"]], "next_chunk_index": 0},
    }
    next_chunk = {"result": {"data_array": [["two"]]}}
    truncated_chunk_http = FakeHttp(sql_responses=[
        initial_chunk,
        {"truncated": True, "result": {"data_array": [["partial"]]}},
    ])
    with _mock_http(truncated_chunk_http):
        chunk_error = _capture_runtime_error(lambda: query_dataframe(
            "main",
            "default",
            "customers",
            2,
            query_statement="SELECT value FROM main.default.customers",
            warehouse_id_override=WAREHOUSE_ID,
        ))
    if (
        "result was truncated" not in chunk_error
        or len(truncated_chunk_http.sql_get_requests) != 1
    ):
        raise AssertionError("Generated SQL accepted a truncated result chunk.")

    encoded_size = sum(
        len(json.dumps(value).encode("utf-8"))
        for value in (initial_chunk, next_chunk)
    )
    byte_namespace = _execute_app(directory, FakeHttp(), FakeStreamlit())
    byte_query_dataframe = byte_namespace.get("_vdab_sql_query_df")
    if not callable(byte_query_dataframe):
        raise AssertionError("Generated source omitted the SQL result byte limit.")
    byte_query_globals = getattr(byte_query_dataframe, "__globals__", None)
    if not isinstance(byte_query_globals, dict):
        raise AssertionError("Generated SQL query helper has no module globals.")
    byte_query_globals["_VDAB_SQL_MAX_RESULT_BYTES"] = encoded_size - 1
    byte_limit_http = FakeHttp(sql_responses=[initial_chunk, next_chunk])
    with _mock_http(byte_limit_http):
        byte_error = _capture_runtime_error(lambda: byte_query_dataframe(
            "main",
            "default",
            "customers",
            2,
            query_statement="SELECT value FROM main.default.customers",
            warehouse_id_override=WAREHOUSE_ID,
        ))
    if "result is too large" not in byte_error or len(byte_limit_http.sql_get_requests) != 1:
        raise AssertionError("Generated SQL did not enforce aggregate result bytes.")

    return "generated-sql-response-and-result-bounds"


def _redirect_cases(
    sql_request: Callable[..., object],
    upload_to_volume: Callable[..., object],
) -> list[tuple[str, int, str, Callable[[], object]]]:
    cases: list[tuple[str, int, str, Callable[[], object]]] = []
    for status_code in (302, 307, 308):
        sql_location = f"https://outside.invalid/sql-{status_code}"
        upload_location = f"https://outside.invalid/file-{status_code}"
        cases.extend([
            (
                "SQL",
                status_code,
                sql_location,
                lambda: sql_request(
                    "POST",
                    "/api/2.0/sql/statements",
                    {"statement": "SELECT 1", "warehouse_id": WAREHOUSE_ID},
                ),
            ),
            (
                "Volume upload",
                status_code,
                upload_location,
                lambda: upload_to_volume(
                    b"offline redirect test",
                    "Volumes/main/landing/incoming/imports/2026",
                    "redirect-test.csv",
                ),
            ),
        ])
    return cases


def _capture_runtime_error(operation: Callable[[], object]) -> str:
    try:
        operation()
    except RuntimeError as error:
        return str(error)
    raise AssertionError("Expected the generated request to reject its redirect.")


def _execute_app(
    directory: Path,
    http: FakeHttp,
    streamlit: FakeStreamlit,
    *,
    use_fake_asyncpg: bool = True,
    lakebase_connection: Mapping[str, object] | None = None,
    asyncpg_module: types.ModuleType | None = None,
) -> dict[str, object]:
    pandas = types.ModuleType("pandas")
    pandas.DataFrame = FakeDataFrame
    original_modules = {
        name: sys.modules.get(name)
        for name in (
            "streamlit",
            "streamlit.components",
            "streamlit.components.v1",
            "pandas",
            "asyncpg",
            "custom_modules",
            "prebuilt_modules_library",
        )
    }
    sys.modules["streamlit"] = streamlit.module
    sys.modules["streamlit.components"] = streamlit.components_module
    sys.modules["streamlit.components.v1"] = streamlit.components_v1_module
    sys.modules["pandas"] = pandas
    if asyncpg_module is not None:
        sys.modules["asyncpg"] = asyncpg_module
    elif use_fake_asyncpg:
        sys.modules["asyncpg"] = http.asyncpg.module
    sys.path.insert(0, str(directory))
    try:
        with _mock_http(http, lakebase_connection=lakebase_connection):
            namespace = runpy.run_path(
                str(directory / "app.py"),
                run_name="__vdab_smoke__",
            )
        return cast(dict[str, object], namespace)
    finally:
        sys.path.remove(str(directory))
        for name, original_module in original_modules.items():
            if original_module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original_module


@contextmanager
def _mock_http(
    http: FakeHttp,
    *,
    lakebase_connection: Mapping[str, object] | None = None,
) -> Iterator[None]:
    original_urlopen = urllib.request.urlopen
    original_build_opener = urllib.request.build_opener
    original_environment = {
        name: os.environ.get(name)
        for name in (
            "DATABRICKS_HOST",
            "DATABRICKS_SQL_WAREHOUSE_ID",
            "DATABRICKS_WORKSPACE_ID",
            "PGHOST",
            "PGPORT",
            "PGDATABASE",
            "PGSSLMODE",
        )
    }
    urllib.request.urlopen = http.urlopen
    urllib.request.build_opener = http.build_opener
    os.environ["DATABRICKS_HOST"] = WORKSPACE_HOST
    os.environ["DATABRICKS_SQL_WAREHOUSE_ID"] = WAREHOUSE_ID
    os.environ["DATABRICKS_WORKSPACE_ID"] = WORKSPACE_ID
    os.environ["PGHOST"] = "lakebase.local.test"
    os.environ["PGPORT"] = "5432"
    os.environ["PGDATABASE"] = "builder"
    os.environ["PGSSLMODE"] = "require"
    if lakebase_connection is not None:
        os.environ["PGHOST"] = str(lakebase_connection["host"])
        os.environ["PGPORT"] = str(lakebase_connection["port"])
        os.environ["PGDATABASE"] = str(lakebase_connection["database"])
    try:
        yield
    finally:
        urllib.request.urlopen = original_urlopen
        urllib.request.build_opener = original_build_opener
        for name, original_value in original_environment.items():
            if original_value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = original_value


def _validate_workflow_contract(sources: Mapping[str, str]) -> None:
    app_source = sources["app.py"]
    compile(app_source, "app.py", "exec")
    if "import custom_modules" in app_source:
        module_source = sources.get("custom_modules.py")
        if module_source is None or "import custom_modules" not in app_source:
            raise AssertionError("Custom-module action is missing its generated file.")
        compile(module_source, "custom_modules.py", "exec")
    if "import prebuilt_modules_library" in app_source:
        module_source = sources.get("prebuilt_modules_library.py")
        if module_source is None or "import prebuilt_modules_library" not in app_source:
            raise AssertionError(
                "Prebuilt-module action is missing its generated file."
            )
        compile(module_source, "prebuilt_modules_library.py", "exec")


def _find_workflow(
    namespace: Mapping[str, object],
    *,
    event_key: str,
    component_type: str,
    required_actions: set[str],
) -> tuple[dict[str, object], str]:
    workflow_definition = read_mapping(namespace.get("VDAB_WORKFLOW_DEFINITION"))
    components = namespace.get("VDAB_COMPONENT_DEFINITIONS")
    if not isinstance(components, list):
        raise AssertionError("Generated source omitted component definitions.")
    component_keys = {
        item.get("key")
        for item in components
        if isinstance(item, dict) and item.get("type") == component_type
    }
    workflow_items = workflow_definition.get("workflows")
    if not isinstance(workflow_items, list):
        raise AssertionError("Generated source omitted workflow definitions.")
    matches: list[tuple[dict[str, object], str]] = []
    for item in workflow_items:
        if not isinstance(item, dict):
            continue
        trigger = read_mapping(item.get("trigger"))
        component_key = trigger.get("componentKey")
        if component_key not in component_keys or trigger.get("eventKey") != event_key:
            continue
        nodes = item.get("nodes")
        if not isinstance(nodes, list):
            continue
        action_types = {
            node.get("actionType")
            for node in nodes
            if isinstance(node, dict)
        }
        if required_actions.issubset(action_types):
            matches.append((cast(dict[str, object], item), str(component_key)))
    if len(matches) != 1:
        raise AssertionError(
            f"Expected one {component_type} {event_key} workflow with "
            f"{sorted(required_actions)}; found {len(matches)}."
        )
    return matches[0]


def _find_button_callback(
    streamlit: FakeStreamlit,
    component_key: str,
) -> dict[str, object]:
    for button in streamlit.buttons:
        if button.get("args") == (component_key, "onClick"):
            return button
    raise AssertionError("Generated Button did not register its workflow callback.")


def _read_workflow_state(
    streamlit: FakeStreamlit,
    workflow: Mapping[str, object],
) -> dict[str, object]:
    state = cast(dict[str, object], streamlit.module.session_state)
    all_results = state.get("workflow_results")
    code_name = workflow.get("codeName")
    if not isinstance(all_results, dict) or not isinstance(code_name, str):
        raise AssertionError("Generated workflow did not store its action results.")
    workflow_state = all_results.get(code_name)
    if not isinstance(workflow_state, dict):
        raise AssertionError(f"Workflow {code_name} did not execute.")
    return cast(dict[str, object], workflow_state)


def _assert_action_result(
    workflow: Mapping[str, object],
    workflow_state: Mapping[str, object],
    action_type: str,
    expected_status: str,
) -> dict[str, object]:
    nodes = _find_action_nodes(workflow, action_type)
    results = [workflow_state.get(node.get("id")) for node in nodes]
    executed_results = [result for result in results if isinstance(result, dict)]
    if not executed_results or any(
        result.get("status") != expected_status for result in executed_results
    ):
        raise AssertionError(
            f"{action_type} expected executed status {expected_status}; "
            f"got {executed_results!r}."
        )
    return cast(dict[str, object], executed_results[0])


def _assert_routes(
    workflow: Mapping[str, object],
    workflow_state: Mapping[str, object],
    action_type: str,
    status: str,
) -> None:
    node = _find_action_node(workflow, action_type)
    node_id = node.get("id")
    edges = workflow.get("edges")
    if not isinstance(node_id, str) or not isinstance(edges, list):
        raise AssertionError("Generated workflow node or edges are invalid.")
    expected_route = "onSuccess" if status == "success" else "onError"
    relevant_edges = [
        edge for edge in edges
        if isinstance(edge, dict) and edge.get("fromNodeId") == node_id
    ]
    routes = {edge.get("route") for edge in relevant_edges}
    if expected_route not in routes:
        raise AssertionError(f"{action_type} lacks its {expected_route} route.")
    for edge in relevant_edges:
        target = edge.get("toNodeId")
        route = edge.get("route")
        should_run = route in ("always", expected_route)
        if (target in workflow_state) != should_run:
            raise AssertionError(
                f"{action_type} {status} route {route} did not match target execution."
            )


def _assert_not_executed(
    workflow: Mapping[str, object],
    workflow_state: Mapping[str, object],
    action_types: set[str],
) -> None:
    for action_type in action_types:
        node = _find_action_node(workflow, action_type)
        if node.get("id") in workflow_state:
            raise AssertionError(f"{action_type} ran after an upstream failure.")


def _assert_workflow_side_effects(
    streamlit: FakeStreamlit,
    namespace: Mapping[str, object],
    http: FakeHttp,
) -> None:
    if not streamlit.toasts:
        raise AssertionError(
            "TriggerToast did not reach the mocked Streamlit renderer."
        )
    flush_modal = namespace.get("_vdab_flush_pending_modal")
    if not callable(flush_modal):
        raise AssertionError("Generated source omitted pending-modal handling.")
    flush_modal()
    if not streamlit.dialog_calls:
        raise AssertionError("ShowModal did not render its generated dialog.")
    if (
        not http.sql_requests
        or not http.job_requests
        or not http.redirect_policy_checked
    ):
        raise AssertionError(
            "SQL/Jobs integrations did not execute through the viewer path."
        )
    query_requests = [
        body
        for statement, body in http.sql_requests
        if statement.lstrip().upper().startswith("SELECT ")
    ]
    if not any(
        body.get("row_limit") == WORKFLOW_SQL_ROW_LIMIT
        for body in query_requests
    ):
        raise AssertionError("Workflow RunSql did not use its bounded default row limit.")
    if not any(
        body.get("byte_limit") == WORKFLOW_SQL_BYTE_LIMIT
        for body in query_requests
    ):
        raise AssertionError("Workflow RunSql did not use its bounded default byte limit.")
    if any(ACCESS_TOKEN in message for message in streamlit.errors):
        raise AssertionError("Generated UI exposed the caller token in an error.")


def _assert_sanitized_errors(streamlit: FakeStreamlit, secret: str) -> None:
    state = cast(dict[str, object], streamlit.module.session_state)
    results = state.get("workflow_results")
    serialized = json.dumps(results, default=str)
    surfaced = serialized + " ".join(streamlit.errors)
    if secret in surfaced or "viewer permission denied" in surfaced:
        raise AssertionError(
            "Generated workflow exposed caller credentials or raw API details."
        )
    if not streamlit.toasts:
        raise AssertionError(
            "Workflow denial did not produce its failure notification."
        )


def _find_action_node(
    workflow: Mapping[str, object],
    action_type: str,
) -> dict[str, object]:
    matches = _find_action_nodes(workflow, action_type)
    if len(matches) != 1:
        raise AssertionError(
            f"Expected one {action_type} action in the smoke workflow; "
            f"found {len(matches)}."
        )
    return matches[0]


def _find_action_nodes(
    workflow: Mapping[str, object],
    action_type: str,
) -> list[dict[str, object]]:
    nodes = workflow.get("nodes")
    if not isinstance(nodes, list):
        raise AssertionError("Generated workflow omitted its nodes.")
    matches = [
        node for node in nodes
        if isinstance(node, dict) and node.get("actionType") == action_type
    ]
    return [cast(dict[str, object], node) for node in matches]


if __name__ == "__main__":
    raise SystemExit(main())
