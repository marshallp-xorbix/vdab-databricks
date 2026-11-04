"""Standard-library mocks shared by the generated workflow smoke harness."""

from __future__ import annotations

import io
import hashlib
import json
import re
import types
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from typing import cast


def _resource_environment_variable(prefix: str, *parts: str) -> str:
    """Derive the generated App key used by the matching TypeScript helper."""
    identity = "\0".join(parts).encode("utf-8")
    suffix = hashlib.sha256(identity).hexdigest()[:16].upper()
    return prefix + suffix


ACCESS_TOKEN = "offline-workflow-smoke-token"
WORKSPACE_HOST = "https://workspace.example.databricks.com"
PROVISIONED_DATABASE_HOST = "ep-smoke.database.us-west-2.databricks.com"
AUTOSCALING_DATABASE_HOST = "ep-autoscaling.database.us-west-2.databricks.com"
AUTOSCALING_ENDPOINT_PATH = "projects/workspace-project/branches/production/endpoints/read-write"
AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE = _resource_environment_variable(
    "VDAB_LAKEBASE_ENDPOINT_",
    "autoscaling",
    "workspace-project",
    "production",
    "read-write",
    "database-one",
)
PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE = _resource_environment_variable(
    "VDAB_LAKEBASE_HOST_",
    "provisioned",
    "legacy-provisioned",
    "appdb",
)
WORKSPACE_ID = "1234567890123456"
WAREHOUSE_ID = "warehouse-smoke"
JOB_ID = "12345"
REQUIRED_CLICK_ACTIONS = {
    "triggerToast",
    "showModal",
    "buildSql",
    "runSql",
    "setBinding",
    "startDatabricksJob",
    "callCustomModule",
    "callPrebuiltModule",
}
TEXT_INPUT_VALUE = "Ada"
WORKFLOW_SQL_ROW_LIMIT = 10_000
WORKFLOW_SQL_BYTE_LIMIT = 20_000_000


class FakeDataFrame:
    """Minimal DataFrame value used by generated SQL and binding helpers."""

    def __init__(
        self,
        data: object = None,
        columns: Sequence[str] | None = None,
    ) -> None:
        self.data = data
        if columns is not None:
            self.columns = list(columns)
        elif isinstance(data, list) and data and isinstance(data[0], dict):
            self.columns = list(data[0])
        else:
            self.columns = []

    def copy(self) -> FakeDataFrame:
        """Return a shallow copy, matching the generated helper's contract."""
        return FakeDataFrame(self.data, self.columns)

    @property
    def empty(self) -> bool:
        """Report whether the mock contains any rows."""
        return self.data is None or self.data == []


class FakeResponse:
    """Small context-managed HTTP response containing encoded JSON."""

    def __init__(self, payload: Mapping[str, object] | bytes) -> None:
        if isinstance(payload, bytes):
            self._body = payload
        else:
            self._body = json.dumps(payload).encode("utf-8")

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(
        self,
        exception_type: type[BaseException] | None,
        exception: BaseException | None,
        traceback: object,
    ) -> bool:
        return False

    def read(self, amount: int = -1) -> bytes:
        """Return response bytes, respecting the requested read bound."""
        return self._body if amount < 0 else self._body[:amount]


class FakeTransaction:
    """Async transaction context used by the generated Lakebase runtime."""

    def __init__(self, connection: FakeConnection, options: Mapping[str, object]) -> None:
        self.connection = connection
        self.options = dict(options)

    async def __aenter__(self) -> FakeTransaction:
        self.connection.transaction_options.append(self.options)
        self.connection.transaction_active = True
        return self

    async def __aexit__(
        self,
        exception_type: type[BaseException] | None,
        exception: BaseException | None,
        traceback: object,
    ) -> bool:
        del exception_type, traceback
        self.connection.transaction_active = False
        if exception is None:
            self.connection.committed_transactions += 1
        else:
            self.connection.rolled_back_transactions += 1
        return False


class FakeCursor:
    """Async cursor yielding bounded fake Lakebase rows."""

    def __init__(self, connection: FakeConnection, statement: str) -> None:
        self.connection = connection
        self.statement = statement
        self.rows: list[object] = self._make_rows()
        self.row_index = 0

    def _make_rows(self) -> list[object]:
        if "customers" in self.statement:
            rows = self.connection.owner.rows_by_table["customers"]
        elif "lakebase_fixture" in self.statement:
            rows = self.connection.owner.rows_by_table["lakebase_fixture"]
        else:
            rows = self.connection.owner.rows
        if self.statement.lstrip().upper().startswith("SELECT PG_COLUMN_SIZE("):
            return [
                (len(json.dumps(row, default=str, ensure_ascii=False).encode("utf-8")),)
                for row in rows
            ]
        return list(rows)

    def __aiter__(self) -> FakeCursor:
        return self

    async def __anext__(self) -> object:
        if self.row_index >= len(self.rows):
            raise StopAsyncIteration
        row = self.rows[self.row_index]
        self.row_index += 1
        return row


class FakePostgresError(Exception):
    """Mock PostgreSQL exception caught by generated code."""


class FakeInterfaceError(Exception):
    """Mock asyncpg interface exception caught by generated code."""


class FakeConnection:
    """Record parameterized reads and writes from generated code."""

    def __init__(self, owner: FakeAsyncpg, settings: Mapping[str, object]) -> None:
        self.owner = owner
        self.settings = dict(settings)
        self.cursor_statements: list[str] = []
        self.executed_statements: list[tuple[str, tuple[object, ...]]] = []
        self.fetch_statements: list[tuple[str, tuple[object, ...]]] = []
        self.transaction_options: list[dict[str, object]] = []
        self.transaction_active = False
        self.committed_transactions = 0
        self.rolled_back_transactions = 0
        self.closed = False

    def transaction(self, **options: object) -> FakeTransaction:
        return FakeTransaction(self, options)

    def cursor(self, statement: str, *, prefetch: int = 50) -> FakeCursor:
        if not self.transaction_active or prefetch < 1:
            raise AssertionError("Lakebase cursors must run inside a bounded transaction.")
        self.cursor_statements.append(statement)
        return FakeCursor(self, statement)

    async def execute(self, statement: str, *values: object) -> str:
        if not self.transaction_active:
            raise AssertionError("Lakebase writes must run inside a transaction.")
        self.executed_statements.append((statement, values))
        if statement.lstrip().upper().startswith("UPDATE "):
            return "UPDATE 0"
        if statement.lstrip().upper().startswith("INSERT "):
            return "INSERT 0 1"
        return "LOCK TABLE"

    async def fetchrow(self, statement: str, *values: object) -> Mapping[str, int]:
        if not self.transaction_active:
            raise AssertionError("Lakebase metadata reads must run inside a transaction.")
        self.fetch_statements.append((statement, values))
        return {"total_rows": 2, "non_null_rows": 2, "unique_rows": 2}

    async def close(self) -> None:
        self.closed = True


class FakeAsyncpg:
    """Provide the small asyncpg surface used by generated source."""

    def __init__(self) -> None:
        self.module = types.ModuleType("asyncpg")
        self.rows: list[dict[str, object]] = [{"customer_name": "Ada", "score": 9}]
        self.rows_by_table = {
            "customers": [{"id": 1, "display_name": "Ada"}],
            "lakebase_fixture": [{
                "fixture_category": "fixture",
                "fixture_metric": 2.0,
                "fixture_time": "2026-10-21T00:00:00Z",
            }],
        }
        self.connections: list[FakeConnection] = []
        self.module.PostgresError = FakePostgresError
        self.module.exceptions = types.SimpleNamespace(InterfaceError=FakeInterfaceError)
        self.module.connect = self.connect

    async def connect(self, **settings: object) -> FakeConnection:
        connection = FakeConnection(self, settings)
        self.connections.append(connection)
        return connection












def read_mapping(value: object) -> dict[str, object]:
    """Narrow untrusted values to a string-keyed mapping."""
    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        return cast(dict[str, object], value)
    return {}
