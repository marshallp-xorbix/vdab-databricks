import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  readNetworkWebStoryProperties,
  validateNetworkWebStoryBindings,
} from "../db/project-component-network-web-story.ts";
import { invalidNetworkWebStory } from "./preview-errors.ts";
import { pythonString, formatPythonNumber } from "./preview-python.ts";
import { lakebaseQueryExpression, quoteChartIdentifier, quoteChartTable, readChartBinding } from "./preview-chart-bindings.ts";
import type { ChartBinding } from "./preview-chart-bindings.ts";
import { NETWORK_WEB_STORY_HTML } from "./network-web-story-html.ts";

const MAX_NETWORK_QUERY_ROWS = 1_000;
const NETWORK_WEB_CANVAS_HEIGHT_PX = 620;
const REQUIRED_MAPPING_NAMES = [
  "source entity ID", "source entity label", "target entity ID", "target entity label",
  "relationship type", "relationship weight",
];
const NUMERIC_COLUMNS = [
  "relationship_weight", "edge_value", "frequency", "edge_risk_score", "source_value", "target_value",
  "source_health_score", "target_health_score", "source_risk_score", "target_risk_score",
];
const LABEL_COLUMNS = [
  "source_entity_id", "source_entity_label", "target_entity_id", "target_entity_label", "relationship_type",
  "direction", "edge_status", "source_category", "target_category",
];
const MAPPED_FIELDS = [
  ["sourceEntityId", "source_entity_id"], ["sourceEntityLabel", "source_entity_label"],
  ["targetEntityId", "target_entity_id"], ["targetEntityLabel", "target_entity_label"],
  ["relationshipType", "relationship_type"], ["relationshipWeight", "relationship_weight"],
  ["direction", "direction"], ["edgeValue", "edge_value"], ["frequency", "frequency"],
  ["edgeRiskScore", "edge_risk_score"], ["edgeStatus", "edge_status"],
  ["sourceCategory", "source_category"], ["targetCategory", "target_category"],
  ["sourceValue", "source_value"], ["targetValue", "target_value"],
  ["sourceHealthScore", "source_health_score"], ["targetHealthScore", "target_health_score"],
  ["sourceRiskScore", "source_risk_score"], ["targetRiskScore", "target_risk_score"],
] as const;

/** Appends viewer-authorized current-workspace graph data and the interactive canvas. */
export function appendNetworkWebStory(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  const invalid = (detail: string) => invalidNetworkWebStory(detail);
  if (
    component.type !== "NetworkWebStory" || component.schemaVersion !== 1 ||
    component.children.length > 0 || component.layout !== null
  ) {
    throw invalid("NetworkWebStory contains an unsupported component shape.");
  }

  const properties = readNetworkWebStoryProperties(component.properties, invalid);
  validateNetworkWebStoryBindings(component.bindings, component.properties, invalid);
  const binding = readChartBinding(component.bindings, invalid);
  appendTitle(lines, component, variableName, properties.title);

  if (binding.kind !== "unityCatalogTable" && binding.kind !== "lakebaseAutoscaling" && binding.kind !== "lakebaseProvisionedDatabase") {
    lines.push("st.info('Bind a Unity Catalog or Lakebase table in the hosting workspace to continue.')");
    return;
  }

  const query = buildQuery(binding, properties);
  if (query === null) {
    lines.push(`st.info(${pythonString(`Map the required NetworkWebStory fields: ${REQUIRED_MAPPING_NAMES.join(", ")}.`)})`);
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
  properties: ReturnType<typeof readNetworkWebStoryProperties>,
): string | null {
  const required = [
    properties.sourceEntityId, properties.sourceEntityLabel, properties.targetEntityId,
    properties.targetEntityLabel, properties.relationshipType, properties.relationshipWeight,
  ];
  if (required.some((axis) => axis.field === "")) {
    return null;
  }

  const selected = MAPPED_FIELDS.flatMap(([propertyName, alias]) => {
    const field = properties[propertyName].field;
    return field === "" ? [] : [`${quoteChartIdentifier(field, binding.kind)} AS ${alias}`];
  });
  const table = quoteChartTable(binding);
  const filteredTable = properties.timeField.field === ""
    ? table
    : latestPeriodTable(table, properties.timeField.field, binding.kind);
  return `SELECT ${selected.join(", ")} FROM ${filteredTable}`;
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
  properties: ReturnType<typeof readNetworkWebStoryProperties>,
): void {
  const data = `${variableName}_data`;
  lines.push(
    "try:",
    `    ${data} = ${lakebaseQueryExpression(binding, MAX_NETWORK_QUERY_ROWS, query)}`,
    `except RuntimeError as vdab_error_${variableName}:`,
    `    st.error(str(vdab_error_${variableName}))`,
    `    ${data} = pd.DataFrame(columns=['source_entity_id', 'target_entity_id', 'relationship_type', 'relationship_weight'])`,
    `if ${data} is None or ${data}.empty or not all(_vdab_column in ${data}.columns for _vdab_column in ('source_entity_id', 'source_entity_label', 'target_entity_id', 'target_entity_label', 'relationship_type', 'relationship_weight')):`,
    "    st.info('No network edges returned. Check bindings and field mappings.')",
    "else:",
    `    ${data} = ${data}.copy()`,
    ...appendColumnNormalization(data),
    `    ${data} = ${data}[(${data}['source_entity_id'] != '') & (${data}['target_entity_id'] != '')]`,
    `    ${data}['relationship_weight'] = ${data}['relationship_weight'].fillna(0)`,
    `    ${data} = ${data}[${data}['relationship_weight'] >= ${formatPythonNumber(properties.minWeightFilter)}]`,
  );
  appendGraphPayload(lines, variableName, data, properties);
  appendCanvas(lines, variableName);
}

function appendColumnNormalization(data: string): string[] {
  return [
    ...NUMERIC_COLUMNS.flatMap((field) => [
      `    if '${field}' in ${data}.columns:`,
      `        ${data}['${field}'] = pd.to_numeric(${data}['${field}'], errors='coerce')`,
      `        ${data}['${field}'] = ${data}['${field}'].where(${data}['${field}'].map(math.isfinite))`,
    ]),
    ...LABEL_COLUMNS.flatMap((field) => [
      `    if '${field}' in ${data}.columns:`,
      `        ${data}['${field}'] = ${data}['${field}'].fillna('').astype(str).str.strip()`,
    ]),
  ];
}

function appendGraphPayload(
  lines: string[],
  variableName: string,
  data: string,
  properties: ReturnType<typeof readNetworkWebStoryProperties>,
): void {
  const edgeMap = `${variableName}_edge_map`;
  const nodeMeta = `${variableName}_node_meta`;
  const edges = `${variableName}_edges`;
  const degree = `${variableName}_degree`;
  const keepNodes = `${variableName}_keep_nodes`;

  appendEdgeRows(lines, data, edgeMap, nodeMeta);
  appendNetworkGraphCaps(lines, variableName, edgeMap, nodeMeta, edges, degree, keepNodes, properties);
  appendNetworkPayload(lines, variableName, edges, properties);
}

function appendEdgeRows(lines: string[], data: string, edgeMap: string, nodeMeta: string): void {
  lines.push(
    `    ${edgeMap} = {}`,
    `    ${nodeMeta} = {}`,
    `    for _, _vdab_row in ${data}.iterrows():`,
    `        _vdab_source = _vdab_row.get('source_entity_id', '')`,
    `        _vdab_target = _vdab_row.get('target_entity_id', '')`,
    `        _vdab_source = '' if pd.isna(_vdab_source) else str(_vdab_source).strip()`,
    `        _vdab_target = '' if pd.isna(_vdab_target) else str(_vdab_target).strip()`,
    `        if not _vdab_source or not _vdab_target:`,
    `            continue`,
    `        _vdab_type = '' if pd.isna(_vdab_row.get('relationship_type', '')) else str(_vdab_row.get('relationship_type', '')).strip()`,
    `        _vdab_weight = _vdab_row.get('relationship_weight', 0)`,
    `        _vdab_weight = 0.0 if pd.isna(_vdab_weight) else float(_vdab_weight)`,
    `        _vdab_key = (_vdab_source, _vdab_target, _vdab_type)`,
    `        if _vdab_key in ${edgeMap}:`,
    `            ${edgeMap}[_vdab_key]['weight'] += _vdab_weight`,
    `            for _vdab_field in ('edge_value', 'frequency'):`,
    `                _vdab_value = _vdab_row.get(_vdab_field)`,
    `                if _vdab_field in ${data}.columns and not pd.isna(_vdab_value):`,
    `                    ${edgeMap}[_vdab_key][_vdab_field] = (${edgeMap}[_vdab_key].get(_vdab_field) or 0) + float(_vdab_value)`,
    `            continue`,
    `        _vdab_edge = {'source': _vdab_source, 'target': _vdab_target, 'relationship_type': _vdab_type, 'weight': _vdab_weight}`,
  );
  appendOptionalEdgeValues(lines, data);
  lines.push(
    `        ${edgeMap}[_vdab_key] = _vdab_edge`,
    `        for _vdab_prefix, _vdab_id_col, _vdab_label_col in (('source', 'source_entity_id', 'source_entity_label'), ('target', 'target_entity_id', 'target_entity_label')):`,
    `            _vdab_node_id = _vdab_source if _vdab_prefix == 'source' else _vdab_target`,
    `            if _vdab_node_id not in ${nodeMeta}:`,
    `                ${nodeMeta}[_vdab_node_id] = {'id': _vdab_node_id, 'label': '', 'category': '', 'value': None, 'health_score': None, 'risk_score': None}`,
    `            _vdab_meta = ${nodeMeta}[_vdab_node_id]`,
    `            _vdab_label = _vdab_row.get(_vdab_label_col)`,
    `            if not _vdab_meta['label'] and not pd.isna(_vdab_label):`,
    `                _vdab_meta['label'] = str(_vdab_label).strip()`,
  );
  appendOptionalNodeValues(lines, data);
}

function appendNetworkGraphCaps(
  lines: string[],
  variableName: string,
  edgeMap: string,
  nodeMeta: string,
  edges: string,
  degree: string,
  keepNodes: string,
  properties: ReturnType<typeof readNetworkWebStoryProperties>,
): void {
  lines.push(
    `    ${edges} = list(${edgeMap}.values())`,
    `    ${edges}.sort(key=lambda _vdab_edge: _vdab_edge.get('weight', 0), reverse=True)`,
    `    ${degree} = {}`,
    `    for _vdab_edge in ${edges}:`,
    `        ${degree}[_vdab_edge['source']] = ${degree}.get(_vdab_edge['source'], 0) + 1`,
    `        ${degree}[_vdab_edge['target']] = ${degree}.get(_vdab_edge['target'], 0) + 1`,
    `    _vdab_node_ids = sorted(${nodeMeta}.keys(), key=lambda _vdab_node: ${degree}.get(_vdab_node, 0), reverse=True)`,
    `    ${keepNodes} = set(_vdab_node_ids[:${properties.maxNodes}])`,
    `    ${edges} = [_vdab_edge for _vdab_edge in ${edges} if _vdab_edge['source'] in ${keepNodes} and _vdab_edge['target'] in ${keepNodes}][:${properties.maxEdges}]`,
    `    ${keepNodes} = set()`,
    `    for _vdab_edge in ${edges}:`,
    `        ${keepNodes}.add(_vdab_edge['source'])`,
    `        ${keepNodes}.add(_vdab_edge['target'])`,
    `    ${variableName}_nodes = []`,
    `    for _vdab_node_id in sorted(${keepNodes}):`,
    `        _vdab_meta = ${nodeMeta}[_vdab_node_id]`,
    `        _vdab_node = {'id': _vdab_node_id, 'label': _vdab_meta['label'] or _vdab_node_id, 'category': _vdab_meta['category'] or 'Other', 'degree': int(${degree}.get(_vdab_node_id, 0))}`,
    `        if _vdab_meta['value'] is not None: _vdab_node['value'] = _vdab_meta['value']`,
    `        if _vdab_meta['health_score'] is not None: _vdab_node['health_score'] = _vdab_meta['health_score']`,
    `        if _vdab_meta['risk_score'] is not None: _vdab_node['risk_score'] = _vdab_meta['risk_score']`,
    `        ${variableName}_nodes.append(_vdab_node)`,
  );
}

function appendNetworkPayload(
  lines: string[],
  variableName: string,
  edges: string,
  properties: ReturnType<typeof readNetworkWebStoryProperties>,
): void {
  lines.push(
    `    ${variableName}_payload = {`,
    `        'nodes': ${variableName}_nodes,`,
    `        'edges': ${edges},`,
    `        'visualConfig': {`,
    `            'layout_algorithm': ${pythonString(properties.layoutAlgorithm)},`,
    `            'node_size_by': ${pythonString(properties.nodeSizeBy)},`,
    `            'node_color_by': ${pythonString(properties.nodeColorBy)},`,
    `            'edge_width_by': ${pythonString(properties.edgeWidthBy)},`,
    `            'edge_color_by': ${pythonString(properties.edgeColorBy)},`,
    `            'show_arrows': ${properties.showArrows ? "True" : "False"},`,
    `            'highlight_depth': ${properties.highlightDepth},`,
    `            'min_weight_filter': ${formatPythonNumber(properties.minWeightFilter)},`,
    `            'max_nodes': ${properties.maxNodes},`,
    `            'max_edges': ${properties.maxEdges},`,
    `        },`,
    `        'summary': {'total_nodes': len(${variableName}_nodes), 'total_edges': len(${edges}), 'warnings': []},`,
    `    }`,
  );
}

function appendOptionalEdgeValues(
  lines: string[],
  data: string,
): void {
  lines.push(
    `        for _vdab_field in ('direction', 'edge_status'):` ,
    `            _vdab_value = _vdab_row.get(_vdab_field)`,
    `            if _vdab_field in ${data}.columns and not pd.isna(_vdab_value) and str(_vdab_value).strip():`,
    `                _vdab_edge[_vdab_field] = str(_vdab_value).strip()`,
    `        if 'edge_risk_score' in ${data}.columns and not pd.isna(_vdab_row.get('edge_risk_score')):`,
    `            _vdab_edge['edge_risk_score'] = float(_vdab_row.get('edge_risk_score'))`,
  );
}

function appendOptionalNodeValues(
  lines: string[],
  data: string,
): void {
  lines.push(
    `            _vdab_category_col = _vdab_prefix + '_category'`,
    `            _vdab_category = _vdab_row.get(_vdab_category_col)`,
    `            if _vdab_category_col in ${data}.columns and not _vdab_meta['category'] and not pd.isna(_vdab_category) and str(_vdab_category).strip():`,
    `                _vdab_meta['category'] = str(_vdab_category).strip()`,
  );
  const numeric: ReadonlyArray<readonly [string, string]> = [
    ["value", "value"],
    ["health_score", "health_score"],
    ["risk_score", "risk_score"],
  ];
  for (const [attribute, fieldSuffix] of numeric) {
    lines.push(
      `            _vdab_numeric_col = _vdab_prefix + ${pythonString(`_${fieldSuffix}`)}`,
      `            _vdab_numeric = _vdab_row.get(_vdab_numeric_col)`,
      `            if _vdab_numeric_col in ${data}.columns and _vdab_meta['${attribute}'] is None and not pd.isna(_vdab_numeric):`,
      `                _vdab_meta['${attribute}'] = float(_vdab_numeric)`,
    );
  }
}

function appendCanvas(lines: string[], variableName: string): void {
  const htmlLines = NETWORK_WEB_STORY_HTML.split("\n");
  if (htmlLines.at(-1) === "") {
    htmlLines.pop();
  }
  lines.push(`    ${variableName}_html = (`);
  for (const htmlLine of htmlLines) {
    lines.push(`        ${pythonString(`${htmlLine}\n`)}`);
  }
  lines.push(
    "    )",
    `    ${variableName}_html = ${variableName}_html.replace('__NETWORK_WEB_PAYLOAD__', json.dumps(${variableName}_payload, default=str, allow_nan=False).replace('<', ${pythonString("\\u003c")}))`,
    `    components.html(${variableName}_html, height=${NETWORK_WEB_CANVAS_HEIGHT_PX}, scrolling=False)`,
  );
}
