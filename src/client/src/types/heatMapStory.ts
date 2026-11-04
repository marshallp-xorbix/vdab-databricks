import type { ProjectJsonObject } from "../models/ProjectComponents";

export type HeatMapStoryAxisName =
  | "geographicArea"
  | "metricValue"
  | "timeField"
  | "secondaryMetric"
  | "changePct"
  | "targetValue"
  | "riskScore"
  | "category"
  | "forecastValue"
  | "notes";

export interface HeatMapStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

export interface HeatMapStoryAxisDefinition {
  name: HeatMapStoryAxisName;
  label: string;
  required: boolean;
  scaleType: "categorical" | "continuous";
  defaultTransform: string;
  transforms: readonly string[];
}

const DIMENSION_TRANSFORMS = ["none"] as const;
const MEASURE_TRANSFORMS = ["none", "sum", "avg", "min", "max", "count", "count_distinct"] as const;

export const HEAT_MAP_STORY_AXES: readonly HeatMapStoryAxisDefinition[] = [
  { name: "geographicArea", label: "Geographic area", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "metricValue", label: "Metric value", required: true, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "timeField", label: "Time field", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "secondaryMetric", label: "Secondary metric", required: false, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "changePct", label: "Change %", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "targetValue", label: "Target value", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "riskScore", label: "Risk score", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "category", label: "Category / segment", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "forecastValue", label: "Forecast value", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "notes", label: "Notes", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
];

/** Returns a safe editable axis view while preserving persisted user selections. */
export function readHeatMapStoryAxis(
  value: unknown,
  definition: HeatMapStoryAxisDefinition,
): HeatMapStoryAxisConfiguration {
  const axis = isRecord(value) ? value : {};
  const field = typeof axis.field === "string" ? axis.field : "";
  const displayName = typeof axis.displayName === "string" ? axis.displayName : "";
  const transform = typeof axis.transform === "string" && definition.transforms.includes(axis.transform)
    ? axis.transform
    : definition.defaultTransform;
  return {
    field,
    displayName,
    scaleType: definition.scaleType,
    transform,
  };
}

/** Builds the canonical default property set used by the HeatMapStory editor. */
export function createHeatMapStoryProperties(): ProjectJsonObject {
  const axes: ProjectJsonObject = {};
  for (const definition of HEAT_MAP_STORY_AXES) {
    axes[definition.name] = {
      field: "",
      displayName: "",
      scaleType: definition.scaleType,
      transform: definition.defaultTransform,
    };
  }
  return {
    title: "Heat Map Story",
    ...axes,
    mapScope: "usa",
    geographicLevel: "state",
    colorScale: "sequential",
    showLabels: true,
    showLegend: true,
    aggregationMethod: "sum",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
