import { useMemo, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  drawSpiralFrame,
  type ISpiralVisualConfig,
} from "./spiralCanvasDraw";
import { generateSpiralPreviewData } from "./generateSpiralPreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface ISpiralStoryRendererPropsRaw {
  title?: string;
  journeyName?: unknown;
  stage?: unknown;
  timelineField?: unknown;
  progressPct?: unknown;
  metricValue?: unknown;
  showLabels?: boolean;
  showRiskGlow?: boolean;
  showVariance?: boolean;
  spaceByTimeline?: boolean;
}

const PREVIEW_HEIGHT_PX = 280;

function buildVisualConfig(
  raw: ISpiralStoryRendererPropsRaw,
): ISpiralVisualConfig {
  return {
    show_labels: typeof raw.showLabels === "boolean" ? raw.showLabels : true,
    show_risk_glow:
      typeof raw.showRiskGlow === "boolean" ? raw.showRiskGlow : true,
    show_variance:
      typeof raw.showVariance === "boolean" ? raw.showVariance : true,
    space_by_timeline:
      typeof raw.spaceByTimeline === "boolean" ? raw.spaceByTimeline : false,
  };
}

const SpiralStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as ISpiralStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.journeyName,
    raw.stage,
    raw.timelineField,
    raw.progressPct,
    raw.metricValue,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [raw.showLabels, raw.showRiskGlow, raw.showVariance, raw.spaceByTimeline],
  );

  const previewSeedKey = `${component.id}|spiral|${visualConfig.show_labels}|${visualConfig.show_risk_glow}|${visualConfig.show_variance}|${visualConfig.space_by_timeline}`;
  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generateSpiralPreviewData,
    draw: drawSpiralFrame,
  });

  const titleColor = theme.textColor;
  const title = raw.title || "Spiral Story";

  return (
    <StoryCanvasPreviewShell
      title={title}
      titleColor={titleColor}
      configured={configured}
      unconfiguredMessage="Map journey, stage, timeline, progress, and metric to preview this story."
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
    />
  );
};

export default SpiralStoryRenderer;
