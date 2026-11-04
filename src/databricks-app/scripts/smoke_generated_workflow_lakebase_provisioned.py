"""Offline fake-runtime scenarios for existing Lakebase Provisioned bindings."""

from __future__ import annotations

import asyncio
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import cast

from generated_workflow_test_support import (
    ACCESS_TOKEN,
    FakeDataFrame,
    PROVISIONED_DATABASE_HOST,
    PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE,
    read_mapping,
)
from generated_workflow_http_mocks import FakeHttp
from generated_workflow_streamlit_mock import FakeStreamlit
from smoke_generated_workflow_runtime import _capture_runtime_error, _execute_app, _mock_http
from smoke_generated_workflow_assertions import _validate_workflow_contract

def _run_lakebase_provisioned_scenarios(sources: Mapping[str, str]) -> list[str]:
    """Execute generated Provisioned reads and editable writes with local mocks."""
    if sources.get("requirements.txt") != "asyncpg==0.32.0\n":
        raise AssertionError("Provisioned output omitted the approved runtime requirement.")
    with tempfile.TemporaryDirectory(prefix="vdab-provisioned-smoke-") as directory:
        bundle_directory = Path(directory)
        for relative_path, content in sources.items():
            if relative_path != "requirements.txt":
                (bundle_directory / relative_path).write_text(content, encoding="utf-8")
        _validate_workflow_contract(sources)
        http = FakeHttp()
        streamlit = FakeStreamlit()
        connection_settings = {
            "host": PROVISIONED_DATABASE_HOST,
            "port": 5432,
            "database": "appdb",
        }
        namespace = _execute_app(
            bundle_directory,
            http,
            streamlit,
            lakebase_connection=connection_settings,
        )
        expected_reader_count = 14
        if (
            len(http.asyncpg.connections) != expected_reader_count
            or len(http.database_instance_requests) != expected_reader_count
            or len(http.provisioned_credential_requests) != expected_reader_count
            or streamlit.errors
        ):
            raise AssertionError(
                "Provisioned DataWindow, chart, story, or editable readers did not "
                "execute successfully: "
                + repr((
                    len(http.asyncpg.connections),
                    len(http.database_instance_requests),
                    len(http.provisioned_credential_requests),
                    streamlit.errors,
                ))
            )
        query_dataframe = namespace.get("_vdab_lakebase_provisioned_query_df")
        save_rows_async = namespace.get("_vdab_lakebase_save_editable_rows_async")
        save_rows = namespace.get("_vdab_lakebase_save_editable_rows")
        if not callable(query_dataframe) or not callable(save_rows_async) or not callable(save_rows):
            raise AssertionError("Generated source omitted a Provisioned Lakebase helper.")

        with _mock_http(http, lakebase_connection=connection_settings):
            prior_instance_requests = len(http.database_instance_requests)
            prior_credentials = len(http.provisioned_credential_requests)
            rows = query_dataframe(
                "public",
                "customers",
                100,
                database="appdb",
                instance_name="legacy-provisioned",
                resource_environment_variable=PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE,
            )
            if (
                not isinstance(rows, FakeDataFrame)
                or rows.data != http.asyncpg.rows_by_table["customers"]
            ):
                raise AssertionError("Provisioned DataWindow query did not return viewer rows.")
            read_connection = http.asyncpg.connections[-1]
            if (
                read_connection.settings.get("host") != PROVISIONED_DATABASE_HOST
                or read_connection.settings.get("user") != "viewer@example.com"
                or read_connection.settings.get("password") != "offline-provisioned-credential"
                or read_connection.settings.get("database") != "appdb"
                or read_connection.settings.get("server_settings")
                != {"default_transaction_read_only": "on"}
                or read_connection.transaction_options
                != [{"isolation": "repeatable_read", "readonly": True}]
                or len(http.database_instance_requests) != prior_instance_requests + 1
                or len(http.provisioned_credential_requests) != prior_credentials + 1
                or http.provisioned_credential_requests[-1] != "legacy-provisioned"
            ):
                raise AssertionError(
                    "Provisioned read did not use the caller and attached database: "
                    + repr((
                        read_connection.settings,
                        read_connection.transaction_options,
                        http.database_instance_requests,
                        http.provisioned_credential_requests,
                    ))
                )

            asyncio.run(save_rows_async(
                "lakebaseProvisionedDatabase",
                "public",
                "customers",
                "appdb",
                "",
                "legacy-provisioned",
                "id",
                ["id", "display_name"],
                [{"operation": "upsert", "row": {"id": 1, "display_name": "O'Brien"}}],
                PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE,
            ))
            write_connection = http.asyncpg.connections[-1]
            writes = write_connection.executed_statements
            if (
                write_connection.committed_transactions != 1
                or write_connection.rolled_back_transactions != 0
                or len(writes) != 3
                or writes[0][0] != 'LOCK TABLE "public"."customers" IN SHARE ROW EXCLUSIVE MODE'
                or writes[1][1] != ("O'Brien", 1)
                or writes[2][0]
                != 'INSERT INTO "public"."customers" ("id", "display_name") VALUES ($1, $2)'
                or writes[2][1] != (1, "O'Brien")
                or write_connection.fetch_statements
                != [(
                    'SELECT COUNT(*) AS total_rows, COUNT("id") AS non_null_rows, '
                    'COUNT(DISTINCT "id") AS unique_rows FROM "public"."customers"',
                    (),
                )]
            ):
                raise AssertionError("Editable Provisioned save was not atomic and parameterized.")

            definition = read_mapping(namespace.get("VDAB_WORKFLOW_DEFINITION"))
            workflows = definition.get("workflows")
            if not isinstance(workflows, list) or not workflows:
                raise AssertionError("Generated Provisioned workflow was not included.")
            workflow = read_mapping(workflows[0])
            state = cast(dict[str, object], streamlit.module.session_state)
            registry = cast(
                dict[str, object],
                state.setdefault("_vdab_component_registry", {}),
            )
            registry["customer-field"] = {
                "key": "customer-field",
                "code_name": "customerField",
                "component_type": "TextInput",
                "widget_key": "widget_customer_field",
            }
            state["widget_customer_field"] = "O'Brien"
            execute_workflow = namespace.get("_vdab_execute_workflow")
            if not callable(execute_workflow):
                raise AssertionError("Generated Provisioned workflow runtime was omitted.")
            prior_workflow_connections = len(http.asyncpg.connections)
            workflow_state = read_mapping(execute_workflow(workflow, "save-form"))
            build_result = read_mapping(workflow_state.get("build"))
            run_result = read_mapping(workflow_state.get("run"))
            save_result = read_mapping(workflow_state.get("save"))
            run_output = read_mapping(run_result.get("output"))
            saved_output = read_mapping(save_result.get("output"))
            workflow_rows = run_output.get("rows")
            workflow_write = http.asyncpg.connections[-1]
            if (
                build_result.get("status") != "success"
                or read_mapping(build_result.get("output")).get("lakebaseInstanceName")
                != "legacy-provisioned"
                or read_mapping(build_result.get("output")).get("lakebaseResourceEnvironmentVariable")
                != PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE
                or run_result.get("status") != "success"
                or not isinstance(workflow_rows, FakeDataFrame)
                or workflow_rows.data != http.asyncpg.rows_by_table["lakebase_fixture"]
                or save_result.get("status") != "success"
                or saved_output.get("rowsAffected") != 1
                or len(http.asyncpg.connections) != prior_workflow_connections + 2
                or workflow_write.settings.get("user") != "viewer@example.com"
                or workflow_write.settings.get("password")
                != "offline-provisioned-credential"
                or workflow_write.settings.get("ssl") != "require"
                or workflow_write.transaction_options != [{}]
                or workflow_write.committed_transactions != 1
                or workflow_write.executed_statements[-1][0]
                != 'INSERT INTO "public"."customers" ("display_name") VALUES ($1)'
                or workflow_write.executed_statements[-1][1] != ("O'Brien",)
            ):
                raise AssertionError(
                    "Provisioned BuildSql, RunSql, or SaveToTable failed: "
                    + repr((
                        workflow_state,
                        workflow_rows.data if isinstance(workflow_rows, FakeDataFrame) else workflow_rows,
                        http.asyncpg.rows_by_table["lakebase_fixture"],
                        len(http.asyncpg.connections) - prior_workflow_connections,
                        workflow_write.settings,
                        workflow_write.transaction_options,
                        workflow_write.committed_transactions,
                        workflow_write.executed_statements,
                    ))
                )

            headers = cast(dict[str, str], streamlit.module.context.headers)
            headers.pop("x-forwarded-access-token", None)
            prior_instances = len(http.database_instance_requests)
            prior_connections = len(http.asyncpg.connections)
            identity_error = _capture_runtime_error(lambda: query_dataframe(
                "public",
                "customers",
                100,
                database="appdb",
                instance_name="legacy-provisioned",
                resource_environment_variable=PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE,
            ))
            if (
                "did not grant Lakebase user authorization" not in identity_error
                or len(http.database_instance_requests) != prior_instances
                or len(http.asyncpg.connections) != prior_connections
            ):
                raise AssertionError("Provisioned access continued without the viewer token.")

            headers["x-forwarded-access-token"] = ACCESS_TOKEN
            http.provisioned_credential_failure = True
            prior_connections = len(http.asyncpg.connections)
            permission_error = _capture_runtime_error(lambda: query_dataframe(
                "public",
                "customers",
                100,
                database="appdb",
                instance_name="legacy-provisioned",
                resource_environment_variable=PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE,
            ))
            if (
                "could not access this Lakebase Provisioned instance" not in permission_error
                or "viewer permission denied" in permission_error
                or len(http.asyncpg.connections) != prior_connections
                or http.provisioned_credential_requests[-1] != "legacy-provisioned"
            ):
                raise AssertionError(
                    "Provisioned permission denial used a fallback or exposed details: "
                    + repr((
                        permission_error,
                        prior_connections,
                        len(http.asyncpg.connections),
                        http.provisioned_credential_requests,
                        http.request_urls[-2:],
                    ))
                )

    return [
        "provisioned-data-window-chart-story-and-editable-readers",
        "provisioned-editable-transactional-write",
        "provisioned-buildsql-runsql-parameterized-savetable",
        "provisioned-identity-and-denial-no-fallback",
    ]
