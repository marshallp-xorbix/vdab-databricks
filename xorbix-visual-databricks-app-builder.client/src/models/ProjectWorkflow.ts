import type { WorkflowRoute } from "../types/workflow";

export const PROJECT_WORKFLOW_ACTION_TYPES = [
  "triggerToast",
  "showModal",
  "saveToTable",
  "buildSql",
  "runSql",
  "setBinding",
  "startDatabricksJob",
  "callCustomModule",
  "callPrebuiltModule",
] as const;

export type ProjectWorkflowActionType =
  (typeof PROJECT_WORKFLOW_ACTION_TYPES)[number];

export interface IProjectWorkflowNode {
  id: string;
  actionType: ProjectWorkflowActionType;
  schemaVersion: 1;
  params: Record<string, unknown>;
}

export interface IProjectWorkflowEdge {
  fromNodeId: string;
  toNodeId: string;
  route: WorkflowRoute;
}

export interface IProjectWorkflow {
  codeName: string;
  trigger: { componentKey: string; eventKey: string };
  nodes: IProjectWorkflowNode[];
  edges: IProjectWorkflowEdge[];
}

export interface IProjectWorkflowDefinition {
  version: 1;
  workflows: IProjectWorkflow[];
}

export interface IProjectWorkflowDocument {
  projectId: string;
  version: number;
  workflow: IProjectWorkflowDefinition;
}

export class ProjectWorkflowDocument implements IProjectWorkflowDocument {
  projectId: string;
  version: number;
  workflow: IProjectWorkflowDefinition;

  constructor(source: Partial<IProjectWorkflowDocument> = {}) {
    this.projectId = source.projectId ?? "";
    this.version = source.version ?? 1;
    this.workflow = source.workflow ?? { version: 1, workflows: [] };
  }
}
