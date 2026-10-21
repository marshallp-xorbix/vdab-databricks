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

st.set_page_config(page_title='Heat Map by State', layout='wide')
st.title('Heat Map by State')

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

_vdab_lbl_vdab_heatmapstory1 = ui_overrides.get('labels', {}).get('heatMapStory1', None)
_vdab_disp_lbl_vdab_heatmapstory1 = _vdab_lbl_vdab_heatmapstory1 if _vdab_lbl_vdab_heatmapstory1 is not None else 'State Revenue'
st.subheader(_vdab_disp_lbl_vdab_heatmapstory1)
try:
    vdab_heatmapstory1_data = _vdab_sql_query_df('main', 'sales', 'state_sales', 500, query_statement='SELECT `state_code` AS area_key, SUM(`revenue`) AS metric_value, SUM(`units`) AS secondary_value, AVG(`growth_pct`) AS change_pct, AVG(`target`) AS target_value, AVG(`risk`) AS risk_score, MAX(`region`) AS category, AVG(`forecast`) AS forecast_value, MAX(`notes`) AS notes FROM (SELECT * FROM `main`.`sales`.`state_sales` WHERE `order_month` = (SELECT MAX(`order_month`) FROM `main`.`sales`.`state_sales`)) GROUP BY `state_code`')
except RuntimeError as vdab_error_vdab_heatmapstory1:
    st.error(str(vdab_error_vdab_heatmapstory1))
    vdab_heatmapstory1_data = pd.DataFrame(columns=['area_key', 'metric_value'])
if vdab_heatmapstory1_data.empty or 'area_key' not in vdab_heatmapstory1_data.columns:
    st.info('No geographic areas returned. Check bindings and field mappings.')
else:
    vdab_heatmapstory1_data = vdab_heatmapstory1_data.copy()
    if 'metric_value' in vdab_heatmapstory1_data.columns:
        vdab_heatmapstory1_data['metric_value'] = pd.to_numeric(vdab_heatmapstory1_data['metric_value'], errors='coerce')
        vdab_heatmapstory1_data['metric_value'] = vdab_heatmapstory1_data['metric_value'].where(vdab_heatmapstory1_data['metric_value'].map(math.isfinite))
    if 'secondary_value' in vdab_heatmapstory1_data.columns:
        vdab_heatmapstory1_data['secondary_value'] = pd.to_numeric(vdab_heatmapstory1_data['secondary_value'], errors='coerce')
        vdab_heatmapstory1_data['secondary_value'] = vdab_heatmapstory1_data['secondary_value'].where(vdab_heatmapstory1_data['secondary_value'].map(math.isfinite))
    if 'change_pct' in vdab_heatmapstory1_data.columns:
        vdab_heatmapstory1_data['change_pct'] = pd.to_numeric(vdab_heatmapstory1_data['change_pct'], errors='coerce')
        vdab_heatmapstory1_data['change_pct'] = vdab_heatmapstory1_data['change_pct'].where(vdab_heatmapstory1_data['change_pct'].map(math.isfinite))
    if 'target_value' in vdab_heatmapstory1_data.columns:
        vdab_heatmapstory1_data['target_value'] = pd.to_numeric(vdab_heatmapstory1_data['target_value'], errors='coerce')
        vdab_heatmapstory1_data['target_value'] = vdab_heatmapstory1_data['target_value'].where(vdab_heatmapstory1_data['target_value'].map(math.isfinite))
    if 'risk_score' in vdab_heatmapstory1_data.columns:
        vdab_heatmapstory1_data['risk_score'] = pd.to_numeric(vdab_heatmapstory1_data['risk_score'], errors='coerce')
        vdab_heatmapstory1_data['risk_score'] = vdab_heatmapstory1_data['risk_score'].where(vdab_heatmapstory1_data['risk_score'].map(math.isfinite))
    if 'forecast_value' in vdab_heatmapstory1_data.columns:
        vdab_heatmapstory1_data['forecast_value'] = pd.to_numeric(vdab_heatmapstory1_data['forecast_value'], errors='coerce')
        vdab_heatmapstory1_data['forecast_value'] = vdab_heatmapstory1_data['forecast_value'].where(vdab_heatmapstory1_data['forecast_value'].map(math.isfinite))
    vdab_heatmapstory1_data = vdab_heatmapstory1_data.dropna(subset=['area_key'])
    vdab_heatmapstory1_data['area_key'] = vdab_heatmapstory1_data['area_key'].astype(str).str.strip()
    vdab_heatmapstory1_data = vdab_heatmapstory1_data[vdab_heatmapstory1_data['area_key'] != '']
    vdab_heatmapstory1_data['metric_value'] = vdab_heatmapstory1_data['metric_value'].fillna(0)
    vdab_heatmapstory1_records = []
    for _, _vdab_row in vdab_heatmapstory1_data.iterrows():
        _vdab_record = {
            'area_key': str(_vdab_row.get('area_key', '')).strip(),
            'metric_value': float(_vdab_row.get('metric_value') or 0),
        }
        if 'secondary_value' in vdab_heatmapstory1_data.columns and not pd.isna(_vdab_row.get('secondary_value')):
            _vdab_record['secondary_value'] = float(_vdab_row.get('secondary_value'))
        if 'change_pct' in vdab_heatmapstory1_data.columns and not pd.isna(_vdab_row.get('change_pct')):
            _vdab_record['change_pct'] = float(_vdab_row.get('change_pct'))
        if 'target_value' in vdab_heatmapstory1_data.columns and not pd.isna(_vdab_row.get('target_value')):
            _vdab_record['target_value'] = float(_vdab_row.get('target_value'))
        if 'risk_score' in vdab_heatmapstory1_data.columns and not pd.isna(_vdab_row.get('risk_score')):
            _vdab_record['risk_score'] = float(_vdab_row.get('risk_score'))
        if 'forecast_value' in vdab_heatmapstory1_data.columns and not pd.isna(_vdab_row.get('forecast_value')):
            _vdab_record['forecast_value'] = float(_vdab_row.get('forecast_value'))
        if 'category' in vdab_heatmapstory1_data.columns and not pd.isna(_vdab_row.get('category')):
            _vdab_record['category'] = str(_vdab_row.get('category'))
        if 'notes' in vdab_heatmapstory1_data.columns and not pd.isna(_vdab_row.get('notes')) and str(_vdab_row.get('notes')).strip():
            _vdab_record['notes'] = str(_vdab_row.get('notes')).strip()
        vdab_heatmapstory1_records.append(_vdab_record)
    vdab_heatmapstory1_sorted = sorted(vdab_heatmapstory1_records, key=lambda _vdab_record: _vdab_record['metric_value'], reverse=True)
    vdab_heatmapstory1_highest = {'area_key': vdab_heatmapstory1_sorted[0]['area_key'], 'metric_value': vdab_heatmapstory1_sorted[0]['metric_value']} if vdab_heatmapstory1_sorted else None
    vdab_heatmapstory1_lowest = {'area_key': vdab_heatmapstory1_sorted[-1]['area_key'], 'metric_value': vdab_heatmapstory1_sorted[-1]['metric_value']} if vdab_heatmapstory1_sorted else None
    vdab_heatmapstory1_with_change = [_vdab_record for _vdab_record in vdab_heatmapstory1_records if 'change_pct' in _vdab_record]
    vdab_heatmapstory1_positive_change = max(vdab_heatmapstory1_with_change, key=lambda _vdab_record: _vdab_record['change_pct'], default=None)
    vdab_heatmapstory1_negative_change = min(vdab_heatmapstory1_with_change, key=lambda _vdab_record: _vdab_record['change_pct'], default=None)
    vdab_heatmapstory1_payload = {
        'records': vdab_heatmapstory1_records,
        'visualConfig': {
            'map_scope': 'usa',
            'geographic_level': 'state',
            'color_scale': 'sequential',
            'show_labels': True,
            'show_legend': True,
            'aggregation_method': 'sum',
        },
        'summary': {
            'matched_areas': len(vdab_heatmapstory1_records),
            'unmatched_keys': [],
            'highest': vdab_heatmapstory1_highest,
            'lowest': vdab_heatmapstory1_lowest,
            'largest_positive_change': ({'area_key': vdab_heatmapstory1_positive_change['area_key'], 'change_pct': vdab_heatmapstory1_positive_change['change_pct']} if vdab_heatmapstory1_positive_change else None),
            'largest_negative_change': ({'area_key': vdab_heatmapstory1_negative_change['area_key'], 'change_pct': vdab_heatmapstory1_negative_change['change_pct']} if vdab_heatmapstory1_negative_change else None),
            'warnings': [],
        },
    }
    vdab_heatmapstory1_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"/>\n'
        '<style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35;}\n'
        '#warn{position:absolute;left:10px;bottom:8px;right:160px;z-index:3;font-size:10px;color:rgba(251,191,36,.85);pointer-events:none;}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}\n'
        '</style></head><body>\n'
        '<div id="wrap"><canvas id="c"></canvas><div id="tip"></div><div id="warn"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset</div></div>\n'
        '<script>\n'
        '\n'
        'const payload = __HEAT_MAP_PAYLOAD__;\n'
        'const canvas = document.getElementById(\'c\');\n'
        'const tip = document.getElementById(\'tip\');\n'
        'const ctx = canvas.getContext(\'2d\');\n'
        'const cfg = Object.assign({\n'
        '  map_scope: \'usa\', geographic_level: \'state\', color_scale: \'sequential\',\n'
        '  show_labels: true, show_legend: true, aggregation_method: \'sum\'\n'
        '}, (payload && payload.visualConfig) || {});\n'
        'let records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];\n'
        'const summary = (payload && payload.summary) || {};\n'
        'let panX = 0, panY = 0, zoom = 1;\n'
        'let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;\n'
        'const MIN_ZOOM = 0.85, MAX_ZOOM = 3.5;\n'
        'let hoverCode = null;\n'
        'const VIEW = { width: 1000, height: 620 };\n'
        'const USA = {"AL":{"name":"Alabama","rings":[[[645.3,336.2],[673.0,333.7],[677.6,350.2],[684.4,374.4],[686.8,379.7],[689.0,382.5],[688.5,384.5],[690.5,385.5],[688.0,388.3],[688.4,390.7],[687.3,394.2],[689.6,399.9],[689.0,405.1],[691.5,410.2],[683.3,411.2],[648.5,414.7],[648.2,417.3],[652.2,420.7],[651.9,424.0],[653.3,425.5],[651.1,428.6],[648.8,429.4],[644.4,426.6],[643.5,421.8],[642.2,421.4],[640.9,425.1],[640.7,428.7],[636.3,428.1],[632.6,398.4],[633.4,361.0],[633.9,339.3],[632.1,337.4],[645.3,336.2]]]},"AK":{"name":"Alaska","rings":[[[138.9,477.9],[140.7,478.4],[141.4,478.1],[142.4,478.0],[143.6,478.2],[144.2,477.9],[144.9,478.5],[146.2,479.0],[147.8,479.0],[148.1,478.5],[149.1,478.1],[149.5,477.5],[150.6,477.2],[151.3,477.3],[152.8,477.7],[153.9,478.5],[154.8,478.8],[155.9,479.1],[156.8,479.6],[157.4,479.6],[158.1,479.8],[172.4,552.1],[174.3,552.4],[176.5,552.2],[177.3,550.8],[179.6,550.1],[179.7,552.3],[180.4,552.9],[181.9,553.3],[182.5,554.3],[187.4,557.4],[188.7,559.8],[189.2,558.9],[190.6,557.2],[191.5,556.9],[191.7,555.9],[192.0,554.3],[191.8,553.1],[193.0,552.4],[194.4,550.9],[196.7,552.2],[197.6,554.3],[198.7,554.2],[200.4,555.5],[201.3,556.7],[203.2,557.2],[207.2,560.7],[208.0,561.7],[209.2,562.6],[211.3,564.7],[213.2,566.5],[213.1,567.6],[214.5,567.4],[214.6,568.9],[215.8,569.0],[216.5,570.5],[217.5,570.1],[220.1,570.9],[221.5,570.7],[222.4,571.2],[223.5,571.8],[225.0,571.6],[225.7,572.3],[225.7,574.2],[226.3,575.5],[227.8,577.6],[227.3,580.8],[226.3,582.8],[225.6,582.2],[224.2,581.3],[223.3,580.0],[224.0,578.8],[223.0,580.0],[222.3,579.5],[219.4,579.1],[219.4,577.1],[218.5,578.1],[217.7,578.6],[217.5,576.6],[216.4,576.8],[215.0,575.4],[213.8,574.6],[214.3,573.4],[214.5,572.2],[214.4,570.6],[212.1,570.0],[210.7,568.8],[208.2,568.5],[207.3,565.4],[206.5,565.3],[206.2,564.0],[205.4,563.9],[203.9,562.5],[201.5,562.0],[198.9,560.3],[196.5,555.3],[196.5,556.6],[198.4,559.5],[199.3,561.5],[198.7,562.6],[197.7,561.5],[196.8,561.5],[195.8,562.2],[195.3,560.4],[194.2,559.1],[193.7,559.7],[190.8,558.8],[192.2,559.4],[193.6,560.4],[194.4,561.3],[195.3,562.3],[194.1,563.4],[193.2,563.2],[192.2,563.7],[191.0,563.4],[188.8,562.4],[187.1,561.3],[185.8,559.6],[183.6,559.2],[182.2,558.6],[180.1,558.0],[178.6,557.3],[178.9,556.5],[178.4,554.3],[178.7,553.3],[177.8,554.8],[176.0,556.3],[173.6,556.4],[171.4,555.8],[170.2,555.4],[169.1,555.0],[166.8,554.9],[165.5,555.1],[162.7,556.0],[161.7,556.5],[160.2,555.5],[158.5,555.3],[157.9,554.7],[156.4,553.8],[156.2,554.8],[154.0,553.7],[151.7,554.5],[150.9,556.0],[150.3,554.8],[151.2,554.1],[153.1,553.0],[151.9,552.8],[151.4,551.9],[150.6,551.9],[149.5,549.7],[148.1,550.7],[147.4,551.2],[145.9,551.1],[144.9,552.2],[144.6,550.5],[143.7,552.2],[144.7,552.6],[145.5,554.9],[145.3,556.2],[144.5,555.9],[145.1,556.7],[145.7,558.4],[144.7,558.9],[143.2,559.1],[141.4,558.9],[140.6,559.6],[140.0,558.9],[139.5,560.0],[138.9,561.1],[138.1,561.2],[137.0,562.8],[135.7,563.5],[134.1,565.3],[132.9,565.5],[131.7,566.0],[130.2,565.3],[130.5,563.9],[131.5,563.4],[132.3,562.9],[133.4,561.9],[132.0,562.2],[130.6,561.6],[131.1,559.1],[132.1,557.6],[132.5,556.2],[132.0,553.6],[133.3,553.0],[135.7,550.9],[136.4,551.6],[137.2,551.8],[138.3,550.9],[136.9,549.9],[136.4,549.1],[135.4,549.2],[134.7,548.9],[133.3,549.8],[132.8,551.0],[131.6,551.3],[130.5,552.6],[129.4,553.9],[128.6,555.4],[128.3,557.0],[127.0,558.1],[127.7,558.9],[127.1,560.1],[125.9,560.3],[125.8,561.9],[124.6,562.5],[123.7,563.0],[123.1,564.0],[121.6,564.5],[121.2,566.9],[123.0,567.0],[124.5,567.6],[124.3,569.7],[123.3,570.5],[122.4,570.5],[121.8,571.5],[121.4,573.7],[120.1,574.9],[118.6,575.3],[117.3,575.7],[116.4,576.6],[115.5,577.0],[114.7,578.8],[113.4,578.6],[112.7,579.4],[112.0,581.1],[111.1,583.2],[109.6,583.4],[108.4,584.3],[107.5,584.0],[106.1,585.9],[105.0,585.5],[104.0,587.0],[103.2,586.8],[102.4,587.8],[103.6,588.3],[102.1,590.7],[98.2,591.2],[97.0,593.3],[97.0,591.5],[95.3,591.6],[93.5,592.9],[92.8,593.9],[91.4,593.3],[89.6,594.5],[88.4,594.3],[88.3,592.2],[87.7,593.0],[85.7,596.3],[85.2,595.6],[83.8,596.2],[83.8,594.7],[82.8,594.8],[83.4,595.5],[82.9,596.6],[81.9,597.0],[81.4,595.7],[80.4,596.0],[81.1,596.8],[79.4,597.7],[80.4,598.1],[79.6,598.1],[78.3,599.0],[76.0,598.6],[74.8,599.1],[73.2,600.0],[72.3,599.6],[72.2,598.1],[73.2,597.8],[74.2,596.2],[75.2,596.3],[77.4,595.4],[79.0,595.6],[79.5,596.8],[80.0,596.1],[81.1,594.8],[82.1,595.0],[83.7,593.1],[85.4,591.4],[87.5,590.0],[89.9,589.5],[90.8,590.0],[91.7,589.6],[91.3,591.1],[91.8,591.7],[93.2,590.8],[94.2,591.7],[93.2,590.2],[94.1,587.8],[95.2,586.8],[96.7,585.8],[99.0,585.0],[100.6,583.7],[101.4,584.2],[101.8,583.1],[103.4,580.6],[105.1,579.5],[106.5,578.0],[107.8,571.0],[109.4,569.5],[109.3,568.1],[105.5,569.8],[104.3,569.5],[103.4,568.3],[102.6,567.8],[102.1,569.1],[102.7,570.8],[101.8,571.5],[101.2,571.2],[100.0,568.4],[99.2,567.0],[98.4,567.9],[97.4,567.2],[96.5,565.6],[94.2,566.9],[92.1,567.8],[90.2,569.1],[89.6,568.2],[90.4,567.3],[90.4,565.1],[90.2,562.6],[91.3,561.7],[90.7,559.7],[90.1,558.5],[89.8,556.7],[89.0,556.0],[88.6,557.3],[87.6,557.5],[85.9,558.2],[83.9,558.3],[82.8,558.1],[82.0,557.5],[81.4,555.7],[80.5,553.8],[79.5,553.3],[78.6,551.2],[79.6,550.5],[80.0,548.9],[79.4,549.2],[79.9,547.4],[79.2,546.5],[78.1,546.8],[78.3,545.5],[77.6,545.2],[77.3,544.2],[76.8,543.5],[77.8,542.3],[77.3,541.0],[78.5,541.1],[79.3,538.7],[82.1,536.0],[82.7,535.1],[84.2,531.9],[85.1,531.1],[86.5,530.9],[87.5,531.5],[88.8,533.0],[89.8,533.0],[91.3,531.9],[93.0,530.0],[93.7,529.9],[95.4,530.6],[96.9,530.3],[98.5,528.4],[98.1,525.8],[97.3,523.3],[97.0,522.1],[98.0,522.6],[99.0,521.8],[98.1,519.2],[97.1,520.3],[96.3,520.0],[95.4,520.6],[94.5,520.7],[93.1,521.7],[92.6,522.8],[92.0,523.2],[92.0,521.8],[91.4,521.4],[90.8,522.4],[89.6,520.9],[87.2,520.6],[85.4,521.2],[84.7,521.2],[83.4,520.5],[80.9,519.4],[80.3,518.8],[80.6,517.0],[79.9,515.9],[80.9,514.6],[81.0,513.3],[80.0,513.1],[79.4,512.6],[78.0,512.1],[77.3,511.3],[76.3,510.4],[78.4,508.9],[81.0,507.6],[82.8,506.8],[83.6,507.6],[84.5,507.9],[84.3,506.8],[86.8,505.3],[89.4,504.8],[90.7,504.9],[91.4,505.3],[90.8,506.5],[90.4,508.1],[90.7,509.2],[91.6,509.1],[92.7,509.4],[94.0,509.4],[95.2,510.0],[95.9,509.7],[96.8,510.3],[98.0,508.7],[98.6,508.7],[99.4,508.1],[98.2,507.5],[96.9,507.7],[97.2,506.5],[96.4,505.0],[95.4,504.4],[95.3,503.1],[96.1,502.9],[97.0,504.3],[97.1,506.1],[98.1,507.1],[98.4,506.2],[97.4,504.8],[98.1,502.7],[96.5,502.5],[95.3,502.3],[94.5,502.2],[92.1,500.9],[91.7,497.6],[91.2,496.7],[90.4,495.8],[88.7,493.7],[88.0,492.8],[87.1,492.5],[86.0,491.0],[84.9,490.0],[85.9,489.5],[86.6,488.4],[87.0,486.1],[89.5,486.7],[92.7,486.7],[93.5,486.4],[94.9,485.4],[96.4,483.7],[96.9,481.9],[97.6,480.4],[98.8,479.2],[99.3,478.3],[100.8,476.9],[101.9,477.6],[103.5,477.0],[104.6,476.2],[107.0,473.8],[107.9,473.7],[108.8,473.9],[109.7,474.1],[111.3,473.8],[113.0,472.8],[114.7,470.5],[115.4,470.0],[117.9,471.5],[117.2,473.0],[116.8,474.2],[118.0,473.9],[118.7,472.7],[119.3,471.7],[120.5,472.9],[121.1,474.1],[121.5,474.7],[122.2,473.8],[123.4,473.7],[124.0,473.4],[125.8,473.7],[126.6,474.0],[126.3,475.8],[127.9,476.3],[129.6,477.5],[130.7,476.5],[131.8,476.5],[132.5,476.9],[133.1,476.3],[134.2,476.1],[135.0,476.3],[136.1,476.9],[137.3,477.6],[138.4,477.4],[138.9,477.9]],[[122.2,579.0],[123.4,578.0],[122.3,577.7],[123.2,576.2],[123.8,576.6],[124.3,575.6],[125.1,576.2],[125.9,575.8],[127.4,575.3],[128.4,576.1],[128.5,578.4],[129.8,578.2],[129.0,579.8],[127.3,579.2],[128.0,580.2],[127.5,581.0],[126.7,580.6],[126.7,582.2],[125.4,582.7],[124.2,582.7],[123.3,584.4],[122.0,585.3],[121.7,583.5],[120.7,584.5],[119.8,583.3],[119.7,581.7],[118.9,581.1],[119.4,579.2],[121.1,578.0],[122.1,578.1],[122.2,579.0]],[[209.9,574.8],[211.7,574.5],[212.7,575.8],[215.0,576.8],[216.0,577.6],[216.8,578.4],[218.3,580.2],[219.1,580.7],[220.7,584.2],[219.3,585.3],[218.5,583.9],[216.9,583.4],[215.9,583.7],[217.0,584.3],[217.9,586.1],[217.0,586.2],[215.1,584.7],[214.4,583.8],[213.2,583.2],[213.7,582.1],[214.2,581.1],[213.5,580.0],[212.5,580.0],[211.7,578.1],[211.1,577.2],[210.7,578.1],[210.1,577.0],[210.6,576.3],[209.7,575.2],[209.9,574.8]]],"inset":"ak"},"AZ":{"name":"Arizona","rings":[[[308.3,289.3],[293.0,399.5],[259.8,394.6],[241.8,384.2],[203.2,361.3],[205.6,357.3],[208.8,357.2],[210.1,355.6],[209.9,351.9],[207.7,351.4],[208.1,344.0],[211.9,341.9],[212.9,339.1],[213.2,334.5],[215.7,331.5],[218.5,330.7],[220.8,328.5],[218.3,325.2],[217.1,319.7],[215.2,316.0],[215.7,313.6],[217.1,311.1],[217.5,307.5],[217.0,303.5],[218.3,292.0],[224.1,292.4],[225.5,295.1],[227.0,295.3],[229.2,292.3],[232.2,276.7],[286.1,285.9],[308.3,289.3]]]},"AR":{"name":"Arkansas","rings":[[[532.4,312.7],[599.5,310.2],[601.0,313.9],[598.8,316.4],[596.6,320.2],[606.6,319.6],[606.4,323.3],[604.1,324.5],[603.8,327.5],[601.1,330.9],[601.6,335.6],[600.3,339.2],[598.8,339.8],[599.8,341.5],[597.4,343.1],[596.5,346.5],[594.9,347.5],[595.3,351.3],[592.5,352.6],[592.7,353.8],[589.5,357.2],[590.6,359.3],[587.9,362.6],[585.6,368.8],[588.6,371.2],[587.3,372.9],[588.3,376.9],[587.2,379.6],[547.6,380.8],[540.6,381.0],[540.4,370.6],[538.0,369.8],[534.9,370.8],[533.2,369.0],[533.5,334.4],[530.2,312.7],[532.4,312.7]]]},"CA":{"name":"California","rings":[[[122.5,148.9],[134.3,152.2],[152.8,157.7],[167.2,161.5],[158.8,194.4],[152.5,218.5],[167.1,240.4],[181.1,261.5],[192.5,278.6],[200.8,291.1],[215.7,313.6],[215.2,316.0],[217.1,319.7],[218.3,325.2],[220.8,328.5],[218.5,330.7],[215.7,331.5],[213.2,334.5],[212.9,339.1],[211.9,341.9],[208.1,344.0],[207.7,351.4],[209.9,351.9],[210.1,355.6],[208.8,357.2],[205.6,357.3],[184.0,354.7],[166.4,352.6],[165.1,349.6],[165.9,345.6],[165.8,340.6],[164.3,336.8],[160.4,331.0],[155.2,325.3],[153.7,326.1],[151.5,324.8],[152.3,323.0],[150.5,318.5],[146.6,318.4],[140.8,314.0],[140.5,311.5],[136.8,307.6],[131.9,306.4],[128.2,304.1],[122.9,303.3],[120.8,300.1],[122.8,294.9],[122.1,293.9],[123.7,290.3],[120.5,286.4],[121.3,282.5],[119.9,281.9],[118.3,277.9],[116.7,276.7],[116.6,274.4],[112.9,265.0],[110.9,262.0],[112.0,255.7],[113.0,256.6],[115.1,253.2],[113.9,249.3],[111.2,249.0],[108.6,245.0],[108.1,242.3],[109.0,240.1],[108.1,236.6],[109.5,231.6],[112.3,232.4],[113.1,225.1],[111.7,225.5],[110.5,228.9],[107.4,228.8],[104.7,225.2],[105.5,220.6],[104.3,216.4],[102.0,213.3],[101.1,210.4],[98.3,204.3],[99.4,203.0],[99.4,196.2],[101.3,192.9],[101.6,187.3],[99.5,181.0],[96.9,177.0],[97.2,173.4],[103.3,166.3],[104.8,163.7],[104.8,161.3],[107.8,156.1],[108.2,150.6],[107.1,148.9],[109.0,145.0],[122.5,148.9]]]},"CO":{"name":"Colorado","rings":[[[335.4,213.4],[367.1,217.2],[391.4,219.3],[420.5,221.5],[419.3,241.2],[415.7,300.2],[400.9,299.1],[380.4,297.5],[341.6,293.6],[333.1,292.5],[308.3,289.3],[311.5,266.6],[311.5,264.4],[313.9,247.9],[319.0,211.4],[335.4,213.4]]]},"CT":{"name":"Connecticut","rings":[[[835.4,164.4],[852.9,160.2],[855.9,171.8],[855.5,173.8],[854.2,173.8],[848.4,176.8],[841.0,178.3],[838.5,181.7],[835.3,183.3],[831.8,186.5],[830.2,184.5],[833.2,181.6],[831.8,180.3],[829.3,165.6],[835.4,164.4]]]},"DE":{"name":"Delaware","rings":[[[811.8,214.9],[810.9,217.6],[809.7,219.2],[810.7,222.1],[813.4,224.5],[815.0,229.1],[819.3,233.4],[820.8,233.3],[822.9,239.7],[813.3,241.6],[806.7,217.7],[808.7,215.1],[811.8,214.9]]]},"FL":{"name":"Florida","rings":[[[683.3,411.2],[691.5,410.2],[694.4,415.6],[717.3,414.0],[738.7,412.5],[740.1,416.5],[742.1,416.1],[742.3,412.1],[741.1,408.6],[742.4,406.9],[746.5,407.9],[751.1,408.0],[753.4,416.2],[757.0,425.2],[763.8,436.8],[773.4,448.7],[772.4,449.9],[773.8,455.9],[778.1,462.2],[785.4,475.1],[787.1,479.2],[787.8,483.6],[788.5,499.7],[787.0,500.3],[786.1,505.5],[786.9,506.9],[784.1,511.0],[782.6,510.4],[779.6,512.4],[774.1,514.1],[772.2,512.4],[772.5,509.4],[767.2,501.5],[763.9,500.4],[761.4,502.0],[758.6,497.6],[757.4,493.8],[753.2,490.1],[751.9,487.4],[751.9,483.2],[749.8,482.7],[750.6,485.1],[748.9,486.0],[741.9,476.4],[739.3,474.1],[743.4,465.6],[740.1,466.5],[738.2,469.3],[735.4,465.8],[736.9,454.9],[736.2,446.0],[733.9,444.2],[732.9,441.4],[729.5,441.2],[725.1,437.1],[721.8,435.6],[721.3,432.8],[719.0,432.0],[716.8,429.1],[709.9,425.6],[704.4,427.3],[705.1,430.2],[703.2,429.9],[696.6,434.4],[689.3,436.1],[689.2,433.9],[687.2,431.6],[677.8,426.8],[671.3,425.0],[665.7,424.9],[661.1,425.8],[651.1,428.6],[653.3,425.5],[651.9,424.0],[652.2,420.7],[648.2,417.3],[648.5,414.7],[683.3,411.2]]]},"GA":{"name":"Georgia","rings":[[[712.2,328.6],[709.4,333.2],[709.4,335.3],[715.2,338.7],[716.8,338.1],[719.9,342.1],[720.7,344.2],[723.8,347.9],[727.8,349.8],[730.4,353.2],[735.2,355.8],[735.3,358.1],[738.7,361.3],[743.4,363.6],[745.0,366.6],[745.8,370.7],[748.2,371.8],[751.6,376.6],[752.2,379.8],[756.2,380.9],[753.3,388.1],[753.1,391.6],[751.8,394.9],[752.1,398.0],[750.5,399.6],[751.1,408.0],[746.5,407.9],[742.4,406.9],[741.1,408.6],[742.3,412.1],[742.1,416.1],[740.1,416.5],[738.7,412.5],[717.3,414.0],[694.4,415.6],[691.5,410.2],[689.0,405.1],[689.6,399.9],[687.3,394.2],[688.4,390.7],[688.0,388.3],[690.5,385.5],[688.5,384.5],[689.0,382.5],[686.8,379.7],[684.4,374.4],[677.6,350.2],[673.0,333.7],[693.2,331.3],[704.2,330.0],[712.2,328.6]]]},"HI":{"name":"Hawaii","rings":[[[387.9,600.0],[382.2,597.9],[382.0,590.3],[378.0,580.9],[381.1,577.9],[383.4,573.6],[382.2,567.8],[388.6,571.3],[395.9,573.8],[400.3,577.5],[407.0,585.8],[402.9,590.1],[395.7,592.2],[390.7,595.4],[387.9,600.0]],[[365.8,549.4],[368.4,552.7],[371.8,551.2],[379.2,555.1],[370.6,560.3],[368.7,555.4],[364.8,554.4],[365.8,549.4]],[[299.9,520.0],[303.7,522.8],[300.3,528.6],[293.0,525.8],[294.0,521.8],[299.9,520.0]]],"inset":"hi"},"ID":{"name":"Idaho","rings":[[[251.1,41.2],[247.0,60.5],[250.0,66.7],[249.0,71.9],[251.0,74.7],[253.5,76.0],[253.5,77.5],[257.3,83.5],[257.5,85.7],[260.6,88.4],[260.5,89.7],[264.3,90.3],[261.0,97.1],[259.8,101.5],[260.6,104.7],[257.8,106.3],[258.3,108.5],[257.2,110.5],[259.7,113.0],[263.5,111.0],[265.3,109.2],[267.3,111.5],[266.6,113.0],[267.3,117.0],[268.8,121.3],[270.1,122.9],[269.4,126.6],[270.6,128.5],[273.4,129.2],[274.1,135.7],[275.5,137.1],[277.2,135.5],[281.5,136.4],[284.9,135.2],[286.6,136.5],[290.0,136.2],[290.5,137.4],[293.4,137.1],[297.2,133.6],[298.8,137.4],[300.9,139.8],[293.3,187.6],[277.4,185.1],[250.8,180.3],[208.8,171.4],[216.7,136.4],[219.9,130.6],[219.1,128.7],[216.6,127.8],[216.2,125.0],[220.5,118.9],[222.0,118.5],[224.1,116.0],[224.2,114.2],[226.3,112.3],[227.8,109.1],[231.9,104.1],[231.3,101.2],[228.5,99.2],[227.4,95.6],[228.1,92.2],[227.1,88.5],[227.7,87.0],[233.3,61.7],[238.7,38.4],[251.1,41.2]]]},"IL":{"name":"Illinois","rings":[[[585.2,192.6],[611.6,191.2],[625.7,190.0],[625.5,193.8],[628.1,198.0],[631.0,205.0],[635.1,251.2],[633.7,254.9],[636.0,258.9],[636.5,262.3],[634.9,265.3],[634.6,267.9],[632.3,272.3],[630.6,272.8],[631.2,275.2],[630.1,276.3],[629.6,281.0],[630.2,282.2],[628.4,285.2],[630.1,288.5],[624.0,290.9],[623.6,292.9],[625.2,295.4],[623.4,297.2],[617.5,294.6],[615.8,294.9],[613.7,298.6],[614.5,299.6],[612.1,299.5],[608.2,294.2],[609.4,292.8],[607.9,289.1],[607.7,286.1],[602.5,282.2],[600.9,282.8],[599.0,280.3],[594.3,276.6],[594.2,273.5],[596.5,268.3],[595.9,266.5],[597.3,264.0],[595.0,262.7],[591.7,262.1],[590.1,264.0],[588.9,262.9],[587.5,256.5],[582.3,252.6],[577.5,247.7],[575.4,241.8],[575.0,237.8],[576.2,235.0],[576.2,231.4],[580.2,229.0],[580.5,226.0],[582.3,224.0],[582.3,220.5],[579.8,217.9],[580.6,214.4],[586.2,213.1],[590.5,210.4],[590.8,207.3],[592.6,205.9],[593.0,202.1],[592.4,199.7],[589.1,198.0],[588.6,195.9],[585.2,192.6]]]},"IN":{"name":"Indiana","rings":[[[652.9,201.9],[669.9,200.0],[670.1,201.2],[672.9,224.5],[675.9,251.8],[674.8,252.8],[676.7,258.0],[674.1,258.5],[671.5,260.6],[667.6,260.2],[668.2,264.0],[665.8,265.9],[665.1,268.5],[662.5,269.7],[661.7,274.8],[660.0,276.3],[656.5,274.8],[655.7,272.6],[652.6,275.4],[653.1,277.5],[649.7,278.6],[648.5,276.8],[644.9,279.1],[643.9,281.2],[639.8,278.7],[637.8,279.5],[636.4,278.2],[635.3,279.7],[631.5,280.3],[630.2,282.2],[629.6,281.0],[630.1,276.3],[631.2,275.2],[630.6,272.8],[632.3,272.3],[634.6,267.9],[634.9,265.3],[636.5,262.3],[636.0,258.9],[633.7,254.9],[635.1,251.2],[631.0,205.0],[632.5,206.1],[636.9,205.7],[641.0,203.1],[652.9,201.9]]]},"IA":{"name":"Iowa","rings":[[[573.9,173.7],[576.1,173.6],[576.4,176.5],[578.5,178.3],[577.0,180.8],[577.7,185.1],[578.9,188.2],[584.1,190.2],[585.2,192.6],[588.6,195.9],[589.1,198.0],[592.4,199.7],[593.0,202.1],[592.6,205.9],[590.8,207.3],[590.5,210.4],[586.2,213.1],[580.6,214.4],[579.8,217.9],[582.3,220.5],[582.3,224.0],[580.5,226.0],[580.2,229.0],[576.2,231.4],[576.2,235.0],[574.5,234.4],[571.4,230.5],[569.8,230.7],[549.0,232.0],[528.8,232.7],[512.2,232.5],[510.5,229.9],[511.3,224.8],[509.8,220.4],[509.9,215.5],[507.4,213.8],[507.0,211.1],[507.9,208.7],[506.9,205.3],[505.0,204.0],[502.4,195.2],[499.8,190.8],[501.0,188.0],[501.5,184.1],[502.6,182.7],[500.8,180.8],[501.3,177.3],[500.6,175.7],[502.4,175.3],[573.9,173.7]]]},"KS":{"name":"Kansas","rings":[[[421.4,241.3],[519.0,244.0],[520.5,245.8],[525.3,247.3],[522.0,253.0],[523.9,254.9],[526.3,259.5],[529.6,260.5],[530.1,302.9],[445.8,301.7],[415.7,300.2],[419.3,241.2],[421.4,241.3]]]},"KY":{"name":"Kentucky","rings":[[[690.3,256.7],[694.0,258.9],[696.2,257.2],[702.0,258.0],[703.4,255.8],[705.5,254.9],[706.6,258.1],[708.4,258.4],[710.8,260.8],[711.2,266.7],[713.6,270.2],[716.4,272.7],[717.4,274.8],[720.7,276.7],[722.7,276.7],[717.6,282.8],[712.5,286.4],[712.7,287.9],[710.6,289.5],[710.7,291.3],[707.8,292.4],[707.1,294.7],[699.3,298.6],[685.9,300.4],[674.3,301.1],[671.3,301.6],[654.2,302.7],[634.8,304.9],[631.4,304.3],[631.9,307.8],[612.7,309.1],[610.8,309.5],[611.5,306.9],[613.8,307.6],[614.5,299.6],[613.7,298.6],[615.8,294.9],[617.5,294.6],[623.4,297.2],[625.2,295.4],[623.6,292.9],[624.0,290.9],[630.1,288.5],[628.4,285.2],[630.2,282.2],[631.5,280.3],[635.3,279.7],[636.4,278.2],[637.8,279.5],[639.8,278.7],[643.9,281.2],[644.9,279.1],[648.5,276.8],[649.7,278.6],[653.1,277.5],[652.6,275.4],[655.7,272.6],[656.5,274.8],[660.0,276.3],[661.7,274.8],[662.5,269.7],[665.1,268.5],[665.8,265.9],[668.2,264.0],[667.6,260.2],[671.5,260.6],[674.1,258.5],[676.7,258.0],[674.8,252.8],[675.9,251.8],[681.6,251.2],[685.1,254.8],[685.6,256.5],[690.3,256.7]]]},"LA":{"name":"Louisiana","rings":[[[547.6,380.8],[587.2,379.6],[588.9,381.8],[587.8,382.7],[587.8,386.7],[590.3,389.1],[591.0,394.8],[589.2,399.4],[585.5,402.4],[584.7,406.8],[583.1,406.5],[583.1,413.7],[581.2,414.0],[582.5,417.8],[581.4,419.2],[612.8,417.5],[611.6,424.0],[614.6,428.1],[615.5,431.2],[617.6,433.1],[612.8,436.1],[612.6,438.1],[616.7,439.1],[618.3,435.9],[622.0,438.7],[621.9,441.2],[619.9,442.4],[616.1,441.7],[616.7,443.5],[615.6,446.3],[619.0,448.6],[624.2,448.9],[626.3,451.7],[627.8,452.0],[625.3,455.5],[622.3,455.1],[619.6,451.8],[613.2,450.4],[613.0,447.1],[610.0,448.4],[610.4,451.2],[609.1,453.8],[606.9,454.4],[605.1,451.6],[601.2,451.7],[599.9,454.8],[597.4,455.8],[594.5,454.1],[592.2,454.0],[589.9,449.3],[585.9,447.4],[584.5,447.8],[582.8,443.8],[578.4,444.5],[578.2,442.1],[573.9,444.6],[574.6,446.4],[571.3,448.2],[566.1,447.6],[560.0,445.1],[555.7,444.1],[546.5,445.3],[545.3,446.0],[543.8,444.1],[547.6,437.1],[546.2,433.4],[547.4,431.3],[546.8,428.7],[548.4,426.6],[550.0,421.5],[549.6,417.4],[544.9,409.6],[544.7,405.3],[541.0,401.1],[540.6,381.0],[547.6,380.8]]]},"ME":{"name":"Maine","rings":[[[862.8,136.6],[860.8,135.7],[860.5,133.8],[857.7,132.2],[850.2,107.6],[846.2,95.6],[851.3,91.5],[850.0,90.4],[851.3,86.9],[853.2,85.0],[852.5,84.0],[854.1,81.6],[852.5,78.5],[852.4,73.2],[853.9,71.0],[853.3,65.6],[859.1,48.5],[861.6,48.4],[862.7,51.8],[864.8,52.6],[868.3,49.3],[870.9,48.6],[872.3,46.7],[876.7,48.6],[879.6,50.4],[886.1,71.2],[887.3,76.3],[892.2,76.2],[892.3,78.5],[894.0,80.2],[893.7,82.4],[896.4,84.6],[898.7,83.3],[903.1,89.1],[901.3,93.0],[899.4,92.3],[898.7,94.8],[896.7,94.9],[897.0,96.7],[894.4,97.2],[891.7,102.4],[890.0,99.9],[888.5,100.1],[890.1,102.9],[887.4,105.3],[886.0,103.1],[884.9,104.8],[881.5,105.8],[880.6,103.1],[878.7,104.3],[879.7,106.1],[878.9,110.8],[879.6,111.8],[877.8,114.8],[875.1,114.7],[874.3,117.5],[872.3,118.4],[871.1,120.8],[869.0,121.0],[867.8,119.1],[865.7,123.2],[867.1,125.1],[865.0,126.4],[865.4,128.2],[863.5,131.1],[862.8,136.6]]]},"MD":{"name":"Maryland","rings":[[[752.9,228.2],[806.7,217.7],[813.3,241.6],[822.9,239.7],[821.8,248.5],[819.6,249.3],[815.8,251.4],[812.8,252.9],[812.2,249.7],[810.7,248.7],[812.1,247.0],[809.1,244.3],[808.7,245.8],[805.5,246.2],[803.8,242.9],[804.7,242.7],[803.9,238.1],[804.4,236.1],[801.9,230.3],[802.7,226.4],[805.1,225.2],[804.7,221.4],[802.9,222.3],[803.3,224.2],[799.9,227.4],[799.3,229.9],[800.2,235.5],[799.3,238.4],[800.9,242.7],[803.4,245.4],[803.7,247.8],[805.4,249.8],[805.1,251.5],[801.0,249.2],[795.8,248.7],[793.8,246.1],[791.3,248.3],[789.8,246.2],[791.4,242.8],[792.1,239.5],[793.6,237.1],[791.4,235.5],[790.4,237.0],[788.1,235.5],[784.9,235.2],[784.3,232.3],[782.4,231.1],[780.1,231.2],[777.3,226.1],[774.9,226.6],[772.0,225.3],[771.0,227.0],[768.5,227.4],[768.4,229.6],[763.8,229.0],[761.4,232.4],[759.4,232.1],[757.1,235.9],[754.5,238.2],[752.9,228.2]],[[811.0,252.4],[810.6,252.5],[810.2,252.6],[811.0,252.4]]]},"MA":{"name":"Massachusetts","rings":[[[860.7,140.6],[862.2,140.6],[863.6,143.7],[863.7,146.6],[862.2,149.7],[862.9,152.6],[866.1,152.2],[868.7,154.7],[869.1,157.2],[870.7,157.4],[871.5,159.5],[875.9,160.3],[879.9,157.3],[879.6,160.2],[873.6,164.3],[871.2,165.1],[869.3,163.7],[867.1,164.8],[867.4,166.2],[865.0,167.7],[863.0,164.6],[862.5,164.1],[860.7,163.1],[858.7,158.8],[856.7,159.4],[853.0,160.6],[835.4,164.4],[829.3,165.6],[828.8,165.0],[829.1,151.6],[840.4,149.2],[856.5,145.6],[857.6,143.5],[860.7,140.6]]]},"MI":{"name":"Michigan","rings":[[[689.3,198.1],[670.1,201.2],[669.9,200.0],[652.9,201.9],[641.0,203.1],[643.6,200.2],[645.2,195.6],[646.7,192.8],[647.6,188.9],[647.9,183.5],[647.0,177.8],[641.7,166.9],[642.5,162.5],[641.1,157.4],[643.8,151.9],[644.0,147.5],[643.3,145.2],[645.4,144.0],[645.4,140.8],[648.9,139.5],[651.2,135.7],[651.7,142.8],[653.2,142.9],[654.6,139.2],[654.0,133.3],[654.9,131.7],[658.6,130.3],[656.9,126.3],[658.9,122.5],[661.9,121.9],[665.6,123.7],[669.0,123.6],[671.0,126.2],[673.5,126.1],[678.1,128.1],[679.6,127.8],[682.4,131.6],[680.8,134.1],[683.0,136.7],[684.1,139.9],[684.3,147.2],[681.7,149.4],[681.5,153.2],[678.4,154.9],[677.1,159.6],[678.0,161.2],[681.6,162.4],[683.8,159.6],[686.2,154.2],[690.7,151.6],[693.3,152.8],[695.1,155.3],[697.7,163.2],[698.5,167.2],[700.7,171.9],[700.3,179.1],[698.1,180.5],[697.7,177.9],[696.2,178.9],[695.3,185.0],[692.7,187.6],[692.5,192.2],[689.4,196.4],[689.3,198.1]],[[624.2,139.0],[621.9,137.2],[623.0,134.3],[619.7,134.2],[620.7,131.4],[620.6,128.0],[617.6,125.9],[615.8,123.6],[609.9,122.1],[608.2,122.9],[602.2,120.5],[588.0,117.5],[586.3,114.3],[583.8,113.3],[588.9,110.9],[591.1,108.4],[596.9,107.1],[600.5,104.0],[602.2,103.7],[603.5,101.6],[607.4,98.4],[609.3,95.8],[612.3,94.0],[615.4,95.1],[610.7,101.5],[609.6,103.6],[610.0,107.2],[612.3,104.2],[616.9,104.3],[620.7,105.9],[624.4,110.9],[626.2,111.7],[629.5,110.5],[630.4,111.6],[633.9,111.9],[640.6,106.7],[644.3,105.9],[649.3,105.6],[652.5,103.7],[655.0,103.3],[656.1,108.7],[658.9,109.1],[661.4,107.9],[662.6,109.1],[664.2,107.3],[668.0,106.3],[668.9,113.0],[671.1,115.6],[673.8,116.0],[673.9,114.1],[676.4,113.8],[678.1,115.6],[677.1,117.2],[669.6,116.9],[666.1,118.2],[662.0,116.3],[661.2,118.6],[661.9,120.3],[660.2,120.1],[657.3,117.7],[652.8,116.6],[650.6,116.8],[648.7,119.6],[645.2,120.6],[641.3,120.5],[639.9,121.7],[639.7,123.8],[635.7,126.1],[635.7,123.5],[633.8,123.1],[633.3,125.9],[630.2,126.3],[628.9,127.6],[627.2,132.3],[623.9,138.5],[624.2,139.0]],[[603.3,84.6],[600.2,87.3],[598.5,87.7],[598.5,85.7],[606.4,80.6],[605.1,83.8],[603.3,84.6]]]},"MN":{"name":"Minnesota","rings":[[[562.2,111.7],[561.1,110.9],[558.5,112.6],[558.9,124.1],[558.2,125.3],[554.4,127.0],[551.4,131.3],[551.2,134.1],[552.8,134.2],[554.6,136.6],[553.2,139.7],[553.6,143.0],[552.8,150.2],[556.6,153.6],[559.5,153.8],[561.0,155.8],[565.4,157.8],[566.2,160.3],[570.3,163.5],[572.5,164.1],[575.4,168.3],[575.2,171.4],[576.1,173.6],[573.9,173.7],[502.4,175.3],[502.6,140.2],[499.4,137.9],[497.1,134.2],[500.8,130.0],[501.2,127.8],[500.7,120.0],[499.1,118.0],[498.0,113.7],[498.3,108.5],[497.8,107.7],[497.4,95.2],[494.9,88.6],[493.9,84.9],[493.6,77.1],[494.5,74.5],[492.9,68.3],[519.7,68.4],[519.7,61.0],[522.2,61.2],[523.9,62.7],[525.7,72.6],[527.1,73.8],[531.4,74.0],[531.9,75.0],[536.9,75.3],[537.5,77.4],[541.8,76.8],[545.1,74.8],[548.0,75.1],[551.4,76.6],[552.4,78.5],[554.4,78.3],[556.3,82.5],[557.1,80.7],[560.4,79.7],[561.0,81.5],[564.9,82.6],[565.0,84.3],[567.0,85.6],[570.9,84.6],[573.2,82.6],[576.4,81.3],[577.7,84.1],[579.9,83.3],[582.6,83.8],[585.6,83.2],[589.3,85.4],[592.6,84.7],[592.4,85.8],[588.2,88.5],[582.2,90.8],[578.3,93.0],[572.8,98.3],[570.5,101.5],[566.9,105.2],[561.1,110.1],[562.2,111.7]]]},"MS":{"name":"Mississippi","rings":[[[627.8,337.8],[632.1,337.4],[633.9,339.3],[633.4,361.0],[632.6,398.4],[636.3,428.1],[634.5,429.1],[630.4,429.0],[628.7,427.8],[624.7,429.0],[619.3,431.6],[617.6,433.1],[615.5,431.2],[614.6,428.1],[611.6,424.0],[612.8,417.5],[581.4,419.2],[582.5,417.8],[581.2,414.0],[583.1,413.7],[583.1,406.5],[584.7,406.8],[585.5,402.4],[589.2,399.4],[591.0,394.8],[590.3,389.1],[587.8,386.7],[587.8,382.7],[588.9,381.8],[587.2,379.6],[588.3,376.9],[587.3,372.9],[588.6,371.2],[585.6,368.8],[587.9,362.6],[590.6,359.3],[589.5,357.2],[592.7,353.8],[592.5,352.6],[595.3,351.3],[594.9,347.5],[596.5,346.5],[597.4,343.1],[599.8,341.5],[598.8,339.8],[627.8,337.8]]]},"MO":{"name":"Missouri","rings":[[[569.8,230.7],[571.4,230.5],[574.5,234.4],[576.2,235.0],[575.0,237.8],[575.4,241.8],[577.5,247.7],[582.3,252.6],[587.5,256.5],[588.9,262.9],[590.1,264.0],[591.7,262.1],[595.0,262.7],[597.3,264.0],[595.9,266.5],[596.5,268.3],[594.2,273.5],[594.3,276.6],[599.0,280.3],[600.9,282.8],[602.5,282.2],[607.7,286.1],[607.9,289.1],[609.4,292.8],[608.2,294.2],[612.1,299.5],[614.5,299.6],[613.8,307.6],[611.5,306.9],[610.8,309.5],[609.8,309.5],[609.0,309.6],[609.4,314.4],[606.6,319.6],[596.6,320.2],[598.8,316.4],[601.0,313.9],[599.5,310.2],[532.4,312.7],[530.2,312.7],[530.1,302.9],[529.6,260.5],[526.3,259.5],[523.9,254.9],[522.0,253.0],[525.3,247.3],[520.5,245.8],[519.0,244.0],[515.4,238.8],[512.2,232.5],[528.8,232.7],[549.0,232.0],[569.8,230.7]]]},"MT":{"name":"Montana","rings":[[[404.7,64.0],[402.9,85.9],[399.7,123.0],[398.2,141.4],[372.6,138.9],[329.3,133.6],[302.5,129.6],[300.9,139.8],[298.8,137.4],[297.2,133.6],[293.4,137.1],[290.5,137.4],[290.0,136.2],[286.6,136.5],[284.9,135.2],[281.5,136.4],[277.2,135.5],[275.5,137.1],[274.1,135.7],[273.4,129.2],[270.6,128.5],[269.4,126.6],[270.1,122.9],[268.8,121.3],[267.3,117.0],[266.6,113.0],[267.3,111.5],[265.3,109.2],[263.5,111.0],[259.7,113.0],[257.2,110.5],[258.3,108.5],[257.8,106.3],[260.6,104.7],[259.8,101.5],[261.0,97.1],[264.3,90.3],[260.5,89.7],[260.6,88.4],[257.5,85.7],[257.3,83.5],[253.5,77.5],[253.5,76.0],[251.0,74.7],[249.0,71.9],[250.0,66.7],[247.0,60.5],[251.1,41.2],[308.9,52.2],[335.2,56.1],[404.7,64.0]]]},"NE":{"name":"Nebraska","rings":[[[405.0,181.1],[429.0,182.8],[473.3,184.7],[473.8,185.7],[481.0,189.4],[482.8,187.5],[484.8,188.0],[491.5,188.1],[498.9,191.8],[499.8,194.6],[502.4,195.2],[505.0,204.0],[506.9,205.3],[507.9,208.7],[507.0,211.1],[507.4,213.8],[509.9,215.5],[509.8,220.4],[511.3,224.8],[510.5,229.9],[512.2,232.5],[515.4,238.8],[519.0,244.0],[421.4,241.3],[419.3,241.2],[420.5,221.5],[391.4,219.3],[394.8,180.2],[405.0,181.1]]]},"NV":{"name":"Nevada","rings":[[[208.8,171.4],[250.8,180.3],[232.2,276.7],[229.2,292.3],[227.0,295.3],[225.5,295.1],[224.1,292.4],[218.3,292.0],[217.0,303.5],[217.5,307.5],[217.1,311.1],[215.7,313.6],[200.8,291.1],[192.5,278.6],[181.1,261.5],[167.1,240.4],[152.5,218.5],[158.8,194.4],[167.2,161.5],[185.4,166.1],[208.8,171.4]]]},"NH":{"name":"New Hampshire","rings":[[[846.2,95.6],[850.2,107.6],[857.7,132.2],[860.5,133.8],[860.8,135.7],[862.8,136.6],[862.2,140.6],[860.7,140.6],[857.6,143.5],[856.5,145.6],[840.4,149.2],[838.8,148.0],[838.2,145.2],[839.2,143.8],[838.3,141.1],[837.4,132.9],[838.8,128.5],[838.9,124.0],[839.7,122.1],[838.4,117.5],[842.4,114.5],[843.8,110.7],[841.7,108.0],[842.7,104.4],[842.1,102.6],[842.7,97.2],[845.9,96.9],[846.2,95.6]]]},"NJ":{"name":"New Jersey","rings":[[[822.8,185.5],[828.2,187.1],[827.8,193.1],[825.8,194.9],[825.2,198.1],[829.5,198.7],[830.3,200.8],[831.0,211.5],[828.2,220.2],[825.8,223.1],[824.2,228.5],[822.2,225.7],[817.6,225.0],[811.5,222.0],[810.5,219.2],[810.9,217.6],[811.8,214.9],[815.3,212.5],[815.2,211.0],[818.9,206.8],[819.2,205.0],[814.3,202.0],[813.6,199.7],[811.6,199.4],[811.0,197.3],[812.4,193.4],[810.8,191.7],[813.5,186.9],[813.8,184.6],[815.3,182.8],[822.8,185.5]]]},"NM":{"name":"New Mexico","rings":[[[333.1,292.5],[341.6,293.6],[380.4,297.5],[400.9,299.1],[400.2,308.9],[395.9,357.6],[394.1,377.4],[392.6,397.0],[334.5,391.5],[333.8,393.4],[335.5,395.9],[307.9,392.6],[306.8,401.4],[293.0,399.5],[308.3,289.3],[333.1,292.5]]]},"NY":{"name":"New York","rings":[[[817.6,108.8],[818.7,112.7],[818.8,116.4],[820.9,119.5],[821.4,123.3],[820.8,127.5],[823.2,132.4],[822.9,134.2],[825.8,136.7],[828.5,150.0],[829.1,151.6],[828.8,165.0],[829.3,165.6],[831.8,180.3],[833.2,181.6],[830.2,184.5],[831.8,186.5],[838.2,186.6],[839.2,185.1],[844.4,183.9],[846.8,182.6],[850.4,178.4],[851.3,180.6],[853.8,180.9],[849.3,185.1],[839.3,192.0],[834.9,193.9],[831.8,194.4],[829.8,195.9],[827.8,193.1],[828.2,187.1],[822.8,185.5],[815.3,182.8],[814.4,181.6],[812.2,182.0],[808.9,179.3],[808.6,176.4],[806.4,174.6],[805.4,174.9],[803.3,172.6],[741.1,184.8],[740.3,180.0],[747.9,172.6],[748.8,169.7],[751.2,167.4],[749.6,164.4],[748.3,163.9],[746.5,158.8],[754.2,155.1],[761.5,153.8],[764.5,153.8],[768.0,155.3],[769.8,154.1],[775.8,153.0],[779.2,150.9],[782.3,146.6],[784.7,146.0],[783.7,140.7],[784.3,137.4],[780.8,136.0],[781.0,133.4],[785.8,129.0],[787.2,125.7],[792.3,117.9],[797.7,113.3],[806.9,111.8],[817.6,108.8]]]},"NC":{"name":"North Carolina","rings":[[[740.7,293.3],[751.2,291.9],[763.2,290.0],[818.6,279.0],[822.0,286.3],[817.6,286.5],[817.2,287.5],[812.3,289.8],[811.8,291.0],[808.4,292.0],[808.8,293.4],[812.8,291.5],[813.6,292.3],[818.0,290.3],[819.9,291.8],[822.5,290.5],[824.5,294.9],[824.1,297.3],[822.3,297.9],[819.4,303.5],[814.3,304.8],[814.1,308.2],[817.0,311.0],[818.9,311.3],[816.7,317.3],[813.8,317.3],[808.9,318.8],[805.8,320.7],[801.1,325.5],[797.8,331.1],[796.7,337.7],[793.2,337.0],[787.7,339.3],[766.6,324.1],[748.9,326.7],[748.8,324.4],[745.9,321.5],[744.5,322.9],[744.1,320.9],[724.7,322.9],[720.5,324.3],[717.4,326.5],[712.2,328.6],[704.2,330.0],[693.2,331.3],[693.1,326.6],[696.1,325.8],[696.9,322.4],[700.4,319.1],[704.6,318.4],[708.1,314.9],[711.9,313.3],[714.7,308.4],[716.6,306.9],[717.3,308.7],[722.9,304.1],[725.8,304.4],[727.2,300.5],[729.9,299.1],[729.9,294.5],[740.7,293.3]]]},"ND":{"name":"North Dakota","rings":[[[492.9,68.3],[494.5,74.5],[493.6,77.1],[493.9,84.9],[494.9,88.6],[497.4,95.2],[497.8,107.7],[498.3,108.5],[498.0,113.7],[499.1,118.0],[500.7,120.0],[501.2,127.8],[399.7,123.0],[402.9,85.9],[404.7,64.0],[492.9,68.3]]]},"OH":{"name":"Ohio","rings":[[[730.5,187.1],[734.7,213.1],[732.8,214.5],[734.2,216.4],[734.6,219.4],[733.3,224.4],[733.1,231.8],[728.4,239.0],[726.7,240.1],[724.9,239.1],[723.6,242.1],[721.9,242.3],[720.6,246.3],[721.3,248.5],[720.0,250.5],[717.4,247.8],[715.3,252.9],[716.5,255.8],[714.9,257.1],[714.7,259.8],[710.8,260.8],[708.4,258.4],[706.6,258.1],[705.5,254.9],[703.4,255.8],[702.0,258.0],[696.2,257.2],[694.0,258.9],[690.3,256.7],[685.6,256.5],[685.1,254.8],[681.6,251.2],[675.9,251.8],[672.9,224.5],[670.1,201.2],[689.3,198.1],[695.3,200.0],[697.4,201.3],[698.6,199.6],[702.2,202.3],[704.3,203.0],[710.6,199.4],[714.6,199.4],[718.2,195.1],[723.9,190.6],[730.5,187.1],[730.5,187.1]]]},"OK":{"name":"Oklahoma","rings":[[[445.8,301.7],[530.1,302.9],[530.2,312.7],[533.5,334.4],[533.2,369.0],[527.0,366.9],[525.4,364.7],[521.2,362.8],[520.2,364.5],[516.0,364.4],[515.1,363.4],[511.4,365.3],[509.8,364.2],[506.4,365.2],[503.2,368.2],[501.9,366.5],[498.6,365.1],[495.1,365.0],[494.0,362.8],[489.9,367.1],[488.6,364.6],[486.7,365.4],[485.3,363.7],[481.6,362.2],[478.7,364.7],[477.5,362.0],[475.3,361.6],[474.0,359.4],[471.0,358.5],[468.9,360.3],[467.6,358.6],[464.5,358.7],[461.0,356.9],[457.8,357.0],[456.8,353.2],[451.7,352.8],[449.8,353.4],[446.3,349.5],[445.1,349.7],[446.7,311.6],[418.6,310.1],[400.2,308.9],[400.9,299.1],[415.7,300.2],[445.8,301.7]]]},"OR":{"name":"Oregon","rings":[[[145.8,70.8],[147.1,71.0],[149.3,73.7],[149.9,76.3],[148.9,82.2],[155.0,86.1],[161.6,84.8],[165.3,85.5],[169.2,87.6],[169.3,89.0],[177.2,88.2],[178.7,89.6],[182.7,90.1],[186.4,89.1],[192.6,88.9],[198.0,89.8],[200.1,89.0],[227.4,95.6],[228.5,99.2],[231.3,101.2],[231.9,104.1],[227.8,109.1],[226.3,112.3],[224.2,114.2],[224.1,116.0],[222.0,118.5],[220.5,118.9],[216.2,125.0],[216.6,127.8],[219.1,128.7],[219.9,130.6],[216.7,136.4],[208.8,171.4],[185.4,166.1],[167.2,161.5],[152.8,157.7],[134.3,152.2],[122.5,148.9],[109.0,145.0],[107.7,142.2],[108.5,135.8],[110.0,131.7],[109.2,127.8],[111.5,125.2],[114.0,120.4],[117.6,115.7],[119.9,111.3],[126.2,95.8],[126.7,93.6],[130.1,87.1],[133.5,77.6],[134.4,72.1],[136.0,69.1],[142.0,67.9],[143.6,70.7],[145.8,70.8]]]},"PA":{"name":"Pennsylvania","rings":[[[740.3,180.0],[741.1,184.8],[803.3,172.6],[805.4,174.9],[806.4,174.6],[808.6,176.4],[808.9,179.3],[812.2,182.0],[814.4,181.6],[815.3,182.8],[813.8,184.6],[813.5,186.9],[810.8,191.7],[812.4,193.4],[811.0,197.3],[811.6,199.4],[813.6,199.7],[814.3,202.0],[819.2,205.0],[818.9,206.8],[815.2,211.0],[815.3,212.5],[811.8,214.9],[808.7,215.1],[806.7,217.7],[752.9,228.2],[737.7,230.8],[734.7,213.1],[730.5,187.1],[732.9,185.6],[740.2,179.6],[740.3,180.0]]]},"RI":{"name":"Rhode Island","rings":[[[856.7,159.4],[858.7,158.8],[860.7,163.1],[862.5,164.1],[860.7,164.2],[860.0,167.4],[860.6,171.5],[855.5,173.8],[855.9,171.8],[853.0,160.6],[856.7,159.4]],[[863.0,164.6],[865.0,167.7],[862.4,168.9],[863.0,164.6]]]},"SC":{"name":"South Carolina","rings":[[[717.4,326.5],[720.5,324.3],[724.7,322.9],[744.1,320.9],[744.5,322.9],[745.9,321.5],[748.8,324.4],[748.9,326.7],[766.6,324.1],[787.7,339.3],[785.1,340.8],[782.2,344.6],[779.7,350.1],[779.8,354.3],[777.7,357.9],[774.1,358.6],[773.7,361.0],[770.4,364.2],[768.7,367.3],[765.6,369.1],[762.4,372.6],[762.3,374.1],[759.2,376.2],[756.2,380.9],[752.2,379.8],[751.6,376.6],[748.2,371.8],[745.8,370.7],[745.0,366.6],[743.4,363.6],[738.7,361.3],[735.3,358.1],[735.2,355.8],[730.4,353.2],[727.8,349.8],[723.8,347.9],[720.7,344.2],[719.9,342.1],[716.8,338.1],[715.2,338.7],[709.4,335.3],[709.4,333.2],[712.2,328.6],[717.4,326.5]]]},"SD":{"name":"South Dakota","rings":[[[399.7,123.0],[501.2,127.8],[500.8,130.0],[497.1,134.2],[499.4,137.9],[502.6,140.2],[502.4,175.3],[500.6,175.7],[501.3,177.3],[500.8,180.8],[502.6,182.7],[501.5,184.1],[501.0,188.0],[499.8,190.8],[502.4,195.2],[499.8,194.6],[498.9,191.8],[491.5,188.1],[484.8,188.0],[482.8,187.5],[481.0,189.4],[473.8,185.7],[473.3,184.7],[429.0,182.8],[405.0,181.1],[394.8,180.2],[398.0,141.4],[399.7,123.0]]]},"TN":{"name":"Tennessee","rings":[[[631.9,307.8],[631.4,304.3],[634.8,304.9],[654.2,302.7],[671.3,301.6],[674.3,301.1],[685.9,300.4],[699.1,298.9],[729.9,294.5],[729.9,299.1],[727.2,300.5],[725.8,304.4],[722.9,304.1],[717.3,308.7],[716.6,306.9],[714.7,308.4],[711.9,313.3],[708.1,314.9],[704.6,318.4],[700.4,319.1],[696.9,322.4],[696.1,325.8],[693.1,326.6],[693.2,331.3],[673.0,333.7],[645.3,336.2],[632.1,337.4],[627.8,337.8],[598.8,339.8],[600.3,339.2],[601.6,335.6],[601.1,330.9],[603.8,327.5],[604.1,324.5],[606.4,323.3],[606.6,319.6],[609.4,314.4],[609.0,309.6],[609.8,309.5],[610.8,309.5],[612.7,309.1],[631.9,307.8]]]},"TX":{"name":"Texas","rings":[[[418.6,310.1],[446.7,311.6],[445.1,349.7],[446.3,349.5],[449.8,353.4],[451.7,352.8],[456.8,353.2],[457.8,357.0],[461.0,356.9],[464.5,358.7],[467.6,358.6],[468.9,360.3],[471.0,358.5],[474.0,359.4],[475.3,361.6],[477.5,362.0],[478.7,364.7],[481.6,362.2],[485.3,363.7],[486.7,365.4],[488.6,364.6],[489.9,367.1],[494.0,362.8],[495.1,365.0],[498.6,365.1],[501.9,366.5],[503.2,368.2],[506.4,365.2],[509.8,364.2],[511.4,365.3],[515.1,363.4],[516.0,364.4],[520.2,364.5],[521.2,362.8],[525.4,364.7],[527.0,366.9],[533.2,369.0],[534.9,370.8],[538.0,369.8],[540.4,370.6],[540.6,381.0],[541.0,401.1],[544.7,405.3],[544.9,409.6],[549.6,417.4],[550.0,421.5],[548.4,426.6],[546.8,428.7],[547.4,431.3],[546.2,433.4],[547.6,437.1],[543.8,444.1],[545.3,446.0],[542.6,446.2],[533.8,449.0],[530.6,447.6],[530.0,444.4],[527.8,446.7],[526.2,446.1],[525.4,448.9],[527.2,450.1],[527.5,453.7],[524.4,457.6],[519.3,462.4],[509.0,467.6],[508.0,466.7],[504.9,468.0],[504.8,466.8],[500.6,467.7],[498.6,465.2],[497.4,465.7],[501.9,470.8],[498.6,472.3],[495.5,471.4],[495.0,474.9],[491.0,478.4],[487.0,485.1],[484.3,492.1],[482.4,491.5],[481.9,494.0],[483.9,493.4],[482.9,498.5],[481.5,498.7],[481.4,501.6],[483.0,503.2],[483.4,509.0],[485.3,511.1],[485.7,514.8],[487.2,518.1],[481.8,520.0],[479.6,517.4],[475.5,516.4],[469.9,516.5],[465.3,513.2],[461.7,512.8],[459.1,510.2],[455.5,509.2],[453.0,506.7],[451.6,500.8],[448.6,497.2],[449.0,494.2],[447.7,491.0],[448.3,488.3],[446.2,485.1],[444.5,484.7],[441.6,481.8],[440.8,478.3],[438.4,475.0],[434.8,472.2],[433.3,466.3],[431.7,464.6],[429.7,459.8],[429.1,455.9],[427.1,453.0],[423.6,450.4],[422.9,448.6],[419.6,447.0],[417.3,442.6],[409.9,441.2],[405.5,441.1],[401.8,439.4],[400.8,441.3],[396.7,441.7],[393.4,445.5],[391.1,451.9],[390.0,451.9],[387.4,455.6],[384.6,455.5],[380.7,452.2],[370.6,446.5],[368.7,443.8],[364.9,441.0],[362.5,435.2],[362.8,430.2],[360.3,425.9],[360.0,422.3],[358.4,419.9],[352.3,415.9],[349.3,411.1],[346.6,409.2],[344.0,405.1],[340.1,402.6],[337.8,397.2],[335.5,395.9],[333.8,393.4],[334.5,391.5],[392.6,397.0],[394.1,377.4],[395.9,357.6],[399.6,308.8],[418.6,310.1]]]},"UT":{"name":"Utah","rings":[[[277.4,185.1],[293.3,187.6],[290.2,207.1],[319.0,211.4],[313.9,247.9],[311.5,264.4],[311.5,266.6],[308.3,289.3],[286.1,285.9],[232.2,276.7],[250.8,180.3],[277.4,185.1]]]},"VT":{"name":"Vermont","rings":[[[842.1,102.6],[842.7,104.4],[841.7,108.0],[843.8,110.7],[842.4,114.5],[838.4,117.5],[839.7,122.1],[838.9,124.0],[838.8,128.5],[837.4,132.9],[838.3,141.1],[839.2,143.8],[838.2,145.2],[838.8,148.0],[840.4,149.2],[829.1,151.6],[828.5,150.0],[825.8,136.7],[822.9,134.2],[823.2,132.4],[820.8,127.5],[821.4,123.3],[820.9,119.5],[818.8,116.4],[818.7,112.7],[817.6,108.8],[831.4,105.5],[842.1,102.6]]]},"VA":{"name":"Virginia","rings":[[[770.3,230.2],[779.2,235.2],[780.1,231.2],[782.4,231.1],[784.3,232.3],[784.9,235.2],[788.1,235.5],[790.4,237.0],[792.1,239.5],[791.4,242.8],[789.8,244.0],[789.2,247.0],[790.3,248.9],[794.1,247.4],[795.5,250.3],[800.9,250.5],[802.9,252.7],[807.6,254.4],[806.9,260.2],[809.5,264.1],[807.9,266.5],[808.1,269.0],[810.3,270.0],[808.7,272.8],[805.0,270.4],[804.4,271.6],[807.6,273.3],[815.2,272.2],[818.6,279.0],[763.2,290.0],[751.2,291.9],[740.7,293.3],[729.9,294.5],[699.3,298.6],[707.1,294.7],[707.8,292.4],[710.7,291.3],[710.6,289.5],[712.7,287.9],[712.5,286.4],[717.6,282.8],[722.7,276.7],[722.7,278.3],[725.3,281.3],[728.1,282.5],[730.0,282.1],[732.5,279.1],[734.9,280.8],[738.6,279.1],[744.9,274.3],[745.7,275.4],[748.0,273.2],[747.5,269.7],[748.7,266.4],[751.0,263.0],[751.5,259.3],[753.9,255.2],[754.2,250.5],[757.2,252.8],[759.8,253.2],[761.1,251.3],[763.0,243.8],[765.2,245.2],[770.6,236.1],[770.3,230.2]],[[819.6,249.3],[821.8,248.5],[820.6,252.2],[818.8,253.8],[818.5,258.5],[816.9,266.3],[814.7,268.3],[813.3,265.9],[813.4,259.7],[815.8,251.4],[819.6,249.3]],[[810.6,252.5],[811.0,252.4],[810.2,252.6],[810.6,252.5]]]},"WA":{"name":"Washington","rings":[[[238.7,38.4],[233.3,61.7],[227.7,87.0],[227.1,88.5],[228.1,92.2],[227.4,95.6],[200.1,89.0],[198.0,89.8],[192.6,88.9],[186.4,89.1],[182.7,90.1],[178.7,89.6],[177.2,88.2],[169.3,89.0],[169.2,87.6],[165.3,85.5],[161.6,84.8],[155.0,86.1],[148.9,82.2],[149.9,76.3],[149.3,73.7],[147.1,71.0],[145.8,70.8],[143.6,70.7],[142.0,67.9],[139.9,66.5],[137.6,67.0],[135.6,64.7],[136.9,62.3],[139.0,61.5],[137.6,56.8],[138.9,46.2],[138.2,44.6],[139.0,37.0],[137.4,33.5],[138.1,27.8],[140.6,24.6],[142.6,27.1],[147.0,31.0],[150.5,31.9],[153.8,33.9],[157.4,33.9],[158.5,36.0],[161.5,36.8],[162.4,41.5],[164.0,41.6],[162.7,47.2],[162.2,52.4],[163.6,52.3],[163.5,47.6],[165.1,43.5],[168.4,39.9],[167.2,37.7],[167.9,34.6],[167.6,30.9],[169.0,28.6],[168.9,25.5],[167.1,24.5],[165.9,21.9],[166.9,20.0],[238.7,38.4]],[[161.3,26.7],[163.4,24.7],[164.4,28.2],[163.1,30.5],[160.4,29.0],[161.3,26.7]],[[163.7,32.9],[165.6,32.6],[164.2,36.3],[162.6,34.3],[163.7,32.9]]]},"WV":{"name":"West Virginia","rings":[[[734.7,213.1],[737.7,230.8],[752.9,228.2],[754.5,238.2],[757.1,235.9],[759.4,232.1],[761.4,232.4],[763.8,229.0],[768.4,229.6],[768.5,227.4],[771.0,227.0],[772.0,225.3],[774.9,226.6],[777.3,226.1],[780.1,231.2],[779.2,235.2],[770.3,230.2],[770.6,236.1],[765.2,245.2],[763.0,243.8],[761.1,251.3],[759.8,253.2],[757.2,252.8],[754.2,250.5],[753.9,255.2],[751.5,259.3],[751.0,263.0],[748.7,266.4],[747.5,269.7],[748.0,273.2],[745.7,275.4],[744.9,274.3],[738.6,279.1],[734.9,280.8],[732.5,279.1],[730.0,282.1],[728.1,282.5],[725.3,281.3],[722.7,278.3],[722.7,276.7],[720.7,276.7],[717.4,274.8],[716.4,272.7],[713.6,270.2],[711.2,266.7],[710.8,260.8],[714.7,259.8],[714.9,257.1],[716.5,255.8],[715.3,252.9],[717.4,247.8],[720.0,250.5],[721.3,248.5],[720.6,246.3],[721.9,242.3],[723.6,242.1],[724.9,239.1],[726.7,240.1],[728.4,239.0],[733.1,231.8],[733.3,224.4],[734.6,219.4],[734.2,216.4],[732.8,214.5],[734.7,213.1]]]},"WI":{"name":"Wisconsin","rings":[[[583.8,113.3],[586.3,114.3],[588.0,117.5],[602.2,120.5],[608.2,122.9],[609.9,122.1],[615.8,123.6],[617.6,125.9],[620.6,128.0],[620.7,131.4],[619.7,134.2],[623.0,134.3],[621.9,137.2],[624.2,139.0],[623.9,141.4],[621.3,142.1],[619.4,146.8],[618.8,149.9],[620.5,150.3],[622.4,148.1],[624.3,144.1],[627.1,142.3],[628.9,137.2],[631.6,135.9],[631.6,138.5],[629.9,141.0],[626.8,149.4],[626.1,154.0],[626.5,157.2],[625.1,158.4],[624.2,162.9],[625.0,166.6],[624.0,169.2],[622.8,175.4],[623.6,180.2],[625.7,184.3],[625.7,190.0],[611.6,191.2],[585.2,192.6],[584.1,190.2],[578.9,188.2],[577.7,185.1],[577.0,180.8],[578.5,178.3],[576.4,176.5],[576.1,173.6],[575.2,171.4],[575.4,168.3],[572.5,164.1],[570.3,163.5],[566.2,160.3],[565.4,157.8],[561.0,155.8],[559.5,153.8],[556.6,153.6],[552.8,150.2],[553.6,143.0],[553.2,139.7],[554.6,136.6],[552.8,134.2],[551.2,134.1],[551.4,131.3],[554.4,127.0],[558.2,125.3],[558.9,124.1],[558.5,112.6],[561.1,110.9],[562.2,111.7],[565.2,111.8],[574.4,108.0],[577.7,106.1],[579.0,107.4],[577.3,110.0],[581.9,113.1],[583.8,113.3]]]},"WY":{"name":"Wyoming","rings":[[[329.3,133.6],[372.6,138.9],[398.0,141.4],[394.8,180.2],[391.4,219.3],[367.1,217.2],[335.4,213.4],[319.0,211.4],[290.2,207.1],[293.3,187.6],[300.9,139.8],[302.5,129.6],[329.3,133.6]]]}};\n'
        'const NAME_TO_CODE = {};\n'
        'Object.keys(USA).forEach(code => { NAME_TO_CODE[USA[code].name.toLowerCase()] = code; });\n'
        '\n'
        'function resolveCode(raw){\n'
        '  if(raw == null) return null;\n'
        '  const key = String(raw).trim();\n'
        '  if(!key) return null;\n'
        '  const upper = key.toUpperCase();\n'
        '  if(USA[upper]) return upper;\n'
        '  return NAME_TO_CODE[key.toLowerCase()] || null;\n'
        '}\n'
        'function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }\n'
        'function heatColor(t, scale){\n'
        '  t = Math.max(0, Math.min(1, t));\n'
        '  const stops = scale === \'diverging\'\n'
        '    ? [[0,\'#1d4ed8\'],[0.5,\'#e2e8f0\'],[1,\'#dc2626\']]\n'
        '    : [[0,\'#0f172a\'],[0.2,\'#0e7490\'],[0.45,\'#14b8a6\'],[0.7,\'#fbbf24\'],[1,\'#ea580c\']];\n'
        '  for(let i=0;i<stops.length-1;i++){\n'
        '    if(t<=stops[i+1][0]){\n'
        '      const a=stops[i], b=stops[i+1];\n'
        '      const u=(t-a[0])/((b[0]-a[0])||1);\n'
        '      return lerpHex(a[1],b[1],u);\n'
        '    }\n'
        '  }\n'
        '  return stops[stops.length-1][1];\n'
        '}\n'
        'function lerpHex(a,b,t){\n'
        '  const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);\n'
        '  const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;\n'
        '  const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;\n'
        '  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;\n'
        '}\n'
        'function formatMetric(v){\n'
        '  if(Math.abs(v)>=1e6) return (v/1e6).toFixed(1)+\'M\';\n'
        '  if(Math.abs(v)>=1000) return Math.round(v/1000)+\'k\';\n'
        '  return String(Math.round(v));\n'
        '}\n'
        'function ringBounds(ring){\n'
        '  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,area=0,cx=0,cy=0;\n'
        '  for(let i=0;i<ring.length-1;i++){\n'
        '    const x1=ring[i][0], y1=ring[i][1], x2=ring[i+1][0], y2=ring[i+1][1];\n'
        '    minX=Math.min(minX,x1); minY=Math.min(minY,y1); maxX=Math.max(maxX,x1); maxY=Math.max(maxY,y1);\n'
        '    const cross=x1*y2-x2*y1; area+=cross; cx+=(x1+x2)*cross; cy+=(y1+y2)*cross;\n'
        '  }\n'
        '  area*=0.5;\n'
        '  if(Math.abs(area)>1e-6){ cx/=6*area; cy/=6*area; } else { cx=(minX+maxX)/2; cy=(minY+maxY)/2; }\n'
        '  return { area: Math.abs(area), cx, cy };\n'
        '}\n'
        'function drawRing(ring, scale, ox, oy){\n'
        '  if(!ring || ring.length<3) return;\n'
        '  ctx.beginPath();\n'
        '  for(let i=0;i<ring.length;i++){\n'
        '    const x=ox+ring[i][0]*scale, y=oy+ring[i][1]*scale;\n'
        '    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);\n'
        '  }\n'
        '  ctx.closePath();\n'
        '}\n'
        'function roundRect(x,y,w,h,r){\n'
        '  const radius=Math.min(r,w/2,h/2);\n'
        '  ctx.beginPath();\n'
        '  ctx.moveTo(x+radius,y);\n'
        '  ctx.arcTo(x+w,y,x+w,y+h,radius);\n'
        '  ctx.arcTo(x+w,y+h,x,y+h,radius);\n'
        '  ctx.arcTo(x,y+h,x,y,radius);\n'
        '  ctx.arcTo(x,y,x+w,y,radius);\n'
        '  ctx.closePath();\n'
        '}\n'
        'function buildMetricMap(){\n'
        '  const map={}, unmatched=[];\n'
        '  records.forEach(r=>{\n'
        '    const code=resolveCode(r.area_key);\n'
        '    if(!code){ unmatched.push(String(r.area_key||\'\')); return; }\n'
        '    map[code]=r;\n'
        '    if(!r.area_label) r.area_label=USA[code].name;\n'
        '  });\n'
        '  return { map, unmatched };\n'
        '}\n'
        'function layout(w,h){\n'
        '  const pad=12;\n'
        '  const scale=Math.min((w-pad*2)/VIEW.width,(h-pad*2)/VIEW.height)*zoom;\n'
        '  const ox=(w-VIEW.width*scale)/2+panX;\n'
        '  const oy=(h-VIEW.height*scale)/2+panY;\n'
        '  return { scale, ox, oy };\n'
        '}\n'
        'function resize(){\n'
        '  const wrap=document.getElementById(\'wrap\');\n'
        '  const dpr=window.devicePixelRatio||1;\n'
        '  const w=Math.max(320, wrap.clientWidth||640);\n'
        '  const h=Math.max(280, wrap.clientHeight||520);\n'
        '  canvas.width=Math.floor(w*dpr);\n'
        '  canvas.height=Math.floor(h*dpr);\n'
        '  canvas.style.width=w+\'px\';\n'
        '  canvas.style.height=h+\'px\';\n'
        '  ctx.setTransform(dpr,0,0,dpr,0,0);\n'
        '  draw();\n'
        '}\n'
        'function draw(){\n'
        '  const wrap=document.getElementById(\'wrap\');\n'
        '  const w=Math.max(320, wrap.clientWidth||640);\n'
        '  const h=Math.max(280, wrap.clientHeight||520);\n'
        '  const g=ctx.createLinearGradient(0,0,0,h);\n'
        '  g.addColorStop(0,\'#0b1220\'); g.addColorStop(1,\'#111827\');\n'
        '  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);\n'
        '\n'
        '  const { map, unmatched } = buildMetricMap();\n'
        '  const values=Object.values(map).map(r=>num(r.metric_value,0));\n'
        '  const minV=values.length?Math.min(...values):0;\n'
        '  const maxV=values.length?Math.max(...values):1;\n'
        '  const span=(maxV-minV)||1;\n'
        '  const { scale, ox, oy } = layout(w,h);\n'
        '\n'
        '  ctx.save();\n'
        '  ctx.globalAlpha=0.35;\n'
        '  ctx.fillStyle=\'#1e293b\';\n'
        '  Object.keys(USA).forEach(code=>{\n'
        '    USA[code].rings.forEach(ring=>{ drawRing(ring,scale,ox,oy); ctx.fill(); });\n'
        '  });\n'
        '  ctx.restore();\n'
        '\n'
        '  const labels=[];\n'
        '  Object.keys(USA).forEach(code=>{\n'
        '    const state=USA[code];\n'
        '    const rec=map[code];\n'
        '    const t=rec==null?null:(num(rec.metric_value,0)-minV)/span;\n'
        '    const fill=t==null?\'#1f2937\':heatColor(t,cfg.color_scale);\n'
        '    let largest=ringBounds(state.rings[0]);\n'
        '    state.rings.forEach(ring=>{\n'
        '      drawRing(ring,scale,ox,oy);\n'
        '      ctx.fillStyle=fill; ctx.fill();\n'
        '      ctx.strokeStyle=code===hoverCode?\'#f8fafc\':\'rgba(226,232,240,.45)\';\n'
        '      ctx.lineWidth=(code===hoverCode?1.6:0.9)*Math.max(scale,0.5);\n'
        '      ctx.stroke();\n'
        '      const b=ringBounds(ring);\n'
        '      if(b.area>largest.area) largest=b;\n'
        '    });\n'
        '    labels.push({ code, x: ox+largest.cx*scale, y: oy+largest.cy*scale, area: largest.area*scale*scale });\n'
        '  });\n'
        '\n'
        '  if(cfg.show_labels!==false){\n'
        '    const minLabelArea=220;\n'
        '    ctx.textAlign=\'center\'; ctx.textBaseline=\'middle\';\n'
        '    ctx.font=`600 ${Math.max(9, Math.round(10*Math.min(scale*1.2,1.6)))}px system-ui,sans-serif`;\n'
        '    labels.forEach(l=>{\n'
        '      if(l.area<minLabelArea) return;\n'
        '      ctx.fillStyle=\'rgba(15,23,42,.55)\'; ctx.fillText(l.code,l.x+0.6,l.y+0.6);\n'
        '      ctx.fillStyle=\'#f8fafc\'; ctx.fillText(l.code,l.x,l.y);\n'
        '    });\n'
        '    function callout(code, text, color, dy){\n'
        '      const hit=labels.find(l=>l.code===code); if(!hit) return;\n'
        '      const x=hit.x, y=hit.y+dy;\n'
        '      ctx.font=`700 ${Math.max(8, Math.round(9*Math.min(scale*1.2,1.5)))}px system-ui,sans-serif`;\n'
        '      const tw=ctx.measureText(text).width+10, th=14;\n'
        '      ctx.fillStyle=\'rgba(15,23,42,.85)\';\n'
        '      roundRect(x-tw/2,y-th/2,tw,th,4); ctx.fill();\n'
        '      ctx.fillStyle=color; ctx.textAlign=\'center\'; ctx.textBaseline=\'middle\'; ctx.fillText(text,x,y);\n'
        '    }\n'
        '    if(summary.highest && summary.highest.area_key){\n'
        '      const c=resolveCode(summary.highest.area_key);\n'
        '      if(c) callout(c,\'HOT\',\'#fbbf24\',-12*Math.max(scale,0.8));\n'
        '    }\n'
        '    if(summary.lowest && summary.lowest.area_key){\n'
        '      const c=resolveCode(summary.lowest.area_key);\n'
        '      if(c) callout(c,\'COLD\',\'#38bdf8\',12*Math.max(scale,0.8));\n'
        '    }\n'
        '  }\n'
        '\n'
        '  if(cfg.show_legend!==false){\n'
        '    const lx=w-140, ly=14, lw=118, lh=10;\n'
        '    const grd=ctx.createLinearGradient(lx,0,lx+lw,0);\n'
        '    for(let i=0;i<=10;i++) grd.addColorStop(i/10, heatColor(i/10,cfg.color_scale));\n'
        '    ctx.fillStyle=\'rgba(15,23,42,.82)\'; ctx.strokeStyle=\'rgba(148,163,184,.35)\';\n'
        '    roundRect(lx-8,ly-8,lw+16,40,6); ctx.fill(); ctx.stroke();\n'
        '    ctx.fillStyle=grd; ctx.fillRect(lx,ly,lw,lh);\n'
        '    ctx.fillStyle=\'#cbd5e1\'; ctx.font=\'10px system-ui,sans-serif\';\n'
        '    ctx.textAlign=\'left\'; ctx.fillText(formatMetric(minV),lx,ly+26);\n'
        '    ctx.textAlign=\'right\'; ctx.fillText(formatMetric(maxV),lx+lw,ly+26);\n'
        '  }\n'
        '\n'
        '  canvas._map=map; canvas._labels=labels; canvas._layout={scale,ox,oy};\n'
        '  const warnEl=document.getElementById(\'warn\');\n'
        '  if(warnEl){\n'
        '    const warnings=Array.isArray(summary.warnings)?summary.warnings.slice():[];\n'
        '    if(unmatched.length) warnings.push(\'Unmatched area keys: \'+unmatched.slice(0,8).join(\', \'));\n'
        '    warnEl.textContent=warnings.join(\' · \');\n'
        '  }\n'
        '}\n'
        'function findHit(clientX, clientY){\n'
        '  const rect=canvas.getBoundingClientRect();\n'
        '  const x=clientX-rect.left, y=clientY-rect.top;\n'
        '  const { scale, ox, oy } = canvas._layout || layout(rect.width, rect.height);\n'
        '  const codes=Object.keys(USA);\n'
        '  for(let i=codes.length-1;i>=0;i--){\n'
        '    const code=codes[i];\n'
        '    const rings=USA[code].rings;\n'
        '    for(let r=0;r<rings.length;r++){\n'
        '      drawRing(rings[r], scale, ox, oy);\n'
        '      if(ctx.isPointInPath(x,y)) return code;\n'
        '    }\n'
        '  }\n'
        '  return null;\n'
        '}\n'
        'canvas.addEventListener(\'pointerdown\', e=>{\n'
        '  dragging=true; dragStartX=e.clientX; dragStartY=e.clientY; panStartX=panX; panStartY=panY;\n'
        '  canvas.setPointerCapture(e.pointerId);\n'
        '});\n'
        'canvas.addEventListener(\'pointermove\', e=>{\n'
        '  if(dragging){\n'
        '    panX=panStartX+(e.clientX-dragStartX);\n'
        '    panY=panStartY+(e.clientY-dragStartY);\n'
        '    draw(); return;\n'
        '  }\n'
        '  const code=findHit(e.clientX,e.clientY);\n'
        '  hoverCode=code; draw();\n'
        '  if(!code){ tip.style.display=\'none\'; return; }\n'
        '  const rec=(canvas._map||{})[code];\n'
        '  const state=USA[code];\n'
        '  const rect=canvas.getBoundingClientRect();\n'
        '  tip.style.display=\'block\';\n'
        '  tip.style.left=Math.min(rect.width-210, Math.max(8, e.clientX-rect.left+12))+\'px\';\n'
        '  tip.style.top=Math.min(rect.height-90, Math.max(8, e.clientY-rect.top+12))+\'px\';\n'
        '  let html=\'<strong>\'+esc(state?state.name:code)+\' (\'+esc(code)+\')</strong>\';\n'
        '  if(rec){\n'
        '    html+=\'<br/>Metric: \'+num(rec.metric_value,0).toLocaleString();\n'
        '    if(rec.change_pct!=null) html+=\'<br/>Change: \'+num(rec.change_pct,0).toFixed(1)+\'%\';\n'
        '    if(rec.secondary_value!=null) html+=\'<br/>Secondary: \'+num(rec.secondary_value,0).toLocaleString();\n'
        '    if(rec.risk_score!=null) html+=\'<br/>Risk: \'+num(rec.risk_score,0).toFixed(0);\n'
        '    if(rec.category) html+=\'<br/>\'+esc(rec.category);\n'
        '    if(rec.notes) html+=\'<br/>\'+esc(rec.notes);\n'
        '  } else html+=\'<br/><em>No data</em>\';\n'
        '  tip.innerHTML=html;\n'
        '});\n'
        'canvas.addEventListener(\'pointerup\', e=>{\n'
        '  dragging=false;\n'
        '  try{ canvas.releasePointerCapture(e.pointerId);}catch(_){}\n'
        '});\n'
        'canvas.addEventListener(\'pointerleave\', ()=>{ tip.style.display=\'none\'; hoverCode=null; draw(); });\n'
        'canvas.addEventListener(\'wheel\', e=>{\n'
        '  e.preventDefault();\n'
        '  zoom=Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom*(e.deltaY<0?1.08:0.92)));\n'
        '  draw();\n'
        '}, { passive:false });\n'
        'canvas.addEventListener(\'dblclick\', ()=>{ panX=0; panY=0; zoom=1; draw(); });\n'
        'window.addEventListener(\'resize\', resize);\n'
        '\n'
        'function esc(s){ return String(s).replace(/[&<>"\']/g, c=>({ \'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\' }[c])); }\n'
        '\n'
        'resize();\n'
        '</script></body></html>\n'
    )
    vdab_heatmapstory1_html = vdab_heatmapstory1_html.replace('__HEAT_MAP_PAYLOAD__', json.dumps(vdab_heatmapstory1_payload, default=str).replace('<', '\\u003c'))
    components.html(vdab_heatmapstory1_html, height=580, scrolling=False)
