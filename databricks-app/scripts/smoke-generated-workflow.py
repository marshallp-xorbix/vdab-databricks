#!/usr/bin/env python3
"""Execute a generated VDAB workflow bundle with local Streamlit and HTTP mocks.

Input is one JSON object on stdin with a ``files`` array. Each entry has a
relative ``path`` and generated source ``content``. The harness executes the
actual ``app.py`` and its adjacent module files; it does not contact Databricks.
"""

from __future__ import annotations

import json
import sys
import tempfile
import traceback
from collections.abc import Mapping
from pathlib import Path
from smoke_generated_workflow_runtime import _execute_app, _mock_http
from smoke_generated_workflow_assertions import _validate_workflow_contract
from smoke_generated_workflow_lakebase import _run_lakebase_scenarios
from smoke_generated_workflow_lakebase_provisioned import _run_lakebase_provisioned_scenarios
from smoke_generated_workflow_scenarios import (
    _run_button_case,
    _run_form_case,
    _run_redirect_security_case,
    _run_sql_response_bounds_case,
    _run_story_empty_state_case,
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
        elif scenario == "lakebase-provisioned":
            checks = _run_lakebase_provisioned_scenarios(files)
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
    allowed_notice_paths = {
        "THIRD_PARTY_NOTICES/asyncpg-0.32.0-LICENSE.txt",
    }
    seen_paths: set[str] = set()
    for entry in value["files"]:
        if not isinstance(entry, dict):
            raise ValueError("Every bundle file must be an object.")
        path = entry.get("path")
        content = entry.get("content")
        if (
            not isinstance(path, str)
            or (path not in allowed_paths and path not in allowed_notice_paths)
            or not isinstance(content, str)
        ):
            raise ValueError("Bundle paths must be supported generated source files.")
        if path in seen_paths:
            raise ValueError(f"Bundle contains duplicate file path: {path}")
        seen_paths.add(path)
        if path in allowed_paths:
            sources[path] = content
    if "app.py" not in sources:
        raise ValueError("Bundle is missing app.py.")
    return sources












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










































if __name__ == "__main__":
    raise SystemExit(main())
