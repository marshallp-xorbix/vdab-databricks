import type { FC } from "react";
import { Label } from "../../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import { isWorkflowActionNode } from "../../../../../types/workflow";
import {
  getGraphReachablePriorNodeOptions,
  getSetBindingTargetComponentOptions,
  getSetBindingTargetGuidance,
  getSetBindingTargetTypeForComponent,
} from "../../../../../utils/workflow/actionReferenceOptions";
import type { WorkflowActionEditorProps } from "./types";

export const SetBindingEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  workflow,
  node,
  components,
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "SetBinding")) {
    return null;
  }

  const sourceOptions = getGraphReachablePriorNodeOptions(workflow, node.id, [
    "RunSql",
  ]);
  const targetOptions = getSetBindingTargetComponentOptions(components);
  const selectedTarget = components.find(
    (component) => component.codeName === node.params.target.componentCodeName,
  );
  const targetGuidance = getSetBindingTargetGuidance(selectedTarget);

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-sm">Source Action</Label>
        <Select
          value={node.params.source.nodeId}
          onValueChange={(value) =>
            onUpdateNode(workflowId, node.id, (current) =>
              isWorkflowActionNode(current, "SetBinding")
                ? {
                    ...current,
                    params: {
                      ...current.params,
                      source: { ...current.params.source, nodeId: value },
                    },
                  }
                : current,
            )
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select prior RunSql action..." />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Target Component</Label>
        <Select
          value={node.params.target.componentCodeName}
          onValueChange={(value) =>
            onUpdateNode(workflowId, node.id, (current) => {
              if (!isWorkflowActionNode(current, "SetBinding")) {
                return current;
              }

              const nextTarget = components.find(
                (component) => component.codeName === value,
              );
              const nextBindingType =
                getSetBindingTargetTypeForComponent(nextTarget) ??
                current.params.target.bindingType;

              return {
                ...current,
                params: {
                  ...current.params,
                  target: {
                    componentCodeName: value,
                    bindingType: nextBindingType,
                  },
                },
              };
            })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select target component..." />
          </SelectTrigger>
          <SelectContent>
            {targetOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="sm:col-span-2 space-y-1 text-xs text-muted-foreground">
        <p>
          Set Binding applies the `rows` output from a prior RunSql action
          directly to the target component's workflow data input.
        </p>
        {targetGuidance ? <p>{targetGuidance}</p> : null}
      </div>
    </div>
  );
};
