import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  GraphHandleId,
  type NodeHandleVisibility,
} from "../../../utils/graphPorts";

interface GraphNodeFrameProps {
  label: string;
  selected?: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  handles?: NodeHandleVisibility;
  className?: string;
  deleteButton?: ReactNode;
  children?: ReactNode;
}

const GraphNodeFrame = ({
  label,
  selected,
  backgroundColor,
  borderColor,
  textColor,
  handles,
  className,
  deleteButton,
  children,
}: GraphNodeFrameProps) => {
  return (
    <div
      className={`relative px-3 py-2 rounded-lg border-2 text-center cursor-pointer transition-all ${className ?? ""}`}
      style={{
        background: backgroundColor,
        color: textColor,
        borderColor,
        border: `2px solid ${borderColor}`,
        boxShadow: selected ? `0 0 0 2px ${borderColor}` : "none",
        outline: "none",
      }}
    >
      {deleteButton}
      {handles?.hasInbound && (
        <Handle
          type="target"
          position={Position.Left}
          id={GraphHandleId.In}
          className="w-2 h-2"
        />
      )}
      <div className="font-medium">{label}</div>
      {handles?.hasOutbound && (
        <Handle
          type="source"
          position={Position.Right}
          id={GraphHandleId.Out}
          className="w-2 h-2"
        />
      )}
      {children}
    </div>
  );
};

export default GraphNodeFrame;
