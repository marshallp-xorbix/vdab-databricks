import { useMemo, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  drawAmoebaFrame,
  type IAmoebaVisualConfig,
} from "./amoebaCanvasDraw";
import { generateAmoebaPreviewData } from "./generateAmoebaPreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface IAmoebaStoryRendererPropsRaw {
  title?: string;
  entityId?: unknown;
  entityLabel?: unknown;
  category?: unknown;
  sizeMetric?: unknown;
  xMetric?: unknown;
  yMetric?: unknown;
  changeMetric?: unknown;
  layoutMode?: string;
  sizeScale?: string;
  minRadiusPx?: number;
  maxRadiusPx?: number;
  colorBy?: string;
  pulseBy?: string;
  pulseThreshold?: number;
  pulseThresholdMode?: string;
  shapeVariation?: number;
  labelMode?: string;
  animationEnabled?: boolean;
  animationSpeed?: number;
}

const PREVIEW_HEIGHT_PX = 250;

function buildVisualConfig(
  raw: IAmoebaStoryRendererPropsRaw,
): IAmoebaVisualConfig {
  return {
    layout_mode: raw.layoutMode || "hybrid",
    size_scale: raw.sizeScale || "sqrt",
    min_radius_px:
      typeof raw.minRadiusPx === "number" ? raw.minRadiusPx : 42,
    max_radius_px:
      typeof raw.maxRadiusPx === "number" ? raw.maxRadiusPx : 130,
    color_by: raw.colorBy || "category",
    pulse_by: raw.pulseBy || "risk_score",
    pulse_threshold:
      typeof raw.pulseThreshold === "number" ? raw.pulseThreshold : 50,
    pulse_threshold_mode: raw.pulseThresholdMode || "above",
    shape_variation:
      typeof raw.shapeVariation === "number" ? raw.shapeVariation : 0.35,
    label_mode: raw.labelMode || "compact",
    animation_enabled:
      typeof raw.animationEnabled === "boolean" ? raw.animationEnabled : true,
    animation_speed:
      typeof raw.animationSpeed === "number" ? raw.animationSpeed : 1,
  };
}

const AmoebaStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as IAmoebaStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.entityId,
    raw.entityLabel,
    raw.category,
    raw.sizeMetric,
    raw.xMetric,
    raw.yMetric,
    raw.changeMetric,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [
      raw.layoutMode,
      raw.sizeScale,
      raw.minRadiusPx,
      raw.maxRadiusPx,
      raw.colorBy,
      raw.pulseBy,
      raw.pulseThreshold,
      raw.pulseThresholdMode,
      raw.shapeVariation,
      raw.labelMode,
      raw.animationEnabled,
      raw.animationSpeed,
    ],
  );

  const previewSeedKey = `${component.id}|amoeba|${visualConfig.layout_mode}|${visualConfig.label_mode}|${visualConfig.color_by}`;
  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generateAmoebaPreviewData,
    draw: drawAmoebaFrame,
  });

  return (
    <StoryCanvasPreviewShell
      title={raw.title || "Amoeba Story"}
      titleColor={theme.textColor}
      configured={configured}
      unconfiguredMessage="Bind a table and map entity, size, and position fields to render this visualization"
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
    />
  );
};

export default AmoebaStoryRenderer;
