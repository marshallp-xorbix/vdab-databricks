import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const PROPERTY_NAMES = [
  "title", "sourceStage", "destinationStage", "flowVolume", "stageOrder", "timeField",
  "conversionPct", "dropOffCount", "avgTimeInStage", "status", "showDropOffs", "showLabels",
];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const DIMENSION_TRANSFORMS = new Set(["none"]);
const MEASURE_TRANSFORMS = new Set(["none", "sum", "avg", "min", "max", "count", "count_distinct"]);
const TEMPORAL_MEASURE_TRANSFORMS = new Set(["min", "max", "count", "count_distinct"]);
const CATEGORICAL_MEASURE_TRANSFORMS = new Set(["count", "count_distinct"]);

type FlowFieldAxisName =
  | "sourceStage"
  | "destinationStage"
  | "flowVolume"
  | "stageOrder"
  | "timeField"
  | "conversionPct"
  | "dropOffCount"
  | "avgTimeInStage"
  | "status";

/** Validated property axis used by the FlowFieldStory query and editor contract. */
export interface FlowFieldStoryAxis {
  field: string;
  displayName: string;
  scaleType: "categorical" | "continuous";
  transform: string;
}

/** Saved data and visual settings for the FlowFieldStory renderer. */
export interface FlowFieldStoryProperties {
  title: string;
  sourceStage: FlowFieldStoryAxis;
  destinationStage: FlowFieldStoryAxis;
  flowVolume: FlowFieldStoryAxis;
  stageOrder: FlowFieldStoryAxis;
  timeField: FlowFieldStoryAxis;
  conversionPct: FlowFieldStoryAxis;
  dropOffCount: FlowFieldStoryAxis;
  avgTimeInStage: FlowFieldStoryAxis;
  status: FlowFieldStoryAxis;
  showDropOffs: boolean;
  showLabels: boolean;
}

type ErrorFactory = () => Error;

/** Validates FlowFieldStory settings at the component save and import boundary. */
export function validateFlowFieldStoryProperties(properties: ProjectJsonObject): void {
  readFlowFieldStoryProperties(properties);
}

/** Parses settings again before code generation, rejecting malformed persisted state. */
export function readFlowFieldStoryProperties(
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): FlowFieldStoryProperties {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw errorFactory();
  }

  const axes: Record<FlowFieldAxisName, FlowFieldStoryAxis> = {
    sourceStage: readAxis(properties.sourceStage, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    destinationStage: readAxis(properties.destinationStage, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    flowVolume: readAxis(properties.flowVolume, "continuous", "sum", MEASURE_TRANSFORMS, errorFactory),
    stageOrder: readAxis(properties.stageOrder, "continuous", "max", MEASURE_TRANSFORMS, errorFactory),
    timeField: readAxis(properties.timeField, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
    conversionPct: readAxis(properties.conversionPct, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    dropOffCount: readAxis(properties.dropOffCount, "continuous", "sum", MEASURE_TRANSFORMS, errorFactory),
    avgTimeInStage: readAxis(properties.avgTimeInStage, "continuous", "avg", MEASURE_TRANSFORMS, errorFactory),
    status: readAxis(properties.status, "categorical", "none", DIMENSION_TRANSFORMS, errorFactory),
  };

  return {
    title: readText(properties.title, "Flow Field Story", 500, errorFactory),
    ...axes,
    showDropOffs: readBoolean(properties.showDropOffs, true, errorFactory),
    showLabels: readBoolean(properties.showLabels, true, errorFactory),
  };
}

/** Validates mapped columns against selected Unity Catalog metadata when present. */
export function validateFlowFieldStoryBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  errorFactory: ErrorFactory = invalidComponents,
): void {
  const resource = readUnityCatalogResource(bindings);
  if (resource === null || resource.columns === undefined || resource.columns === null) {
    return;
  }
  if (!Array.isArray(resource.columns)) {
    throw errorFactory();
  }

  const columns = readColumns(resource.columns, errorFactory);
  if (columns.length === 0) {
    return;
  }
  const story = readFlowFieldStoryProperties(properties, errorFactory);
  for (const axisName of ["sourceStage", "destinationStage", "timeField", "status"] as const) {
    requireMappedColumn(story[axisName], columns, null, errorFactory);
  }
  requireMappedColumn(story.flowVolume, columns, "sum", errorFactory);
  requireMappedColumn(story.stageOrder, columns, "max", errorFactory);
  requireMappedColumn(story.conversionPct, columns, "avg", errorFactory);
  requireMappedColumn(story.dropOffCount, columns, "sum", errorFactory);
  requireMappedColumn(story.avgTimeInStage, columns, "avg", errorFactory);
}

function readAxis(
  value: unknown,
  defaultScale: "categorical" | "continuous",
  defaultTransform: string,
  transforms: Set<string>,
  errorFactory: ErrorFactory,
): FlowFieldStoryAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType: defaultScale, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw errorFactory();
  }
  const field = readText(value.field, "", 255, errorFactory);
  const displayName = readText(value.displayName, "", 500, errorFactory);
  if (value.scaleType !== undefined && value.scaleType !== null && value.scaleType !== defaultScale) {
    throw errorFactory();
  }
  const scaleType = defaultScale;
  const transform = value.transform ?? defaultTransform;
  if (
    typeof transform !== "string" || !transforms.has(transform)
  ) {
    throw errorFactory();
  }
  return { field, displayName, scaleType, transform };
}

function requireMappedColumn(
  axis: FlowFieldStoryAxis,
  columns: Array<{ name: string; type: string | null }>,
  noneFallback: string | null,
  errorFactory: ErrorFactory,
): void {
  if (axis.field === "") {
    return;
  }
  const column = columns.find((candidate) => candidate.name === axis.field);
  if (column === undefined || noneFallback === null) {
    if (column === undefined) {
      throw errorFactory();
    }
    return;
  }

  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  const category = classifyColumnType(column.type);
  const allowed = category === "numeric"
    ? MEASURE_TRANSFORMS
    : category === "temporal"
      ? TEMPORAL_MEASURE_TRANSFORMS
      : category === "categorical"
        ? CATEGORICAL_MEASURE_TRANSFORMS
        : null;
  if (allowed !== null && !allowed.has(transform)) {
    throw errorFactory();
  }
}

function classifyColumnType(type: string | null): "numeric" | "temporal" | "categorical" | "unknown" {
  const normalized = (type ?? "").trim().toUpperCase();
  if (/^(TINYINT|SMALLINT|INT|INTEGER|BIGINT|LONG|FLOAT|DOUBLE|DECIMAL|NUMERIC)(\b|\s*\()/.test(normalized)) {
    return "numeric";
  }
  if (/^(DATE|TIMESTAMP|TIMESTAMP_NTZ|TIME)(\b|\s*\()/.test(normalized)) {
    return "temporal";
  }
  if (/^(STRING|CHAR|VARCHAR|BOOLEAN|BOOL)(\b|\s*\()/.test(normalized)) {
    return "categorical";
  }
  return "unknown";
}

function readColumns(
  value: unknown[],
  errorFactory: ErrorFactory,
): Array<{ name: string; type: string | null }> {
  const columns = value.map((column) => {
    if (
      !isRecord(column) || hasUnexpectedProperties(column, ["name", "type", "dataType"]) ||
      typeof column.name !== "string" || column.name.length < 1 || column.name.length > 255 ||
      column.name.trim() !== column.name || /[\u0000-\u001f\u007f]/.test(column.name) ||
      (column.type !== undefined && column.type !== null && typeof column.type !== "string") ||
      (column.dataType !== undefined && column.dataType !== null && typeof column.dataType !== "string")
    ) {
      throw errorFactory();
    }
    const typeValue = column.type ?? column.dataType ?? null;
    if (typeof typeValue === "string" && typeValue.length > 255) {
      throw errorFactory();
    }
    return { name: column.name, type: typeValue as string | null };
  });
  if (new Set(columns.map((column) => column.name)).size !== columns.length) {
    throw errorFactory();
  }
  return columns;
}

function readUnityCatalogResource(bindings: ProjectJsonObject | null): Record<string, unknown> | null {
  const binding = bindings?.unityCatalogTable;
  const source = isRecord(binding) ? binding.source : null;
  const resource = isRecord(source) ? source.resource : null;
  return isRecord(resource) ? resource : null;
}

function readText(
  value: unknown,
  fallback: string,
  maximumLength: number,
  errorFactory: ErrorFactory,
): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    typeof value !== "string" || value.length > maximumLength || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw errorFactory();
  }
  return value;
}

function readBoolean(value: unknown, fallback: boolean, errorFactory: ErrorFactory): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw errorFactory();
  }
  return value;
}
