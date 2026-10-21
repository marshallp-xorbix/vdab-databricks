import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readSpiralStoryProperties,
  validateSpiralStoryBindings,
} from "../db/project-component-spiral-story.ts";
import { invalidSpiralStory } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  lakebaseQueryOptions,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { SPIRAL_STORY_HTML } from "./spiral-story-html.ts";

const MAX_SPIRAL_QUERY_ROWS = 100;
const SPIRAL_CANVAS_HEIGHT_PX = 560;
const REQUIRED_MAPPING_NAMES = ["journey name", "stage", "timeline", "progress %", "metric value"];
const NUMERIC_FIELDS = ["progress_pct", "metric_value", "risk_score", "cost"];
const OPTIONAL_DIMENSIONS = [
  ["targetDate", "target_date"], ["actualDate", "actual_date"], ["status", "status"],
  ["owner", "owner"], ["keyAchievement", "key_achievement"],
] as const;

/** Appends viewer-authorized current-workspace journey data and the spiral canvas. */
export function appendSpiralStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidSpiralStory(detail);
  if (
    component.type !== "SpiralStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("SpiralStory contains an unsupported component shape.");
  }

  const properties = readSpiralStoryProperties(component.properties, invalid);
  validateSpiralStoryBindings(component.bindings, component.properties, invalid);
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
    lines.push(`st.info(${pythonString(`Map the required SpiralStory fields: ${REQUIRED_MAPPING_NAMES.join(", ")}.`)})`);
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
  properties: ReturnType<typeof readSpiralStoryProperties>,
): string | null {
  const required = [
    properties.journeyName, properties.stage, properties.timelineField,
    properties.progressPct, properties.metricValue,
  ];
  if (required.some((axis) => axis.field === "")) {
    return null;
  }

  const journey = quoteChartIdentifier(properties.journeyName.field, binding.kind);
  const stage = quoteChartIdentifier(properties.stage.field, binding.kind);
  const timeline = quoteChartIdentifier(properties.timelineField.field, binding.kind);
  const selected = [
    `${journey} AS journey_name`,
    `${stage} AS stage`,
    `MAX(${timeline}) AS timeline`,
    `${measure(properties.progressPct, "avg", binding.kind)} AS progress_pct`,
    `${measure(properties.metricValue, "sum", binding.kind)} AS metric_value`,
  ];
  for (const [property, alias] of OPTIONAL_DIMENSIONS) {
    const axis = properties[property];
    if (axis.field !== "") {
      selected.push(`MAX(${quoteChartIdentifier(axis.field, binding.kind)}) AS ${alias}`);
    }
  }
  addOptionalMeasure(selected, properties.riskScore, "risk_score", "avg", binding.kind);
  addOptionalMeasure(selected, properties.cost, "cost", "sum", binding.kind);

  const table = quoteChartTable(binding);
  return `SELECT ${selected.join(", ")} FROM ${table} GROUP BY ${journey}, ${stage} ORDER BY MAX(${timeline})`;
}

function measure(axis: { field: string; transform: string }, noneFallback: string, kind: ChartBinding["kind"]): string {
  return chartMeasureExpression(
    axis.field,
    axis.transform === "none" ? noneFallback : axis.transform,
    invalidSpiralStory,
    kind,
  );
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
  properties: ReturnType<typeof readSpiralStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = _vdab_sql_query_df(${pythonString(binding.catalog ?? "")}, ${pythonString(binding.schema ?? "")}, ${pythonString(binding.table ?? "")}, ${MAX_SPIRAL_QUERY_ROWS}, query_statement=${pythonString(query)}${lakebaseQueryOptions(binding)})`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame(columns=['journey_name', 'stage', 'timeline', 'progress_pct', 'metric_value'])`,
    `if ${data} is None or ${data}.empty or not all(_vdab_column in ${data}.columns for _vdab_column in ('journey_name', 'stage', 'timeline', 'progress_pct', 'metric_value')):`,
    "    st.info('No spiral milestones returned. Check bindings and field mappings.')",
    "else:",
    `    ${data} = ${data}.copy()`,
    ...appendColumnNormalization(data),
    `    ${data}['journey_name'] = ${data}['journey_name'].fillna('').astype(str).str.strip()`,
    `    ${data}['stage'] = ${data}['stage'].fillna('').astype(str).str.strip()`,
    `    ${data} = ${data}[(${data}['journey_name'] != '') & (${data}['stage'] != '')]`,
    `    ${data} = ${data}.sort_values(by=['journey_name', 'timeline', 'stage'], kind='stable')`,
  );
  appendPayload(lines, variableName, data, properties);
  appendCanvas(lines, variableName);
}

function appendColumnNormalization(data: string): string[] {
  return [
    ...NUMERIC_FIELDS.flatMap((field) => [
      `    if '${field}' in ${data}.columns:`,
      `        ${data}['${field}'] = pd.to_numeric(${data}['${field}'], errors='coerce')`,
      `        ${data}['${field}'] = ${data}['${field}'].where(${data}['${field}'].map(math.isfinite))`,
    ]),
  ];
}

function appendPayload(
  lines: string[],
  variableName: string,
  data: string,
  properties: ReturnType<typeof readSpiralStoryProperties>,
): void {
  const records = `${variableName}_records`;
  const journeys = `${variableName}_journeys`;
  const selected = `${variableName}_selected_journey`;
  lines.push(
    `    ${records} = []`,
    `    for _, _vdab_row in ${data}.iterrows():`,
    `        _vdab_record = {`,
    `            'journey_name': str(_vdab_row.get('journey_name', '')).strip(),`,
    `            'stage': str(_vdab_row.get('stage', '')).strip(),`,
    `            'timeline': None if pd.isna(_vdab_row.get('timeline')) else str(_vdab_row.get('timeline')),`,
    `            'progress_pct': 0.0 if pd.isna(_vdab_row.get('progress_pct')) else float(_vdab_row.get('progress_pct')),`,
    `            'metric_value': 0.0 if pd.isna(_vdab_row.get('metric_value')) else float(_vdab_row.get('metric_value')),`,
    `        }`,
  );
  appendOptionalRecordValues(lines, data);
  lines.push(
    `        if 'target_date' in _vdab_record and 'actual_date' in _vdab_record:`,
    `            _vdab_target_date = pd.to_datetime(_vdab_record['target_date'], errors='coerce')`,
    `            _vdab_actual_date = pd.to_datetime(_vdab_record['actual_date'], errors='coerce')`,
    `            if pd.notna(_vdab_target_date) and pd.notna(_vdab_actual_date):`,
    `                _vdab_record['schedule_variance_days'] = int((_vdab_actual_date - _vdab_target_date).days)`,
    `        ${records}.append(_vdab_record)`,
    `    ${journeys} = sorted({ _vdab_record['journey_name'] for _vdab_record in ${records} })`,
    `    ${selected} = sorted(${journeys}, key=lambda _vdab_journey: (-sum(1 for _vdab_record in ${records} if _vdab_record['journey_name'] == _vdab_journey), _vdab_journey))[0] if ${journeys} else ''`,
    `    ${variableName}_warnings = ['Fewer than 3 milestones — spiral story may be less meaningful.'] if 0 < sum(1 for _vdab_record in ${records} if _vdab_record['journey_name'] == ${selected}) < 3 else []`,
    `    ${variableName}_payload = {`,
    `        'records': ${records},`,
    `        'journeys': ${journeys},`,
    `        'selected_journey': ${selected},`,
    `        'visualConfig': {`,
    `            'show_labels': ${properties.showLabels ? "True" : "False"},`,
    `            'show_risk_glow': ${properties.showRiskGlow ? "True" : "False"},`,
    `            'show_variance': ${properties.showVariance ? "True" : "False"},`,
    `            'space_by_timeline': ${properties.spaceByTimeline ? "True" : "False"},`,
    `        },`,
    `        'summary': {'warnings': ${variableName}_warnings},`,
    `    }`,
  );
}

function appendOptionalRecordValues(lines: string[], data: string): void {
  for (const [field, alias] of [
    ["target_date", "target_date"], ["actual_date", "actual_date"], ["status", "status"],
    ["risk_score", "risk_score"], ["owner", "owner"], ["key_achievement", "key_achievement"], ["cost", "cost"],
  ] as const) {
    const value = `_vdab_${field}`;
    lines.push(
      `        ${value} = _vdab_row.get('${alias}')`,
      `        if '${alias}' in ${data}.columns and not pd.isna(${value}):`,
      `            _vdab_record['${alias}'] = ${field === "risk_score" || field === "cost" ? `float(${value})` : `str(${value}).strip()`}`,
    );
  }
  lines.push(
    `        if 'status' in _vdab_record:`,
    `            _vdab_record['status'] = _vdab_record['status'].lower().replace(' ', '_').replace('-', '_')`,
  );
}

function appendCanvas(lines: string[], variableName: string): void {
  const htmlLines = SPIRAL_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__SPIRAL_PAYLOAD__', json.dumps(${variableName}_payload, default=str, allow_nan=False).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${SPIRAL_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}
