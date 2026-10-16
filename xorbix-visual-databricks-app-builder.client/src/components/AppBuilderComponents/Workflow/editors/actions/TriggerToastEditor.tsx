import type { FC } from "react";
import { Input } from "../../../../ui/input";
import { Label } from "../../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import { Textarea } from "../../../../ui/textarea";
import type { ToastPresetDuration } from "../../../../../types/workflow";
import { isWorkflowActionNode } from "../../../../../types/workflow";
import type { WorkflowActionEditorProps } from "./types";

const CUSTOM_DURATION_VALUE = "__custom_seconds__";

const DURATION_OPTIONS: Array<{
  value: ToastPresetDuration | typeof CUSTOM_DURATION_VALUE;
  label: string;
}> = [
  { value: "short", label: "Short (4s)" },
  { value: "long", label: "Long (10s)" },
  { value: "infinite", label: "Infinite" },
  { value: CUSTOM_DURATION_VALUE, label: "Custom seconds" },
];

export const TriggerToastEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  node,
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "TriggerToast")) {
    return null;
  }

  const durationSelectValue =
    node.params.duration.kind === "preset"
      ? node.params.duration.value
      : CUSTOM_DURATION_VALUE;

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm">Body</Label>
        <Textarea
          value={node.params.body}
          placeholder="Workflow complete"
          onChange={(event) =>
            onUpdateNode(workflowId, node.id, (current) =>
              isWorkflowActionNode(current, "TriggerToast")
                ? {
                    ...current,
                    params: { ...current.params, body: event.target.value },
                  }
                : current,
            )
          }
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Icon</Label>
        <Input
          value={node.params.icon ?? ""}
          placeholder=":material/check_circle:"
          onChange={(event) =>
            onUpdateNode(workflowId, node.id, (current) =>
              isWorkflowActionNode(current, "TriggerToast")
                ? {
                    ...current,
                    params: {
                      ...current.params,
                      icon: event.target.value.trim() || undefined,
                    },
                  }
                : current,
            )
          }
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Duration</Label>
        <Select
          value={durationSelectValue}
          onValueChange={(value) =>
            onUpdateNode(workflowId, node.id, (current) => {
              if (!isWorkflowActionNode(current, "TriggerToast")) {
                return current;
              }

              return {
                ...current,
                params: {
                  ...current.params,
                  duration:
                    value === CUSTOM_DURATION_VALUE
                      ? { kind: "seconds", value: 5 }
                      : { kind: "preset", value: value as ToastPresetDuration },
                },
              };
            })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select duration..." />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {node.params.duration.kind === "seconds" && (
        <div className="space-y-1">
          <Label className="text-sm">Seconds</Label>
          <Input
            type="number"
            min={1}
            value={node.params.duration.value}
            onChange={(event) => {
              const nextValue = Number(event.target.value);

              onUpdateNode(workflowId, node.id, (current) =>
                isWorkflowActionNode(current, "TriggerToast")
                  ? {
                      ...current,
                      params: {
                        ...current.params,
                        duration: {
                          kind: "seconds",
                          value:
                            Number.isFinite(nextValue) && nextValue > 0
                              ? nextValue
                              : 1,
                        },
                      },
                    }
                  : current,
              );
            }}
          />
        </div>
      )}
    </div>
  );
};
