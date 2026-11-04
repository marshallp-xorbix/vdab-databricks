import type { ProjectJsonObject } from "../models/ProjectComponents";

export type FlowFieldStoryAxisName =
  | "sourceStage"
  | "destinationStage"
  | "flowVolume"
  | "stageOrder"
  | "timeField"
  | "conversionPct"
  | "dropOffCount"
  | "avgTimeInStage"
  | "status";

export interface FlowFieldStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

export interface FlowFieldStoryAxisDefinition {
  name: FlowFieldStoryAxisName;
  label: string;
  scaleType: "categorical" | "continuous";
  defaultTransform: string;
  transforms: string[];
  required: boolean;
}

export const FLOW_FIELD_STORY_AXES: FlowFieldStoryAxisDefinition[] = [
  { name: "sourceStage", label: "Source stage", scaleType: "categorical", defaultTransform: "none", transforms: ["none"], required: true },
  { name: "destinationStage", label: "Destination stage", scaleType: "categorical", defaultTransform: "none", transforms: ["none"], required: true },
  { name: "flowVolume", label: "Flow volume", scaleType: "continuous", defaultTransform: "sum", transforms: ["none", "sum", "avg", "min", "max", "count", "count_distinct"], required: true },
  { name: "stageOrder", label: "Stage order", scaleType: "continuous", defaultTransform: "max", transforms: ["none", "sum", "avg", "min", "max", "count", "count_distinct"], required: true },
  { name: "timeField", label: "Latest-period time field", scaleType: "categorical", defaultTransform: "none", transforms: ["none"], required: false },
  { name: "conversionPct", label: "Conversion percentage", scaleType: "continuous", defaultTransform: "avg", transforms: ["none", "sum", "avg", "min", "max", "count", "count_distinct"], required: false },
  { name: "dropOffCount", label: "Drop-off count", scaleType: "continuous", defaultTransform: "sum", transforms: ["none", "sum", "avg", "min", "max", "count", "count_distinct"], required: false },
  { name: "avgTimeInStage", label: "Average time in stage", scaleType: "continuous", defaultTransform: "avg", transforms: ["none", "sum", "avg", "min", "max", "count", "count_distinct"], required: false },
  { name: "status", label: "Status", scaleType: "categorical", defaultTransform: "none", transforms: ["none"], required: false },
];

/** Reads a story axis from untrusted saved JSON while preserving its role defaults. */
export function readFlowFieldStoryAxis(
  value: ProjectJsonObject[string] | undefined,
  definition: FlowFieldStoryAxisDefinition,
): FlowFieldStoryAxisConfiguration {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createDefaultAxis(definition);
  }
  const candidate = value as ProjectJsonObject;
  const field = typeof candidate.field === "string" ? candidate.field : "";
  const displayName = typeof candidate.displayName === "string" ? candidate.displayName : "";
  const transform = typeof candidate.transform === "string" && definition.transforms.includes(candidate.transform)
    ? candidate.transform
    : definition.defaultTransform;
  return {
    field,
    displayName,
    scaleType: definition.scaleType,
    transform,
  };
}

function createDefaultAxis(definition: FlowFieldStoryAxisDefinition): FlowFieldStoryAxisConfiguration {
  return {
    field: "",
    displayName: "",
    scaleType: definition.scaleType,
    transform: definition.defaultTransform,
  };
}
