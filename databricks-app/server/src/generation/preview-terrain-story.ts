import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readTerrainStoryProperties,
  validateTerrainStoryBindings,
} from "../db/project-component-terrain-story.ts";
import { invalidTerrainStory } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  lakebaseQueryOptions,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { TERRAIN_STORY_HTML } from "./terrain-story-html.ts";

const MAX_TERRAIN_QUERY_ROWS = 500;
const TERRAIN_CANVAS_HEIGHT_PX = 580;
const REQUIRED_MAPPING_NAMES = ["X dimension", "Y dimension", "height metric"];
const MEASURE_FIELDS = ["height_value", "risk_score", "target_value", "baseline_value", "forecast_value", "volume_value"];
const OPTIONAL_DIMENSIONS = [
  ["terrainCategory", "category"], ["status", "status"], ["eventName", "event_name"],
  ["eventDate", "event_date"], ["calloutText", "callout_text"],
] as const;
const OPTIONAL_MEASURES = [
  ["riskScore", "risk_score", "avg"], ["targetValue", "target_value", "avg"],
  ["baselineValue", "baseline_value", "avg"], ["forecastValue", "forecast_value", "avg"],
  ["volumeMetric", "volume_value", "sum"],
] as const;

/** Appends the viewer-authorized, hosting-workspace TerrainStory preview. */
export function appendTerrainStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidTerrainStory(detail);
  if (
    component.type !== "TerrainStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("TerrainStory contains an unsupported component shape.");
  }

  const properties = readTerrainStoryProperties(component.properties, invalid);
  validateTerrainStoryBindings(component.bindings, component.properties, invalid);
  const binding = readChartBinding(component.bindings, invalid);
  appendTitle(lines, component, variableName, properties.title);
  if (binding.kind === "unsupported") {
    lines.push("st.info('Lakebase Provisioned is retained for imported projects. Reselect a Lakebase Autoscaling table before previewing.')");
    return;
  }
  if (binding.kind !== "unityCatalogTable" && binding.kind !== "lakebaseAutoscaling") {
    lines.push("st.info('Bind a Unity Catalog or Lakebase Autoscaling table in the hosting workspace to continue.')");
    return;
  }

  const query = buildQuery(binding, properties);
  if (query === null) {
    lines.push(`st.info(${pythonString(`Map the required TerrainStory fields: ${REQUIRED_MAPPING_NAMES.join(", ")}.`)})`);
    return;
  }
  appendQueryAndCanvas(lines, component, variableName, binding, query, properties);
}

function appendTitle(lines: string[], component: ProjectComponent, variableName: string, title: string): void {
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
  properties: ReturnType<typeof readTerrainStoryProperties>,
): string | null {
  const required = [properties.xDimension, properties.yDimension, properties.heightMetric];
  if (required.some((axis) => axis.field === "")) {
    return null;
  }

  const x = quoteChartIdentifier(properties.xDimension.field, binding.kind);
  const y = quoteChartIdentifier(properties.yDimension.field, binding.kind);
  const height = measure(
    properties.heightMetric,
    properties.aggregationMethod,
    binding.kind,
  );
  const selected = [`${x} AS x_value`, `${y} AS y_value`, `${height} AS height_value`];
  for (const [property, alias] of OPTIONAL_DIMENSIONS) {
    const axis = properties[property];
    if (axis.field !== "") {
      selected.push(`MAX(${quoteChartIdentifier(axis.field, binding.kind)}) AS ${alias}`);
    }
  }
  for (const [property, alias, fallback] of OPTIONAL_MEASURES) {
    const axis = properties[property];
    if (axis.field !== "") {
      selected.push(`${measure(axis, fallback, binding.kind)} AS ${alias}`);
    }
  }

  const table = quoteChartTable(binding);
  const timeFilter = properties.timeField.field === ""
    ? table
    : latestPeriodTable(table, properties.timeField.field, binding.kind);
  return `SELECT ${selected.join(", ")} FROM ${timeFilter} GROUP BY ${x}, ${y}`;
}

function measure(
  axis: { field: string; transform: string },
  fallback: string,
  kind: ChartBinding["kind"],
): string {
  return chartMeasureExpression(
    axis.field,
    axis.transform === "none" ? fallback : axis.transform,
    invalidTerrainStory,
    kind,
  );
}

function latestPeriodTable(table: string, timeField: string, kind: ChartBinding["kind"]): string {
  const time = quoteChartIdentifier(timeField, kind);
  return `(SELECT * FROM ${table} WHERE ${time} = (SELECT MAX(${time}) FROM ${table}))`;
}

function appendQueryAndCanvas(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  binding: ChartBinding,
  query: string,
  properties: ReturnType<typeof readTerrainStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = _vdab_sql_query_df(${pythonString(binding.catalog ?? "")}, ${pythonString(binding.schema ?? "")}, ${pythonString(binding.table ?? "")}, ${MAX_TERRAIN_QUERY_ROWS}, query_statement=${pythonString(query)}${lakebaseQueryOptions(binding)})`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame(columns=['x_value', 'y_value', 'height_value'])`,
    `if ${data} is None or ${data}.empty or not all(_vdab_column in ${data}.columns for _vdab_column in ('x_value', 'y_value', 'height_value')):`,
    "    st.info('No terrain cells returned. Check bindings and field mappings.')",
    "else:",
    `    ${data} = ${data}.copy()`,
    `    ${data}_source_count = len(${data})`,
    ...appendNumericNormalization(data),
    `    ${data} = ${data}.dropna(subset=['x_value', 'y_value'])`,
    `    ${data}['height_value'] = ${data}['height_value'].fillna(0)`,
    `    ${data}['x_value'] = ${data}['x_value'].astype(str)`,
    `    ${data}['y_value'] = ${data}['y_value'].astype(str)`,
    `    ${data} = ${data}.sort_values(by=['x_value', 'y_value'], kind='stable')`,
  );
  appendRecords(lines, variableName, data);
  appendPayload(lines, variableName, data, properties);
  appendCanvas(lines, variableName);
}

function appendNumericNormalization(data: string): string[] {
  return MEASURE_FIELDS.flatMap((field) => [
    `    if '${field}' in ${data}.columns:`,
    `        ${data}['${field}'] = pd.to_numeric(${data}['${field}'], errors='coerce')`,
    `        ${data}['${field}'] = ${data}['${field}'].where(${data}['${field}'].map(math.isfinite))`,
  ]);
}

function appendRecords(lines: string[], variableName: string, data: string): void {
  const records = `${variableName}_records`;
  lines.push(
    `    ${records} = []`,
    `    ${variableName}_callouts = []`,
    `    for _, _vdab_row in ${data}.iterrows():`,
    `        _vdab_record = {`,
    `            'x': str(_vdab_row.get('x_value', '')),`,
    `            'y': str(_vdab_row.get('y_value', '')),`,
    `            'height': float(_vdab_row.get('height_value') or 0),`,
    `        }`,
  );
  for (const [alias, kind] of [
    ["category", "text"], ["risk_score", "number"], ["target_value", "number"],
    ["baseline_value", "number"], ["forecast_value", "number"], ["volume_value", "number"], ["status", "text"],
  ] as const) {
    const value = `_vdab_${alias}`;
    const pythonValue = kind === "number" ? `float(${value})` : `str(${value}).strip()`;
    lines.push(
      `        ${value} = _vdab_row.get('${alias}')`,
      `        if '${alias}' in ${data}.columns and not pd.isna(${value}):`,
      `            _vdab_record['${alias}'] = ${pythonValue}`,
    );
  }
  lines.push(
    `        if 'baseline_value' in _vdab_record:`,
    `            _vdab_record['variance'] = _vdab_record['height'] - _vdab_record['baseline_value']`,
    `        elif 'target_value' in _vdab_record:`,
    `            _vdab_record['variance'] = _vdab_record['height'] - _vdab_record['target_value']`,
    `        ${records}.append(_vdab_record)`,
    `        _vdab_event_name = _vdab_row.get('event_name')`,
    `        _vdab_callout_text = _vdab_row.get('callout_text')`,
    `        if ('event_name' in ${data}.columns and not pd.isna(_vdab_event_name) and str(_vdab_event_name).strip()) or ('callout_text' in ${data}.columns and not pd.isna(_vdab_callout_text) and str(_vdab_callout_text).strip()):`,
    `            _vdab_callout = {'x': _vdab_record['x'], 'y': _vdab_record['y'], 'label': str(_vdab_event_name).strip() if not pd.isna(_vdab_event_name) and str(_vdab_event_name).strip() else 'Callout', 'metric_value': _vdab_record['height']}`,
    `            _vdab_event_date = _vdab_row.get('event_date')`,
    `            if 'event_date' in ${data}.columns and not pd.isna(_vdab_event_date):`,
    `                _vdab_callout['event_date'] = str(_vdab_event_date)`,
    `            if not pd.isna(_vdab_callout_text) and str(_vdab_callout_text).strip():`,
    `                _vdab_callout['description'] = str(_vdab_callout_text).strip()`,
    `            if 'status' in _vdab_record:`,
    `                _vdab_callout['severity'] = _vdab_record['status']`,
    `            ${variableName}_callouts.append(_vdab_callout)`,
  );
}

function appendPayload(
  lines: string[],
  variableName: string,
  data: string,
  properties: ReturnType<typeof readTerrainStoryProperties>,
): void {
  const records = `${variableName}_records`;
  lines.push(
    `    ${variableName}_sorted = sorted(${records}, key=lambda _vdab_record: (-_vdab_record['height'], _vdab_record['x'], _vdab_record['y']))`,
    `    ${variableName}_peaks = [{'x': _vdab_record['x'], 'y': _vdab_record['y'], 'height': _vdab_record['height']} for _vdab_record in ${variableName}_sorted[:3]]`,
    `    ${variableName}_valleys = [{'x': _vdab_record['x'], 'y': _vdab_record['y'], 'height': _vdab_record['height']} for _vdab_record in sorted(${records}, key=lambda _vdab_record: (_vdab_record['height'], _vdab_record['x'], _vdab_record['y']))[:3]]`,
    `    ${variableName}_payload = {`,
    `        'records': ${records},`,
    `        'callouts': ${variableName}_callouts,`,
    `        'visualConfig': {`,
    `            'terrain_mode': ${pythonString(properties.terrainMode)},`,
    `            'height_scale': ${properties.heightScale},`,
    `            'interpolation': ${pythonString(properties.interpolation)},`,
    `            'grid_resolution': ${properties.gridResolution},`,
    `            'color_by': ${pythonString(properties.colorBy)},`,
    `            'show_peak_labels': ${properties.showPeakLabels ? "True" : "False"},`,
    `            'show_valley_labels': ${properties.showValleyLabels ? "True" : "False"},`,
    `            'camera_preset': ${pythonString(properties.cameraPreset)},`,
    `            'aggregation_method': ${pythonString(properties.aggregationMethod)},`,
    `        },`,
    `        'summary': {`,
    `            'grid_size': len(${records}),`,
    `            'excluded_rows': ${data}_source_count - len(${data}),`,
    `            'top_peaks': ${variableName}_peaks,`,
    `            'bottom_valleys': ${variableName}_valleys,`,
    `            'warnings': [],`,
    `        },`,
    `    }`,
  );
}

function appendCanvas(lines: string[], variableName: string): void {
  const htmlLines = TERRAIN_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__TERRAIN_PAYLOAD__', json.dumps(${variableName}_payload, default=str, allow_nan=False).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${TERRAIN_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}
