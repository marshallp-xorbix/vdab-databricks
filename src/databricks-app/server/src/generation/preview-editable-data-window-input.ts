import type { ProjectComponent, ProjectJsonObject } from "../db/project-components-contract.ts";
import { hasUnexpectedProperties } from "../db/project-component-json.ts";
import { invalidDataWindow } from "./preview-errors.ts";
import {
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
} from "../lakebase-app-resource-binding.ts";
const PROPERTY_NAMES = [
  "label", "maxRows", "scrollable", "placeholder", "disabled",
  "numRows", "hideIndex", "width", "height",
];
const WIDTH_MODES = new Set(["stretch", "content"]);
const HEIGHT_MODES = new Set(["auto", "content", "stretch"]);
const SQL_TYPES: Record<string, string> = {
  BOOLEAN: "BOOLEAN",
  BYTE: "TINYINT",
  SHORT: "SMALLINT",
  INT: "INT",
  LONG: "BIGINT",
  FLOAT: "FLOAT",
  DOUBLE: "DOUBLE",
  DATE: "DATE",
  TIMESTAMP: "TIMESTAMP",
  TIMESTAMP_NTZ: "TIMESTAMP_NTZ",
  STRING: "STRING",
  CHAR: "STRING",
};

/** Validated display and editing options for an EditableDataWindow. */
export interface EditableProperties {
  label: string;
  maxRows: number;
  disabled: boolean;
  scrollable: boolean;
  numRows: "fixed" | "dynamic";
  width: string | number;
  height: string | number;
  hideIndex: boolean | null;
  placeholder: string | null;
}

/** Validated table authority and metadata for an EditableDataWindow. */
export interface EditableTableBinding {
  kind: "none" | "unityCatalogTable" | "lakebaseProvisionedDatabase" | "lakebaseAutoscaling";
  catalog: string | null;
  schema: string | null;
  table: string | null;
  database: string | null;
  instanceName: string | null;
  endpoint: string | null;
  resourceEnvironmentVariable: string | null;
  dataSourceFormat: string | null;
  primaryKeyColumn: string | null;
  columns: Array<{ name: string; type: string | null; dataType: string | null }>;
}

/** Validates and normalizes EditableDataWindow display properties. */
export function readProperties(component: ProjectComponent): EditableProperties {
  if (
    component.type !== "EditableDataWindow" ||
    component.schemaVersion !== 1 ||
    component.children.length > 0 ||
    !isSupportedLayout(component.layout) ||
    hasUnexpectedProperties(component.properties, PROPERTY_NAMES)
  ) {
    throw invalidDataWindow("EditableDataWindow contains an unsupported component shape.");
  }
  const properties = component.properties;
  const numRows = properties.numRows ?? "fixed";
  if (numRows !== "fixed" && numRows !== "dynamic") {
    throw invalidDataWindow("EditableDataWindow row mode must be fixed or dynamic.");
  }
  return {
    label: readText(properties, "label", "Editable Data Table", 500),
    maxRows: readInteger(properties.maxRows, 0, 1_000_000),
    disabled: readBoolean(properties.disabled, false),
    scrollable: readBoolean(properties.scrollable, true),
    numRows,
    width: readDimension(properties.width, WIDTH_MODES, 4_000, "stretch"),
    height: readDimension(properties.height, HEIGHT_MODES, 10_000, "auto"),
    hideIndex: readNullableBoolean(properties.hideIndex),
    placeholder: readNullableText(properties.placeholder, 2_000),
  };
}

/** Validates and normalizes the saved EditableDataWindow table binding. */
export function readBinding(bindings: ProjectJsonObject | null): EditableTableBinding {
  if (bindings === null) {
    return {
      kind: "none",
      catalog: null,
      schema: null,
      table: null,
      database: null,
      instanceName: null,
      endpoint: null,
      resourceEnvironmentVariable: null,
      dataSourceFormat: null,
      primaryKeyColumn: null,
      columns: [],
    };
  }
  const bindingType = Object.keys(bindings)[0];
  if (bindingType === "lakebaseProvisionedDatabase" || bindingType === "lakebaseAutoscaling") {
    const binding = bindings[bindingType];
    const source = isRecord(binding) ? binding.source : null;
    const resource = isRecord(source) ? source.resource : null;
    const lakebaseFields = bindingType === "lakebaseProvisionedDatabase"
      ? ["database", "instanceName"]
      : ["database", "databaseId", "projectId", "branchId", "endpointId"];
    if (
      Object.keys(bindings).length !== 1 || !isRecord(binding) ||
      hasUnexpectedProperties(binding, ["bindingType", "source"]) || binding.bindingType !== bindingType ||
      !isRecord(source) || hasUnexpectedProperties(source, ["kind", "valueType", "resource"]) ||
      source.kind !== "resource" || source.valueType !== "table" || !isRecord(resource) ||
      hasUnexpectedProperties(resource, ["type", "catalog", "schema", "table", "dataSourceFormat", "primaryKeyColumn", "columns", ...lakebaseFields]) ||
      resource.type !== bindingType
    ) {
      throw invalidDataWindow("EditableDataWindow has an invalid Lakebase table binding.");
    }
    const database = readResourceName(resource.database);
    const schema = readResourceName(resource.schema);
    const table = readResourceName(resource.table);
    const instanceName = bindingType === "lakebaseProvisionedDatabase"
      ? readLakebaseIdentifier(resource.instanceName)
      : null;
    const projectId = bindingType === "lakebaseAutoscaling" ? readLakebaseIdentifier(resource.projectId) : null;
    const branchId = bindingType === "lakebaseAutoscaling" ? readLakebaseIdentifier(resource.branchId) : null;
    const endpointId = bindingType === "lakebaseAutoscaling" ? readLakebaseIdentifier(resource.endpointId) : null;
    const databaseId = bindingType === "lakebaseAutoscaling" ? readLakebaseIdentifier(resource.databaseId) : null;
    const columns = readColumns(resource.columns);
    const endpoint = projectId !== null && branchId !== null && endpointId !== null
      ? `projects/${projectId}/branches/${branchId}/endpoints/${endpointId}`
      : null;
    const complete = database !== null && schema !== null && table !== null && columns.length > 0 &&
      (bindingType === "lakebaseProvisionedDatabase"
        ? instanceName !== null
        : endpoint !== null && databaseId !== null);
    const resourceBinding = complete
      ? bindingType === "lakebaseAutoscaling"
        ? createAutoscalingAppResourceBinding({
          projectId: projectId as string,
          branchId: branchId as string,
          endpointId: endpointId as string,
          databaseId: databaseId as string,
        })
        : createProvisionedAppResourceBinding({ instanceName: instanceName as string, databaseName: database as string })
      : null;
    return {
      kind: complete ? bindingType : "none",
      catalog: null,
      schema,
      table,
      database,
      instanceName,
      endpoint,
      resourceEnvironmentVariable: resourceBinding?.environmentVariable ?? null,
      dataSourceFormat: null,
      primaryKeyColumn: readResourceName(resource.primaryKeyColumn),
      columns,
    };
  }

  const value = bindings.unityCatalogTable;
  const source = isRecord(value) ? value.source : null;
  const resource = isRecord(source) ? source.resource : null;
  if (
    Object.keys(bindings).length !== 1 ||
    !isRecord(value) || hasUnexpectedProperties(value, ["bindingType", "source"]) ||
    value.bindingType !== "unityCatalogTable" ||
    !isRecord(source) || hasUnexpectedProperties(source, ["kind", "valueType", "resource"]) ||
    source.kind !== "resource" || source.valueType !== "table" ||
    !isRecord(resource) || hasUnexpectedProperties(resource, [
    "type", "catalog", "schema", "table", "dataSourceFormat", "primaryKeyColumn", "columns",
    ]) || resource.type !== "unityCatalogTable" ||
    (resource.dataSourceFormat !== undefined && resource.dataSourceFormat !== null && typeof resource.dataSourceFormat !== "string")
  ) {
    throw invalidDataWindow("EditableDataWindow has an invalid or unsupported table binding.");
  }
  return {
    kind: "unityCatalogTable",
    catalog: readResourceName(resource.catalog),
    schema: readResourceName(resource.schema),
    table: readResourceName(resource.table),
    database: null,
    instanceName: null,
    endpoint: null,
    resourceEnvironmentVariable: null,
    dataSourceFormat: typeof resource.dataSourceFormat === "string"
      ? resource.dataSourceFormat.toUpperCase()
      : null,
    primaryKeyColumn: readResourceName(resource.primaryKeyColumn),
    columns: readColumns(resource.columns),
  };
}

function readColumns(value: unknown): EditableTableBinding["columns"] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 100) {
    throw invalidDataWindow("EditableDataWindow table column metadata is invalid.");
  }
  const columns = value.map((column) => {
    if (
      !isRecord(column) ||
      hasUnexpectedProperties(column, ["name", "type", "dataType", "nullable"]) ||
      (column.nullable !== undefined && typeof column.nullable !== "boolean")
    ) {
      throw invalidDataWindow("EditableDataWindow table column metadata is invalid.");
    }
    const name = readColumnName(column.name);
    if (
      name === null ||
      (column.type !== undefined && column.type !== null && typeof column.type !== "string") ||
      (column.dataType !== undefined && column.dataType !== null && typeof column.dataType !== "string")
    ) {
      throw invalidDataWindow("EditableDataWindow table column metadata is invalid.");
    }
    return {
      name,
      type: typeof column.type === "string" ? column.type : null,
      dataType: typeof column.dataType === "string" ? column.dataType.toUpperCase() : null,
    };
  });
  if (new Set(columns.map((column) => column.name)).size !== columns.length) {
    throw invalidDataWindow("EditableDataWindow contains duplicate table columns.");
  }
  return columns;
}

/** Returns a safe SQL type for one editable table column. */
export function readSqlType(column: EditableTableBinding["columns"][number]): string {
  if (column.dataType === "DECIMAL") {
    const match = /^DECIMAL(?:\((\d{1,2})\s*,\s*(\d{1,2})\))?$/i.exec(column.type ?? "");
    if (!match) {
      throw invalidDataWindow(`EditableDataWindow cannot safely edit decimal column ${column.name}.`);
    }
    if (match[1] === undefined || match[2] === undefined) {
      return "DECIMAL(38,18)";
    }
    const precision = Number(match[1]);
    const scale = Number(match[2]);
    if (precision < 1 || precision > 38 || scale > precision) {
      throw invalidDataWindow(`EditableDataWindow has invalid decimal metadata for ${column.name}.`);
    }
    return `DECIMAL(${precision},${scale})`;
  }
  const sqlType = column.dataType !== null && Object.hasOwn(SQL_TYPES, column.dataType)
    ? SQL_TYPES[column.dataType]
    : undefined;
  if (sqlType === undefined) {
    throw invalidDataWindow(`EditableDataWindow cannot safely edit column ${column.name} with this data type.`);
  }
  return sqlType;
}

/** Reports whether the selected table binding has the required resource names. */
export function isComplete(binding: EditableTableBinding): boolean {
  if (binding.schema === null || binding.table === null) return false;
  if (binding.kind === "unityCatalogTable") return binding.catalog !== null;
  if (binding.kind === "lakebaseProvisionedDatabase") {
    return binding.database !== null && binding.instanceName !== null;
  }
  if (binding.kind === "lakebaseAutoscaling") {
    return binding.database !== null && binding.endpoint !== null;
  }
  return false;
}

function readText(properties: ProjectJsonObject, key: string, fallback: string, maximumLength: number): string {
  const value = properties[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || value.trim() !== value || value.length > maximumLength) {
    throw invalidDataWindow(`EditableDataWindow ${key} must be supported text.`);
  }
  return value;
}

function readInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw invalidDataWindow("EditableDataWindow maximum rows must be a supported non-negative integer.");
  }
  return value;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw invalidDataWindow("EditableDataWindow boolean settings are invalid.");
  return value;
}

function readNullableBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw invalidDataWindow("EditableDataWindow hideIndex must be a boolean or null.");
  return value;
}

function readNullableText(value: unknown, maximumLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > maximumLength) {
    throw invalidDataWindow("EditableDataWindow placeholder must be text.");
  }
  return value;
}

function readDimension(value: unknown, modes: Set<string>, maximum: number, fallback: string): string | number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && modes.has(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum) return value;
  throw invalidDataWindow("EditableDataWindow width or height is not supported by Streamlit.");
}

function readResourceName(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "string" || value.length < 1 || value.length > 255 ||
    value.trim() !== value || value.includes("/") || value.includes("\\") ||
    value === "." || value === ".." || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidDataWindow("Unity Catalog resource names must be valid text.");
  }
  return value;
}

function readLakebaseIdentifier(value: unknown): string | null {
  const identifier = readResourceName(value);
  if (identifier !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(identifier)) {
    throw invalidDataWindow("EditableDataWindow Lakebase resource reference has an invalid format.");
  }
  return identifier;
}

function readColumnName(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "string" || value.length < 1 || value.length > 255 ||
    value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidDataWindow("Unity Catalog column names must be valid text.");
  }
  return value;
}

function isSupportedLayout(layout: ProjectJsonObject | null): boolean {
  if (layout === null) return true;
  if (hasUnexpectedProperties(layout, ["y", "tabIndex"])) return false;
  return (layout.y === undefined || (typeof layout.y === "number" && Number.isFinite(layout.y) && layout.y >= 0)) &&
    (layout.tabIndex === undefined || (typeof layout.tabIndex === "number" && Number.isSafeInteger(layout.tabIndex) && layout.tabIndex >= 0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

