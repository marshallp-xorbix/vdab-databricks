import type { ProjectJsonObject } from "../models/ProjectComponents";

export type HoneycombStoryAxisName =
  | "itemName" | "impactScore" | "priorityLevel" | "progressPct" | "category"
  | "timeField" | "trend" | "riskScore" | "owner" | "dueDate" | "investment"
  | "benefitValue" | "notes" | "status";

export interface HoneycombStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

export interface HoneycombStoryAxisDefinition {
  name: HoneycombStoryAxisName;
  label: string;
  required: boolean;
  scaleType: "categorical" | "continuous";
  defaultTransform: string;
  transforms: readonly string[];
}

const DIMENSION_TRANSFORMS = ["none"] as const;
const MEASURE_TRANSFORMS = ["none", "sum", "avg", "min", "max", "count", "count_distinct"] as const;

/** Legacy HoneycombStory field roles and their supported transforms. */
export const HONEYCOMB_STORY_AXES: readonly HoneycombStoryAxisDefinition[] = [
  { name: "itemName", label: "Item name", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "impactScore", label: "Impact score", required: true, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "priorityLevel", label: "Priority level", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "progressPct", label: "Progress %", required: true, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "category", label: "Category / pillar", required: true, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "timeField", label: "Time field", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "trend", label: "Trend", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "riskScore", label: "Risk score", required: false, scaleType: "continuous", defaultTransform: "avg", transforms: MEASURE_TRANSFORMS },
  { name: "owner", label: "Owner", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "dueDate", label: "Due date", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "investment", label: "Investment", required: false, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "benefitValue", label: "Benefit value", required: false, scaleType: "continuous", defaultTransform: "sum", transforms: MEASURE_TRANSFORMS },
  { name: "notes", label: "Notes", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
  { name: "status", label: "Status", required: false, scaleType: "categorical", defaultTransform: "none", transforms: DIMENSION_TRANSFORMS },
];

/** Returns a safe editable axis view while preserving persisted user selections. */
export function readHoneycombStoryAxis(
  value: unknown,
  definition: HoneycombStoryAxisDefinition,
): HoneycombStoryAxisConfiguration {
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

/** Builds the canonical defaults used by the HoneycombStory editor. */
export function createHoneycombStoryProperties(): ProjectJsonObject {
  const axes: ProjectJsonObject = {};
  for (const definition of HONEYCOMB_STORY_AXES) {
    axes[definition.name] = {
      field: "",
      displayName: "",
      scaleType: definition.scaleType,
      transform: definition.defaultTransform,
    };
  }
  return {
    title: "Honeycomb Story",
    ...axes,
    showLabels: true,
    showRiskBorders: true,
    showTrendArrows: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
