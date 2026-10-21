import streamlit as st
import streamlit.components.v1 as components
import math
import json
import os
import pandas as pd
import re
import time
import urllib.error
import urllib.parse
import urllib.request

st.set_page_config(page_title='Supply chain graph', layout='wide')
st.title('Supply chain graph')

ui_overrides = {'labels': {}}

_VDAB_HTTP_TIMEOUT_SECONDS = 30

class _VDABNoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request: urllib.request.Request, file_pointer: object, status_code: int, message: str, headers: object, new_url: str) -> urllib.request.Request | None:
        return None

def _vdab_open_no_redirect(request: urllib.request.Request) -> object:
    opener = urllib.request.build_opener(_VDABNoRedirectHandler())
    return opener.open(request, timeout=_VDAB_HTTP_TIMEOUT_SECONDS)


_VDAB_SQL_MAX_HTTP_RESPONSE_BYTES = 5000000
_VDAB_SQL_MAX_RESULT_BYTES = 20000000
_VDAB_SQL_MAX_RESULT_ROWS = 10000
_VDAB_SQL_MAX_RESULT_CHUNKS = 100

def _vdab_sql_request(method: str, path: str, body: dict[str, object] | None = None) -> tuple[dict[str, object], int]:
    user_token = st.context.headers.get('x-forwarded-access-token')
    if not user_token:
        raise RuntimeError('The current viewer did not grant Databricks SQL user authorization.')
    workspace_host = os.environ.get('DATABRICKS_HOST', '')
    parsed_host = urllib.parse.urlsplit(workspace_host)
    if parsed_host.scheme != 'https' or not parsed_host.netloc or parsed_host.username or parsed_host.password or parsed_host.path not in ('', '/') or parsed_host.query or parsed_host.fragment:
        raise RuntimeError('The Databricks workspace host is not configured safely.')
    request_body = None if body is None else json.dumps(body).encode('utf-8')
    request = urllib.request.Request(
        f'{parsed_host.scheme}://{parsed_host.netloc}{path}',
        data=request_body,
        headers={'Authorization': f'Bearer {user_token}', 'Accept': 'application/json', 'Content-Type': 'application/json'},
        method=method,
    )
    try:
        with _vdab_open_no_redirect(request) as response:
            response_bytes = response.read(_VDAB_SQL_MAX_HTTP_RESPONSE_BYTES + 1)
        if len(response_bytes) > _VDAB_SQL_MAX_HTTP_RESPONSE_BYTES:
            raise RuntimeError('The Databricks SQL response is too large to load safely.')
        response_body = json.loads(response_bytes.decode('utf-8'))
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise RuntimeError('SQL access denied. Check the current viewer’s sql authorization, warehouse access, and required table permissions.') from None
        raise RuntimeError(f'Databricks rejected the SQL request (HTTP {error.code}).') from None
    except TimeoutError:
        raise RuntimeError('The Databricks SQL API request timed out.') from None
    except urllib.error.URLError:
        raise RuntimeError('The Databricks SQL API could not be reached.') from None
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError('Databricks returned an invalid SQL response.') from None
    if not isinstance(response_body, dict):
        raise RuntimeError('Databricks returned an invalid SQL response.')
    return response_body, len(response_bytes)

def _vdab_quote_sql_identifier(value: str) -> str:
    return '`' + value.replace('`', '``') + '`'

def _vdab_sql_result_part(response_body: dict[str, object]) -> dict[str, object]:
    result_part = response_body.get('result', response_body)
    if not isinstance(result_part, dict):
        raise RuntimeError('Databricks returned an invalid SQL result.')
    return result_part

def _vdab_sql_reject_truncated_result(response_body: dict[str, object]) -> None:
    if response_body.get('truncated') is True:
        raise RuntimeError('The Databricks SQL result was truncated by its configured row or byte limit.')

def _vdab_sql_query_df(catalog: str, schema: str, table: str, max_rows: int, primary_key: str | None = None, query_statement: str | None = None, warehouse_id_override: str | None = None, source_kind: str = 'unityCatalogTable', database: str | None = None, endpoint: str | None = None) -> pd.DataFrame:
    if source_kind == 'lakebaseAutoscaling':
        if not isinstance(database, str) or not isinstance(endpoint, str):
            raise RuntimeError('The Lakebase database and endpoint must be selected before previewing.')
        return _vdab_lakebase_query_df(schema, table, max_rows, query_statement, database, endpoint)
    if source_kind != 'unityCatalogTable':
        raise RuntimeError('The selected database source is not supported by this generated app.')
    warehouse_id = warehouse_id_override or os.environ.get('DATABRICKS_SQL_WAREHOUSE_ID', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', warehouse_id):
        raise RuntimeError('Bind an existing SQL warehouse to this app before loading this table.')
    if not isinstance(max_rows, int) or max_rows < 0 or max_rows > _VDAB_SQL_MAX_RESULT_ROWS:
        raise RuntimeError('The requested SQL result row limit is invalid.')
    table_reference = '.'.join(_vdab_quote_sql_identifier(name) for name in (catalog, schema, table))
    if query_statement is not None:
        statement = query_statement.strip()
        if not statement.upper().startswith('SELECT '):
            raise RuntimeError('The generated SQL query is invalid.')
    elif primary_key is None:
        statement = f'SELECT * FROM {table_reference}'
    else:
        key_column = _vdab_quote_sql_identifier(primary_key)
        statement = f'SELECT COUNT(*) AS total_rows, COUNT({key_column}) AS non_null_rows, COUNT(DISTINCT {key_column}) AS unique_rows FROM {table_reference}'
    if max_rows > 0:
        statement += f' LIMIT {max_rows:d}'
    request_body = {
        'statement': statement,
        'warehouse_id': warehouse_id,
        'wait_timeout': '30s',
        'on_wait_timeout': 'CONTINUE',
        'disposition': 'INLINE',
        'format': 'JSON_ARRAY',
    }
    request_body['row_limit'] = max_rows if max_rows > 0 else _VDAB_SQL_MAX_RESULT_ROWS
    request_body['byte_limit'] = _VDAB_SQL_MAX_RESULT_BYTES
    response_body, result_bytes = _vdab_sql_request('POST', '/api/2.0/sql/statements', request_body)
    statement_id = response_body.get('statement_id')
    if not isinstance(statement_id, str) or not re.fullmatch(r'[A-Za-z0-9-]{1,128}', statement_id):
        raise RuntimeError('Databricks returned an invalid SQL statement identifier.')
    status_part = response_body.get('status')
    if not isinstance(status_part, dict):
        raise RuntimeError('Databricks returned an invalid SQL statement status.')
    state = status_part.get('state')
    for _poll_attempt in range(12):
        if state == 'SUCCEEDED':
            break
        if state not in ('PENDING', 'RUNNING'):
            raise RuntimeError('The Databricks SQL statement did not complete successfully.')
        time.sleep(1)
        statement_path = '/api/2.0/sql/statements/' + urllib.parse.quote(statement_id, safe='')
        statement_path += '?warehouse_id=' + urllib.parse.quote(warehouse_id, safe='')
        response_body, response_bytes = _vdab_sql_request('GET', statement_path)
        result_bytes += response_bytes
        if result_bytes > _VDAB_SQL_MAX_RESULT_BYTES:
            raise RuntimeError('The Databricks SQL result is too large to load safely.')
        status_part = response_body.get('status')
        if not isinstance(status_part, dict):
            raise RuntimeError('Databricks returned an invalid SQL statement status.')
        state = status_part.get('state')
    if state != 'SUCCEEDED':
        raise RuntimeError('The Databricks SQL statement timed out before results were ready.')
    _vdab_sql_reject_truncated_result(response_body)
    manifest = response_body.get('manifest')
    if not isinstance(manifest, dict):
        raise RuntimeError('Databricks returned an invalid SQL result manifest.')
    schema_part = manifest.get('schema')
    if not isinstance(schema_part, dict) or not isinstance(schema_part.get('columns'), list):
        raise RuntimeError('Databricks returned invalid SQL column metadata.')
    column_names = [column.get('name') for column in schema_part['columns'] if isinstance(column, dict)]
    if len(column_names) != len(schema_part['columns']) or not all(isinstance(name, str) for name in column_names):
        raise RuntimeError('Databricks returned invalid SQL column metadata.')
    result_part = _vdab_sql_result_part(response_body)
    if result_bytes > _VDAB_SQL_MAX_RESULT_BYTES:
        raise RuntimeError('The Databricks SQL result is too large to load safely.')
    rows = []
    row_limit = max_rows if max_rows > 0 else _VDAB_SQL_MAX_RESULT_ROWS
    next_chunk_index = 0
    for _chunk_attempt in range(_VDAB_SQL_MAX_RESULT_CHUNKS):
        data_array = result_part.get('data_array')
        if not isinstance(data_array, list) or not all(isinstance(row, list) for row in data_array):
            raise RuntimeError('Databricks returned invalid SQL row data.')
        if len(rows) + len(data_array) > row_limit:
            raise RuntimeError('The Databricks SQL result exceeded its configured row limit.')
        rows.extend(data_array)
        next_chunk_index = result_part.get('next_chunk_index')
        if next_chunk_index is None:
            break
        if not isinstance(next_chunk_index, int) or next_chunk_index < 0:
            raise RuntimeError('Databricks returned an invalid SQL result page.')
        chunk_path = '/api/2.0/sql/statements/' + urllib.parse.quote(statement_id, safe='')
        chunk_path += '/result/chunks/' + str(next_chunk_index) + '?warehouse_id=' + urllib.parse.quote(warehouse_id, safe='')
        chunk_response, chunk_response_bytes = _vdab_sql_request('GET', chunk_path)
        _vdab_sql_reject_truncated_result(chunk_response)
        result_bytes += chunk_response_bytes
        if result_bytes > _VDAB_SQL_MAX_RESULT_BYTES:
            raise RuntimeError('The Databricks SQL result is too large to load safely.')
        result_part = _vdab_sql_result_part(chunk_response)
    else:
        raise RuntimeError('The Databricks SQL result contains too many pages to load safely.')
    return pd.DataFrame(rows, columns=column_names)

_vdab_lbl_vdab_networkwebstory1 = ui_overrides.get('labels', {}).get('networkWebStory1', None)
_vdab_disp_lbl_vdab_networkwebstory1 = _vdab_lbl_vdab_networkwebstory1 if _vdab_lbl_vdab_networkwebstory1 is not None else 'Supplier Network'
st.subheader(_vdab_disp_lbl_vdab_networkwebstory1)
try:
    vdab_networkwebstory1_data = _vdab_sql_query_df('main', 'supply', 'edges', 1000, query_statement='SELECT `source_id` AS source_entity_id, `source_label` AS source_entity_label, `target_id` AS target_entity_id, `target_label` AS target_entity_label, `relationship_type` AS relationship_type, `weight` AS relationship_weight, `direction` AS direction, `edge_value` AS edge_value, `frequency` AS frequency, `edge_risk` AS edge_risk_score, `edge_status` AS edge_status, `source_category` AS source_category, `target_category` AS target_category, `source_value` AS source_value, `target_value` AS target_value, `source_health` AS source_health_score, `target_health` AS target_health_score, `source_risk` AS source_risk_score, `target_risk` AS target_risk_score FROM (SELECT * FROM `main`.`supply`.`edges` WHERE `snapshot_date` = (SELECT MAX(`snapshot_date`) FROM `main`.`supply`.`edges`))')
except RuntimeError as vdab_error_vdab_networkwebstory1:
    st.error(str(vdab_error_vdab_networkwebstory1))
    vdab_networkwebstory1_data = pd.DataFrame(columns=['source_entity_id', 'target_entity_id', 'relationship_type', 'relationship_weight'])
if vdab_networkwebstory1_data is None or vdab_networkwebstory1_data.empty or not all(_vdab_column in vdab_networkwebstory1_data.columns for _vdab_column in ('source_entity_id', 'source_entity_label', 'target_entity_id', 'target_entity_label', 'relationship_type', 'relationship_weight')):
    st.info('No network edges returned. Check bindings and field mappings.')
else:
    vdab_networkwebstory1_data = vdab_networkwebstory1_data.copy()
    if 'relationship_weight' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['relationship_weight'] = pd.to_numeric(vdab_networkwebstory1_data['relationship_weight'], errors='coerce')
        vdab_networkwebstory1_data['relationship_weight'] = vdab_networkwebstory1_data['relationship_weight'].where(vdab_networkwebstory1_data['relationship_weight'].map(math.isfinite))
    if 'edge_value' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['edge_value'] = pd.to_numeric(vdab_networkwebstory1_data['edge_value'], errors='coerce')
        vdab_networkwebstory1_data['edge_value'] = vdab_networkwebstory1_data['edge_value'].where(vdab_networkwebstory1_data['edge_value'].map(math.isfinite))
    if 'frequency' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['frequency'] = pd.to_numeric(vdab_networkwebstory1_data['frequency'], errors='coerce')
        vdab_networkwebstory1_data['frequency'] = vdab_networkwebstory1_data['frequency'].where(vdab_networkwebstory1_data['frequency'].map(math.isfinite))
    if 'edge_risk_score' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['edge_risk_score'] = pd.to_numeric(vdab_networkwebstory1_data['edge_risk_score'], errors='coerce')
        vdab_networkwebstory1_data['edge_risk_score'] = vdab_networkwebstory1_data['edge_risk_score'].where(vdab_networkwebstory1_data['edge_risk_score'].map(math.isfinite))
    if 'source_value' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['source_value'] = pd.to_numeric(vdab_networkwebstory1_data['source_value'], errors='coerce')
        vdab_networkwebstory1_data['source_value'] = vdab_networkwebstory1_data['source_value'].where(vdab_networkwebstory1_data['source_value'].map(math.isfinite))
    if 'target_value' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['target_value'] = pd.to_numeric(vdab_networkwebstory1_data['target_value'], errors='coerce')
        vdab_networkwebstory1_data['target_value'] = vdab_networkwebstory1_data['target_value'].where(vdab_networkwebstory1_data['target_value'].map(math.isfinite))
    if 'source_health_score' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['source_health_score'] = pd.to_numeric(vdab_networkwebstory1_data['source_health_score'], errors='coerce')
        vdab_networkwebstory1_data['source_health_score'] = vdab_networkwebstory1_data['source_health_score'].where(vdab_networkwebstory1_data['source_health_score'].map(math.isfinite))
    if 'target_health_score' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['target_health_score'] = pd.to_numeric(vdab_networkwebstory1_data['target_health_score'], errors='coerce')
        vdab_networkwebstory1_data['target_health_score'] = vdab_networkwebstory1_data['target_health_score'].where(vdab_networkwebstory1_data['target_health_score'].map(math.isfinite))
    if 'source_risk_score' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['source_risk_score'] = pd.to_numeric(vdab_networkwebstory1_data['source_risk_score'], errors='coerce')
        vdab_networkwebstory1_data['source_risk_score'] = vdab_networkwebstory1_data['source_risk_score'].where(vdab_networkwebstory1_data['source_risk_score'].map(math.isfinite))
    if 'target_risk_score' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['target_risk_score'] = pd.to_numeric(vdab_networkwebstory1_data['target_risk_score'], errors='coerce')
        vdab_networkwebstory1_data['target_risk_score'] = vdab_networkwebstory1_data['target_risk_score'].where(vdab_networkwebstory1_data['target_risk_score'].map(math.isfinite))
    if 'source_entity_id' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['source_entity_id'] = vdab_networkwebstory1_data['source_entity_id'].fillna('').astype(str).str.strip()
    if 'source_entity_label' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['source_entity_label'] = vdab_networkwebstory1_data['source_entity_label'].fillna('').astype(str).str.strip()
    if 'target_entity_id' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['target_entity_id'] = vdab_networkwebstory1_data['target_entity_id'].fillna('').astype(str).str.strip()
    if 'target_entity_label' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['target_entity_label'] = vdab_networkwebstory1_data['target_entity_label'].fillna('').astype(str).str.strip()
    if 'relationship_type' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['relationship_type'] = vdab_networkwebstory1_data['relationship_type'].fillna('').astype(str).str.strip()
    if 'direction' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['direction'] = vdab_networkwebstory1_data['direction'].fillna('').astype(str).str.strip()
    if 'edge_status' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['edge_status'] = vdab_networkwebstory1_data['edge_status'].fillna('').astype(str).str.strip()
    if 'source_category' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['source_category'] = vdab_networkwebstory1_data['source_category'].fillna('').astype(str).str.strip()
    if 'target_category' in vdab_networkwebstory1_data.columns:
        vdab_networkwebstory1_data['target_category'] = vdab_networkwebstory1_data['target_category'].fillna('').astype(str).str.strip()
    vdab_networkwebstory1_data = vdab_networkwebstory1_data[(vdab_networkwebstory1_data['source_entity_id'] != '') & (vdab_networkwebstory1_data['target_entity_id'] != '')]
    vdab_networkwebstory1_data['relationship_weight'] = vdab_networkwebstory1_data['relationship_weight'].fillna(0)
    vdab_networkwebstory1_data = vdab_networkwebstory1_data[vdab_networkwebstory1_data['relationship_weight'] >= 0]
    vdab_networkwebstory1_edge_map = {}
    vdab_networkwebstory1_node_meta = {}
    for _, _vdab_row in vdab_networkwebstory1_data.iterrows():
        _vdab_source = _vdab_row.get('source_entity_id', '')
        _vdab_target = _vdab_row.get('target_entity_id', '')
        _vdab_source = '' if pd.isna(_vdab_source) else str(_vdab_source).strip()
        _vdab_target = '' if pd.isna(_vdab_target) else str(_vdab_target).strip()
        if not _vdab_source or not _vdab_target:
            continue
        _vdab_type = '' if pd.isna(_vdab_row.get('relationship_type', '')) else str(_vdab_row.get('relationship_type', '')).strip()
        _vdab_weight = _vdab_row.get('relationship_weight', 0)
        _vdab_weight = 0.0 if pd.isna(_vdab_weight) else float(_vdab_weight)
        _vdab_key = (_vdab_source, _vdab_target, _vdab_type)
        if _vdab_key in vdab_networkwebstory1_edge_map:
            vdab_networkwebstory1_edge_map[_vdab_key]['weight'] += _vdab_weight
            for _vdab_field in ('edge_value', 'frequency'):
                _vdab_value = _vdab_row.get(_vdab_field)
                if _vdab_field in vdab_networkwebstory1_data.columns and not pd.isna(_vdab_value):
                    vdab_networkwebstory1_edge_map[_vdab_key][_vdab_field] = (vdab_networkwebstory1_edge_map[_vdab_key].get(_vdab_field) or 0) + float(_vdab_value)
            continue
        _vdab_edge = {'source': _vdab_source, 'target': _vdab_target, 'relationship_type': _vdab_type, 'weight': _vdab_weight}
        for _vdab_field in ('direction', 'edge_status'):
            _vdab_value = _vdab_row.get(_vdab_field)
            if _vdab_field in vdab_networkwebstory1_data.columns and not pd.isna(_vdab_value) and str(_vdab_value).strip():
                _vdab_edge[_vdab_field] = str(_vdab_value).strip()
        if 'edge_risk_score' in vdab_networkwebstory1_data.columns and not pd.isna(_vdab_row.get('edge_risk_score')):
            _vdab_edge['edge_risk_score'] = float(_vdab_row.get('edge_risk_score'))
        vdab_networkwebstory1_edge_map[_vdab_key] = _vdab_edge
        for _vdab_prefix, _vdab_id_col, _vdab_label_col in (('source', 'source_entity_id', 'source_entity_label'), ('target', 'target_entity_id', 'target_entity_label')):
            _vdab_node_id = _vdab_source if _vdab_prefix == 'source' else _vdab_target
            if _vdab_node_id not in vdab_networkwebstory1_node_meta:
                vdab_networkwebstory1_node_meta[_vdab_node_id] = {'id': _vdab_node_id, 'label': '', 'category': '', 'value': None, 'health_score': None, 'risk_score': None}
            _vdab_meta = vdab_networkwebstory1_node_meta[_vdab_node_id]
            _vdab_label = _vdab_row.get(_vdab_label_col)
            if not _vdab_meta['label'] and not pd.isna(_vdab_label):
                _vdab_meta['label'] = str(_vdab_label).strip()
            _vdab_category_col = _vdab_prefix + '_category'
            _vdab_category = _vdab_row.get(_vdab_category_col)
            if _vdab_category_col in vdab_networkwebstory1_data.columns and not _vdab_meta['category'] and not pd.isna(_vdab_category) and str(_vdab_category).strip():
                _vdab_meta['category'] = str(_vdab_category).strip()
            _vdab_numeric_col = _vdab_prefix + '_value'
            _vdab_numeric = _vdab_row.get(_vdab_numeric_col)
            if _vdab_numeric_col in vdab_networkwebstory1_data.columns and _vdab_meta['value'] is None and not pd.isna(_vdab_numeric):
                _vdab_meta['value'] = float(_vdab_numeric)
            _vdab_numeric_col = _vdab_prefix + '_health_score'
            _vdab_numeric = _vdab_row.get(_vdab_numeric_col)
            if _vdab_numeric_col in vdab_networkwebstory1_data.columns and _vdab_meta['health_score'] is None and not pd.isna(_vdab_numeric):
                _vdab_meta['health_score'] = float(_vdab_numeric)
            _vdab_numeric_col = _vdab_prefix + '_risk_score'
            _vdab_numeric = _vdab_row.get(_vdab_numeric_col)
            if _vdab_numeric_col in vdab_networkwebstory1_data.columns and _vdab_meta['risk_score'] is None and not pd.isna(_vdab_numeric):
                _vdab_meta['risk_score'] = float(_vdab_numeric)
    vdab_networkwebstory1_edges = list(vdab_networkwebstory1_edge_map.values())
    vdab_networkwebstory1_edges.sort(key=lambda _vdab_edge: _vdab_edge.get('weight', 0), reverse=True)
    vdab_networkwebstory1_degree = {}
    for _vdab_edge in vdab_networkwebstory1_edges:
        vdab_networkwebstory1_degree[_vdab_edge['source']] = vdab_networkwebstory1_degree.get(_vdab_edge['source'], 0) + 1
        vdab_networkwebstory1_degree[_vdab_edge['target']] = vdab_networkwebstory1_degree.get(_vdab_edge['target'], 0) + 1
    _vdab_node_ids = sorted(vdab_networkwebstory1_node_meta.keys(), key=lambda _vdab_node: vdab_networkwebstory1_degree.get(_vdab_node, 0), reverse=True)
    vdab_networkwebstory1_keep_nodes = set(_vdab_node_ids[:300])
    vdab_networkwebstory1_edges = [_vdab_edge for _vdab_edge in vdab_networkwebstory1_edges if _vdab_edge['source'] in vdab_networkwebstory1_keep_nodes and _vdab_edge['target'] in vdab_networkwebstory1_keep_nodes][:800]
    vdab_networkwebstory1_keep_nodes = set()
    for _vdab_edge in vdab_networkwebstory1_edges:
        vdab_networkwebstory1_keep_nodes.add(_vdab_edge['source'])
        vdab_networkwebstory1_keep_nodes.add(_vdab_edge['target'])
    vdab_networkwebstory1_nodes = []
    for _vdab_node_id in sorted(vdab_networkwebstory1_keep_nodes):
        _vdab_meta = vdab_networkwebstory1_node_meta[_vdab_node_id]
        _vdab_node = {'id': _vdab_node_id, 'label': _vdab_meta['label'] or _vdab_node_id, 'category': _vdab_meta['category'] or 'Other', 'degree': int(vdab_networkwebstory1_degree.get(_vdab_node_id, 0))}
        if _vdab_meta['value'] is not None: _vdab_node['value'] = _vdab_meta['value']
        if _vdab_meta['health_score'] is not None: _vdab_node['health_score'] = _vdab_meta['health_score']
        if _vdab_meta['risk_score'] is not None: _vdab_node['risk_score'] = _vdab_meta['risk_score']
        vdab_networkwebstory1_nodes.append(_vdab_node)
    vdab_networkwebstory1_payload = {
        'nodes': vdab_networkwebstory1_nodes,
        'edges': vdab_networkwebstory1_edges,
        'visualConfig': {
            'layout_algorithm': 'force',
            'node_size_by': 'degree',
            'node_color_by': 'category',
            'edge_width_by': 'weight',
            'edge_color_by': 'relationship_type',
            'show_arrows': True,
            'highlight_depth': 1,
            'min_weight_filter': 0,
            'max_nodes': 300,
            'max_edges': 800,
        },
        'summary': {'total_nodes': len(vdab_networkwebstory1_nodes), 'total_edges': len(vdab_networkwebstory1_edges), 'warnings': []},
    }
    vdab_networkwebstory1_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"/>\n'
        '<style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:260px;line-height:1.35;}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}\n'
        '#toolbar{position:absolute;left:10px;top:10px;z-index:4;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:92%;}\n'
        '#search{background:rgba(15,23,42,.85);color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:12px;min-width:140px;}\n'
        '#legend{position:absolute;left:10px;bottom:28px;z-index:3;display:flex;flex-wrap:wrap;gap:6px;max-width:80%;}\n'
        '.leg{cursor:pointer;padding:3px 8px;border:0;border-radius:999px;font:inherit;font-size:11px;color:#0b1220;opacity:.95;user-select:none;}\n'
        '.leg.off{opacity:.35;text-decoration:line-through;}\n'
        'button:focus-visible,input:focus-visible,canvas:focus-visible{outline:2px solid #67e8f9;outline-offset:2px;}\n'
        '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}\n'
        '</style></head><body>\n'
        '<div id="wrap"><div id="toolbar"><input id="search" type="search" placeholder="Search nodes…" aria-label="Search nodes by label"/></div><canvas id="c" role="group" tabindex="0" aria-describedby="hint" aria-label="Interactive relationship graph. Use arrow keys to move between nodes, Enter or Space to select a node, Escape to clear selection, plus and minus to zoom, and Home to reset the view."></canvas><div id="tip"></div><div id="legend" role="group" aria-label="Filter graph categories and relationship types"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset · click node to highlight · use arrow keys to navigate</div><div id="announce" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div></div>\n'
        '<script>\n'
        'const payload = __NETWORK_WEB_PAYLOAD__;\n'
        'const canvas = document.getElementById(\'c\');\n'
        'const tip = document.getElementById(\'tip\');\n'
        'const legendEl = document.getElementById(\'legend\');\n'
        'const searchEl = document.getElementById(\'search\');\n'
        'const announcer = document.getElementById(\'announce\');\n'
        'const ctx = canvas.getContext(\'2d\');\n'
        'const cfg = Object.assign({\n'
        '  layout_algorithm: \'force\', node_size_by: \'degree\', node_color_by: \'category\',\n'
        '  edge_width_by: \'weight\', edge_color_by: \'relationship_type\', show_arrows: true,\n'
        '  highlight_depth: 1, min_weight_filter: 0,\n'
        '  max_nodes: 300, max_edges: 800\n'
        '}, (payload && payload.visualConfig) || {});\n'
        'let nodes = Array.isArray(payload && payload.nodes) ? payload.nodes.map(n => Object.assign({}, n)) : [];\n'
        'let edges = Array.isArray(payload && payload.edges) ? payload.edges.map(e => Object.assign({}, e)) : [];\n'
        'const hiddenCats = new Set();\n'
        'const hiddenTypes = new Set();\n'
        'let selectedId = null;\n'
        'let keyboardNodeId = null;\n'
        'let hoverNodeId = null;\n'
        'let hoverEdgeKey = null;\n'
        'let searchQuery = \'\';\n'
        'let panX = 0, panY = 0, zoom = 1;\n'
        'let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;\n'
        'let settled = false;\n'
        'const CATEGORY_COLORS = [\'#2dd4bf\',\'#38bdf8\',\'#a78bfa\',\'#f472b6\',\'#fbbf24\',\'#34d399\',\'#fb7185\',\'#60a5fa\',\'#c084fc\',\'#4ade80\'];\n'
        'const TYPE_COLORS = [\'#67e8f9\',\'#fcd34d\',\'#f9a8d4\',\'#86efac\',\'#fdba74\',\'#a5b4fc\',\'#5eead4\',\'#fda4af\'];\n'
        'const MIN_ZOOM = 0.4, MAX_ZOOM = 3.0;\n'
        '\n'
        'function hashStr(s){ let h=0; for(let i=0;i<String(s).length;i++){ h=((h<<5)-h)+String(s).charCodeAt(i); h|=0;} return Math.abs(h); }\n'
        'function catColor(cat){ return CATEGORY_COLORS[hashStr(cat)%CATEGORY_COLORS.length]; }\n'
        'function typeColor(t){ return TYPE_COLORS[hashStr(t)%TYPE_COLORS.length]; }\n'
        'function healthColor(h){ const v=Math.max(0,Math.min(100,Number(h)||0)); const r=Math.round(255*(1-v/100)); const g=Math.round(180*(v/100)+40); return `rgb(${r},${g},120)`; }\n'
        'function riskColor(r){ const v=Math.max(0,Math.min(100,Number(r)||0)); return `rgb(${Math.round(120+v*1.3)},${Math.round(200-v*1.5)},90)`; }\n'
        'function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }\n'
        'function edgeKey(e){ return e.source+\'|\'+e.target+\'|\'+(e.relationship_type||\'\'); }\n'
        '\n'
        'function nodeRadius(n){\n'
        '  const mode=(cfg.node_size_by||\'degree\').toLowerCase();\n'
        '  if(mode===\'none\') return 8;\n'
        '  let v = mode===\'value\' ? num(n.value, num(n.degree,1)) : num(n.degree,1);\n'
        '  const vals = nodes.map(x => mode===\'value\' ? num(x.value, num(x.degree,1)) : num(x.degree,1));\n'
        '  const lo=Math.min(...vals), hi=Math.max(...vals);\n'
        '  if(!(hi>lo)) return 10;\n'
        '  const t=(v-lo)/(hi-lo);\n'
        '  return 6 + Math.sqrt(t)*14;\n'
        '}\n'
        'function nodeFill(n){\n'
        '  const mode=(cfg.node_color_by||\'category\').toLowerCase();\n'
        '  if(mode===\'health_score\') return healthColor(n.health_score);\n'
        '  if(mode===\'risk_score\') return riskColor(n.risk_score);\n'
        '  return catColor(n.category||\'Other\');\n'
        '}\n'
        'function edgeWidth(e){\n'
        '  const mode=(cfg.edge_width_by||\'weight\').toLowerCase();\n'
        '  if(mode===\'none\') return 1.2;\n'
        '  let v = mode===\'frequency\' ? num(e.frequency,1) : mode===\'value\' ? num(e.edge_value, num(e.weight,1)) : num(e.weight,1);\n'
        '  const vals = edges.map(x => mode===\'frequency\' ? num(x.frequency,1) : mode===\'value\' ? num(x.edge_value, num(x.weight,1)) : num(x.weight,1));\n'
        '  const lo=Math.min(...vals), hi=Math.max(...vals);\n'
        '  if(!(hi>lo)) return 1.5;\n'
        '  return 0.8 + ((v-lo)/(hi-lo))*4.5;\n'
        '}\n'
        'function edgeStroke(e){\n'
        '  const mode=(cfg.edge_color_by||\'relationship_type\').toLowerCase();\n'
        '  if(mode===\'none\') return \'rgba(148,163,184,.55)\';\n'
        '  if(mode===\'risk_score\') return riskColor(e.edge_risk_score);\n'
        '  if(mode===\'status\'){\n'
        '    const s=String(e.edge_status||\'\').toLowerCase();\n'
        '    if(s===\'blocked\') return \'#f87171\';\n'
        '    if(s===\'watch\') return \'#fbbf24\';\n'
        '    return \'#34d399\';\n'
        '  }\n'
        '  return typeColor(e.relationship_type||\'link\');\n'
        '}\n'
        '\n'
        'function initLayout(W,H){\n'
        '  const pad=36;\n'
        '  const mode=(cfg.layout_algorithm||\'force\').toLowerCase();\n'
        '  nodes.forEach((n,i)=>{\n'
        '    if(mode===\'radial\'){\n'
        '      const ang=(i/Math.max(nodes.length,1))*Math.PI*2;\n'
        '      const rad=Math.min(W,H)*0.35;\n'
        '      n.x=W/2+Math.cos(ang)*rad;\n'
        '      n.y=H/2+Math.sin(ang)*rad;\n'
        '    } else {\n'
        '      const ang=hashStr(n.id)%360 * Math.PI/180;\n'
        '      const rad=20+(hashStr(n.id+\'r\')%100);\n'
        '      n.x=W/2+Math.cos(ang)*rad*(0.4+Math.random()*0.6);\n'
        '      n.y=H/2+Math.sin(ang)*rad*(0.4+Math.random()*0.6);\n'
        '    }\n'
        '    n.vx=0; n.vy=0; n._r=nodeRadius(n);\n'
        '  });\n'
        '  if(mode!==\'radial\'){\n'
        '    for(let iter=0; iter<180; iter++){\n'
        '      for(let i=0;i<nodes.length;i++){\n'
        '        for(let j=i+1;j<nodes.length;j++){\n'
        '          const a=nodes[i], b=nodes[j];\n'
        '          let dx=a.x-b.x, dy=a.y-b.y;\n'
        '          let dist=Math.sqrt(dx*dx+dy*dy)||0.01;\n'
        '          const force=900/(dist*dist);\n'
        '          dx=(dx/dist)*force; dy=(dy/dist)*force;\n'
        '          a.vx+=dx; a.vy+=dy; b.vx-=dx; b.vy-=dy;\n'
        '        }\n'
        '      }\n'
        '      edges.forEach(e=>{\n'
        '        const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);\n'
        '        if(!a||!b) return;\n'
        '        let dx=b.x-a.x, dy=b.y-a.y;\n'
        '        let dist=Math.sqrt(dx*dx+dy*dy)||0.01;\n'
        '        const ideal=70;\n'
        '        const force=(dist-ideal)*0.02;\n'
        '        dx=(dx/dist)*force; dy=(dy/dist)*force;\n'
        '        a.vx+=dx; a.vy+=dy; b.vx-=dx; b.vy-=dy;\n'
        '      });\n'
        '      nodes.forEach(n=>{\n'
        '        n.vx+=(W/2-n.x)*0.004; n.vy+=(H/2-n.y)*0.004;\n'
        '        n.vx*=0.85; n.vy*=0.85;\n'
        '        n.x+=n.vx; n.y+=n.vy;\n'
        '        n.x=Math.max(pad+n._r, Math.min(W-pad-n._r, n.x));\n'
        '        n.y=Math.max(pad+n._r, Math.min(H-pad-n._r, n.y));\n'
        '      });\n'
        '    }\n'
        '  }\n'
        '  settled=true;\n'
        '}\n'
        '\n'
        'function visibleNodes(){\n'
        '  return nodes.filter(n=>{\n'
        '    if(hiddenCats.has(String(n.category||\'Other\'))) return false;\n'
        '    if(searchQuery){\n'
        '      const q=searchQuery.toLowerCase();\n'
        '      if(!String(n.label||\'\').toLowerCase().includes(q) && !String(n.id).toLowerCase().includes(q)) return false;\n'
        '    }\n'
        '    return true;\n'
        '  });\n'
        '}\n'
        'function visibleNodeIds(){ return new Set(visibleNodes().map(n=>n.id)); }\n'
        'function visibleEdges(){\n'
        '  const ids=visibleNodeIds();\n'
        '  return edges.filter(e=>{\n'
        '    if(hiddenTypes.has(String(e.relationship_type||\'\'))) return false;\n'
        '    return ids.has(e.source) && ids.has(e.target);\n'
        '  });\n'
        '}\n'
        '\n'
        'function neighborhood(rootId, depth){\n'
        '  const keep=new Set([rootId]);\n'
        '  let frontier=new Set([rootId]);\n'
        '  for(let d=0;d<depth;d++){\n'
        '    const next=new Set();\n'
        '    edges.forEach(e=>{\n'
        '      if(frontier.has(e.source) && !keep.has(e.target)){ next.add(e.target); keep.add(e.target); }\n'
        '      if(frontier.has(e.target) && !keep.has(e.source)){ next.add(e.source); keep.add(e.source); }\n'
        '    });\n'
        '    frontier=next;\n'
        '  }\n'
        '  return keep;\n'
        '}\n'
        '\n'
        'function screenToWorld(sx,sy){ return { x:(sx-panX)/zoom, y:(sy-panY)/zoom }; }\n'
        'function hitNode(sx,sy){\n'
        '  const p=screenToWorld(sx,sy);\n'
        '  const vis=visibleNodes();\n'
        '  for(let i=vis.length-1;i>=0;i--){\n'
        '    const n=vis[i];\n'
        '    const dx=p.x-n.x, dy=p.y-n.y;\n'
        '    if(dx*dx+dy*dy <= (n._r+2)*(n._r+2)) return n;\n'
        '  }\n'
        '  return null;\n'
        '}\n'
        'function hitEdge(sx,sy){\n'
        '  const p=screenToWorld(sx,sy);\n'
        '  const vis=visibleEdges();\n'
        '  let best=null, bestD=8/zoom;\n'
        '  vis.forEach(e=>{\n'
        '    const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);\n'
        '    if(!a||!b) return;\n'
        '    const dx=b.x-a.x, dy=b.y-a.y;\n'
        '    const len2=dx*dx+dy*dy||1;\n'
        '    let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2;\n'
        '    t=Math.max(0,Math.min(1,t));\n'
        '    const hx=a.x+t*dx, hy=a.y+t*dy;\n'
        '    const d=Math.hypot(p.x-hx,p.y-hy);\n'
        '    if(d<bestD){ bestD=d; best=e; }\n'
        '  });\n'
        '  return best;\n'
        '}\n'
        '\n'
        'function drawArrow(ax,ay,bx,by,color,width){\n'
        '  const ang=Math.atan2(by-ay,bx-ax);\n'
        '  const mx=(ax+bx)/2, my=(ay+by)/2;\n'
        '  const s=6+width;\n'
        '  ctx.beginPath();\n'
        '  ctx.moveTo(mx,my);\n'
        '  ctx.lineTo(mx-s*Math.cos(ang-0.4), my-s*Math.sin(ang-0.4));\n'
        '  ctx.lineTo(mx-s*Math.cos(ang+0.4), my-s*Math.sin(ang+0.4));\n'
        '  ctx.closePath();\n'
        '  ctx.fillStyle=color;\n'
        '  ctx.fill();\n'
        '}\n'
        '\n'
        'function draw(){\n'
        '  const wrap=canvas.parentElement;\n'
        '  const W=wrap.clientWidth||640, H=wrap.clientHeight||560;\n'
        '  const dpr=window.devicePixelRatio||1;\n'
        '  if(canvas.width!==W*dpr || canvas.height!==H*dpr){\n'
        '    canvas.width=W*dpr; canvas.height=H*dpr;\n'
        '    canvas.style.width=W+\'px\'; canvas.style.height=H+\'px\';\n'
        '  }\n'
        '  ctx.setTransform(dpr,0,0,dpr,0,0);\n'
        '  ctx.clearRect(0,0,W,H);\n'
        '  if(!settled && nodes.length){ initLayout(W,H); buildLegend(); }\n'
        '\n'
        '  const highlight = selectedId ? neighborhood(selectedId, cfg.highlight_depth||1) : null;\n'
        '  const visNodes=visibleNodes();\n'
        '  const visEdges=visibleEdges();\n'
        '\n'
        '  ctx.save();\n'
        '  ctx.translate(panX, panY);\n'
        '  ctx.scale(zoom, zoom);\n'
        '\n'
        '  visEdges.forEach(e=>{\n'
        '    const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);\n'
        '    if(!a||!b) return;\n'
        '    const dim = highlight && !(highlight.has(e.source) && highlight.has(e.target));\n'
        '    const color=edgeStroke(e);\n'
        '    const w=edgeWidth(e);\n'
        '    ctx.beginPath();\n'
        '    ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);\n'
        '    ctx.strokeStyle=dim ? \'rgba(100,116,139,.2)\' : color;\n'
        '    ctx.globalAlpha=dim ? 0.35 : (hoverEdgeKey===edgeKey(e) ? 1 : 0.75);\n'
        '    ctx.lineWidth=w / Math.max(zoom,0.5);\n'
        '    ctx.stroke();\n'
        '    ctx.globalAlpha=1;\n'
        '    if(cfg.show_arrows && !dim) drawArrow(a.x,a.y,b.x,b.y,color,w);\n'
        '  });\n'
        '\n'
        '  visNodes.forEach(n=>{\n'
        '    const dim = highlight && !highlight.has(n.id);\n'
        '    const r=n._r||nodeRadius(n);\n'
        '    n._r=r;\n'
        '    ctx.beginPath();\n'
        '    ctx.arc(n.x,n.y,r,0,Math.PI*2);\n'
        '    ctx.fillStyle=dim ? \'rgba(100,116,139,.35)\' : nodeFill(n);\n'
        '    ctx.globalAlpha=dim ? 0.35 : 1;\n'
        '    ctx.fill();\n'
        '    ctx.lineWidth=(n.id===keyboardNodeId ? 3.5 : (n.id===selectedId || n.id===hoverNodeId ? 2.5 : 1.2)) / Math.max(zoom,0.5);\n'
        '    ctx.strokeStyle=n.id===keyboardNodeId ? \'#67e8f9\' : (n.id===selectedId ? \'#f8fafc\' : \'rgba(15,23,42,.55)\');\n'
        '    ctx.stroke();\n'
        '    ctx.globalAlpha=1;\n'
        '    if(!dim && (zoom>0.7 || n.id===selectedId || n.id===hoverNodeId)){\n'
        '      ctx.fillStyle=\'#e2e8f0\';\n'
        '      ctx.font=`${11/Math.max(zoom,0.7)}px system-ui,sans-serif`;\n'
        '      ctx.textAlign=\'center\';\n'
        '      ctx.fillText(String(n.label||n.id).slice(0,18), n.x, n.y+r+12/Math.max(zoom,0.7));\n'
        '    }\n'
        '  });\n'
        '  ctx.restore();\n'
        '  requestAnimationFrame(draw);\n'
        '}\n'
        '\n'
        'function buildLegend(){\n'
        '  legendEl.innerHTML=\'\';\n'
        '  const cats=[...new Set(nodes.map(n=>String(n.category||\'Other\')))].sort();\n'
        '  const types=[...new Set(edges.map(e=>String(e.relationship_type||\'link\')))].sort();\n'
        '  cats.forEach(cat=>{\n'
        '    const el=document.createElement(\'button\');\n'
        '    el.type=\'button\';\n'
        '    el.className=\'leg\'+(hiddenCats.has(cat)?\' off\':\'\');\n'
        '    el.style.background=catColor(cat);\n'
        '    el.textContent=\'● \'+cat;\n'
        '    el.setAttribute(\'aria-label\',\'Toggle category \'+cat);\n'
        '    el.setAttribute(\'aria-pressed\',String(!hiddenCats.has(cat)));\n'
        '    el.onclick=()=>{ if(hiddenCats.has(cat)) hiddenCats.delete(cat); else hiddenCats.add(cat); el.classList.toggle(\'off\'); el.setAttribute(\'aria-pressed\',String(!hiddenCats.has(cat))); };\n'
        '    legendEl.appendChild(el);\n'
        '  });\n'
        '  types.forEach(t=>{\n'
        '    const el=document.createElement(\'button\');\n'
        '    el.type=\'button\';\n'
        '    el.className=\'leg\'+(hiddenTypes.has(t)?\' off\':\'\');\n'
        '    el.style.background=typeColor(t);\n'
        '    el.textContent=\'— \'+t;\n'
        '    el.setAttribute(\'aria-label\',\'Toggle relationship type \'+t);\n'
        '    el.setAttribute(\'aria-pressed\',String(!hiddenTypes.has(t)));\n'
        '    el.onclick=()=>{ if(hiddenTypes.has(t)) hiddenTypes.delete(t); else hiddenTypes.add(t); el.classList.toggle(\'off\'); el.setAttribute(\'aria-pressed\',String(!hiddenTypes.has(t))); };\n'
        '    legendEl.appendChild(el);\n'
        '  });\n'
        '}\n'
        '\n'
        'function showTip(html, sx, sy){\n'
        '  tip.innerHTML=html; tip.style.display=\'block\';\n'
        '  const wrap=canvas.parentElement.getBoundingClientRect();\n'
        '  tip.style.left=Math.min(sx+12, wrap.width-220)+\'px\';\n'
        '  tip.style.top=Math.min(sy+12, wrap.height-80)+\'px\';\n'
        '}\n'
        'function hideTip(){ tip.style.display=\'none\'; }\n'
        'function keyboardTipHtml(n){\n'
        '  return \'<strong>\'+esc(n.label||n.id)+\'</strong><br/>Category: \'+esc(n.category||\'—\')+\'<br/>Degree: \'+num(n.degree,0);\n'
        '}\n'
        'function selectKeyboardNode(direction){\n'
        '  const candidates=visibleNodes();\n'
        '  if(!candidates.length) return;\n'
        '  const currentIndex=candidates.findIndex(n=>n.id===keyboardNodeId);\n'
        '  const nextIndex=currentIndex<0 ? (direction<0 ? candidates.length-1 : 0) : (currentIndex+direction+candidates.length)%candidates.length;\n'
        '  const node=candidates[nextIndex];\n'
        '  keyboardNodeId=node.id;\n'
        '  const rect=canvas.getBoundingClientRect();\n'
        '  showTip(keyboardTipHtml(node),12,Math.min(12,rect.height-80));\n'
        '  announcer.textContent=\'Focused node \'+String(node.label||node.id)+\'. Press Enter or Space to toggle its highlight.\';\n'
        '  draw();\n'
        '}\n'
        '\n'
        'canvas.addEventListener(\'pointerdown\', (ev)=>{\n'
        '  dragging=true; didDrag=false;\n'
        '  dragStartX=ev.clientX; dragStartY=ev.clientY;\n'
        '  panStartX=panX; panStartY=panY;\n'
        '  canvas.setPointerCapture(ev.pointerId);\n'
        '});\n'
        'canvas.addEventListener(\'pointermove\', (ev)=>{\n'
        '  const rect=canvas.getBoundingClientRect();\n'
        '  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;\n'
        '  if(dragging){\n'
        '    const dx=ev.clientX-dragStartX, dy=ev.clientY-dragStartY;\n'
        '    if(Math.hypot(dx,dy)>3) didDrag=true;\n'
        '    panX=panStartX+dx; panY=panStartY+dy;\n'
        '    hideTip(); return;\n'
        '  }\n'
        '  const n=hitNode(sx,sy);\n'
        '  const e=n?null:hitEdge(sx,sy);\n'
        '  hoverNodeId=n?n.id:null;\n'
        '  hoverEdgeKey=e?edgeKey(e):null;\n'
        '  if(n){\n'
        '    showTip(`<strong>${esc(n.label||n.id)}</strong><br/>Category: ${esc(n.category||\'—\')}<br/>Degree: ${num(n.degree,0)}`\n'
        '      +(n.value!=null?`<br/>Value: ${num(n.value,0)}`:\'\')\n'
        '      +(n.health_score!=null?`<br/>Health: ${num(n.health_score,0)}`:\'\')\n'
        '      +(n.risk_score!=null?`<br/>Risk: ${num(n.risk_score,0)}`:\'\'), sx, sy);\n'
        '  } else if(e){\n'
        '    showTip(`<strong>${esc(e.relationship_type||\'link\')}</strong><br/>${esc(e.source)} → ${esc(e.target)}<br/>Weight: ${num(e.weight,0)}`\n'
        '      +(e.edge_status?`<br/>Status: ${esc(e.edge_status)}`:\'\')\n'
        '      +(e.edge_risk_score!=null?`<br/>Risk: ${num(e.edge_risk_score,0)}`:\'\'), sx, sy);\n'
        '  } else hideTip();\n'
        '});\n'
        'canvas.addEventListener(\'pointerup\', (ev)=>{\n'
        '  dragging=false;\n'
        '  if(!didDrag){\n'
        '    const rect=canvas.getBoundingClientRect();\n'
        '    const n=hitNode(ev.clientX-rect.left, ev.clientY-rect.top);\n'
        '    keyboardNodeId=null;\n'
        '    selectedId = n ? (selectedId===n.id ? null : n.id) : null;\n'
        '  }\n'
        '});\n'
        'canvas.addEventListener(\'pointerleave\', ()=>{ hoverNodeId=null; hoverEdgeKey=null; hideTip(); });\n'
        'canvas.addEventListener(\'wheel\', (ev)=>{\n'
        '  ev.preventDefault();\n'
        '  const rect=canvas.getBoundingClientRect();\n'
        '  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;\n'
        '  const before=screenToWorld(sx,sy);\n'
        '  const factor=ev.deltaY>0 ? 0.92 : 1.08;\n'
        '  zoom=Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom*factor));\n'
        '  panX=sx-before.x*zoom; panY=sy-before.y*zoom;\n'
        '}, {passive:false});\n'
        'canvas.addEventListener(\'dblclick\', ()=>{ panX=0; panY=0; zoom=1; selectedId=null; keyboardNodeId=null; });\n'
        'searchEl.addEventListener(\'input\', ()=>{ searchQuery=searchEl.value.trim(); });\n'
        'canvas.addEventListener(\'keydown\', (ev)=>{\n'
        '  if(ev.key===\'ArrowRight\'||ev.key===\'ArrowDown\'){ ev.preventDefault(); selectKeyboardNode(1); return; }\n'
        '  if(ev.key===\'ArrowLeft\'||ev.key===\'ArrowUp\'){ ev.preventDefault(); selectKeyboardNode(-1); return; }\n'
        '  if(ev.key===\'Enter\'||ev.key===\' \'){\n'
        '    if(keyboardNodeId!==null){\n'
        '      ev.preventDefault();\n'
        '      selectedId=selectedId===keyboardNodeId?null:keyboardNodeId;\n'
        '      const node=nodes.find(candidate=>candidate.id===keyboardNodeId);\n'
        '      announcer.textContent=node ? (selectedId===null ? \'Cleared highlight for \' : \'Highlighted \')+String(node.label||node.id)+\'.\' : \'Graph selection cleared.\';\n'
        '      draw();\n'
        '    }\n'
        '    return;\n'
        '  }\n'
        '  if(ev.key===\'Escape\'){ selectedId=null; keyboardNodeId=null; hideTip(); announcer.textContent=\'Graph selection cleared.\'; draw(); return; }\n'
        '  if(ev.key===\'Home\'){ panX=0; panY=0; zoom=1; selectedId=null; keyboardNodeId=null; hideTip(); announcer.textContent=\'Graph view reset.\'; draw(); return; }\n'
        '  if(ev.key===\'+\'||ev.key===\'=\'){ ev.preventDefault(); zoom=Math.min(MAX_ZOOM,zoom*1.1); draw(); return; }\n'
        '  if(ev.key===\'-\'){ ev.preventDefault(); zoom=Math.max(MIN_ZOOM,zoom/1.1); draw(); }\n'
        '});\n'
        '\n'
        'function esc(s){ return String(s).replace(/[&<>"\']/g, c=>({ \'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\' }[c])); }\n'
        '\n'
        'requestAnimationFrame(draw);\n'
        '</script></body></html>\n'
    )
    vdab_networkwebstory1_html = vdab_networkwebstory1_html.replace('__NETWORK_WEB_PAYLOAD__', json.dumps(vdab_networkwebstory1_payload, default=str, allow_nan=False).replace('<', '\\u003c'))
    components.html(vdab_networkwebstory1_html, height=620, scrolling=False)
