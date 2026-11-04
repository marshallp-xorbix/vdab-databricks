import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const PROPERTY_NAMES = ["title", "seriesColor", "category", "value"];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const NUMERIC_TRANSFORMS = new Set(["none", "sum", "avg", "count", "count_distinct", "min", "max"]);
const CATEGORICAL_TRANSFORMS = new Set(["count", "count_distinct"]);
const TEMPORAL_TRANSFORMS = new Set(["count", "count_distinct", "min", "max"]);

interface PieChartAxis {
  field: string;
  transform: string;
}

/** Validates PieChart defaults and settings at the save/import boundary. */
export function validatePieChartProperties(properties: ProjectJsonObject): void {
  validateRadialChartProperties(properties);
}

/** Validates DonutChart defaults and settings at the save/import boundary. */
export function validateDonutChartProperties(properties: ProjectJsonObject): void {
  validateRadialChartProperties(properties);
}

function validateRadialChartProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw invalidComponents();
  }
  validateTitle(properties.title);
  validateColor(properties.seriesColor);
  const category = readAxis(properties.category, "categorical", "none", new Set(["none"]));
  readAxis(properties.value, "continuous", "sum", NUMERIC_TRANSFORMS);
  if (category.transform !== "none") {
    throw invalidComponents();
  }
}

/** Checks selected PieChart columns against current-workspace metadata. */
export function validatePieChartBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
): void {
  validateRadialChartBindings(bindings, properties);
}

/** Checks selected DonutChart columns against current-workspace metadata. */
export function validateDonutChartBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
): void {
  validateRadialChartBindings(bindings, properties);
}

function validateRadialChartBindings(
  bindings: ProjectJsonObject | null,
  properties: ProjectJsonObject,
): void {
  const resource = readUnityCatalogResource(bindings);
  if (resource === null || !Array.isArray(resource.columns) || resource.columns.length === 0) {
    return;
  }
  const columns = readColumns(resource.columns);
  const category = readAxis(properties.category, "categorical", "none", new Set(["none"]));
  const value = readAxis(properties.value, "continuous", "sum", NUMERIC_TRANSFORMS);
  if (category.field !== "") {
    requireColumn(category, columns, true);
  }
  if (value.field !== "") {
    requireColumn(value, columns, false);
  }
}

function validateTitle(value: unknown): void {
  if (value !== undefined && value !== null &&
      (typeof value !== "string" || value.length > 500 || /[\u0000-\u001f\u007f]/.test(value))) {
    throw invalidComponents();
  }
}

function validateColor(value: unknown): void {
  if (value !== undefined && value !== null &&
      (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))) {
    throw invalidComponents();
  }
}

function readAxis(
  value: unknown,
  defaultScale: string,
  defaultTransform: string,
  transforms: Set<string>,
): PieChartAxis {
  if (value === undefined || value === null) {
    return { field: "", transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw invalidComponents();
  }
  const field = value.field ?? "";
  const displayName = value.displayName ?? "";
  const scaleType = value.scaleType ?? defaultScale;
  const transform = value.transform ?? defaultTransform;
  if (
    typeof field !== "string" || field.length > 255 || field.trim() !== field ||
    /[\u0000-\u001f\u007f]/.test(field) ||
    typeof displayName !== "string" || displayName.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(displayName) ||
    scaleType !== defaultScale || typeof transform !== "string" || !transforms.has(transform)
  ) {
    throw invalidComponents();
  }
  return { field, transform };
}

function requireColumn(axis: PieChartAxis, columns: Array<Record<string, unknown>>, isCategory: boolean): void {
  const column = columns.find((candidate) => candidate.name === axis.field);
  if (column === undefined) {
    throw invalidComponents();
  }
  if (isCategory) {
    return;
  }
  const category = classifyType(typeof column.type === "string" ? column.type : "");
  const allowed = category === "numeric"
    ? NUMERIC_TRANSFORMS
    : category === "temporal"
      ? TEMPORAL_TRANSFORMS
      : CATEGORICAL_TRANSFORMS;
  if (!allowed.has(axis.transform)) {
    throw invalidComponents();
  }
}

function readColumns(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw invalidComponents();
  }
  const columns = value.filter(isRecord);
  if (columns.length !== value.length || columns.some((column) =>
    typeof column.name !== "string" || column.name.length < 1 || column.name.length > 255 ||
    column.name.trim() !== column.name || /[\u0000-\u001f\u007f]/.test(column.name) ||
    (column.type !== undefined && column.type !== null &&
      (typeof column.type !== "string" || column.type.length > 255)) ||
    (column.dataType !== undefined && column.dataType !== null &&
      (typeof column.dataType !== "string" || column.dataType.length > 255)) ||
    Object.keys(column).some((key) => !["name", "type", "dataType"].includes(key))
  )) {
    throw invalidComponents();
  }
  const names = columns.map((column) => column.name);
  if (new Set(names).size !== names.length) {
    throw invalidComponents();
  }
  return columns;
}

function readUnityCatalogResource(bindings: ProjectJsonObject | null): Record<string, unknown> | null {
  const binding = bindings?.unityCatalogTable;
  const source = isRecord(binding) ? binding.source : null;
  const resource = isRecord(source) ? source.resource : null;
  return isRecord(resource) ? resource : null;
}

function classifyType(type: string): "numeric" | "temporal" | "categorical" | "unknown" {
  const normalized = type.trim().toUpperCase();
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
