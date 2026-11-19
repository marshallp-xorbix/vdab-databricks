import assert from "node:assert/strict";
import test from "node:test";
import { resolveAiBuilderWorkflowReferences } from "../src/ai-builder-reference-resolution.ts";

test("AiBuilderReferenceResolution_MapsCodeNamesAndEditorFieldsToKeys", () => {
  const components = [
    { key: "uuid-modal-button", type: "Button", codeName: "modalButton" },
    { key: "uuid-toast-button", type: "Button", codeName: "toastButton" },
    { key: "workflowModal", type: "Modal", codeName: "workflowModal" },
  ];

  const resolved = resolveAiBuilderWorkflowReferences([
    {
      codeName: "openWorkflowModal",
      trigger: { componentCodeName: "modalButton", eventKey: "onClick" },
      nodes: [{
        id: "show-1",
        actionType: "showModal",
        schemaVersion: 1,
        params: { modalCodeName: "workflowModal" },
      }],
      edges: [],
    },
    {
      codeName: "showToast",
      trigger: { componentKey: "toastButton", eventKey: "onClick" },
      nodes: [{
        id: "toast-1",
        actionType: "triggerToast",
        schemaVersion: 1,
        params: { body: "Toast Triggered!", duration: { kind: "preset", value: "short" } },
      }],
      edges: [],
    },
  ], components);

  assert.deepEqual(resolved[0], {
    codeName: "openWorkflowModal",
    trigger: { componentKey: "uuid-modal-button", eventKey: "onClick" },
    nodes: [{
      id: "show-1",
      actionType: "showModal",
      schemaVersion: 1,
      params: { modalComponentKey: "workflowModal" },
    }],
    edges: [],
  });
  assert.deepEqual(
    (resolved[1] as { trigger: { componentKey: string } }).trigger,
    { componentKey: "uuid-toast-button", eventKey: "onClick" },
  );
});

test("AiBuilderReferenceResolution_LeavesAmbiguousCodeNamesUnresolved", () => {
  const components = [
    { key: "first", type: "Button", codeName: "shared" },
    { key: "second", type: "Button", codeName: "shared" },
  ];
  const resolved = resolveAiBuilderWorkflowReferences([{
    codeName: "ambiguous",
    trigger: { componentKey: "shared", eventKey: "onClick" },
    nodes: [],
    edges: [],
  }], components);

  assert.equal(
    (resolved[0] as { trigger: { componentKey: string } }).trigger.componentKey,
    "shared",
  );
});
