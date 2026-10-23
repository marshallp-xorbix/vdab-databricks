"""Offline smoke scenarios for generated Lakebase Autoscaling workflows."""

from __future__ import annotations

import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import cast

from generated_workflow_test_support import (
    AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
    read_mapping,
)
from generated_workflow_http_mocks import FakeHttp
from generated_workflow_streamlit_mock import FakeStreamlit
from smoke_generated_workflow_runtime import _capture_runtime_error, _execute_app, _mock_http
from smoke_generated_workflow_assertions import _validate_workflow_contract

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
        resource_environment_variable=AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
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
            "lakebaseDatabaseId": "database-one",
            "lakebaseProjectId": "workspace-project",
            "lakebaseBranchId": "production",
            "lakebaseEndpointId": "read-write",
            "lakebaseResourceEnvironmentVariable": AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
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
    if not http.asyncpg.connections or not http.credential_requests or not http.endpoint_requests:
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
                "databaseId": "database-one",
                "resourceEnvironmentVariable": AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
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
        resource_environment_variable=AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
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
        resource_environment_variable=AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
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
        resource_environment_variable=AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
    ))
    if "exceeded its configured row limit" not in row_limit_error:
        raise AssertionError("Lakebase loaded more rows than its configured result bound.")
