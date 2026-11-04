"""Workflow-source and side-effect assertions shared by smoke scenarios."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import cast

from generated_workflow_test_support import (
    ACCESS_TOKEN, WORKFLOW_SQL_BYTE_LIMIT, WORKFLOW_SQL_ROW_LIMIT, read_mapping,
)
from generated_workflow_http_mocks import FakeHttp
from generated_workflow_streamlit_mock import FakeStreamlit

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
