import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readHoneycombStoryProperties,
  validateHoneycombStoryBindings,
} from "../db/project-component-honeycomb-story.ts";
import { invalidHoneycombStory } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  lakebaseQueryOptions,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { HONEYCOMB_STORY_HTML } from "./honeycomb-story-html.ts";

const MAX_HONEYCOMB_QUERY_ROWS = 100;
const HONEYCOMB_CANVAS_HEIGHT_PX = 560;
const REQUIRED_MAPPING_NAMES = ["item name", "impact score", "priority level", "progress %", "category"];
const NUMERIC_FIELDS = ["impact_score", "progress_pct", "risk_score", "investment", "benefit_value"];

/** Appends viewer-authorized current-workspace data and the interactive honeycomb. */
export function appendHoneycombStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidHoneycombStory(detail);
  if (
    component.type !== "HoneycombStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("HoneycombStory contains an unsupported component shape.");
  }

  const properties = readHoneycombStoryProperties(component.properties, invalid);
  validateHoneycombStoryBindings(component.bindings, component.properties, invalid);
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
    lines.push(`st.info(${pythonString(`Map the required HoneycombStory fields: ${REQUIRED_MAPPING_NAMES.join(", ")}.`)})`);
    return;
  }
  appendQueryAndCanvas(lines, variableName, binding, query, properties);
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
  properties: ReturnType<typeof readHoneycombStoryProperties>,
): string | null {
  const required = [
    properties.itemName, properties.impactScore, properties.priorityLevel,
    properties.progressPct, properties.category,
  ];
  if (required.some((axis) => axis.field === "")) {
    return null;
  }

  const itemName = quoteChartIdentifier(properties.itemName.field, binding.kind);
  const selected = [
    `${itemName} AS item_name`,
    `${measure(properties.impactScore, "avg", binding.kind)} AS impact_score`,
    `${dimension(properties.priorityLevel, binding.kind)} AS priority_level`,
    `${measure(properties.progressPct, "avg", binding.kind)} AS progress_pct`,
    `${dimension(properties.category, binding.kind)} AS category`,
  ];
  addOptionalDimension(selected, properties.trend, "trend", binding.kind);
  addOptionalMeasure(selected, properties.riskScore, "risk_score", "avg", binding.kind);
  addOptionalDimension(selected, properties.owner, "owner", binding.kind);
  addOptionalDimension(selected, properties.dueDate, "due_date", binding.kind);
  addOptionalMeasure(selected, properties.investment, "investment", "sum", binding.kind);
  addOptionalMeasure(selected, properties.benefitValue, "benefit_value", "sum", binding.kind);
  addOptionalDimension(selected, properties.notes, "notes", binding.kind);
  addOptionalDimension(selected, properties.status, "status", binding.kind);

  const table = quoteChartTable(binding);
  const from = properties.timeField.field === ""
    ? table
    : latestPeriodTable(table, properties.timeField.field, binding.kind);
  return `SELECT ${selected.join(", ")} FROM ${from} GROUP BY ${itemName}`;
}

function measure(axis: { field: string; transform: string }, noneFallback: string, kind: ChartBinding["kind"]): string {
  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  return chartMeasureExpression(axis.field, transform, invalidHoneycombStory, kind);
}

function dimension(axis: { field: string; transform: string }, kind: ChartBinding["kind"]): string {
  if (axis.transform === "none") {
    return `MAX(${quoteChartIdentifier(axis.field, kind)})`;
  }
  return chartMeasureExpression(axis.field, axis.transform, invalidHoneycombStory, kind);
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
  axis: { field: string; transform: string },
  alias: string,
  kind: ChartBinding["kind"],
): void {
  if (axis.field !== "") {
    selected.push(`${dimension(axis, kind)} AS ${alias}`);
  }
}

function latestPeriodTable(table: string, field: string, kind: ChartBinding["kind"]): string {
  const timeField = quoteChartIdentifier(field, kind);
  return `(SELECT * FROM ${table} WHERE ${timeField} = (SELECT MAX(${timeField}) FROM ${table}))`;
}

function appendQueryAndCanvas(
  lines: string[],
  variableName: string,
  binding: ChartBinding,
  query: string,
  properties: ReturnType<typeof readHoneycombStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = _vdab_sql_query_df(${pythonString(binding.catalog ?? "")}, ${pythonString(binding.schema ?? "")}, ${pythonString(binding.table ?? "")}, ${MAX_HONEYCOMB_QUERY_ROWS}, query_statement=${pythonString(query)}${lakebaseQueryOptions(binding)})`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame(columns=['item_name', 'impact_score', 'progress_pct'])`,
    `if ${data}.empty or 'item_name' not in ${data}.columns:`,
    "    st.info('No HoneycombStory records returned. Check bindings and field mappings.')",
    "else:",
    `    ${data} = ${data}.copy()`,
    ...appendNumericCoercion(data),
    `    ${data} = ${data}.dropna(subset=['item_name'])`,
    `    ${data}['item_name'] = ${data}['item_name'].astype(str).str.strip()`,
    `    ${data} = ${data}[${data}['item_name'] != '']`,
    `    ${data}['impact_score'] = ${data}['impact_score'].fillna(0)`,
    `    ${data}['progress_pct'] = ${data}['progress_pct'].fillna(0)`,
  );
  appendPayload(lines, variableName, data, properties);
  appendCanvas(lines, variableName);
}

function appendNumericCoercion(data: string): string[] {
  return NUMERIC_FIELDS.flatMap((field) => [
    `    if '${field}' in ${data}.columns:`,
    `        ${data}['${field}'] = pd.to_numeric(${data}['${field}'], errors='coerce')`,
    `        ${data}['${field}'] = ${data}['${field}'].where(${data}['${field}'].map(math.isfinite))`,
  ]);
}

function appendPayload(
  lines: string[],
  variableName: string,
  data: string,
  properties: ReturnType<typeof readHoneycombStoryProperties>,
): void {
  const frame = `${variableName}_df`;
  const deliveryHealth = `${variableName}_health_counts`;
  lines.push(
    `    ${frame} = ${data}[${data}['item_name'] != '']`,
    `    ${variableName}_records = []`,
    `    ${variableName}_has_delivery_health = all(_field in ${frame}.columns for _field in ('progress_pct', 'due_date', 'status'))`,
    `    for _, _vdab_row in ${frame}.iterrows():`,
    "        _vdab_record = {",
    "            'item_name': str(_vdab_row.get('item_name', '')).strip(),",
    "            'impact_score': float(_vdab_row.get('impact_score') or 0),",
    "            'priority_level': '' if pd.isna(_vdab_row.get('priority_level', '')) else str(_vdab_row.get('priority_level', '')).strip(),",
    "            'progress_pct': float(_vdab_row.get('progress_pct') or 0),",
    "            'category': '' if pd.isna(_vdab_row.get('category', '')) else str(_vdab_row.get('category', '')).strip(),",
    "        }",
    `        for _vdab_field in ('trend', 'owner', 'due_date', 'notes', 'status'):`,
    `            if _vdab_field in ${frame}.columns and not pd.isna(_vdab_row.get(_vdab_field)) and str(_vdab_row.get(_vdab_field)).strip():`,
    "                _vdab_record[_vdab_field] = str(_vdab_row.get(_vdab_field)).strip()",
    `        for _vdab_field in ('risk_score', 'investment', 'benefit_value'):`,
    `            if _vdab_field in ${frame}.columns and not pd.isna(_vdab_row.get(_vdab_field)):`,
    "                _vdab_record[_vdab_field] = float(_vdab_row.get(_vdab_field))",
    `        if ${variableName}_has_delivery_health:`,
    "            _vdab_status = str(_vdab_record.get('status', '')).strip().lower()",
    "            _vdab_progress = float(_vdab_record.get('progress_pct') or 0)",
    "            _vdab_due = pd.to_datetime(_vdab_record.get('due_date'), errors='coerce', utc=True)",
    "            _vdab_overdue = pd.notna(_vdab_due) and _vdab_due < pd.Timestamp.now(tz='UTC').normalize() and _vdab_progress < 100",
    "            if _vdab_status in ('critical', 'blocked', 'failed') or (_vdab_overdue and _vdab_progress < 50):",
    "                _vdab_record['delivery_health'] = 'behind'",
    "            elif _vdab_status in ('at risk', 'at_risk', 'watch', 'delayed') or _vdab_overdue:",
    "                _vdab_record['delivery_health'] = 'at_risk'",
    "            else:",
    "                _vdab_record['delivery_health'] = 'on_track'",
    `        ${variableName}_records.append(_vdab_record)`,
    `    ${variableName}_categories = {record.get('category') for record in ${variableName}_records if record.get('category')}`,
    `    ${variableName}_average_progress = (sum(record.get('progress_pct', 0) for record in ${variableName}_records) / len(${variableName}_records)) if ${variableName}_records else 0`,
    `    ${variableName}_high_impact_low_progress = [record for record in ${variableName}_records if record.get('impact_score', 0) >= 70 and record.get('progress_pct', 0) < 40]`,
    `    ${variableName}_with_risk = [record for record in ${variableName}_records if 'risk_score' in record]`,
    `    ${variableName}_highest_risk = max(${variableName}_with_risk, key=lambda record: record.get('risk_score', 0), default=None)`,
    `    ${deliveryHealth} = None`,
    `    if any('delivery_health' in record for record in ${variableName}_records):`,
    `        ${deliveryHealth} = {'on_track': 0, 'at_risk': 0, 'behind': 0}`,
    `        for _vdab_record in ${variableName}_records:`,
    "            _vdab_health = _vdab_record.get('delivery_health')",
    `            if _vdab_health in ${deliveryHealth}:`,
    `                ${deliveryHealth}[_vdab_health] += 1`,
    `    ${variableName}_warnings = ['Fewer than 3 items — honeycomb story may be less meaningful.'] if len(${variableName}_records) < 3 else []`,
    `    ${variableName}_payload = {`,
    `        'records': ${variableName}_records,`,
    "        'visualConfig': {",
    `            'show_labels': ${properties.showLabels ? "True" : "False"},`,
    `            'show_risk_borders': ${properties.showRiskBorders ? "True" : "False"},`,
    `            'show_trend_arrows': ${properties.showTrendArrows ? "True" : "False"},`,
    "        },",
    "        'summary': {",
    `            'item_count': len(${variableName}_records),`,
    `            'category_count': len(${variableName}_categories),`,
    `            'avg_progress': ${variableName}_average_progress,`,
    `            'high_impact_low_progress': [{'item_name': record['item_name'], 'impact_score': record['impact_score'], 'progress_pct': record['progress_pct']} for record in ${variableName}_high_impact_low_progress],`,
    `            'highest_risk': ({'item_name': ${variableName}_highest_risk['item_name'], 'risk_score': ${variableName}_highest_risk['risk_score']} if ${variableName}_highest_risk else None),`,
    `            'delivery_health': ${deliveryHealth},`,
    `            'warnings': ${variableName}_warnings,`,
    "        },",
    "    }",
  );
}

function appendCanvas(lines: string[], variableName: string): void {
  const htmlLines = HONEYCOMB_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__HONEYCOMB_PAYLOAD__', json.dumps(${variableName}_payload, default=str).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${HONEYCOMB_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}
