import type { ProjectWorkflow, ProjectWorkflowNode } from "./project-workflow-contract.ts";
import { invalidWorkflow } from "./project-workflow-errors.ts";

/** Validates workflow collection names and unique component event triggers. */
export function validateWorkflowCollection(workflows: ProjectWorkflow[]): void {
  const names = new Set<string>();
  const triggers = new Set<string>();
  for (const workflow of workflows) {
    const normalizedName = workflow.codeName.toLocaleLowerCase("en-US");
    if (names.has(normalizedName)) throw invalidWorkflow("Workflow code names must be unique.");
    names.add(normalizedName);
    const triggerKey = `${workflow.trigger.componentKey.toLocaleLowerCase("en-US")}::${workflow.trigger.eventKey.toLocaleLowerCase("en-US")}`;
    if (triggers.has(triggerKey)) throw invalidWorkflow("A component event can have only one workflow.");
    triggers.add(triggerKey);
  }
}

/** Validates action IDs, edges, and references to prior SQL actions. */
export function validateWorkflowGraph(
  nodes: ProjectWorkflowNode[],
  edges: ProjectWorkflow["edges"],
): void {
  const nodeIds = new Set<string>();
  const nodeById = new Map<string, ProjectWorkflowNode>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) throw invalidWorkflow("Workflow action IDs must be unique.");
    nodeIds.add(node.id);
    nodeById.set(node.id, node);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      throw invalidWorkflow("Workflow routes must connect actions in the same workflow.");
    }
  }

  const incomingNodeIdsByNodeId = buildIncomingNodeIds(edges);
  const nodeIndexesById = new Map(nodes.map((node, index) => [node.id, index]));
  for (const node of nodes) {
    validateActionReferences(node, nodeById, nodeIndexesById, incomingNodeIdsByNodeId);
  }
}

function validateActionReferences(
  node: ProjectWorkflowNode,
  nodeById: Map<string, ProjectWorkflowNode>,
  nodeIndexesById: Map<string, number>,
  incomingNodeIdsByNodeId: Map<string, string[]>,
): void {
  if (node.actionType === "runSql") {
    const statement = node.params.statement as Record<string, unknown>;
    const source = nodeById.get(statement.nodeId as string);
    if (
      !source ||
      source.actionType !== "buildSql" ||
      !isPriorReference(node.id, source.id, nodeIndexesById, incomingNodeIdsByNodeId)
    ) {
      throw invalidWorkflow("RunSql must reference an earlier or predecessor BuildSql action in the same workflow.");
    }
  }
  if (node.actionType === "setBinding") {
    const sourceRef = node.params.source as Record<string, unknown>;
    const source = nodeById.get(sourceRef.nodeId as string);
    if (
      !source ||
      source.actionType !== "runSql" ||
      !isPriorReference(node.id, source.id, nodeIndexesById, incomingNodeIdsByNodeId)
    ) {
      throw invalidWorkflow("SetBinding must reference an earlier or predecessor RunSql action in the same workflow.");
    }
  }
}

function buildIncomingNodeIds(
  edges: ProjectWorkflow["edges"],
): Map<string, string[]> {
  const incomingNodeIdsByNodeId = new Map<string, string[]>();
  for (const edge of edges) {
    incomingNodeIdsByNodeId.set(edge.toNodeId, [
      ...(incomingNodeIdsByNodeId.get(edge.toNodeId) ?? []),
      edge.fromNodeId,
    ]);
  }
  return incomingNodeIdsByNodeId;
}

function isPriorReference(
  currentNodeId: string,
  sourceNodeId: string,
  nodeIndexesById: Map<string, number>,
  incomingNodeIdsByNodeId: Map<string, string[]>,
): boolean {
  const pendingNodeIds = [...(incomingNodeIdsByNodeId.get(currentNodeId) ?? [])];
  const visitedNodeIds = new Set<string>();
  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.shift();
    if (nodeId === undefined || nodeId === currentNodeId || visitedNodeIds.has(nodeId)) {
      continue;
    }
    if (nodeId === sourceNodeId) return true;
    visitedNodeIds.add(nodeId);
    pendingNodeIds.push(...(incomingNodeIdsByNodeId.get(nodeId) ?? []));
  }

  const currentNodeIndex = nodeIndexesById.get(currentNodeId);
  const sourceNodeIndex = nodeIndexesById.get(sourceNodeId);
  return currentNodeIndex !== undefined && sourceNodeIndex !== undefined &&
    sourceNodeIndex < currentNodeIndex;
}
