import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readHeatMapStoryProperties,
  validateHeatMapStoryBindings,
} from "../db/project-component-heat-map-story.ts";
import { invalidHeatMapStory } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  lakebaseQueryExpression,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { HEAT_MAP_STORY_HTML } from "./heat-map-story-html.ts";

const MAX_HEAT_MAP_QUERY_ROWS = 500;
const HEAT_MAP_CANVAS_HEIGHT_PX = 580;
const REQUIRED_MAPPING_NAMES = ["geographic area", "metric value"];

/** Appends viewer-authorized current-workspace data and the interactive USA map. */
export function appendHeatMapStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidHeatMapStory(detail);
  if (
    component.type !== "HeatMapStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("HeatMapStory contains an unsupported component shape.");
  }

  const properties = readHeatMapStoryProperties(component.properties, invalid);
  validateHeatMapStoryBindings(component.bindings, component.properties, invalid);
  const binding = readChartBinding(component.bindings, invalid);
  appendTitle(lines, component, variableName, properties.title);

  if (binding.kind !== "unityCatalogTable" && binding.kind !== "lakebaseAutoscaling" && binding.kind !== "lakebaseProvisionedDatabase") {
    lines.push("st.info('Bind a Unity Catalog or Lakebase table in the hosting workspace to continue.')");
    return;
  }

  const query = buildQuery(binding, properties);
  if (query === null) {
    lines.push(`st.info(${pythonString(`Map the required HeatMapStory fields: ${REQUIRED_MAPPING_NAMES.join(", ")}.`)})`);
    return;
  }
  appendQueryAndCanvas(lines, component, variableName, binding, query, properties);
}

function appendTitle(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  title: string,
): void {
  const codeName = component.codeName ?? component.key;
  const displayLabel = `_vdab_disp_lbl_${variableName}`;
  lines.push(
    "",
    `_vdab_lbl_${variableName} = ui_overrides.get('labels', {}).get(${pythonString(codeName)}, None)`,
    `${displayLabel} = _vdab_lbl_${variableName} if _vdab_lbl_${variableName} is not None else ${pythonString(title)}`,
    `st.subheader(${displayLabel})`,
  );
}

function buildQuery(
  binding: ChartBinding,
  properties: ReturnType<typeof readHeatMapStoryProperties>,
): string | null {
  if (properties.geographicArea.field === "" || properties.metricValue.field === "") {
    return null;
  }

  const geographicArea = quoteChartIdentifier(properties.geographicArea.field, binding.kind);
  const selected = [
    `${geographicArea} AS area_key`,
    `${measure(properties.metricValue, properties.aggregationMethod, binding.kind)} AS metric_value`,
  ];
  addOptionalMeasure(selected, properties.secondaryMetric, "secondary_value", "sum", binding.kind);
  addOptionalMeasure(selected, properties.changePct, "change_pct", "avg", binding.kind);
  addOptionalMeasure(selected, properties.targetValue, "target_value", "avg", binding.kind);
  addOptionalMeasure(selected, properties.riskScore, "risk_score", "avg", binding.kind);
  addOptionalDimension(selected, properties.category, "category", binding.kind);
  addOptionalMeasure(selected, properties.forecastValue, "forecast_value", "avg", binding.kind);
  addOptionalDimension(selected, properties.notes, "notes", binding.kind);

  const table = quoteChartTable(binding);
  const filteredTable = properties.timeField.field === ""
    ? table
    : latestPeriodTable(table, properties.timeField.field, binding.kind);
  return `SELECT ${selected.join(", ")} FROM ${filteredTable} GROUP BY ${geographicArea}`;
}

function measure(axis: { field: string; transform: string }, noneFallback: string, kind: ChartBinding["kind"]): string {
  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  return chartMeasureExpression(axis.field, transform, invalidHeatMapStory, kind);
}

function addOptionalMeasure(
  selected: string[],
  axis: { field: string; transform: string },
  alias: string,
  noneFallback: string,
  kind: ChartBinding["kind"],
): void {
  if (axis.field !== "") {
    selected.push(`${measure(axis, noneFallback, kind)} AS ${alias}`);
  }
}

function addOptionalDimension(
  selected: string[],
  axis: { field: string },
  alias: string,
  kind: ChartBinding["kind"],
): void {
  if (axis.field !== "") {
    selected.push(`MAX(${quoteChartIdentifier(axis.field, kind)}) AS ${alias}`);
  }
}

function latestPeriodTable(table: string, field: string, kind: ChartBinding["kind"]): string {
  const timeField = quoteChartIdentifier(field, kind);
  return `(SELECT * FROM ${table} WHERE ${timeField} = (SELECT MAX(${timeField}) FROM ${table}))`;
}

function appendQueryAndCanvas(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  binding: ChartBinding,
  query: string,
  properties: ReturnType<typeof readHeatMapStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = ${lakebaseQueryExpression(binding, MAX_HEAT_MAP_QUERY_ROWS, query)}`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame(columns=['area_key', 'metric_value'])`,
    `if ${data}.empty or 'area_key' not in ${data}.columns:`,
    "    st.info('No geographic areas returned. Check bindings and field mappings.')",
    "else:",
    `    ${data} = ${data}.copy()`,
    ...appendNumericCoercion(data),
    `    ${data} = ${data}.dropna(subset=['area_key'])`,
    `    ${data}['area_key'] = ${data}['area_key'].astype(str).str.strip()`,
    `    ${data} = ${data}[${data}['area_key'] != '']`,
    `    ${data}['metric_value'] = ${data}['metric_value'].fillna(0)`,
  );
  appendPayload(lines, variableName, data, properties);
}

function appendNumericCoercion(data: string): string[] {
  const numericFields = [
    "metric_value", "secondary_value", "change_pct", "target_value", "risk_score", "forecast_value",
  ];
  return numericFields.flatMap((field) => [
    `    if '${field}' in ${data}.columns:`,
    `        ${data}['${field}'] = pd.to_numeric(${data}['${field}'], errors='coerce')`,
    `        ${data}['${field}'] = ${data}['${field}'].where(${data}['${field}'].map(math.isfinite))`,
  ]);
}

function appendPayload(
  lines: string[],
  variableName: string,
  data: string,
  properties: ReturnType<typeof readHeatMapStoryProperties>,
): void {
  appendRecords(lines, variableName, data);
  lines.push(
    `    ${variableName}_sorted = sorted(${variableName}_records, key=lambda _vdab_record: _vdab_record['metric_value'], reverse=True)`,
    `    ${variableName}_highest = {'area_key': ${variableName}_sorted[0]['area_key'], 'metric_value': ${variableName}_sorted[0]['metric_value']} if ${variableName}_sorted else None`,
    `    ${variableName}_lowest = {'area_key': ${variableName}_sorted[-1]['area_key'], 'metric_value': ${variableName}_sorted[-1]['metric_value']} if ${variableName}_sorted else None`,
    `    ${variableName}_with_change = [_vdab_record for _vdab_record in ${variableName}_records if 'change_pct' in _vdab_record]`,
    `    ${variableName}_positive_change = max(${variableName}_with_change, key=lambda _vdab_record: _vdab_record['change_pct'], default=None)`,
    `    ${variableName}_negative_change = min(${variableName}_with_change, key=lambda _vdab_record: _vdab_record['change_pct'], default=None)`,
    `    ${variableName}_payload = {`,
    `        'records': ${variableName}_records,`,
    "        'visualConfig': {",
    "            'map_scope': 'usa',",
    "            'geographic_level': 'state',",
    `            'color_scale': ${pythonString(properties.colorScale)},`,
    `            'show_labels': ${properties.showLabels ? "True" : "False"},`,
    `            'show_legend': ${properties.showLegend ? "True" : "False"},`,
    `            'aggregation_method': ${pythonString(properties.aggregationMethod)},`,
    "        },",
    "        'summary': {",
    `            'matched_areas': len(${variableName}_records),`,
    "            'unmatched_keys': [],",
    `            'highest': ${variableName}_highest,`,
    `            'lowest': ${variableName}_lowest,`,
    `            'largest_positive_change': ({'area_key': ${variableName}_positive_change['area_key'], 'change_pct': ${variableName}_positive_change['change_pct']} if ${variableName}_positive_change else None),`,
    `            'largest_negative_change': ({'area_key': ${variableName}_negative_change['area_key'], 'change_pct': ${variableName}_negative_change['change_pct']} if ${variableName}_negative_change else None),`,
    "            'warnings': [],",
    "        },",
    "    }",
  );
  appendCanvas(lines, variableName);
}

function appendRecords(lines: string[], variableName: string, data: string): void {
  const optionalFields = [
    ["secondary_value", "secondary_value"],
    ["change_pct", "change_pct"],
    ["target_value", "target_value"],
    ["risk_score", "risk_score"],
    ["forecast_value", "forecast_value"],
  ] as const;
  lines.push(
    `    ${variableName}_records = []`,
    `    for _, _vdab_row in ${data}.iterrows():`,
    "        _vdab_record = {",
    "            'area_key': str(_vdab_row.get('area_key', '')).strip(),",
    "            'metric_value': float(_vdab_row.get('metric_value') or 0),",
    "        }",
  );
  for (const [column, field] of optionalFields) {
    lines.push(
      `        if '${column}' in ${data}.columns and not pd.isna(_vdab_row.get('${column}')):`,
      `            _vdab_record[${pythonString(field)}] = float(_vdab_row.get('${column}'))`,
    );
  }
  lines.push(
    `        if 'category' in ${data}.columns and not pd.isna(_vdab_row.get('category')):`,
    "            _vdab_record['category'] = str(_vdab_row.get('category'))",
    `        if 'notes' in ${data}.columns and not pd.isna(_vdab_row.get('notes')) and str(_vdab_row.get('notes')).strip():`,
    "            _vdab_record['notes'] = str(_vdab_row.get('notes')).strip()",
    `        ${variableName}_records.append(_vdab_record)`,
  );
}

function appendCanvas(lines: string[], variableName: string): void {
  const htmlLines = HEAT_MAP_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__HEAT_MAP_PAYLOAD__', json.dumps(${variableName}_payload, default=str).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${HEAT_MAP_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}
