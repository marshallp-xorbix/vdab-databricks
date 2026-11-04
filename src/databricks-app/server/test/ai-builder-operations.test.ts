import assert from "node:assert/strict";
import test from "node:test";
import { applyAiBuilderOperations } from "../src/ai-builder-operations.ts";
import type { AiBuilderProposal } from "../src/ai-builder-contract.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import type { ComponentDefinition } from "../src/component-registry/contracts.ts";
import { readAiBuilderProposal } from "../src/ai-builder-input.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "../src/generation/custom-modules-template.ts";

const definitions = new ComponentRegistryService().getRegistry().components;

test("AiBuilderOperations_ChangesOneRecordAndPreservesLargeProjectState", () => {
  const current = createProject(definitions, 499, 400);
  const originalComponent = current.components[250];
  assert.ok(originalComponent);
  const replacement = {
    ...originalComponent,
    properties: { ...originalComponent.properties, text: "Updated label" },
  };

  const result = applyAiBuilderOperations(current, JSON.stringify([{
    type: "replaceComponent",
    key: originalComponent.key,
    component: replacement,
  }]), 7, definitions);

  assert.equal(result.components.length, 500);
  assert.deepEqual(result.components[249], current.components[249]);
  assert.equal(result.components[250]?.properties.text, "Updated label");
  assert.deepEqual(result.workflow, current.workflow);
  assert.equal(result.customModulesSource, current.customModulesSource);
});

test("AiBuilderOperations_AppliesComponentWorkflowAndModuleOperationsInOrder", () => {
  const current = createProject(definitions, 0, 0);
  const updatedWorkflow = createWorkflow("Updated toast");
  const newLabel = createComponent("new-label", "Label", definitions);
  const operations = [
    { type: "upsertWorkflow", workflow: updatedWorkflow },
    { type: "replaceCustomModulesSource", source: "def helper(ctx):\n    return None\n" },
    { type: "addComponent", component: newLabel },
    { type: "reorderComponents", keys: ["new-label", "button-1"] },
  ];

  const result = applyAiBuilderOperations(current, JSON.stringify(operations), 3, definitions);

  assert.deepEqual(result.components.map((component) => component.key), ["new-label", "button-1"]);
  assert.equal(result.workflow.workflows[0]?.nodes[0]?.params.body, "Updated toast");
  assert.match(result.customModulesSource, /def helper\(ctx\)/);

  const deletedWorkflow = applyAiBuilderOperations(result, JSON.stringify([
    { type: "deleteWorkflow", codeName: "buttonWorkflow" },
  ]), 3, definitions);
  assert.deepEqual(deletedWorkflow.workflow.workflows, []);
});

test("AiBuilderOperations_RejectsConflictsMalformedListsAndDanglingReferences", () => {
  const current = createProject(definitions, 1, 0);
  const duplicateComponent = current.components[0];
  assert.ok(duplicateComponent);

  assertOperationRejected(current, [{
    type: "addComponent",
    component: duplicateComponent,
  }]);
  assertOperationRejected(current, [{
    type: "replaceComponent",
    key: "missing-component",
    component: duplicateComponent,
  }]);
  assertOperationRejected(current, [{ type: "deleteWorkflow", codeName: "missingWorkflow" }]);
  assertOperationRejected(current, [{ type: "reorderComponents", keys: ["only-one"] }]);
  assertOperationRejected(current, [{ type: "deleteComponent", key: "button-1" }]);
  assertOperationRejected(current, [{ type: "unknownOperation" }]);
  assertOperationRejected(current, [{ type: "deleteWorkflow", codeName: "buttonWorkflow", extra: true }]);
  assert.throws(
    () => applyAiBuilderOperations(current, "not-json", 1, definitions),
    (error: unknown) => isApplicationError(error),
  );
});

test("AiBuilderOperations_RejectsUnboundedOperationCountAndPayload", () => {
  const current = createProject(definitions, 0, 0);
  const tooManyOperations = Array.from({ length: 101 }, () => ({
    type: "deleteWorkflow",
    codeName: "missingWorkflow",
  }));
  assertOperationRejected(current, tooManyOperations);

  assert.throws(
    () => applyAiBuilderOperations(current, JSON.stringify([{
      type: "replaceCustomModulesSource",
      source: "x".repeat(280_000),
    }]), 1, definitions),
    (error: unknown) => isApplicationError(error),
  );
});

function assertOperationRejected(current: AiBuilderProposal, operations: unknown[]): void {
  assert.throws(
    () => applyAiBuilderOperations(current, JSON.stringify(operations), 1, definitions),
    (error: unknown) => isApplicationError(error),
  );
}

function createProject(
  componentDefinitions: ComponentDefinition[],
  labelCount: number,
  descriptionLength: number,
): AiBuilderProposal {
  const labels = Array.from({ length: labelCount }, (_, index) => ({
    ...createComponent(`label-${index}`, "Label", componentDefinitions),
    description: "kept ".repeat(Math.floor(descriptionLength / 5)),
  }));
  const components = [...labels, createComponent("button-1", "Button", componentDefinitions)];
  return readAiBuilderProposal({
    components,
    workflow: { version: 1, workflows: [createWorkflow("Original toast")] },
    customModulesSource: DEFAULT_CUSTOM_MODULES_SOURCE,
  }, 1, componentDefinitions);
}

function createComponent(
  key: string,
  type: "Button" | "Label",
  componentDefinitions: ComponentDefinition[],
): Record<string, unknown> {
  const componentDefinition = componentDefinitions.find((definition) => definition.type === type);
  if (!componentDefinition) throw new Error(`Missing ${type} registry definition.`);
  return {
    key,
    type,
    schemaVersion: 1,
    componentVersion: 1,
    codeName: null,
    description: null,
    properties: componentDefinition.props,
    bindings: null,
    children: [],
    layout: null,
  };
}

function createWorkflow(body: string): Record<string, unknown> {
  return {
    codeName: "buttonWorkflow",
    trigger: { componentKey: "button-1", eventKey: "onClick" },
    nodes: [{
      id: "toast-1",
      actionType: "triggerToast",
      schemaVersion: 1,
      params: { body, duration: { kind: "preset", value: "short" } },
    }],
    edges: [],
  };
}

function isApplicationError(value: unknown): boolean {
  return value instanceof Error && "status" in value && value.status === 422;
}
