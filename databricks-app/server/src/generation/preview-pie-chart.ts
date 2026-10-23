import type {
  ProjectComponent,
  ProjectJsonObject,
} from "../db/project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "../db/project-component-json.ts";
import { invalidDonutChart, invalidPieChart } from "./preview-errors.ts";
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

const PROPERTY_NAMES = ["title", "seriesColor", "category", "value"];
const AXIS_PROPERTY_NAMES = ["field", "displayName", "scaleType", "transform"];
const VALUE_TRANSFORMS = new Set(["none", "sum", "avg", "count", "count_distinct", "min", "max"]);
const TEMPORAL_TRANSFORMS = new Set(["count", "count_distinct", "min", "max"]);
const CATEGORICAL_TRANSFORMS = new Set(["count", "count_distinct"]);
const RADIAL_CHART_OUTER_RADIUS = 120;
const RADIAL_CHART_DONUT_HOLE_RATIO = 0.45;
const RADIAL_CHART_LABEL_RADIUS = 136;

interface RadialChartAxis {
  field: string;
  displayName: string;
  scaleType: string;
  transform: string;
}

interface RadialChartProperties {
  title: string;
  seriesColor: string;
  category: RadialChartAxis;
  value: RadialChartAxis;
}

/** Adds the shared pie/donut palette helper once in a generated app. */
export function appendRadialChartHelpers(lines: string[]): void {
  lines.push(
    "",
    "def _vdab_pie_palette(base_color: str, slice_count: int) -> list[str]:",
    "    clean_color = base_color.lstrip('#')",
    "    channels = tuple(int(clean_color[index:index + 2], 16) for index in (0, 2, 4))",
    "    multipliers = (1.0, 0.88, 0.76, 1.12, 0.66, 0.54)",
    "    colors: list[str] = []",
    "    for color_index in range(slice_count):",
    "        multiplier = multipliers[color_index % len(multipliers)]",
    "        scaled = tuple(min(255, max(0, int(channel * multiplier + 0.5))) for channel in channels)",
    "        colors.append('#' + ''.join(f'{channel:02x}' for channel in scaled))",
    "    return colors",
    "",
  );
}

/** Appends a bounded, viewer-authorized PieChart preview. */
export function appendPieChart(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  supportsWorkflowBinding = false,
): void {
  appendRadialChart(lines, component, variableName, "PieChart", supportsWorkflowBinding);
}

/** Appends a bounded, viewer-authorized DonutChart preview. */
export function appendDonutChart(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  supportsWorkflowBinding = false,
): void {
  appendRadialChart(lines, component, variableName, "DonutChart", supportsWorkflowBinding);
}

function appendRadialChart(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  chartType: "PieChart" | "DonutChart",
  supportsWorkflowBinding: boolean,
): void {
  const invalidChart = chartType === "DonutChart" ? invalidDonutChart : invalidPieChart;
  const chartName = chartType === "DonutChart" ? "donut" : "pie";
  const properties = readProperties(component, chartType, invalidChart);
  const binding = readChartBinding(component.bindings, invalidChart);
  const displayLabel = `_vdab_disp_lbl_${variableName}`;
  const codeName = component.codeName ?? component.key;
  lines.push(
    "",
    `_vdab_lbl_${variableName} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabel} = _vdab_lbl_${variableName} if _vdab_lbl_${variableName} is not None else ${pythonString(properties.title)}`,
    `st.subheader(${displayLabel})`,
  );

  if (binding.kind === "unsupported" && !supportsWorkflowBinding) {
    lines.push("st.info('The saved Lakebase table binding is preserved. This chart preview requires a Unity Catalog table in the hosting workspace.')");
    return;
  }

  const query = binding.kind === "unityCatalogTable" || binding.kind === "lakebaseAutoscaling" || binding.kind === "lakebaseProvisionedDatabase"
    ? buildRadialQuery(binding, properties, invalidChart)
    : null;
  if (query === null && !supportsWorkflowBinding) {
    lines.push(`st.info(${pythonString(`Bind a Unity Catalog table and choose category and value columns to render this ${chartName} chart.`)})`);
    return;
  }

  appendRadialQueryOutput(
    lines,
    component,
    variableName,
    binding,
    properties,
    query,
    chartType,
    chartName,
    supportsWorkflowBinding,
  );
}

function readProperties(
  component: ProjectComponent,
  chartType: "PieChart" | "DonutChart",
  invalidChart: (detail: string) => Error,
): RadialChartProperties {
  if (
    component.type !== chartType || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null ||
    hasUnexpectedProperties(component.properties, PROPERTY_NAMES)
  ) {
    throw invalidChart(`The ${chartType} contains an unsupported component shape.`);
  }
  const title = readOptionalText(
    component.properties.title,
    chartType === "DonutChart" ? "Donut Chart" : "Pie Chart",
    500,
    invalidChart,
  );
  const seriesColor = readOptionalText(component.properties.seriesColor, "#1f77b4", 7, invalidChart);
  if (!/^#[0-9a-f]{6}$/i.test(seriesColor)) {
    throw invalidChart(`${chartType} seriesColor must be a six-digit hexadecimal color.`);
  }
  return {
    title,
    seriesColor,
    category: readAxis(component.properties.category, "categorical", "none", new Set(["none"]), invalidChart),
    value: readAxis(component.properties.value, "continuous", "sum", VALUE_TRANSFORMS, invalidChart),
  };
}

function readAxis(
  value: unknown,
  defaultScale: string,
  defaultTransform: string,
  transforms: Set<string>,
  invalidChart: (detail: string) => Error,
): RadialChartAxis {
  if (value === undefined || value === null) {
    return { field: "", displayName: "", scaleType: defaultScale, transform: defaultTransform };
  }
  if (!isRecord(value) || hasUnexpectedProperties(value, AXIS_PROPERTY_NAMES)) {
    throw invalidChart("Radial chart axis configuration is invalid.");
  }
  const field = readOptionalText(value.field, "", 255, invalidChart);
  const displayName = readOptionalText(value.displayName, "", 500, invalidChart);
  const scaleType = value.scaleType ?? defaultScale;
  const transform = value.transform ?? defaultTransform;
  if (scaleType !== defaultScale || typeof transform !== "string" || !transforms.has(transform)) {
    throw invalidChart("Radial chart axis scale or transform is not supported.");
  }
  return { field, displayName, scaleType, transform };
}

function buildRadialQuery(
  binding: ChartBinding,
  properties: RadialChartProperties,
  invalidChart: (detail: string) => Error,
): string | null {
  const categoryColumn = findColumn(binding.columns, properties.category.field, "category", invalidChart);
  const valueColumn = findColumn(binding.columns, properties.value.field, "value", invalidChart);
  if (categoryColumn === null || valueColumn === null) {
    return null;
  }
  validateValueType(properties.value, valueColumn, invalidChart);

  const categoryExpression = quoteChartIdentifier(categoryColumn.name, binding.kind);
  const valueExpression = properties.value.transform === "none"
    ? quoteChartIdentifier(valueColumn.name, binding.kind)
    : chartMeasureExpression(valueColumn.name, properties.value.transform, invalidChart, binding.kind);
  const tableReference = quoteChartTable(binding);
  const grouping = properties.value.transform === "none"
    ? ""
    : ` GROUP BY ${categoryExpression}`;
  return `SELECT ${categoryExpression} AS category, ${valueExpression} AS value FROM ${tableReference}${grouping} ORDER BY category`;
}

function findColumn(
  columns: ChartColumn[],
  field: string,
  axisName: string,
  invalidChart: (detail: string) => Error,
): ChartColumn | null {
  if (field === "") {
    return null;
  }
  const column = columns.find((item) => item.name === field);
  if (column === undefined) {
    throw invalidChart(`Radial chart ${axisName} must reference a column in the selected table.`);
  }
  return column;
}

function validateValueType(
  axis: RadialChartAxis,
  column: ChartColumn,
  invalidChart: (detail: string) => Error,
): void {
  const category = classifyChartColumnType(column.type);
  const allowed = category === "numeric"
    ? VALUE_TRANSFORMS
    : category === "temporal"
      ? TEMPORAL_TRANSFORMS
      : CATEGORICAL_TRANSFORMS;
  if (!allowed.has(axis.transform)) {
    throw invalidChart("The selected radial-chart value aggregate is not valid for the column type.");
  }
}

function appendRadialQueryOutput(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  binding: ChartBinding,
  properties: RadialChartProperties,
  query: string | null,
  chartType: "PieChart" | "DonutChart",
  chartName: "pie" | "donut",
  supportsWorkflowBinding: boolean,
): void {
  const emptyColumns = "['category', 'value']";
  const categoryTitle = properties.category.displayName.trim() || properties.category.field;
  const valueTitle = properties.value.displayName.trim() || properties.value.field;
  const spec = buildRadialSpec(categoryTitle, valueTitle, variableName, chartType);
  const data = `${variableName}_data`;
  const emptyMessage = `No positive values are available for this ${chartName} chart.`;
  const dataLines = query === null
    ? [
      `${data} = pd.DataFrame(columns=${emptyColumns})`,
      `st.info(${pythonString(binding.kind === "unsupported"
        ? "The saved Lakebase table binding is preserved. Bind a Unity Catalog table or set chart data through a workflow."
        : `Set chart data through a workflow or bind a Unity Catalog table to render this ${chartName} chart.`)})`,
    ]
    : [
      "try:",
      `    ${data} = ${lakebaseQueryExpression(binding, MAX_CHART_ROWS, query)}`,
      `except RuntimeError as vdab_error_${variableName}:`,
      `    st.error(str(vdab_error_${variableName}))`,
      `    ${data} = pd.DataFrame(columns=${emptyColumns})`,
    ];
  if (supportsWorkflowBinding) {
    const codeName = component.codeName ?? component.key;
    const overrideVariable = `_vdab_chart_binding_override_${variableName}`;
    lines.push(
      `${overrideVariable} = binding_overrides.get(${pythonString(`${codeName}:chartData`)})`,
      `if ${overrideVariable} is not None:`,
      `    ${data} = _vdab_binding_override_to_dataframe(${overrideVariable})`,
      "else:",
      ...dataLines.map((line) => `    ${line}`),
    );
  } else {
    lines.push(...dataLines);
  }
  lines.push(
    `if not ${data}.empty and 'category' in ${data}.columns and 'value' in ${data}.columns:`,
    `    ${data} = ${data}[['category', 'value']].copy()`,
    `    ${data} = ${data}.dropna(subset=['category', 'value'])`,
    `    ${data}['category'] = ${data}['category'].astype(str).str.strip()`,
    `    ${data}['value'] = pd.to_numeric(${data}['value'], errors='coerce')`,
    `    ${data} = ${data}.dropna(subset=['category', 'value'])`,
    `    ${data} = ${data}[${data}['category'] != '']`,
    `    ${data} = ${data}[${data}['value'].map(math.isfinite) & (${data}['value'] > 0)]`,
    `    ${data} = ${data}.groupby('category', as_index=False, sort=False)['value'].sum()`,
    `    ${data} = ${data}[${data}['value'].map(math.isfinite) & (${data}['value'] > 0)]`,
    `    ${data} = ${data}.sort_values('value', ascending=False, kind='mergesort')`,
    `    if not ${data}.empty:`,
    `        _vdab_palette_${variableName} = _vdab_pie_palette(${pythonString(properties.seriesColor)}, len(${data}))`,
    `        st.vega_lite_chart(data=${data}, spec=${spec}, width='stretch', key=${pythonString(component.key)})`,
    "    else:",
    `        st.info(${pythonString(emptyMessage)})`,
    "else:",
    `    st.info(${pythonString(emptyMessage)})`,
  );
}

function buildRadialSpec(
  categoryTitle: string,
  valueTitle: string,
  variableName: string,
  chartType: "PieChart" | "DonutChart",
): string {
  const paletteName = `_vdab_palette_${variableName}`;
  const innerRadius = chartType === "DonutChart"
    ? `, 'innerRadius': ${RADIAL_CHART_OUTER_RADIUS * RADIAL_CHART_DONUT_HOLE_RATIO}`
    : "";
  return `{'encoding': {'theta': {'field': 'value', 'type': 'quantitative', 'stack': True}, 'color': {'field': 'category', 'type': 'nominal', 'scale': {'range': ${paletteName}}, 'legend': {'orient': 'bottom', 'title': ${pythonString(categoryTitle)}}}, 'tooltip': [{'field': 'category', 'type': 'nominal', 'title': ${pythonString(categoryTitle)}}, {'field': 'value', 'type': 'quantitative', 'title': ${pythonString(valueTitle)}}]}, 'layer': [{'mark': {'type': 'arc', 'outerRadius': ${RADIAL_CHART_OUTER_RADIUS}${innerRadius}, 'tooltip': True}}, {'mark': {'type': 'text', 'radius': ${RADIAL_CHART_LABEL_RADIUS}, 'fontSize': 11}, 'encoding': {'text': {'field': 'category', 'type': 'nominal'}}}]}`;
}

function readOptionalText(
  value: unknown,
  defaultValue: string,
  maxLength: number,
  invalidChart: (detail: string) => Error,
): string {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw invalidChart("Radial chart text properties are invalid.");
  }
  return value;
}
