import type { ProjectComponent } from "./db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "./db/project-workflow-contract.ts";

/** One text message retained in the browser's AI Builder conversation. */
export interface AiBuilderMessage {
  role: "user" | "assistant";
  content: string;
}

/** Project proposal returned for review in the current editor session. */
export interface AiBuilderProposal {
  components: ProjectComponent[];
  workflow: ProjectWorkflowDefinition;
  customModulesSource: string;
}

/** Validated request context supplied by the active project editor. */
export interface AiBuilderInput {
  version: number;
  endpointName: string;
  prompt: string;
  history: AiBuilderMessage[];
  proposalContext: AiBuilderProposal;
}

/** Progress and completion events emitted over the same-origin SSE response. */
export type AiBuilderEvent =
  | { event: "progress"; data: { message: string } }
  | {
      event: "result";
      data: {
        assistantMessage: string;
        proposal: AiBuilderProposal | null;
        version: number;
        outcome: "completed" | "partial" | "needsClarification" | "unableToComplete";
      };
    }
  | {
      event: "error";
      data: { title: string; status: number; detail: string };
    };

/** One tool call parsed from a Databricks OpenAI-compatible stream. */
export interface AiBuilderToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

/** Raw completion parsed from a Databricks OpenAI-compatible stream. */
export interface AiBuilderCompletion {
  assistantMessage: string;
  toolCalls: AiBuilderToolCall[];
}

/** Messages accepted by the serving-endpoint invoke path, including tool rounds. */
export type AiBuilderModelMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };
