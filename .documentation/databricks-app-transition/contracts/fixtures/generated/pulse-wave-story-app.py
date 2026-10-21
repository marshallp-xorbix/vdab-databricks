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

st.set_page_config(page_title='Weekly revenue pulse', layout='wide')
st.title('Weekly revenue pulse')

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

_vdab_lbl_vdab_weeklyrevenuepulse = ui_overrides.get('labels', {}).get('weeklyRevenuePulse', None)
_vdab_disp_lbl_vdab_weeklyrevenuepulse = _vdab_lbl_vdab_weeklyrevenuepulse if _vdab_lbl_vdab_weeklyrevenuepulse is not None else 'Weekly Revenue Pulse'
st.subheader(_vdab_disp_lbl_vdab_weeklyrevenuepulse)
try:
    vdab_weeklyrevenuepulse_data = _vdab_sql_query_df('main', 'analytics', 'weekly_revenue', 500, query_statement='SELECT `period` AS time_period, SUM(`revenue`) AS metric_value, AVG(`target_revenue`) AS baseline_value, MAX(`event_name`) AS event_name, MAX(`event_type`) AS event_type, AVG(`impact_score`) AS impact_score FROM `main`.`analytics`.`weekly_revenue` GROUP BY `period` ORDER BY `period`')
except RuntimeError as vdab_error_vdab_weeklyrevenuepulse:
    st.error(str(vdab_error_vdab_weeklyrevenuepulse))
    vdab_weeklyrevenuepulse_data = pd.DataFrame(columns=['time_period', 'metric_value', 'baseline_value'])
if vdab_weeklyrevenuepulse_data is None or vdab_weeklyrevenuepulse_data.empty or 'time_period' not in vdab_weeklyrevenuepulse_data.columns:
    st.info('No time-series points returned. Check bindings and field mappings.')
else:
    vdab_weeklyrevenuepulse_data = vdab_weeklyrevenuepulse_data.copy()
    if 'metric_value' in vdab_weeklyrevenuepulse_data.columns:
        vdab_weeklyrevenuepulse_data['metric_value'] = pd.to_numeric(vdab_weeklyrevenuepulse_data['metric_value'], errors='coerce')
        vdab_weeklyrevenuepulse_data['metric_value'] = vdab_weeklyrevenuepulse_data['metric_value'].where(vdab_weeklyrevenuepulse_data['metric_value'].map(math.isfinite))
    if 'baseline_value' in vdab_weeklyrevenuepulse_data.columns:
        vdab_weeklyrevenuepulse_data['baseline_value'] = pd.to_numeric(vdab_weeklyrevenuepulse_data['baseline_value'], errors='coerce')
        vdab_weeklyrevenuepulse_data['baseline_value'] = vdab_weeklyrevenuepulse_data['baseline_value'].where(vdab_weeklyrevenuepulse_data['baseline_value'].map(math.isfinite))
    if 'impact_score' in vdab_weeklyrevenuepulse_data.columns:
        vdab_weeklyrevenuepulse_data['impact_score'] = pd.to_numeric(vdab_weeklyrevenuepulse_data['impact_score'], errors='coerce')
        vdab_weeklyrevenuepulse_data['impact_score'] = vdab_weeklyrevenuepulse_data['impact_score'].where(vdab_weeklyrevenuepulse_data['impact_score'].map(math.isfinite))
    vdab_weeklyrevenuepulse_data = vdab_weeklyrevenuepulse_data.dropna(subset=['time_period'])
    vdab_weeklyrevenuepulse_data['metric_value'] = vdab_weeklyrevenuepulse_data['metric_value'].fillna(0)
    vdab_weeklyrevenuepulse_data['baseline_value'] = vdab_weeklyrevenuepulse_data['baseline_value'].fillna(0)
    vdab_weeklyrevenuepulse_data = vdab_weeklyrevenuepulse_data.sort_values(by='time_period')
    vdab_weeklyrevenuepulse_records = []
    vdab_weeklyrevenuepulse_events = []
    for _, _vdab_row in vdab_weeklyrevenuepulse_data.iterrows():
        _vdab_period = '' if pd.isna(_vdab_row.get('time_period')) else str(_vdab_row.get('time_period')).strip()
        if not _vdab_period:
            continue
        _vdab_record = {'time_period': _vdab_period, 'metric_value': float(_vdab_row.get('metric_value') or 0), 'baseline_value': float(_vdab_row.get('baseline_value') or 0)}
        vdab_weeklyrevenuepulse_records.append(_vdab_record)
        _vdab_event_name = _vdab_row.get('event_name')
        if 'event_name' in vdab_weeklyrevenuepulse_data.columns and not pd.isna(_vdab_event_name) and str(_vdab_event_name).strip():
            _vdab_event = {'time_period': _vdab_period, 'event_name': str(_vdab_event_name).strip()}
            _vdab_event_type = _vdab_row.get('event_type')
            if 'event_type' in vdab_weeklyrevenuepulse_data.columns and not pd.isna(_vdab_event_type) and str(_vdab_event_type).strip():
                _vdab_event['event_type'] = str(_vdab_event_type).strip().lower()
            _vdab_impact_score = _vdab_row.get('impact_score')
            if 'impact_score' in vdab_weeklyrevenuepulse_data.columns and not pd.isna(_vdab_impact_score):
                _vdab_event['impact_score'] = float(_vdab_impact_score)
            vdab_weeklyrevenuepulse_events.append(_vdab_event)
    vdab_weeklyrevenuepulse_spike = None
    vdab_weeklyrevenuepulse_drop = None
    for _vdab_index in range(1, len(vdab_weeklyrevenuepulse_records)):
        _vdab_delta = vdab_weeklyrevenuepulse_records[_vdab_index]['metric_value'] - vdab_weeklyrevenuepulse_records[_vdab_index - 1]['metric_value']
        _vdab_point = {'time_period': vdab_weeklyrevenuepulse_records[_vdab_index]['time_period'], 'delta': _vdab_delta}
        if vdab_weeklyrevenuepulse_spike is None or _vdab_delta > vdab_weeklyrevenuepulse_spike['delta']:
            vdab_weeklyrevenuepulse_spike = _vdab_point
        if vdab_weeklyrevenuepulse_drop is None or _vdab_delta < vdab_weeklyrevenuepulse_drop['delta']:
            vdab_weeklyrevenuepulse_drop = _vdab_point
    vdab_weeklyrevenuepulse_warnings = ['Fewer than 8 time points — wave may be less meaningful.'] if len(vdab_weeklyrevenuepulse_records) < 8 else []
    vdab_weeklyrevenuepulse_payload = {
        'records': vdab_weeklyrevenuepulse_records,
        'events': vdab_weeklyrevenuepulse_events,
        'visualConfig': {
            'metric_name': 'Revenue',
            'y_axis_label': 'revenue',
            'aggregation_method': 'sum',
            'show_baseline': True,
            'show_events': True,
            'show_anomaly_markers': True,
            'fill_under_wave': True,
        },
        'summary': {
            'point_count': len(vdab_weeklyrevenuepulse_records),
            'largest_spike': vdab_weeklyrevenuepulse_spike,
            'largest_drop': vdab_weeklyrevenuepulse_drop,
            'event_count': len(vdab_weeklyrevenuepulse_events),
            'warnings': vdab_weeklyrevenuepulse_warnings,
        },
    }
    vdab_weeklyrevenuepulse_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"/>\n'
        '<style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35;}\n'
        '#warn{position:absolute;left:10px;bottom:8px;right:220px;z-index:3;font-size:10px;color:#fbbf24;pointer-events:none;}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.72);pointer-events:none;user-select:none;}\n'
        'canvas:focus-visible{outline:2px solid #67e8f9;outline-offset:-3px;}\n'
        '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}\n'
        '</style></head><body>\n'
        '<div id="wrap"><canvas id="c" role="group" tabindex="0" aria-describedby="hint" aria-label="Interactive Pulse Wave time-series chart. Use left and right arrow keys to inspect points, Enter or Space to select, Escape to clear selection, plus and minus to zoom, and Home to reset the view."></canvas><div id="tip"></div><div id="warn" role="note"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset · use arrow keys to inspect points</div><div id="announce" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div></div>\n'
        '<script>\n'
        'const payload = __PULSE_WAVE_PAYLOAD__;\n'
        'const canvas = document.getElementById(\'c\');\n'
        'const tip = document.getElementById(\'tip\');\n'
        'const warn = document.getElementById(\'warn\');\n'
        'const announcer = document.getElementById(\'announce\');\n'
        'const ctx = canvas.getContext(\'2d\');\n'
        'const cfg = Object.assign({\n'
        '  metric_name: \'Metric\', y_axis_label: \'Metric\', aggregation_method: \'sum\',\n'
        '  show_baseline: true, show_events: true, show_anomaly_markers: true, fill_under_wave: true\n'
        '}, (payload && payload.visualConfig) || {});\n'
        'const records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];\n'
        'const events = Array.isArray(payload && payload.events) ? payload.events.slice() : [];\n'
        'const summary = (payload && payload.summary) || {};\n'
        'let hoverIndex = -1;\n'
        'let keyboardIndex = -1;\n'
        'let selectedIndex = -1;\n'
        'let viewStart = 0, viewEnd = 1;\n'
        'let dragging = false, dragStartX = 0, dragViewStart = 0, dragViewEnd = 1;\n'
        'const MIN_SPAN = 0.05;\n'
        '\n'
        'function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }\n'
        'function esc(s){ return String(s).replace(/[&<>"\']/g, c=>({ \'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\' }[c])); }\n'
        'function clampView(){\n'
        '  viewStart=Math.max(0,Math.min(1,viewStart)); viewEnd=Math.max(0,Math.min(1,viewEnd));\n'
        '  if(viewEnd-viewStart<MIN_SPAN){ const mid=(viewStart+viewEnd)/2; viewStart=Math.max(0,mid-MIN_SPAN/2); viewEnd=Math.min(1,mid+MIN_SPAN/2); }\n'
        '  if(viewEnd<=viewStart){ viewStart=0; viewEnd=1; }\n'
        '}\n'
        'function layout(){\n'
        '  const rect=canvas.getBoundingClientRect(), p={l:62,r:18,t:20,b:36};\n'
        '  return {w:rect.width,h:rect.height,p,iw:Math.max(1,rect.width-p.l-p.r),ih:Math.max(1,rect.height-p.t-p.b)};\n'
        '}\n'
        'function yRange(values){\n'
        '  let min=Infinity,max=-Infinity;\n'
        '  values.forEach(rec=>{ const metric=num(rec.metric_value,0), baseline=num(rec.baseline_value,0); min=Math.min(min,metric,baseline); max=Math.max(max,metric,baseline); });\n'
        '  if(!Number.isFinite(min)||!Number.isFinite(max)){ min=0; max=1; }\n'
        '  if(min===max){ min-=1; max+=1; }\n'
        '  const padding=(max-min)*0.12;\n'
        '  return {min:min-padding,max:max+padding};\n'
        '}\n'
        'function yPosition(value,range,L){ return L.p.t+(1-((value-range.min)/(range.max-range.min||1)))*L.ih; }\n'
        'function eventMap(){\n'
        '  const result=Object.create(null);\n'
        '  events.forEach(event=>{ if(event&&event.time_period) result[String(event.time_period)]=event; });\n'
        '  return result;\n'
        '}\n'
        'function visiblePoints(range,L){\n'
        '  const count=records.length;\n'
        '  if(count===0) return [];\n'
        '  if(count===1) return [{x:L.p.l+L.iw/2,y:yPosition(num(records[0].metric_value,0),range,L),index:0,record:records[0]}];\n'
        '  const start=viewStart*(count-1),end=viewEnd*(count-1),span=end-start||1;\n'
        '  const first=Math.max(0,Math.floor(start)),last=Math.min(count-1,Math.ceil(end)),points=[];\n'
        '  for(let index=first;index<=last;index++) points.push({x:L.p.l+((index-start)/span)*L.iw,y:yPosition(num(records[index].metric_value,0),range,L),index,record:records[index]});\n'
        '  return points;\n'
        '}\n'
        'function drawWave(points,closeToFloor,floorY){\n'
        '  if(points.length===0) return;\n'
        '  ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);\n'
        '  for(let index=1;index<points.length;index++){\n'
        '    const previous=points[index-1],current=points[index],middle=(previous.x+current.x)/2;\n'
        '    ctx.bezierCurveTo(middle,previous.y,middle,current.y,current.x,current.y);\n'
        '  }\n'
        '  if(closeToFloor){ ctx.lineTo(points[points.length-1].x,floorY); ctx.lineTo(points[0].x,floorY); ctx.closePath(); }\n'
        '}\n'
        'function compact(value){\n'
        '  const number=Number(value); if(!Number.isFinite(number)) return \'\';\n'
        '  const absolute=Math.abs(number);\n'
        '  if(absolute>=1e6) return (number/1e6).toFixed(1)+\'M\';\n'
        '  if(absolute>=1e3) return (number/1e3).toFixed(1)+\'k\';\n'
        '  return Math.round(number).toString();\n'
        '}\n'
        'function draw(){\n'
        '  clampView();\n'
        '  const L=layout(),eventRows=eventMap(),count=records.length;\n'
        '  ctx.clearRect(0,0,L.w,L.h); ctx.fillStyle=\'#0b1220\'; ctx.fillRect(0,0,L.w,L.h);\n'
        '  let visible=records;\n'
        '  if(count>1){ const first=Math.floor(viewStart*(count-1)),last=Math.min(count-1,Math.ceil(viewEnd*(count-1))); visible=records.slice(first,last+1); }\n'
        '  const range=yRange(visible.length?visible:records);\n'
        '  ctx.strokeStyle=\'rgba(148,163,184,.24)\'; ctx.lineWidth=1;\n'
        '  for(let grid=0;grid<=4;grid++){\n'
        '    const y=L.p.t+(grid/4)*L.ih,value=range.max-(grid/4)*(range.max-range.min);\n'
        '    ctx.beginPath(); ctx.moveTo(L.p.l,y); ctx.lineTo(L.p.l+L.iw,y); ctx.stroke();\n'
        '    ctx.fillStyle=\'rgba(226,246,255,.72)\'; ctx.font=\'10px system-ui,sans-serif\'; ctx.textAlign=\'right\'; ctx.fillText(compact(value),L.p.l-6,y+3);\n'
        '  }\n'
        '  ctx.save(); ctx.fillStyle=\'rgba(226,246,255,.9)\'; ctx.font=\'11px system-ui,sans-serif\'; ctx.textAlign=\'center\'; ctx.textBaseline=\'middle\'; ctx.translate(14,L.p.t+L.ih/2); ctx.rotate(-Math.PI/2); ctx.fillText(String(cfg.y_axis_label||cfg.metric_name||\'Metric\'),0,0); ctx.restore();\n'
        '  if(count===0){ ctx.fillStyle=\'rgba(226,246,255,.8)\'; ctx.textAlign=\'center\'; ctx.fillText(\'No data\',L.w/2,L.h/2); warn.textContent=\'\'; return; }\n'
        '  const points=visiblePoints(range,L),floorY=yPosition(range.min,range,L);\n'
        '  ctx.save(); ctx.beginPath(); ctx.rect(L.p.l,L.p.t,L.iw,L.ih); ctx.clip();\n'
        '  if(cfg.fill_under_wave){ ctx.fillStyle=\'rgba(56,189,248,.16)\'; drawWave(points,true,floorY); ctx.fill(); }\n'
        '  if(cfg.show_baseline){\n'
        '    ctx.setLineDash([5,4]); ctx.strokeStyle=\'rgba(251,191,36,.82)\'; ctx.lineWidth=1.5; ctx.beginPath();\n'
        '    points.forEach((point,index)=>{ const y=yPosition(num(point.record.baseline_value,0),range,L); if(index===0) ctx.moveTo(point.x,y); else ctx.lineTo(point.x,y); });\n'
        '    ctx.stroke(); ctx.setLineDash([]);\n'
        '  }\n'
        '  ctx.strokeStyle=\'#38bdf8\'; ctx.lineWidth=2.25; ctx.lineJoin=\'round\'; drawWave(points,false,0); ctx.stroke();\n'
        '  if(cfg.show_anomaly_markers){\n'
        '    const spike=summary.largest_spike&&String(summary.largest_spike.time_period),drop=summary.largest_drop&&String(summary.largest_drop.time_period);\n'
        '    points.forEach(point=>{ const period=String(point.record.time_period||\'\'); if(period&& (period===spike||period===drop)){ ctx.beginPath(); ctx.arc(point.x,point.y,5,0,Math.PI*2); ctx.fillStyle=period===spike?\'#4ade80\':\'#f87171\'; ctx.fill(); ctx.strokeStyle=\'#0b1220\'; ctx.lineWidth=1.5; ctx.stroke(); } });\n'
        '  }\n'
        '  if(cfg.show_events){\n'
        '    points.forEach(point=>{\n'
        '      const event=eventRows[String(point.record.time_period||\'\')]; if(!event) return;\n'
        '      const type=String(event.event_type||\'neutral\').toLowerCase(),color=type===\'positive\'?\'#4ade80\':type===\'negative\'?\'#f87171\':\'#a78bfa\';\n'
        '      ctx.strokeStyle=color; ctx.lineWidth=1.25; ctx.setLineDash([2,3]); ctx.beginPath(); ctx.moveTo(point.x,L.p.t); ctx.lineTo(point.x,L.p.t+L.ih); ctx.stroke(); ctx.setLineDash([]);\n'
        '      const radius=3+Math.max(0,Math.min(6,num(event.impact_score,40)/20)); ctx.beginPath(); ctx.arc(point.x,L.p.t+8,radius,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();\n'
        '      const label=String(event.event_name||\'\').slice(0,18); if(label){ ctx.fillStyle=\'rgba(226,246,255,.9)\'; ctx.font=\'9px system-ui,sans-serif\'; ctx.textAlign=\'center\'; ctx.fillText(label,point.x,L.p.t+22); }\n'
        '    });\n'
        '  }\n'
        '  const highlighted=keyboardIndex>=0?keyboardIndex:hoverIndex;\n'
        '  const activePoint=points.find(point=>point.index===highlighted);\n'
        '  if(activePoint){\n'
        '    ctx.strokeStyle=\'#67e8f9\'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(activePoint.x,L.p.t); ctx.lineTo(activePoint.x,L.p.t+L.ih); ctx.stroke(); ctx.setLineDash([]);\n'
        '    ctx.beginPath(); ctx.arc(activePoint.x,activePoint.y,5,0,Math.PI*2); ctx.fillStyle=selectedIndex===highlighted?\'#f8fafc\':\'#e0f2fe\'; ctx.fill();\n'
        '  }\n'
        '  ctx.restore();\n'
        '  ctx.fillStyle=\'rgba(226,246,255,.72)\'; ctx.font=\'10px system-ui,sans-serif\'; ctx.textAlign=\'center\';\n'
        '  const step=Math.max(1,Math.ceil(points.length/6));\n'
        '  for(let index=0;index<points.length;index+=step) ctx.fillText(String(points[index].record.time_period||\'\').slice(0,10),points[index].x,L.h-12);\n'
        '  const warnings=Array.isArray(summary.warnings)?summary.warnings:[]; warn.textContent=warnings.length?String(warnings[0]):\'\';\n'
        '}\n'
        'function seriesFraction(x){ const L=layout(),ratio=Math.max(0,Math.min(1,(x-L.p.l)/(L.iw||1))); return viewStart+ratio*(viewEnd-viewStart); }\n'
        'function zoomAt(x,factor){\n'
        '  const anchor=seriesFraction(x),span=viewEnd-viewStart,next=Math.max(MIN_SPAN,Math.min(1,span*factor)),ratio=span>0?(anchor-viewStart)/span:0.5;\n'
        '  viewStart=anchor-ratio*next; viewEnd=viewStart+next;\n'
        '  if(viewStart<0){viewStart=0;viewEnd=next;} if(viewEnd>1){viewEnd=1;viewStart=1-next;} draw();\n'
        '}\n'
        'function hitIndex(x){\n'
        '  const L=layout(),points=visiblePoints(yRange(records),L); let best=-1,bestDistance=Infinity;\n'
        '  points.forEach(point=>{ const distance=Math.abs(x-point.x); if(distance<bestDistance){bestDistance=distance;best=point.index;} });\n'
        '  return bestDistance<=18?best:-1;\n'
        '}\n'
        'function pointDetails(index){\n'
        '  const record=records[index]; if(!record) return \'\';\n'
        '  const previous=index>0?records[index-1]:null,delta=previous?num(record.metric_value,0)-num(previous.metric_value,0):null,event=eventMap()[String(record.time_period||\'\')];\n'
        '  let details=String(record.time_period||\'\')+\'. \'+String(cfg.y_axis_label||cfg.metric_name||\'Metric\')+\' \'+compact(record.metric_value)+\'. Baseline \'+compact(record.baseline_value)+\'.\';\n'
        '  if(delta!==null) details+=\' Change from prior point \'+(delta>=0?\'+\':\'\')+compact(delta)+\'.\';\n'
        '  if(event) details+=\' Event \'+String(event.event_name||\'\')+\'.\';\n'
        '  return details;\n'
        '}\n'
        'function showPointTip(index,x,y){\n'
        '  const record=records[index]; if(!record){tip.style.display=\'none\';return;}\n'
        '  const previous=index>0?records[index-1]:null,delta=previous?num(record.metric_value,0)-num(previous.metric_value,0):null,event=eventMap()[String(record.time_period||\'\')];\n'
        '  let html=\'<strong>\'+esc(record.time_period||\'\')+\'</strong><br/>\'+esc(cfg.y_axis_label||cfg.metric_name||\'Metric\')+\': \'+compact(record.metric_value)+\'<br/>Baseline: \'+compact(record.baseline_value);\n'
        '  if(delta!==null) html+=\'<br/>Δ prior: \'+(delta>=0?\'+\':\'\')+compact(delta);\n'
        '  if(event) html+=\'<br/>Event: \'+esc(event.event_name||\'\');\n'
        '  tip.innerHTML=html; tip.style.display=\'block\'; const rect=canvas.parentElement.getBoundingClientRect();\n'
        '  tip.style.left=Math.min(rect.width-180,Math.max(8,x+12))+\'px\'; tip.style.top=Math.max(8,Math.min(rect.height-80,y-10))+\'px\';\n'
        '}\n'
        'function moveKeyboardPoint(direction){\n'
        '  if(records.length===0) return;\n'
        '  keyboardIndex=keyboardIndex<0?(direction<0?records.length-1:0):(keyboardIndex+direction+records.length)%records.length;\n'
        '  selectedIndex=-1; const L=layout(),point=visiblePoints(yRange(records),L).find(candidate=>candidate.index===keyboardIndex);\n'
        '  if(point) showPointTip(keyboardIndex,point.x,point.y); else tip.style.display=\'none\';\n'
        '  announcer.textContent=pointDetails(keyboardIndex); draw();\n'
        '}\n'
        'function resize(){\n'
        '  const rect=canvas.getBoundingClientRect(),ratio=Math.max(1,window.devicePixelRatio||1);\n'
        '  canvas.width=Math.max(1,Math.floor(rect.width*ratio)); canvas.height=Math.max(1,Math.floor(rect.height*ratio)); ctx.setTransform(ratio,0,0,ratio,0,0); draw();\n'
        '}\n'
        'canvas.addEventListener(\'wheel\',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect();zoomAt(event.clientX-rect.left,event.deltaY<0?0.85:1.18);},{passive:false});\n'
        'canvas.addEventListener(\'pointerdown\',event=>{dragging=true;dragStartX=event.clientX;dragViewStart=viewStart;dragViewEnd=viewEnd;canvas.setPointerCapture(event.pointerId);});\n'
        'canvas.addEventListener(\'pointermove\',event=>{\n'
        '  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;\n'
        '  if(dragging){const span=dragViewEnd-dragViewStart,delta=-(event.clientX-dragStartX)/(layout().iw||1)*span;viewStart=dragViewStart+delta;viewEnd=dragViewEnd+delta;if(viewStart<0){viewStart=0;viewEnd=span;}if(viewEnd>1){viewEnd=1;viewStart=1-span;}tip.style.display=\'none\';draw();return;}\n'
        '  keyboardIndex=-1; selectedIndex=-1; hoverIndex=hitIndex(x); draw();\n'
        '  if(hoverIndex<0){tip.style.display=\'none\';return;} showPointTip(hoverIndex,x,y);\n'
        '});\n'
        'canvas.addEventListener(\'pointerup\',event=>{dragging=false;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);});\n'
        'canvas.addEventListener(\'pointercancel\',()=>{dragging=false;});\n'
        'canvas.addEventListener(\'pointerleave\',()=>{if(!dragging){hoverIndex=-1;tip.style.display=\'none\';draw();}});\n'
        'canvas.addEventListener(\'dblclick\',()=>{viewStart=0;viewEnd=1;keyboardIndex=-1;selectedIndex=-1;tip.style.display=\'none\';announcer.textContent=\'Chart view reset.\';draw();});\n'
        'canvas.addEventListener(\'keydown\',event=>{\n'
        '  if(event.key===\'ArrowRight\'||event.key===\'ArrowDown\'){event.preventDefault();moveKeyboardPoint(1);return;}\n'
        '  if(event.key===\'ArrowLeft\'||event.key===\'ArrowUp\'){event.preventDefault();moveKeyboardPoint(-1);return;}\n'
        '  if((event.key===\'Enter\'||event.key===\' \')&&keyboardIndex>=0){event.preventDefault();selectedIndex=selectedIndex===keyboardIndex?-1:keyboardIndex;announcer.textContent=(selectedIndex<0?\'Cleared selection. \':\'Selected. \')+pointDetails(keyboardIndex);draw();return;}\n'
        '  if(event.key===\'Escape\'){keyboardIndex=-1;selectedIndex=-1;tip.style.display=\'none\';announcer.textContent=\'Chart selection cleared.\';draw();return;}\n'
        '  if(event.key===\'Home\'){viewStart=0;viewEnd=1;keyboardIndex=-1;selectedIndex=-1;tip.style.display=\'none\';announcer.textContent=\'Chart view reset.\';draw();return;}\n'
        '  if(event.key===\'+\'||event.key===\'=\'){event.preventDefault();zoomAt(layout().w/2,0.85);return;}\n'
        '  if(event.key===\'-\'){event.preventDefault();zoomAt(layout().w/2,1.18);}\n'
        '});\n'
        'window.addEventListener(\'resize\',resize); resize();\n'
        '</script></body></html>\n'
    )
    vdab_weeklyrevenuepulse_html = vdab_weeklyrevenuepulse_html.replace('__PULSE_WAVE_PAYLOAD__', json.dumps(vdab_weeklyrevenuepulse_payload, default=str, allow_nan=False).replace('<', '\\u003c'))
    components.html(vdab_weeklyrevenuepulse_html, height=520, scrolling=False)
