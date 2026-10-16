import type { VdabComponent } from "../types/components/vdabComponent";
import type { Workflow } from "../types/workflow/workflowDefinition";
import type { WorkflowActionParams } from "../types/workflow/actionNode";

export interface CanvasComponentSummary {
  id: string;
  type: string;
  codeName: string;
  props?: Record<string, unknown>;
  children?: string[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WorkflowNodeSummary {
  nodeId: string;
  actionType: string;
  params?: WorkflowActionParams;
}

export interface WorkflowEdgeSummary {
  fromNodeId: string;
  toNodeId: string;
  route: string;
}

export interface WorkflowSummary {
  codeName: string;
  triggerComponentCodeName: string;
  triggerEventKey: string;
  nodes: WorkflowNodeSummary[];
  edges: WorkflowEdgeSummary[];
}

export interface CanvasOperation {
  op:
    | "add"
    | "delete"
    | "modify"
    | "setBindings"
    | "addWorkflow"
    | "deleteWorkflow"
    | "updateCustomModulesCode";
  componentId?: string;
  component?: VdabComponent;
  parentId?: string;
  childIndex?: number;
  tabIndex?: number;
  workflow?: Workflow;
  bindings?: VdabComponent["bindings"];
  customModulesCode?: string;
}

export interface IAiBuilderRequest {
  prompt: string;
  appId: number;
  currentComponents: CanvasComponentSummary[];
  currentWorkflows: WorkflowSummary[];
  conversationHistory: ConversationMessage[];
  customModulesCode: string;
  aiModelId?: number | null;
}

export type AiModelSource = "platform" | "tenant";

export interface IAiBuilderModelOption {
  id: number | null;
  displayName: string;
  source: AiModelSource;
  endpointName: string;
  connectionDisplayName?: string | null;
  isConfigured: boolean;
}

export interface IAiBuilderSelectedModel {
  aiModelId: number | null;
  displayName: string;
  source: AiModelSource;
}

export interface IPlatformAiUsage {
  tokensUsed: number;
  tokenLimit: number;
  periodKey: string;
  resetsAtUtc: string;
  percentUsed: number;
  isLimitReached: boolean;
  isEnforcementEnabled: boolean;
}

export class AiBuilderRequest implements IAiBuilderRequest {
  prompt: string;
  appId: number;
  currentComponents: CanvasComponentSummary[];
  currentWorkflows: WorkflowSummary[];
  conversationHistory: ConversationMessage[];
  customModulesCode: string;
  aiModelId?: number | null;

  constructor(
    prompt: string,
    appId: number,
    currentComponents: CanvasComponentSummary[],
    currentWorkflows: WorkflowSummary[] = [],
    conversationHistory: ConversationMessage[] = [],
    customModulesCode = "",
    aiModelId?: number | null,
  ) {
    this.prompt = prompt;
    this.appId = appId;
    this.currentComponents = currentComponents;
    this.currentWorkflows = currentWorkflows;
    this.conversationHistory = conversationHistory;
    this.customModulesCode = customModulesCode;
    this.aiModelId = aiModelId;
  }
}

export type AiBuilderCompletionStatus =
  | "completed"
  | "partial"
  | "needsClarification"
  | "unableToComplete";

export type AiBuilderReasonCode =
  | "notEnoughInformation"
  | "tooComplex"
  | "tooManyFields"
  | "unsupportedComponent"
  | "unsupportedWorkflow"
  | "workspaceConnectionMissing"
  | "databricksMetadataUnavailable"
  | "toolValidationFailed"
  | "operationValidationFailed"
  | "modelUnavailable"
  | "configurationMissing"
  | "platformQuotaExceeded"
  | "modelToolCallingUnsupported"
  | "modelConfigurationUnsupported";

export interface IAiBuilderOutcomeReason {
  code: AiBuilderReasonCode;
  title: string;
  message: string;
  details?: string[];
  suggestedActions?: string[];
  missingInputs?: string[];
}

export interface IAiBuilderResponse {
  status?: AiBuilderCompletionStatus;
  operations: CanvasOperation[];
  explanation: string;
  reason?: IAiBuilderOutcomeReason;
}
