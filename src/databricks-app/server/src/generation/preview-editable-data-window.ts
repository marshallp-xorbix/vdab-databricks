import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidDataWindow } from "./preview-errors.ts";
import { isComplete, readBinding, readProperties, readSqlType } from "./preview-editable-data-window-input.ts";
import type { EditableProperties, EditableTableBinding } from "./preview-editable-data-window-input.ts";
import { pythonString, pythonStringList } from "./preview-python.ts";
import { appendWorkflowCallbackArguments } from "./preview-workflow-runtime.ts";

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

  const lakebaseBinding = binding.kind === "lakebaseProvisionedDatabase" ||
    binding.kind === "lakebaseAutoscaling";
  if (!lakebaseBinding && binding.dataSourceFormat !== "DELTA") {
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
    sqlType: lakebaseBinding ? readLakebaseColumnType(column) : readSqlType(column),
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

function readLakebaseColumnType(column: EditableTableBinding["columns"][number]): string {
  const dataType = (column.dataType ?? column.type ?? "").toLowerCase();
  const supportedTypes = new Set([
    "boolean", "smallint", "integer", "bigint", "real", "double precision",
    "numeric", "decimal", "text", "character varying", "character", "date",
    "timestamp without time zone", "timestamp with time zone", "time without time zone",
    "time with time zone", "uuid",
  ]);
  if (!supportedTypes.has(dataType)) {
    throw invalidDataWindow(`EditableDataWindow cannot safely edit Lakebase column ${column.name} with this data type.`);
  }
  return "TEXT";
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
    "st.info('Select a complete Unity Catalog or Lakebase table binding and primary key to enable saves.')",
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
    `    ${variable}_original = ${buildEditableTableQuery(binding, properties.maxRows)}`,
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
  const lakebaseBinding = binding.kind === "lakebaseProvisionedDatabase" ||
    binding.kind === "lakebaseAutoscaling";
  const saveLines = lakebaseBinding
    ? [
        `if ${variable}_load_error is None and not ${properties.disabled ? "True" : "False"} and st.button('Save changes', key=${pythonString(`${component.key}_save`)}):`,
        `    try:`,
        `        ${variable}_changes = _vdab_diff_table(${variable}_original, ${variable}_edited, ${pythonString(binding.primaryKeyColumn as string)}, ${pythonStringList(sqlColumns.map((column) => column.name))})`,
        `        if ${variable}_changes:`,
        `            _vdab_lakebase_save_editable_rows(${pythonString(binding.kind)}, ${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${pythonString(binding.database as string)}, ${pythonString(binding.endpoint ?? "")}, ${pythonString(binding.instanceName ?? "")}, ${pythonString(binding.primaryKeyColumn as string)}, ${pythonStringList(sqlColumns.map((column) => column.name))}, ${variable}_changes, ${pythonString(binding.resourceEnvironmentVariable ?? "")})`,
        `        st.success(f"Saved {len(${variable}_changes):d} changed row(s).")`,
        `        st.rerun()`,
        `    except RuntimeError as ${variable}_save_error:`,
        `        st.error(str(${variable}_save_error))`,
      ]
    : [
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
      ];
  lines.push(...saveLines);
}

function buildEditableTableQuery(binding: EditableTableBinding, maxRows: number): string {
  if (binding.kind === "lakebaseProvisionedDatabase") {
    return `_vdab_lakebase_provisioned_query_df(${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${maxRows}, database=${pythonString(binding.database as string)}, instance_name=${pythonString(binding.instanceName as string)}, resource_environment_variable=${pythonString(binding.resourceEnvironmentVariable ?? "")})`;
  }
  if (binding.kind === "lakebaseAutoscaling") {
    return `_vdab_sql_query_df('', ${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${maxRows}, source_kind='lakebaseAutoscaling', database=${pythonString(binding.database as string)}, endpoint=${pythonString(binding.endpoint as string)}, resource_environment_variable=${pythonString(binding.resourceEnvironmentVariable ?? "")})`;
  }
  return `_vdab_sql_query_df(${pythonString(binding.catalog as string)}, ${pythonString(binding.schema as string)}, ${pythonString(binding.table as string)}, ${maxRows})`;
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
