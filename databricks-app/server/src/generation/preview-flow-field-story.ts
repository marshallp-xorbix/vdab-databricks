import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readFlowFieldStoryProperties,
  validateFlowFieldStoryBindings,
} from "../db/project-component-flow-field-story.ts";
import { invalidFlowFieldStory } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  lakebaseQueryOptions,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { FLOW_FIELD_STORY_HTML } from "./flow-field-story-html.ts";

const MAX_FLOW_FIELD_QUERY_ROWS = 500;
const FLOW_FIELD_CANVAS_HEIGHT_PX = 520;
const REQUIRED_MAPPING_NAMES = ["source stage", "destination stage", "flow volume", "stage order"];

/** Appends viewer-authorized current-workspace flow data and the interactive canvas. */
export function appendFlowFieldStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidFlowFieldStory(detail);
  if (
    component.type !== "FlowFieldStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("FlowFieldStory contains an unsupported component shape.");
  }

  const properties = readFlowFieldStoryProperties(
    component.properties,
    () => invalid("FlowFieldStory properties are invalid."),
  );
  validateFlowFieldStoryBindings(
    component.bindings,
    component.properties,
    () => invalid("FlowFieldStory fields must reference valid table metadata."),
  );
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
    lines.push(`st.info(${pythonString(`Map the required FlowFieldStory fields: ${REQUIRED_MAPPING_NAMES.join(", ")}.`)})`);
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
  properties: ReturnType<typeof readFlowFieldStoryProperties>,
): string | null {
  const requiredAxes = [
    properties.sourceStage,
    properties.destinationStage,
    properties.flowVolume,
    properties.stageOrder,
  ];
  if (requiredAxes.some((axis) => axis.field === "")) {
    return null;
  }

  const source = quoteChartIdentifier(properties.sourceStage.field, binding.kind);
  const destination = quoteChartIdentifier(properties.destinationStage.field, binding.kind);
  const selected = [
    `${source} AS source_stage`,
    `${destination} AS destination_stage`,
    `${measure(properties.flowVolume, "sum", binding.kind)} AS flow_volume`,
    `${measure(properties.stageOrder, "max", binding.kind)} AS stage_order`,
  ];
  addOptionalMeasure(selected, properties.conversionPct, "conversion_pct", "avg", binding.kind);
  addOptionalMeasure(selected, properties.dropOffCount, "drop_off", "sum", binding.kind);
  addOptionalMeasure(selected, properties.avgTimeInStage, "avg_time_in_stage", "avg", binding.kind);
  addOptionalStatus(selected, properties.status, binding.kind);

  const table = quoteChartTable(binding);
  const filteredTable = properties.timeField.field === ""
    ? table
    : latestPeriodTable(table, properties.timeField.field, binding.kind);
  return `SELECT ${selected.join(", ")} FROM ${filteredTable} GROUP BY ${source}, ${destination}`;
}

function measure(
  axis: ReturnType<typeof readFlowFieldStoryProperties>["flowVolume"],
  noneFallback: string,
  kind: ChartBinding["kind"],
): string {
  const transform = axis.transform === "none" ? noneFallback : axis.transform;
  return chartMeasureExpression(axis.field, transform, invalidFlowFieldStory, kind);
}

function addOptionalMeasure(
  selected: string[],
  axis: ReturnType<typeof readFlowFieldStoryProperties>["conversionPct"],
  alias: string,
  noneFallback: string,
  kind: ChartBinding["kind"],
): void {
  if (axis.field !== "") {
    selected.push(`${measure(axis, noneFallback, kind)} AS ${alias}`);
  }
}

function addOptionalStatus(
  selected: string[],
  axis: ReturnType<typeof readFlowFieldStoryProperties>["status"],
  kind: ChartBinding["kind"],
): void {
  if (axis.field !== "") {
    selected.push(`MAX(${quoteChartIdentifier(axis.field, kind)}) AS status`);
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
  properties: ReturnType<typeof readFlowFieldStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = _vdab_sql_query_df(${pythonString(binding.catalog ?? "")}, ${pythonString(binding.schema ?? "")}, ${pythonString(binding.table ?? "")}, ${MAX_FLOW_FIELD_QUERY_ROWS}, query_statement=${pythonString(query)}${lakebaseQueryOptions(binding)})`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame(columns=['source_stage', 'destination_stage', 'flow_volume', 'stage_order'])`,
    `if ${data}.empty or 'source_stage' not in ${data}.columns or 'destination_stage' not in ${data}.columns:`,
    "    st.info('No flow records returned. Check bindings and field mappings.')",
    "else:",
    `    ${data} = ${data}.copy()`,
    ...appendNumericCoercion(data),
    `    ${data}['source_stage'] = ${data}['source_stage'].fillna('').astype(str).str.strip()`,
    `    ${data}['destination_stage'] = ${data}['destination_stage'].fillna('').astype(str).str.strip()`,
    `    ${data} = ${data}[(${data}['source_stage'] != '') & (${data}['destination_stage'] != '')]`,
    `    ${data} = ${data}.dropna(subset=['source_stage', 'destination_stage'])`,
  );
  appendPayload(lines, component, variableName, data, properties);
}

function appendNumericCoercion(data: string): string[] {
  const fields = ["flow_volume", "stage_order", "conversion_pct", "drop_off", "avg_time_in_stage"];
  return fields.flatMap((field) => [
    `    if '${field}' in ${data}.columns:`,
    `        ${data}['${field}'] = pd.to_numeric(${data}['${field}'], errors='coerce')`,
    `        ${data}['${field}'] = ${data}['${field}'].where(${data}['${field}'].map(math.isfinite))`,
  ]);
}

function appendPayload(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
  data: string,
  properties: ReturnType<typeof readFlowFieldStoryProperties>,
): void {
  appendRecords(lines, variableName, data);
  lines.push(
    `    ${variableName}_order_by_stage = {}`,
    `    for _vdab_flow in ${variableName}_flows:`,
    "        _vdab_name = _vdab_flow['source']",
    "        _vdab_order = _vdab_flow.get('stage_order', 0)",
    `        if _vdab_name not in ${variableName}_order_by_stage or _vdab_order > ${variableName}_order_by_stage[_vdab_name]:`,
    `            ${variableName}_order_by_stage[_vdab_name] = _vdab_order`,
    `    ${variableName}_all_names = set(${variableName}_order_by_stage.keys())`,
    `    for _vdab_flow in ${variableName}_flows:`,
    `        ${variableName}_all_names.add(_vdab_flow['destination'])`,
    `    ${variableName}_max_order = max(${variableName}_order_by_stage.values()) if ${variableName}_order_by_stage else 0`,
    `    ${variableName}_stages = []`,
    `    for _vdab_name in ${variableName}_all_names:`,
    `        _vdab_order = ${variableName}_order_by_stage.get(_vdab_name)`,
    "        if _vdab_order is None:",
    `            _vdab_order = ${variableName}_max_order + 1`,
    `        ${variableName}_stages.append({'name': _vdab_name, 'order': float(_vdab_order)})`,
    `    ${variableName}_stages = sorted(${variableName}_stages, key=lambda _vdab_stage: (_vdab_stage['order'], _vdab_stage['name']))`,
    `    ${variableName}_with_drop = [_vdab_flow for _vdab_flow in ${variableName}_flows if 'drop_off' in _vdab_flow]`,
    `    ${variableName}_largest_drop = max(${variableName}_with_drop, key=lambda _vdab_flow: _vdab_flow.get('drop_off', 0), default=None) if ${variableName}_with_drop else None`,
    `    ${variableName}_with_conversion = [_vdab_flow for _vdab_flow in ${variableName}_flows if 'conversion_pct' in _vdab_flow]`,
    `    ${variableName}_bottleneck = None`,
    `    if ${variableName}_with_conversion:`,
    `        ${variableName}_worst = min(${variableName}_with_conversion, key=lambda _vdab_flow: _vdab_flow.get('conversion_pct', 100))`,
    `        ${variableName}_bottleneck = {'name': ${variableName}_worst['source'], 'reason': 'low_conversion'}`,
    `    elif ${variableName}_flows:`,
    `        ${variableName}_heaviest = max(${variableName}_flows, key=lambda _vdab_flow: _vdab_flow.get('volume', 0))`,
    `        ${variableName}_bottleneck = {'name': ${variableName}_heaviest['source'], 'reason': 'high_volume'}`,
    `    ${variableName}_warnings = []`,
    `    if len(${variableName}_flows) < 2:`,
    `        ${variableName}_warnings.append('Fewer than 2 flows — story may be less meaningful.')`,
    `    ${variableName}_payload = {`,
    `        'stages': ${variableName}_stages,`,
    `        'flows': ${variableName}_flows,`,
    "        'visualConfig': {",
    `            'show_drop_offs': ${properties.showDropOffs ? "True" : "False"},`,
    `            'show_labels': ${properties.showLabels ? "True" : "False"},`,
    "        },",
    "        'summary': {",
    `            'stage_count': len(${variableName}_stages),`,
    `            'flow_count': len(${variableName}_flows),`,
    `            'total_volume': sum(_vdab_flow.get('volume', 0) for _vdab_flow in ${variableName}_flows),`,
    `            'largest_drop_off': ({'source': ${variableName}_largest_drop['source'], 'destination': ${variableName}_largest_drop['destination'], 'drop_off': ${variableName}_largest_drop['drop_off']} if ${variableName}_largest_drop else None),`,
    `            'bottleneck_stage': ${variableName}_bottleneck,`,
    `            'warnings': ${variableName}_warnings,`,
    "        },",
    "    }",
  );
  appendCanvas(lines, component.key, variableName);
}

function appendRecords(lines: string[], variableName: string, data: string): void {
  lines.push(
    `    ${variableName}_flows = []`,
    `    for _, _vdab_row in ${data}.iterrows():`,
    `        _vdab_source = str(_vdab_row.get('source_stage') or '').strip()`,
    `        _vdab_destination = str(_vdab_row.get('destination_stage') or '').strip()`,
    "        if not _vdab_source or not _vdab_destination:",
    "            continue",
    "        _vdab_volume = _vdab_row.get('flow_volume', 0)",
    "        _vdab_order = _vdab_row.get('stage_order', 0)",
    "        _vdab_flow = {",
    "            'source': _vdab_source,",
    "            'destination': _vdab_destination,",
    "            'volume': 0.0 if pd.isna(_vdab_volume) else float(_vdab_volume),",
    "            'stage_order': 0.0 if pd.isna(_vdab_order) else float(_vdab_order),",
    "        }",
    "        for _vdab_field in ('conversion_pct', 'drop_off', 'avg_time_in_stage'):",
    `            if _vdab_field in ${data}.columns and not pd.isna(_vdab_row.get(_vdab_field)):`,
    "                _vdab_flow[_vdab_field] = float(_vdab_row.get(_vdab_field))",
    `        if 'status' in ${data}.columns and not pd.isna(_vdab_row.get('status')) and str(_vdab_row.get('status')).strip():`,
    "            _vdab_flow['status'] = str(_vdab_row.get('status')).strip().lower()",
    `        ${variableName}_flows.append(_vdab_flow)`,
  );
}

function appendCanvas(lines: string[], componentKey: string, variableName: string): void {
  const htmlLines = FLOW_FIELD_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__FLOW_FIELD_PAYLOAD__', json.dumps(${variableName}_payload, default=str).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${FLOW_FIELD_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}
