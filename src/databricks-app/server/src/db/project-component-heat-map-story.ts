import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  classifyChartColumnType,
  readChartBinding,
} from "../generation/preview-chart-bindings.ts";

const PROPERTY_NAMES = [
  "title", "geographicArea", "metricValue", "timeField", "secondaryMetric",
  "changePct", "targetValue", "riskScore", "category", "forecastValue", "notes",
  "mapScope", "geographicLevel", "colorScale", "showLabels", "showLegend",
  "aggregationMethod",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const DIMENSION_TRANSFORMS = new Set(["none"]);
const MEASURE_TRANSFORMS = new Set(["none", "sum", "avg", "min", "max", "count", "count_distinct"]);
const TEMPORAL_MEASURE_TRANSFORMS = new Set(["min", "max", "count", "count_distinct"]);
const CATEGORICAL_MEASURE_TRANSFORMS = new Set(["count", "count_distinct"]);
const MAP_SCOPES = new Set(["usa", "canada", "europe", "global", "custom"]);
const GEOGRAPHIC_LEVELS = new Set(["state", "country", "province", "county", "custom"]);
const COLOR_SCALES = new Set(["sequential", "diverging"]);
const AGGREGATION_METHODS = new Set(["sum", "avg", "max", "min"]);

type HeatMapAxisName =
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
type ErrorFactory = (detail: string) => Error;

/** Validated axis mapping used to generate HeatMapStory queries. */
export interface HeatMapStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Saveable HeatMapStory mappings and visual settings. */
export interface HeatMapStoryProperties {
  title: string;
  geographicArea: HeatMapStoryAxis;
  metricValue: HeatMapStoryAxis;
  timeField: HeatMapStoryAxis;
  secondaryMetric: HeatMapStoryAxis;
  changePct: HeatMapStoryAxis;
  targetValue: HeatMapStoryAxis;
  riskScore: HeatMapStoryAxis;
  category: HeatMapStoryAxis;
  forecastValue: HeatMapStoryAxis;
  notes: HeatMapStoryAxis;
  mapScope: string;
  geographicLevel: string;
  colorScale: "sequential" | "diverging";
  showLabels: boolean;
  showLegend: boolean;
  aggregationMethod: "sum" | "avg" | "max" | "min";
}

/** Validates HeatMapStory settings during component save and portable import. */
export function validateHeatMapStoryProperties(properties: ProjectJsonObject): void {
  readHeatMapStoryProperties(properties);
}

/** Parses settings again before source generation, rejecting malformed saved state. */
export function readHeatMapStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): HeatMapStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory("HeatMapStory contains an unsupported property.");
  }

  const axes: Record<HeatMapAxisName, HeatMapStoryAxis> = {
    geographicArea: readAxis(properties.geographicArea, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    metricValue: readAxis(properties.metricValue, "continuous", "sum", MEASURE_TRANSFORMS, errorFactory),
    timeField: readAxis(properties.timeField, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    secondaryMetric: readAxis(properties.secondaryMetric, "continuous", "sum", MEASURE_TRANSFORMS, errorFactory),
    changePct: readAxis(properties.changePct, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    targetValue: readAxis(properties.targetValue, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    riskScore: readAxis(properties.riskScore, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    category: readAxis(properties.category, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    forecastValue: readAxis(properties.forecastValue, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    notes: readAxis(properties.notes, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
  };

  return {
    title: readText(properties.title, "Heat Map Story", 500, errorFactory),
    ...axes,
    mapScope: readEnum(properties.mapScope, "usa", MAP_SCOPES, errorFactory),
    geographicLevel: readEnum(properties.geographicLevel, "state", GEOGRAPHIC_LEVELS, errorFactory),
    colorScale: readEnum(properties.colorScale, "sequential", COLOR_SCALES, errorFactory),
    showLabels: readBoolean(properties.showLabels, true, errorFactory),
    showLegend: readBoolean(properties.showLegend, true, errorFactory),
    aggregationMethod: readEnum(properties.aggregationMethod, "sum", AGGREGATION_METHODS, errorFactory),
  };
}

/** Validates mapped columns against metadata returned by the selected table. */
export function validateHeatMapStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): void {
  const binding = readChartBinding(bindings, errorFactory);
  if (binding.kind !== "unityCatalogTable" || binding.columns.length === 0) {
    return;
  }

  const story = readHeatMapStoryProperties(properties, errorFactory);
  const dimensions = [story.geographicArea, story.timeField, story.category, story.notes];
  for (const axis of dimensions) {
    requireDimension(axis, binding.columns, errorFactory);
  }
  requireMeasure(story.metricValue, binding.columns, story.aggregationMethod, errorFactory);
  requireMeasure(story.secondaryMetric, binding.columns, "sum", errorFactory);
  requireMeasure(story.changePct, binding.columns, "avg", errorFactory);
  requireMeasure(story.targetValue, binding.columns, "avg", errorFactory);
  requireMeasure(story.riskScore, binding.columns, "avg", errorFactory);
  requireMeasure(story.forecastValue, binding.columns, "avg", errorFactory);
}

function readAxis(
  value: unknown,
  defaultScale: "categorical" | "continuous",
  defaultTransform: string,
  transforms: Set<string>,
  errorFactory: ErrorFactory,
): HeatMapStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType: defaultScale, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory("HeatMapStory contains an invalid field mapping.");
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  if (value.scaleType !== undefined && value.scaleType !== null && value.scaleType !== defaultScale) {
    throw errorFactory("HeatMapStory field mapping has an incompatible scale.");
  }
  const transform = value.transform ?? defaultTransform;
  if (typeof transform !== "string" || !transforms.has(transform)) {
    throw errorFactory("HeatMapStory field mapping has an unsupported aggregate.");
  }
  return { field, displayName, scaleType: defaultScale, transform };
}

function requireDimension(
  axis: HeatMapStoryAxis,
  columns: Array<{ name: string; type: string | null }>,
  errorFactory: ErrorFactory,
): void {
  if (axis.field !== "" && !columns.some((column) => column.name === axis.field)) {
    throw errorFactory("HeatMapStory mapping references a column outside the selected table.");
  }
}

function requireMeasure(
  axis: HeatMapStoryAxis,
  columns: Array<{ name: string; type: string | null }>,
  noneFallback: string,
  errorFactory: ErrorFactory,
): void {
  if (axis.field === "") {
    return;
  }
  const column = columns.find((candidate) => candidate.name === axis.field);
  if (column === undefined) {
    throw errorFactory("HeatMapStory mapping references a column outside the selected table.");
  }
  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  const category = classifyChartColumnType(column.type);
  const allowed = category === "numeric"
    ? MEASURE_TRANSFORMS
    : category === "temporal"
      ? TEMPORAL_MEASURE_TRANSFORMS
      : category === "categorical"
        ? CATEGORICAL_MEASURE_TRANSFORMS
        : null;
  if (allowed !== null && !allowed.has(transform)) {
    throw errorFactory("HeatMapStory aggregate is incompatible with the mapped column type.");
  }
}

function readText(value: unknown, fallback: string, maximumLength: number, errorFactory: ErrorFactory): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || value.length > maximumLength || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw errorFactory("HeatMapStory text is invalid.");
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  fallback: T,
  allowed: Set<string>,
  errorFactory: ErrorFactory,
): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || !allowed.has(value)) {
    throw errorFactory("HeatMapStory visual setting is unsupported.");
  }
  return value as T;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory("HeatMapStory visual setting must be boolean.");
  }
  return value;
}
