"""Runtime loaders and HTTP context for generated-app offline tests."""

from __future__ import annotations

import os
import runpy
import sys
import types
import urllib.request
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from pathlib import Path
from typing import cast

from generated_workflow_test_support import (
    AUTOSCALING_DATABASE_HOST,
    AUTOSCALING_ENDPOINT_PATH,
    AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
    FakeDataFrame,
    PROVISIONED_DATABASE_HOST,
    PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE,
    WAREHOUSE_ID,
    WORKSPACE_HOST,
    WORKSPACE_ID,
)
from generated_workflow_http_mocks import FakeHttp
from generated_workflow_streamlit_mock import FakeStreamlit

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
    pandas.isna = lambda value: isinstance(value, float) and value != value
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
            AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE,
            PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE,
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
    os.environ[AUTOSCALING_RESOURCE_ENVIRONMENT_VARIABLE] = AUTOSCALING_ENDPOINT_PATH
    os.environ[PROVISIONED_RESOURCE_ENVIRONMENT_VARIABLE] = PROVISIONED_DATABASE_HOST
    if lakebase_connection is not None:
        os.environ["PGPORT"] = str(lakebase_connection["port"])
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
