import Dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { WorkflowDefinition } from "../types/workflow";
import {
  DEFAULT_ERROR_ROUTE,
  DEFAULT_SUCCESS_ROUTE,
  type WorkflowRoute,
} from "../types/workflow";
import { getActionDefinition } from "../components/AppBuilderComponents/Workflow/workflowPanelUtils";

// Node type prefix discriminators embedded in React Flow node IDs
export const TRIGGER_NODE_PREFIX = "trigger-";
export const ACTION_NODE_PREFIX = "action-";
export const ADD_ACTION_NODE_PREFIX = "addaction-";

export const TRIGGER_NODE_W = 180;
export const TRIGGER_NODE_H = 64;
export const ACTION_NODE_W = 180;
export const ACTION_NODE_H = 64;
export const ADD_ACTION_NODE_W = 56;
export const ADD_ACTION_NODE_H = 56;
const SWIMLANE_GAP = 60;
const DAGRE_NODE_SEP = 40;
const DAGRE_RANK_SEP = 80;

/** Theme tokens so edge labels track light/dark shell chrome. */
const EDGE_LABEL_BG = { fill: "var(--card)", fillOpacity: 0.95 } as const;
const TRIGGER_EDGE_STROKE = "var(--chart-5)";

// ─── Data types ───────────────────────────────────────────────────────────────

export interface TriggerNodeData extends Record<string, unknown> {
  builderNodeType: "trigger";
  /** Stable position-based index — survives renames. */
  workflowIndex: number;
  workflowCodeName: string;
  componentCodeName: string;
  eventKey: string;
}

export interface ActionNodeData extends Record<string, unknown> {
  builderNodeType: "action";
  /** Stable position-based index — survives renames. */
  workflowIndex: number;
  workflowCodeName: string;
  nodeId: string;
  actionType: string;
  actionLabel: string;
  nodeIndex: number;
}

export interface AddActionNodeData extends Record<string, unknown> {
  builderNodeType: "addAction";
  workflowIndex: number;
  workflowCodeName: string;
}

export type BuilderCanvasNodeData =
  | TriggerNodeData
  | ActionNodeData
  | AddActionNodeData;

// ─── Stable index-based node ID helpers ──────────────────────────────────────

/** Trigger node ID for a workflow at index `wfIndex`. */
export const triggerNodeId = (wfIndex: number) =>
  `${TRIGGER_NODE_PREFIX}${wfIndex}`;

/**
 * Action node ID: `action-{wfIndex}-{node.id}`.
 * Splitting on the FIRST dash after the prefix gives wfIndex; everything after is the UUID.
 */
export const actionNodeId = (wfIndex: number, internalNodeId: string) =>
  `${ACTION_NODE_PREFIX}${wfIndex}-${internalNodeId}`;

/** Add-action node ID for a workflow at index `wfIndex`. */
export const addActionNodeId = (wfIndex: number) =>
  `${ADD_ACTION_NODE_PREFIX}${wfIndex}`;

// ─── Structural key ───────────────────────────────────────────────────────────

/**
 * Returns a compact string representing only the graph topology of a WorkflowDefinition.
 * Changes when workflows/nodes/edges are added or removed.
 * Does NOT change when code names, trigger selections, or action params change.
 * Used to gate the expensive Dagre layout pass.
 */
export function computeStructuralKey(definition: WorkflowDefinition): string {
  return definition.workflows
    .map((wf, wfIdx) => {
      const nodeIds = wf.nodes.map((n) => n.id).join(",");
      const edgePairs = wf.edges
        .map((e) => `${e.fromNodeId}:${e.toNodeId}`)
        .join(",");
      return `${wfIdx}:[${nodeIds}][${edgePairs}]`;
    })
    .join("|");
}

// ─── Layout positions (runs Dagre) ────────────────────────────────────────────

/**
 * Runs Dagre layout for all workflows and returns a map of node ID → top-left position.
 * This is the expensive step. Call only when the structural key changes.
 */
export function computeLayoutPositions(
  definition: WorkflowDefinition,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  let swimlaneOffsetY = 0;

  for (let wfIndex = 0; wfIndex < definition.workflows.length; wfIndex++) {
    const workflow = definition.workflows[wfIndex];
    const { posMap, height } = layoutSwimlanePositions(workflow, wfIndex);

    for (const [nodeId, pos] of posMap.entries()) {
      positions.set(nodeId, { x: pos.x, y: pos.y + swimlaneOffsetY });
    }

    swimlaneOffsetY += height + SWIMLANE_GAP;
  }

  return positions;
}

type WorkflowShape = {
  nodes: { id: string }[];
  edges: { fromNodeId: string; toNodeId: string }[];
};

function layoutSwimlanePositions(
  workflow: WorkflowShape,
  wfIndex: number,
): { posMap: Map<string, { x: number; y: number }>; height: number } {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: DAGRE_NODE_SEP,
    ranksep: DAGRE_RANK_SEP,
    marginx: 20,
    marginy: 20,
  });

  const triggerId = triggerNodeId(wfIndex);
  g.setNode(triggerId, { width: TRIGGER_NODE_W, height: TRIGGER_NODE_H });

  for (const node of workflow.nodes) {
    g.setNode(actionNodeId(wfIndex, node.id), {
      width: ACTION_NODE_W,
      height: ACTION_NODE_H,
    });
  }

  const nodesWithIncoming = new Set(workflow.edges.map((e) => e.toNodeId));
  for (const root of workflow.nodes.filter(
    (n) => !nodesWithIncoming.has(n.id),
  )) {
    g.setEdge(triggerId, actionNodeId(wfIndex, root.id));
  }

  for (const edge of workflow.edges) {
    g.setEdge(
      actionNodeId(wfIndex, edge.fromNodeId),
      actionNodeId(wfIndex, edge.toNodeId),
    );
  }

  const addId = addActionNodeId(wfIndex);
  g.setNode(addId, { width: ADD_ACTION_NODE_W, height: ADD_ACTION_NODE_H });

  if (workflow.nodes.length === 0) {
    g.setEdge(triggerId, addId);
  } else {
    const nodesWithOutgoing = new Set(workflow.edges.map((e) => e.fromNodeId));
    const terminalNode =
      workflow.nodes.filter((n) => !nodesWithOutgoing.has(n.id)).at(-1) ??
      workflow.nodes.at(-1);
    if (terminalNode) {
      g.setEdge(actionNodeId(wfIndex, terminalNode.id), addId);
    }
  }

  Dagre.layout(g);

  const posMap = new Map<string, { x: number; y: number }>();

  const storePos = (id: string, w: number, h: number) => {
    const pos = g.node(id);
    if (pos) {
      posMap.set(id, { x: pos.x - w / 2, y: pos.y - h / 2 });
    }
  };

  storePos(triggerId, TRIGGER_NODE_W, TRIGGER_NODE_H);
  for (const node of workflow.nodes) {
    storePos(actionNodeId(wfIndex, node.id), ACTION_NODE_W, ACTION_NODE_H);
  }
  storePos(addId, ADD_ACTION_NODE_W, ADD_ACTION_NODE_H);

  const graphInfo = g.graph();
  const height = (graphInfo.height as number | undefined) ?? 120;

  return { posMap, height };
}

// ─── Canvas elements (cheap data mapping, no Dagre) ───────────────────────────

/**
 * Builds React Flow nodes and edges from precomputed positions + the current definition.
 * No Dagre — cheap enough to run on every definition change (e.g. every keystroke).
 */
export function buildCanvasElements(
  positions: Map<string, { x: number; y: number }>,
  definition: WorkflowDefinition,
): { nodes: Node<BuilderCanvasNodeData>[]; edges: Edge[] } {
  const allNodes: Node<BuilderCanvasNodeData>[] = [];
  const allEdges: Edge[] = [];

  for (let wfIndex = 0; wfIndex < definition.workflows.length; wfIndex++) {
    const workflow = definition.workflows[wfIndex];

    // Trigger node
    const triggerId = triggerNodeId(wfIndex);
    const triggerPos = positions.get(triggerId);
    if (triggerPos) {
      allNodes.push({
        id: triggerId,
        type: "workflowTrigger",
        position: triggerPos,
        data: {
          builderNodeType: "trigger",
          workflowIndex: wfIndex,
          workflowCodeName: workflow.codeName,
          componentCodeName: workflow.trigger.componentCodeName,
          eventKey: workflow.trigger.eventKey,
        } satisfies TriggerNodeData,
        draggable: false,
        selectable: true,
      });
    }

    const nodesWithIncoming = new Set(workflow.edges.map((e) => e.toNodeId));

    // Action nodes + trigger→root edges
    for (let nodeIdx = 0; nodeIdx < workflow.nodes.length; nodeIdx++) {
      const node = workflow.nodes[nodeIdx];
      const rfId = actionNodeId(wfIndex, node.id);
      const pos = positions.get(rfId);
      if (!pos) continue;

      allNodes.push({
        id: rfId,
        type: "workflowAction",
        position: pos,
        data: {
          builderNodeType: "action",
          workflowIndex: wfIndex,
          workflowCodeName: workflow.codeName,
          nodeId: node.id,
          actionType: node.actionType,
          actionLabel:
            getActionDefinition(node.actionType as never)?.label ??
            node.actionType,
          nodeIndex: nodeIdx,
        } satisfies ActionNodeData,
        draggable: false,
        selectable: true,
      });

      if (!nodesWithIncoming.has(node.id)) {
        allEdges.push({
          id: `trig-${wfIndex}-${node.id}`,
          source: triggerId,
          target: rfId,
          label: workflow.trigger.eventKey,
          type: "smoothstep",
          animated: false,
          style: { stroke: TRIGGER_EDGE_STROKE, strokeWidth: 2 },
          labelStyle: {
            fontSize: 11,
            fill: TRIGGER_EDGE_STROKE,
            fontWeight: 600,
          },
          labelBgStyle: EDGE_LABEL_BG,
        });
      }
    }

    // Trigger → add-action edge when no action nodes exist
    if (workflow.nodes.length === 0) {
      allEdges.push({
        id: `trig-${wfIndex}-addaction`,
        source: triggerId,
        target: addActionNodeId(wfIndex),
        label: workflow.trigger.eventKey,
        type: "smoothstep",
        animated: false,
        style: {
          stroke: TRIGGER_EDGE_STROKE,
          strokeWidth: 2,
          strokeDasharray: "4 3",
        },
        labelStyle: {
          fontSize: 11,
          fill: TRIGGER_EDGE_STROKE,
          fontWeight: 600,
        },
        labelBgStyle: EDGE_LABEL_BG,
      });
    }

    // Internal workflow edges
    for (let i = 0; i < workflow.edges.length; i++) {
      const edge = workflow.edges[i];
      const routeColor = routeStrokeColor(edge.route);
      allEdges.push({
        id: `wf-${wfIndex}-${edge.fromNodeId}-${edge.toNodeId}-${i}`,
        source: actionNodeId(wfIndex, edge.fromNodeId),
        target: actionNodeId(wfIndex, edge.toNodeId),
        label: edge.route,
        type: "smoothstep",
        animated: false,
        data: { workflowIndex: wfIndex, edgeIndex: i, route: edge.route },
        style: { stroke: routeColor, strokeWidth: 2 },
        labelStyle: { fontSize: 11, fill: routeColor, fontWeight: 600 },
        labelBgStyle: EDGE_LABEL_BG,
      });
    }

    // Terminal → add-action dashed edge
    const addId = addActionNodeId(wfIndex);
    const addPos = positions.get(addId);
    if (workflow.nodes.length > 0 && addPos) {
      const nodesWithOutgoing = new Set(workflow.edges.map((e) => e.fromNodeId));
      const terminalNode =
        workflow.nodes.filter((n) => !nodesWithOutgoing.has(n.id)).at(-1) ??
        workflow.nodes.at(-1);
      if (terminalNode) {
        allEdges.push({
          id: `addaction-edge-${wfIndex}`,
          source: actionNodeId(wfIndex, terminalNode.id),
          target: addId,
          type: "smoothstep",
          animated: false,
          style: {
            stroke: "var(--muted-foreground)",
            strokeWidth: 1.5,
            strokeDasharray: "4 3",
          },
        });
      }
    }

    // Add-action node
    if (addPos) {
      allNodes.push({
        id: addId,
        type: "workflowAddAction",
        position: addPos,
        data: {
          builderNodeType: "addAction",
          workflowIndex: wfIndex,
          workflowCodeName: workflow.codeName,
        } satisfies AddActionNodeData,
        draggable: false,
        selectable: false,
      });
    }
  }

  return { nodes: allNodes, edges: allEdges };
}

function routeStrokeColor(route: WorkflowRoute): string {
  if (route === DEFAULT_SUCCESS_ROUTE) return "#22c55e";
  if (route === DEFAULT_ERROR_ROUTE) return "#ef4444";
  return "var(--muted-foreground)";
}
