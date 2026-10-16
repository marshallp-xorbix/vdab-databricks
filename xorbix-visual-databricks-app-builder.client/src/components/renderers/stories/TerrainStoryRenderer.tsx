import { useMemo, type FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import {
  drawTerrainFrame,
  type ITerrainVisualConfig,
} from "./terrainCanvasDraw";
import { generateTerrainPreviewData } from "./generateTerrainPreviewData";
import { hasRequiredAxisFields } from "./hasRequiredAxisFields";
import StoryCanvasPreviewShell from "./StoryCanvasPreviewShell";
import { useStoryCanvasPreview } from "./useStoryCanvasPreview";

interface ITerrainStoryRendererPropsRaw {
  title?: string;
  xDimension?: unknown;
  yDimension?: unknown;
  heightMetric?: unknown;
  terrainMode?: string;
  colorBy?: string;
  heightScale?: number;
  showPeakLabels?: boolean;
  showValleyLabels?: boolean;
  interpolation?: string;
  gridResolution?: number;
  cameraPreset?: string;
}

const PREVIEW_HEIGHT_PX = 300;

function buildVisualConfig(
  raw: ITerrainStoryRendererPropsRaw,
): ITerrainVisualConfig {
  return {
    terrain_mode: raw.terrainMode || "surface",
    color_by: raw.colorBy || "height_metric",
    height_scale: typeof raw.heightScale === "number" ? raw.heightScale : 1,
    show_peak_labels:
      typeof raw.showPeakLabels === "boolean" ? raw.showPeakLabels : true,
    show_valley_labels:
      typeof raw.showValleyLabels === "boolean" ? raw.showValleyLabels : true,
    interpolation: raw.interpolation || "bilinear",
    grid_resolution:
      typeof raw.gridResolution === "number" ? raw.gridResolution : 60,
    camera_preset: raw.cameraPreset || "angled",
  };
}

const TerrainStoryRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const raw = component.props as ITerrainStoryRendererPropsRaw;
  const configured = hasRequiredAxisFields(
    raw.xDimension,
    raw.yDimension,
    raw.heightMetric,
  );

  const visualConfig = useMemo(
    () => buildVisualConfig(raw),
    [
      raw.terrainMode,
      raw.colorBy,
      raw.heightScale,
      raw.showPeakLabels,
      raw.showValleyLabels,
      raw.interpolation,
      raw.gridResolution,
      raw.cameraPreset,
    ],
  );

  const previewSeedKey = `${component.id}|terrain|${visualConfig.terrain_mode}|${visualConfig.color_by}|${visualConfig.interpolation}|${visualConfig.grid_resolution}|${visualConfig.camera_preset}`;
  const canvasRef = useStoryCanvasPreview({
    configured,
    previewHeightPx: PREVIEW_HEIGHT_PX,
    visualConfig,
    previewSeedKey,
    generatePayload: generateTerrainPreviewData,
    draw: drawTerrainFrame,
  });

  return (
    <StoryCanvasPreviewShell
      title={raw.title || "Terrain Story"}
      titleColor={theme.textColor}
      configured={configured}
      unconfiguredMessage="Bind a table and map X, Y, and height fields to render this visualization"
      canvasRef={canvasRef}
      previewHeightPx={PREVIEW_HEIGHT_PX}
      shellMinHeightPx={340}
    />
  );
};

export default TerrainStoryRenderer;
