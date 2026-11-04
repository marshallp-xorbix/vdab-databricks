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
      };
    }
  | {
      event: "error";
      data: { title: string; status: number; detail: string };
    };

/** Raw completion parsed from a Databricks OpenAI-compatible stream. */
export interface AiBuilderCompletion {
  assistantMessage: string;
  toolName: string | null;
  toolArgumentsJson: string | null;
}
