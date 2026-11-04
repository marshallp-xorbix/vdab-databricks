import { ApplicationError } from "./application-error.ts";
import type { AiBuilderInput, AiBuilderMessage, AiBuilderProposal } from "./ai-builder-contract.ts";
import type { ComponentDefinition } from "./component-registry/contracts.ts";
import { readComponentsInput } from "./db/project-components-input.ts";
import { readProjectCustomModulesInput } from "./db/project-custom-modules-input.ts";
import { readProjectWorkflowInput } from "./db/project-workflow-input.ts";
import { validateProjectWorkflowComponentReferences } from "./db/project-workflow-component-references.ts";
import { resolveWorkflowModuleFiles } from "./generation/preview-workflow-modules.ts";

const MAX_PROMPT_LENGTH = 4_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_LENGTH = 20_000;
const MAX_AI_CONTEXT_BYTES = 800_000;
const ENDPOINT_NAME_PATTERN = /^[A-Za-z0-9_-]{1,63}$/;

/** Validates the editor snapshot and conversation before sending it to a model. */
export function readAiBuilderInput(
  value: unknown,
  componentDefinitions: ComponentDefinition[],
): AiBuilderInput {
  if (!isRecord(value) || !hasExactKeys(value, [
    "version",
    "endpointName",
    "prompt",
    "history",
    "components",
    "workflow",
    "customModulesSource",
  ])) {
    throw invalidAiBuilderRequest("AI Builder request fields are invalid.");
  }

  const version = requirePositiveInteger(value.version, "A current project version is required.");
  if (typeof value.endpointName !== "string" || !ENDPOINT_NAME_PATTERN.test(value.endpointName)) {
    throw invalidAiBuilderRequest("Select a valid serving endpoint from this workspace.");
  }
  if (typeof value.prompt !== "string" || value.prompt.trim().length === 0 || value.prompt.length > MAX_PROMPT_LENGTH) {
    throw invalidAiBuilderRequest(`Prompts must contain 1 to ${MAX_PROMPT_LENGTH} characters.`);
  }
  const history = readHistory(value.history);
  const components = readComponentsInput({ version, components: value.components }).components;
  const workflow = readProjectWorkflowInput({ version, workflow: value.workflow }).workflow;
  const customModulesSource = readProjectCustomModulesInput({
    expectedVersion: version,
    source: value.customModulesSource,
  }).source;

  validateProjectWorkflowComponentReferences(workflow, components, componentDefinitions);
  resolveWorkflowModuleFiles(workflow, customModulesSource);

  const proposalContext: AiBuilderProposal = {
    components,
    workflow,
    customModulesSource,
  };
  if (Buffer.byteLength(JSON.stringify({ version, history, proposalContext }), "utf8") > MAX_AI_CONTEXT_BYTES) {
    throw invalidAiBuilderRequest("The current project and conversation exceed the AI Builder context limit.");
  }

  return {
    version,
    endpointName: value.endpointName,
    prompt: value.prompt.trim(),
    history,
    proposalContext,
  };
}

/** Validates the model's proposed project snapshot using normal save contracts. */
export function readAiBuilderProposal(
  value: unknown,
  version: number,
  componentDefinitions: ComponentDefinition[],
): AiBuilderProposal {
  if (!isRecord(value) || !hasExactKeys(value, ["components", "workflow", "customModulesSource"])) {
    throw invalidAiProposal();
  }

  try {
    const components = readComponentsInput({ version, components: value.components }).components;
    const workflow = readProjectWorkflowInput({ version, workflow: value.workflow }).workflow;
    const customModulesSource = readProjectCustomModulesInput({
      expectedVersion: version,
      source: value.customModulesSource,
    }).source;
    validateProjectWorkflowComponentReferences(workflow, components, componentDefinitions);
    resolveWorkflowModuleFiles(workflow, customModulesSource);
    return { components, workflow, customModulesSource };
  } catch {
    throw invalidAiProposal();
  }
}

function readHistory(value: unknown): AiBuilderMessage[] {
  if (!Array.isArray(value) || value.length > MAX_HISTORY_MESSAGES) {
    throw invalidAiBuilderRequest(`Conversation history must contain at most ${MAX_HISTORY_MESSAGES} messages.`);
  }
  let totalLength = 0;
  return value.map((message) => {
    if (!isRecord(message) || !hasExactKeys(message, ["role", "content"]) ||
        (message.role !== "user" && message.role !== "assistant") ||
        typeof message.content !== "string" || message.content.length > MAX_HISTORY_MESSAGE_LENGTH) {
      throw invalidAiBuilderRequest("Conversation history contains an invalid message.");
    }
    totalLength += message.content.length;
    if (totalLength > MAX_HISTORY_LENGTH) {
      throw invalidAiBuilderRequest("Conversation history exceeds the AI Builder context limit.");
    }
    return { role: message.role, content: message.content };
  });
}

function requirePositiveInteger(value: unknown, detail: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw invalidAiBuilderRequest(detail);
  }
  return value;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidAiBuilderRequest(detail: string): ApplicationError {
  return new ApplicationError(400, "invalid_ai_builder_request", "Invalid AI Builder request", detail);
}

function invalidAiProposal(): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_ai_builder_proposal",
    "The proposed changes need review",
    "The model returned changes that do not satisfy the active project component, workflow, or module contracts. Try a smaller request.",
  );
}
