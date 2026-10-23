import type { ProjectJsonObject } from "../db/project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "../db/project-component-json.ts";
import { pythonString } from "./preview-python.ts";
import {
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
} from "../lakebase-app-resource-binding.ts";

export interface ChartColumn {
  name: string;
  type: string | null;
}

export interface ChartBinding {
  kind: "none" | "unityCatalogTable" | "lakebaseProvisionedDatabase" | "lakebaseAutoscaling" | "unsupported";
  catalog: string | null;
  schema: string | null;
  table: string | null;
  database: string | null;
  instanceName: string | null;
  endpoint: string | null;
  resourceEnvironmentVariable: string | null;
  columns: ChartColumn[];
}

export const MAX_CHART_ROWS = 10_000;

type ChartErrorFactory = (detail: string) => Error;

/** Reads a persisted table binding and resolves its current-workspace Lakebase endpoint. */
export function readChartBinding(
  bindings: ProjectJsonObject | null,
  invalidChart: ChartErrorFactory,
): ChartBinding {
  if (bindings === null) {
    return emptyBinding("none");
  }

  const bindingType = Object.keys(bindings)[0];
  if (Object.keys(bindings).length !== 1 || bindingType === undefined) {
    throw invalidChart("Chart must have exactly one supported table binding.");
  }
  if (bindingType !== "unityCatalogTable") {
    if (bindingType !== "lakebaseProvisionedDatabase" && bindingType !== "lakebaseAutoscaling") {
      throw invalidChart("Chart table binding is not supported.");
    }
    const resource = validateBindingShape(bindings[bindingType], bindingType, invalidChart);
    const database = readResourceName(resource.database, invalidChart);
    const instanceName = bindingType === "lakebaseProvisionedDatabase"
      ? readLakebaseIdentifier(resource.instanceName, "instance", invalidChart)
      : null;
    const projectId = bindingType === "lakebaseAutoscaling"
      ? readLakebaseIdentifier(resource.projectId, "project", invalidChart)
      : null;
    const branchId = bindingType === "lakebaseAutoscaling"
      ? readLakebaseIdentifier(resource.branchId, "branch", invalidChart)
      : null;
    const endpointId = bindingType === "lakebaseAutoscaling"
      ? readLakebaseIdentifier(resource.endpointId, "endpoint", invalidChart)
      : null;
    const databaseId = bindingType === "lakebaseAutoscaling"
      ? readLakebaseIdentifier(resource.databaseId, "database", invalidChart)
      : null;
    const schema = readResourceName(resource.schema, invalidChart);
    const table = readResourceName(resource.table, invalidChart);
    const columns = readColumns(resource.columns, invalidChart);
    const complete = database !== null && schema !== null && table !== null && columns.length > 0 &&
      (bindingType === "lakebaseProvisionedDatabase"
        ? instanceName !== null
        : projectId !== null && branchId !== null && endpointId !== null && databaseId !== null);
    if (!complete) {
      return emptyBinding("none");
    }
    return {
      kind: bindingType,
      catalog: null,
      schema,
      table,
      database,
      instanceName,
      endpoint: endpointId === null ? null : `projects/${projectId}/branches/${branchId}/endpoints/${endpointId}`,
      resourceEnvironmentVariable: bindingType === "lakebaseAutoscaling"
        ? createAutoscalingAppResourceBinding({ projectId: projectId as string, branchId: branchId as string, endpointId: endpointId as string, databaseId: databaseId as string }).environmentVariable
        : createProvisionedAppResourceBinding({ instanceName: instanceName as string, databaseName: database as string }).environmentVariable,
      columns,
    };
  }

  const resource = validateBindingShape(bindings[bindingType], bindingType, invalidChart);
  const columns = readColumns(resource.columns, invalidChart);
  const catalog = readResourceName(resource.catalog, invalidChart);
  const schema = readResourceName(resource.schema, invalidChart);
  const table = readResourceName(resource.table, invalidChart);
  const isComplete = catalog !== null && schema !== null && table !== null;
  if (isComplete && columns.length === 0) {
    throw invalidChart("Unity Catalog column metadata is missing. Reselect the table before previewing the chart.");
  }
  return {
    kind: isComplete ? "unityCatalogTable" : "none",
    catalog,
    schema,
    table,
    database: null,
    instanceName: null,
    endpoint: null,
    resourceEnvironmentVariable: null,
    columns,
  };
}

/** Quotes one validated table or column identifier for its SQL dialect. */
export function quoteChartIdentifier(
  value: string,
  kind: ChartBinding["kind"] = "unityCatalogTable",
): string {
  if (kind === "lakebaseAutoscaling" || kind === "lakebaseProvisionedDatabase") {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return `\`${value.replaceAll("`", "``")}\``;
}

/** Builds a table reference using the catalog structure of the selected source. */
export function quoteChartTable(binding: ChartBinding): string {
  const names = binding.kind === "lakebaseAutoscaling" || binding.kind === "lakebaseProvisionedDatabase"
    ? [binding.schema, binding.table]
    : [binding.catalog, binding.schema, binding.table];
  return names.map((name) => quoteChartIdentifier(name ?? "", binding.kind)).join(".");
}

/** Returns generated call options for user-scoped Lakebase queries. */
export function lakebaseQueryOptions(binding: ChartBinding): string {
  if (binding.kind !== "lakebaseAutoscaling") {
    return "";
  }
  return `, source_kind='lakebaseAutoscaling', database=${pythonString(binding.database ?? "")}, endpoint=${pythonString(binding.endpoint ?? "")}, resource_environment_variable=${pythonString(binding.resourceEnvironmentVariable ?? "")}`;
}

/** Builds a generated query call using the selected workspace database source. */
export function lakebaseQueryExpression(
  binding: ChartBinding,
  maxRows: number,
  queryStatement?: string,
): string {
  const queryArgument = queryStatement === undefined
    ? ""
    : `, query_statement=${pythonString(queryStatement)}`;
  if (binding.kind === "lakebaseProvisionedDatabase") {
    return `_vdab_lakebase_provisioned_query_df(${pythonString(binding.schema ?? "")}, ${pythonString(binding.table ?? "")}, ${maxRows}${queryArgument}, database=${pythonString(binding.database ?? "")}, instance_name=${pythonString(binding.instanceName ?? "")}, resource_environment_variable=${pythonString(binding.resourceEnvironmentVariable ?? "")})`;
  }
  return `_vdab_sql_query_df(${pythonString(binding.catalog ?? "")}, ${pythonString(binding.schema ?? "")}, ${pythonString(binding.table ?? "")}, ${maxRows}${queryArgument}${lakebaseQueryOptions(binding)})`;
}

/** Builds an allowlisted aggregate expression over a quoted field identifier. */
export function chartMeasureExpression(
  field: string,
  transform: string,
  invalidChart: ChartErrorFactory,
  kind: ChartBinding["kind"] = "unityCatalogTable",
): string {
  const quotedField = quoteChartIdentifier(field, kind);
  switch (transform) {
    case "count": return `COUNT(${quotedField})`;
    case "count_distinct": return `COUNT(DISTINCT ${quotedField})`;
    case "avg": return `AVG(${quotedField})`;
    case "min": return `MIN(${quotedField})`;
    case "max": return `MAX(${quotedField})`;
    case "none":
    case "sum": return `SUM(${quotedField})`;
    default: throw invalidChart("Chart aggregate is not supported.");
  }
}

/** Classifies SQL metadata used to validate aggregate compatibility. */
export function classifyChartColumnType(type: string | null): "numeric" | "temporal" | "categorical" | "unknown" {
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

function validateBindingShape(
  value: unknown,
  bindingType: string,
  invalidChart: ChartErrorFactory,
): Record<string, unknown> {
  const binding = isRecord(value) ? value : null;
  const source = binding !== null && isRecord(binding.source) ? binding.source : null;
  const resource = source !== null && isRecord(source.resource) ? source.resource : null;
  const expectedResourceProperties = [
    "type", "dataSourceFormat", "catalog", "schema", "table", "primaryKeyColumn", "columns",
  ];
  if (bindingType === "lakebaseProvisionedDatabase") {
    expectedResourceProperties.push("database", "instanceName");
  } else if (bindingType === "lakebaseAutoscaling") {
    expectedResourceProperties.push("database", "databaseId", "projectId", "branchId", "endpointId");
  }
  if (
    binding === null || hasUnexpectedProperties(binding, ["bindingType", "source"]) ||
    binding.bindingType !== bindingType || source === null ||
    hasUnexpectedProperties(source, ["kind", "valueType", "resource"]) ||
    source.kind !== "resource" || source.valueType !== "table" || resource === null ||
    hasUnexpectedProperties(resource, expectedResourceProperties) || resource.type !== bindingType
  ) {
    throw invalidChart("Chart table binding is invalid.");
  }

  readColumns(resource.columns, invalidChart);
  for (const name of [
    "catalog", "schema", "table", "primaryKeyColumn", "database", "databaseId", "instanceName", "projectId", "branchId", "endpointId",
  ]) {
    if (resource[name] !== undefined && resource[name] !== null) {
      readResourceName(resource[name], invalidChart);
    }
  }
  if (resource.dataSourceFormat !== undefined && resource.dataSourceFormat !== null &&
      (typeof resource.dataSourceFormat !== "string" || resource.dataSourceFormat.length > 100)) {
    throw invalidChart("Chart table format metadata is invalid.");
  }
  return resource;
}

function readColumns(value: unknown, invalidChart: ChartErrorFactory): ChartColumn[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw invalidChart("Chart column metadata is invalid.");
  }

  const columns = value.map((column): ChartColumn => {
    if (
      !isRecord(column) || hasUnexpectedProperties(column, ["name", "type", "dataType"]) ||
      typeof column.name !== "string" || column.name.length < 1 || column.name.length > 255 ||
      column.name.trim() !== column.name || /[\u0000-\u001f\u007f]/.test(column.name) ||
      (column.type !== undefined && column.type !== null && typeof column.type !== "string") ||
      (column.dataType !== undefined && column.dataType !== null && typeof column.dataType !== "string")
    ) {
      throw invalidChart("Chart column metadata is invalid.");
    }
    return { name: column.name, type: readNullableType(column.type ?? column.dataType, invalidChart) };
  });
  if (new Set(columns.map((column) => column.name)).size !== columns.length) {
    throw invalidChart("Chart column names must be unique.");
  }
  return columns;
}

function readResourceName(value: unknown, invalidChart: ChartErrorFactory): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (
    typeof value !== "string" || value.length < 1 || value.length > 255 ||
    value.trim() !== value || value.includes("/") || value.includes("\\") ||
    value === "." || value === ".." || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidChart("Unity Catalog resource names must be valid text.");
  }
  return value;
}

function readLakebaseIdentifier(
  value: unknown,
  label: string,
  invalidChart: ChartErrorFactory,
): string | null {
  const identifier = readResourceName(value, invalidChart);
  if (identifier !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(identifier)) {
    throw invalidChart(`Lakebase ${label} reference has an invalid format.`);
  }
  return identifier;
}

function readNullableType(value: unknown, invalidChart: ChartErrorFactory): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length > 255) {
    throw invalidChart("Chart column type metadata is invalid.");
  }
  return value;
}

function emptyBinding(kind: ChartBinding["kind"]): ChartBinding {
  return {
    kind,
    catalog: null,
    schema: null,
    table: null,
    database: null,
    instanceName: null,
    endpoint: null,
    resourceEnvironmentVariable: null,
    columns: [],
  };
}
