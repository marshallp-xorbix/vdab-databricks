import { ApplicationError } from "./application-error.ts";
import type { AiBuilderProposal } from "./ai-builder-contract.ts";
import type { ComponentDefinition } from "./component-registry/contracts.ts";
import { readAiBuilderProposal } from "./ai-builder-input.ts";
import { resolveAiBuilderWorkflowReferences } from "./ai-builder-reference-resolution.ts";

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
    throw invalidAiBuilderOperations(
      `operationsJson exceeds the ${MAX_AI_BUILDER_OPERATIONS_BYTES}-byte limit. Send fewer or smaller changed records.`,
    );
  }

  let operationsValue: unknown;
  try {
    operationsValue = JSON.parse(operationsJson);
  } catch {
    throw invalidAiBuilderOperations("operationsJson is not valid JSON.");
  }
  if (!Array.isArray(operationsValue) || operationsValue.length < 1 ||
      operationsValue.length > MAX_AI_BUILDER_OPERATIONS) {
    throw invalidAiBuilderOperations(
      `operationsJson must be a JSON array with 1 to ${MAX_AI_BUILDER_OPERATIONS} operations.`,
    );
  }

  let components: unknown[] = [...current.components];
  let workflows: unknown[] = [...current.workflow.workflows];
  let customModulesSource = current.customModulesSource;

  for (let operationIndex = 0; operationIndex < operationsValue.length; operationIndex += 1) {
    const operation = readOperation(operationsValue[operationIndex], operationIndex);
    if (operation.type === "addComponent") {
      components = addComponent(components, operation.component, operationIndex);
    } else if (operation.type === "replaceComponent") {
      components = replaceComponent(components, operation.key, operation.component, operationIndex);
    } else if (operation.type === "deleteComponent") {
      components = deleteComponent(components, operation.key, operationIndex);
    } else if (operation.type === "reorderComponents") {
      components = reorderComponents(components, operation.keys, operationIndex);
    } else if (operation.type === "upsertWorkflow") {
      workflows = upsertWorkflow(workflows, operation.workflow, operationIndex);
    } else if (operation.type === "deleteWorkflow") {
      workflows = deleteWorkflow(workflows, operation.codeName, operationIndex);
    } else {
      customModulesSource = operation.source;
    }
  }

  const resolvedWorkflows = resolveAiBuilderWorkflowReferences(workflows, components);

  try {
    return readAiBuilderProposal({
      components,
      workflow: { version: 1, workflows: resolvedWorkflows },
      customModulesSource,
    }, version, componentDefinitions);
  } catch (error) {
    const detail = error instanceof ApplicationError
      ? error.message
      : "The proposed operations produced an invalid project snapshot.";
    throw invalidAiBuilderOperations(
      `${detail} Check component shapes, workflow references, and module source against the current project contracts.`,
    );
  }
}

function readOperation(value: unknown, operationIndex: number): AiBuilderOperation {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} must be an object with a string type.`,
    );
  }
  if (value.type === "addComponent") {
    assertExactKeys(value, ["type", "component"], operationIndex, value.type);
    return { type: value.type, component: value.component };
  }
  if (value.type === "replaceComponent") {
    assertExactKeys(value, ["type", "key", "component"], operationIndex, value.type);
    return {
      type: value.type,
      key: readBoundedText(value.key, MAX_COMPONENT_KEY_LENGTH, `Operation ${operationIndex + 1} key`),
      component: value.component,
    };
  }
  if (value.type === "deleteComponent") {
    assertExactKeys(value, ["type", "key"], operationIndex, value.type);
    return {
      type: value.type,
      key: readBoundedText(value.key, MAX_COMPONENT_KEY_LENGTH, `Operation ${operationIndex + 1} key`),
    };
  }
  if (value.type === "reorderComponents") {
    assertExactKeys(value, ["type", "keys"], operationIndex, value.type);
    if (!Array.isArray(value.keys) || value.keys.length > 500) {
      throw invalidAiBuilderOperations(
        `Operation ${operationIndex + 1} (reorderComponents) keys must be an array of at most 500 component keys.`,
      );
    }
    return {
      type: value.type,
      keys: value.keys.map((key, keyIndex) => readBoundedText(
        key,
        MAX_COMPONENT_KEY_LENGTH,
        `Operation ${operationIndex + 1} keys[${keyIndex}]`,
      )),
    };
  }
  if (value.type === "upsertWorkflow") {
    assertExactKeys(value, ["type", "workflow"], operationIndex, value.type);
    return { type: value.type, workflow: value.workflow };
  }
  if (value.type === "deleteWorkflow") {
    assertExactKeys(value, ["type", "codeName"], operationIndex, value.type);
    return {
      type: value.type,
      codeName: readBoundedText(
        value.codeName,
        MAX_WORKFLOW_NAME_LENGTH,
        `Operation ${operationIndex + 1} codeName`,
      ),
    };
  }
  if (value.type === "replaceCustomModulesSource") {
    assertExactKeys(value, ["type", "source"], operationIndex, value.type);
    if (typeof value.source !== "string" || value.source.length > MAX_CUSTOM_MODULE_SOURCE_LENGTH) {
      throw invalidAiBuilderOperations(
        `Operation ${operationIndex + 1} (replaceCustomModulesSource) source must be a string of at most ${MAX_CUSTOM_MODULE_SOURCE_LENGTH} characters.`,
      );
    }
    return { type: value.type, source: value.source };
  }
  throw invalidAiBuilderOperations(
    `Operation ${operationIndex + 1} has unsupported type "${value.type}".`,
  );
}

function addComponent(
  components: unknown[],
  component: unknown,
  operationIndex: number,
): unknown[] {
  const key = readObjectKey(component, operationIndex);
  if (findComponentIndex(components, key) !== -1) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} (addComponent) conflicts with existing component key "${key}". Use replaceComponent instead.`,
    );
  }
  return [...components, component];
}

function replaceComponent(
  components: unknown[],
  key: string,
  component: unknown,
  operationIndex: number,
): unknown[] {
  if (readObjectKey(component, operationIndex) !== key) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} (replaceComponent) key "${key}" does not match component.key.`,
    );
  }
  const index = findComponentIndex(components, key);
  if (index === -1) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} (replaceComponent) targets missing component key "${key}".`,
    );
  }
  const updated = [...components];
  updated[index] = component;
  return updated;
}

function deleteComponent(
  components: unknown[],
  key: string,
  operationIndex: number,
): unknown[] {
  const index = findComponentIndex(components, key);
  if (index === -1) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} (deleteComponent) targets missing component key "${key}".`,
    );
  }
  return components.filter((component) => !isRecord(component) || component.key !== key);
}

function reorderComponents(
  components: unknown[],
  keys: string[],
  operationIndex: number,
): unknown[] {
  const existingKeys = components.map((component) => readObjectKey(component, operationIndex));
  if (keys.length !== existingKeys.length || new Set(keys).size !== keys.length ||
      keys.some((key) => !existingKeys.includes(key))) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} (reorderComponents) must list every current component key exactly once.`,
    );
  }
  return keys.map((key) => {
    const index = findComponentIndex(components, key);
    if (index === -1) {
      throw invalidAiBuilderOperations(
        `Operation ${operationIndex + 1} (reorderComponents) references missing component key "${key}".`,
      );
    }
    const component = components[index];
    if (component === undefined) {
      throw invalidAiBuilderOperations(
        `Operation ${operationIndex + 1} (reorderComponents) references missing component key "${key}".`,
      );
    }
    return component;
  });
}

function upsertWorkflow(
  workflows: unknown[],
  workflow: unknown,
  operationIndex: number,
): unknown[] {
  const codeName = readWorkflowName(workflow, operationIndex);
  const index = findWorkflowIndex(workflows, codeName);
  if (index === -1) return [...workflows, workflow];
  const updated = [...workflows];
  updated[index] = workflow;
  return updated;
}

function deleteWorkflow(
  workflows: unknown[],
  codeName: string,
  operationIndex: number,
): unknown[] {
  const index = findWorkflowIndex(workflows, codeName);
  if (index === -1) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} (deleteWorkflow) targets missing workflow "${codeName}".`,
    );
  }
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
      if (foundIndex !== -1) {
        throw invalidAiBuilderOperations(
          `Current project snapshot has duplicate component key "${key}". Reload the project before retrying.`,
        );
      }
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
      if (foundIndex !== -1) {
        throw invalidAiBuilderOperations(
          `Current project snapshot has duplicate workflow codeName "${codeName}". Reload the project before retrying.`,
        );
      }
      foundIndex = index;
    }
  }
  return foundIndex;
}

function readObjectKey(value: unknown, operationIndex: number): string {
  if (!isRecord(value)) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} component must be an object with a key.`,
    );
  }
  return readBoundedText(value.key, MAX_COMPONENT_KEY_LENGTH, `Operation ${operationIndex + 1} component.key`);
}

function readWorkflowName(value: unknown, operationIndex: number): string {
  if (!isRecord(value)) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} workflow must be an object with a codeName.`,
    );
  }
  return readBoundedText(
    value.codeName,
    MAX_WORKFLOW_NAME_LENGTH,
    `Operation ${operationIndex + 1} workflow.codeName`,
  );
}

function readBoundedText(value: unknown, maximumLength: number, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength ||
      value.trim() !== value) {
    throw invalidAiBuilderOperations(
      `${label} must be a non-empty string of at most ${maximumLength} characters with no leading or trailing whitespace.`,
    );
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: string[],
  operationIndex: number,
  type: string,
): void {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) {
    throw invalidAiBuilderOperations(
      `Operation ${operationIndex + 1} (${type}) must contain exactly these fields: ${keys.join(", ")}.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidAiBuilderOperations(detail: string): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_ai_builder_proposal",
    "The proposed changes need review",
    detail,
  );
}
