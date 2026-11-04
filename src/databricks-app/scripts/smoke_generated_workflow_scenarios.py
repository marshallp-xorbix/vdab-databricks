"""Generated UI, redirect-security, and SQL-bounds smoke scenarios."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import cast

from generated_workflow_test_support import (
    ACCESS_TOKEN, REQUIRED_CLICK_ACTIONS, WAREHOUSE_ID, WORKFLOW_SQL_BYTE_LIMIT,
    WORKFLOW_SQL_ROW_LIMIT, WORKSPACE_HOST, read_mapping,
)
from generated_workflow_http_mocks import FakeHttp
from generated_workflow_streamlit_mock import FakeStreamlit
from smoke_generated_workflow_runtime import _capture_runtime_error, _execute_app, _mock_http
from smoke_generated_workflow_assertions import (
    _assert_action_result, _assert_not_executed, _assert_routes,
    _assert_sanitized_errors, _assert_workflow_side_effects,
    _find_button_callback, _find_workflow, _read_workflow_state,
)

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
