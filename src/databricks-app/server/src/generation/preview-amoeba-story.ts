import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readAmoebaStoryProperties,
  validateAmoebaStoryBindings,
} from "../db/project-component-amoeba-story.ts";
import { invalidAmoebaStory } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import {
  chartMeasureExpression,
  lakebaseQueryExpression,
  quoteChartIdentifier,
  quoteChartTable,
  readChartBinding,
} from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { AMOEBA_STORY_HTML } from "./amoeba-story-html.ts";

const MAX_AMOEBA_QUERY_ROWS = 100;
const AMOEBA_CANVAS_HEIGHT_PX = 560;
const REQUIRED_MAPPING_NAMES = ["entity", "label", "category", "size", "X position", "Y position", "change"];
const MEASURE_FIELDS = ["size_value", "x_value", "y_value", "change_value", "health_score", "risk_score"];

/** Appends a viewer-authorized AmoebaStory query and interactive canvas renderer. */
export function appendAmoebaStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidAmoebaStory(detail);
  if (
    component.type !== "AmoebaStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("AmoebaStory contains an unsupported component shape.");
  }
  const properties = readAmoebaStoryProperties(component.properties, () => invalid("AmoebaStory properties are invalid."));
  validateAmoebaStoryBindings(component.bindings, component.properties, () => invalid("AmoebaStory fields must reference valid table metadata."));
  const binding = readChartBinding(component.bindings, invalid);
  appendTitle(lines, component, variableName, properties.title);

  if (binding.kind !== "unityCatalogTable" && binding.kind !== "lakebaseAutoscaling" && binding.kind !== "lakebaseProvisionedDatabase") {
    lines.push("st.info('Bind a Unity Catalog or Lakebase table in the hosting workspace to continue.')");
    return;
  }

  const query = buildQuery(binding, properties);
  if (query === null) {
    const missing = REQUIRED_MAPPING_NAMES.join(", ");
    lines.push(`st.info(${pythonString(`Map the required AmoebaStory fields: ${missing}.`)})`);
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
  properties: ReturnType<typeof readAmoebaStoryProperties>,
): string | null {
  const required = [
    properties.entityId,
    properties.entityLabel,
    properties.category,
    properties.sizeMetric,
    properties.xMetric,
    properties.yMetric,
    properties.changeMetric,
  ];
  if (required.some((axis) => axis.field === "")) {
    return null;
  }

  const entityId = quoteChartIdentifier(properties.entityId.field, binding.kind);
  const selected = [
    `${entityId} AS entity_id`,
    `${dimensionExpression(properties.entityLabel, invalidAmoebaStory, binding.kind)} AS entity_label`,
    `${dimensionExpression(properties.category, invalidAmoebaStory, binding.kind)} AS category`,
    `${measureExpression(properties.sizeMetric, "sum", binding.kind)} AS size_value`,
    `${measureExpression(properties.xMetric, "sum", binding.kind)} AS x_value`,
    `${measureExpression(properties.yMetric, "sum", binding.kind)} AS y_value`,
    `${measureExpression(properties.changeMetric, "sum", binding.kind)} AS change_value`,
  ];
  addOptionalMeasure(selected, properties.healthScore, "health_score", "sum", binding.kind);
  addOptionalMeasure(selected, properties.riskScore, "risk_score", "sum", binding.kind);

  const table = quoteChartTable(binding);
  const fromClause = properties.timeField.field === ""
    ? table
    : latestPeriodTable(table, properties.timeField.field, binding.kind);
  return `SELECT ${selected.join(", ")} FROM ${fromClause} GROUP BY ${entityId}`;
}

function dimensionExpression(
  axis: ReturnType<typeof readAmoebaStoryProperties>["entityLabel"],
  invalid: typeof invalidAmoebaStory,
  kind: ChartBinding["kind"],
): string {
  if (axis.transform === "none") {
    return `MAX(${quoteChartIdentifier(axis.field, kind)})`;
  }
  return chartMeasureExpression(axis.field, axis.transform, invalid, kind);
}

function measureExpression(
  axis: ReturnType<typeof readAmoebaStoryProperties>["sizeMetric"],
  noneFallback: string,
  kind: ChartBinding["kind"],
): string {
  return chartMeasureExpression(axis.field, axis.transform === "none" ? noneFallback : axis.transform, invalidAmoebaStory, kind);
}

function addOptionalMeasure(
  selectParts: string[],
  axis: ReturnType<typeof readAmoebaStoryProperties>["healthScore"],
  alias: string,
  noneFallback: string,
  kind: ChartBinding["kind"],
): void {
  if (axis.field !== "") {
    selectParts.push(`${measureExpression(axis, noneFallback, kind)} AS ${alias}`);
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
  properties: ReturnType<typeof readAmoebaStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = ${lakebaseQueryExpression(binding, MAX_AMOEBA_QUERY_ROWS, query)}`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame()`,
    `if ${data} is None or ${data}.empty or 'entity_id' not in ${data}.columns:`,
    "    st.info('No AmoebaStory records returned. Check bindings and field mappings.')",
    "else:",
    `    ${variableName}_df = ${data}.copy()`,
  );
  appendNumericCoercion(lines, variableName);
  appendRecords(lines, variableName);
  appendPayload(lines, variableName, properties);
  appendCanvas(lines, variableName);
}

function appendNumericCoercion(lines: string[], variableName: string): void {
  const frame = `${variableName}_df`;
  lines.push(
    `    for _vdab_col in ${pythonStringList(MEASURE_FIELDS)}:`,
    `        if _vdab_col in ${frame}.columns:`,
    `            ${frame}[_vdab_col] = pd.to_numeric(${frame}[_vdab_col], errors='coerce')`,
    `    ${frame} = ${frame}.dropna(subset=['entity_id'])`,
  );
}

function appendRecords(lines: string[], variableName: string): void {
  const frame = `${variableName}_df`;
  lines.push(
    `    ${variableName}_records = []`,
    `    for _, _vdab_row in ${frame}.iterrows():`,
    "        _vdab_record = {",
    "            'entity_id': None if pd.isna(_vdab_row.get('entity_id')) else _vdab_row.get('entity_id'),",
    "            'entity_label': '' if pd.isna(_vdab_row.get('entity_label', '')) else str(_vdab_row.get('entity_label', '')),",
    "            'category': '' if pd.isna(_vdab_row.get('category', '')) else str(_vdab_row.get('category', '')),",
    "            'size_value': None if pd.isna(_vdab_row.get('size_value')) else float(_vdab_row.get('size_value')),",
    "            'x_value': None if pd.isna(_vdab_row.get('x_value')) else float(_vdab_row.get('x_value')),",
    "            'y_value': None if pd.isna(_vdab_row.get('y_value')) else float(_vdab_row.get('y_value')),",
    "            'change_value': None if pd.isna(_vdab_row.get('change_value')) else float(_vdab_row.get('change_value')),",
    "        }",
    "        for _vdab_optional in ('health_score', 'risk_score'):",
    `            if _vdab_optional in ${frame}.columns and not pd.isna(_vdab_row.get(_vdab_optional)):`,
    "                _vdab_record[_vdab_optional] = float(_vdab_row.get(_vdab_optional))",
    `        ${variableName}_records.append(_vdab_record)`,
  );
}

function appendPayload(
  lines: string[],
  variableName: string,
  properties: ReturnType<typeof readAmoebaStoryProperties>,
): void {
  const config: Record<string, string | number | boolean> = {
    layout_mode: properties.layoutMode,
    size_scale: properties.sizeScale,
    min_radius_px: properties.minRadiusPx,
    max_radius_px: properties.maxRadiusPx,
    color_by: properties.colorBy,
    pulse_by: properties.pulseBy,
    pulse_threshold: properties.pulseThreshold,
    pulse_threshold_mode: properties.pulseThresholdMode,
    shape_variation: properties.shapeVariation,
    label_mode: properties.labelMode,
    animation_enabled: properties.animationEnabled,
    animation_speed: properties.animationSpeed,
  };
  const configLines = Object.entries(config).map(([key, value]) =>
    `        ${pythonString(key)}: ${pythonConfigValue(value)},`,
  );
  lines.push(
    `    ${variableName}_payload = {`,
    `        'records': ${variableName}_records,`,
    "        'visualConfig': {",
    ...configLines,
    "        },",
    `        'summary': {'total_entities': len(${variableName}_records), 'excluded_rows': 0, 'warnings': []},`,
    "    }",
  );
}

function pythonConfigValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return pythonString(value);
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value);
}

function appendCanvas(lines: string[], variableName: string): void {
  const htmlLines = AMOEBA_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__AMOEBA_PAYLOAD__', json.dumps(${variableName}_payload, default=str).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${AMOEBA_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}

function pythonStringList(values: string[]): string {
  return `[${values.map(pythonString).join(", ")}]`;
}
