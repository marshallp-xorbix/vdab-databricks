"""Workspace and SQL HTTP fakes used by generated-app offline tests."""

from __future__ import annotations

import io
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping, Sequence
from typing import cast

from generated_workflow_test_support import (
    ACCESS_TOKEN,
    AUTOSCALING_DATABASE_HOST,
    AUTOSCALING_ENDPOINT_PATH,
    JOB_ID,
    PROVISIONED_DATABASE_HOST,
    WAREHOUSE_ID,
    WORKSPACE_HOST,
    FakeAsyncpg,
    FakeResponse,
    read_mapping,
)

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
        self.endpoint_requests: list[str] = []
        self.credential_failure = False
        self.provisioned_credential_requests: list[str] = []
        self.provisioned_credential_failure = False
        self.database_instance_requests: list[str] = []
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
        if url.startswith(WORKSPACE_HOST + "/api/2.0/database/instances/"):
            return self._open_database_instance(request, url)
        if url == WORKSPACE_HOST + "/api/2.0/database/credentials":
            return self._open_provisioned_credential(request, url)
        if url == WORKSPACE_HOST + "/api/2.0/postgres/credentials":
            return self._open_lakebase_credential(request, url)
        if url.startswith(WORKSPACE_HOST + "/api/2.0/postgres/projects/"):
            return self._open_lakebase_endpoint(request, url)
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

    def _open_database_instance(
        self,
        request: urllib.request.Request,
        url: str,
    ) -> FakeResponse:
        if request.get_method() != "GET":
            raise AssertionError("Provisioned database discovery must use GET.")
        instance_name = urllib.parse.unquote(url.rsplit("/", 1)[-1])
        if instance_name != "legacy-provisioned":
            raise AssertionError("Generated Provisioned access used another instance.")
        self._http.database_instance_requests.append(instance_name)
        return FakeResponse({
            "name": instance_name,
            "state": "AVAILABLE",
            "read_write_dns": PROVISIONED_DATABASE_HOST,
        })

    def _open_provisioned_credential(
        self,
        request: urllib.request.Request,
        url: str,
    ) -> FakeResponse:
        if request.get_method() != "POST":
            raise AssertionError("Provisioned credential exchange must use POST.")
        payload = _read_json_body(request.data)
        instance_names = payload.get("instance_names")
        if instance_names != ["legacy-provisioned"]:
            raise AssertionError("Provisioned credentials used another instance.")
        self._http.provisioned_credential_requests.append("legacy-provisioned")
        if self._http.provisioned_credential_failure:
            FakeHttp._raise_forbidden(url)
        return FakeResponse({
            "token": "offline-provisioned-credential",
            "expiration_time": "2026-10-21T12:00:00Z",
        })

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

    def _open_lakebase_endpoint(
        self,
        request: urllib.request.Request,
        url: str,
    ) -> FakeResponse:
        if request.get_method() != "GET":
            raise AssertionError("Lakebase endpoint discovery must use GET.")
        endpoint = urllib.parse.unquote(url.split("/api/2.0/postgres/", 1)[1])
        if endpoint != AUTOSCALING_ENDPOINT_PATH:
            raise AssertionError("Generated Autoscaling access requested another endpoint.")
        self._http.endpoint_requests.append(endpoint)
        return FakeResponse({
            "status": {"hosts": {"host": AUTOSCALING_DATABASE_HOST}},
        })

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
