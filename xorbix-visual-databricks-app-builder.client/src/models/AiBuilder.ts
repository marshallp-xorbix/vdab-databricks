import type { IProjectComponent } from "./ProjectComponents";
import type { IProjectWorkflowDefinition } from "./ProjectWorkflow";

export interface IAiBuilderConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/** Request context sent to the standalone AI Builder stream. */
export interface IAiBuilderRequest {
  version: number;
  endpointName: string;
  prompt: string;
  history: IAiBuilderConversationMessage[];
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  customModulesSource: string;
}

export class AiBuilderRequest implements IAiBuilderRequest {
  version: number;
  endpointName: string;
  prompt: string;
  history: IAiBuilderConversationMessage[];
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  customModulesSource: string;

  constructor(source: Partial<IAiBuilderRequest> = {}) {
    this.version = source.version ?? 1;
    this.endpointName = source.endpointName ?? "";
    this.prompt = source.prompt ?? "";
    this.history = source.history ?? [];
    this.components = source.components ?? [];
    this.workflow = source.workflow ?? { version: 1, workflows: [] };
    this.customModulesSource = source.customModulesSource ?? "";
  }
}

/** Editable project values proposed by an AI Builder response. */
export interface IAiBuilderProposal {
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  customModulesSource: string;
}

export class AiBuilderProposal implements IAiBuilderProposal {
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  customModulesSource: string;

  constructor(source: Partial<IAiBuilderProposal> = {}) {
    this.components = source.components ?? [];
    this.workflow = source.workflow ?? { version: 1, workflows: [] };
    this.customModulesSource = source.customModulesSource ?? "";
  }
}

/** Validated response from the end of an AI Builder stream. */
export interface IAiBuilderResult {
  assistantMessage: string;
  proposal: IAiBuilderProposal | null;
  version: number;
}

export class AiBuilderResult implements IAiBuilderResult {
  assistantMessage: string;
  proposal: IAiBuilderProposal | null;
  version: number;

  constructor(source: Partial<IAiBuilderResult> = {}) {
    this.assistantMessage = source.assistantMessage ?? "";
    this.proposal = source.proposal ?? null;
    this.version = source.version ?? 1;
  }
}

export interface IAiBuilderProblemDetails {
  title: string;
  status: number;
  detail: string;
}

export class AiBuilderProblemDetails implements IAiBuilderProblemDetails {
  title: string;
  status: number;
  detail: string;

  constructor(source: Partial<IAiBuilderProblemDetails> = {}) {
    this.title = source.title ?? "Request failed";
    this.status = source.status ?? 500;
    this.detail = source.detail ?? "AI Builder could not complete the request.";
  }
}

export type AiBuilderStreamEvent =
  | { type: "progress"; message: string }
  | { type: "result"; result: IAiBuilderResult }
  | { type: "error"; problem: IAiBuilderProblemDetails };

