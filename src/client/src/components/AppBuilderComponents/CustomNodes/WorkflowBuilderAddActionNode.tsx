import { memo, type FC } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { AddActionNodeData } from "../../../utils/workflowBuilderLayout";

interface AddActionNodeProps extends NodeProps<Node<AddActionNodeData>> {
  data: AddActionNodeData & { onAddAction?: (workflowCodeName: string) => void };
}

const AddActionNode: FC<AddActionNodeProps> = ({ data }) => {
  return (
    <div
      className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-card text-muted-foreground transition-all hover:border-muted-foreground hover:text-foreground"
      onClick={() => data.onAddAction?.(data.workflowCodeName)}
    >
      <span className="select-none text-2xl font-light leading-none">+</span>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !bg-muted-foreground"
      />
    </div>
  );
};

export default memo(AddActionNode);
