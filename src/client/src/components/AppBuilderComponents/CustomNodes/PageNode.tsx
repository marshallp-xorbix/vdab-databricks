import { memo, type FC } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import GraphNodeFrame from "./GraphNodeFrame";
import type {
  GraphNodeData,
  NodeHandleVisibility,
} from "../../../utils/graphPorts";
import { getThemePrimaryHex } from "../../../constants/authBranding";

export interface PageNodeData extends GraphNodeData {
  label: string;
  type: "page";
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

const PageNode: FC<NodeProps<Node<PageNodeData>>> = ({ data, selected }) => {
  const backgroundColor = (data.backgroundColor as string) || getThemePrimaryHex();
  const borderColor = (data.borderColor as string) || getThemePrimaryHex();
  const textColor = (data.textColor as string) || "white";

  return (
    <GraphNodeFrame
      label={data.label || "Page"}
      selected={selected}
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      textColor={textColor}
      handles={data.handles as NodeHandleVisibility | undefined}
      className="min-w-[160px]"
    />
  );
};

export default memo(PageNode);
