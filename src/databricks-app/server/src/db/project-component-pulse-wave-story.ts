import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  classifyChartColumnType,
  readChartBinding,
} from "../generation/preview-chart-bindings.ts";

const PROPERTY_NAMES = [
  "title", "metricName", "timeField", "metricValue", "baselineValue", "eventName",
  "eventType", "impactScore", "aggregationMethod", "showBaseline", "showEvents",
  "showAnomalyMarkers", "fillUnderWave",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const DIMENSION_TRANSFORMS = new Set(["none"]);
const MEASURE_TRANSFORMS = new Set([
  "none", "sum", "avg", "min", "max", "count", "count_distinct",
]);
const DIMENSION_AXES = ["timeField", "eventName", "eventType"] as const;
const MEASURE_AXES = ["metricValue", "baselineValue", "impactScore"] as const;
const AXIS_NAMES = [...DIMENSION_AXES, ...MEASURE_AXES] as const;
const MEASURE_AXIS_NAMES = new Set<string>(MEASURE_AXES);

type PulseWaveAxisName = (typeof AXIS_NAMES)[number];
type ErrorFactory = (detail: string) => Error;

/** Validated PulseWaveStory field mapping. */
export interface PulseWaveStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Saveable PulseWaveStory mappings and visualization settings. */
export interface PulseWaveStoryProperties {
  title: string;
  metricName: string;
  timeField: PulseWaveStoryAxis;
  metricValue: PulseWaveStoryAxis;
  baselineValue: PulseWaveStoryAxis;
  eventName: PulseWaveStoryAxis;
  eventType: PulseWaveStoryAxis;
  impactScore: PulseWaveStoryAxis;
  aggregationMethod: "sum" | "avg" | "max" | "min";
  showBaseline: boolean;
  showEvents: boolean;
  showAnomalyMarkers: boolean;
  fillUnderWave: boolean;
}

/** Validates PulseWaveStory settings during save and portable import. */
export function validatePulseWaveStoryProperties(properties: ProjectJsonObject): void {
  readPulseWaveStoryProperties(properties);
}

/** Parses persisted settings again before source generation. */
export function readPulseWaveStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): PulseWaveStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory("PulseWaveStory contains an unsupported property.");
  }

  const axes = {} as Record<PulseWaveAxisName, PulseWaveStoryAxis>;
  for (const name of DIMENSION_AXES) {
    axes[name] = readAxis(properties[name], "categorical", DIMENSION_TRANSFORMS, errorFactory);
  }
  for (const name of MEASURE_AXES) {
    axes[name] = readAxis(properties[name], "continuous", MEASURE_TRANSFORMS, errorFactory);
  }

  return {
    title: readText(properties.title, "Pulse Wave Story", 500, errorFactory),
    metricName: readText(properties.metricName, "Metric", 500, errorFactory),
    ...axes,
    aggregationMethod: readEnum(properties.aggregationMethod, "sum", ["sum", "avg", "max", "min"], errorFactory),
    showBaseline: readBoolean(properties.showBaseline, true, errorFactory),
    showEvents: readBoolean(properties.showEvents, true, errorFactory),
    showAnomalyMarkers: readBoolean(properties.showAnomalyMarkers, true, errorFactory),
    fillUnderWave: readBoolean(properties.fillUnderWave, true, errorFactory),
  };
}

/** Validates mapped columns against metadata from the selected current-workspace table. */
export function validatePulseWaveStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): void {
  const binding = readChartBinding(bindings, errorFactory);
  if (binding.kind !== "unityCatalogTable") {
    return;
  }

  const story = readPulseWaveStoryProperties(properties, errorFactory);
  for (const name of AXIS_NAMES) {
    const axis = story[name];
    if (axis.field === "") {
      continue;
    }
    const column = binding.columns.find((candidate) => candidate.name === axis.field);
    if (column === undefined) {
      throw errorFactory("PulseWaveStory mapping references a column outside the selected table.");
    }
    if (MEASURE_AXIS_NAMES.has(name)) {
      validateMeasureType(name, axis.transform, story.aggregationMethod, column.type, errorFactory);
    }
  }
}

function validateMeasureType(
  name: PulseWaveAxisName,
  transform: string,
  aggregationMethod: PulseWaveStoryProperties["aggregationMethod"],
  columnType: string | null,
  errorFactory: ErrorFactory,
): void {
  const fallback = name === "metricValue" ? aggregationMethod : "avg";
  const resolvedTransform = transform === "none" ? fallback : transform;
  const columnKind = classifyChartColumnType(columnType);
  if (columnKind !== "unknown" && columnKind !== "numeric" &&
      resolvedTransform !== "count" && resolvedTransform !== "count_distinct") {
    throw errorFactory("PulseWaveStory metric and baseline values require numeric columns or a count aggregate.");
  }
}

function readAxis(
  value: unknown,
  scaleType: "categorical" | "continuous",
  transforms: Set<string>,
  errorFactory: ErrorFactory,
): PulseWaveStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType, transform: "none" };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory("PulseWaveStory contains an invalid field mapping.");
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  if (value.scaleType !== undefined && value.scaleType !== null && value.scaleType !== scaleType) {
    throw errorFactory("PulseWaveStory field mapping has an incompatible scale.");
  }
  const transform = value.transform ?? "none";
  if (typeof transform !== "string" || !transforms.has(transform)) {
    throw errorFactory("PulseWaveStory field mapping has an unsupported transform.");
  }
  return { field, displayName, scaleType, transform };
}

function readText(value: unknown, fallback: string, maximumLength: number, errorFactory: ErrorFactory): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    typeof value !== "string" || value.length > maximumLength || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw errorFactory("PulseWaveStory text is invalid.");
  }
  return value;
}

function readEnum<const TValue extends string>(
  value: unknown,
  fallback: TValue,
  allowed: readonly TValue[],
  errorFactory: ErrorFactory,
): TValue {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || !allowed.includes(value as TValue)) {
    throw errorFactory("PulseWaveStory aggregation method is unsupported.");
  }
  return value as TValue;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory("PulseWaveStory visual setting must be boolean.");
  }
  return value;
}
