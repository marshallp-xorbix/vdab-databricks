import { ApplicationError } from "./application-error.ts";
import type { AiBuilderProposal } from "./ai-builder-contract.ts";
import type { ComponentDefinition } from "./component-registry/contracts.ts";
import { readAiBuilderProposal } from "./ai-builder-input.ts";

const MAX_AI_BUILDER_OPERATIONS = 100;
const MAX_AI_BUILDER_OPERATIONS_BYTES = 280_000;
const MAX_COMPONENT_KEY_LENGTH = 160;
const MAX_WORKFLOW_NAME_LENGTH = 80;
const MAX_CUSTOM_MODULE_SOURCE_LENGTH = 256_000;

type AiBuilderOperation =
  | { type: "addComponent"; component: unknown }
  | { type: "replaceComponent"; key: string; component: unknown }
  | { type: "deleteComponent"; key: string }
  | { type: "reorderComponents"; keys: string[] }
  | { type: "upsertWorkflow"; workflow: unknown }
  | { type: "deleteWorkflow"; codeName: string }
  | { type: "replaceCustomModulesSource"; source: string };

/** Applies bounded model operations to a trusted editor snapshot, then revalidates it. */
export function applyAiBuilderOperations(
  current: AiBuilderProposal,
  operationsJson: string,
  version: number,
  componentDefinitions: ComponentDefinition[],
): AiBuilderProposal {
  if (Buffer.byteLength(operationsJson, "utf8") > MAX_AI_BUILDER_OPERATIONS_BYTES) {
    throw invalidAiBuilderOperations();
  }

  let operationsValue: unknown;
  try {
    operationsValue = JSON.parse(operationsJson);
  } catch {
    throw invalidAiBuilderOperations();
  }
  if (!Array.isArray(operationsValue) || operationsValue.length < 1 ||
      operationsValue.length > MAX_AI_BUILDER_OPERATIONS) {
    throw invalidAiBuilderOperations();
  }

  let components: unknown[] = [...current.components];
  let workflows: unknown[] = [...current.workflow.workflows];
  let customModulesSource = current.customModulesSource;

  for (const value of operationsValue) {
    const operation = readOperation(value);
    if (operation.type === "addComponent") {
      components = addComponent(components, operation.component);
    } else if (operation.type === "replaceComponent") {
      components = replaceComponent(components, operation.key, operation.component);
    } else if (operation.type === "deleteComponent") {
      components = deleteComponent(components, operation.key);
    } else if (operation.type === "reorderComponents") {
      components = reorderComponents(components, operation.keys);
    } else if (operation.type === "upsertWorkflow") {
      workflows = upsertWorkflow(workflows, operation.workflow);
    } else if (operation.type === "deleteWorkflow") {
      workflows = deleteWorkflow(workflows, operation.codeName);
    } else {
      customModulesSource = operation.source;
    }
  }

  try {
    return readAiBuilderProposal({
      components,
      workflow: { version: 1, workflows },
      customModulesSource,
    }, version, componentDefinitions);
  } catch {
    throw invalidAiBuilderOperations();
  }
}

function readOperation(value: unknown): AiBuilderOperation {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw invalidAiBuilderOperations();
  }
  if (value.type === "addComponent") {
    assertExactKeys(value, ["type", "component"]);
    return { type: value.type, component: value.component };
  }
  if (value.type === "replaceComponent") {
    assertExactKeys(value, ["type", "key", "component"]);
    return {
      type: value.type,
      key: readBoundedText(value.key, MAX_COMPONENT_KEY_LENGTH),
      component: value.component,
    };
  }
  if (value.type === "deleteComponent") {
    assertExactKeys(value, ["type", "key"]);
    return { type: value.type, key: readBoundedText(value.key, MAX_COMPONENT_KEY_LENGTH) };
  }
  if (value.type === "reorderComponents") {
    assertExactKeys(value, ["type", "keys"]);
    if (!Array.isArray(value.keys) || value.keys.length > 500) {
      throw invalidAiBuilderOperations();
    }
    return {
      type: value.type,
      keys: value.keys.map((key) => readBoundedText(key, MAX_COMPONENT_KEY_LENGTH)),
    };
  }
  if (value.type === "upsertWorkflow") {
    assertExactKeys(value, ["type", "workflow"]);
    return { type: value.type, workflow: value.workflow };
  }
  if (value.type === "deleteWorkflow") {
    assertExactKeys(value, ["type", "codeName"]);
    return { type: value.type, codeName: readBoundedText(value.codeName, MAX_WORKFLOW_NAME_LENGTH) };
  }
  if (value.type === "replaceCustomModulesSource") {
    assertExactKeys(value, ["type", "source"]);
    if (typeof value.source !== "string" || value.source.length > MAX_CUSTOM_MODULE_SOURCE_LENGTH) {
      throw invalidAiBuilderOperations();
    }
    return { type: value.type, source: value.source };
  }
  throw invalidAiBuilderOperations();
}

function addComponent(components: unknown[], component: unknown): unknown[] {
  const key = readObjectKey(component);
  if (findComponentIndex(components, key) !== -1) throw invalidAiBuilderOperations();
  return [...components, component];
}

function replaceComponent(components: unknown[], key: string, component: unknown): unknown[] {
  if (readObjectKey(component) !== key) throw invalidAiBuilderOperations();
  const index = findComponentIndex(components, key);
  if (index === -1) throw invalidAiBuilderOperations();
  const updated = [...components];
  updated[index] = component;
  return updated;
}

function deleteComponent(components: unknown[], key: string): unknown[] {
  const index = findComponentIndex(components, key);
  if (index === -1) throw invalidAiBuilderOperations();
  return components.filter((component) => !isRecord(component) || component.key !== key);
}

function reorderComponents(components: unknown[], keys: string[]): unknown[] {
  const existingKeys = components.map(readObjectKey);
  if (keys.length !== existingKeys.length || new Set(keys).size !== keys.length ||
      keys.some((key) => !existingKeys.includes(key))) {
    throw invalidAiBuilderOperations();
  }
  return keys.map((key) => {
    const index = findComponentIndex(components, key);
    if (index === -1) throw invalidAiBuilderOperations();
    const component = components[index];
    if (component === undefined) throw invalidAiBuilderOperations();
    return component;
  });
}

function upsertWorkflow(workflows: unknown[], workflow: unknown): unknown[] {
  const codeName = readWorkflowName(workflow);
  const index = findWorkflowIndex(workflows, codeName);
  if (index === -1) return [...workflows, workflow];
  const updated = [...workflows];
  updated[index] = workflow;
  return updated;
}

function deleteWorkflow(workflows: unknown[], codeName: string): unknown[] {
  const index = findWorkflowIndex(workflows, codeName);
  if (index === -1) throw invalidAiBuilderOperations();
  const normalizedName = codeName.toLocaleLowerCase("en-US");
  return workflows.filter((workflow) => {
    if (!isRecord(workflow) || typeof workflow.codeName !== "string") return true;
    return workflow.codeName.toLocaleLowerCase("en-US") !== normalizedName;
  });
}

function findComponentIndex(components: unknown[], key: string): number {
  let foundIndex = -1;
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    if (isRecord(component) && component.key === key) {
      if (foundIndex !== -1) throw invalidAiBuilderOperations();
      foundIndex = index;
    }
  }
  return foundIndex;
}

function findWorkflowIndex(workflows: unknown[], codeName: string): number {
  const normalizedName = codeName.toLocaleLowerCase("en-US");
  let foundIndex = -1;
  for (let index = 0; index < workflows.length; index += 1) {
    const workflow = workflows[index];
    if (isRecord(workflow) && typeof workflow.codeName === "string" &&
        workflow.codeName.toLocaleLowerCase("en-US") === normalizedName) {
      if (foundIndex !== -1) throw invalidAiBuilderOperations();
      foundIndex = index;
    }
  }
  return foundIndex;
}

function readObjectKey(value: unknown): string {
  if (!isRecord(value)) throw invalidAiBuilderOperations();
  return readBoundedText(value.key, MAX_COMPONENT_KEY_LENGTH);
}

function readWorkflowName(value: unknown): string {
  if (!isRecord(value)) throw invalidAiBuilderOperations();
  return readBoundedText(value.codeName, MAX_WORKFLOW_NAME_LENGTH);
}

function readBoundedText(value: unknown, maximumLength: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength ||
      value.trim() !== value) {
    throw invalidAiBuilderOperations();
  }
  return value;
}

function assertExactKeys(value: Record<string, unknown>, keys: string[]): void {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) {
    throw invalidAiBuilderOperations();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidAiBuilderOperations(): ApplicationError {
  return new ApplicationError(422, "invalid_ai_builder_proposal", "The proposed changes need review", "The model returned invalid or conflicting project operations. Try a smaller change or another endpoint.");
}
