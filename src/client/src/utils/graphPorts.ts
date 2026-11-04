/**
 * Centralized React Flow graph ports utilities
 * Defines canonical handle routing, edge handle assignment, and per-node visibility rules
 * Used by all graph generation and rendering to ensure consistent behavior across main flow and workflow views
 */

import type { Edge, Node } from "@xyflow/react";

/**
 * Canonical handle IDs for horizontal-only routing
 */
export const GraphHandleId = {
  In: "in-left",
  Out: "out-right",
} as const;

export type GraphHandleId = (typeof GraphHandleId)[keyof typeof GraphHandleId];

/**
 * Active handles for a node, computed from edges
 */
export interface NodeHandleVisibility {
  hasInbound: boolean;
  hasOutbound: boolean;
}

/**
 * Augmented node data that includes computed handle visibility
 */
export interface GraphNodeData extends Record<string, unknown> {
  label?: string;
  handles?: NodeHandleVisibility;
}

/**
 * Computes which handles should be visible for each node based on actual edge usage
 * Returns a map of nodeId -> { hasInbound, hasOutbound }
 */
export function computeNodeHandleVisibility(
  nodes: Node<GraphNodeData>[],
  edges: Edge[],
): Record<string, NodeHandleVisibility> {
  const visibility: Record<string, NodeHandleVisibility> = {};

  // Initialize all nodes with no handles
  nodes.forEach((node) => {
    visibility[node.id] = { hasInbound: false, hasOutbound: false };
  });

  // Mark handles used by edges
  edges.forEach((edge) => {
    if (visibility[edge.source]) {
      visibility[edge.source].hasOutbound = true;
    }
    if (visibility[edge.target]) {
      visibility[edge.target].hasInbound = true;
    }
  });

  return visibility;
}

/**
 * Applies computed handle visibility to all nodes in-place
 */
export function applyHandleVisibilityToNodes<T extends GraphNodeData>(
  nodes: Node<T>[],
  visibility: Record<string, NodeHandleVisibility>,
): void {
  nodes.forEach((node) => {
    if (visibility[node.id]) {
      node.data.handles = visibility[node.id];
    }
  });
}

/**
 * Ensures all edges include explicit sourceHandle and targetHandle for horizontal routing
 * Idempotent: safe to call on edges that already have handles set
 */
export function ensureEdgeHandles(edges: Edge[]): void {
  edges.forEach((edge) => {
    if (!edge.sourceHandle) {
      edge.sourceHandle = GraphHandleId.Out;
    }
    if (!edge.targetHandle) {
      edge.targetHandle = GraphHandleId.In;
    }
  });
}

/**
 * Post-processes generated graph nodes and edges to apply centralized handle logic
 * This is the single integration point for all graph generators
 */
export function postProcessGraphData<T extends GraphNodeData>(
  nodes: Node<T>[],
  edges: Edge[],
): { nodes: Node<T>[]; edges: Edge[] } {
  // Ensure all edges have explicit handles
  ensureEdgeHandles(edges);

  // Compute which handles are actually used
  const visibility = computeNodeHandleVisibility(nodes, edges);

  // Apply visibility to node data
  applyHandleVisibilityToNodes(nodes, visibility);

  return { nodes, edges };
}
