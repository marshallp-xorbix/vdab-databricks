import type { FC } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
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
import type { Workflow } from "../../../types/workflow";
import { WorkflowNodeEditor } from "./WorkflowNodeEditor";
import {
  getWorkflowCodeNameValidationError,
  getWorkflowLabel,
  getWorkflowTriggerValidationError,
} from "./workflowPanelUtils";

interface WorkflowEditorProps {
  workflow: Workflow;
  workflows: Workflow[];
  workflowIndex: number;
  components: VdabComponent[];
  triggerableComponents: VdabComponent[];
  focusNodeId?: string | null;
  focusNonce?: number;
  workspaceConnectionId?: number;
  normalizedAppResources?: NormalizedAppResource[];
  onUpdateWorkflow: (
    workflowCodeName: string,
    updater: (workflow: Workflow) => Workflow,
  ) => void;
  onRemoveWorkflow: (workflowCodeName: string) => void;
  onAddNode: (workflowCodeName: string) => void;
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
  customModulesCode?: string;
  prebuiltModulesLibrarySource?: string;
}

export const WorkflowEditor: FC<WorkflowEditorProps> = ({
  workflow,
  workflows,
  workflowIndex,
  components,
  triggerableComponents,
  focusNodeId,
  focusNonce,
  workspaceConnectionId,
  normalizedAppResources,
  onUpdateWorkflow,
  onRemoveWorkflow,
  onAddNode,
  onUpdateNode,
  onRemoveNode,
  onUpdateEdge,
  onAddRoute,
  onRemoveRoute,
  customModulesCode,
  prebuiltModulesLibrarySource,
}) => {
  const triggerComponent = triggerableComponents.find(
    (component) => component.codeName === workflow.trigger.componentCodeName,
  );
  const supportedEvents = triggerComponent?.supportedEvents ?? [];
  const workflowCodeNameError = getWorkflowCodeNameValidationError(
    workflows,
    workflow.codeName,
    workflow.codeName,
  );
  const triggerError = getWorkflowTriggerValidationError(
    workflows,
    workflow.codeName,
    workflow.trigger.componentCodeName,
    workflow.trigger.eventKey,
  );

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {getWorkflowLabel(workflow, workflowIndex)}
        </Label>
        <button
          onClick={() => onRemoveWorkflow(workflow.codeName)}
          className="text-xs text-destructive hover:text-destructive-foreground"
        >
          Remove
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-sm">Workflow Code Name</Label>
          <Input
            className={workflowCodeNameError ? "border-destructive" : undefined}
            value={workflow.codeName ?? ""}
            placeholder={`workflow_${workflowIndex + 1}`}
            onChange={(event) =>
              onUpdateWorkflow(workflow.codeName, (current) => ({
                ...current,
                codeName: event.target.value,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            This code name is used in generated code, for example
            `handle_workflow_trigger_toast`, so it must stay unique.
          </p>
          {workflowCodeNameError && (
            <p className="text-xs text-destructive">{workflowCodeNameError}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-sm">Trigger Component</Label>
          <Select
            value={workflow.trigger.componentCodeName}
            onValueChange={(value) =>
              onUpdateWorkflow(workflow.codeName, (current) => ({
                ...current,
                trigger: {
                  componentCodeName: value,
                  eventKey:
                    triggerableComponents.find(
                      (component) => component.codeName === value,
                    )?.supportedEvents?.[0] ?? "onClick",
                },
              }))
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select component..." />
            </SelectTrigger>
            <SelectContent>
              {triggerableComponents.map((component) => (
                <SelectItem key={component.id} value={component.codeName!}>
                  {component.codeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm">Event</Label>
          <Select
            value={workflow.trigger.eventKey}
            onValueChange={(value) =>
              onUpdateWorkflow(workflow.codeName, (current) => ({
                ...current,
                trigger: { ...current.trigger, eventKey: value },
              }))
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select event..." />
            </SelectTrigger>
            <SelectContent>
              {supportedEvents.map((eventKey) => (
                <SelectItem key={eventKey} value={eventKey}>
                  {eventKey}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {triggerError && (
            <p className="text-xs text-destructive">{triggerError}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {workflow.nodes.map((node, index) => (
          <WorkflowNodeEditor
            key={node.id}
            workflowId={workflow.codeName}
            workflow={workflow}
            node={node}
            index={index}
            components={components}
            normalizedAppResources={normalizedAppResources}
            customModulesCode={customModulesCode}
            prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
            isFocusedTarget={focusNodeId === node.id}
            focusNonce={focusNonce}
            workspaceConnectionId={workspaceConnectionId}
            onUpdateNode={onUpdateNode}
            onRemoveNode={onRemoveNode}
            onUpdateEdge={onUpdateEdge}
            onAddRoute={onAddRoute}
            onRemoveRoute={onRemoveRoute}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onAddNode(workflow.codeName)}
        >
          Add Action
        </Button>
      </div>
    </div>
  );
};
