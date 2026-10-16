import { useCallback } from "react";
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowNode,
} from "../../../types/workflow";
import { DEFAULT_SUCCESS_ROUTE } from "../../../types/workflow";
import {
  buildDefaultWorkflowCodeName,
  createDefaultNode,
  createDefaultWorkflow,
  updateWorkflowDefinition,
} from "./workflowPanelUtils";

interface UseWorkflowDefinitionEditorOptions {
  definition: WorkflowDefinition;
  onChange: (nextDefinition: WorkflowDefinition) => void;
  defaultTriggerComponentCodeName?: string;
  onWorkflowRemoved?: (removedWorkflowIndex: number) => void;
  onNodeRemoved?: (nodeId: string) => void;
  onRouteRemoved?: (edgeIndex: number) => void;
}

export const useWorkflowDefinitionEditor = ({
  definition,
  onChange,
  defaultTriggerComponentCodeName = "",
  onWorkflowRemoved,
  onNodeRemoved,
  onRouteRemoved,
}: UseWorkflowDefinitionEditorOptions) => {
  const updateWorkflow = useCallback(
    (workflowCodeName: string, updater: (workflow: Workflow) => Workflow) => {
      onChange(updateWorkflowDefinition(definition, workflowCodeName, updater));
    },
    [definition, onChange],
  );

  const addWorkflow = useCallback(() => {
    onChange({
      ...definition,
      workflows: [
        ...definition.workflows,
        createDefaultWorkflow(
          defaultTriggerComponentCodeName,
          buildDefaultWorkflowCodeName(definition.workflows),
        ),
      ],
    });
  }, [defaultTriggerComponentCodeName, definition, onChange]);

  const addWorkflowForTrigger = useCallback(
    (componentCodeName: string, eventKey: string) => {
      onChange({
        ...definition,
        workflows: [
          ...definition.workflows,
          {
            ...createDefaultWorkflow(
              componentCodeName,
              buildDefaultWorkflowCodeName(definition.workflows),
            ),
            trigger: {
              componentCodeName,
              eventKey,
            },
          },
        ],
      });
    },
    [definition, onChange],
  );

  const removeWorkflow = useCallback(
    (workflowCodeName: string) => {
      const removedIndex = definition.workflows.findIndex(
        (workflow) => workflow.codeName === workflowCodeName,
      );

      if (removedIndex >= 0) {
        onWorkflowRemoved?.(removedIndex);
      }

      onChange({
        ...definition,
        workflows: definition.workflows.filter(
          (workflow) => workflow.codeName !== workflowCodeName,
        ),
      });
    },
    [definition, onChange, onWorkflowRemoved],
  );

  const addNode = useCallback(
    (workflowCodeName: string) => {
      updateWorkflow(workflowCodeName, (workflow) => {
        const nextNode = createDefaultNode();
        const previousNode = workflow.nodes.at(-1);
        const previousNodeHasOutgoingEdge =
          previousNode != null &&
          workflow.edges.some((edge) => edge.fromNodeId === previousNode.id);

        return {
          ...workflow,
          nodes: [...workflow.nodes, nextNode],
          edges:
            previousNode != null && !previousNodeHasOutgoingEdge
              ? [
                  ...workflow.edges,
                  {
                    fromNodeId: previousNode.id,
                    toNodeId: nextNode.id,
                    route: DEFAULT_SUCCESS_ROUTE,
                  },
                ]
              : workflow.edges,
        };
      });
    },
    [updateWorkflow],
  );

  const updateNode = useCallback(
    (
      workflowCodeName: string,
      nodeId: string,
      updater: (node: WorkflowNode) => WorkflowNode,
    ) => {
      updateWorkflow(workflowCodeName, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.map((node) =>
          node.id === nodeId ? updater(node) : node,
        ),
      }));
    },
    [updateWorkflow],
  );

  const removeNode = useCallback(
    (workflowCodeName: string, nodeId: string) => {
      onNodeRemoved?.(nodeId);
      updateWorkflow(workflowCodeName, (workflow) => ({
        ...workflow,
        nodes: workflow.nodes.filter((node) => node.id !== nodeId),
        edges: workflow.edges.filter(
          (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
        ),
      }));
    },
    [onNodeRemoved, updateWorkflow],
  );

  const updateEdge = useCallback(
    (
      workflowCodeName: string,
      edgeIndex: number,
      updater: (edge: Workflow["edges"][number]) => Workflow["edges"][number],
    ) => {
      updateWorkflow(workflowCodeName, (workflow) => ({
        ...workflow,
        edges: workflow.edges.map((edge, currentIndex) =>
          currentIndex === edgeIndex ? updater(edge) : edge,
        ),
      }));
    },
    [updateWorkflow],
  );

  const addRoute = useCallback(
    (workflowCodeName: string, fromNodeId: string) => {
      updateWorkflow(workflowCodeName, (workflow) => {
        const sourceNode = workflow.nodes.find((node) => node.id === fromNodeId);
        if (!sourceNode) return workflow;

        const targetNode =
          workflow.nodes.find(
            (candidate) =>
              candidate.id !== fromNodeId &&
              !workflow.edges.some(
                (edge) =>
                  edge.fromNodeId === fromNodeId &&
                  edge.toNodeId === candidate.id,
              ),
          ) ?? workflow.nodes.find((node) => node.id !== fromNodeId);

        if (!targetNode) return workflow;

        return {
          ...workflow,
          edges: [
            ...workflow.edges,
            {
              fromNodeId,
              toNodeId: targetNode.id,
              route: DEFAULT_SUCCESS_ROUTE,
            },
          ],
        };
      });
    },
    [updateWorkflow],
  );

  const removeRoute = useCallback(
    (workflowCodeName: string, edgeIndex: number) => {
      onRouteRemoved?.(edgeIndex);
      updateWorkflow(workflowCodeName, (workflow) => ({
        ...workflow,
        edges: workflow.edges.filter((_, currentIndex) => currentIndex !== edgeIndex),
      }));
    },
    [onRouteRemoved, updateWorkflow],
  );

  return {
    updateWorkflow,
    addWorkflow,
    addWorkflowForTrigger,
    removeWorkflow,
    addNode,
    updateNode,
    removeNode,
    updateEdge,
    addRoute,
    removeRoute,
  };
};
