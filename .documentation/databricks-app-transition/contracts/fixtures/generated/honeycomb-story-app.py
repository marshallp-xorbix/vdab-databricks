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

st.set_page_config(page_title='Portfolio health', layout='wide')
st.title('Portfolio health')

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

_vdab_lbl_vdab_honeycombstory1 = ui_overrides.get('labels', {}).get('honeycombStory1', None)
_vdab_disp_lbl_vdab_honeycombstory1 = _vdab_lbl_vdab_honeycombstory1 if _vdab_lbl_vdab_honeycombstory1 is not None else 'Portfolio Health'
st.subheader(_vdab_disp_lbl_vdab_honeycombstory1)
try:
    vdab_honeycombstory1_data = _vdab_sql_query_df('main', 'sales', 'portfolio_items', 100, query_statement='SELECT `item_id` AS item_name, AVG(`impact`) AS impact_score, MAX(`priority`) AS priority_level, AVG(`progress`) AS progress_pct, MAX(`category`) AS category, MAX(`trend`) AS trend, AVG(`risk`) AS risk_score, MAX(`owner`) AS owner, MAX(`due_date`) AS due_date, SUM(`investment`) AS investment, SUM(`benefit`) AS benefit_value, MAX(`notes`) AS notes, MAX(`status`) AS status FROM (SELECT * FROM `main`.`sales`.`portfolio_items` WHERE `snapshot_date` = (SELECT MAX(`snapshot_date`) FROM `main`.`sales`.`portfolio_items`)) GROUP BY `item_id`')
except RuntimeError as vdab_error_vdab_honeycombstory1:
    st.error(str(vdab_error_vdab_honeycombstory1))
    vdab_honeycombstory1_data = pd.DataFrame(columns=['item_name', 'impact_score', 'progress_pct'])
if vdab_honeycombstory1_data.empty or 'item_name' not in vdab_honeycombstory1_data.columns:
    st.info('No HoneycombStory records returned. Check bindings and field mappings.')
else:
    vdab_honeycombstory1_data = vdab_honeycombstory1_data.copy()
    if 'impact_score' in vdab_honeycombstory1_data.columns:
        vdab_honeycombstory1_data['impact_score'] = pd.to_numeric(vdab_honeycombstory1_data['impact_score'], errors='coerce')
        vdab_honeycombstory1_data['impact_score'] = vdab_honeycombstory1_data['impact_score'].where(vdab_honeycombstory1_data['impact_score'].map(math.isfinite))
    if 'progress_pct' in vdab_honeycombstory1_data.columns:
        vdab_honeycombstory1_data['progress_pct'] = pd.to_numeric(vdab_honeycombstory1_data['progress_pct'], errors='coerce')
        vdab_honeycombstory1_data['progress_pct'] = vdab_honeycombstory1_data['progress_pct'].where(vdab_honeycombstory1_data['progress_pct'].map(math.isfinite))
    if 'risk_score' in vdab_honeycombstory1_data.columns:
        vdab_honeycombstory1_data['risk_score'] = pd.to_numeric(vdab_honeycombstory1_data['risk_score'], errors='coerce')
        vdab_honeycombstory1_data['risk_score'] = vdab_honeycombstory1_data['risk_score'].where(vdab_honeycombstory1_data['risk_score'].map(math.isfinite))
    if 'investment' in vdab_honeycombstory1_data.columns:
        vdab_honeycombstory1_data['investment'] = pd.to_numeric(vdab_honeycombstory1_data['investment'], errors='coerce')
        vdab_honeycombstory1_data['investment'] = vdab_honeycombstory1_data['investment'].where(vdab_honeycombstory1_data['investment'].map(math.isfinite))
    if 'benefit_value' in vdab_honeycombstory1_data.columns:
        vdab_honeycombstory1_data['benefit_value'] = pd.to_numeric(vdab_honeycombstory1_data['benefit_value'], errors='coerce')
        vdab_honeycombstory1_data['benefit_value'] = vdab_honeycombstory1_data['benefit_value'].where(vdab_honeycombstory1_data['benefit_value'].map(math.isfinite))
    vdab_honeycombstory1_data = vdab_honeycombstory1_data.dropna(subset=['item_name'])
    vdab_honeycombstory1_data['item_name'] = vdab_honeycombstory1_data['item_name'].astype(str).str.strip()
    vdab_honeycombstory1_data = vdab_honeycombstory1_data[vdab_honeycombstory1_data['item_name'] != '']
    vdab_honeycombstory1_data['impact_score'] = vdab_honeycombstory1_data['impact_score'].fillna(0)
    vdab_honeycombstory1_data['progress_pct'] = vdab_honeycombstory1_data['progress_pct'].fillna(0)
    vdab_honeycombstory1_df = vdab_honeycombstory1_data[vdab_honeycombstory1_data['item_name'] != '']
    vdab_honeycombstory1_records = []
    vdab_honeycombstory1_has_delivery_health = all(_field in vdab_honeycombstory1_df.columns for _field in ('progress_pct', 'due_date', 'status'))
    for _, _vdab_row in vdab_honeycombstory1_df.iterrows():
        _vdab_record = {
            'item_name': str(_vdab_row.get('item_name', '')).strip(),
            'impact_score': float(_vdab_row.get('impact_score') or 0),
            'priority_level': '' if pd.isna(_vdab_row.get('priority_level', '')) else str(_vdab_row.get('priority_level', '')).strip(),
            'progress_pct': float(_vdab_row.get('progress_pct') or 0),
            'category': '' if pd.isna(_vdab_row.get('category', '')) else str(_vdab_row.get('category', '')).strip(),
        }
        for _vdab_field in ('trend', 'owner', 'due_date', 'notes', 'status'):
            if _vdab_field in vdab_honeycombstory1_df.columns and not pd.isna(_vdab_row.get(_vdab_field)) and str(_vdab_row.get(_vdab_field)).strip():
                _vdab_record[_vdab_field] = str(_vdab_row.get(_vdab_field)).strip()
        for _vdab_field in ('risk_score', 'investment', 'benefit_value'):
            if _vdab_field in vdab_honeycombstory1_df.columns and not pd.isna(_vdab_row.get(_vdab_field)):
                _vdab_record[_vdab_field] = float(_vdab_row.get(_vdab_field))
        if vdab_honeycombstory1_has_delivery_health:
            _vdab_status = str(_vdab_record.get('status', '')).strip().lower()
            _vdab_progress = float(_vdab_record.get('progress_pct') or 0)
            _vdab_due = pd.to_datetime(_vdab_record.get('due_date'), errors='coerce', utc=True)
            _vdab_overdue = pd.notna(_vdab_due) and _vdab_due < pd.Timestamp.now(tz='UTC').normalize() and _vdab_progress < 100
            if _vdab_status in ('critical', 'blocked', 'failed') or (_vdab_overdue and _vdab_progress < 50):
                _vdab_record['delivery_health'] = 'behind'
            elif _vdab_status in ('at risk', 'at_risk', 'watch', 'delayed') or _vdab_overdue:
                _vdab_record['delivery_health'] = 'at_risk'
            else:
                _vdab_record['delivery_health'] = 'on_track'
        vdab_honeycombstory1_records.append(_vdab_record)
    vdab_honeycombstory1_categories = {record.get('category') for record in vdab_honeycombstory1_records if record.get('category')}
    vdab_honeycombstory1_average_progress = (sum(record.get('progress_pct', 0) for record in vdab_honeycombstory1_records) / len(vdab_honeycombstory1_records)) if vdab_honeycombstory1_records else 0
    vdab_honeycombstory1_high_impact_low_progress = [record for record in vdab_honeycombstory1_records if record.get('impact_score', 0) >= 70 and record.get('progress_pct', 0) < 40]
    vdab_honeycombstory1_with_risk = [record for record in vdab_honeycombstory1_records if 'risk_score' in record]
    vdab_honeycombstory1_highest_risk = max(vdab_honeycombstory1_with_risk, key=lambda record: record.get('risk_score', 0), default=None)
    vdab_honeycombstory1_health_counts = None
    if any('delivery_health' in record for record in vdab_honeycombstory1_records):
        vdab_honeycombstory1_health_counts = {'on_track': 0, 'at_risk': 0, 'behind': 0}
        for _vdab_record in vdab_honeycombstory1_records:
            _vdab_health = _vdab_record.get('delivery_health')
            if _vdab_health in vdab_honeycombstory1_health_counts:
                vdab_honeycombstory1_health_counts[_vdab_health] += 1
    vdab_honeycombstory1_warnings = ['Fewer than 3 items — honeycomb story may be less meaningful.'] if len(vdab_honeycombstory1_records) < 3 else []
    vdab_honeycombstory1_payload = {
        'records': vdab_honeycombstory1_records,
        'visualConfig': {
            'show_labels': True,
            'show_risk_borders': True,
            'show_trend_arrows': True,
        },
        'summary': {
            'item_count': len(vdab_honeycombstory1_records),
            'category_count': len(vdab_honeycombstory1_categories),
            'avg_progress': vdab_honeycombstory1_average_progress,
            'high_impact_low_progress': [{'item_name': record['item_name'], 'impact_score': record['impact_score'], 'progress_pct': record['progress_pct']} for record in vdab_honeycombstory1_high_impact_low_progress],
            'highest_risk': ({'item_name': vdab_honeycombstory1_highest_risk['item_name'], 'risk_score': vdab_honeycombstory1_highest_risk['risk_score']} if vdab_honeycombstory1_highest_risk else None),
            'delivery_health': vdab_honeycombstory1_health_counts,
            'warnings': vdab_honeycombstory1_warnings,
        },
    }
    vdab_honeycombstory1_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"/>\n'
        '<style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35;}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}\n'
        '#warn{position:absolute;left:10px;bottom:8px;right:180px;z-index:3;font-size:10px;color:rgba(251,191,36,.85);pointer-events:none;}\n'
        '</style></head><body>\n'
        '<div id="wrap"><canvas id="c"></canvas><div id="tip"></div><div id="warn"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset</div></div>\n'
        '<script>\n'
        'const payload = __HONEYCOMB_PAYLOAD__;\n'
        'const canvas = document.getElementById(\'c\');\n'
        'const tip = document.getElementById(\'tip\');\n'
        'const warn = document.getElementById(\'warn\');\n'
        'const ctx = canvas.getContext(\'2d\');\n'
        'const cfg = Object.assign({\n'
        '  show_labels: true, show_risk_borders: true, show_trend_arrows: true\n'
        '}, (payload && payload.visualConfig) || {});\n'
        'const records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];\n'
        'const summary = (payload && payload.summary) || {};\n'
        'let hoverKey = null;\n'
        'let panX = 0, panY = 0, zoom = 1;\n'
        'let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;\n'
        'const CAT_COLORS = [\'#2dd4bf\',\'#38bdf8\',\'#a78bfa\',\'#f472b6\',\'#fbbf24\',\'#34d399\',\'#fb7185\',\'#60a5fa\'];\n'
        'const RISK_THRESHOLD = 70;\n'
        'const MIN_ZOOM = 0.45, MAX_ZOOM = 2.5;\n'
        'const PREFERRED_RADIUS = 58;\n'
        'const CLUSTER_GAP = 40;\n'
        'const LABEL_GAP = 22;\n'
        'const HEX_STEP_X = 2.2;\n'
        'const HEX_STEP_Y = 1.95;\n'
        '\n'
        'function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }\n'
        'function esc(s){ return String(s).replace(/[&<>"\']/g, c=>({ \'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\' }[c])); }\n'
        'function dpr(){ return Math.max(1, window.devicePixelRatio || 1); }\n'
        'function layout(){\n'
        '  const r = canvas.parentElement.getBoundingClientRect();\n'
        '  return { w: r.width, h: r.height, p: { l: 24, r: 24, t: 20, b: 36 } };\n'
        '}\n'
        'function resize(){\n'
        '  const r = canvas.parentElement.getBoundingClientRect();\n'
        '  const scale = dpr();\n'
        '  canvas.width = Math.max(1, Math.floor(r.width * scale));\n'
        '  canvas.height = Math.max(1, Math.floor(r.height * scale));\n'
        '  ctx.setTransform(scale,0,0,scale,0,0);\n'
        '  draw();\n'
        '  return { W: r.width, H: r.height };\n'
        '}\n'
        'function screenToWorld(sx, sy){\n'
        '  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };\n'
        '}\n'
        'function pointerPos(e){\n'
        '  const rect = canvas.getBoundingClientRect();\n'
        '  return { x: e.clientX - rect.left, y: e.clientY - rect.top };\n'
        '}\n'
        'function hexPath(cx, cy, radius){\n'
        '  ctx.beginPath();\n'
        '  for(let i=0;i<6;i++){\n'
        '    const a = Math.PI/6 + i * Math.PI/3;\n'
        '    const x = cx + radius * Math.cos(a);\n'
        '    const y = cy + radius * Math.sin(a);\n'
        '    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);\n'
        '  }\n'
        '  ctx.closePath();\n'
        '}\n'
        'function pointInHex(mx, my, cx, cy, radius){\n'
        '  return Math.hypot(mx - cx, my - cy) <= radius * 0.92;\n'
        '}\n'
        'function priorityWeight(p){\n'
        '  const s = String(p || \'\').toLowerCase();\n'
        '  if(s === \'high\' || s === \'1\' || s === \'5\') return 2.5;\n'
        '  if(s === \'medium\' || s === \'med\' || s === \'2\' || s === \'3\' || s === \'4\') return 1.75;\n'
        '  return 1.25;\n'
        '}\n'
        'function hexToRgba(hex, a){\n'
        '  const h = String(hex || \'\').replace(\'#\',\'\');\n'
        '  if(h.length !== 6) return \'rgba(56,189,248,\' + a + \')\';\n'
        '  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);\n'
        '  return \'rgba(\' + r + \',\' + g + \',\' + b + \',\' + a + \')\';\n'
        '}\n'
        'function buildCells(){\n'
        '  const byCat = {};\n'
        '  records.forEach(r => {\n'
        '    const cat = String(r.category || \'Other\');\n'
        '    if(!byCat[cat]) byCat[cat] = [];\n'
        '    byCat[cat].push(r);\n'
        '  });\n'
        '  const categories = Object.keys(byCat).sort((a,b) => a.localeCompare(b));\n'
        '  categories.forEach(c => byCat[c].sort((a,b) => num(b.impact_score,0) - num(a.impact_score,0)));\n'
        '  const impacts = records.map(r => num(r.impact_score,0));\n'
        '  const minI = impacts.length ? Math.min(...impacts) : 0;\n'
        '  const maxI = impacts.length ? Math.max(...impacts) : 1;\n'
        '  const spanI = Math.max(1, maxI - minI);\n'
        '  const catCount = Math.max(1, categories.length);\n'
        '  const cols = catCount <= 1 ? 1 : (catCount <= 3 ? catCount : 2);\n'
        '  const rows = Math.ceil(catCount / cols);\n'
        '\n'
        '  // Build each cluster in local space with a readable hex size, then pack tightly.\n'
        '  const clusters = categories.map((cat, catIndex) => {\n'
        '    const items = byCat[cat];\n'
        '    const n = items.length;\n'
        '    const gridCols = Math.max(1, Math.ceil(Math.sqrt(n)));\n'
        '    const gridRows = Math.ceil(n / gridCols);\n'
        '    const baseR = Math.max(44, Math.min(PREFERRED_RADIUS, 68 - gridCols * 2));\n'
        '    const stepX = baseR * HEX_STEP_X;\n'
        '    const stepY = baseR * HEX_STEP_Y;\n'
        '    const locals = [];\n'
        '    items.forEach((rec, i) => {\n'
        '      const gx = i % gridCols;\n'
        '      const gy = Math.floor(i / gridCols);\n'
        '      const t = (num(rec.impact_score,0) - minI) / spanI;\n'
        '      const radius = baseR * (0.82 + 0.35 * t);\n'
        '      const cx = gx * stepX + (gy % 2 ? stepX * 0.5 : 0);\n'
        '      const cy = gy * stepY;\n'
        '      locals.push({ rec, cx, cy, radius });\n'
        '    });\n'
        '    const minX = Math.min(...locals.map(c => c.cx - c.radius));\n'
        '    const maxX = Math.max(...locals.map(c => c.cx + c.radius));\n'
        '    const minY = Math.min(...locals.map(c => c.cy - c.radius));\n'
        '    const maxY = Math.max(...locals.map(c => c.cy + c.radius));\n'
        '    return {\n'
        '      cat, catIndex, locals,\n'
        '      width: Math.max(120, maxX - minX),\n'
        '      height: Math.max(80, maxY - minY) + LABEL_GAP,\n'
        '      originX: minX,\n'
        '      originY: minY - LABEL_GAP\n'
        '    };\n'
        '  });\n'
        '\n'
        '  const colWidths = Array.from({ length: cols }, () => 0);\n'
        '  const rowHeights = Array.from({ length: rows }, () => 0);\n'
        '  clusters.forEach((cluster, i) => {\n'
        '    const col = i % cols;\n'
        '    const row = Math.floor(i / cols);\n'
        '    colWidths[col] = Math.max(colWidths[col], cluster.width);\n'
        '    rowHeights[row] = Math.max(rowHeights[row], cluster.height);\n'
        '  });\n'
        '  const boardW = colWidths.reduce((a,b) => a+b, 0) + CLUSTER_GAP * Math.max(0, cols - 1);\n'
        '  const boardH = rowHeights.reduce((a,b) => a+b, 0) + CLUSTER_GAP * Math.max(0, rows - 1);\n'
        '  const cells = [];\n'
        '  const labels = [];\n'
        '  clusters.forEach((cluster, i) => {\n'
        '    const col = i % cols;\n'
        '    const row = Math.floor(i / cols);\n'
        '    let ox = 0, oy = 0;\n'
        '    for(let c=0;c<col;c++) ox += colWidths[c] + CLUSTER_GAP;\n'
        '    for(let r=0;r<row;r++) oy += rowHeights[r] + CLUSTER_GAP;\n'
        '    ox += (colWidths[col] - cluster.width) / 2;\n'
        '    oy += (rowHeights[row] - cluster.height) / 2;\n'
        '    labels.push({\n'
        '      cat: cluster.cat,\n'
        '      catIndex: cluster.catIndex,\n'
        '      x: ox,\n'
        '      y: oy + 12\n'
        '    });\n'
        '    cluster.locals.forEach(local => {\n'
        '      cells.push({\n'
        '        key: String(local.rec.item_name),\n'
        '        rec: local.rec,\n'
        '        cat: cluster.cat,\n'
        '        catIndex: cluster.catIndex,\n'
        '        cx: ox + (local.cx - cluster.originX),\n'
        '        cy: oy + (local.cy - cluster.originY),\n'
        '        radius: local.radius,\n'
        '        color: CAT_COLORS[cluster.catIndex % CAT_COLORS.length]\n'
        '      });\n'
        '    });\n'
        '  });\n'
        '  return { cells, labels, boardW, boardH };\n'
        '}\n'
        'function wrapLabelLines(text, maxWidth, maxLines){\n'
        '  const words = String(text || \'\').trim().split(/\\s+/).filter(Boolean);\n'
        '  if(!words.length) return [];\n'
        '  const lines = [];\n'
        '  let current = words[0];\n'
        '  for(let i=1;i<words.length;i++){\n'
        '    const candidate = current + \' \' + words[i];\n'
        '    if(ctx.measureText(candidate).width <= maxWidth){\n'
        '      current = candidate;\n'
        '    } else {\n'
        '      lines.push(current);\n'
        '      current = words[i];\n'
        '      if(lines.length === maxLines - 1){\n'
        '        lines.push([current].concat(words.slice(i+1)).join(\' \'));\n'
        '        return lines;\n'
        '      }\n'
        '    }\n'
        '  }\n'
        '  lines.push(current);\n'
        '  return lines.slice(0, maxLines);\n'
        '}\n'
        'function fitHexName(name, maxWidth){\n'
        '  const maxFont = 12, minFont = 8;\n'
        '  for(let fontSize = maxFont; fontSize >= minFont; fontSize--){\n'
        '    ctx.font = \'600 \' + fontSize + \'px system-ui,sans-serif\';\n'
        '    if(ctx.measureText(name).width <= maxWidth){\n'
        '      return { lines: [name], fontSize };\n'
        '    }\n'
        '    const lines = wrapLabelLines(name, maxWidth, 2);\n'
        '    if(lines.length && lines.every(line => ctx.measureText(line).width <= maxWidth)){\n'
        '      return { lines, fontSize };\n'
        '    }\n'
        '  }\n'
        '  ctx.font = \'600 \' + minFont + \'px system-ui,sans-serif\';\n'
        '  let lines = wrapLabelLines(name, maxWidth, 2);\n'
        '  if(!lines.length) lines = [name];\n'
        '  lines = lines.map(line => {\n'
        '    if(ctx.measureText(line).width <= maxWidth) return line;\n'
        '    let trimmed = line;\n'
        '    while(trimmed.length > 1 && ctx.measureText(trimmed + \'…\').width > maxWidth){\n'
        '      trimmed = trimmed.slice(0, -1);\n'
        '    }\n'
        '    return trimmed + \'…\';\n'
        '  });\n'
        '  return { lines, fontSize: minFont };\n'
        '}\n'
        'function drawHex(cell, highlighted){\n'
        '  const rec = cell.rec;\n'
        '  const progress = Math.max(0, Math.min(100, num(rec.progress_pct, 0))) / 100;\n'
        '  hexPath(cell.cx, cell.cy, cell.radius);\n'
        '  ctx.fillStyle = \'rgba(15,23,42,.92)\';\n'
        '  ctx.fill();\n'
        '  ctx.save();\n'
        '  hexPath(cell.cx, cell.cy, cell.radius);\n'
        '  ctx.clip();\n'
        '  const top = cell.cy + cell.radius;\n'
        '  const fillH = cell.radius * 2 * progress;\n'
        '  ctx.fillStyle = highlighted ? \'rgba(224,242,254,.8)\' : hexToRgba(cell.color, 0.55);\n'
        '  ctx.fillRect(cell.cx - cell.radius, top - fillH, cell.radius * 2, fillH);\n'
        '  ctx.restore();\n'
        '  hexPath(cell.cx, cell.cy, cell.radius);\n'
        '  const risk = num(rec.risk_score, -1);\n'
        '  const highRisk = cfg.show_risk_borders && risk >= RISK_THRESHOLD;\n'
        '  ctx.lineWidth = highRisk ? 2.75 : priorityWeight(rec.priority_level);\n'
        '  ctx.strokeStyle = highRisk ? \'#f87171\' : (highlighted ? \'#e0f2fe\' : \'rgba(148,163,184,.65)\');\n'
        '  ctx.stroke();\n'
        '  if(cfg.show_labels){\n'
        '    const maxWidth = cell.radius * 1.45;\n'
        '    const name = String(rec.item_name || \'\');\n'
        '    const fitted = fitHexName(name, maxWidth);\n'
        '    const lineHeight = fitted.fontSize + 2;\n'
        '    const blockHeight = fitted.lines.length * lineHeight;\n'
        '    const nameTop = cell.cy - blockHeight / 2 - 4;\n'
        '    ctx.fillStyle = \'rgba(226,246,255,.95)\';\n'
        '    ctx.font = \'600 \' + fitted.fontSize + \'px system-ui,sans-serif\';\n'
        '    ctx.textAlign = \'center\';\n'
        '    ctx.textBaseline = \'top\';\n'
        '    fitted.lines.forEach((line, index) => {\n'
        '      ctx.fillText(line, cell.cx, nameTop + index * lineHeight);\n'
        '    });\n'
        '    ctx.fillStyle = \'rgba(148,163,184,.95)\';\n'
        '    ctx.font = \'10px system-ui,sans-serif\';\n'
        '    ctx.textBaseline = \'top\';\n'
        '    ctx.fillText(Math.round(num(rec.progress_pct,0)) + \'%\', cell.cx, nameTop + blockHeight + 2);\n'
        '  }\n'
        '  if(cfg.show_trend_arrows && rec.trend){\n'
        '    const t = String(rec.trend).toLowerCase();\n'
        '    let arrow = \'\';\n'
        '    if(t.indexOf(\'improv\') >= 0 || t === \'up\' || t === \'rising\') arrow = \'↑\';\n'
        '    else if(t.indexOf(\'declin\') >= 0 || t === \'down\' || t === \'falling\') arrow = \'↓\';\n'
        '    else if(t.indexOf(\'flat\') >= 0 || t === \'stable\') arrow = \'→\';\n'
        '    if(arrow){\n'
        '      ctx.fillStyle = arrow === \'↑\' ? \'#34d399\' : (arrow === \'↓\' ? \'#f87171\' : \'rgba(148,163,184,.9)\');\n'
        '      ctx.font = \'700 20px system-ui,sans-serif\';\n'
        '      ctx.textAlign = \'center\';\n'
        '      ctx.textBaseline = \'middle\';\n'
        '      ctx.fillText(arrow, cell.cx + cell.radius * 0.58, cell.cy - cell.radius * 0.62);\n'
        '    }\n'
        '  }\n'
        '}\n'
        'function draw(){\n'
        '  const L = layout();\n'
        '  ctx.setTransform(dpr(),0,0,dpr(),0,0);\n'
        '  ctx.clearRect(0, 0, L.w, L.h);\n'
        '  ctx.fillStyle = \'#0b1220\';\n'
        '  ctx.fillRect(0, 0, L.w, L.h);\n'
        '  if(records.length === 0){\n'
        '    ctx.fillStyle = \'rgba(148,163,184,.8)\';\n'
        '    ctx.textAlign = \'center\';\n'
        '    ctx.fillText(\'No data\', L.w / 2, L.h / 2);\n'
        '    return;\n'
        '  }\n'
        '  const scene = buildCells();\n'
        '  const originX = (L.w - scene.boardW) / 2;\n'
        '  const originY = (L.h - scene.boardH) / 2 - 4;\n'
        '\n'
        '  ctx.save();\n'
        '  ctx.translate(panX, panY);\n'
        '  ctx.scale(zoom, zoom);\n'
        '  ctx.translate(originX, originY);\n'
        '\n'
        '  scene.labels.forEach(label => {\n'
        '    ctx.fillStyle = hexToRgba(CAT_COLORS[label.catIndex % CAT_COLORS.length], 0.95);\n'
        '    ctx.font = \'600 12px system-ui,sans-serif\';\n'
        '    ctx.textAlign = \'left\';\n'
        '    ctx.textBaseline = \'alphabetic\';\n'
        '    ctx.fillText(label.cat, label.x, label.y);\n'
        '  });\n'
        '  scene.cells.forEach(cell => drawHex(cell, hoverKey === cell.key));\n'
        '  ctx.restore();\n'
        '\n'
        '  let footer = \'\';\n'
        '  const hilp = Array.isArray(summary.high_impact_low_progress) ? summary.high_impact_low_progress : [];\n'
        '  if(hilp.length){\n'
        '    footer = \'High impact / low progress: \' + hilp.map(x => x.item_name).slice(0,3).join(\', \');\n'
        '  } else if(summary.highest_risk){\n'
        '    footer = \'Highest risk: \' + summary.highest_risk.item_name + \' (\' + Math.round(num(summary.highest_risk.risk_score,0)) + \')\';\n'
        '  }\n'
        '  if(summary.delivery_health){\n'
        '    const dh = summary.delivery_health;\n'
        '    footer += (footer ? \' · \' : \'\') + \'Health: \' + (dh.on_track||0) + \' on track, \' + (dh.at_risk||0) + \' at risk, \' + (dh.behind||0) + \' behind\';\n'
        '  }\n'
        '  if(footer){\n'
        '    ctx.fillStyle = \'rgba(226,246,255,.45)\';\n'
        '    ctx.font = \'10px system-ui,sans-serif\';\n'
        '    ctx.textAlign = \'left\';\n'
        '    ctx.textBaseline = \'alphabetic\';\n'
        '    ctx.fillText(footer.slice(0, 140), L.p.l, L.h - 12);\n'
        '  }\n'
        '  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];\n'
        '  warn.textContent = warnings.length ? warnings[0] : \'\';\n'
        '}\n'
        'function hitCell(sx, sy){\n'
        '  const L = layout();\n'
        '  const scene = buildCells();\n'
        '  const originX = (L.w - scene.boardW) / 2;\n'
        '  const originY = (L.h - scene.boardH) / 2 - 4;\n'
        '  const world = screenToWorld(sx, sy);\n'
        '  const mx = world.x - originX;\n'
        '  const my = world.y - originY;\n'
        '  let best = null, bestDist = Infinity;\n'
        '  scene.cells.forEach(cell => {\n'
        '    if(!pointInHex(mx, my, cell.cx, cell.cy, cell.radius)) return;\n'
        '    const d = Math.hypot(mx - cell.cx, my - cell.cy);\n'
        '    if(d < bestDist){ bestDist = d; best = cell; }\n'
        '  });\n'
        '  return best;\n'
        '}\n'
        'canvas.addEventListener(\'mousedown\', (e) => {\n'
        '  if(e.button !== 0) return;\n'
        '  dragging = true;\n'
        '  didDrag = false;\n'
        '  const p = pointerPos(e);\n'
        '  dragStartX = p.x; dragStartY = p.y;\n'
        '  panStartX = panX; panStartY = panY;\n'
        '});\n'
        'window.addEventListener(\'mousemove\', (e) => {\n'
        '  const p = pointerPos(e);\n'
        '  if(dragging){\n'
        '    const dx = p.x - dragStartX, dy = p.y - dragStartY;\n'
        '    if(Math.hypot(dx, dy) > 4){\n'
        '      didDrag = true;\n'
        '      panX = panStartX + dx;\n'
        '      panY = panStartY + dy;\n'
        '      tip.style.display = \'none\';\n'
        '      canvas.style.cursor = \'grabbing\';\n'
        '      draw();\n'
        '    }\n'
        '    return;\n'
        '  }\n'
        '  const cell = hitCell(p.x, p.y);\n'
        '  hoverKey = cell ? cell.key : null;\n'
        '  canvas.style.cursor = cell ? \'pointer\' : \'grab\';\n'
        '  draw();\n'
        '  if(!cell){ tip.style.display = \'none\'; return; }\n'
        '  const r = cell.rec;\n'
        '  let html = \'<strong>\' + esc(r.item_name) + \'</strong><br/>Impact: \' + Math.round(num(r.impact_score,0));\n'
        '  html += \'<br/>Progress: \' + Math.round(num(r.progress_pct,0)) + \'%\';\n'
        '  if(r.priority_level) html += \'<br/>Priority: \' + esc(r.priority_level);\n'
        '  if(r.category) html += \'<br/>Category: \' + esc(r.category);\n'
        '  if(r.risk_score != null) html += \'<br/>Risk: \' + Math.round(num(r.risk_score,0));\n'
        '  if(r.trend) html += \'<br/>Trend: \' + esc(r.trend);\n'
        '  if(r.owner) html += \'<br/>Owner: \' + esc(r.owner);\n'
        '  if(r.due_date) html += \'<br/>Due: \' + esc(r.due_date);\n'
        '  if(r.status) html += \'<br/>Status: \' + esc(r.status);\n'
        '  if(r.delivery_health) html += \'<br/>Health: \' + esc(r.delivery_health);\n'
        '  if(r.investment != null) html += \'<br/>Investment: \' + Number(r.investment).toLocaleString();\n'
        '  if(r.benefit_value != null) html += \'<br/>Benefit: \' + Number(r.benefit_value).toLocaleString();\n'
        '  if(r.notes) html += \'<br/>\' + esc(String(r.notes).slice(0, 120));\n'
        '  tip.innerHTML = html;\n'
        '  tip.style.display = \'block\';\n'
        '  const rect = canvas.getBoundingClientRect();\n'
        '  tip.style.left = Math.min(rect.width - 160, Math.max(8, p.x + 12)) + \'px\';\n'
        '  tip.style.top = Math.max(8, p.y - 10) + \'px\';\n'
        '});\n'
        'window.addEventListener(\'mouseup\', () => {\n'
        '  if(!dragging) return;\n'
        '  dragging = false;\n'
        '  canvas.style.cursor = \'grab\';\n'
        '});\n'
        'canvas.addEventListener(\'mouseleave\', () => {\n'
        '  if(dragging) return;\n'
        '  hoverKey = null;\n'
        '  tip.style.display = \'none\';\n'
        '  draw();\n'
        '});\n'
        'canvas.addEventListener(\'dblclick\', () => {\n'
        '  panX = 0; panY = 0; zoom = 1;\n'
        '  draw();\n'
        '});\n'
        'canvas.addEventListener(\'wheel\', (e) => {\n'
        '  e.preventDefault();\n'
        '  const p = pointerPos(e);\n'
        '  const before = screenToWorld(p.x, p.y);\n'
        '  const factor = e.deltaY < 0 ? 1.08 : 1/1.08;\n'
        '  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));\n'
        '  panX = p.x - before.x * zoom;\n'
        '  panY = p.y - before.y * zoom;\n'
        '  draw();\n'
        '}, { passive: false });\n'
        'window.addEventListener(\'resize\', resize);\n'
        'resize();\n'
        '</script></body></html>\n'
    )
    vdab_honeycombstory1_html = vdab_honeycombstory1_html.replace('__HONEYCOMB_PAYLOAD__', json.dumps(vdab_honeycombstory1_payload, default=str).replace('<', '\\u003c'))
    components.html(vdab_honeycombstory1_html, height=560, scrolling=False)
