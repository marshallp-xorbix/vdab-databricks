#!/usr/bin/env python3
"""Run generated Lakebase code against a disposable local PostgreSQL cluster."""

from __future__ import annotations

import tempfile
import types
from collections.abc import Callable, Mapping
from contextlib import AbstractContextManager
from pathlib import Path
from typing import cast

from generated_workflow_test_support import FakeDataFrame, FakeHttp, FakeStreamlit, read_mapping


def run_lakebase_postgres_scenarios(
    sources: Mapping[str, str],
    connection_settings: object,
    component_sources: Mapping[str, str],
    execute_app: Callable[..., dict[str, object]],
    mock_http: Callable[..., AbstractContextManager[None]],
    validate_workflow_contract: Callable[[Mapping[str, str]], None],
) -> list[str]:
    """Execute generated Lakebase helpers against the local disposable PostgreSQL."""
    import asyncio
    import asyncpg

    connection = _read_connection_settings(connection_settings)
    admin_settings = {
        "host": connection["host"],
        "port": connection["port"],
        "user": connection["user"],
        "database": connection["database"],
        "ssl": False,
        "timeout": 10,
    }

    async def prepare_database() -> None:
        admin = await asyncpg.connect(**admin_settings)
        try:
            await admin.execute('DROP DATABASE IF EXISTS "builder" WITH (FORCE)')
            await admin.execute('DROP ROLE IF EXISTS "viewer@example.com"')
            await admin.execute('CREATE ROLE "viewer@example.com" LOGIN')
            await admin.execute('CREATE DATABASE "builder"')
        finally:
            await admin.close()

        database_admin = await asyncpg.connect(**{**admin_settings, "database": "builder"})
        try:
            await database_admin.execute(
                'CREATE TABLE public.orders (customer_name TEXT, score INTEGER, "customer name" TEXT)'
            )
            await database_admin.execute(
                "CREATE TABLE public.private_orders (secret TEXT)"
            )
            await database_admin.execute(
                "CREATE TABLE public.lakebase_fixture (fixture_category TEXT, fixture_metric DOUBLE PRECISION, fixture_time TIMESTAMP)"
            )
            await database_admin.execute(
                "INSERT INTO public.orders (customer_name, score) VALUES ('Ada', 9)"
            )
            await database_admin.execute(
                'GRANT SELECT, INSERT ON public.orders TO "viewer@example.com"'
            )
            await database_admin.execute(
                'GRANT SELECT ON public.lakebase_fixture TO "viewer@example.com"'
            )
        finally:
            await database_admin.close()

    asyncio.run(prepare_database())
    try:
        with tempfile.TemporaryDirectory(prefix="vdab-lakebase-postgres-") as directory:
            bundle_directory = Path(directory)
            for relative_path, content in sources.items():
                if relative_path != "requirements.txt":
                    (bundle_directory / relative_path).write_text(content, encoding="utf-8")
            validate_workflow_contract(sources)
            http = FakeHttp()
            streamlit = FakeStreamlit()
            lakebase_connection = {
                "host": connection["host"],
                "port": connection["port"],
                "database": "builder",
            }
            local_asyncpg, local_connections = _local_asyncpg_without_ssl()
            namespace = execute_app(
                bundle_directory,
                http,
                streamlit,
                use_fake_asyncpg=False,
                lakebase_connection=lakebase_connection,
                asyncpg_module=local_asyncpg,
            )
            execute_action = namespace.get("_vdab_workflow_execute_action")
            if not callable(execute_action):
                raise AssertionError("Generated source omitted workflow actions.")
            build_result = read_mapping(execute_action({
                "id": "build",
                "actionType": "buildSql",
                "params": {
                    "sqlSourceKind": "lakebaseAutoscaling",
                    "sqlTemplate": "SELECT customer_name, score FROM public.orders",
                    "lakebaseDatabaseName": "builder",
                    "lakebaseProjectId": "workspace-project",
                    "lakebaseBranchId": "production",
                    "lakebaseEndpointId": "read-write",
                },
            }, {}, "save-form"))
            with mock_http(http, lakebase_connection=lakebase_connection):
                run_result = read_mapping(execute_action({
                    "id": "run",
                    "actionType": "runSql",
                    "params": {"statement": {"nodeId": "build"}},
                }, {"build": build_result}, "save-form"))
            run_output = read_mapping(run_result.get("output"))
            run_rows = run_output.get("rows")
            if (
                run_result.get("status") != "success"
                or not isinstance(run_rows, FakeDataFrame)
                or run_rows.data != [{"customer_name": "Ada", "score": 9}]
            ):
                raise AssertionError(
                    "Generated RunSql did not read rows as the viewer: "
                    + repr((run_result.get("status"), run_result.get("error"), run_rows))
                )

            state = cast(dict[str, object], namespace["st"].session_state)
            registry = cast(dict[str, object], state["_vdab_component_registry"])
            registry["customer-field"] = {
                "key": "customer-field",
                "code_name": "customerName",
                "component_type": "TextInput",
                "widget_key": "widget_customer_name",
            }
            state["widget_customer_name"] = "O'Brien"
            with mock_http(http, lakebase_connection=lakebase_connection):
                save_result = read_mapping(execute_action({
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
                }, {}, "save-form"))
            save_output = read_mapping(save_result.get("output"))
            if (
                save_result.get("status") != "success"
                or save_output.get("rowsAffected") != 1
            ):
                raise AssertionError("Generated SaveToTable did not write as the viewer.")

            async def verify_saved_value() -> None:
                admin = await asyncpg.connect(**{
                    **admin_settings,
                    "database": "builder",
                })
                try:
                    saved_name = await admin.fetchval(
                        'SELECT "customer name" FROM public.orders WHERE "customer name" = $1',
                        "O'Brien",
                    )
                    if saved_name != "O'Brien":
                        raise AssertionError("The generated parameterized write was not persisted.")
                finally:
                    await admin.close()

            asyncio.run(verify_saved_value())

            query_dataframe = namespace.get("_vdab_lakebase_query_df")
            if not callable(query_dataframe):
                raise AssertionError("Generated source omitted Lakebase queries.")
            try:
                with mock_http(http, lakebase_connection=lakebase_connection):
                    query_dataframe(
                        "public",
                        "private_orders",
                        10,
                        "SELECT secret FROM public.private_orders",
                        "builder",
                        "projects/workspace-project/branches/production/endpoints/read-write",
                    )
            except RuntimeError as error:
                if (
                    "denied or rejected" not in str(error)
                    or "permission denied" in str(error).casefold()
                ):
                    raise AssertionError("Generated Lakebase query exposed raw permission details.")
            else:
                raise AssertionError("Generated Lakebase query bypassed viewer table grants.")
        component_reads = _run_lakebase_component_reads(
            component_sources,
            connection,
            execute_app,
        )
    finally:
        async def clean_database() -> None:
            admin = await asyncpg.connect(**admin_settings)
            try:
                await admin.execute('DROP DATABASE IF EXISTS "builder" WITH (FORCE)')
                await admin.execute('DROP ROLE IF EXISTS "viewer@example.com"')
            finally:
                await admin.close()

        asyncio.run(clean_database())
    if len(local_connections) < 2 or any(
        connection_record.settings.get("user") != "viewer@example.com"
        for connection_record in local_connections
    ):
        raise AssertionError("Generated workflow connections did not use the forwarded viewer.")
    return [
        "local-postgresql-generated-workflow-read-write-and-viewer-permissions",
        f"local-postgresql-lakebase-component-reads-{component_reads}",
    ]


def _run_lakebase_component_reads(
    sources: Mapping[str, str],
    connection: Mapping[str, object],
    execute_app: Callable[..., dict[str, object]],
) -> int:
    """Execute DataWindow, charts and all story readers against local PostgreSQL."""
    with tempfile.TemporaryDirectory(prefix="vdab-lakebase-components-") as directory:
        bundle_directory = Path(directory)
        for relative_path, content in sources.items():
            if relative_path != "requirements.txt":
                (bundle_directory / relative_path).write_text(content, encoding="utf-8")
        http = FakeHttp()
        streamlit = FakeStreamlit()
        lakebase_connection = {
            "host": connection["host"],
            "port": connection["port"],
            "database": "builder",
        }
        asyncpg_module, connections = _local_asyncpg_without_ssl()
        execute_app(
            bundle_directory,
            http,
            streamlit,
            use_fake_asyncpg=False,
            lakebase_connection=lakebase_connection,
            asyncpg_module=asyncpg_module,
        )

    expected_read_count = 13
    if (
        len(connections) != expected_read_count
        or len(http.credential_requests) != expected_read_count
        or streamlit.errors
    ):
        raise AssertionError(
            "Lakebase visual readers did not execute successfully: "
            + repr((
                len(connections),
                len(http.credential_requests),
                streamlit.errors,
                [statement for connection_record in connections
                 for statement in connection_record.cursor_statements],
            ))
        )
    query_statements = [
        statement
        for connection_record in connections
        for statement in connection_record.cursor_statements
    ]
    if len(query_statements) != expected_read_count * 2 or any(
        '"public"."lakebase_fixture"' not in statement
        for statement in query_statements
    ):
        raise AssertionError("Lakebase visual readers did not use quoted table queries.")
    return expected_read_count


class LocalConnectionRecorder:
    """Record generated cursor SQL while forwarding calls to local PostgreSQL."""

    def __init__(
        self,
        connection: object,
        settings: Mapping[str, object],
        cursor_statements: list[str],
    ) -> None:
        self.connection = connection
        self.settings = dict(settings)
        self.cursor_statements = cursor_statements

    def transaction(self, **options: object) -> object:
        return self.connection.transaction(**options)

    def cursor(self, statement: str, *, prefetch: int = 50) -> object:
        self.cursor_statements.append(statement)
        return self.connection.cursor(statement, prefetch=prefetch)

    async def execute(self, statement: str, *values: object) -> str:
        return await self.connection.execute(statement, *values)

    async def close(self) -> None:
        await self.connection.close()


def _local_asyncpg_without_ssl() -> tuple[types.ModuleType, list[LocalConnectionRecorder]]:
    """Adapt generated TLS-required settings to the local throwaway server."""
    import asyncpg

    module = types.ModuleType("asyncpg")
    module.PostgresError = asyncpg.PostgresError
    module.exceptions = asyncpg.exceptions
    connections: list[LocalConnectionRecorder] = []

    async def connect(**settings: object) -> LocalConnectionRecorder:
        original_settings = dict(settings)
        settings["ssl"] = False
        connection = await asyncpg.connect(**settings)
        recorder = LocalConnectionRecorder(connection, original_settings, [])
        connections.append(recorder)
        return recorder

    module.connect = connect
    return module, connections


def _read_connection_settings(value: object) -> dict[str, object]:
    """Validate local PostgreSQL coordinates passed by the disposable test runner."""
    if not isinstance(value, dict):
        raise ValueError("Local PostgreSQL connection coordinates are missing.")
    host = value.get("host")
    port = value.get("port")
    user = value.get("user")
    database = value.get("database")
    if (
        not isinstance(host, str)
        or host != "127.0.0.1"
        or not isinstance(port, int)
        or not 1 <= port <= 65535
        or user != "vdab_test"
        or database != "postgres"
    ):
        raise ValueError("Local PostgreSQL test coordinates are invalid.")
    return {"host": host, "port": port, "user": user, "database": database}


