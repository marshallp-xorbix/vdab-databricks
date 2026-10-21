/** Action kinds stored in the portable standalone workflow contract. */
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

export const PROJECT_WORKFLOW_ROUTES = ["onSuccess", "onError", "always"] as const;
export type ProjectWorkflowRoute = (typeof PROJECT_WORKFLOW_ROUTES)[number];

/** Versioned portable workflow collection. */
export interface ProjectWorkflowDefinition {
  version: 1;
  workflows: ProjectWorkflow[];
}

/** One trigger and its ordered, routed action graph. */
export interface ProjectWorkflow {
  codeName: string;
  trigger: { componentKey: string; eventKey: string };
  nodes: ProjectWorkflowNode[];
  edges: ProjectWorkflowEdge[];
}

/** Typed action envelope; action-specific parameters are validated at runtime. */
export interface ProjectWorkflowNode {
  id: string;
  actionType: ProjectWorkflowActionType;
  schemaVersion: 1;
  params: Record<string, unknown>;
}

/** Directed route between two workflow actions. */
export interface ProjectWorkflowEdge {
  fromNodeId: string;
  toNodeId: string;
  route: ProjectWorkflowRoute;
}

/** Workflow state read or saved at the shared project version. */
export interface ProjectWorkflowDocument {
  projectId: string;
  version: number;
  workflow: ProjectWorkflowDefinition;
}
