import { useEffect, useState, type FC } from "react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import type { VdabComponent } from "../../../types/components";
import type { Workflow, WorkflowActionKind } from "../../../types/workflow";
import { WORKFLOW_ACTION_REGISTRY } from "./ActionRegistry";
import { WorkflowRouteEditor } from "./WorkflowRouteEditor";
import { cloneActionNodeWithDefaults } from "./registry/actionDefaults";
import {
  ROUTE_OPTIONS,
  getActionDefinition,
  getNodeLabel,
} from "./workflowPanelUtils";
import { isWorkflowTriggerForm } from "../../../utils/workflow/actionReferenceOptions";
import { validateActionNode } from "../../../utils/workflow/validateActionNode";

interface WorkflowNodeEditorProps {
  workflowId: string;
  workflow: Workflow;
  node: Workflow["nodes"][number];
  index: number;
  components: VdabComponent[];
  normalizedAppResources?: NormalizedAppResource[];
  customModulesCode?: string;
  prebuiltModulesLibrarySource?: string;
  isFocusedTarget?: boolean;
  focusNonce?: number;
  workspaceConnectionId?: number;
  onUpdateNode: (
    workflowId: string,
    nodeId: string,
    updater: (node: Workflow["nodes"][number]) => Workflow["nodes"][number],
  ) => void;
  onRemoveNode: (workflowId: string, nodeId: string) => void;
  onUpdateEdge: (
    workflowId: string,
    edgeIndex: number,
    updater: (edge: Workflow["edges"][number]) => Workflow["edges"][number],
  ) => void;
  onAddRoute: (workflowId: string, fromNodeId: string) => void;
  onRemoveRoute: (workflowId: string, edgeIndex: number) => void;
}

export const WorkflowNodeEditor: FC<WorkflowNodeEditorProps> = ({
  workflowId,
  workflow,
  node,
  index,
  components,
  normalizedAppResources,
  customModulesCode,
  prebuiltModulesLibrarySource,
  isFocusedTarget = false,
  focusNonce,
  workspaceConnectionId,
  onUpdateNode,
  onRemoveNode,
  onUpdateEdge,
  onAddRoute,
  onRemoveRoute,
}) => {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const actionDefinition = getActionDefinition(node.actionType);
  const supportedRoutes = actionDefinition?.supportedRoutes ?? ROUTE_OPTIONS;
  const triggerIsForm = isWorkflowTriggerForm(workflow, components);
  const availableActions = WORKFLOW_ACTION_REGISTRY.filter(
    (action) =>
      action.actionType !== "SaveToTable" ||
      triggerIsForm ||
      action.actionType === node.actionType,
  );
  const validation = validateActionNode(
    workflow,
    node,
    components,
    normalizedAppResources,
    prebuiltModulesLibrarySource,
  );
  const outgoingEdges = workflow.edges
    .map((edge, edgeIndex) => ({ edge, edgeIndex }))
    .filter(({ edge }) => edge.fromNodeId === node.id);
  const availableTargetNodes = workflow.nodes.filter(
    (candidate) => candidate.id !== node.id,
  );

  const ActionEditorComponent = actionDefinition?.editor;

  useEffect(() => {
    if (!isFocusedTarget) {
      return;
    }

    setIsHighlighted(true);

    const timeoutId = window.setTimeout(() => {
      setIsHighlighted(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [focusNonce, isFocusedTarget]);

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }

    const clearHighlight = () => {
      setIsHighlighted(false);
    };

    document.addEventListener("pointerdown", clearHighlight);
    document.addEventListener("keydown", clearHighlight);

    return () => {
      document.removeEventListener("pointerdown", clearHighlight);
      document.removeEventListener("keydown", clearHighlight);
    };
  }, [isHighlighted]);

  return (
    <div
      data-workflow-node-id={node.id}
      onClick={() => {
        if (isHighlighted) {
          setIsHighlighted(false);
        }
      }}
      className={`rounded-md border p-3 outline-none transition-colors ${
        isHighlighted
          ? "border-primary bg-primary/12 shadow-sm"
          : "border-border"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">
          {getNodeLabel(node, index)}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRemoveNode(workflowId, node.id)}
        >
          Remove Action
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Select
            value={node.actionType}
            onValueChange={(value) =>
              onUpdateNode(workflowId, node.id, () =>
                cloneActionNodeWithDefaults(
                  value as WorkflowActionKind,
                  node.id,
                ),
              )
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableActions.map((action) => (
                <SelectItem key={action.actionType} value={action.actionType}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {ActionEditorComponent && (
        <ActionEditorComponent
          workflowId={workflowId}
          workflow={workflow}
          node={node}
          components={components}
          normalizedAppResources={normalizedAppResources}
          customModulesCode={customModulesCode}
          prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
          workspaceConnectionId={workspaceConnectionId}
          actionDefinition={actionDefinition}
          onUpdateNode={onUpdateNode}
        />
      )}

      {validation.errors.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2">
          {validation.errors.map((error) => (
            <p key={error} className="text-xs text-destructive-foreground">
              {error}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-md border border-dashed border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-medium">Routes</Label>
            <p className="text-xs text-muted-foreground">
              Add one or more outcome branches from this action (e.g. onSuccess,
              onError, always).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={availableTargetNodes.length === 0}
            onClick={() => onAddRoute(workflowId, node.id)}
          >
            Add Route
          </Button>
        </div>

        {outgoingEdges.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No outgoing routes. The workflow ends after this action.
          </p>
        ) : (
          <div className="space-y-3">
            {outgoingEdges.map(({ edge, edgeIndex }) => (
              <WorkflowRouteEditor
                key={`${edge.fromNodeId}-${edge.toNodeId}-${edgeIndex}`}
                workflow={workflow}
                edge={edge}
                edgeIndex={edgeIndex}
                availableTargetNodes={availableTargetNodes}
                supportedRoutes={supportedRoutes}
                onUpdateEdge={(currentEdgeIndex, updater) =>
                  onUpdateEdge(workflowId, currentEdgeIndex, updater)
                }
                onRemoveRoute={(currentEdgeIndex) =>
                  onRemoveRoute(workflowId, currentEdgeIndex)
                }
                getNodeLabel={getNodeLabel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
