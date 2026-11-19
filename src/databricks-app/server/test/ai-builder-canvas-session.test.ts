import assert from "node:assert/strict";
import test from "node:test";
import { AiBuilderCanvasSession } from "../src/ai-builder-canvas-session.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "../src/generation/custom-modules-template.ts";

const definitions = new ComponentRegistryService().getRegistry().components;

test("AiBuilderCanvasSession_CompletesModalAndToastWorkflowsInOneTurn", () => {
  const session = new AiBuilderCanvasSession({
    components: [
      button("uuid-modal-button", "modalButton"),
      button("uuid-toast-button", "toastButton"),
    ],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  }, definitions);

  assert.equal(session.executeTool("addModal", {
    title: "Workflow Modal",
    codeName: "workflowModal",
  }), "workflowModal");
  assert.equal(session.executeTool("createWorkflow", {
    workflowCodeName: "openWorkflowModal",
    triggerComponentCodeName: "modalButton",
    triggerEventKey: "onClick",
  }), "openWorkflowModal");
  assert.equal(session.executeTool("addShowModalAction", {
    workflowCodeName: "openWorkflowModal",
    nodeId: "showModal1",
    modalCodeName: "workflowModal",
  }), "showModal1");
  assert.equal(session.executeTool("createWorkflow", {
    workflowCodeName: "toastTriggered",
    triggerComponentCodeName: "toastButton",
    triggerEventKey: "onClick",
  }), "toastTriggered");
  assert.equal(session.executeTool("addTriggerToastAction", {
    workflowCodeName: "toastTriggered",
    nodeId: "toast1",
    body: "Toast Triggered!",
    toastDuration: "short",
  }), "toast1");

  const proposal = session.buildProposal(1, definitions);
  assert.equal(proposal.components.some((component) => component.codeName === "workflowModal"), true);
  assert.deepEqual(proposal.workflow.workflows.map((workflow) => ({
    codeName: workflow.codeName,
    trigger: workflow.trigger,
    actionType: workflow.nodes[0]?.actionType,
    params: workflow.nodes[0]?.params,
  })), [
    {
      codeName: "openWorkflowModal",
      trigger: { componentKey: "uuid-modal-button", eventKey: "onClick" },
      actionType: "showModal",
      params: { modalComponentKey: "workflowModal" },
    },
    {
      codeName: "toastTriggered",
      trigger: { componentKey: "uuid-toast-button", eventKey: "onClick" },
      actionType: "triggerToast",
      params: { body: "Toast Triggered!", duration: { kind: "preset", value: "short" } },
    },
  ]);
});

test("AiBuilderCanvasSession_ReturnsActionableErrorsWithoutMutatingOnFailure", () => {
  const session = new AiBuilderCanvasSession({
    components: [button("uuid-toast-button", "toastButton")],
    workflow: { version: 1, workflows: [] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  }, definitions);

  assert.match(
    session.executeTool("addShowModalAction", {
      workflowCodeName: "missing",
      nodeId: "show1",
      modalCodeName: "workflowModal",
    }),
    /^ERROR: Workflow 'missing' not found/,
  );
  assert.equal(session.hasChanges(), false);
});

function button(key: string, codeName: string) {
  const definition = definitions.find((item) => item.type === "Button");
  if (!definition) throw new Error("Missing Button definition.");
  return {
    key,
    type: "Button" as const,
    schemaVersion: 1,
    componentVersion: 1,
    codeName,
    description: null,
    properties: { ...definition.props },
    bindings: null,
    children: [],
    layout: null,
  };
}
