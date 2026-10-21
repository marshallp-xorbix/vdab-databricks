import type { ProjectComponent, ProjectJsonObject } from "../db/project-components-contract.ts";
import { hasUnexpectedProperties } from "../db/project-component-json.ts";
import { invalidDataWindow } from "./preview-errors.ts";
import { pythonString, pythonStringList } from "./preview-python.ts";
import { appendWorkflowCallbackArguments } from "./preview-workflow-runtime.ts";

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

interface EditableProperties {
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

interface EditableTableBinding {
  catalog: string | null;
  schema: string | null;
  table: string | null;
  dataSourceFormat: string | null;
  primaryKeyColumn: string | null;
  columns: Array<{ name: string; type: string | null; dataType: string | null }>;
}

/** Validates and appends one viewer-authorized EditableDataWindow. */
export function appendEditableDataWindow(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  workflowEventKey?: string,
  supportsWorkflowBinding = false,
): void {
  const properties = readProperties(component);
  const binding = readBinding(component.bindings);
  const columnNames = binding.columns.map((column) => column.name);
  const variable = `${variableName}_table`;
  lines.push(
    "",
    `st.subheader(${pythonString(properties.label)})`,
  );

  if (!isComplete(binding)) {
    appendUnboundEditor(
      lines,
      variable,
      properties,
      columnNames,
      component.key,
      component.codeName ?? component.key,
      supportsWorkflowBinding,
    );
    return;
  }

  if (binding.dataSourceFormat !== "DELTA") {
    appendReadOnlyBoundEditor(
      lines,
      variable,
      component,
      binding,
      properties,
      supportsWorkflowBinding,
    );
    return;
  }

  const sqlColumns = binding.columns.map((column) => ({
    name: column.name,
    sqlType: readSqlType(column),
  }));
  if (
    binding.primaryKeyColumn === null ||
    !sqlColumns.some((column) => column.name === binding.primaryKeyColumn)
  ) {
    throw invalidDataWindow("EditableDataWindow requires a primary key column in its table metadata.");
  }
  appendBoundEditor(
    lines,
    variable,
    component,
    binding,
    sqlColumns,
    properties,
    workflowEventKey,
    supportsWorkflowBinding,
  );
}

function appendUnboundEditor(
  lines: string[],
  variable: string,
  properties: EditableProperties,
  columns: string[],
  key: string,
  codeName: string,
  supportsWorkflowBinding: boolean,
): void {
  const emptyEditorLines = [
    "st.info('Select a complete Unity Catalog table binding and primary key to enable saves.')",
    `${variable}_data = pd.DataFrame(columns=${pythonStringList(columns)})`,
    `${variable}_edited = st.data_editor(${variable}_data, disabled=True, num_rows='fixed', width=${pythonValue(properties.width)}, height=${pythonValue(properties.scrollable ? properties.height : "content")}, hide_index=${pythonNullableBoolean(properties.hideIndex)}, placeholder=${pythonNullableString(properties.placeholder)}, key=${pythonString(key)})`,
  ];
  if (supportsWorkflowBinding) {
    const overrideVariable = `${variable}_binding_override`;
    lines.push(
      `${overrideVariable} = binding_overrides.get(${pythonString(`${codeName}:unityCatalogTable`)})`,
      `if ${overrideVariable} is not None:`,
      `    ${variable}_workflow_data = _vdab_binding_override_to_dataframe(${overrideVariable})`,
      `    st.dataframe(${variable}_workflow_data, width=${pythonValue(properties.width)}, height=${pythonValue(properties.scrollable ? properties.height : "content")}, hide_index=${pythonNullableBoolean(properties.hideIndex)}, key=${pythonString(key)})`,
      "else:",
      ...emptyEditorLines.map((line) => `    ${line}`),
    );
  } else {
    lines.push(...emptyEditorLines);
  }
}

function appendReadOnlyBoundEditor(
  lines: string[],
  variable: string,
  component: ProjectComponent,
  binding: EditableTableBinding,
  properties: EditableProperties,
  supportsWorkflowBinding: boolean,
): void {
  const columnNames = binding.columns.map((column) => column.name);
  const staticEditorLines = [
    "try:",
    `    ${variable}_data = _vdab_sql_query_df(${pythonString(binding.catalog as string)}, ${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${properties.maxRows})`,
    "except RuntimeError as " + `${variable}_error:`,
    `    st.error(str(${variable}_error))`,
    `    ${variable}_data = pd.DataFrame(columns=${pythonStringList(columnNames)})`,
    "st.info('Row saves require a Delta table. This Unity Catalog table is shown read-only.')",
    `${variable}_edited = st.data_editor(${variable}_data, disabled=True, num_rows='fixed', width=${pythonValue(properties.width)}, height=${pythonValue(properties.scrollable ? properties.height : "content")}, hide_index=${pythonNullableBoolean(properties.hideIndex)}, placeholder=${pythonNullableString(properties.placeholder)}, key=${pythonString(component.key)})`,
  ];
  if (supportsWorkflowBinding) {
    const overrideVariable = `${variable}_binding_override`;
    const codeName = component.codeName ?? component.key;
    lines.push(
      `${overrideVariable} = binding_overrides.get(${pythonString(`${codeName}:unityCatalogTable`)})`,
      `if ${overrideVariable} is not None:`,
      `    ${variable}_workflow_data = _vdab_binding_override_to_dataframe(${overrideVariable})`,
      `    st.dataframe(${variable}_workflow_data, width=${pythonValue(properties.width)}, height=${pythonValue(properties.scrollable ? properties.height : "content")}, hide_index=${pythonNullableBoolean(properties.hideIndex)}, key=${pythonString(component.key)})`,
      "else:",
      ...staticEditorLines.map((line) => `    ${line}`),
    );
  } else {
    lines.push(...staticEditorLines);
  }
}

function appendBoundEditor(
  lines: string[],
  variable: string,
  component: ProjectComponent,
  binding: EditableTableBinding,
  sqlColumns: Array<{ name: string; sqlType: string }>,
  properties: EditableProperties,
  workflowEventKey?: string,
  supportsWorkflowBinding = false,
): void {
  const sqlColumnSpecs = sqlColumns
    .map((column) => `(${pythonString(column.name)}, ${pythonString(column.sqlType)})`)
    .join(", ");
  const sqlColumnsLiteral = `[${sqlColumnSpecs}]`;

  appendBoundEditorLoad(
    lines,
    variable,
    component,
    binding,
    sqlColumns,
    sqlColumnsLiteral,
    properties,
    supportsWorkflowBinding,
  );
  appendBoundEditorWidget(lines, variable, component, properties, workflowEventKey);
  appendBoundEditorSave(lines, variable, component, binding, sqlColumns, sqlColumnsLiteral, properties);
}

function appendBoundEditorLoad(
  lines: string[],
  variable: string,
  component: ProjectComponent,
  binding: EditableTableBinding,
  sqlColumns: Array<{ name: string; sqlType: string }>,
  sqlColumnsLiteral: string,
  properties: EditableProperties,
  supportsWorkflowBinding: boolean,
): void {
  const columnNames = sqlColumns.map((column) => column.name);
  const disabledColumns = properties.disabled
    ? `[column[0] for column in ${sqlColumnsLiteral}]`
    : `[${pythonString(binding.primaryKeyColumn as string)}]`;
  const staticLoadLines = [
    "try:",
    `    ${variable}_original = _vdab_sql_query_df(${pythonString(binding.catalog as string)}, ${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${properties.maxRows})`,
    `    if list(${variable}_original.columns) != ${pythonStringList(columnNames)}:`,
    "        raise RuntimeError('The current table columns differ from the saved binding. Refresh the builder binding before editing.')",
    `    ${variable}_load_error = None`,
    `except RuntimeError as ${variable}_error:`,
    `    ${variable}_load_error = str(${variable}_error)`,
    `    ${variable}_original = pd.DataFrame(columns=${pythonStringList(columnNames)})`,
    `if ${variable}_load_error is not None:`,
    `    st.error(${variable}_load_error)`,
    `    ${variable}_disabled_columns = [column[0] for column in ${sqlColumnsLiteral}]`,
    "else:",
    `    ${variable}_disabled_columns = ${disabledColumns}`,
  ];
  if (supportsWorkflowBinding) {
    const overrideVariable = `${variable}_binding_override`;
    const codeName = component.codeName ?? component.key;
    lines.push(
      `${overrideVariable} = binding_overrides.get(${pythonString(`${codeName}:unityCatalogTable`)})`,
      `if ${overrideVariable} is not None:`,
      `    ${variable}_original = _vdab_binding_override_to_dataframe(${overrideVariable})`,
      `    if list(${variable}_original.columns) != ${pythonStringList(columnNames)}:`,
      `        ${variable}_load_error = 'Workflow results do not match this table schema.'`,
      `        ${variable}_original = pd.DataFrame(columns=${pythonStringList(columnNames)})`,
      "    else:",
      `        ${variable}_load_error = None`,
      "else:",
      ...staticLoadLines.map((line) => `    ${line}`),
    );
  } else {
    lines.push(...staticLoadLines);
  }
}

function appendBoundEditorWidget(
  lines: string[],
  variable: string,
  component: ProjectComponent,
  properties: EditableProperties,
  workflowEventKey?: string,
): void {
  lines.push(
    `if ${variable}_load_error is None and not ${pythonString(properties.numRows)} == 'dynamic':`,
    `    ${variable}_num_rows = 'fixed'`,
    "else:",
    `    ${variable}_num_rows = ${pythonString(properties.numRows)}`,
    `${variable}_edited = st.data_editor(`,
    `    ${variable}_original,`,
    `    disabled=${variable}_disabled_columns,`,
    `    num_rows=${variable}_num_rows,`,
    `    width=${pythonValue(properties.width)},`,
    `    height=${pythonValue(properties.scrollable ? properties.height : "content")},`,
    `    hide_index=${pythonNullableBoolean(properties.hideIndex)},`,
    `    placeholder=${pythonNullableString(properties.placeholder)},`,
    `    key=${pythonString(component.key)},`,
  );
  appendWorkflowCallbackArguments(lines, component.key, workflowEventKey);
  lines.push(")");
}

function appendBoundEditorSave(
  lines: string[],
  variable: string,
  component: ProjectComponent,
  binding: EditableTableBinding,
  sqlColumns: Array<{ name: string; sqlType: string }>,
  sqlColumnsLiteral: string,
  properties: EditableProperties,
): void {
  lines.push(
    `if ${variable}_load_error is None and not ${properties.disabled ? "True" : "False"} and st.button('Save changes', key=${pythonString(`${component.key}_save`)}):`,
    `    try:`,
    `        ${variable}_changes = _vdab_diff_table(${variable}_original, ${variable}_edited, ${pythonString(binding.primaryKeyColumn as string)}, ${pythonStringList(sqlColumns.map((column) => column.name))})`,
    `        if ${variable}_changes:`,
    `            _vdab_sql_validate_primary_key(${pythonString(binding.catalog as string)}, ${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${pythonString(binding.primaryKeyColumn as string)})`,
    `            _vdab_sql_merge_rows(${pythonString(binding.catalog as string)}, ${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${sqlColumnsLiteral}, ${pythonString(binding.primaryKeyColumn as string)}, ${variable}_changes)`,
    `        st.success(f"Saved {len(${variable}_changes):d} changed row(s).")`,
    `        st.rerun()`,
    `    except RuntimeError as ${variable}_save_error:`,
    `        st.error(str(${variable}_save_error))`,
  );
}

function readProperties(component: ProjectComponent): EditableProperties {
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

function readBinding(bindings: ProjectJsonObject | null): EditableTableBinding {
  if (bindings === null) {
    return {
      catalog: null,
      schema: null,
      table: null,
      dataSourceFormat: null,
      primaryKeyColumn: null,
      columns: [],
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
    catalog: readResourceName(resource.catalog),
    schema: readResourceName(resource.schema),
    table: readResourceName(resource.table),
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
    if (!isRecord(column) || hasUnexpectedProperties(column, ["name", "type", "dataType"])) {
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

function readSqlType(column: EditableTableBinding["columns"][number]): string {
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

function isComplete(binding: EditableTableBinding): boolean {
  return binding.catalog !== null && binding.schema !== null && binding.table !== null;
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

function pythonValue(value: string | number): string {
  return typeof value === "string" ? pythonString(value) : String(value);
}

function pythonNullableBoolean(value: boolean | null): string {
  return value === null ? "None" : value ? "True" : "False";
}

function pythonNullableString(value: string | null): string {
  return value === null ? "None" : pythonString(value);
}
