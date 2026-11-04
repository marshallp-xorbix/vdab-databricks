import type { ProjectJsonObject } from "../models/ProjectComponents";

export type PulseWaveStoryAxisName =
  | "timeField"
  | "metricValue"
  | "baselineValue"
  | "eventName"
  | "eventType"
  | "impactScore";

export interface PulseWaveStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

export interface PulseWaveStoryAxisDefinition {
  name: PulseWaveStoryAxisName;
  label: string;
  required: boolean;
  scaleType: "categorical" | "continuous";
  defaultTransform: string;
  transforms: readonly string[];
}

const DIMENSION_TRANSFORMS = ["none"] as const;
const MEASURE_TRANSFORMS = ["none", "sum", "avg", "min", "max", "count", "count_distinct"] as const;

/** Legacy PulseWaveStory roles and allowed aggregation transforms. */
export const PULSE_WAVE_STORY_AXES: readonly PulseWaveStoryAxisDefinition[] = [
  { name: "timeField", label: "Time period", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "metricValue", label: "Metric value", required: true, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "baselineValue", label: "Baseline / target", required: true, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "eventName", label: "Event name", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "eventType", label: "Event type", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "impactScore", label: "Impact score", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
];

/** Returns an editable axis view while preserving safe saved field selections. */
export function readPulseWaveStoryAxis(
  value: unknown,
  definition: PulseWaveStoryAxisDefinition,
): PulseWaveStoryAxisConfiguration {
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

/** Creates the canonical defaults for a new PulseWaveStory. */
export function createPulseWaveStoryProperties(): ProjectJsonObject {
  const axes: ProjectJsonObject = {};
  for (const definition of PULSE_WAVE_STORY_AXES) {
    axes[definition.name] = {
      field: "",
      displayName: "",
      scaleType: definition.scaleType,
      transform: definition.defaultTransform,
    };
  }
  return {
    title: "Pulse Wave Story",
    metricName: "Metric",
    ...axes,
    aggregationMethod: "sum",
    showBaseline: true,
    showEvents: true,
    showAnomalyMarkers: true,
    fillUnderWave: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
