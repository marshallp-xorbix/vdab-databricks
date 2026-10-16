import type { FC } from "react";
import { useMemo } from "react";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import type { VdabComponent } from "../../../types/components/vdabComponent";
import type { Workflow, WorkflowDefinition } from "../../../types/workflow";
import { WORKFLOW_ROUTES } from "../../../types/workflow";
import { WorkflowTriggerEditor } from "./WorkflowTriggerEditor";
import { WorkflowNodeEditor } from "./WorkflowNodeEditor";

export type WorkflowSelectionItem =
  | { type: "trigger"; workflowIndex: number }
  | { type: "action"; workflowIndex: number; nodeId: string }
  | { type: "edge"; workflowIndex: number; edgeIndex: number };

interface WorkflowSelectionPanelProps {
  selection: WorkflowSelectionItem | null;
  workflowDefinition: WorkflowDefinition;
  components: VdabComponent[];
  customModulesCode: string;
  prebuiltModulesLibrarySource: string;
  workspaceConnectionId?: number;
  normalizedAppResources?: NormalizedAppResource[];
  onUpdateWorkflow: (
    workflowCodeName: string,
    updater: (workflow: Workflow) => Workflow,
  ) => void;
  onRemoveWorkflow: (workflowCodeName: string) => void;
  onUpdateNode: (
    workflowCodeName: string,
    nodeId: string,
    updater: (node: Workflow["nodes"][number]) => Workflow["nodes"][number],
  ) => void;
  onRemoveNode: (workflowCodeName: string, nodeId: string) => void;
  onUpdateEdge: (
    workflowCodeName: string,
    edgeIndex: number,
    updater: (edge: Workflow["edges"][number]) => Workflow["edges"][number],
  ) => void;
  onAddRoute: (workflowCodeName: string, fromNodeId: string) => void;
  onRemoveRoute: (workflowCodeName: string, edgeIndex: number) => void;
}

export const WorkflowSelectionPanel: FC<WorkflowSelectionPanelProps> = ({
  selection,
  workflowDefinition,
  components,
  customModulesCode,
  prebuiltModulesLibrarySource,
  workspaceConnectionId,
  normalizedAppResources,
  onUpdateWorkflow,
  onRemoveWorkflow,
  onUpdateNode,
  onRemoveNode,
  onUpdateEdge,
  onAddRoute,
  onRemoveRoute,
}) => {
  const triggerableComponents = useMemo(
    () =>
      components.filter(
        (c) =>
          c.codeName && c.supportedEvents && c.supportedEvents.length > 0,
      ),
    [components],
  );

  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground select-none">
        Click a node or edge to edit its settings.
      </div>
    );
  }

  const workflow = workflowDefinition.workflows[selection.workflowIndex];

  if (!workflow) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Workflow not found.
      </div>
    );
  }

  if (selection.type === "trigger") {
    return (
      <div className="h-full overflow-y-auto p-4 bg-card">
        <WorkflowTriggerEditor
          workflow={workflow}
          workflows={workflowDefinition.workflows}
          triggerableComponents={triggerableComponents}
          onUpdateWorkflow={onUpdateWorkflow}
          onRemoveWorkflow={onRemoveWorkflow}
        />
      </div>
    );
  }

  if (selection.type === "action") {
    const node = workflow.nodes.find((n) => n.id === selection.nodeId);
    const nodeIndex = workflow.nodes.findIndex((n) => n.id === selection.nodeId);

    if (!node) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Action node not found.
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto p-4 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Action Settings
        </h3>
        <WorkflowNodeEditor
          workflowId={workflow.codeName}
          workflow={workflow}
          node={node}
          index={nodeIndex}
          components={components}
          normalizedAppResources={normalizedAppResources}
          customModulesCode={customModulesCode}
          prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
          workspaceConnectionId={workspaceConnectionId}
          onUpdateNode={onUpdateNode}
          onRemoveNode={onRemoveNode}
          onUpdateEdge={onUpdateEdge}
          onAddRoute={onAddRoute}
          onRemoveRoute={onRemoveRoute}
        />
      </div>
    );
  }

  if (selection.type === "edge") {
    const edge = workflow.edges[selection.edgeIndex];

    if (!edge) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Edge not found.
        </div>
      );
    }

    const fromNode = workflow.nodes.find((n) => n.id === edge.fromNodeId);
    const toNode = workflow.nodes.find((n) => n.id === edge.toNodeId);

    return (
      <div className="h-full overflow-y-auto p-4 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Edge Settings
        </h3>
        <div className="text-xs text-muted-foreground mb-3">
          {fromNode?.actionType ?? edge.fromNodeId} →{" "}
          {toNode?.actionType ?? edge.toNodeId}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Route</label>
          <div className="flex gap-2 flex-wrap">
            {WORKFLOW_ROUTES.map((route) => (
              <button
                key={route}
                type="button"
                onClick={() =>
                  onUpdateEdge(
                    workflow.codeName,
                    selection.edgeIndex,
                    (current) => ({ ...current, route }),
                  )
                }
                className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  edge.route === route
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-card border-border text-foreground hover:border-indigo-400 hover:text-indigo-700"
                }`}
              >
                {route}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
