import type { WorkflowActionNode } from "./actionNode";
import type { WorkflowRoute } from "./workflowRoutes";

export interface WorkflowDefinition {
  version: 1;
  workflows: Workflow[];
}

export interface Workflow {
  codeName: string;
  trigger: WorkflowTrigger;
  nodes: WorkflowActionNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowTrigger {
  componentCodeName: string;
  eventKey: string;
}

export interface WorkflowEdge {
  fromNodeId: string;
  toNodeId: string;
  route: WorkflowRoute;
}
