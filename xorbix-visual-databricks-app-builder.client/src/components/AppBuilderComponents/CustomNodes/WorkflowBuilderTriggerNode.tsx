import { memo, type FC } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { TriggerNodeData } from "../../../utils/workflowBuilderLayout";

const TriggerNode: FC<NodeProps<Node<TriggerNodeData>>> = ({
  data,
  selected,
}) => {
  return (
    <div
      className="relative rounded-lg border-2 px-3 py-2 text-center cursor-pointer transition-all min-w-[180px]"
      style={{
        background: "#4f46e5",
        borderColor: selected ? "#c7d2fe" : "#3730a3",
        boxShadow: selected ? "0 0 0 2px #c7d2fe" : "none",
        color: "white",
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75 mb-0.5">
        Trigger
      </div>
      <div className="font-semibold text-sm leading-tight truncate">
        {data.componentCodeName || "— no component —"}
      </div>
      <div className="text-[11px] opacity-80 mt-0.5">{data.eventKey}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-indigo-300"
      />
    </div>
  );
};

export default memo(TriggerNode);
