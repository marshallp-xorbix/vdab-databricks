import type { FC } from "react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import type { Workflow, WorkflowRoute } from "../../../types/workflow";

interface WorkflowRouteEditorProps {
  workflow: Workflow;
  edge: Workflow["edges"][number];
  edgeIndex: number;
  availableTargetNodes: Workflow["nodes"];
  supportedRoutes: WorkflowRoute[];
  onUpdateEdge: (
    edgeIndex: number,
    updater: (edge: Workflow["edges"][number]) => Workflow["edges"][number],
  ) => void;
  onRemoveRoute: (edgeIndex: number) => void;
  getNodeLabel: (node: Workflow["nodes"][number], index: number) => string;
}

export const WorkflowRouteEditor: FC<WorkflowRouteEditorProps> = ({
  workflow,
  edge,
  edgeIndex,
  availableTargetNodes,
  supportedRoutes,
  onUpdateEdge,
  onRemoveRoute,
  getNodeLabel,
}) => {
  const targetNodeLabel =
    workflow.nodes.find((candidate) => candidate.id === edge.toNodeId)?.actionType ??
    edge.toNodeId;

  return (
    <div className="rounded-md border border-border p-3">
      <div className="space-y-2">
        <Label className="text-sm">When status is</Label>
        <Select
          value={edge.route}
          onValueChange={(value) =>
            onUpdateEdge(edgeIndex, (current) => ({
              ...current,
              route: value as WorkflowRoute,
            }))
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {supportedRoutes.map((route) => (
              <SelectItem key={route} value={route}>
                {route}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label className="text-sm">Go to action</Label>
        <Select
          value={edge.toNodeId}
          onValueChange={(value) =>
            onUpdateEdge(edgeIndex, (current) => ({
              ...current,
              toNodeId: value,
            }))
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={targetNodeLabel} />
          </SelectTrigger>
          <SelectContent>
            {availableTargetNodes.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {getNodeLabel(
                  candidate,
                  workflow.nodes.findIndex(
                    (workflowNode) => workflowNode.id === candidate.id,
                  ),
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => onRemoveRoute(edgeIndex)}
        >
          Remove Route
        </Button>
      </div>
    </div>
  );
};
