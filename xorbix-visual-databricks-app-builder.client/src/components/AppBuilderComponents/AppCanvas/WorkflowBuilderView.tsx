import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import type { NodeMouseHandler, EdgeMouseHandler } from "@xyflow/react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../ui/resizable";
import { Button } from "../../ui/button";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import type { VdabComponent } from "../../../types/components/vdabComponent";
import type { WorkflowDefinition } from "../../../types/workflow";
import { EMPTY_WORKFLOW_DEFINITION } from "../../../types/workflow";
import {
  buildCanvasElements,
  computeLayoutPositions,
  computeStructuralKey,
  ACTION_NODE_PREFIX,
  TRIGGER_NODE_PREFIX,
  type ActionNodeData,
  type TriggerNodeData,
} from "../../../utils/workflowBuilderLayout";
import { useWorkflowDefinitionEditor } from "../Workflow/useWorkflowDefinitionEditor";
import {
  WorkflowSelectionPanel,
  type WorkflowSelectionItem,
} from "../Workflow/WorkflowSelectionPanel";
import WorkflowBuilderTriggerNode from "../CustomNodes/WorkflowBuilderTriggerNode";
import WorkflowBuilderActionNode from "../CustomNodes/WorkflowBuilderActionNode";
import WorkflowBuilderAddActionNode from "../CustomNodes/WorkflowBuilderAddActionNode";
import type { WorkflowFocusRequest } from "../../../types/workflow/workflowFocus";
import ThemedReactFlow from "./ThemedReactFlow";

const nodeTypes = {
  workflowTrigger: WorkflowBuilderTriggerNode,
  workflowAction: WorkflowBuilderActionNode,
  workflowAddAction: WorkflowBuilderAddActionNode,
};

interface WorkflowBuilderViewProps {
  components: VdabComponent[];
  workflowDefinition: WorkflowDefinition;
  customModulesCode: string;
  prebuiltModulesLibrarySource: string;
  workspaceConnectionId?: number;
  normalizedAppResources?: NormalizedAppResource[];
  onChange: (workflowDefinition: WorkflowDefinition) => void;
  focusRequest?: WorkflowFocusRequest | null;
  onFocusHandled?: () => void;
}

const WorkflowBuilderView: FC<WorkflowBuilderViewProps> = ({
  components,
  workflowDefinition,
  customModulesCode,
  prebuiltModulesLibrarySource,
  workspaceConnectionId,
  normalizedAppResources,
  onChange,
  focusRequest = null,
  onFocusHandled,
}) => {
  const definition = workflowDefinition ?? EMPTY_WORKFLOW_DEFINITION;
  const [selection, setSelection] = useState<WorkflowSelectionItem | null>(
    null,
  );

  const triggerableComponents = useMemo(
    () =>
      components.filter(
        (c) =>
          c.codeName && c.supportedEvents && c.supportedEvents.length > 0,
      ),
    [components],
  );

  // ─── Layout — three-stage memo ────────────────────────────────────────────
  // Stage 1: structural key — cheap string, only changes when nodes/edges added/removed.
  // Renaming, changing trigger props, or editing action params does NOT change this.
  const structuralKey = useMemo(
    () => computeStructuralKey(definition),
    [definition],
  );

  // Stage 2: Dagre layout — expensive, runs only when structuralKey changes.
  const layoutPositions = useMemo(
    () => computeLayoutPositions(definition),
    // Intentionally depend on structuralKey, not definition, so Dagre is skipped
    // for property-only changes (typing, trigger selection, action params).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structuralKey],
  );

  // Stage 3: canvas elements — cheap data mapping, runs on every definition change
  // to keep node labels and edge labels current without re-running Dagre.
  const { nodes: rawNodes, edges } = useMemo(
    () => buildCanvasElements(layoutPositions, definition),
    [layoutPositions, definition],
  );

  const {
    updateWorkflow,
    addWorkflow,
    removeWorkflow,
    addNode,
    updateNode,
    removeNode,
    updateEdge,
    addRoute,
    removeRoute,
  } = useWorkflowDefinitionEditor({
    definition,
    onChange,
    defaultTriggerComponentCodeName: triggerableComponents[0]?.codeName ?? "",
    onWorkflowRemoved: (removedIndex) => {
      setSelection((current) => {
        if (!current) return null;
        if (current.workflowIndex === removedIndex) return null;
        if (current.workflowIndex > removedIndex) {
          return { ...current, workflowIndex: current.workflowIndex - 1 };
        }
        return current;
      });
    },
    onNodeRemoved: (nodeId) => {
      setSelection((current) => {
        if (current?.type === "action" && current.nodeId === nodeId) {
          return null;
        }
        return current ?? null;
      });
    },
    onRouteRemoved: (edgeIndex) => {
      setSelection((current) => {
        if (current?.type !== "edge") return current ?? null;
        if (current.edgeIndex === edgeIndex) return null;
        if (current.edgeIndex > edgeIndex) {
          return { ...current, edgeIndex: current.edgeIndex - 1 };
        }
        return current;
      });
    },
  });

  // Inject onAddAction callback into AddAction node data so the node can call it
  const nodesWithCallbacks = useMemo(
    () =>
      rawNodes.map((node) => {
        if (node.type === "workflowAddAction") {
          return {
            ...node,
            data: { ...node.data, onAddAction: addNode },
          };
        }
        return node;
      }),
    [rawNodes, addNode],
  );

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const workflowIndex = definition.workflows.findIndex(
      (workflow) => workflow.codeName === focusRequest.workflowCodeName,
    );

    if (workflowIndex < 0) {
      onFocusHandled?.();
      return;
    }

    if (!focusRequest.nodeId) {
      setSelection({ type: "trigger", workflowIndex });
      onFocusHandled?.();
      return;
    }

    const workflow = definition.workflows[workflowIndex];
    const node = workflow.nodes.find(
      (candidate) => candidate.id === focusRequest.nodeId,
    );

    if (!node) {
      setSelection({ type: "trigger", workflowIndex });
      onFocusHandled?.();
      return;
    }

    setSelection({
      type: "action",
      workflowIndex,
      nodeId: focusRequest.nodeId,
    });
    onFocusHandled?.();
  }, [definition.workflows, focusRequest, onFocusHandled]);

  // ─── Click handlers ───────────────────────────────────────────────────────
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.id.startsWith(TRIGGER_NODE_PREFIX)) {
      const data = node.data as TriggerNodeData;
      setSelection({ type: "trigger", workflowIndex: data.workflowIndex });
      return;
    }
    if (node.id.startsWith(ACTION_NODE_PREFIX)) {
      const data = node.data as ActionNodeData;
      setSelection({
        type: "action",
        workflowIndex: data.workflowIndex,
        nodeId: data.nodeId,
      });
      return;
    }
    // addAction node click handled internally by the node component
  }, []);

  const handleEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const data = edge.data as
      | { workflowIndex: number; edgeIndex: number }
      | undefined;
    if (data?.workflowIndex !== undefined && data.edgeIndex !== undefined) {
      setSelection({
        type: "edge",
        workflowIndex: data.workflowIndex,
        edgeIndex: data.edgeIndex,
      });
    }
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelection(null);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none">
      <ResizablePanelGroup
        direction="vertical"
        autoSaveId="workflow-builder-split"
        className="h-full overscroll-none"
      >
        {/* Top: React Flow canvas */}
        <ResizablePanel defaultSize={60} minSize={25}>
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-card border-b border-[var(--builder-chrome-border)]">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Workflows
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={addWorkflow}
              >
                + Add Workflow
              </Button>
            </div>

            {/* Canvas */}
            <div className="min-h-0 flex-1">
              {definition.workflows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
                  <p className="text-sm">No workflows yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWorkflow}
                  >
                    + Add Workflow
                  </Button>
                </div>
              ) : (
                <ThemedReactFlow
                  gridPreset="workflow"
                  showInteractiveControls={false}
                  nodes={nodesWithCallbacks}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                  onPaneClick={handlePaneClick}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={true}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  proOptions={{ hideAttribution: true }}
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Bottom: Selection-driven editor panel */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <WorkflowSelectionPanel
            selection={selection}
            workflowDefinition={definition}
            components={components}
            customModulesCode={customModulesCode}
            prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
            workspaceConnectionId={workspaceConnectionId}
            normalizedAppResources={normalizedAppResources}
            onUpdateWorkflow={updateWorkflow}
            onRemoveWorkflow={removeWorkflow}
            onUpdateNode={updateNode}
            onRemoveNode={removeNode}
            onUpdateEdge={updateEdge}
            onAddRoute={addRoute}
            onRemoveRoute={removeRoute}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default WorkflowBuilderView;
