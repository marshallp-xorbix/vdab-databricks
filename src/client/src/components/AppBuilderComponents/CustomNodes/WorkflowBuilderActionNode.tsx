import { memo, type FC } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "../../../lib/utils";
import type { ActionNodeData } from "../../../utils/workflowBuilderLayout";

const ActionNode: FC<NodeProps<Node<ActionNodeData>>> = ({ data, selected }) => {
  return (
    <div
      className={cn(
        "relative min-w-[180px] cursor-pointer rounded-lg border-2 bg-card px-3 py-2 text-center text-card-foreground transition-all",
        selected ? "border-primary ring-2 ring-primary/35" : "border-border",
      )}
    >
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Action {data.nodeIndex + 1}
      </div>
      <div className="truncate text-sm font-semibold leading-tight">
        {data.actionLabel}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !bg-muted-foreground"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !bg-muted-foreground"
      />
    </div>
  );
};

export default memo(ActionNode);
