/**
 * Custom React Flow node for Modal components
 * Displays with a delete button when selected and supports navigation
 * Uses centralized edge-driven handle visibility logic
 */

import { memo, type FC } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { X } from "lucide-react";
import type {
  GraphNodeData,
  NodeHandleVisibility,
} from "../../../utils/graphPorts";
import GraphNodeFrame from "./GraphNodeFrame";
import { BRAND_PRIMARY_DARK } from "../../../constants/authBranding";

export interface ModalNodeData extends GraphNodeData {
  title?: string;
  type: "modal";
  modalId?: string;
  onClick?: () => void;
  onDelete?: (modalId: string) => void;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

const ModalNode: FC<NodeProps<Node<ModalNodeData>>> = ({ data, selected }) => {
  const handles = data.handles as NodeHandleVisibility | undefined;

  const backgroundColor = (data.backgroundColor as string) || BRAND_PRIMARY_DARK;
  const borderColor = (data.borderColor as string) || BRAND_PRIMARY_DARK;
  const textColor = (data.textColor as string) || "white";

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete && data.modalId) {
      data.onDelete(data.modalId);
    }
  };

  const deleteButton =
    selected && data.onDelete ? (
      <button
        onClick={handleDeleteClick}
        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive hover:bg-destructive/90 rounded-full flex items-center justify-center shadow-md transition-colors z-10"
        title="Delete modal"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    ) : undefined;

  return (
    <GraphNodeFrame
      label={data.title || data.label || "Modal"}
      selected={selected}
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      textColor={textColor}
      handles={handles}
      className="min-w-[160px]"
      deleteButton={deleteButton}
    />
  );
};

export default memo(ModalNode);
