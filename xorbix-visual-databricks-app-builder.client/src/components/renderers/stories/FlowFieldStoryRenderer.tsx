import { useMemo, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  drawFlowFieldFrame,
  type IFlowFieldVisualConfig,
} from "./flowFieldCanvasDraw";
import { generateFlowFieldPreviewData } from "./generateFlowFieldPreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface IFlowFieldStoryRendererPropsRaw {
  title?: string;
  sourceStage?: unknown;
  destinationStage?: unknown;
  flowVolume?: unknown;
  stageOrder?: unknown;
  showDropOffs?: boolean;
  showLabels?: boolean;
}

const PREVIEW_HEIGHT_PX = 280;

function buildVisualConfig(
  raw: IFlowFieldStoryRendererPropsRaw,
): IFlowFieldVisualConfig {
  return {
    show_drop_offs:
      typeof raw.showDropOffs === "boolean" ? raw.showDropOffs : true,
    show_labels: typeof raw.showLabels === "boolean" ? raw.showLabels : true,
  };
}

const FlowFieldStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as IFlowFieldStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.sourceStage,
    raw.destinationStage,
    raw.flowVolume,
    raw.stageOrder,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [raw.showDropOffs, raw.showLabels],
  );

  const previewSeedKey = `${component.id}|flowfield|${visualConfig.show_drop_offs}|${visualConfig.show_labels}`;
  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generateFlowFieldPreviewData,
    draw: drawFlowFieldFrame,
  });

  const titleColor = theme.textColor;
  const title = raw.title || "Flow Field Story";

  return (
    <StoryCanvasPreviewShell
      title={title}
      titleColor={titleColor}
      configured={configured}
      unconfiguredMessage="Map source, destination, volume, and stage order to preview this story."
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
    />
  );
};

export default FlowFieldStoryRenderer;
