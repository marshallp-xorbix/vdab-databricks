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

st.set_page_config(page_title='Production terrain', layout='wide')
st.title('Production terrain')

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

_vdab_lbl_vdab_productionterrain = ui_overrides.get('labels', {}).get('productionTerrain', None)
_vdab_disp_lbl_vdab_productionterrain = _vdab_lbl_vdab_productionterrain if _vdab_lbl_vdab_productionterrain is not None else 'Production Terrain'
st.subheader(_vdab_disp_lbl_vdab_productionterrain)
try:
    vdab_productionterrain_data = _vdab_sql_query_df('main', 'analytics', 'production_grid', 500, query_statement='SELECT `line` AS x_value, `part` AS y_value, SUM(`output`) AS height_value, MAX(`category`) AS category, MAX(`status`) AS status, MAX(`event`) AS event_name, MAX(`event_date`) AS event_date, MAX(`callout`) AS callout_text, AVG(`risk`) AS risk_score, AVG(`target`) AS target_value, AVG(`baseline`) AS baseline_value, AVG(`forecast`) AS forecast_value, SUM(`volume`) AS volume_value FROM (SELECT * FROM `main`.`analytics`.`production_grid` WHERE `month` = (SELECT MAX(`month`) FROM `main`.`analytics`.`production_grid`)) GROUP BY `line`, `part`')
except RuntimeError as vdab_error_vdab_productionterrain:
    st.error(str(vdab_error_vdab_productionterrain))
    vdab_productionterrain_data = pd.DataFrame(columns=['x_value', 'y_value', 'height_value'])
if vdab_productionterrain_data is None or vdab_productionterrain_data.empty or not all(_vdab_column in vdab_productionterrain_data.columns for _vdab_column in ('x_value', 'y_value', 'height_value')):
    st.info('No terrain cells returned. Check bindings and field mappings.')
else:
    vdab_productionterrain_data = vdab_productionterrain_data.copy()
    vdab_productionterrain_data_source_count = len(vdab_productionterrain_data)
    if 'height_value' in vdab_productionterrain_data.columns:
        vdab_productionterrain_data['height_value'] = pd.to_numeric(vdab_productionterrain_data['height_value'], errors='coerce')
        vdab_productionterrain_data['height_value'] = vdab_productionterrain_data['height_value'].where(vdab_productionterrain_data['height_value'].map(math.isfinite))
    if 'risk_score' in vdab_productionterrain_data.columns:
        vdab_productionterrain_data['risk_score'] = pd.to_numeric(vdab_productionterrain_data['risk_score'], errors='coerce')
        vdab_productionterrain_data['risk_score'] = vdab_productionterrain_data['risk_score'].where(vdab_productionterrain_data['risk_score'].map(math.isfinite))
    if 'target_value' in vdab_productionterrain_data.columns:
        vdab_productionterrain_data['target_value'] = pd.to_numeric(vdab_productionterrain_data['target_value'], errors='coerce')
        vdab_productionterrain_data['target_value'] = vdab_productionterrain_data['target_value'].where(vdab_productionterrain_data['target_value'].map(math.isfinite))
    if 'baseline_value' in vdab_productionterrain_data.columns:
        vdab_productionterrain_data['baseline_value'] = pd.to_numeric(vdab_productionterrain_data['baseline_value'], errors='coerce')
        vdab_productionterrain_data['baseline_value'] = vdab_productionterrain_data['baseline_value'].where(vdab_productionterrain_data['baseline_value'].map(math.isfinite))
    if 'forecast_value' in vdab_productionterrain_data.columns:
        vdab_productionterrain_data['forecast_value'] = pd.to_numeric(vdab_productionterrain_data['forecast_value'], errors='coerce')
        vdab_productionterrain_data['forecast_value'] = vdab_productionterrain_data['forecast_value'].where(vdab_productionterrain_data['forecast_value'].map(math.isfinite))
    if 'volume_value' in vdab_productionterrain_data.columns:
        vdab_productionterrain_data['volume_value'] = pd.to_numeric(vdab_productionterrain_data['volume_value'], errors='coerce')
        vdab_productionterrain_data['volume_value'] = vdab_productionterrain_data['volume_value'].where(vdab_productionterrain_data['volume_value'].map(math.isfinite))
    vdab_productionterrain_data = vdab_productionterrain_data.dropna(subset=['x_value', 'y_value'])
    vdab_productionterrain_data['height_value'] = vdab_productionterrain_data['height_value'].fillna(0)
    vdab_productionterrain_data['x_value'] = vdab_productionterrain_data['x_value'].astype(str)
    vdab_productionterrain_data['y_value'] = vdab_productionterrain_data['y_value'].astype(str)
    vdab_productionterrain_data = vdab_productionterrain_data.sort_values(by=['x_value', 'y_value'], kind='stable')
    vdab_productionterrain_records = []
    vdab_productionterrain_callouts = []
    for _, _vdab_row in vdab_productionterrain_data.iterrows():
        _vdab_record = {
            'x': str(_vdab_row.get('x_value', '')),
            'y': str(_vdab_row.get('y_value', '')),
            'height': float(_vdab_row.get('height_value') or 0),
        }
        _vdab_category = _vdab_row.get('category')
        if 'category' in vdab_productionterrain_data.columns and not pd.isna(_vdab_category):
            _vdab_record['category'] = str(_vdab_category).strip()
        _vdab_risk_score = _vdab_row.get('risk_score')
        if 'risk_score' in vdab_productionterrain_data.columns and not pd.isna(_vdab_risk_score):
            _vdab_record['risk_score'] = float(_vdab_risk_score)
        _vdab_target_value = _vdab_row.get('target_value')
        if 'target_value' in vdab_productionterrain_data.columns and not pd.isna(_vdab_target_value):
            _vdab_record['target_value'] = float(_vdab_target_value)
        _vdab_baseline_value = _vdab_row.get('baseline_value')
        if 'baseline_value' in vdab_productionterrain_data.columns and not pd.isna(_vdab_baseline_value):
            _vdab_record['baseline_value'] = float(_vdab_baseline_value)
        _vdab_forecast_value = _vdab_row.get('forecast_value')
        if 'forecast_value' in vdab_productionterrain_data.columns and not pd.isna(_vdab_forecast_value):
            _vdab_record['forecast_value'] = float(_vdab_forecast_value)
        _vdab_volume_value = _vdab_row.get('volume_value')
        if 'volume_value' in vdab_productionterrain_data.columns and not pd.isna(_vdab_volume_value):
            _vdab_record['volume_value'] = float(_vdab_volume_value)
        _vdab_status = _vdab_row.get('status')
        if 'status' in vdab_productionterrain_data.columns and not pd.isna(_vdab_status):
            _vdab_record['status'] = str(_vdab_status).strip()
        if 'baseline_value' in _vdab_record:
            _vdab_record['variance'] = _vdab_record['height'] - _vdab_record['baseline_value']
        elif 'target_value' in _vdab_record:
            _vdab_record['variance'] = _vdab_record['height'] - _vdab_record['target_value']
        vdab_productionterrain_records.append(_vdab_record)
        _vdab_event_name = _vdab_row.get('event_name')
        _vdab_callout_text = _vdab_row.get('callout_text')
        if ('event_name' in vdab_productionterrain_data.columns and not pd.isna(_vdab_event_name) and str(_vdab_event_name).strip()) or ('callout_text' in vdab_productionterrain_data.columns and not pd.isna(_vdab_callout_text) and str(_vdab_callout_text).strip()):
            _vdab_callout = {'x': _vdab_record['x'], 'y': _vdab_record['y'], 'label': str(_vdab_event_name).strip() if not pd.isna(_vdab_event_name) and str(_vdab_event_name).strip() else 'Callout', 'metric_value': _vdab_record['height']}
            _vdab_event_date = _vdab_row.get('event_date')
            if 'event_date' in vdab_productionterrain_data.columns and not pd.isna(_vdab_event_date):
                _vdab_callout['event_date'] = str(_vdab_event_date)
            if not pd.isna(_vdab_callout_text) and str(_vdab_callout_text).strip():
                _vdab_callout['description'] = str(_vdab_callout_text).strip()
            if 'status' in _vdab_record:
                _vdab_callout['severity'] = _vdab_record['status']
            vdab_productionterrain_callouts.append(_vdab_callout)
    vdab_productionterrain_sorted = sorted(vdab_productionterrain_records, key=lambda _vdab_record: (-_vdab_record['height'], _vdab_record['x'], _vdab_record['y']))
    vdab_productionterrain_peaks = [{'x': _vdab_record['x'], 'y': _vdab_record['y'], 'height': _vdab_record['height']} for _vdab_record in vdab_productionterrain_sorted[:3]]
    vdab_productionterrain_valleys = [{'x': _vdab_record['x'], 'y': _vdab_record['y'], 'height': _vdab_record['height']} for _vdab_record in sorted(vdab_productionterrain_records, key=lambda _vdab_record: (_vdab_record['height'], _vdab_record['x'], _vdab_record['y']))[:3]]
    vdab_productionterrain_payload = {
        'records': vdab_productionterrain_records,
        'callouts': vdab_productionterrain_callouts,
        'visualConfig': {
            'terrain_mode': 'surface',
            'height_scale': 1,
            'interpolation': 'bilinear',
            'grid_resolution': 60,
            'color_by': 'height_metric',
            'show_peak_labels': True,
            'show_valley_labels': True,
            'camera_preset': 'angled',
            'aggregation_method': 'sum',
        },
        'summary': {
            'grid_size': len(vdab_productionterrain_records),
            'excluded_rows': vdab_productionterrain_data_source_count - len(vdab_productionterrain_data),
            'top_peaks': vdab_productionterrain_peaks,
            'bottom_valleys': vdab_productionterrain_valleys,
            'warnings': [],
        },
    }
    vdab_productionterrain_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"/>\n'
        '<style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0a1628;box-shadow:0 1px 2px rgba(15,23,42,.08);}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;outline:none;}\n'
        'canvas:focus-visible{outline:2px solid #38bdf8;outline-offset:-2px;}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(10,22,40,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35;}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}\n'
        '#toolbar{position:absolute;left:10px;top:10px;z-index:4;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}\n'
        '.tbtn{cursor:pointer;padding:3px 8px;border-radius:6px;font-size:11px;background:rgba(15,23,42,.85);color:#e2e8f0;border:1px solid #475569;user-select:none;}\n'
        '.tbtn.off{opacity:.55;text-decoration:line-through;}\n'
        '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}\n'
        '</style></head><body>\n'
        '<div id="wrap" role="group" aria-label="Terrain visualization">\n'
        '<div id="toolbar" aria-label="Terrain overlays"><button type="button" class="tbtn" id="togPeaks" aria-pressed="true">Peaks</button><button type="button" class="tbtn" id="togValleys" aria-pressed="true">Valleys</button><button type="button" class="tbtn" id="togEvents" aria-pressed="true">Events</button></div>\n'
        '<canvas id="c" tabindex="0" role="img" aria-label="Terrain grid. Use arrow keys to inspect cells, Home or End to move, and Escape to clear selection."></canvas>\n'
        '<div id="tip"></div><div id="announce" class="sr-only" aria-live="polite"></div>\n'
        '<div id="hint">Arrow keys inspect cells · drag to pan · scroll to zoom · double-click to reset</div>\n'
        '<script>\n'
        'const payload = __TERRAIN_PAYLOAD__;\r\n'
        'const canvas = document.getElementById(\'c\');\r\n'
        'const tip = document.getElementById(\'tip\');\n'
        'const announce = document.getElementById(\'announce\');\r\n'
        'const ctx = canvas.getContext(\'2d\');\r\n'
        'const cfg = Object.assign({\r\n'
        '  terrain_mode: \'surface\', height_scale: 1, interpolation: \'bilinear\', grid_resolution: 60,\r\n'
        '  color_by: \'height_metric\', show_peak_labels: true, show_valley_labels: true,\r\n'
        '  camera_preset: \'angled\', aggregation_method: \'sum\'\r\n'
        '}, (payload && payload.visualConfig) || {});\r\n'
        'let records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];\r\n'
        'let callouts = Array.isArray(payload && payload.callouts) ? payload.callouts.slice() : [];\r\n'
        'const summary = (payload && payload.summary) || {};\r\n'
        'let peaks = Array.isArray(summary.top_peaks) ? summary.top_peaks : [];\r\n'
        'let valleys = Array.isArray(summary.bottom_valleys) ? summary.bottom_valleys : [];\r\n'
        'let showPeaks = cfg.show_peak_labels !== false;\r\n'
        'let showValleys = cfg.show_valley_labels !== false;\r\n'
        'let showEvents = true;\r\n'
        'let selectedKey = null;\r\n'
        'let hoverKey = null;\r\n'
        'let panX = 0, panY = 0, zoom = 1;\r\n'
        'let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;\r\n'
        'const MIN_ZOOM = 0.55, MAX_ZOOM = 2.75;\r\n'
        'const MAX_DENSE = 80;\r\n'
        '\r\n'
        'function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }\r\n'
        'function cellKey(x,y){ return String(x)+\'|\'+String(y); }\r\n'
        'function heightColor(t){\r\n'
        '  const stops=[[0,\'#0c4a6e\'],[0.25,\'#0e7490\'],[0.5,\'#14b8a6\'],[0.75,\'#fbbf24\'],[1,\'#f97316\']];\r\n'
        '  t=Math.max(0,Math.min(1,t));\r\n'
        '  for(let i=0;i<stops.length-1;i++){\r\n'
        '    if(t<=stops[i+1][0]){\r\n'
        '      const a=stops[i], b=stops[i+1];\r\n'
        '      const u=(t-a[0])/((b[0]-a[0])||1);\r\n'
        '      return lerpHex(a[1],b[1],u);\r\n'
        '    }\r\n'
        '  }\r\n'
        '  return stops[stops.length-1][1];\r\n'
        '}\r\n'
        'function riskColor(r){ const v=Math.max(0,Math.min(100,num(r,0))); return `rgb(${Math.round(80+v*1.7)},${Math.round(200-v*1.4)},70)`; }\r\n'
        'function lerpHex(a,b,t){\r\n'
        '  const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);\r\n'
        '  const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;\r\n'
        '  const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;\r\n'
        '  const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t);\r\n'
        '  return `rgb(${r},${g},${bl})`;\r\n'
        '}\r\n'
        'function darkenRgb(css, factor){\r\n'
        '  const m=String(css).match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);\r\n'
        '  if(!m) return css;\r\n'
        '  const f=Math.max(0,Math.min(1,factor));\r\n'
        '  return `rgb(${Math.round(+m[1]*f)},${Math.round(+m[2]*f)},${Math.round(+m[3]*f)})`;\r\n'
        '}\r\n'
        'function categoryColor(c){\r\n'
        '  const cols=[\'#2dd4bf\',\'#38bdf8\',\'#a78bfa\',\'#f472b6\',\'#fbbf24\',\'#34d399\'];\r\n'
        '  let h=0; for(let i=0;i<String(c).length;i++){ h=((h<<5)-h)+String(c).charCodeAt(i); h|=0; }\r\n'
        '  return cols[Math.abs(h)%cols.length];\r\n'
        '}\r\n'
        '\r\n'
        'function buildGrid(){\r\n'
        '  const xs=[...new Set(records.map(r=>String(r.x)))].sort();\r\n'
        '  const ys=[...new Set(records.map(r=>String(r.y)))].sort();\r\n'
        '  const map=new Map();\r\n'
        '  records.forEach(r=>map.set(cellKey(r.x,r.y), r));\r\n'
        '  const heights=records.map(r=>num(r.height,0));\r\n'
        '  const minH=heights.length?Math.min(...heights):0;\r\n'
        '  const maxH=heights.length?Math.max(...heights):1;\r\n'
        '  return {xs, ys, map, minH, maxH};\r\n'
        '}\r\n'
        '\r\n'
        'function cellFill(rec, minH, maxH){\r\n'
        '  const mode=(cfg.color_by||\'height_metric\').toLowerCase();\r\n'
        '  if(mode===\'risk_score\') return riskColor(rec.risk_score);\r\n'
        '  if(mode===\'variance\'){\r\n'
        '    const v=num(rec.variance,0);\r\n'
        '    const t=0.5+Math.max(-0.5,Math.min(0.5,v/((maxH-minH)||1)));\r\n'
        '    return heightColor(t);\r\n'
        '  }\r\n'
        '  if(mode===\'category\') return categoryColor(rec.category||\'Other\');\r\n'
        '  const t=((num(rec.height,0)-minH)/((maxH-minH)||1));\r\n'
        '  return heightColor(Math.pow(Math.max(0,t), 1/Math.max(cfg.height_scale||1,0.1)));\r\n'
        '}\r\n'
        '\r\n'
        'function heightNormColor(h, minH, maxH){\r\n'
        '  const t=((h-minH)/((maxH-minH)||1));\r\n'
        '  return heightColor(Math.pow(Math.max(0,Math.min(1,t)), 1/Math.max(cfg.height_scale||1,0.1)));\r\n'
        '}\r\n'
        '\r\n'
        'function sparseHeights(grid){\r\n'
        '  const rows=grid.ys.length, cols=grid.xs.length;\r\n'
        '  const H=Array.from({length:rows},()=>Array(cols).fill(null));\r\n'
        '  for(let yi=0;yi<rows;yi++){\r\n'
        '    for(let xi=0;xi<cols;xi++){\r\n'
        '      const rec=grid.map.get(cellKey(grid.xs[xi],grid.ys[yi]));\r\n'
        '      if(rec) H[yi][xi]=num(rec.height,0);\r\n'
        '    }\r\n'
        '  }\r\n'
        '  return H;\r\n'
        '}\r\n'
        '\r\n'
        'function sampleSparse(H, fx, fy){\r\n'
        '  const rows=H.length, cols=H[0]?H[0].length:0;\r\n'
        '  if(rows===0||cols===0) return null;\r\n'
        '  const x0=Math.floor(fx), y0=Math.floor(fy);\r\n'
        '  const x1=Math.min(x0+1, cols-1), y1=Math.min(y0+1, rows-1);\r\n'
        '  const tx=fx-x0, ty=fy-y0;\r\n'
        '  const v00=H[y0][x0], v10=H[y0][x1], v01=H[y1][x0], v11=H[y1][x1];\r\n'
        '  const known=[v00,v10,v01,v11].filter(v=>v!=null);\r\n'
        '  if(!known.length) return null;\r\n'
        '  const a=v00!=null?v00:(v10!=null?v10:(v01!=null?v01:v11));\r\n'
        '  const b=v10!=null?v10:(v00!=null?v00:(v11!=null?v11:v01));\r\n'
        '  const c=v01!=null?v01:(v00!=null?v00:(v11!=null?v11:v10));\r\n'
        '  const d=v11!=null?v11:(v10!=null?v10:(v01!=null?v01:v00));\r\n'
        '  const top=a+(b-a)*tx, bot=c+(d-c)*tx;\r\n'
        '  return top+(bot-top)*ty;\r\n'
        '}\r\n'
        '\r\n'
        'function buildDense(grid){\r\n'
        '  const sparse=sparseHeights(grid);\r\n'
        '  const rows=grid.ys.length, cols=grid.xs.length;\r\n'
        '  const useBilinear=(cfg.interpolation||\'bilinear\').toLowerCase()===\'bilinear\';\r\n'
        '  const want=Math.min(MAX_DENSE, Math.max(10, num(cfg.grid_resolution,60)|0));\r\n'
        '  let denseCols=cols, denseRows=rows;\r\n'
        '  if(useBilinear && Math.max(cols,rows)>1){\r\n'
        '    if(cols>=rows){ denseCols=Math.max(cols, want); denseRows=Math.max(rows, Math.round(want*(rows/Math.max(cols,1)))); }\r\n'
        '    else { denseRows=Math.max(rows, want); denseCols=Math.max(cols, Math.round(want*(cols/Math.max(rows,1)))); }\r\n'
        '    denseCols=Math.min(MAX_DENSE, denseCols);\r\n'
        '    denseRows=Math.min(MAX_DENSE, denseRows);\r\n'
        '  }\r\n'
        '  const dense=Array.from({length:denseRows},()=>Array(denseCols).fill(null));\r\n'
        '  for(let yi=0;yi<denseRows;yi++){\r\n'
        '    for(let xi=0;xi<denseCols;xi++){\r\n'
        '      const fx=cols<=1?0:(xi/(denseCols-1))*(cols-1);\r\n'
        '      const fy=rows<=1?0:(yi/(denseRows-1))*(rows-1);\r\n'
        '      if(useBilinear) dense[yi][xi]=sampleSparse(sparse, fx, fy);\r\n'
        '      else {\r\n'
        '        const sx=Math.round(fx), sy=Math.round(fy);\r\n'
        '        dense[yi][xi]=sparse[sy]?sparse[sy][sx]:null;\r\n'
        '      }\r\n'
        '    }\r\n'
        '  }\r\n'
        '  return {dense, denseCols, denseRows, sparseCols:cols, sparseRows:rows};\r\n'
        '}\r\n'
        '\r\n'
        'function cameraFactors(){\r\n'
        '  const cam=(cfg.camera_preset||\'angled\').toLowerCase();\r\n'
        '  if(cam===\'front\') return {xSkew:0.15, yDepth:0.55, elevMul:1.15};\r\n'
        '  if(cam===\'top\') return {xSkew:0.55, yDepth:0.35, elevMul:0.45};\r\n'
        '  return {xSkew:0.55, yDepth:0.42, elevMul:1}; // angled / free\r\n'
        '}\r\n'
        '\r\n'
        'function layoutHeat(W,H,grid){\r\n'
        '  const padL=90, padR=16, padT=40, padB=50;\r\n'
        '  const cw=Math.max(20,(W-padL-padR)/Math.max(grid.xs.length,1));\r\n'
        '  const ch=Math.max(16,(H-padT-padB)/Math.max(grid.ys.length,1));\r\n'
        '  return {padL,padR,padT,padB,cw,ch};\r\n'
        '}\r\n'
        '\r\n'
        'function drawHeat(W,H){\r\n'
        '  const grid=buildGrid();\r\n'
        '  if(!grid.xs.length||!grid.ys.length) return null;\r\n'
        '  const L=layoutHeat(W,H,grid);\r\n'
        '  ctx.save();\r\n'
        '  ctx.translate(panX,panY); ctx.scale(zoom,zoom);\r\n'
        '\r\n'
        '  grid.ys.forEach((y,yi)=>{\r\n'
        '    grid.xs.forEach((x,xi)=>{\r\n'
        '      const rec=grid.map.get(cellKey(x,y));\r\n'
        '      const px=L.padL+xi*L.cw, py=L.padT+yi*L.ch;\r\n'
        '      ctx.fillStyle=rec?cellFill(rec,grid.minH,grid.maxH):\'rgba(30,41,59,.4)\';\r\n'
        '      ctx.globalAlpha = (selectedKey && selectedKey!==cellKey(x,y)) ? 0.35 : 1;\r\n'
        '      ctx.fillRect(px+1,py+1,L.cw-2,L.ch-2);\r\n'
        '      if(hoverKey===cellKey(x,y) || selectedKey===cellKey(x,y)){\r\n'
        '        ctx.strokeStyle=\'#f8fafc\'; ctx.lineWidth=2/Math.max(zoom,0.5);\r\n'
        '        ctx.strokeRect(px+1,py+1,L.cw-2,L.ch-2);\r\n'
        '      }\r\n'
        '      ctx.globalAlpha=1;\r\n'
        '    });\r\n'
        '  });\r\n'
        '\r\n'
        '  ctx.fillStyle=\'#94a3b8\'; ctx.font=\'11px system-ui,sans-serif\'; ctx.textAlign=\'right\';\r\n'
        '  grid.ys.forEach((y,yi)=>{\r\n'
        '    ctx.fillText(String(y).slice(0,14), L.padL-6, L.padT+yi*L.ch+L.ch*0.65);\r\n'
        '  });\r\n'
        '  ctx.textAlign=\'center\';\r\n'
        '  grid.xs.forEach((x,xi)=>{\r\n'
        '    const label=String(x).slice(0,10);\r\n'
        '    ctx.save();\r\n'
        '    ctx.translate(L.padL+xi*L.cw+L.cw/2, L.padT+grid.ys.length*L.ch+14);\r\n'
        '    ctx.rotate(-0.35);\r\n'
        '    ctx.fillText(label,0,0);\r\n'
        '    ctx.restore();\r\n'
        '  });\r\n'
        '\r\n'
        '  drawMarkers(grid, L, false, null);\r\n'
        '  ctx.restore();\r\n'
        '  return {grid,L,mode:\'heat\'};\r\n'
        '}\r\n'
        '\r\n'
        'function drawRidge(W,H){\r\n'
        '  const grid=buildGrid();\r\n'
        '  if(!grid.xs.length||!grid.ys.length) return null;\r\n'
        '  const pad=40;\r\n'
        '  const ox=W*0.18, oy=H*0.72;\r\n'
        '  const sx=((W-pad*2)/Math.max(grid.xs.length,1))*0.7;\r\n'
        '  const sy=((H-pad*2)/Math.max(grid.ys.length,1))*0.45;\r\n'
        '  const hz=H*0.40*(cfg.height_scale||1);\r\n'
        '\r\n'
        '  ctx.save();\r\n'
        '  ctx.translate(panX,panY); ctx.scale(zoom,zoom);\r\n'
        '\r\n'
        '  for(let yi=0; yi<grid.ys.length; yi++){\r\n'
        '    for(let xi=0; xi<grid.xs.length; xi++){\r\n'
        '      const x=grid.xs[xi], y=grid.ys[yi];\r\n'
        '      const rec=grid.map.get(cellKey(x,y));\r\n'
        '      const h=rec?num(rec.height,0):0;\r\n'
        '      const elev=((h-grid.minH)/((grid.maxH-grid.minH)||1))*hz;\r\n'
        '      const px=ox+xi*sx - yi*sx*0.45;\r\n'
        '      const py=oy+yi*sy - elev;\r\n'
        '      const w=sx*0.85, d=sy*0.7;\r\n'
        '      ctx.globalAlpha = (selectedKey && selectedKey!==cellKey(x,y)) ? 0.3 : 0.95;\r\n'
        '      ctx.fillStyle=rec?cellFill(rec,grid.minH,grid.maxH):\'#334155\';\r\n'
        '      ctx.beginPath();\r\n'
        '      ctx.moveTo(px,py); ctx.lineTo(px+w,py); ctx.lineTo(px+w*0.55,py-d); ctx.lineTo(px-w*0.35,py-d);\r\n'
        '      ctx.closePath(); ctx.fill();\r\n'
        '      ctx.fillStyle=\'rgba(0,0,0,.22)\';\r\n'
        '      ctx.beginPath();\r\n'
        '      ctx.moveTo(px,py); ctx.lineTo(px+w,py); ctx.lineTo(px+w,py+Math.max(6,elev*0.2)); ctx.lineTo(px,py+Math.max(6,elev*0.2));\r\n'
        '      ctx.closePath(); ctx.fill();\r\n'
        '      ctx.globalAlpha=1;\r\n'
        '    }\r\n'
        '  }\r\n'
        '  drawMarkers(grid, {padL:ox,padT:oy,cw:sx,ch:sy,ridge:true,hz,minH:grid.minH,maxH:grid.maxH}, true, null);\r\n'
        '  ctx.restore();\r\n'
        '  return {grid,mode:\'ridge\',L:{padL:ox,padT:oy,cw:sx,ch:sy,hz,minH:grid.minH,maxH:grid.maxH}};\r\n'
        '}\r\n'
        '\r\n'
        'function projectIso(xi, yi, h, layout){\r\n'
        '  const elev=((h-layout.minH)/((layout.maxH-layout.minH)||1))*layout.baseElev*layout.elevMul*(cfg.height_scale||1);\r\n'
        '  const sx=layout.originX + (xi - yi*layout.xSkew)*layout.cellW;\r\n'
        '  const sy=layout.originY + (xi + yi)*layout.cellH - elev;\r\n'
        '  return {x:sx, y:sy, elev};\r\n'
        '}\r\n'
        '\r\n'
        'function drawSurface(W,H){\r\n'
        '  const grid=buildGrid();\r\n'
        '  if(!grid.xs.length||!grid.ys.length) return null;\r\n'
        '  const mesh=buildDense(grid);\r\n'
        '  const cam=cameraFactors();\r\n'
        '  const nX=mesh.denseCols, nY=mesh.denseRows;\r\n'
        '  const span=Math.max(nX,nY,1);\r\n'
        '  const cellW=Math.min((W*0.72)/span, (H*0.55)/span);\r\n'
        '  const cellH=cellW*cam.yDepth;\r\n'
        '  const baseElev=H*0.40;\r\n'
        '  const originX=W*0.5 - ((nX-1)-(nY-1)*cam.xSkew)*cellW*0.5;\r\n'
        '  const originY=H*0.62;\r\n'
        '  const layout={originX,originY,cellW,cellH,baseElev,elevMul:cam.elevMul,xSkew:cam.xSkew,minH:grid.minH,maxH:grid.maxH,nX,nY,mesh};\r\n'
        '\r\n'
        '  ctx.save();\r\n'
        '  ctx.translate(panX,panY); ctx.scale(zoom,zoom);\r\n'
        '\r\n'
        '  // ground shadow plate\r\n'
        '  ctx.fillStyle=\'rgba(15,23,42,.55)\';\r\n'
        '  const g0=projectIso(0,0,grid.minH,layout);\r\n'
        '  const g1=projectIso(nX-1,0,grid.minH,layout);\r\n'
        '  const g2=projectIso(nX-1,nY-1,grid.minH,layout);\r\n'
        '  const g3=projectIso(0,nY-1,grid.minH,layout);\r\n'
        '  ctx.beginPath();\r\n'
        '  ctx.moveTo(g0.x,g0.y+8); ctx.lineTo(g1.x,g1.y+8); ctx.lineTo(g2.x,g2.y+8); ctx.lineTo(g3.x,g3.y+8);\r\n'
        '  ctx.closePath(); ctx.fill();\r\n'
        '\r\n'
        '  const faces=[];\r\n'
        '  for(let yi=0;yi<nY-1;yi++){\r\n'
        '    for(let xi=0;xi<nX-1;xi++){\r\n'
        '      const h00=mesh.dense[yi][xi], h10=mesh.dense[yi][xi+1];\r\n'
        '      const h01=mesh.dense[yi+1][xi], h11=mesh.dense[yi+1][xi+1];\r\n'
        '      if(h00==null||h10==null||h01==null||h11==null) continue;\r\n'
        '      const p00=projectIso(xi,yi,h00,layout);\r\n'
        '      const p10=projectIso(xi+1,yi,h10,layout);\r\n'
        '      const p01=projectIso(xi,yi+1,h01,layout);\r\n'
        '      const p11=projectIso(xi+1,yi+1,h11,layout);\r\n'
        '      const avgH=(h00+h10+h01+h11)/4;\r\n'
        '      const depth=xi+yi;\r\n'
        '      faces.push({depth, avgH, p00,p10,p01,p11, xi, yi});\r\n'
        '    }\r\n'
        '  }\r\n'
        '  faces.sort((a,b)=>a.depth-b.depth || a.avgH-b.avgH);\r\n'
        '\r\n'
        '  faces.forEach(f=>{\r\n'
        '    const top=heightNormColor(f.avgH, grid.minH, grid.maxH);\r\n'
        '    const side=darkenRgb(top, 0.55);\r\n'
        '    const front=darkenRgb(top, 0.72);\r\n'
        '    // left/back side strip (toward +y)\r\n'
        '    ctx.fillStyle=side;\r\n'
        '    ctx.beginPath();\r\n'
        '    ctx.moveTo(f.p01.x,f.p01.y); ctx.lineTo(f.p11.x,f.p11.y);\r\n'
        '    ctx.lineTo(f.p11.x,f.p11.y+Math.max(2,f.p11.elev*0.08));\r\n'
        '    ctx.lineTo(f.p01.x,f.p01.y+Math.max(2,f.p01.elev*0.08));\r\n'
        '    ctx.closePath(); ctx.fill();\r\n'
        '    // right/front strip (toward +x)\r\n'
        '    ctx.fillStyle=front;\r\n'
        '    ctx.beginPath();\r\n'
        '    ctx.moveTo(f.p10.x,f.p10.y); ctx.lineTo(f.p11.x,f.p11.y);\r\n'
        '    ctx.lineTo(f.p11.x,f.p11.y+Math.max(2,f.p11.elev*0.08));\r\n'
        '    ctx.lineTo(f.p10.x,f.p10.y+Math.max(2,f.p10.elev*0.08));\r\n'
        '    ctx.closePath(); ctx.fill();\r\n'
        '    // top face\r\n'
        '    ctx.fillStyle=top;\r\n'
        '    ctx.beginPath();\r\n'
        '    ctx.moveTo(f.p00.x,f.p00.y); ctx.lineTo(f.p10.x,f.p10.y);\r\n'
        '    ctx.lineTo(f.p11.x,f.p11.y); ctx.lineTo(f.p01.x,f.p01.y);\r\n'
        '    ctx.closePath(); ctx.fill();\r\n'
        '    if(hoverKey && String(hoverKey)===cellKey(grid.xs[Math.min(Math.round(f.xi*grid.xs.length/Math.max(nX,1)),grid.xs.length-1)], grid.ys[Math.min(Math.round(f.yi*grid.ys.length/Math.max(nY,1)),grid.ys.length-1)])){\r\n'
        '      ctx.strokeStyle=\'rgba(248,250,252,.7)\'; ctx.lineWidth=1;\r\n'
        '      ctx.stroke();\r\n'
        '    }\r\n'
        '  });\r\n'
        '\r\n'
        '  // axis labels (sparse)\r\n'
        '  ctx.fillStyle=\'#94a3b8\'; ctx.font=\'10px system-ui,sans-serif\';\r\n'
        '  grid.xs.forEach((x,xi)=>{\r\n'
        '    const fx=nX<=1?0:(xi/(grid.xs.length-1||1))*(nX-1);\r\n'
        '    const p=projectIso(fx, nY-1, grid.minH, layout);\r\n'
        '    ctx.textAlign=\'center\';\r\n'
        '    ctx.fillText(String(x).slice(0,10), p.x, p.y+18);\r\n'
        '  });\r\n'
        '  grid.ys.forEach((y,yi)=>{\r\n'
        '    const fy=nY<=1?0:(yi/(grid.ys.length-1||1))*(nY-1);\r\n'
        '    const p=projectIso(0, fy, grid.minH, layout);\r\n'
        '    ctx.textAlign=\'right\';\r\n'
        '    ctx.fillText(String(y).slice(0,12), p.x-8, p.y+4);\r\n'
        '  });\r\n'
        '\r\n'
        '  drawMarkers(grid, layout, false, mesh);\r\n'
        '  ctx.restore();\r\n'
        '  return {grid,L:layout,mode:\'surface\',mesh};\r\n'
        '}\r\n'
        '\r\n'
        'function sparseToDenseCoord(si, sparseCount, denseCount){\r\n'
        '  if(sparseCount<=1) return 0;\r\n'
        '  return (si/(sparseCount-1))*(denseCount-1);\r\n'
        '}\r\n'
        '\r\n'
        'function drawMarkers(grid, L, ridge, mesh){\r\n'
        '  const mark=(list, color, prefix)=>{\r\n'
        '    list.forEach((p,i)=>{\r\n'
        '      const xi=grid.xs.indexOf(String(p.x)), yi=grid.ys.indexOf(String(p.y));\r\n'
        '      if(xi<0||yi<0) return;\r\n'
        '      let px, py;\r\n'
        '      if(ridge){\r\n'
        '        const elev=((num(p.height,0)-L.minH)/((L.maxH-L.minH)||1))*L.hz;\r\n'
        '        px=L.padL+xi*L.cw - yi*L.cw*0.45 + L.cw*0.3;\r\n'
        '        py=L.padT+yi*L.ch - elev - 10;\r\n'
        '      } else if(mesh && L.baseElev!=null){\r\n'
        '        const dx=sparseToDenseCoord(xi, grid.xs.length, mesh.denseCols);\r\n'
        '        const dy=sparseToDenseCoord(yi, grid.ys.length, mesh.denseRows);\r\n'
        '        const h=num(p.height,0);\r\n'
        '        const pt=projectIso(dx, dy, h, L);\r\n'
        '        px=pt.x; py=pt.y-10;\r\n'
        '      } else {\r\n'
        '        px=L.padL+xi*L.cw+L.cw/2;\r\n'
        '        py=L.padT+yi*L.ch+L.ch/2;\r\n'
        '      }\r\n'
        '      const r=7/Math.max(zoom,0.6);\r\n'
        '      ctx.fillStyle=\'rgba(15,23,42,.75)\';\r\n'
        '      ctx.beginPath(); ctx.arc(px,py,r+2,0,Math.PI*2); ctx.fill();\r\n'
        '      ctx.fillStyle=color;\r\n'
        '      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();\r\n'
        '      ctx.strokeStyle=\'#0a1628\'; ctx.lineWidth=2/Math.max(zoom,0.6);\r\n'
        '      ctx.fillStyle=\'#f8fafc\';\r\n'
        '      ctx.font=`bold ${11/Math.max(zoom,0.7)}px system-ui`;\r\n'
        '      ctx.textAlign=\'left\';\r\n'
        '      ctx.strokeText(prefix+(i+1), px+r+3, py+4);\r\n'
        '      ctx.fillText(prefix+(i+1), px+r+3, py+4);\r\n'
        '    });\r\n'
        '  };\r\n'
        '  if(showPeaks) mark(peaks, \'#f97316\', \'P\');\r\n'
        '  if(showValleys) mark(valleys, \'#38bdf8\', \'V\');\r\n'
        '  if(showEvents){\r\n'
        '    callouts.forEach(c=>{\r\n'
        '      const xi=grid.xs.indexOf(String(c.x)), yi=grid.ys.indexOf(String(c.y));\r\n'
        '      if(xi<0||yi<0) return;\r\n'
        '      let px, py;\r\n'
        '      if(ridge){\r\n'
        '        px=L.padL+xi*L.cw - yi*L.cw*0.45 + L.cw*0.3;\r\n'
        '        py=L.padT+yi*L.ch - 18;\r\n'
        '      } else if(mesh && L.baseElev!=null){\r\n'
        '        const dx=sparseToDenseCoord(xi, grid.xs.length, mesh.denseCols);\r\n'
        '        const dy=sparseToDenseCoord(yi, grid.ys.length, mesh.denseRows);\r\n'
        '        const h=grid.map.get(cellKey(c.x,c.y));\r\n'
        '        const pt=projectIso(dx, dy, h?num(h.height,0):grid.minH, L);\r\n'
        '        px=pt.x; py=pt.y-14;\r\n'
        '      } else {\r\n'
        '        px=L.padL+xi*L.cw+L.cw/2;\r\n'
        '        py=L.padT+yi*L.ch+8;\r\n'
        '      }\r\n'
        '      ctx.fillStyle=\'#f472b6\';\r\n'
        '      ctx.beginPath();\r\n'
        '      ctx.moveTo(px,py); ctx.lineTo(px-5,py-10); ctx.lineTo(px+5,py-10); ctx.closePath();\r\n'
        '      ctx.fill();\r\n'
        '    });\r\n'
        '  }\r\n'
        '}\r\n'
        '\r\n'
        'let lastLayout=null;\r\n'
        'function draw(){\r\n'
        '  const wrap=canvas.parentElement;\r\n'
        '  const W=wrap.clientWidth||640, H=wrap.clientHeight||540;\r\n'
        '  const dpr=window.devicePixelRatio||1;\r\n'
        '  if(canvas.width!==W*dpr || canvas.height!==H*dpr){\r\n'
        '    canvas.width=W*dpr; canvas.height=H*dpr;\r\n'
        '    canvas.style.width=W+\'px\'; canvas.style.height=H+\'px\';\r\n'
        '  }\r\n'
        '  ctx.setTransform(dpr,0,0,dpr,0,0);\r\n'
        '  ctx.clearRect(0,0,W,H);\r\n'
        '  const mode=(cfg.terrain_mode||\'surface\').toLowerCase();\r\n'
        '  if(mode===\'ridge\') lastLayout = drawRidge(W,H);\r\n'
        '  else if(mode===\'heat_surface\') lastLayout = drawHeat(W,H);\r\n'
        '  else lastLayout = drawSurface(W,H);\r\n'
        '  requestAnimationFrame(draw);\r\n'
        '}\r\n'
        '\r\n'
        'function hitCell(sx,sy){\r\n'
        '  if(!lastLayout || !lastLayout.grid) return null;\r\n'
        '  const grid=lastLayout.grid;\r\n'
        '  const p={x:(sx-panX)/zoom, y:(sy-panY)/zoom};\r\n'
        '  if(lastLayout.mode===\'heat\'){\r\n'
        '    const L=lastLayout.L;\r\n'
        '    const xi=Math.floor((p.x-L.padL)/L.cw);\r\n'
        '    const yi=Math.floor((p.y-L.padT)/L.ch);\r\n'
        '    if(xi<0||yi<0||xi>=grid.xs.length||yi>=grid.ys.length) return null;\r\n'
        '    return grid.map.get(cellKey(grid.xs[xi], grid.ys[yi])) || null;\r\n'
        '  }\r\n'
        '  // surface / ridge: nearest sparse cell by projected ground distance\r\n'
        '  const L=lastLayout.L;\r\n'
        '  if(!L) return null;\r\n'
        '  let best=null, bestD=Infinity;\r\n'
        '  for(let yi=0;yi<grid.ys.length;yi++){\r\n'
        '    for(let xi=0;xi<grid.xs.length;xi++){\r\n'
        '      const rec=grid.map.get(cellKey(grid.xs[xi],grid.ys[yi]));\r\n'
        '      if(!rec) continue;\r\n'
        '      let cx, cy;\r\n'
        '      if(lastLayout.mode===\'surface\' && lastLayout.mesh){\r\n'
        '        const dx=sparseToDenseCoord(xi, grid.xs.length, lastLayout.mesh.denseCols);\r\n'
        '        const dy=sparseToDenseCoord(yi, grid.ys.length, lastLayout.mesh.denseRows);\r\n'
        '        const pt=projectIso(dx, dy, num(rec.height,0), L);\r\n'
        '        cx=pt.x; cy=pt.y;\r\n'
        '      } else if(lastLayout.mode===\'ridge\'){\r\n'
        '        const elev=((num(rec.height,0)-L.minH)/((L.maxH-L.minH)||1))*L.hz;\r\n'
        '        cx=L.padL+xi*L.cw - yi*L.cw*0.45 + L.cw*0.3;\r\n'
        '        cy=L.padT+yi*L.ch - elev;\r\n'
        '      } else continue;\r\n'
        '      const d=(cx-p.x)*(cx-p.x)+(cy-p.y)*(cy-p.y);\r\n'
        '      if(d<bestD){ bestD=d; best=rec; }\r\n'
        '    }\r\n'
        '  }\r\n'
        '  return bestD<2200 ? best : null;\r\n'
        '}\r\n'
        '\r\n'
        'function showTip(html,sx,sy){\r\n'
        '  tip.innerHTML=html; tip.style.display=\'block\';\r\n'
        '  const wrap=canvas.parentElement.getBoundingClientRect();\r\n'
        '  tip.style.left=Math.min(sx+12, wrap.width-240)+\'px\';\r\n'
        '  tip.style.top=Math.min(sy+12, wrap.height-90)+\'px\';\r\n'
        '}\r\n'
        'function hideTip(){ tip.style.display=\'none\'; }\r\n'
        '\r\n'
        'canvas.addEventListener(\'pointerdown\', (ev)=>{\r\n'
        '  dragging=true; didDrag=false;\r\n'
        '  dragStartX=ev.clientX; dragStartY=ev.clientY;\r\n'
        '  panStartX=panX; panStartY=panY;\r\n'
        '  canvas.setPointerCapture(ev.pointerId);\r\n'
        '});\r\n'
        'canvas.addEventListener(\'pointermove\', (ev)=>{\r\n'
        '  const rect=canvas.getBoundingClientRect();\r\n'
        '  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;\r\n'
        '  if(dragging){\r\n'
        '    const dx=ev.clientX-dragStartX, dy=ev.clientY-dragStartY;\r\n'
        '    if(Math.hypot(dx,dy)>3) didDrag=true;\r\n'
        '    panX=panStartX+dx; panY=panStartY+dy;\r\n'
        '    hideTip(); return;\r\n'
        '  }\r\n'
        '  const rec=hitCell(sx,sy);\r\n'
        '  hoverKey=rec?cellKey(rec.x,rec.y):null;\r\n'
        '  if(rec){\r\n'
        '    showTip(`<strong>${esc(rec.x)} × ${esc(rec.y)}</strong><br/>Height: ${num(rec.height,0)}`\r\n'
        '      +(rec.risk_score!=null?`<br/>Risk: ${num(rec.risk_score,0)}`:\'\')\r\n'
        '      +(rec.target_value!=null?`<br/>Target: ${num(rec.target_value,0)}`:\'\')\r\n'
        '      +(rec.baseline_value!=null?`<br/>Baseline: ${num(rec.baseline_value,0)}`:\'\')\r\n'
        '      +(rec.forecast_value!=null?`<br/>Forecast: ${num(rec.forecast_value,0)}`:\'\')\r\n'
        '      +(rec.volume_value!=null?`<br/>Volume: ${num(rec.volume_value,0)}`:\'\')\r\n'
        '      +(rec.variance!=null?`<br/>Variance: ${Math.round(num(rec.variance,0)*10)/10}`:\'\')\r\n'
        '      +(rec.status?`<br/>Status: ${esc(rec.status)}`:\'\')\r\n'
        '      +(rec.category?`<br/>Category: ${esc(rec.category)}`:\'\'), sx, sy);\r\n'
        '  } else hideTip();\r\n'
        '});\r\n'
        'canvas.addEventListener(\'pointerup\', (ev)=>{\r\n'
        '  dragging=false;\r\n'
        '  if(!didDrag){\r\n'
        '    const rect=canvas.getBoundingClientRect();\r\n'
        '    const rec=hitCell(ev.clientX-rect.left, ev.clientY-rect.top);\r\n'
        '    const key=rec?cellKey(rec.x,rec.y):null;\r\n'
        '    selectedKey = key && selectedKey===key ? null : key;\r\n'
        '  }\r\n'
        '});\r\n'
        'canvas.addEventListener(\'pointerleave\', ()=>{ hoverKey=null; hideTip(); });\r\n'
        'canvas.addEventListener(\'wheel\', (ev)=>{\r\n'
        '  ev.preventDefault();\r\n'
        '  const rect=canvas.getBoundingClientRect();\r\n'
        '  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;\r\n'
        '  const before={x:(sx-panX)/zoom, y:(sy-panY)/zoom};\r\n'
        '  zoom=Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom*(ev.deltaY>0?0.92:1.08)));\r\n'
        '  panX=sx-before.x*zoom; panY=sy-before.y*zoom;\r\n'
        '}, {passive:false});\r\n'
        'canvas.addEventListener(\'dblclick\', ()=>{ panX=0; panY=0; zoom=1; selectedKey=null; });\r\n'
        '\r\n'
        'document.getElementById(\'togPeaks\').onclick=function(){ showPeaks=!showPeaks; this.classList.toggle(\'off\', !showPeaks); this.setAttribute(\'aria-pressed\', String(showPeaks)); };\r\n'
        'document.getElementById(\'togValleys\').onclick=function(){ showValleys=!showValleys; this.classList.toggle(\'off\', !showValleys); this.setAttribute(\'aria-pressed\', String(showValleys)); };\r\n'
        'document.getElementById(\'togEvents\').onclick=function(){ showEvents=!showEvents; this.classList.toggle(\'off\', !showEvents); this.setAttribute(\'aria-pressed\', String(showEvents)); };\r\n'
        'if(!showPeaks) document.getElementById(\'togPeaks\').classList.add(\'off\');\r\n'
        'if(!showValleys) document.getElementById(\'togValleys\').classList.add(\'off\');\r\n'
        '\r\n'
        'function esc(s){ return String(s).replace(/[&<>"\']/g, c=>({ \'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\' }[c])); }\r\n'
        '\r\n'
        '\n'
        'let keyboardCellIndex = -1;\n'
        'function sortedCells(){ return records.filter(r=>r && r.x!=null && r.y!=null).slice().sort((a,b)=>String(a.x).localeCompare(String(b.x))||String(a.y).localeCompare(String(b.y))); }\n'
        'function announceCell(index){\n'
        '  const cells=sortedCells();\n'
        '  if(index<0||index>=cells.length){ keyboardCellIndex=-1; selectedKey=null; hoverKey=null; announce.textContent=\'Terrain cell selection cleared.\'; hideTip(); draw(); return; }\n'
        '  keyboardCellIndex=index;\n'
        '  const record=cells[index];\n'
        '  selectedKey=cellKey(record.x,record.y); hoverKey=selectedKey;\n'
        '  const details=[\'Cell \'+String(record.x)+\' by \'+String(record.y),\'Height \'+num(record.height,0)];\n'
        '  if(record.category!=null) details.push(\'Category \'+String(record.category));\n'
        '  if(record.risk_score!=null) details.push(\'Risk \'+num(record.risk_score,0));\n'
        '  if(record.variance!=null) details.push(\'Variance \'+num(record.variance,0));\n'
        '  announce.textContent=\'Cell \'+(index+1)+\' of \'+cells.length+\'. \'+details.join(\'. \');\n'
        '  draw();\n'
        '}\n'
        'canvas.addEventListener(\'keydown\', ev=>{\n'
        '  const cells=sortedCells(); if(!cells.length) return;\n'
        '  let next=keyboardCellIndex;\n'
        '  if(ev.key===\'ArrowRight\'||ev.key===\'ArrowDown\') next=(next+1)%cells.length;\n'
        '  else if(ev.key===\'ArrowLeft\'||ev.key===\'ArrowUp\') next=(next<=0?cells.length-1:next-1);\n'
        '  else if(ev.key===\'Home\') next=0;\n'
        '  else if(ev.key===\'End\') next=cells.length-1;\n'
        '  else if(ev.key===\'Escape\'){ ev.preventDefault(); announceCell(-1); return; }\n'
        '  else return;\n'
        '  ev.preventDefault(); announceCell(next);\n'
        '});\n'
        'requestAnimationFrame(draw);\n'
        '</script></body></html>\n'
    )
    vdab_productionterrain_html = vdab_productionterrain_html.replace('__TERRAIN_PAYLOAD__', json.dumps(vdab_productionterrain_payload, default=str, allow_nan=False).replace('<', '\\u003c'))
    components.html(vdab_productionterrain_html, height=580, scrolling=False)
