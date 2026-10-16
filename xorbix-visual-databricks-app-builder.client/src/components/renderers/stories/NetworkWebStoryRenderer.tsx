import { useMemo, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  drawNetworkWebFrame,
  type INetworkWebVisualConfig,
} from "./networkWebCanvasDraw";
import { generateNetworkWebPreviewData } from "./generateNetworkWebPreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface INetworkWebStoryRendererPropsRaw {
  title?: string;
  sourceEntityId?: unknown;
  sourceEntityLabel?: unknown;
  targetEntityId?: unknown;
  targetEntityLabel?: unknown;
  relationshipType?: unknown;
  relationshipWeight?: unknown;
  layoutAlgorithm?: string;
  nodeSizeBy?: string;
  nodeColorBy?: string;
  edgeWidthBy?: string;
  edgeColorBy?: string;
  showArrows?: boolean;
  highlightDepth?: number;
  minWeightFilter?: number;
  maxNodes?: number;
  maxEdges?: number;
}

const PREVIEW_HEIGHT_PX = 250;

function buildVisualConfig(
  raw: INetworkWebStoryRendererPropsRaw,
): INetworkWebVisualConfig {
  return {
    layout_algorithm: raw.layoutAlgorithm || "force",
    node_size_by: raw.nodeSizeBy || "degree",
    node_color_by: raw.nodeColorBy || "category",
    edge_width_by: raw.edgeWidthBy || "weight",
    edge_color_by: raw.edgeColorBy || "relationship_type",
    show_arrows: typeof raw.showArrows === "boolean" ? raw.showArrows : true,
    highlight_depth:
      typeof raw.highlightDepth === "number" ? raw.highlightDepth : 1,
    min_weight_filter:
      typeof raw.minWeightFilter === "number" ? raw.minWeightFilter : 0,
    max_nodes: typeof raw.maxNodes === "number" ? raw.maxNodes : 300,
    max_edges: typeof raw.maxEdges === "number" ? raw.maxEdges : 800,
  };
}

const NetworkWebStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as INetworkWebStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.sourceEntityId,
    raw.sourceEntityLabel,
    raw.targetEntityId,
    raw.targetEntityLabel,
    raw.relationshipType,
    raw.relationshipWeight,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [
      raw.layoutAlgorithm,
      raw.nodeSizeBy,
      raw.nodeColorBy,
      raw.edgeWidthBy,
      raw.edgeColorBy,
      raw.showArrows,
      raw.highlightDepth,
      raw.minWeightFilter,
      raw.maxNodes,
      raw.maxEdges,
    ],
  );

  const previewSeedKey = `${component.id}|network|${visualConfig.layout_algorithm}|${visualConfig.node_color_by}`;
  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generateNetworkWebPreviewData,
    draw: drawNetworkWebFrame,
  });

  return (
    <StoryCanvasPreviewShell
      title={raw.title || "Network Web Story"}
      titleColor={theme.textColor}
      configured={configured}
      unconfiguredMessage="Bind a table and map source, target, relationship type, and weight fields to render this visualization"
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
    />
  );
};

export default NetworkWebStoryRenderer;
