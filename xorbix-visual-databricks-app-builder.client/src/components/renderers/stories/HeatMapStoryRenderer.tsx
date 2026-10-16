import { useMemo, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  drawHeatMapFrame,
  type IHeatMapVisualConfig,
} from "./heatMapCanvasDraw";
import { generateHeatMapPreviewData } from "./generateHeatMapPreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface IHeatMapStoryRendererPropsRaw {
  title?: string;
  geographicArea?: unknown;
  metricValue?: unknown;
  colorScale?: string;
  showLabels?: boolean;
  showLegend?: boolean;
  aggregationMethod?: string;
}

const PREVIEW_HEIGHT_PX = 300;

function buildVisualConfig(
  raw: IHeatMapStoryRendererPropsRaw,
): IHeatMapVisualConfig {
  return {
    map_scope: "usa",
    geographic_level: "state",
    color_scale: raw.colorScale || "sequential",
    show_labels: typeof raw.showLabels === "boolean" ? raw.showLabels : true,
    show_legend: typeof raw.showLegend === "boolean" ? raw.showLegend : true,
    aggregation_method: raw.aggregationMethod || "sum",
  };
}

const HeatMapStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as IHeatMapStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.geographicArea,
    raw.metricValue,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [raw.colorScale, raw.showLabels, raw.showLegend, raw.aggregationMethod],
  );

  const previewSeedKey = `${component.id}|heatmap|${visualConfig.color_scale}|${visualConfig.show_labels}|${visualConfig.show_legend}`;
  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generateHeatMapPreviewData,
    draw: drawHeatMapFrame,
  });

  return (
    <StoryCanvasPreviewShell
      title={raw.title || "Heat Map Story"}
      titleColor={theme.textColor}
      configured={configured}
      unconfiguredMessage="Bind a table and map geographic area and metric fields to render this visualization"
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
      shellMinHeightPx={340}
    />
  );
};

export default HeatMapStoryRenderer;
