import type { AiBuilderInput, AiBuilderMessage } from "./ai-builder-contract.ts";
import type { ComponentDefinition } from "./component-registry/contracts.ts";
import { buildAiBuilderContractGuidance } from "./ai-builder-guidance.ts";
import { AI_BUILDER_TOOLS } from "./ai-builder-tool.ts";
import type { AiBuilderResourceContext } from "./ai-builder-resource-context.ts";

const SYSTEM_INSTRUCTIONS = `You are the Visual Databricks App Builder assistant. Help edit only the supplied standalone project. The app runs in the Databricks workspace where VDAB is installed. Do not invent a workspace, account, tenant, host, token, credential, or external workspace connection. Preserve project-local component keys unless a change requires a new component. Use only component types and properties in the supplied registry. Keep the existing workflow graph valid and custom Python source free of secrets. Resource references must remain hostless and belong to the installed workspace. The workspace resource context is advisory: each section says whether its list is available, empty, partial, or unavailable. An unavailable list is not empty, and partial lists may omit resources. Refer only to listed resources or references already in the project; server validation and the acting user's Databricks permissions remain authoritative. Do not claim that generated code, permissions, or resources were tested. When edits are appropriate, call apply_project_operations with a compact ordered list containing only the changed records. The server merges and validates operations against the current snapshot; preserve every unrelated component, workflow, and module. Do not serialize the entire project. For a question that needs no changes, answer in ordinary assistant text.`;

/** Builds bounded, OpenAI-compatible messages for one customer endpoint request. */
export function buildAiBuilderMessages(
  input: AiBuilderInput,
  componentDefinitions: ComponentDefinition[],
  resourceContext: AiBuilderResourceContext,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `${SYSTEM_INSTRUCTIONS}\n\nWorkspace resource context (bounded and caller-visible):\n${JSON.stringify(resourceContext)}\n\nComponent registry:\n${JSON.stringify(componentDefinitions)}\n\n${buildAiBuilderContractGuidance(componentDefinitions)}\n\nCurrent editable project snapshot:\n${JSON.stringify(input.proposalContext)}`,
    },
  ];
  for (const message of input.history) {
    messages.push(toModelMessage(message));
  }
  messages.push({ role: "user", content: input.prompt });
  return messages;
}

function toModelMessage(
  message: AiBuilderMessage,
): { role: "user" | "assistant"; content: string } {
  return { role: message.role, content: message.content };
}

/** OpenAI-compatible tool declaration keeps the model output schema shallow. */
export { AI_BUILDER_TOOLS };
