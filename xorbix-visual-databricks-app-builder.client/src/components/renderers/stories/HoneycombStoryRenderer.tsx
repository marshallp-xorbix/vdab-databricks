import { useMemo, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  drawHoneycombFrame,
  type IHoneycombVisualConfig,
} from "./honeycombCanvasDraw";
import { generateHoneycombPreviewData } from "./generateHoneycombPreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface IHoneycombStoryRendererPropsRaw {
  title?: string;
  itemName?: unknown;
  impactScore?: unknown;
  priorityLevel?: unknown;
  progressPct?: unknown;
  category?: unknown;
  showLabels?: boolean;
  showRiskBorders?: boolean;
  showTrendArrows?: boolean;
}

const PREVIEW_HEIGHT_PX = 280;

function buildVisualConfig(
  raw: IHoneycombStoryRendererPropsRaw,
): IHoneycombVisualConfig {
  return {
    show_labels: typeof raw.showLabels === "boolean" ? raw.showLabels : true,
    show_risk_borders:
      typeof raw.showRiskBorders === "boolean" ? raw.showRiskBorders : true,
    show_trend_arrows:
      typeof raw.showTrendArrows === "boolean" ? raw.showTrendArrows : true,
  };
}

const HoneycombStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as IHoneycombStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.itemName,
    raw.impactScore,
    raw.priorityLevel,
    raw.progressPct,
    raw.category,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [raw.showLabels, raw.showRiskBorders, raw.showTrendArrows],
  );

  const previewSeedKey = `${component.id}|honeycomb|${visualConfig.show_labels}|${visualConfig.show_risk_borders}|${visualConfig.show_trend_arrows}`;
  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generateHoneycombPreviewData,
    draw: drawHoneycombFrame,
  });

  const titleColor = theme.textColor;
  const title = raw.title || "Honeycomb Story";

  return (
    <StoryCanvasPreviewShell
      title={title}
      titleColor={titleColor}
      configured={configured}
      unconfiguredMessage="Map item, impact, priority, progress, and category to preview this story."
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
    />
  );
};

export default HoneycombStoryRenderer;
