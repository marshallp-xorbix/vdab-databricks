import type { ProjectJsonObject } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

const DATA_WINDOW_PROPERTY_NAMES = [
  "label",
  "maxRows",
  "scrollable",
  "placeholder",
  "width",
  "hideIndex",
  "height",
];
const MAX_LABEL_LENGTH = 500;
const MAX_PLACEHOLDER_LENGTH = 2000;
const MAX_RESOURCE_NAME_LENGTH = 255;
const MAX_DATA_WINDOW_ROWS = 1_000_000;
const MAX_DATA_WINDOW_WIDTH = 4_000;
const MAX_DATA_WINDOW_HEIGHT = 10_000;
const DATA_WINDOW_WIDTH_MODES = new Set(["stretch", "content"]);
const DATA_WINDOW_HEIGHT_MODES = new Set(["auto", "content", "stretch"]);

/** Validates DataWindow display options at the save/import boundary. */
export function validateDataWindowProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, DATA_WINDOW_PROPERTY_NAMES)) {
    throw invalidComponents();
  }

  validateOptionalText(properties.label, MAX_LABEL_LENGTH);
  validateOptionalText(properties.placeholder, MAX_PLACEHOLDER_LENGTH, true);
  validateOptionalBoolean(properties.scrollable);
  validateOptionalBoolean(properties.hideIndex, true);
  validateOptionalInteger(properties.maxRows, 0, MAX_DATA_WINDOW_ROWS);
  validateDimension(properties.width, DATA_WINDOW_WIDTH_MODES, MAX_DATA_WINDOW_WIDTH);
  validateDimension(properties.height, DATA_WINDOW_HEIGHT_MODES, MAX_DATA_WINDOW_HEIGHT);
}

/** Validates supported table bindings without accepting workspace authority fields. */
export function validateDataWindowBindings(
  bindings: ProjectJsonObject | null,
): void {
  if (bindings === null) {
    return;
  }

  if (
    Object.keys(bindings).length !== 1 ||
    !["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"]
      .some((bindingType) => Object.hasOwn(bindings, bindingType))
  ) {
    throw invalidComponents();
  }

  const bindingType = Object.keys(bindings)[0];
  if (bindingType === undefined || !isRecord(bindings[bindingType])) {
    throw invalidComponents();
  }

  const binding = bindings[bindingType];
  if (
    hasUnexpectedProperties(binding, ["bindingType", "source"]) ||
    binding.bindingType !== bindingType ||
    !isRecord(binding.source)
  ) {
    throw invalidComponents();
  }

  const source = binding.source;
  if (
    hasUnexpectedProperties(source, ["kind", "valueType", "resource"]) ||
    source.kind !== "resource" ||
    source.valueType !== "table" ||
    !isRecord(source.resource)
  ) {
    throw invalidComponents();
  }

  const resource = source.resource;
  const resourceProperties = resourcePropertiesFor(bindingType);
  if (
    hasUnexpectedProperties(resource, resourceProperties) ||
    resource.type !== bindingType ||
    !isOptionalText(resource.dataSourceFormat) ||
    !isOptionalResourceName(resource.catalog) ||
    !isOptionalResourceName(resource.schema) ||
    !isOptionalResourceName(resource.table) ||
    !isOptionalResourceName(resource.primaryKeyColumn) ||
    !isOptionalResourceName(resource.database) ||
    !isOptionalResourceName(resource.instanceName) ||
    !isOptionalResourceName(resource.projectId) ||
    !isOptionalResourceName(resource.branchId) ||
    !isOptionalResourceName(resource.endpointId) ||
    !isValidColumnMetadata(resource.columns)
  ) {
    throw invalidComponents();
  }
}

function resourcePropertiesFor(bindingType: string): string[] {
  const properties = [
    "type",
    "dataSourceFormat",
    "catalog",
    "schema",
    "table",
    "primaryKeyColumn",
    "columns",
  ];

  if (bindingType === "lakebaseProvisionedDatabase") {
    properties.push("database", "instanceName");
  } else if (bindingType === "lakebaseAutoscaling") {
    properties.push("database", "projectId", "branchId", "endpointId");
  }

  return properties;
}

function validateDimension(
  value: unknown,
  modes: Set<string>,
  maximumPixels: number,
): void {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && modes.has(value))
  ) {
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

function validateOptionalText(
  value: unknown,
  maximumLength: number,
  allowEmpty = false,
): void {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" &&
      value.length <= maximumLength &&
      value.trim() === value &&
      (allowEmpty || value.trim() !== ""))
  ) {
    return;
  }

  throw invalidComponents();
}

function validateOptionalBoolean(value: unknown, allowNull = false): void {
  if (value === undefined || (allowNull && value === null) || typeof value === "boolean") {
    return;
  }

  throw invalidComponents();
}

function validateOptionalInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): void {
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

function isOptionalResourceName(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= MAX_RESOURCE_NAME_LENGTH &&
      value.trim() === value &&
      !value.includes("/") &&
      !value.includes("\\") &&
      value !== "." &&
      value !== ".." &&
      !/[\u0000-\u001f\u007f]/.test(value))
  );
}

function isValidColumnMetadata(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((column) =>
    isRecord(column) &&
    (column.name === undefined ||
      (typeof column.name === "string" &&
        column.name.length > 0 &&
        column.name.length <= 255)) &&
    (column.type === undefined ||
      column.type === null ||
      typeof column.type === "string"),
  );
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || value === null ||
    (typeof value === "string" && value.length <= 100 && value.trim() === value);
}
