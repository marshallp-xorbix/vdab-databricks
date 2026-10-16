import { useMemo, type FC } from "react";
import { Button } from "../ui/button";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import type { VdabComponent } from "../../types/components";
import type { WorkflowActionKind, WorkflowDefinition, WorkflowNode } from "../../types/workflow";
import { WORKFLOW_ACTION_REGISTRY } from "../AppBuilderComponents/Workflow/ActionRegistry";
import { useWorkflowDefinitionEditor } from "../AppBuilderComponents/Workflow/useWorkflowDefinitionEditor";
import {
  getActionDefinition,
  getWorkflowTriggerValidationError,
} from "../AppBuilderComponents/Workflow/workflowPanelUtils";
import { isWorkflowTriggerForm } from "../../utils/workflow/actionReferenceOptions";
import {
  cloneActionNodeWithDefaults,
  createDefaultActionNode,
} from "../AppBuilderComponents/Workflow/registry/actionDefaults";
import { validateActionNode } from "../../utils/workflow/validateActionNode";

interface ComponentWorkflowsPanelProps {
  component: VdabComponent;
  components: VdabComponent[];
  workflowDefinition: WorkflowDefinition;
  customModulesCode?: string;
  prebuiltModulesLibrarySource?: string;
  workspaceConnectionId?: number;
  normalizedAppResources?: NormalizedAppResource[];
  onWorkflowDefinitionChange: (nextDefinition: WorkflowDefinition) => void;
  onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
}

export const ComponentWorkflowsPanel: FC<ComponentWorkflowsPanelProps> = ({
  component,
  components,
  workflowDefinition,
  customModulesCode = "",
  prebuiltModulesLibrarySource = "",
  workspaceConnectionId,
  normalizedAppResources,
  onWorkflowDefinitionChange,
  onJumpToWorkflowAction,
}) => {
  const supportedEvents = component.supportedEvents ?? [];
  const componentCodeName = component.codeName ?? "";
  const associatedWorkflows = useMemo(
    () =>
      workflowDefinition.workflows.filter(
        (workflow) => workflow.trigger.componentCodeName === componentCodeName,
      ),
    [componentCodeName, workflowDefinition.workflows],
  );
  const usedEvents = new Set(
    associatedWorkflows.map((workflow) => workflow.trigger.eventKey),
  );
  const availableEvents = supportedEvents.filter(
    (eventKey) => !usedEvents.has(eventKey),
  );
  const canAddWorkflow = componentCodeName.length > 0 && availableEvents.length > 0;

  const {
    updateWorkflow,
    removeWorkflow,
    updateNode,
    addWorkflowForTrigger,
  } = useWorkflowDefinitionEditor({
    definition: workflowDefinition,
    onChange: onWorkflowDefinitionChange,
  });

  const primaryWorkflow = associatedWorkflows[0];

  const handleAddWorkflow = () => {
    if (!componentCodeName || availableEvents.length === 0) return;
    addWorkflowForTrigger(componentCodeName, availableEvents[0]);
  };

  if (supportedEvents.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        This component does not support workflow triggers.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!primaryWorkflow ? (
        <div className="space-y-2">
          {!canAddWorkflow ? (
            <p className="text-xs text-muted-foreground">
              All supported trigger events already have workflows.
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleAddWorkflow}
            disabled={!canAddWorkflow}
            className="w-full rounded-md bg-muted px-3 py-2 text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Add Workflow
          </button>
        </div>
      ) : (
        (() => {
          const firstNode = primaryWorkflow.nodes[0] as WorkflowNode | undefined;
          const triggerError = getWorkflowTriggerValidationError(
            workflowDefinition.workflows,
            primaryWorkflow.codeName,
            primaryWorkflow.trigger.componentCodeName,
            primaryWorkflow.trigger.eventKey,
          );

          const triggerIsForm = isWorkflowTriggerForm(
            primaryWorkflow,
            components,
          );
          const availableActions = WORKFLOW_ACTION_REGISTRY.filter((action) => {
            if (action.actionType !== "SaveToTable") return true;
            return triggerIsForm || action.actionType === firstNode?.actionType;
          });

          const actionDefinition = firstNode
            ? getActionDefinition(firstNode.actionType)
            : undefined;

          const ActionEditorComponent = actionDefinition?.editor;

          const actionValidation = firstNode
            ? validateActionNode(
                primaryWorkflow,
                firstNode,
                components,
                normalizedAppResources,
                prebuiltModulesLibrarySource,
              )
            : { errors: [] as string[] };

          const selectedActionType = firstNode?.actionType ?? "";
          const hasComplexWorkflow =
            primaryWorkflow.nodes.length > 1 ||
            primaryWorkflow.edges.length > 0;

          return (
            <div className="space-y-3 rounded-lg bg-muted/90 p-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {primaryWorkflow.codeName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {primaryWorkflow.nodes.length > 0
                    ? "Basic workflow (trigger + first action)"
                    : "Basic workflow (trigger selected, action pending)"}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeWorkflow(primaryWorkflow.codeName)}
                  className="w-full justify-start border-destructive/30 text-destructive-foreground hover:text-destructive-foreground"
                >
                  Remove Workflow
                </Button>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor={`workflow-trigger-${primaryWorkflow.codeName}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Trigger Event
                </label>
                <select
                  id={`workflow-trigger-${primaryWorkflow.codeName}`}
                  value={primaryWorkflow.trigger.eventKey}
                  onChange={(event) =>
                    updateWorkflow(primaryWorkflow.codeName, (current) => ({
                      ...current,
                      trigger: {
                        ...current.trigger,
                        eventKey: event.target.value,
                      },
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-sm"
                >
                  {supportedEvents.map((eventKey) => (
                    <option key={eventKey} value={eventKey}>
                      {eventKey}
                    </option>
                  ))}
                </select>
                {triggerError ? (
                  <p className="text-xs text-destructive">{triggerError}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor={`workflow-action-${primaryWorkflow.codeName}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Action
                </label>
                <select
                  id={`workflow-action-${primaryWorkflow.codeName}`}
                  value={selectedActionType}
                  onChange={(event) => {
                    const nextActionTypeRaw = event.target.value;
                    if (!nextActionTypeRaw) return;

                    const nextActionType =
                      nextActionTypeRaw as WorkflowActionKind;

                    updateWorkflow(primaryWorkflow.codeName, (current) => {
                      const currentFirstNode = current.nodes[0];

                      if (!currentFirstNode) {
                        return {
                          ...current,
                          nodes: [createDefaultActionNode(nextActionType)],
                        };
                      }

                      return {
                        ...current,
                        nodes: [
                          cloneActionNodeWithDefaults(
                            nextActionType,
                            currentFirstNode.id,
                          ),
                          ...current.nodes.slice(1),
                        ],
                      };
                    });
                  }}
                  className="h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-sm"
                >
                  <option value="">Select action...</option>
                  {availableActions.map((action) => (
                    <option key={action.actionType} value={action.actionType}>
                      {action.label}
                    </option>
                  ))}
                </select>

                {actionValidation.errors.length > 0 ? (
                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2">
                    {actionValidation.errors.map((error) => (
                      <p
                        key={error}
                        className="text-xs text-destructive-foreground leading-relaxed"
                      >
                        {error}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>

              {firstNode && ActionEditorComponent ? (
                <div className="space-y-2">
                  <ActionEditorComponent
                    workflowId={primaryWorkflow.codeName}
                    workflow={primaryWorkflow}
                    node={firstNode}
                    components={components}
                    normalizedAppResources={normalizedAppResources}
                    customModulesCode={customModulesCode}
                    prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
                    workspaceConnectionId={workspaceConnectionId}
                    actionDefinition={actionDefinition}
                    onUpdateNode={updateNode}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                {hasComplexWorkflow ? (
                  <p className="text-xs text-muted-foreground">
                    This panel shows only the basic trigger and first action.
                    Use the builder to view and edit the full workflow.
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() =>
                    onJumpToWorkflowAction?.(
                      primaryWorkflow.codeName,
                      firstNode?.id,
                    )
                  }
                >
                  Edit in Workflow Builder
                </Button>

                <p className="text-xs text-muted-foreground">
                  You can add more actions in the Workflow Builder.
                </p>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
