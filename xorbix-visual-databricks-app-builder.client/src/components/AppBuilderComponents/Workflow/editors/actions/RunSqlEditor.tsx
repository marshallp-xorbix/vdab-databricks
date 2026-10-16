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
import { getGraphReachablePriorNodeOptions } from "../../../../../utils/workflow/actionReferenceOptions";
import type { WorkflowActionEditorProps } from "./types";

export const RunSqlEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  workflow,
  node,
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "RunSql")) {
    return null;
  }

  const statementOptions = getGraphReachablePriorNodeOptions(
    workflow,
    node.id,
    ["BuildSql"],
  );

  return (
    <div className="mt-2 space-y-1">
      <Label className="text-sm">Statement Source</Label>
      <Select
        value={node.params.statement.nodeId}
        onValueChange={(value) =>
          onUpdateNode(workflowId, node.id, (current) =>
            isWorkflowActionNode(current, "RunSql")
              ? {
                  ...current,
                  params: {
                    ...current.params,
                    statement: { ...current.params.statement, nodeId: value },
                  },
                }
              : current,
          )
        }
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select prior BuildSql action..." />
        </SelectTrigger>
        <SelectContent>
          {statementOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {statementOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No graph-reachable BuildSql actions are available upstream from this
          node.
        </p>
      )}
    </div>
  );
};
