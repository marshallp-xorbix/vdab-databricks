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
import { getModalOptions } from "../../../../../utils/workflow/actionReferenceOptions";
import type { WorkflowActionEditorProps } from "./types";

export const ShowModalEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  node,
  components,
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "ShowModal")) {
    return null;
  }

  const modalOptions = getModalOptions(components);

  return (
    <div className="mt-2 space-y-1">
      <Label className="text-sm">Modal</Label>
      <Select
        value={node.params.modalCodeName}
        onValueChange={(value) =>
          onUpdateNode(workflowId, node.id, (current) =>
            isWorkflowActionNode(current, "ShowModal")
              ? {
                  ...current,
                  params: { ...current.params, modalCodeName: value },
                }
              : current,
          )
        }
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select modal..." />
        </SelectTrigger>
        <SelectContent>
          {modalOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {modalOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No modal components are available in this app yet.
        </p>
      )}
    </div>
  );
};
