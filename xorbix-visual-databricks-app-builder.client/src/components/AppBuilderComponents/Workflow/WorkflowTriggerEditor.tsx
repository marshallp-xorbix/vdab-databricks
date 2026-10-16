import type { FC } from "react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import type { VdabComponent } from "../../../types/components/vdabComponent";
import type { Workflow } from "../../../types/workflow";
import {
  getWorkflowCodeNameValidationError,
  getWorkflowTriggerValidationError,
} from "./workflowPanelUtils";

interface WorkflowTriggerEditorProps {
  workflow: Workflow;
  workflows: Workflow[];
  triggerableComponents: VdabComponent[];
  onUpdateWorkflow: (
    workflowCodeName: string,
    updater: (workflow: Workflow) => Workflow,
  ) => void;
  onRemoveWorkflow: (workflowCodeName: string) => void;
}

export const WorkflowTriggerEditor: FC<WorkflowTriggerEditorProps> = ({
  workflow,
  workflows,
  triggerableComponents,
  onUpdateWorkflow,
  onRemoveWorkflow,
}) => {
  const triggerComponent = triggerableComponents.find(
    (c) => c.codeName === workflow.trigger.componentCodeName,
  );
  const supportedEvents = triggerComponent?.supportedEvents ?? [];

  const codeNameError = getWorkflowCodeNameValidationError(
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Trigger Settings
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive-foreground border-destructive/30 hover:border-destructive"
          onClick={() => onRemoveWorkflow(workflow.codeName)}
        >
          Delete Workflow
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Workflow Code Name</Label>
        <Input
          className={codeNameError ? "border-destructive" : undefined}
          value={workflow.codeName ?? ""}
          onChange={(e) =>
            onUpdateWorkflow(workflow.codeName, (current) => ({
              ...current,
              codeName: e.target.value,
            }))
          }
        />
        {codeNameError && (
          <p className="text-xs text-destructive">{codeNameError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Used in generated code — must be unique and start with a letter or
          underscore.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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
                    triggerableComponents.find((c) => c.codeName === value)
                      ?.supportedEvents?.[0] ?? "onClick",
                },
              }))
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select component..." />
            </SelectTrigger>
            <SelectContent>
              {triggerableComponents.map((c) => (
                <SelectItem key={c.id} value={c.codeName!}>
                  {c.codeName}
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
              {supportedEvents.map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {triggerError && (
            <p className="text-xs text-destructive">{triggerError}</p>
          )}
        </div>
      </div>
    </div>
  );
};
