/** Property keys used by the AmoebaStory data-role editor. */
export type AmoebaStoryAxisName =
  | "entityId"
  | "entityLabel"
  | "category"
  | "sizeMetric"
  | "xMetric"
  | "yMetric"
  | "changeMetric"
  | "timeField"
  | "healthScore"
  | "riskScore";

/** Client-side axis configuration shape persisted in project component JSON. */
export interface IAmoebaStoryAxisConfiguration {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Presentation and validation defaults for one legacy story role. */
export interface IAmoebaStoryAxisDefinition {
  name: AmoebaStoryAxisName;
  label: string;
  scaleType: "categorical" | "continuous";
  transform: string;
  required: boolean;
  transforms: string[];
}

const DIMENSION_TRANSFORMS = ["none", "sum", "avg", "count", "count_distinct", "min", "max"];
const MEASURE_TRANSFORMS = ["sum", "avg", "count", "count_distinct", "min", "max"];

/** Required and optional data roles in the legacy story query. */
export const AMOEBA_STORY_AXES: IAmoebaStoryAxisDefinition[] = [
  { name: "entityId", label: "Entity ID", scaleType: "categorical", transform: "none", required: true, transforms: ["none"] },
  { name: "entityLabel", label: "Entity label", scaleType: "categorical", transform: "none", required: true, transforms: DIMENSION_TRANSFORMS },
  { name: "category", label: "Category", scaleType: "categorical", transform: "none", required: true, transforms: DIMENSION_TRANSFORMS },
  { name: "sizeMetric", label: "Size", scaleType: "continuous", transform: "sum", required: true, transforms: MEASURE_TRANSFORMS },
  { name: "xMetric", label: "X position", scaleType: "continuous", transform: "avg", required: true, transforms: MEASURE_TRANSFORMS },
  { name: "yMetric", label: "Y position", scaleType: "continuous", transform: "avg", required: true, transforms: MEASURE_TRANSFORMS },
  { name: "changeMetric", label: "Change", scaleType: "continuous", transform: "avg", required: true, transforms: MEASURE_TRANSFORMS },
  { name: "timeField", label: "Time filter", scaleType: "categorical", transform: "none", required: false, transforms: ["none"] },
  { name: "healthScore", label: "Health score", scaleType: "continuous", transform: "avg", required: false, transforms: MEASURE_TRANSFORMS },
  { name: "riskScore", label: "Risk score", scaleType: "continuous", transform: "avg", required: false, transforms: MEASURE_TRANSFORMS },
];

/** Reads persisted Amoeba axis values with the same defaults used for new components. */
export function readAmoebaStoryAxis(
  value: unknown,
  definition: IAmoebaStoryAxisDefinition,
): IAmoebaStoryAxisConfiguration {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return emptyAmoebaStoryAxis(definition);
  }
  const candidate = value as Record<string, unknown>;
  return {
    field: typeof candidate.field === "string" ? candidate.field : "",
    displayName: typeof candidate.displayName === "string" ? candidate.displayName : "",
    scaleType: definition.scaleType,
    transform: typeof candidate.transform === "string" ? candidate.transform : definition.transform,
  };
}

function emptyAmoebaStoryAxis(
  definition: IAmoebaStoryAxisDefinition,
): IAmoebaStoryAxisConfiguration {
  return {
    field: "",
    displayName: "",
    scaleType: definition.scaleType,
    transform: definition.transform,
  };
}
