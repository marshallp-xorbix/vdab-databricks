import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const PROPERTY_NAMES = ["title", "seriesColor", "xAxis", "yAxis"];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const AXIS_SCALES = new Set(["categorical", "continuous"]);
const X_TRANSFORMS = new Set(["none", "yearly", "monthly", "weekly", "daily"]);
const Y_TRANSFORMS = new Set(["none", "sum", "avg", "count", "count_distinct", "min", "max"]);
const TIME_TRANSFORMS = new Set(["yearly", "monthly", "weekly", "daily"]);
const NUMERIC_MEASURE_TRANSFORMS = Y_TRANSFORMS;
const TEMPORAL_MEASURE_TRANSFORMS = new Set(["count", "count_distinct", "min", "max"]);
const CATEGORICAL_MEASURE_TRANSFORMS = new Set(["count", "count_distinct"]);

export type CartesianChartType = "BarChart" | "LineChart";

interface IChartAxis {
  field: string;
  scaleType: string;
  transform: string;
}

/** Validates Cartesian chart properties independently of the editor. */
export function validateCartesianChartProperties(
  properties: ProjectJsonObject,
  chartType: CartesianChartType,
): void {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw invalidComponents();
  }

  if (properties.title !== undefined && properties.title !== null &&
      (typeof properties.title !== "string" || properties.title.length > 500 || /[\u0000-\u001f\u007f]/.test(properties.title))) {
    throw invalidComponents();
  }
  if (properties.seriesColor !== undefined && properties.seriesColor !== null &&
      (typeof properties.seriesColor !== "string" || !/^#[0-9a-f]{6}$/i.test(properties.seriesColor))) {
    throw invalidComponents();
  }

  const xAxis = readAxis(properties.xAxis, defaultXScale(chartType), "none", X_TRANSFORMS);
  if (chartType === "LineChart" && xAxis.transform !== "none") {
    throw invalidComponents();
  }
  readAxis(properties.yAxis, "continuous", defaultYTransform(chartType), Y_TRANSFORMS);
}

/** Checks configured axes against discovered Unity Catalog column metadata. */
export function validateCartesianChartBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
  chartType: CartesianChartType,
): void {
  const resource = readUnityCatalogResource(bindings);
  if (resource === null || !Array.isArray(resource.columns) || resource.columns.length === 0) {
    return;
  }

  const columns = resource.columns.filter(isRecord);
  if (columns.length !== resource.columns.length || hasDuplicateColumnNames(columns)) {
    throw invalidComponents();
  }
  const xAxis = readAxis(properties.xAxis, defaultXScale(chartType), "none", X_TRANSFORMS);
  const yAxis = readAxis(properties.yAxis, "continuous", defaultYTransform(chartType), Y_TRANSFORMS);
  if (chartType === "LineChart" && xAxis.transform !== "none") {
    throw invalidComponents();
  }
  validateAxisColumn(xAxis, columns, true);
  validateAxisColumn(yAxis, columns, false);
}

function defaultXScale(chartType: CartesianChartType): string {
  return chartType === "BarChart" ? "categorical" : "continuous";
}

function defaultYTransform(chartType: CartesianChartType): string {
  return chartType === "BarChart" ? "count" : "none";
}

function readAxis(
  value: unknown,
  defaultScale: string,
  defaultTransform: string,
  transforms: Set<string>,
): IChartAxis {
  if (value === undefined || value === null) {
    return { field: "", scaleType: defaultScale, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw invalidComponents();
  }

  const field = readOptionalName(value.field);
  const scaleType = value.scaleType ?? defaultScale;
  const transform = value.transform ?? defaultTransform;
  if (
    typeof scaleType !== "string" || !AXIS_SCALES.has(scaleType) ||
    typeof transform !== "string" || !transforms.has(transform) ||
    (value.displayName !== undefined && value.displayName !== null &&
      (typeof value.displayName !== "string" || value.displayName.length > 500 || /[\u0000-\u001f\u007f]/.test(value.displayName)))
  ) {
    throw invalidComponents();
  }
  return { field, scaleType, transform };
}

function validateAxisColumn(
  axis: IChartAxis,
  columns: Array<Record<string, unknown>>,
  isDimension: boolean,
): void {
  if (axis.field === "") {
    return;
  }

  const column = columns.find((candidate) => candidate.name === axis.field);
  if (column === undefined) {
    throw invalidComponents();
  }
  const type = typeof column.type === "string" ? column.type : "";
  const category = classifyType(type);
  if (isDimension) {
    if (TIME_TRANSFORMS.has(axis.transform) && category !== "temporal") {
      throw invalidComponents();
    }
    if (axis.scaleType === "continuous" && category !== "numeric" && category !== "temporal") {
      throw invalidComponents();
    }
    return;
  }

  const allowed = category === "numeric"
    ? NUMERIC_MEASURE_TRANSFORMS
    : category === "temporal"
      ? TEMPORAL_MEASURE_TRANSFORMS
      : CATEGORICAL_MEASURE_TRANSFORMS;
  if (!allowed.has(axis.transform)) {
    throw invalidComponents();
  }
}

function hasDuplicateColumnNames(columns: Array<Record<string, unknown>>): boolean {
  const names = columns.map((column) => column.name);
  return names.some((name) =>
    typeof name !== "string" || name.length < 1 || name.length > 255 ||
    name.trim() !== name || /[\u0000-\u001f\u007f]/.test(name),
  ) || new Set(names).size !== names.length || columns.some((column) =>
    (column.type !== undefined && column.type !== null &&
      (typeof column.type !== "string" || column.type.length > 255)) ||
    (column.dataType !== undefined && column.dataType !== null &&
      (typeof column.dataType !== "string" || column.dataType.length > 255)) ||
    Object.keys(column).some((key) => !["name", "type", "dataType"].includes(key)),
  );
}

function readUnityCatalogResource(
  bindings: ProjectJsonObject | null,
): Record<string, unknown> | null {
  const binding = bindings?.unityCatalogTable;
  const source = isRecord(binding) ? binding.source : null;
  const resource = isRecord(source) ? source.resource : null;
  return isRecord(resource) ? resource : null;
}

function readOptionalName(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (
    typeof value !== "string" || value.length > 255 || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidComponents();
  }
  return value;
}

function classifyType(type: string): "numeric" | "temporal" | "boolean" | "string" | "unknown" {
  const normalized = type.trim().toUpperCase();
  if (/^(?:TINYINT|SMALLINT|INT|INTEGER|BIGINT|LONG|FLOAT|DOUBLE|DECIMAL|NUMERIC)(?:\b|\s*\()/.test(normalized)) {
    return "numeric";
  }
  if (/^(?:DATE|TIMESTAMP|TIMESTAMP_NTZ|TIME)(?:\b|\s*\()/.test(normalized)) {
    return "temporal";
  }
  if (/^(?:BOOLEAN|BOOL)$/.test(normalized)) {
    return "boolean";
  }
  if (/^(?:STRING|CHAR|VARCHAR)(?:\b|\s*\()/.test(normalized)) {
    return "string";
  }
  return "unknown";
}
