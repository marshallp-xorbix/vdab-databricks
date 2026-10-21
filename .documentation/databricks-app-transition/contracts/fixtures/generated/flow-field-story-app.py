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

st.set_page_config(page_title='Flow Field', layout='wide')
st.title('Flow Field')

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

_vdab_lbl_vdab_flowfieldstory1 = ui_overrides.get('labels', {}).get('flowFieldStory1', None)
_vdab_disp_lbl_vdab_flowfieldstory1 = _vdab_lbl_vdab_flowfieldstory1 if _vdab_lbl_vdab_flowfieldstory1 is not None else 'Flow Field Story'
st.subheader(_vdab_disp_lbl_vdab_flowfieldstory1)
try:
    vdab_flowfieldstory1_data = _vdab_sql_query_df('main', 'sales', 'flows', 500, query_statement='SELECT `source_stage` AS source_stage, `destination_stage` AS destination_stage, SUM(`flow_volume`) AS flow_volume, MAX(`stage_order`) AS stage_order, AVG(`conversion`) AS conversion_pct, SUM(`drop_count`) AS drop_off, AVG(`avg_time`) AS avg_time_in_stage, MAX(`status`) AS status FROM (SELECT * FROM `main`.`sales`.`flows` WHERE `event_time` = (SELECT MAX(`event_time`) FROM `main`.`sales`.`flows`)) GROUP BY `source_stage`, `destination_stage`')
except RuntimeError as vdab_error_vdab_flowfieldstory1:
    st.error(str(vdab_error_vdab_flowfieldstory1))
    vdab_flowfieldstory1_data = pd.DataFrame(columns=['source_stage', 'destination_stage', 'flow_volume', 'stage_order'])
if vdab_flowfieldstory1_data.empty or 'source_stage' not in vdab_flowfieldstory1_data.columns or 'destination_stage' not in vdab_flowfieldstory1_data.columns:
    st.info('No flow records returned. Check bindings and field mappings.')
else:
    vdab_flowfieldstory1_data = vdab_flowfieldstory1_data.copy()
    if 'flow_volume' in vdab_flowfieldstory1_data.columns:
        vdab_flowfieldstory1_data['flow_volume'] = pd.to_numeric(vdab_flowfieldstory1_data['flow_volume'], errors='coerce')
        vdab_flowfieldstory1_data['flow_volume'] = vdab_flowfieldstory1_data['flow_volume'].where(vdab_flowfieldstory1_data['flow_volume'].map(math.isfinite))
    if 'stage_order' in vdab_flowfieldstory1_data.columns:
        vdab_flowfieldstory1_data['stage_order'] = pd.to_numeric(vdab_flowfieldstory1_data['stage_order'], errors='coerce')
        vdab_flowfieldstory1_data['stage_order'] = vdab_flowfieldstory1_data['stage_order'].where(vdab_flowfieldstory1_data['stage_order'].map(math.isfinite))
    if 'conversion_pct' in vdab_flowfieldstory1_data.columns:
        vdab_flowfieldstory1_data['conversion_pct'] = pd.to_numeric(vdab_flowfieldstory1_data['conversion_pct'], errors='coerce')
        vdab_flowfieldstory1_data['conversion_pct'] = vdab_flowfieldstory1_data['conversion_pct'].where(vdab_flowfieldstory1_data['conversion_pct'].map(math.isfinite))
    if 'drop_off' in vdab_flowfieldstory1_data.columns:
        vdab_flowfieldstory1_data['drop_off'] = pd.to_numeric(vdab_flowfieldstory1_data['drop_off'], errors='coerce')
        vdab_flowfieldstory1_data['drop_off'] = vdab_flowfieldstory1_data['drop_off'].where(vdab_flowfieldstory1_data['drop_off'].map(math.isfinite))
    if 'avg_time_in_stage' in vdab_flowfieldstory1_data.columns:
        vdab_flowfieldstory1_data['avg_time_in_stage'] = pd.to_numeric(vdab_flowfieldstory1_data['avg_time_in_stage'], errors='coerce')
        vdab_flowfieldstory1_data['avg_time_in_stage'] = vdab_flowfieldstory1_data['avg_time_in_stage'].where(vdab_flowfieldstory1_data['avg_time_in_stage'].map(math.isfinite))
    vdab_flowfieldstory1_data['source_stage'] = vdab_flowfieldstory1_data['source_stage'].fillna('').astype(str).str.strip()
    vdab_flowfieldstory1_data['destination_stage'] = vdab_flowfieldstory1_data['destination_stage'].fillna('').astype(str).str.strip()
    vdab_flowfieldstory1_data = vdab_flowfieldstory1_data[(vdab_flowfieldstory1_data['source_stage'] != '') & (vdab_flowfieldstory1_data['destination_stage'] != '')]
    vdab_flowfieldstory1_data = vdab_flowfieldstory1_data.dropna(subset=['source_stage', 'destination_stage'])
    vdab_flowfieldstory1_flows = []
    for _, _vdab_row in vdab_flowfieldstory1_data.iterrows():
        _vdab_source = str(_vdab_row.get('source_stage') or '').strip()
        _vdab_destination = str(_vdab_row.get('destination_stage') or '').strip()
        if not _vdab_source or not _vdab_destination:
            continue
        _vdab_volume = _vdab_row.get('flow_volume', 0)
        _vdab_order = _vdab_row.get('stage_order', 0)
        _vdab_flow = {
            'source': _vdab_source,
            'destination': _vdab_destination,
            'volume': 0.0 if pd.isna(_vdab_volume) else float(_vdab_volume),
            'stage_order': 0.0 if pd.isna(_vdab_order) else float(_vdab_order),
        }
        for _vdab_field in ('conversion_pct', 'drop_off', 'avg_time_in_stage'):
            if _vdab_field in vdab_flowfieldstory1_data.columns and not pd.isna(_vdab_row.get(_vdab_field)):
                _vdab_flow[_vdab_field] = float(_vdab_row.get(_vdab_field))
        if 'status' in vdab_flowfieldstory1_data.columns and not pd.isna(_vdab_row.get('status')) and str(_vdab_row.get('status')).strip():
            _vdab_flow['status'] = str(_vdab_row.get('status')).strip().lower()
        vdab_flowfieldstory1_flows.append(_vdab_flow)
    vdab_flowfieldstory1_order_by_stage = {}
    for _vdab_flow in vdab_flowfieldstory1_flows:
        _vdab_name = _vdab_flow['source']
        _vdab_order = _vdab_flow.get('stage_order', 0)
        if _vdab_name not in vdab_flowfieldstory1_order_by_stage or _vdab_order > vdab_flowfieldstory1_order_by_stage[_vdab_name]:
            vdab_flowfieldstory1_order_by_stage[_vdab_name] = _vdab_order
    vdab_flowfieldstory1_all_names = set(vdab_flowfieldstory1_order_by_stage.keys())
    for _vdab_flow in vdab_flowfieldstory1_flows:
        vdab_flowfieldstory1_all_names.add(_vdab_flow['destination'])
    vdab_flowfieldstory1_max_order = max(vdab_flowfieldstory1_order_by_stage.values()) if vdab_flowfieldstory1_order_by_stage else 0
    vdab_flowfieldstory1_stages = []
    for _vdab_name in vdab_flowfieldstory1_all_names:
        _vdab_order = vdab_flowfieldstory1_order_by_stage.get(_vdab_name)
        if _vdab_order is None:
            _vdab_order = vdab_flowfieldstory1_max_order + 1
        vdab_flowfieldstory1_stages.append({'name': _vdab_name, 'order': float(_vdab_order)})
    vdab_flowfieldstory1_stages = sorted(vdab_flowfieldstory1_stages, key=lambda _vdab_stage: (_vdab_stage['order'], _vdab_stage['name']))
    vdab_flowfieldstory1_with_drop = [_vdab_flow for _vdab_flow in vdab_flowfieldstory1_flows if 'drop_off' in _vdab_flow]
    vdab_flowfieldstory1_largest_drop = max(vdab_flowfieldstory1_with_drop, key=lambda _vdab_flow: _vdab_flow.get('drop_off', 0), default=None) if vdab_flowfieldstory1_with_drop else None
    vdab_flowfieldstory1_with_conversion = [_vdab_flow for _vdab_flow in vdab_flowfieldstory1_flows if 'conversion_pct' in _vdab_flow]
    vdab_flowfieldstory1_bottleneck = None
    if vdab_flowfieldstory1_with_conversion:
        vdab_flowfieldstory1_worst = min(vdab_flowfieldstory1_with_conversion, key=lambda _vdab_flow: _vdab_flow.get('conversion_pct', 100))
        vdab_flowfieldstory1_bottleneck = {'name': vdab_flowfieldstory1_worst['source'], 'reason': 'low_conversion'}
    elif vdab_flowfieldstory1_flows:
        vdab_flowfieldstory1_heaviest = max(vdab_flowfieldstory1_flows, key=lambda _vdab_flow: _vdab_flow.get('volume', 0))
        vdab_flowfieldstory1_bottleneck = {'name': vdab_flowfieldstory1_heaviest['source'], 'reason': 'high_volume'}
    vdab_flowfieldstory1_warnings = []
    if len(vdab_flowfieldstory1_flows) < 2:
        vdab_flowfieldstory1_warnings.append('Fewer than 2 flows — story may be less meaningful.')
    vdab_flowfieldstory1_payload = {
        'stages': vdab_flowfieldstory1_stages,
        'flows': vdab_flowfieldstory1_flows,
        'visualConfig': {
            'show_drop_offs': True,
            'show_labels': True,
        },
        'summary': {
            'stage_count': len(vdab_flowfieldstory1_stages),
            'flow_count': len(vdab_flowfieldstory1_flows),
            'total_volume': sum(_vdab_flow.get('volume', 0) for _vdab_flow in vdab_flowfieldstory1_flows),
            'largest_drop_off': ({'source': vdab_flowfieldstory1_largest_drop['source'], 'destination': vdab_flowfieldstory1_largest_drop['destination'], 'drop_off': vdab_flowfieldstory1_largest_drop['drop_off']} if vdab_flowfieldstory1_largest_drop else None),
            'bottleneck_stage': vdab_flowfieldstory1_bottleneck,
            'warnings': vdab_flowfieldstory1_warnings,
        },
    }
    vdab_flowfieldstory1_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"/>\n'
        '<style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35;}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}\n'
        '#warn{position:absolute;left:10px;bottom:8px;right:160px;z-index:3;font-size:10px;color:rgba(251,191,36,.85);pointer-events:none;}\n'
        '</style></head><body>\n'
        '<div id="wrap"><canvas id="c"></canvas><div id="tip"></div><div id="warn"></div><div id="hint">Hover streams for details</div></div>\n'
        '<script>\n'
        'const payload = __FLOW_FIELD_PAYLOAD__;\n'
        'const canvas = document.getElementById(\'c\');\n'
        'const tip = document.getElementById(\'tip\');\n'
        'const warn = document.getElementById(\'warn\');\n'
        'const ctx = canvas.getContext(\'2d\');\n'
        'const cfg = Object.assign({\n'
        '  show_drop_offs: true, show_labels: true\n'
        '}, (payload && payload.visualConfig) || {});\n'
        'const stages = Array.isArray(payload && payload.stages) ? payload.stages.slice() : [];\n'
        'const flows = Array.isArray(payload && payload.flows) ? payload.flows.slice() : [];\n'
        'const summary = (payload && payload.summary) || {};\n'
        'let hoverKey = null;\n'
        'const NODE_WIDTH = 88, NODE_GAP_Y = 16, MIN_NODE_HEIGHT = 40, COLUMN_INSET = 8;\n'
        '\n'
        'function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }\n'
        'function esc(s){ return String(s).replace(/[&<>"\']/g, c=>({ \'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\' }[c])); }\n'
        'function flowKey(f){ return String(f.source) + \'→\' + String(f.destination); }\n'
        'function resize(){\n'
        '  const r = canvas.parentElement.getBoundingClientRect();\n'
        '  const dpr = Math.max(1, window.devicePixelRatio || 1);\n'
        '  canvas.width = Math.max(1, Math.floor(r.width * dpr));\n'
        '  canvas.height = Math.max(1, Math.floor(r.height * dpr));\n'
        '  ctx.setTransform(dpr,0,0,dpr,0,0);\n'
        '  draw();\n'
        '}\n'
        'function pad(){ return { l: 36, r: 36, t: 24, b: 36 }; }\n'
        'function layout(){\n'
        '  const r = canvas.parentElement.getBoundingClientRect();\n'
        '  const p = pad();\n'
        '  return { w: r.width, h: r.height, p, iw: Math.max(1, r.width - p.l - p.r), ih: Math.max(1, r.height - p.t - p.b) };\n'
        '}\n'
        'function formatCompact(v){\n'
        '  const n = Number(v);\n'
        '  if(!Number.isFinite(n)) return \'\';\n'
        '  const a = Math.abs(n);\n'
        '  if(a >= 1e6) return (n / 1e6).toFixed(1) + \'M\';\n'
        '  if(a >= 1e3) return (n / 1e3).toFixed(1) + \'k\';\n'
        '  return Math.round(n).toString();\n'
        '}\n'
        'function statusColor(status){\n'
        '  const s = String(status || \'normal\').toLowerCase();\n'
        '  if(s === \'delayed\' || s === \'blocked\' || s === \'failed\') return \'rgba(248,113,113,.72)\';\n'
        '  return \'rgba(56,189,248,.72)\';\n'
        '}\n'
        'function roundRect(x,y,w,h,r){\n'
        '  const rr = Math.min(r, w/2, h/2);\n'
        '  ctx.moveTo(x+rr,y);\n'
        '  ctx.arcTo(x+w,y,x+w,y+h,rr);\n'
        '  ctx.arcTo(x+w,y+h,x,y+h,rr);\n'
        '  ctx.arcTo(x,y+h,x,y,rr);\n'
        '  ctx.arcTo(x,y,x+w,y,rr);\n'
        '  ctx.closePath();\n'
        '}\n'
        'function nodeVolume(name){\n'
        '  let incoming = 0, outgoing = 0;\n'
        '  flows.forEach(f => {\n'
        '    if(String(f.destination) === name) incoming += Math.max(0, num(f.volume, 0));\n'
        '    if(String(f.source) === name) outgoing += Math.max(0, num(f.volume, 0));\n'
        '  });\n'
        '  return Math.max(incoming, outgoing, 1);\n'
        '}\n'
        'function dropOffByStage(){\n'
        '  const totals = {};\n'
        '  flows.forEach(f => {\n'
        '    const drop = num(f.drop_off, 0);\n'
        '    if(drop > 0){\n'
        '      const s = String(f.source);\n'
        '      totals[s] = (totals[s] || 0) + drop;\n'
        '    }\n'
        '  });\n'
        '  return totals;\n'
        '}\n'
        'function drawRibbon(link){\n'
        '  const midX = (link.x0 + link.x1) / 2;\n'
        '  ctx.beginPath();\n'
        '  ctx.moveTo(link.x0, link.y0Top);\n'
        '  ctx.bezierCurveTo(midX, link.y0Top, midX, link.y1Top, link.x1, link.y1Top);\n'
        '  ctx.lineTo(link.x1, link.y1Bot);\n'
        '  ctx.bezierCurveTo(midX, link.y1Bot, midX, link.y0Bot, link.x0, link.y0Bot);\n'
        '  ctx.closePath();\n'
        '  ctx.fillStyle = link.key === hoverKey ? \'rgba(224,242,254,.85)\' : link.color;\n'
        '  ctx.fill();\n'
        '}\n'
        'function buildLayout(L){\n'
        '  const columns = [...new Set(stages.map(s => num(s.order, 0)))].sort((a,b) => a-b);\n'
        '  const columnCount = columns.length;\n'
        '  const columnWidth = columnCount <= 1 ? L.iw : L.iw / Math.max(1, columnCount - 1);\n'
        '  const nodes = {};\n'
        '  columns.forEach((order, columnIndex) => {\n'
        '    const columnStages = stages.filter(s => num(s.order, 0) === order)\n'
        '      .sort((a,b) => String(a.name).localeCompare(String(b.name)));\n'
        '    const volumes = columnStages.map(s => nodeVolume(String(s.name)));\n'
        '    const volumeSum = volumes.reduce((a,b) => a+b, 0) || 1;\n'
        '    const usableHeight = L.ih - NODE_GAP_Y * Math.max(0, columnStages.length - 1);\n'
        '    const x = columnCount <= 1 ? L.p.l + L.iw / 2 : L.p.l + columnIndex * columnWidth;\n'
        '    let cursorY = L.p.t;\n'
        '    columnStages.forEach((stage, index) => {\n'
        '      const weight = volumes[index] / volumeSum;\n'
        '      const nodeHeight = Math.max(MIN_NODE_HEIGHT, usableHeight * Math.max(0.18, weight));\n'
        '      nodes[String(stage.name)] = {\n'
        '        name: String(stage.name),\n'
        '        order: num(stage.order, 0),\n'
        '        x, y: cursorY + nodeHeight / 2,\n'
        '        width: NODE_WIDTH, height: nodeHeight\n'
        '      };\n'
        '      cursorY += nodeHeight + NODE_GAP_Y;\n'
        '    });\n'
        '  });\n'
        '\n'
        '  const orderedFlows = flows\n'
        '    .filter(f => nodes[String(f.source)] && nodes[String(f.destination)])\n'
        '    .slice()\n'
        '    .sort((a,b) => {\n'
        '      const d = (nodes[String(a.source)].order - nodes[String(b.source)].order);\n'
        '      if(d !== 0) return d;\n'
        '      return num(b.volume,0) - num(a.volume,0);\n'
        '    });\n'
        '\n'
        '  const outOffset = {}, inOffset = {}, outTotal = {}, inTotal = {};\n'
        '  orderedFlows.forEach(f => {\n'
        '    const s = String(f.source), d = String(f.destination);\n'
        '    outTotal[s] = (outTotal[s] || 0) + num(f.volume, 0);\n'
        '    inTotal[d] = (inTotal[d] || 0) + num(f.volume, 0);\n'
        '  });\n'
        '\n'
        '  const links = [];\n'
        '  orderedFlows.forEach(f => {\n'
        '    const source = nodes[String(f.source)];\n'
        '    const destination = nodes[String(f.destination)];\n'
        '    const vol = num(f.volume, 0);\n'
        '    const sourceSpan = Math.max(12, source.height - COLUMN_INSET * 2);\n'
        '    const destSpan = Math.max(12, destination.height - COLUMN_INSET * 2);\n'
        '    const sourceTop = source.y - sourceSpan / 2;\n'
        '    const destTop = destination.y - destSpan / 2;\n'
        '    const outUsed = outOffset[String(f.source)] || 0;\n'
        '    const inUsed = inOffset[String(f.destination)] || 0;\n'
        '    const outFrac = vol / (outTotal[String(f.source)] || vol || 1);\n'
        '    const inFrac = vol / (inTotal[String(f.destination)] || vol || 1);\n'
        '    const y0Top = sourceTop + outUsed * sourceSpan;\n'
        '    const y0Bot = y0Top + outFrac * sourceSpan;\n'
        '    const y1Top = destTop + inUsed * destSpan;\n'
        '    const y1Bot = y1Top + inFrac * destSpan;\n'
        '    outOffset[String(f.source)] = outUsed + outFrac;\n'
        '    inOffset[String(f.destination)] = inUsed + inFrac;\n'
        '    links.push({\n'
        '      flow: f, key: flowKey(f),\n'
        '      x0: source.x + source.width / 2, y0Top, y0Bot,\n'
        '      x1: destination.x - destination.width / 2, y1Top, y1Bot,\n'
        '      color: statusColor(f.status)\n'
        '    });\n'
        '  });\n'
        '  return { nodes, links };\n'
        '}\n'
        'function draw(){\n'
        '  const L = layout();\n'
        '  ctx.clearRect(0, 0, L.w, L.h);\n'
        '  ctx.fillStyle = \'#0b1220\';\n'
        '  ctx.fillRect(0, 0, L.w, L.h);\n'
        '  if(stages.length === 0){\n'
        '    ctx.fillStyle = \'rgba(148,163,184,.8)\';\n'
        '    ctx.textAlign = \'center\';\n'
        '    ctx.fillText(\'No data\', L.w / 2, L.h / 2);\n'
        '    return;\n'
        '  }\n'
        '  const { nodes, links } = buildLayout(L);\n'
        '  links.forEach(drawRibbon);\n'
        '\n'
        '  const dropOffs = dropOffByStage();\n'
        '  const bottleneckName = summary.bottleneck_stage && summary.bottleneck_stage.name;\n'
        '  Object.keys(nodes).forEach(name => {\n'
        '    const node = nodes[name];\n'
        '    const isBottleneck = String(bottleneckName) === name;\n'
        '    const left = node.x - node.width / 2;\n'
        '    const top = node.y - node.height / 2;\n'
        '    ctx.beginPath();\n'
        '    roundRect(left, top, node.width, node.height, 10);\n'
        '    ctx.fillStyle = isBottleneck ? \'rgba(251,191,36,.18)\' : \'rgba(15,23,42,.96)\';\n'
        '    ctx.fill();\n'
        '    ctx.lineWidth = isBottleneck ? 2 : 1.25;\n'
        '    ctx.strokeStyle = isBottleneck ? \'#fbbf24\' : \'rgba(148,163,184,.55)\';\n'
        '    ctx.stroke();\n'
        '    if(cfg.show_labels){\n'
        '      ctx.fillStyle = \'rgba(226,246,255,.95)\';\n'
        '      ctx.font = \'600 12px system-ui,sans-serif\';\n'
        '      ctx.textAlign = \'center\';\n'
        '      ctx.textBaseline = \'middle\';\n'
        '      ctx.fillText(name.slice(0, 14), node.x, node.y - 6);\n'
        '      ctx.fillStyle = \'rgba(148,163,184,.9)\';\n'
        '      ctx.font = \'10px system-ui,sans-serif\';\n'
        '      ctx.fillText(formatCompact(nodeVolume(name)), node.x, node.y + 10);\n'
        '    }\n'
        '    if(cfg.show_drop_offs && (dropOffs[name] || 0) > 0){\n'
        '      ctx.fillStyle = \'rgba(248,113,113,.9)\';\n'
        '      ctx.font = \'9px system-ui,sans-serif\';\n'
        '      ctx.textAlign = \'center\';\n'
        '      ctx.textBaseline = \'middle\';\n'
        '      ctx.fillText(\'↓ \' + formatCompact(dropOffs[name]), node.x, top + node.height + 14);\n'
        '    }\n'
        '  });\n'
        '\n'
        '  if(summary.largest_drop_off){\n'
        '    ctx.fillStyle = \'rgba(226,246,255,.45)\';\n'
        '    ctx.font = \'10px system-ui,sans-serif\';\n'
        '    ctx.textAlign = \'left\';\n'
        '    ctx.textBaseline = \'alphabetic\';\n'
        '    ctx.fillText(\n'
        '      \'Largest drop-off: \' + summary.largest_drop_off.source + \' → \' + summary.largest_drop_off.destination\n'
        '        + \' (\' + formatCompact(summary.largest_drop_off.drop_off) + \')\',\n'
        '      L.p.l, L.h - 10\n'
        '    );\n'
        '  }\n'
        '  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];\n'
        '  warn.textContent = warnings.length ? warnings[0] : \'\';\n'
        '}\n'
        'function ribbonEdgeY(y0, y1, t){\n'
        '  const mt = 1 - t;\n'
        '  return mt*mt*mt*y0 + 3*mt*mt*t*y0 + 3*mt*t*t*y1 + t*t*t*y1;\n'
        '}\n'
        'function linkContains(link, mx, my){\n'
        '  const minX = Math.min(link.x0, link.x1);\n'
        '  const maxX = Math.max(link.x0, link.x1);\n'
        '  if(mx < minX - 1 || mx > maxX + 1) return false;\n'
        '  const spanX = link.x1 - link.x0;\n'
        '  if(Math.abs(spanX) < 0.001) return false;\n'
        '  const t = Math.max(0, Math.min(1, (mx - link.x0) / spanX));\n'
        '  const yTop = ribbonEdgeY(link.y0Top, link.y1Top, t);\n'
        '  const yBot = ribbonEdgeY(link.y0Bot, link.y1Bot, t);\n'
        '  const lo = Math.min(yTop, yBot) - 1;\n'
        '  const hi = Math.max(yTop, yBot) + 1;\n'
        '  return my >= lo && my <= hi;\n'
        '}\n'
        'function hitLink(mx, my){\n'
        '  const L = layout();\n'
        '  const { links } = buildLayout(L);\n'
        '  let best = null, bestThickness = Infinity;\n'
        '  links.forEach(link => {\n'
        '    if(!linkContains(link, mx, my)) return;\n'
        '    const thickness = (Math.abs(link.y0Bot - link.y0Top) + Math.abs(link.y1Bot - link.y1Top)) / 2;\n'
        '    if(thickness <= bestThickness){ bestThickness = thickness; best = link; }\n'
        '  });\n'
        '  return best;\n'
        '}\n'
        'canvas.addEventListener(\'mousemove\', (e) => {\n'
        '  const rect = canvas.getBoundingClientRect();\n'
        '  const mx = e.clientX - rect.left;\n'
        '  const my = e.clientY - rect.top;\n'
        '  const link = hitLink(mx, my);\n'
        '  hoverKey = link ? link.key : null;\n'
        '  draw();\n'
        '  if(!link){ tip.style.display = \'none\'; return; }\n'
        '  const f = link.flow;\n'
        '  let html = \'<strong>\' + esc(f.source) + \' → \' + esc(f.destination) + \'</strong><br/>Volume: \' + formatCompact(f.volume);\n'
        '  if(f.conversion_pct != null) html += \'<br/>Conversion: \' + Number(f.conversion_pct).toFixed(1) + \'%\';\n'
        '  if(f.drop_off != null) html += \'<br/>Drop-off: \' + formatCompact(f.drop_off);\n'
        '  if(f.avg_time_in_stage != null) html += \'<br/>Avg time: \' + Number(f.avg_time_in_stage).toFixed(1);\n'
        '  if(f.status) html += \'<br/>Status: \' + esc(f.status);\n'
        '  tip.innerHTML = html;\n'
        '  tip.style.display = \'block\';\n'
        '  tip.style.left = Math.min(rect.width - 160, Math.max(8, mx + 12)) + \'px\';\n'
        '  tip.style.top = Math.max(8, my - 10) + \'px\';\n'
        '});\n'
        'canvas.addEventListener(\'mouseleave\', () => { hoverKey = null; tip.style.display = \'none\'; draw(); });\n'
        'window.addEventListener(\'resize\', resize);\n'
        'resize();\n'
        '</script></body></html>\n'
    )
    vdab_flowfieldstory1_html = vdab_flowfieldstory1_html.replace('__FLOW_FIELD_PAYLOAD__', json.dumps(vdab_flowfieldstory1_payload, default=str).replace('<', '\\u003c'))
    components.html(vdab_flowfieldstory1_html, height=520, scrolling=False)
