"""Standard-library mocks shared by the generated workflow smoke harness."""

from __future__ import annotations

import io
import json
import re
import types
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from typing import cast

ACCESS_TOKEN = "offline-workflow-smoke-token"
WORKSPACE_HOST = "https://workspace.example.databricks.com"
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
        self.columns = list(columns or [])

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
        if self.statement.lstrip().upper().startswith("SELECT PG_COLUMN_SIZE("):
            return [
                (len(json.dumps(row, default=str, ensure_ascii=False).encode("utf-8")),)
                for row in self.connection.owner.rows
            ]
        return list(self.connection.owner.rows)

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
        return "INSERT 0 1"

    async def close(self) -> None:
        self.closed = True


class FakeAsyncpg:
    """Provide the small asyncpg surface used by generated source."""

    def __init__(self) -> None:
        self.module = types.ModuleType("asyncpg")
        self.rows: list[dict[str, object]] = [{"customer_name": "Ada", "score": 9}]
        self.connections: list[FakeConnection] = []
        self.module.PostgresError = FakePostgresError
        self.module.exceptions = types.SimpleNamespace(InterfaceError=FakeInterfaceError)
        self.module.connect = self.connect

    async def connect(self, **settings: object) -> FakeConnection:
        connection = FakeConnection(self, settings)
        self.connections.append(connection)
        return connection


class FakeStreamlit:
    """Record generated UI callbacks and side effects without Streamlit."""

    def __init__(self, *, submit_form: bool = False) -> None:
        self.module = types.ModuleType("streamlit")
        self.module.__path__ = []
        self.module.session_state = {}
        self.module.context = types.SimpleNamespace(
            headers={
                "x-forwarded-access-token": ACCESS_TOKEN,
                "x-forwarded-email": "viewer@example.com",
            }
        )
        self.module.set_page_config = self._noop
        self.module.title = self._noop
        self.module.subheader = self._noop
        self.module.write = self._noop
        self.module.info = self._info
        self.module.markdown = self._noop
        self.module.caption = self._noop
        self.module.error = self._error
        self.module.toast = self._toast
        self.module.dataframe = self._noop
        self.module.form = self._form
        self.module.form_submit_button = self._form_submit_button
        self.module.button = self._button
        self.module.text_input = self._text_input
        self.module.dialog = self._dialog
        self.module.rerun = self._noop
        self.module.__getattr__ = self._missing_streamlit_attribute
        self.components_module = types.ModuleType("streamlit.components")
        self.components_module.__path__ = []
        self.components_v1_module = types.ModuleType("streamlit.components.v1")
        self.components_v1_module.html = self._noop
        self.components_v1_module.iframe = self._noop
        self.components_module.v1 = self.components_v1_module
        self.submit_form = submit_form
        self.buttons: list[dict[str, object]] = []
        self.toasts: list[dict[str, object]] = []
        self.errors: list[str] = []
        self.infos: list[str] = []
        self.dialog_calls: list[str] = []

    def _noop(self, *arguments: object, **keywords: object) -> None:
        del arguments, keywords

    def _missing_streamlit_attribute(self, name: str) -> Callable[..., object]:
        context_attributes = {"columns", "container", "expander", "tabs"}
        value_attributes = {
            "checkbox",
            "chat_input",
            "date_input",
            "file_uploader",
            "multiselect",
            "number_input",
            "radio",
            "selectbox",
            "slider",
            "text_area",
            "time_input",
            "toggle",
        }
        if name in context_attributes:
            return self._layout_context
        if name in value_attributes:
            return self._widget_value
        if name in {"spinner", "chat_message"}:
            return self._context_or_decorator
        if name in {"text", "success", "warning", "vega_lite_chart", "data_editor"}:
            return self._noop
        raise AttributeError(f"The workflow smoke mock does not support st.{name}.")

    def _layout_context(
        self,
        columns: object = 1,
        *arguments: object,
        **keywords: object,
    ) -> object:
        del arguments, keywords
        column_count = columns if isinstance(columns, int) else len(columns) if isinstance(columns, list) else 1
        if column_count > 1:
            return [_NullContext() for _ in range(column_count)]
        return _NullContext()

    def _widget_value(self, *arguments: object, **keywords: object) -> object:
        del arguments
        key = keywords.get("key")
        default = keywords.get("value", keywords.get("default"))
        if isinstance(key, str):
            state = cast(dict[str, object], self.module.session_state)
            return state.setdefault(key, default)
        return default

    def _context_or_decorator(
        self,
        *arguments: object,
        **keywords: object,
    ) -> object:
        del arguments, keywords
        return _NullContext()

    def _error(self, message: object, *arguments: object, **keywords: object) -> None:
        del arguments, keywords
        self.errors.append(str(message))

    def _info(self, message: object, *arguments: object, **keywords: object) -> None:
        del arguments, keywords
        self.infos.append(str(message))

    def _toast(self, body: object, **keywords: object) -> None:
        self.toasts.append({"body": str(body), **keywords})

    def _form(self, *arguments: object, **keywords: object) -> object:
        del arguments, keywords
        return _NullContext()

    def _form_submit_button(
        self,
        *arguments: object,
        **keywords: object,
    ) -> bool:
        del arguments, keywords
        return self.submit_form

    def _button(
        self,
        label: object,
        *,
        key: object = None,
        on_click: object = None,
        args: object = (),
        **keywords: object,
    ) -> bool:
        del keywords
        if callable(on_click):
            self.buttons.append({
                "label": str(label),
                "key": key,
                "callback": on_click,
                "args": args,
            })
        return False

    def _text_input(self, *arguments: object, **keywords: object) -> str:
        del arguments
        key = keywords.get("key")
        if not isinstance(key, str):
            raise AssertionError("Generated text input did not include a widget key.")
        state = cast(dict[str, object], self.module.session_state)
        value = state.get(key, keywords.get("value", "")) or TEXT_INPUT_VALUE
        state[key] = value
        return str(value)

    def _dialog(self, title: str, **keywords: object) -> Callable[..., object]:
        del keywords

        def decorate(function: Callable[..., object]) -> Callable[..., object]:
            def invoke(*arguments: object, **call_keywords: object) -> object:
                self.dialog_calls.append(title)
                return function(*arguments, **call_keywords)

            return invoke

        return decorate


class _NullContext:
    """Context manager for generated Streamlit Form blocks."""

    def __enter__(self) -> _NullContext:
        return self

    def __exit__(
        self,
        exception_type: type[BaseException] | None,
        exception: BaseException | None,
        traceback: object,
    ) -> bool:
        return False


class FakeHttp:
    """Mock viewer-authorized workspace requests for one scenario."""

    def __init__(
        self,
        *,
        sql_failure: bool = False,
        job_failure: bool = False,
        empty_sql_results: bool = False,
        sql_responses: Sequence[Mapping[str, object] | bytes] = (),
    ) -> None:
        self.sql_failure = sql_failure
        self.job_failure = job_failure
        self.empty_sql_results = empty_sql_results
        self.sql_requests: list[tuple[str, Mapping[str, object]]] = []
        self.sql_get_requests: list[str] = []
        self.sql_responses = list(sql_responses)
        self.job_requests: list[str] = []
        self.upload_requests: list[tuple[str, bytes]] = []
        self.request_urls: list[str] = []
        self.redirect_target_requests: list[str] = []
        self.redirect_next: tuple[int, str] | None = None
        self.direct_urlopen_calls = 0
        self.redirect_policy_checked = False
        self.credential_requests: list[str] = []
        self.credential_failure = False
        self.asyncpg = FakeAsyncpg()

    def urlopen(self, request: object, timeout: float | None = None) -> FakeResponse:
        """Reject generated calls that bypass the redirect-blocking opener."""
        del request, timeout
        self.direct_urlopen_calls += 1
        raise AssertionError("Generated workspace calls must block redirects.")

    def build_opener(self, *handlers: object) -> FakeOpener:
        """Check and retain a redirect-blocking handler for generated calls."""
        if len(handlers) != 1:
            raise AssertionError("Workspace request omitted its redirect handler.")
        configured_handler = handlers[0]
        handler = (
            configured_handler()
            if isinstance(configured_handler, type)
            else configured_handler
        )
        redirect_request = getattr(handler, "redirect_request", None)
        if not callable(redirect_request):
            raise AssertionError("Workspace redirect handler is invalid.")
        probe_request = urllib.request.Request(WORKSPACE_HOST)
        for status_code in (302, 307, 308):
            if redirect_request(
                probe_request,
                None,
                status_code,
                "Redirect",
                {},
                "https://outside.invalid/",
            ) is not None:
                raise AssertionError("Generated workspace handler permits redirects.")
        self.redirect_policy_checked = True
        return FakeOpener(self, handler)

    @staticmethod
    def _assert_authority(request: urllib.request.Request) -> None:
        if request.get_header("Authorization") != f"Bearer {ACCESS_TOKEN}":
            raise AssertionError("Generated API call did not use the viewer token.")

    @staticmethod
    def _raise_forbidden(url: str) -> None:
        raise urllib.error.HTTPError(
            url,
            403,
            "Forbidden",
            {},
            io.BytesIO(b"viewer permission denied"),
        )


class FakeOpener:
    """Mock a generated Databricks API opener without following redirects."""

    def __init__(self, http: FakeHttp, redirect_handler: object) -> None:
        self._http = http
        self._redirect_handler = redirect_handler

    def open(self, request: object, timeout: float | None = None) -> FakeResponse:
        """Record one trusted request, returning only its direct response."""
        del timeout
        if not isinstance(request, urllib.request.Request):
            raise AssertionError("Generated workspace call did not use urllib Request.")
        self._http._assert_authority(request)
        url = request.get_full_url()
        self._http.request_urls.append(url)
        if url == WORKSPACE_HOST + "/api/2.0/postgres/credentials":
            return self._open_lakebase_credential(request, url)
        redirect = self._http.redirect_next
        if redirect is not None:
            self._http.redirect_next = None
            status_code, redirect_location = redirect
            redirect_request = getattr(self._redirect_handler, "redirect_request")
            redirected_request = redirect_request(
                request,
                None,
                status_code,
                "Redirect",
                {"Location": redirect_location},
                redirect_location,
            )
            if redirected_request is not None:
                self._http.redirect_target_requests.append(
                    redirected_request.get_full_url()
                )
                raise AssertionError("Generated workspace handler followed a redirect.")
            raise urllib.error.HTTPError(
                url,
                status_code,
                "Redirect",
                {"Location": redirect_location},
                io.BytesIO(b"private redirect response details"),
            )

        if url.startswith(WORKSPACE_HOST + "/api/2.0/sql/statements"):
            return self._open_sql(request, url)
        if url == WORKSPACE_HOST + "/api/2.2/jobs/run-now":
            return self._open_job(request, url)
        if url.startswith(WORKSPACE_HOST + "/api/2.0/fs/files/"):
            return self._open_volume_upload(request, url)
        raise AssertionError(f"Workspace request escaped installed APIs: {url}")

    def _open_lakebase_credential(
        self,
        request: urllib.request.Request,
        url: str,
    ) -> FakeResponse:
        if request.get_method() != "POST":
            raise AssertionError("Lakebase credential exchange must use POST.")
        payload = _read_json_body(request.data)
        endpoint = payload.get("endpoint")
        if not isinstance(endpoint, str) or not re.fullmatch(
            r"projects/[A-Za-z0-9_-]+/branches/[A-Za-z0-9_-]+/endpoints/[A-Za-z0-9_-]+",
            endpoint,
        ):
            raise AssertionError("Lakebase credentials used an invalid endpoint reference.")
        self._http.credential_requests.append(endpoint)
        if self._http.credential_failure:
            FakeHttp._raise_forbidden(url)
        return FakeResponse({"token": "offline-lakebase-credential"})

    def _open_sql(
        self,
        request: urllib.request.Request,
        url: str,
    ) -> FakeResponse:
        if request.get_method() == "GET":
            self._http.sql_get_requests.append(url)
            if not self._http.sql_responses:
                raise AssertionError("Generated SQL requested an unexpected result chunk.")
            return FakeResponse(self._http.sql_responses.pop(0))
        if request.get_method() != "POST":
            raise AssertionError("Generated SQL statement did not use POST or GET.")
        body = _read_json_body(request.data)
        if body.get("warehouse_id") != WAREHOUSE_ID:
            raise AssertionError(
                "SQL request did not use the installed workspace warehouse."
            )
        statement = body.get("statement")
        if not isinstance(statement, str):
            raise AssertionError("SQL request omitted its statement.")
        self._http.sql_requests.append((statement, body))
        is_insert = statement.lstrip().upper().startswith("INSERT INTO")
        if is_insert:
            parameters = body.get("parameters")
            if not isinstance(parameters, list) or not any(
                isinstance(parameter, dict) and parameter.get("value") == "Ada"
                for parameter in parameters
            ):
                raise AssertionError("SaveToTable did not bind its Form input value.")
        if self._http.sql_failure:
            FakeHttp._raise_forbidden(url)
        if self._http.sql_responses:
            return FakeResponse(self._http.sql_responses.pop(0))
        if is_insert:
            return FakeResponse({
                "statement_id": "save-statement",
                "status": {"state": "SUCCEEDED"},
            })
        if self._http.empty_sql_results:
            column_names = list(dict.fromkeys(re.findall(
                r"\bAS\s+`?([A-Za-z_][A-Za-z0-9_]*)`?",
                statement,
                flags=re.IGNORECASE,
            )))
            if not column_names:
                column_names = ["customer_id", "customer_name"]
            return FakeResponse({
                "statement_id": "empty-result-statement",
                "status": {"state": "SUCCEEDED"},
                "manifest": {
                    "schema": {
                        "columns": [{"name": name} for name in column_names],
                    },
                },
                "result": {"data_array": []},
            })
        return FakeResponse({
            "statement_id": "query-statement",
            "status": {"state": "SUCCEEDED"},
            "manifest": {"schema": {"columns": [{"name": "customer_name"}]}},
            "result": {"data_array": [["Ada"]]},
        })

    def _open_job(
        self,
        request: urllib.request.Request,
        url: str,
    ) -> FakeResponse:
        if request.get_method() != "POST":
            raise AssertionError("Generated Jobs Run Now request did not use POST.")
        payload = _read_json_body(request.data)
        if payload.get("job_id") != int(JOB_ID):
            raise AssertionError("Generated Jobs request used the wrong Job ID.")
        self._http.job_requests.append(url)
        if self._http.job_failure:
            FakeHttp._raise_forbidden(url)
        return FakeResponse({"run_id": 987654})

    def _open_volume_upload(
        self,
        request: urllib.request.Request,
        url: str,
    ) -> FakeResponse:
        if request.get_method() != "PUT" or not isinstance(request.data, bytes):
            raise AssertionError("Volume upload did not issue a byte PUT request.")
        self._http.upload_requests.append((url, request.data))
        return FakeResponse({})


def _read_json_body(body: bytes | None) -> dict[str, object]:
    """Decode a generated HTTP body and require a JSON object."""
    if body is None:
        raise AssertionError("Generated API request omitted its JSON body.")
    value: object = json.loads(body.decode("utf-8"))
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise AssertionError("Generated API request body was not a JSON object.")
    return read_mapping(value)


def read_mapping(value: object) -> dict[str, object]:
    """Narrow untrusted values to a string-keyed mapping."""
    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        return cast(dict[str, object], value)
    return {}
