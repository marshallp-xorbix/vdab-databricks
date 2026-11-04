import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  classifyChartColumnType,
  readChartBinding,
} from "../generation/preview-chart-bindings.ts";

const PROPERTY_NAMES = [
  "title", "itemName", "impactScore", "priorityLevel", "progressPct", "category",
  "timeField", "trend", "riskScore", "owner", "dueDate", "investment",
  "benefitValue", "notes", "status", "showLabels", "showRiskBorders", "showTrendArrows",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const DIMENSION_TRANSFORMS = new Set(["none"]);
const MEASURE_TRANSFORMS = new Set(["none", "sum", "avg", "min", "max", "count", "count_distinct"]);
const TEMPORAL_TRANSFORMS = new Set(["min", "max", "count", "count_distinct"]);
const CATEGORICAL_TRANSFORMS = new Set(["count", "count_distinct"]);

type HoneycombAxisName =
  | "itemName" | "impactScore" | "priorityLevel" | "progressPct" | "category"
  | "timeField" | "trend" | "riskScore" | "owner" | "dueDate" | "investment"
  | "benefitValue" | "notes" | "status";
type ErrorFactory = (detail: string) => Error;

/** Validated HoneycombStory field mapping. */
export interface HoneycombStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Saveable HoneycombStory mappings and visual settings. */
export interface HoneycombStoryProperties {
  title: string;
  itemName: HoneycombStoryAxis;
  impactScore: HoneycombStoryAxis;
  priorityLevel: HoneycombStoryAxis;
  progressPct: HoneycombStoryAxis;
  category: HoneycombStoryAxis;
  timeField: HoneycombStoryAxis;
  trend: HoneycombStoryAxis;
  riskScore: HoneycombStoryAxis;
  owner: HoneycombStoryAxis;
  dueDate: HoneycombStoryAxis;
  investment: HoneycombStoryAxis;
  benefitValue: HoneycombStoryAxis;
  notes: HoneycombStoryAxis;
  status: HoneycombStoryAxis;
  showLabels: boolean;
  showRiskBorders: boolean;
  showTrendArrows: boolean;
}

/** Validates HoneycombStory settings during component save and portable import. */
export function validateHoneycombStoryProperties(properties: ProjectJsonObject): void {
  readHoneycombStoryProperties(properties);
}

/** Parses settings again before source generation, rejecting malformed saved state. */
export function readHoneycombStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): HoneycombStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory("HoneycombStory contains an unsupported property.");
  }

  const axes: Record<HoneycombAxisName, HoneycombStoryAxis> = {
    itemName: readAxis(properties.itemName, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    impactScore: readAxis(properties.impactScore, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    priorityLevel: readAxis(properties.priorityLevel, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    progressPct: readAxis(properties.progressPct, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    category: readAxis(properties.category, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    timeField: readAxis(properties.timeField, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    trend: readAxis(properties.trend, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    riskScore: readAxis(properties.riskScore, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    owner: readAxis(properties.owner, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    dueDate: readAxis(properties.dueDate, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    investment: readAxis(properties.investment, "continuous", "sum", MEASURE_TRANSFORMS, errorFactory),
    benefitValue: readAxis(properties.benefitValue, "continuous", "sum", MEASURE_TRANSFORMS, errorFactory),
    notes: readAxis(properties.notes, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    status: readAxis(properties.status, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
  };

  return {
    title: readText(properties.title, "Honeycomb Story", 500, errorFactory),
    ...axes,
    showLabels: readBoolean(properties.showLabels, true, errorFactory),
    showRiskBorders: readBoolean(properties.showRiskBorders, true, errorFactory),
    showTrendArrows: readBoolean(properties.showTrendArrows, true, errorFactory),
  };
}

/** Validates mapped columns against metadata returned by the selected table. */
export function validateHoneycombStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): void {
  const binding = readChartBinding(bindings, errorFactory);
  if (binding.kind !== "unityCatalogTable" || binding.columns.length === 0) {
    return;
  }

  const story = readHoneycombStoryProperties(properties, errorFactory);
  const dimensions = [
    story.itemName, story.priorityLevel, story.category, story.timeField, story.trend,
    story.owner, story.dueDate, story.notes, story.status,
  ];
  for (const axis of dimensions) {
    requireDimension(axis, binding.columns, errorFactory);
  }
  requireMeasure(story.impactScore, binding.columns, "avg", errorFactory);
  requireMeasure(story.progressPct, binding.columns, "avg", errorFactory);
  requireMeasure(story.riskScore, binding.columns, "avg", errorFactory);
  requireMeasure(story.investment, binding.columns, "sum", errorFactory);
  requireMeasure(story.benefitValue, binding.columns, "sum", errorFactory);
}

function readAxis(
  value: unknown,
  scaleType: "categorical" | "continuous",
  defaultTransform: string,
  transforms: Set<string>,
  errorFactory: ErrorFactory,
): HoneycombStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory("HoneycombStory contains an invalid field mapping.");
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  if (value.scaleType !== undefined && value.scaleType !== null && value.scaleType !== scaleType) {
    throw errorFactory("HoneycombStory field mapping has an incompatible scale.");
  }
  const transform = value.transform ?? defaultTransform;
  if (typeof transform !== "string" || !transforms.has(transform)) {
    throw errorFactory("HoneycombStory field mapping has an unsupported aggregate.");
  }
  return { field, displayName, scaleType, transform };
}

function requireDimension(
  axis: HoneycombStoryAxis,
  columns: Array<{ name: string; type: string | null }>,
  errorFactory: ErrorFactory,
): void {
  if (axis.field === "") {
    return;
  }
  if (!columns.some((candidate) => candidate.name === axis.field)) {
    throw errorFactory("HoneycombStory mapping references a column outside the selected table.");
  }
}

function requireMeasure(
  axis: HoneycombStoryAxis,
  columns: Array<{ name: string; type: string | null }>,
  noneFallback: string,
  errorFactory: ErrorFactory,
): void {
  if (axis.field === "") {
    return;
  }
  const column = columns.find((candidate) => candidate.name === axis.field);
  if (column === undefined) {
    throw errorFactory("HoneycombStory mapping references a column outside the selected table.");
  }
  const category = classifyChartColumnType(column.type);
  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  const allowed = category === "numeric"
    ? MEASURE_TRANSFORMS
    : category === "temporal"
      ? TEMPORAL_TRANSFORMS
      : category === "categorical"
        ? CATEGORICAL_TRANSFORMS
        : null;
  if (allowed !== null && !allowed.has(transform)) {
    throw errorFactory("HoneycombStory aggregate is incompatible with the mapped column type.");
  }
}

function readText(value: unknown, fallback: string, maximumLength: number, errorFactory: ErrorFactory): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || value.length > maximumLength || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw errorFactory("HoneycombStory text is invalid.");
  }
  return value;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory("HoneycombStory visual setting must be boolean.");
  }
  return value;
}
