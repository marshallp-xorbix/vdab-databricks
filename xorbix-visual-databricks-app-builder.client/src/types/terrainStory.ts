import type { ProjectJsonObject } from "../models/ProjectComponents";

export type TerrainStoryAxisName =
  | "xDimension" | "yDimension" | "heightMetric" | "timeField" | "terrainCategory" | "riskScore"
  | "targetValue" | "baselineValue" | "forecastValue" | "volumeMetric" | "status" | "eventName"
  | "eventDate" | "calloutText";

export interface TerrainStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

export interface TerrainStoryAxisDefinition {
  name: TerrainStoryAxisName;
  label: string;
  required: boolean;
  scaleType: "categorical" | "continuous";
  defaultTransform: string;
  transforms: readonly string[];
}

const DIMENSION_TRANSFORMS = ["none"] as const;
const MEASURE_TRANSFORMS = ["none", "sum", "avg", "min", "max", "count", "count_distinct"] as const;

/** Legacy TerrainStory roles and supported aggregation choices. */
export const TERRAIN_STORY_AXES: readonly TerrainStoryAxisDefinition[] = [
  { name: "xDimension", label: "X dimension", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "yDimension", label: "Y dimension", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "heightMetric", label: "Height metric", required: true, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "timeField", label: "Time field", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "terrainCategory", label: "Terrain category", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "riskScore", label: "Risk score", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "targetValue", label: "Target value", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "baselineValue", label: "Baseline value", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "forecastValue", label: "Forecast value", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "volumeMetric", label: "Volume metric", required: false, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "status", label: "Status", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "eventName", label: "Event name", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "eventDate", label: "Event date", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "calloutText", label: "Callout text", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
];

/** Reads an editable axis while preserving safe saved choices. */
export function readTerrainStoryAxis(
  value: unknown,
  definition: TerrainStoryAxisDefinition,
): TerrainStoryAxisConfiguration {
  const axis = isRecord(value) ? value : {};
  const transform = typeof axis.transform === "string" && definition.transforms.includes(axis.transform)
    ? axis.transform
    : definition.defaultTransform;
  return {
    field: typeof axis.field === "string" ? axis.field : "",
    displayName: typeof axis.displayName === "string" ? axis.displayName : "",
    scaleType: definition.scaleType,
    transform,
  };
}

/** Creates the defaults for a new TerrainStory. */
export function createTerrainStoryProperties(): ProjectJsonObject {
  const axes: ProjectJsonObject = {};
  for (const definition of TERRAIN_STORY_AXES) {
    axes[definition.name] = {
      field: "",
      displayName: "",
      scaleType: definition.scaleType,
      transform: definition.defaultTransform,
    };
  }
  return {
    title: "Terrain Story",
    ...axes,
    terrainMode: "surface",
    heightScale: 1,
    interpolation: "bilinear",
    gridResolution: 60,
    colorBy: "height_metric",
    showPeakLabels: true,
    showValleyLabels: true,
    cameraPreset: "angled",
    aggregationMethod: "sum",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
