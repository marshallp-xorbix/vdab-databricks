import type { ProjectJsonObject } from "../models/ProjectComponents";

export type SpiralStoryAxisName =
  | "journeyName" | "stage" | "timelineField" | "progressPct" | "metricValue"
  | "targetDate" | "actualDate" | "status" | "riskScore" | "owner" | "keyAchievement" | "cost";

export interface SpiralStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

export interface SpiralStoryAxisDefinition {
  name: SpiralStoryAxisName;
  label: string;
  required: boolean;
  scaleType: "categorical" | "continuous";
  defaultTransform: string;
  transforms: readonly string[];
}

const DIMENSION_TRANSFORMS = ["none"] as const;
const MEASURE_TRANSFORMS = ["none", "sum", "avg", "min", "max", "count", "count_distinct"] as const;

/** Legacy SpiralStory roles and supported aggregations. */
export const SPIRAL_STORY_AXES: readonly SpiralStoryAxisDefinition[] = [
  { name: "journeyName", label: "Journey name", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "stage", label: "Stage / milestone", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "timelineField", label: "Timeline", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "progressPct", label: "Progress %", required: true, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "metricValue", label: "Metric value", required: true, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "targetDate", label: "Target date", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "actualDate", label: "Actual date", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "status", label: "Status", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "riskScore", label: "Risk score", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "owner", label: "Owner", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "keyAchievement", label: "Key achievement", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "cost", label: "Cost", required: false, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
];

/** Returns an editable axis while preserving safe saved selections. */
export function readSpiralStoryAxis(
  value: unknown,
  definition: SpiralStoryAxisDefinition,
): SpiralStoryAxisConfiguration {
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

/** Creates the defaults for a new SpiralStory. */
export function createSpiralStoryProperties(): ProjectJsonObject {
  const axes: ProjectJsonObject = {};
  for (const definition of SPIRAL_STORY_AXES) {
    axes[definition.name] = {
      field: "",
      displayName: "",
      scaleType: definition.scaleType,
      transform: definition.defaultTransform,
    };
  }
  return {
    title: "Spiral Story",
    ...axes,
    showLabels: true,
    showRiskGlow: true,
    showVariance: true,
    spaceByTimeline: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
