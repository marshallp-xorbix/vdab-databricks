import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const PROPERTY_NAMES = [
  "label", "maxRows", "scrollable", "placeholder", "disabled",
  "numRows", "hideIndex", "width", "height",
];
const WIDTH_MODES = new Set(["stretch", "content"]);
const HEIGHT_MODES = new Set(["auto", "content", "stretch"]);
const MAX_RESOURCE_NAME_LENGTH = 255;

/** Validates the editable table's display and row-editing options. */
export function validateEditableDataWindowProperties(
  properties: ProjectJsonObject,
): void {
  if (hasUnexpectedProperties(properties, PROPERTY_NAMES)) {
    throw invalidComponents();
  }

  validateOptionalText(properties.label, 500);
  validateOptionalText(properties.placeholder, 2_000, true);
  validateOptionalBoolean(properties.scrollable);
  validateOptionalBoolean(properties.disabled);
  validateOptionalBoolean(properties.hideIndex, true);
  validateOptionalInteger(properties.maxRows, 0, 1_000_000);
  validateDimension(properties.width, WIDTH_MODES, 4_000);
  validateDimension(properties.height, HEIGHT_MODES, 10_000);

  if (
    properties.numRows !== undefined &&
    properties.numRows !== null &&
    properties.numRows !== "fixed" &&
    properties.numRows !== "dynamic"
  ) {
    throw invalidComponents();
  }
}

/** Requires a primary key before a complete Unity Catalog binding can be saved. */
export function validateEditableDataWindowBindings(
  bindings: ProjectJsonObject | null,
): void {
  if (bindings === null) {
    return;
  }

  const binding = bindings.unityCatalogTable;
  if (!isRecord(binding) || !isRecord(binding.source)) {
    return;
  }

  const resource = binding.source.resource;
  if (!isRecord(resource)) {
    return;
  }

  const tableIsComplete =
    isResourceName(resource.catalog) &&
    isResourceName(resource.schema) &&
    isResourceName(resource.table);
  if (!tableIsComplete) {
    return;
  }

  if (resource.dataSourceFormat !== "DELTA") {
    return;
  }

  const primaryKeyColumn = resource.primaryKeyColumn;
  const columns = resource.columns;
  if (
    !isResourceName(primaryKeyColumn) ||
    !Array.isArray(columns) ||
    columns.some((column) => !isValidColumn(column))
  ) {
    throw invalidComponents();
  }
  const columnNames = columns.map((column) => (column as Record<string, unknown> & { name: string }).name);
  if (
    !columnNames.includes(primaryKeyColumn) ||
    new Set(columnNames).size !== columnNames.length
  ) {
    throw invalidComponents();
  }
}

function isValidColumn(value: unknown): value is Record<string, unknown> & { name: string } {
  return isRecord(value) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= MAX_RESOURCE_NAME_LENGTH &&
    value.name.trim() === value.name &&
    !/[\u0000-\u001f\u007f]/.test(value.name) &&
    (value.type === undefined || value.type === null || typeof value.type === "string") &&
    (value.dataType === undefined || value.dataType === null || typeof value.dataType === "string");
}

function isResourceName(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_RESOURCE_NAME_LENGTH &&
    value.trim() === value &&
    !value.includes("/") &&
    !value.includes("\\") &&
    value !== "." &&
    value !== ".." &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function validateOptionalText(value: unknown, maximumLength: number, allowEmpty = false): void {
  if (value === undefined || value === null) {
    return;
  }
  if (
    typeof value !== "string" ||
    value.length > maximumLength ||
    value.trim() !== value ||
    (!allowEmpty && value === "")
  ) {
    throw invalidComponents();
  }
}

function validateOptionalBoolean(value: unknown, allowNull = false): void {
  if (value === undefined || (allowNull && value === null) || typeof value === "boolean") {
    return;
  }
  throw invalidComponents();
}

function validateOptionalInteger(value: unknown, minimum: number, maximum: number): void {
  if (value === undefined || value === null) {
    return;
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw invalidComponents();
  }
}

function validateDimension(value: unknown, modes: Set<string>, maximumPixels: number): void {
  if (value === undefined || value === null || (typeof value === "string" && modes.has(value))) {
    return;
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximumPixels
  ) {
    throw invalidComponents();
  }
}
