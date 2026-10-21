import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  classifyChartColumnType,
  readChartBinding,
} from "../generation/preview-chart-bindings.ts";

const PROPERTY_NAMES = [
  "title", "journeyName", "stage", "timelineField", "progressPct", "metricValue",
  "targetDate", "actualDate", "status", "riskScore", "owner", "keyAchievement", "cost",
  "showLabels", "showRiskGlow", "showVariance", "spaceByTimeline",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const TRANSFORMS = new Set(["none", "sum", "avg", "min", "max", "count", "count_distinct"]);
const DIMENSION_TRANSFORMS = new Set(["none"]);
const DIMENSION_AXES = [
  "journeyName", "stage", "timelineField", "targetDate", "actualDate", "status", "owner", "keyAchievement",
] as const;
const MEASURE_AXES = ["progressPct", "metricValue", "riskScore", "cost"] as const;
const AXIS_NAMES = [...DIMENSION_AXES, ...MEASURE_AXES] as const;
const MEASURE_DEFAULTS: Record<(typeof MEASURE_AXES)[number], "sum" | "avg"> = {
  progressPct: "avg",
  metricValue: "sum",
  riskScore: "avg",
  cost: "sum",
};
type AxisName = (typeof AXIS_NAMES)[number];
type ErrorFactory = (detail: string) => Error;

/** A validated SpiralStory table field mapping. */
export interface SpiralStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Saveable SpiralStory mappings and visual settings. */
export interface SpiralStoryProperties {
  title: string;
  journeyName: SpiralStoryAxis;
  stage: SpiralStoryAxis;
  timelineField: SpiralStoryAxis;
  progressPct: SpiralStoryAxis;
  metricValue: SpiralStoryAxis;
  targetDate: SpiralStoryAxis;
  actualDate: SpiralStoryAxis;
  status: SpiralStoryAxis;
  riskScore: SpiralStoryAxis;
  owner: SpiralStoryAxis;
  keyAchievement: SpiralStoryAxis;
  cost: SpiralStoryAxis;
  showLabels: boolean;
  showRiskGlow: boolean;
  showVariance: boolean;
  spaceByTimeline: boolean;
}

/** Validates SpiralStory settings during save and portable import. */
export function validateSpiralStoryProperties(properties: ProjectJsonObject): void {
  readSpiralStoryProperties(properties);
}

/** Parses persisted settings again before source generation. */
export function readSpiralStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): SpiralStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory("SpiralStory contains an unsupported property.");
  }

  const axes = {} as Record<AxisName, SpiralStoryAxis>;
  for (const name of DIMENSION_AXES) {
    axes[name] = readAxis(properties[name], "categorical", "none", DIMENSION_TRANSFORMS, errorFactory);
  }
  for (const name of MEASURE_AXES) {
    axes[name] = readAxis(properties[name], "continuous", MEASURE_DEFAULTS[name], TRANSFORMS, errorFactory);
  }

  return {
    title: readText(properties.title, "Spiral Story", 500, errorFactory),
    ...axes,
    showLabels: readBoolean(properties.showLabels, true, errorFactory),
    showRiskGlow: readBoolean(properties.showRiskGlow, true, errorFactory),
    showVariance: readBoolean(properties.showVariance, true, errorFactory),
    spaceByTimeline: readBoolean(properties.spaceByTimeline, false, errorFactory),
  };
}

/** Validates saved mappings against the selected current-workspace table metadata. */
export function validateSpiralStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): void {
  const binding = readChartBinding(bindings, errorFactory);
  if (binding.kind !== "unityCatalogTable" || binding.columns.length === 0) {
    return;
  }

  const story = readSpiralStoryProperties(properties, errorFactory);
  for (const name of AXIS_NAMES) {
    const axis = story[name];
    if (axis.field === "") {
      continue;
    }
    const column = binding.columns.find((candidate) => candidate.name === axis.field);
    if (column === undefined) {
      throw errorFactory("SpiralStory mapping references a column outside the selected table.");
    }
    if (MEASURE_AXES.includes(name as (typeof MEASURE_AXES)[number])) {
      validateMeasure(axis, MEASURE_DEFAULTS[name as (typeof MEASURE_AXES)[number]], column.type, errorFactory);
    }
  }
}

function validateMeasure(
  axis: SpiralStoryAxis,
  noneFallback: string,
  columnType: string | null,
  errorFactory: ErrorFactory,
): void {
  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  const kind = classifyChartColumnType(columnType);
  const allowed = kind === "numeric"
    ? TRANSFORMS
    : kind === "temporal"
      ? new Set(["min", "max", "count", "count_distinct"])
      : kind === "categorical"
        ? new Set(["count", "count_distinct"])
        : null;
  if (allowed !== null && !allowed.has(transform)) {
    throw errorFactory("SpiralStory measure aggregation is incompatible with the mapped column type.");
  }
}

function readAxis(
  value: unknown,
  scaleType: "categorical" | "continuous",
  defaultTransform: string,
  transforms: Set<string>,
  errorFactory: ErrorFactory,
): SpiralStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory("SpiralStory contains an invalid field mapping.");
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  if (value.scaleType !== undefined && value.scaleType !== null && value.scaleType !== scaleType) {
    throw errorFactory("SpiralStory field mapping has an incompatible scale.");
  }
  const transform = value.transform ?? defaultTransform;
  if (typeof transform !== "string" || !transforms.has(transform)) {
    throw errorFactory("SpiralStory field mapping has an unsupported aggregation.");
  }
  return { field, displayName, scaleType, transform };
}

function readText(value: unknown, fallback: string, maximumLength: number, errorFactory: ErrorFactory): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || value.length > maximumLength || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw errorFactory("SpiralStory text is invalid.");
  }
  return value;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory("SpiralStory visual setting must be boolean.");
  }
  return value;
}
