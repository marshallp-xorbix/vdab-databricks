import type {
  ProjectComponent,
  ProjectJsonObject,
} from "../db/project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "../db/project-component-json.ts";
import { invalidCartesianChart } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  classifyChartColumnType,
  MAX_CHART_ROWS,
  lakebaseQueryExpression,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding, ChartColumn } from "./preview-chart-bindings.ts";

const PROPERTY_NAMES = ["title", "seriesColor", "xAxis", "yAxis"];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const X_TRANSFORMS = new Set(["none", "yearly", "monthly", "weekly", "daily"]);
const Y_TRANSFORMS = new Set(["none", "sum", "avg", "count", "count_distinct", "min", "max"]);
const TIME_TRANSFORMS = new Set(["yearly", "monthly", "weekly", "daily"]);
interface ChartAxis {
  field: string;
  displayName: string;
  scaleType: string;
  transform: string;
}

type CartesianChartType = "BarChart" | "LineChart";

interface CartesianChartProperties {
  title: string;
  seriesColor: string;
  xAxis: ChartAxis;
  yAxis: ChartAxis;
}

/** Appends a viewer-authorized Unity Catalog query and native Streamlit chart. */
export function appendCartesianChart(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  supportsWorkflowBinding = false,
): void {
  const chartType = component.type as CartesianChartType;
  const properties = readProperties(component, chartType);
  const binding = readChartBinding(component.bindings, invalidCartesianChart);
  const labelName = `_vdab_disp_lbl_${variableName}`;
  const codeName = component.codeName ?? component.key;

  lines.push(
    "",
    `_vdab_lbl_${variableName} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${labelName} = _vdab_lbl_${variableName} if _vdab_lbl_${variableName} is not None else ${pythonString(properties.title)}`,
    `st.subheader(${labelName})`,
  );

  if (binding.kind === "unsupported" && !supportsWorkflowBinding) {
    lines.push("st.info('The saved Lakebase table binding is preserved. This chart preview requires a Unity Catalog table in the hosting workspace.')");
    return;
  }

  const query = binding.kind === "unityCatalogTable" || binding.kind === "lakebaseAutoscaling" || binding.kind === "lakebaseProvisionedDatabase"
    ? buildChartQuery(binding, properties, chartType)
    : null;
  if (query === null && !supportsWorkflowBinding) {
    const hint = chartType === "LineChart"
      ? "Bind a Unity Catalog table and choose X and Y columns to render this line chart."
      : "Bind a Unity Catalog table, choose an X column, and configure a Y aggregate to render this chart.";
    lines.push(`st.info(${pythonString(hint)})`);
    return;
  }

  const xType = resolveVegaType(properties.xAxis, binding.columns, supportsWorkflowBinding);
  const xTitle = readAxisTitle(properties.xAxis, "xAxis");
  const yTitle = readAxisTitle(properties.yAxis, "yAxis");
  const spec = buildVegaLiteSpec(chartType, properties, xType, xTitle, yTitle);
  const dimensionField = chartType === "LineChart" ? "x" : "category";
  const measureField = chartType === "LineChart" ? "y" : "value";
  const emptyColumns = chartType === "LineChart" ? "['x', 'y']" : "['category', 'value']";
  const emptyMessage = chartType === "LineChart"
    ? "No plottable rows for this line chart."
    : "No plottable rows for this bar chart.";
  const dataLines = query === null
    ? [
      `${variableName}_data = pd.DataFrame(columns=${emptyColumns})`,
      `st.info(${pythonString(binding.kind === "unsupported"
        ? "The saved Lakebase table binding is preserved. Bind a Unity Catalog table or set chart data through a workflow."
        : "Set chart data through a workflow or bind a Unity Catalog table to render this chart.")})`,
    ]
    : [
      "try:",
      `    ${variableName}_data = ${lakebaseQueryExpression(binding, MAX_CHART_ROWS, query)}`,
      `except RuntimeError as vdab_error_${variableName}:`,
      `    st.error(str(vdab_error_${variableName}))`,
      `    ${variableName}_data = pd.DataFrame(columns=${emptyColumns})`,
    ];
  if (supportsWorkflowBinding) {
    const overrideVariable = `_vdab_chart_binding_override_${variableName}`;
    lines.push(
      `${overrideVariable} = binding_overrides.get(${pythonString(`${codeName}:chartData`)})`,
      `if ${overrideVariable} is not None:`,
      `    ${variableName}_data = _vdab_binding_override_to_dataframe(${overrideVariable})`,
      "else:",
      ...dataLines.map((line) => `    ${line}`),
    );
  } else {
    lines.push(...dataLines);
  }
  lines.push(
    `if not ${variableName}_data.empty and ${pythonString(dimensionField)} in ${variableName}_data.columns and ${pythonString(measureField)} in ${variableName}_data.columns:`,
    `    ${variableName}_data = ${variableName}_data[[${pythonString(dimensionField)}, ${pythonString(measureField)}]].copy()`,
    `    ${variableName}_data = ${variableName}_data[${variableName}_data[${pythonString(dimensionField)}].astype(str).str.strip() != '']`,
    `    ${variableName}_data[${pythonString(measureField)}] = pd.to_numeric(${variableName}_data[${pythonString(measureField)}], errors='coerce')`,
    `    ${variableName}_data = ${variableName}_data.dropna(subset=[${pythonString(dimensionField)}, ${pythonString(measureField)}])`,
    `    if not ${variableName}_data.empty:`,
    `        st.vega_lite_chart(data=${variableName}_data, spec=${spec}, width='stretch', key=${pythonString(component.key)})`,
    "    else:",
    `        st.info(${pythonString(emptyMessage)})`,
    "else:",
    `    st.info(${pythonString(emptyMessage)})`,
  );
}

function readAxisTitle(axis: ChartAxis, kind: "xAxis" | "yAxis"): string {
  const displayName = axis.displayName.trim();
  if (displayName !== "") {
    return displayName;
  }

  const transform = axis.transform.toLowerCase();
  if (kind === "yAxis" && axis.field === "" && transform === "count") {
    return "COUNT(*)";
  }
  if (axis.field === "") {
    return "";
  }
  if (transform === "none") {
    return axis.field;
  }
  return `${transform}(${axis.field})`;
}

function readProperties(
  component: ProjectComponent,
  chartType: CartesianChartType,
): CartesianChartProperties {
  if (
    component.type !== chartType ||
    component.schemaVersion !== 1 ||
    component.children.length > 0 ||
    component.layout !== null ||
    hasUnexpectedProperties(component.properties, PROPERTY_NAMES)
  ) {
    throw invalidCartesianChart("The chart contains an unsupported component shape.");
  }

  const title = readOptionalText(
    component.properties.title,
    chartType === "LineChart" ? "Line Chart" : "Bar Chart",
    500,
  );
  const seriesColor = readOptionalText(component.properties.seriesColor, "#1f77b4", 7);
  if (!/^#[0-9a-f]{6}$/i.test(seriesColor)) {
    throw invalidCartesianChart("Chart seriesColor must be a six-digit hexadecimal color.");
  }

  const xAxis = readAxis(
    component.properties.xAxis,
    chartType === "BarChart" ? "categorical" : "continuous",
    "none",
    X_TRANSFORMS,
  );
  if (chartType === "LineChart" && xAxis.transform !== "none") {
    throw invalidCartesianChart("Line charts do not support X axis bucketing.");
  }

  return {
    title,
    seriesColor,
    xAxis,
    yAxis: readAxis(component.properties.yAxis, "continuous", chartType === "BarChart" ? "count" : "none", Y_TRANSFORMS),
  };
}

function readAxis(
  value: unknown,
  defaultScale: string,
  defaultTransform: string,
  transforms: Set<string>,
): ChartAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType: defaultScale, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw invalidCartesianChart("Chart axis configuration is invalid.");
  }

  const field = readOptionalText(value.field, "", 255);
  const displayName = readOptionalText(value.displayName, "", 500);
  const scaleType = value.scaleType ?? defaultScale;
  const transform = value.transform ?? defaultTransform;
  if (
    (scaleType !== "categorical" && scaleType !== "continuous") ||
    typeof transform !== "string" || !transforms.has(transform)
  ) {
    throw invalidCartesianChart("Chart axis scale or transform is not supported.");
  }
  if (field.trim() !== field) {
    throw invalidCartesianChart("Chart axis column names must not include surrounding whitespace.");
  }
  return { field, displayName, scaleType, transform };
}

function buildChartQuery(
  binding: ChartBinding,
  properties: CartesianChartProperties,
  chartType: CartesianChartType,
): string | null {
  const xColumn = properties.xAxis.field === ""
    ? null
    : binding.columns.find((column) => column.name === properties.xAxis.field) ?? null;
  const yColumn = properties.yAxis.field === ""
    ? null
    : binding.columns.find((column) => column.name === properties.yAxis.field) ?? null;
  if (properties.xAxis.field !== "" && xColumn === null) {
    throw invalidCartesianChart("Chart X axis must reference a column in the selected table.");
  }
  if (properties.yAxis.field !== "" && yColumn === null) {
    throw invalidCartesianChart("Chart Y axis must reference a column in the selected table.");
  }
  if (xColumn !== null) {
    validateAxisType(properties.xAxis, xColumn, true);
  }
  if (yColumn !== null) {
    validateAxisType(properties.yAxis, yColumn, false);
  }
  if (xColumn === null) {
    return null;
  }

  const xIdentifier = quoteChartIdentifier(xColumn.name, binding.kind);
  const xExpression = TIME_TRANSFORMS.has(properties.xAxis.transform)
    ? `DATE_TRUNC('${dateTruncUnit(properties.xAxis.transform)}', ${xIdentifier})`
    : xIdentifier;
  const tableReference = quoteChartTable(binding);
  if (chartType === "LineChart") {
    if (yColumn === null) {
      return null;
    }
    const yIdentifier = quoteChartIdentifier(yColumn.name, binding.kind);
    if (properties.yAxis.transform === "none") {
      return `SELECT ${xExpression} AS x, ${yIdentifier} AS y FROM ${tableReference} ORDER BY x`;
    }
    const aggregate = chartMeasureExpression(yColumn.name, properties.yAxis.transform, invalidCartesianChart, binding.kind);
    return `SELECT ${xExpression} AS x, ${aggregate} AS y FROM ${tableReference} GROUP BY ${xExpression} ORDER BY x`;
  }

  let yExpression: string;
  if (properties.yAxis.field === "") {
    if (properties.yAxis.transform !== "count") {
      return null;
    }
    yExpression = "COUNT(*)";
  } else {
    yExpression = chartMeasureExpression(yColumn?.name ?? "", properties.yAxis.transform, invalidCartesianChart, binding.kind);
  }

  return `SELECT ${xExpression} AS category, ${yExpression} AS value FROM ${tableReference} GROUP BY ${xExpression} ORDER BY category`;
}

function validateAxisType(axis: ChartAxis, column: ChartColumn, isDimension: boolean): void {
  const category = classifyChartColumnType(column.type);
  if (isDimension) {
    if (TIME_TRANSFORMS.has(axis.transform) && category !== "temporal") {
      throw invalidCartesianChart("Date bucketing requires a date or timestamp X column.");
    }
    if (axis.scaleType === "continuous" && category !== "numeric" && category !== "temporal") {
      throw invalidCartesianChart("A continuous X axis requires a numeric or temporal column.");
    }
    return;
  }

  const allowed = category === "numeric"
    ? Y_TRANSFORMS
    : category === "temporal"
      ? new Set(["count", "count_distinct", "min", "max"])
      : new Set(["count", "count_distinct"]);
  if (!allowed.has(axis.transform)) {
    throw invalidCartesianChart("The selected Y aggregate is not valid for the column type.");
  }
}

function resolveVegaType(
  axis: ChartAxis,
  columns: ChartColumn[],
  allowUnknownColumn = false,
): string {
  const column = columns.find((item) => item.name === axis.field);
  if (column === undefined) {
    if (allowUnknownColumn) {
      if (TIME_TRANSFORMS.has(axis.transform)) return "temporal";
      return axis.scaleType === "continuous" ? "quantitative" : "nominal";
    }
    throw invalidCartesianChart("Chart X axis metadata is unavailable.");
  }
  const category = classifyChartColumnType(column.type);
  if (TIME_TRANSFORMS.has(axis.transform) || category === "temporal") {
    return "temporal";
  }
  return axis.scaleType === "continuous" && category === "numeric"
    ? "quantitative"
    : "nominal";
}

function buildVegaLiteSpec(
  chartType: CartesianChartType,
  properties: CartesianChartProperties,
  xType: string,
  xTitle: string,
  yTitle: string,
): string {
  const dimensionField = chartType === "LineChart" ? "x" : "category";
  const measureField = chartType === "LineChart" ? "y" : "value";
  const mark = chartType === "LineChart"
    ? `{'type': 'line', 'point': True, 'color': ${pythonString(properties.seriesColor)}}`
    : `{'type': 'bar', 'color': ${pythonString(properties.seriesColor)}}`;
  return `{'mark': ${mark}, 'encoding': {'x': {'field': ${pythonString(dimensionField)}, 'type': ${pythonString(xType)}, 'title': ${pythonString(xTitle)}}, 'y': {'field': ${pythonString(measureField)}, 'type': 'quantitative', 'title': ${pythonString(yTitle)}}}}`;
}

function dateTruncUnit(transform: string): string {
  switch (transform) {
    case "yearly": return "year";
    case "monthly": return "month";
    case "weekly": return "week";
    case "daily": return "day";
    default: throw invalidCartesianChart("Chart date bucket is not supported.");
  }
}

function readOptionalText(value: unknown, defaultValue: string, maxLength: number): string {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw invalidCartesianChart("Chart text properties are invalid.");
  }
  return value;
}


