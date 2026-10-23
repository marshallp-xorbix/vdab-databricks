import type {
  ProjectComponent,
  ProjectJsonObject,
} from "../db/project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "../db/project-component-json.ts";
import { invalidDataWindow } from "./preview-errors.ts";
import { pythonString, pythonStringList } from "./preview-python.ts";
import { lakebaseQueryExpression } from "./preview-chart-bindings.ts";
import {
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
} from "../lakebase-app-resource-binding.ts";

const DATA_WINDOW_PROPERTY_NAMES = [
  "label",
  "maxRows",
  "scrollable",
  "placeholder",
  "width",
  "hideIndex",
  "height",
];
const WIDTH_MODES = new Set(["stretch", "content"]);
const HEIGHT_MODES = new Set(["auto", "content", "stretch"]);

interface DataWindowProperties {
  label: string;
  maxRows: number;
  width: string | number;
  height: string | number;
  hideIndex: boolean | null;
  placeholder: string | null;
}

interface TableColumn {
  name: string;
  type: string | null;
}

interface TableBinding {
  kind: "none" | "unityCatalogTable" | "lakebaseProvisionedDatabase" | "lakebaseAutoscaling" | "unsupported";
  catalog: string | null;
  schema: string | null;
  table: string | null;
  database: string | null;
  instanceName: string | null;
  endpoint: string | null;
  resourceEnvironmentVariable: string | null;
  columns: TableColumn[];
}

/** Validates and appends one deterministic DataWindow renderer. */
export function appendDataWindow(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  supportsWorkflowBinding = false,
): void {
  const properties = readDataWindowProperties(component);
  const binding = readTableBinding(component.bindings);
  const labelVariable = `_vdab_disp_lbl_${variableName}`;
  const codeName = component.codeName ?? component.key;
  const fallbackColumns = binding.columns.map((column) => column.name);

  lines.push(
    "",
    `_vdab_lbl_${variableName} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${labelVariable} = _vdab_lbl_${variableName} if _vdab_lbl_${variableName} is not None else ${pythonString(properties.label)}`,
    `st.subheader(${labelVariable})`,
  );

  const dataLines: string[] = [];
  const canQueryBinding =
    binding.schema !== null &&
    binding.table !== null &&
    (binding.kind === "unityCatalogTable" ||
      ((binding.kind === "lakebaseAutoscaling" || binding.kind === "lakebaseProvisionedDatabase") &&
        binding.database !== null &&
        (binding.kind === "lakebaseAutoscaling"
          ? binding.endpoint !== null && binding.resourceEnvironmentVariable !== null
          : binding.instanceName !== null && binding.resourceEnvironmentVariable !== null)));
  if (canQueryBinding) {
    dataLines.push(
      "try:",
      `    ${variableName}_data = ${lakebaseQueryExpression(binding, properties.maxRows)}`,
      `except RuntimeError as vdab_error_${variableName}:`,
      `    st.error(str(vdab_error_${variableName}))`,
      `    ${variableName}_data = pd.DataFrame(columns=${pythonStringList(fallbackColumns)})`,
    );
  } else {
    dataLines.push(
      `# Incomplete table binding: retain schema metadata without inventing a SQL query.`,
      `${variableName}_data = pd.DataFrame(columns=${pythonStringList(fallbackColumns)})`,
    );
  }

  if (supportsWorkflowBinding) {
    const overrideVariable = `_vdab_binding_override_${variableName}`;
    const codeName = component.codeName ?? component.key;
    lines.push(
      `${overrideVariable} = binding_overrides.get(${pythonString(`${codeName}:unityCatalogTable`)})`,
      `if ${overrideVariable} is not None:`,
      `    ${variableName}_data = _vdab_binding_override_to_dataframe(${overrideVariable})`,
      "else:",
      ...dataLines.map((line) => `    ${line}`),
    );
  } else {
    lines.push(...dataLines);
  }

  lines.push(
    `${variableName}_column_config = {`,
    ...binding.columns.map((column) =>
      `    ${pythonString(column.name)}: ${pythonString(column.type ? `${column.name} (${column.type})` : column.name)},`,
    ),
    "}",
    `st.dataframe(${variableName}_data, width=${pythonValue(properties.width)}, height=${pythonValue(properties.height)}, hide_index=${pythonNullableBoolean(properties.hideIndex)}, column_config=${variableName}_column_config, placeholder=${pythonNullableString(properties.placeholder)}, key=${pythonString(component.key)})`,
  );
}

function readDataWindowProperties(component: ProjectComponent): DataWindowProperties {
  if (
    component.type !== "DataWindow" ||
    component.schemaVersion !== 1 ||
    component.children.length > 0 ||
    !isSupportedLayout(component.layout) ||
    hasUnexpectedProperties(component.properties, DATA_WINDOW_PROPERTY_NAMES)
  ) {
    throw invalidDataWindow("DataWindow contains an unsupported component shape.");
  }

  const properties = component.properties;
  const label = readOptionalText(properties, "label", "Data Table");
  const maxRows = readOptionalInteger(properties, "maxRows", 0, 1_000_000);
  const width = readDimension(properties.width, WIDTH_MODES, 4_000, "stretch");
  const height = readDimension(properties.height, HEIGHT_MODES, 10_000, "auto");
  const hideIndex = readOptionalBoolean(properties.hideIndex, null);
  const placeholder = readOptionalNullableText(properties.placeholder, 2_000);

  if (properties.scrollable !== undefined && typeof properties.scrollable !== "boolean") {
    throw invalidDataWindow("DataWindow scrollable must be a boolean.");
  }

  return { label, maxRows, width, height, hideIndex, placeholder };
}

function readTableBinding(bindings: ProjectJsonObject | null): TableBinding {
  if (bindings === null) {
    return { kind: "none", catalog: null, schema: null, table: null, database: null, instanceName: null, endpoint: null, resourceEnvironmentVariable: null, columns: [] };
  }

  const bindingType = Object.keys(bindings)[0];
  if (bindingType !== "unityCatalogTable" && bindingType !== "lakebaseAutoscaling" && bindingType !== "lakebaseProvisionedDatabase") {
    throw invalidDataWindow("DataWindow table binding is not supported.");
  }

  const binding = bindings[bindingType];
  const source = isRecord(binding) ? binding.source : null;
  const resource = isRecord(source) ? source.resource : null;
  if (
    Object.keys(bindings).length !== 1 ||
    !isRecord(binding) ||
    hasUnexpectedProperties(binding, ["bindingType", "source"]) ||
    binding.bindingType !== bindingType ||
    !isRecord(source) ||
    hasUnexpectedProperties(source, ["kind", "valueType", "resource"]) ||
    source.kind !== "resource" ||
    source.valueType !== "table" ||
    !isRecord(resource) ||
    hasUnexpectedProperties(resource, [
      "type",
      "dataSourceFormat",
      "catalog",
      "schema",
      "table",
      "primaryKeyColumn", "columns",
      ...(bindingType === "lakebaseProvisionedDatabase" ? ["database", "instanceName"] : []),
      ...(bindingType === "lakebaseAutoscaling" ? ["database", "databaseId", "projectId", "branchId", "endpointId"] : []),
    ]) ||
    resource.type !== bindingType
  ) {
    throw invalidDataWindow("DataWindow has an invalid table binding.");
  }

  if (bindingType === "lakebaseAutoscaling" || bindingType === "lakebaseProvisionedDatabase") {
    const database = readResourceName(resource.database);
    const instanceName = bindingType === "lakebaseProvisionedDatabase"
      ? readLakebaseIdentifier(resource.instanceName)
      : null;
    const projectId = readLakebaseIdentifier(resource.projectId);
    const branchId = readLakebaseIdentifier(resource.branchId);
    const endpointId = readLakebaseIdentifier(resource.endpointId);
    const databaseId = bindingType === "lakebaseAutoscaling"
      ? readLakebaseIdentifier(resource.databaseId)
      : null;
    const schema = readResourceName(resource.schema);
    const table = readResourceName(resource.table);
    const columns = readColumnMetadata(resource.columns);
    const complete = database !== null && schema !== null && table !== null && columns.length > 0 &&
      (bindingType === "lakebaseProvisionedDatabase"
        ? instanceName !== null
        : projectId !== null && branchId !== null && endpointId !== null && databaseId !== null);
    if (!complete) {
      return { kind: "none", catalog: null, schema, table, database, instanceName, endpoint: null, resourceEnvironmentVariable: null, columns };
    }
    const resourceBinding = bindingType === "lakebaseAutoscaling"
      ? createAutoscalingAppResourceBinding({
        projectId: projectId as string,
        branchId: branchId as string,
        endpointId: endpointId as string,
        databaseId: databaseId as string,
      })
      : createProvisionedAppResourceBinding({ instanceName: instanceName as string, databaseName: database as string });
    return {
      kind: bindingType,
      catalog: null,
      schema,
      table,
      database,
      instanceName,
      endpoint: endpointId === null ? null : `projects/${projectId}/branches/${branchId}/endpoints/${endpointId}`,
      resourceEnvironmentVariable: resourceBinding.environmentVariable,
      columns,
    };
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
    columns: readColumnMetadata(resource.columns),
  };
}

function readColumnMetadata(value: unknown): TableColumn[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw invalidDataWindow("DataWindow table column metadata is invalid.");
  }

  return value.map((column) => {
    if (!isRecord(column)) {
      throw invalidDataWindow("DataWindow table column metadata is invalid.");
    }

    const name = column.name;
    const type = column.type ?? column.type_name ?? column.type_text ?? null;
    if (
      typeof name !== "string" ||
      name.length < 1 ||
      name.length > 255 ||
      (type !== null && typeof type !== "string")
    ) {
      throw invalidDataWindow("DataWindow table column metadata is invalid.");
    }

    return { name, type };
  });
}

function readResourceName(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 255 ||
    value.trim() !== value ||
    value.includes("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidDataWindow("Unity Catalog resource names must be valid text.");
  }

  return value;
}

function readLakebaseIdentifier(value: unknown): string | null {
  const identifier = readResourceName(value);
  if (identifier !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(identifier)) {
    throw invalidDataWindow("Lakebase endpoint references have an invalid format.");
  }
  return identifier;
}

function readOptionalText(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: string,
): string {
  const value = properties[propertyName];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "string" || value.trim() === "" || value.length > 500) {
    throw invalidDataWindow("DataWindow label must be non-empty text.");
  }

  return value;
}

function readOptionalNullableText(
  value: unknown,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || value.length > maxLength) {
    throw invalidDataWindow("DataWindow placeholder must be text.");
  }

  return value;
}

function readOptionalInteger(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: number,
  maximum: number,
): number {
  const value = properties[propertyName];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    throw invalidDataWindow("DataWindow maxRows must be a supported non-negative integer.");
  }

  return value;
}

function readOptionalBoolean(
  value: unknown,
  defaultValue: boolean | null,
): boolean | null {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw invalidDataWindow("DataWindow hideIndex must be a boolean or null.");
  }

  return value;
}

function readDimension(
  value: unknown,
  supportedModes: Set<string>,
  maxPixels: number,
  defaultValue: string,
): string | number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "string" && supportedModes.has(value)) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maxPixels
  ) {
    return value;
  }

  throw invalidDataWindow("DataWindow width or height is not supported by Streamlit.");
}

function isSupportedLayout(layout: ProjectJsonObject | null): boolean {
  if (layout === null) {
    return true;
  }

  if (hasUnexpectedProperties(layout, ["y", "tabIndex"])) {
    return false;
  }

  return (
    (layout.y === undefined ||
      (typeof layout.y === "number" && Number.isFinite(layout.y) && layout.y >= 0)) &&
    (layout.tabIndex === undefined ||
      (typeof layout.tabIndex === "number" &&
        Number.isSafeInteger(layout.tabIndex) &&
        layout.tabIndex >= 0))
  );
}

function pythonValue(value: string | number): string {
  return typeof value === "string" ? pythonString(value) : String(value);
}

function pythonNullableBoolean(value: boolean | null): string {
  return value === null ? "None" : value ? "True" : "False";
}

function pythonNullableString(value: string | null): string {
  return value === null ? "None" : pythonString(value);
}
