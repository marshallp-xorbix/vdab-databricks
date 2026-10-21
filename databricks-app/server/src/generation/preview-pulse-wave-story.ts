import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readPulseWaveStoryProperties,
  validatePulseWaveStoryBindings,
} from "../db/project-component-pulse-wave-story.ts";
import { invalidPulseWaveStory } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  lakebaseQueryOptions,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { PULSE_WAVE_STORY_HTML } from "./pulse-wave-story-html.ts";

const MAX_PULSE_WAVE_QUERY_ROWS = 500;
const PULSE_WAVE_CANVAS_HEIGHT_PX = 520;
const REQUIRED_MAPPING_NAMES = ["time period", "metric value", "baseline/target"];
const NUMERIC_COLUMNS = ["metric_value", "baseline_value", "impact_score"];

/** Appends viewer-authorized current-workspace time-series data and its canvas. */
export function appendPulseWaveStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidPulseWaveStory(detail);
  if (
    component.type !== "PulseWaveStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("PulseWaveStory contains an unsupported component shape.");
  }

  const properties = readPulseWaveStoryProperties(component.properties, invalid);
  validatePulseWaveStoryBindings(component.bindings, component.properties, invalid);
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
    lines.push(`st.info(${pythonString(`Map the required PulseWaveStory fields: ${REQUIRED_MAPPING_NAMES.join(", ")}.`)})`);
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
  properties: ReturnType<typeof readPulseWaveStoryProperties>,
): string | null {
  const required = [properties.timeField, properties.metricValue, properties.baselineValue];
  if (required.some((axis) => axis.field === "")) {
    return null;
  }

  const time = quoteChartIdentifier(properties.timeField.field, binding.kind);
  const selected = [
    `${time} AS time_period`,
    `${measure(properties.metricValue, properties.aggregationMethod, binding.kind)} AS metric_value`,
    `${measure(properties.baselineValue, "avg", binding.kind)} AS baseline_value`,
  ];
  addOptionalDimension(selected, properties.eventName, "event_name", binding.kind);
  addOptionalDimension(selected, properties.eventType, "event_type", binding.kind);
  addOptionalMeasure(selected, properties.impactScore, "impact_score", "avg", binding.kind);

  const table = quoteChartTable(binding);
  return `SELECT ${selected.join(", ")} FROM ${table} GROUP BY ${time} ORDER BY ${time}`;
}

function measure(
  axis: { field: string; transform: string },
  noneFallback: string,
  kind: ChartBinding["kind"],
): string {
  return chartMeasureExpression(
    axis.field,
    axis.transform === "none" ? noneFallback : axis.transform,
    invalidPulseWaveStory,
    kind,
  );
}

function addOptionalDimension(
  selected: string[],
  axis: { field: string; transform: string },
  alias: string,
  kind: ChartBinding["kind"],
): void {
  if (axis.field !== "") {
    selected.push(`MAX(${quoteChartIdentifier(axis.field, kind)}) AS ${alias}`);
  }
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

function appendQueryAndCanvas(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  binding: ChartBinding,
  query: string,
  properties: ReturnType<typeof readPulseWaveStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = _vdab_sql_query_df(${pythonString(binding.catalog ?? "")}, ${pythonString(binding.schema ?? "")}, ${pythonString(binding.table ?? "")}, ${MAX_PULSE_WAVE_QUERY_ROWS}, query_statement=${pythonString(query)}${lakebaseQueryOptions(binding)})`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame(columns=['time_period', 'metric_value', 'baseline_value'])`,
    `if ${data} is None or ${data}.empty or 'time_period' not in ${data}.columns:`,
    "    st.info('No time-series points returned. Check bindings and field mappings.')",
    "else:",
    `    ${data} = ${data}.copy()`,
    ...appendNumericCoercion(data),
    `    ${data} = ${data}.dropna(subset=['time_period'])`,
    `    ${data}['metric_value'] = ${data}['metric_value'].fillna(0)`,
    `    ${data}['baseline_value'] = ${data}['baseline_value'].fillna(0)`,
    `    ${data} = ${data}.sort_values(by='time_period')`,
  );
  appendPayload(lines, variableName, data, properties);
  appendCanvas(lines, variableName);
}

function appendNumericCoercion(data: string): string[] {
  return NUMERIC_COLUMNS.flatMap((field) => [
    `    if '${field}' in ${data}.columns:`,
    `        ${data}['${field}'] = pd.to_numeric(${data}['${field}'], errors='coerce')`,
    `        ${data}['${field}'] = ${data}['${field}'].where(${data}['${field}'].map(math.isfinite))`,
  ]);
}

function appendPayload(
  lines: string[],
  variableName: string,
  data: string,
  properties: ReturnType<typeof readPulseWaveStoryProperties>,
): void {
  const records = `${variableName}_records`;
  const events = `${variableName}_events`;
  const metricLabel = properties.metricValue.field || properties.metricName;
  lines.push(
    `    ${records} = []`,
    `    ${events} = []`,
    `    for _, _vdab_row in ${data}.iterrows():`,
    `        _vdab_period = '' if pd.isna(_vdab_row.get('time_period')) else str(_vdab_row.get('time_period')).strip()`,
    `        if not _vdab_period:`,
    `            continue`,
    `        _vdab_record = {'time_period': _vdab_period, 'metric_value': float(_vdab_row.get('metric_value') or 0), 'baseline_value': float(_vdab_row.get('baseline_value') or 0)}`,
    `        ${records}.append(_vdab_record)`,
    `        _vdab_event_name = _vdab_row.get('event_name')`,
    `        if 'event_name' in ${data}.columns and not pd.isna(_vdab_event_name) and str(_vdab_event_name).strip():`,
    `            _vdab_event = {'time_period': _vdab_period, 'event_name': str(_vdab_event_name).strip()}`,
    `            _vdab_event_type = _vdab_row.get('event_type')`,
    `            if 'event_type' in ${data}.columns and not pd.isna(_vdab_event_type) and str(_vdab_event_type).strip():`,
    `                _vdab_event['event_type'] = str(_vdab_event_type).strip().lower()`,
    `            _vdab_impact_score = _vdab_row.get('impact_score')`,
    `            if 'impact_score' in ${data}.columns and not pd.isna(_vdab_impact_score):`,
    `                _vdab_event['impact_score'] = float(_vdab_impact_score)`,
    `            ${events}.append(_vdab_event)`,
    `    ${variableName}_spike = None`,
    `    ${variableName}_drop = None`,
    `    for _vdab_index in range(1, len(${records})):`,
    `        _vdab_delta = ${records}[_vdab_index]['metric_value'] - ${records}[_vdab_index - 1]['metric_value']`,
    `        _vdab_point = {'time_period': ${records}[_vdab_index]['time_period'], 'delta': _vdab_delta}`,
    `        if ${variableName}_spike is None or _vdab_delta > ${variableName}_spike['delta']:` ,
    `            ${variableName}_spike = _vdab_point`,
    `        if ${variableName}_drop is None or _vdab_delta < ${variableName}_drop['delta']:` ,
    `            ${variableName}_drop = _vdab_point`,
    `    ${variableName}_warnings = ['Fewer than 8 time points — wave may be less meaningful.'] if len(${records}) < 8 else []`,
    `    ${variableName}_payload = {`,
    `        'records': ${records},`,
    `        'events': ${events},`,
    `        'visualConfig': {`,
    `            'metric_name': ${pythonString(properties.metricName)},`,
    `            'y_axis_label': ${pythonString(metricLabel)},`,
    `            'aggregation_method': ${pythonString(properties.aggregationMethod)},`,
    `            'show_baseline': ${properties.showBaseline ? "True" : "False"},`,
    `            'show_events': ${properties.showEvents ? "True" : "False"},`,
    `            'show_anomaly_markers': ${properties.showAnomalyMarkers ? "True" : "False"},`,
    `            'fill_under_wave': ${properties.fillUnderWave ? "True" : "False"},`,
    `        },`,
    `        'summary': {`,
    `            'point_count': len(${records}),`,
    `            'largest_spike': ${variableName}_spike,`,
    `            'largest_drop': ${variableName}_drop,`,
    `            'event_count': len(${events}),`,
    `            'warnings': ${variableName}_warnings,`,
    `        },`,
    `    }`,
  );
}

function appendCanvas(lines: string[], variableName: string): void {
  const htmlLines = PULSE_WAVE_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__PULSE_WAVE_PAYLOAD__', json.dumps(${variableName}_payload, default=str, allow_nan=False).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${PULSE_WAVE_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}
