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

st.set_page_config(page_title='Journey tracker', layout='wide')
st.title('Journey tracker')

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

def _vdab_sql_query_df(catalog: str, schema: str, table: str, max_rows: int, primary_key: str | None = None, query_statement: str | None = None, warehouse_id_override: str | None = None, source_kind: str = 'unityCatalogTable', database: str | None = None, endpoint: str | None = None, resource_environment_variable: str | None = None) -> pd.DataFrame:
    if source_kind == 'lakebaseAutoscaling':
        if not isinstance(database, str) or not isinstance(endpoint, str):
            raise RuntimeError('The Lakebase database and endpoint must be selected before previewing.')
        return _vdab_lakebase_query_df(schema, table, max_rows, query_statement, database, endpoint, resource_environment_variable)
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

_vdab_lbl_vdab_journeytracker = ui_overrides.get('labels', {}).get('journeyTracker', None)
_vdab_disp_lbl_vdab_journeytracker = _vdab_lbl_vdab_journeytracker if _vdab_lbl_vdab_journeytracker is not None else 'Journey Tracker'
st.subheader(_vdab_disp_lbl_vdab_journeytracker)
try:
    vdab_journeytracker_data = _vdab_sql_query_df('main', 'analytics', 'journey_milestones', 100, query_statement='SELECT `journey` AS journey_name, `stage` AS stage, MAX(`milestone_date`) AS timeline, AVG(`progress`) AS progress_pct, SUM(`metric`) AS metric_value, MAX(`target_date`) AS target_date, MAX(`actual_date`) AS actual_date, MAX(`status`) AS status, MAX(`owner`) AS owner, MAX(`achievement`) AS key_achievement, AVG(`risk`) AS risk_score, SUM(`cost`) AS cost FROM `main`.`analytics`.`journey_milestones` GROUP BY `journey`, `stage` ORDER BY MAX(`milestone_date`)')
except RuntimeError as vdab_error_vdab_journeytracker:
    st.error(str(vdab_error_vdab_journeytracker))
    vdab_journeytracker_data = pd.DataFrame(columns=['journey_name', 'stage', 'timeline', 'progress_pct', 'metric_value'])
if vdab_journeytracker_data is None or vdab_journeytracker_data.empty or not all(_vdab_column in vdab_journeytracker_data.columns for _vdab_column in ('journey_name', 'stage', 'timeline', 'progress_pct', 'metric_value')):
    st.info('No spiral milestones returned. Check bindings and field mappings.')
else:
    vdab_journeytracker_data = vdab_journeytracker_data.copy()
    if 'progress_pct' in vdab_journeytracker_data.columns:
        vdab_journeytracker_data['progress_pct'] = pd.to_numeric(vdab_journeytracker_data['progress_pct'], errors='coerce')
        vdab_journeytracker_data['progress_pct'] = vdab_journeytracker_data['progress_pct'].where(vdab_journeytracker_data['progress_pct'].map(math.isfinite))
    if 'metric_value' in vdab_journeytracker_data.columns:
        vdab_journeytracker_data['metric_value'] = pd.to_numeric(vdab_journeytracker_data['metric_value'], errors='coerce')
        vdab_journeytracker_data['metric_value'] = vdab_journeytracker_data['metric_value'].where(vdab_journeytracker_data['metric_value'].map(math.isfinite))
    if 'risk_score' in vdab_journeytracker_data.columns:
        vdab_journeytracker_data['risk_score'] = pd.to_numeric(vdab_journeytracker_data['risk_score'], errors='coerce')
        vdab_journeytracker_data['risk_score'] = vdab_journeytracker_data['risk_score'].where(vdab_journeytracker_data['risk_score'].map(math.isfinite))
    if 'cost' in vdab_journeytracker_data.columns:
        vdab_journeytracker_data['cost'] = pd.to_numeric(vdab_journeytracker_data['cost'], errors='coerce')
        vdab_journeytracker_data['cost'] = vdab_journeytracker_data['cost'].where(vdab_journeytracker_data['cost'].map(math.isfinite))
    vdab_journeytracker_data['journey_name'] = vdab_journeytracker_data['journey_name'].fillna('').astype(str).str.strip()
    vdab_journeytracker_data['stage'] = vdab_journeytracker_data['stage'].fillna('').astype(str).str.strip()
    vdab_journeytracker_data = vdab_journeytracker_data[(vdab_journeytracker_data['journey_name'] != '') & (vdab_journeytracker_data['stage'] != '')]
    vdab_journeytracker_data = vdab_journeytracker_data.sort_values(by=['journey_name', 'timeline', 'stage'], kind='stable')
    vdab_journeytracker_records = []
    for _, _vdab_row in vdab_journeytracker_data.iterrows():
        _vdab_record = {
            'journey_name': str(_vdab_row.get('journey_name', '')).strip(),
            'stage': str(_vdab_row.get('stage', '')).strip(),
            'timeline': None if pd.isna(_vdab_row.get('timeline')) else str(_vdab_row.get('timeline')),
            'progress_pct': 0.0 if pd.isna(_vdab_row.get('progress_pct')) else float(_vdab_row.get('progress_pct')),
            'metric_value': 0.0 if pd.isna(_vdab_row.get('metric_value')) else float(_vdab_row.get('metric_value')),
        }
        _vdab_target_date = _vdab_row.get('target_date')
        if 'target_date' in vdab_journeytracker_data.columns and not pd.isna(_vdab_target_date):
            _vdab_record['target_date'] = str(_vdab_target_date).strip()
        _vdab_actual_date = _vdab_row.get('actual_date')
        if 'actual_date' in vdab_journeytracker_data.columns and not pd.isna(_vdab_actual_date):
            _vdab_record['actual_date'] = str(_vdab_actual_date).strip()
        _vdab_status = _vdab_row.get('status')
        if 'status' in vdab_journeytracker_data.columns and not pd.isna(_vdab_status):
            _vdab_record['status'] = str(_vdab_status).strip()
        _vdab_risk_score = _vdab_row.get('risk_score')
        if 'risk_score' in vdab_journeytracker_data.columns and not pd.isna(_vdab_risk_score):
            _vdab_record['risk_score'] = float(_vdab_risk_score)
        _vdab_owner = _vdab_row.get('owner')
        if 'owner' in vdab_journeytracker_data.columns and not pd.isna(_vdab_owner):
            _vdab_record['owner'] = str(_vdab_owner).strip()
        _vdab_key_achievement = _vdab_row.get('key_achievement')
        if 'key_achievement' in vdab_journeytracker_data.columns and not pd.isna(_vdab_key_achievement):
            _vdab_record['key_achievement'] = str(_vdab_key_achievement).strip()
        _vdab_cost = _vdab_row.get('cost')
        if 'cost' in vdab_journeytracker_data.columns and not pd.isna(_vdab_cost):
            _vdab_record['cost'] = float(_vdab_cost)
        if 'status' in _vdab_record:
            _vdab_record['status'] = _vdab_record['status'].lower().replace(' ', '_').replace('-', '_')
        if 'target_date' in _vdab_record and 'actual_date' in _vdab_record:
            _vdab_target_date = pd.to_datetime(_vdab_record['target_date'], errors='coerce')
            _vdab_actual_date = pd.to_datetime(_vdab_record['actual_date'], errors='coerce')
            if pd.notna(_vdab_target_date) and pd.notna(_vdab_actual_date):
                _vdab_record['schedule_variance_days'] = int((_vdab_actual_date - _vdab_target_date).days)
        vdab_journeytracker_records.append(_vdab_record)
    vdab_journeytracker_journeys = sorted({ _vdab_record['journey_name'] for _vdab_record in vdab_journeytracker_records })
    vdab_journeytracker_selected_journey = sorted(vdab_journeytracker_journeys, key=lambda _vdab_journey: (-sum(1 for _vdab_record in vdab_journeytracker_records if _vdab_record['journey_name'] == _vdab_journey), _vdab_journey))[0] if vdab_journeytracker_journeys else ''
    vdab_journeytracker_warnings = ['Fewer than 3 milestones — spiral story may be less meaningful.'] if 0 < sum(1 for _vdab_record in vdab_journeytracker_records if _vdab_record['journey_name'] == vdab_journeytracker_selected_journey) < 3 else []
    vdab_journeytracker_payload = {
        'records': vdab_journeytracker_records,
        'journeys': vdab_journeytracker_journeys,
        'selected_journey': vdab_journeytracker_selected_journey,
        'visualConfig': {
            'show_labels': True,
            'show_risk_glow': True,
            'show_variance': True,
            'space_by_timeline': False,
        },
        'summary': {'warnings': vdab_journeytracker_warnings},
    }
    vdab_journeytracker_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"><style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;color:#e2f6ff}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}\n'
        '#wrap:focus-visible{outline:2px solid #38bdf8;outline-offset:-2px}\n'
        '#toolbar{position:absolute;top:8px;left:10px;right:10px;z-index:5;display:none;align-items:center;gap:8px}\n'
        '#toolbar label{font-size:11px;color:rgba(226,246,255,.8);white-space:nowrap}\n'
        '#journeySelect{flex:1;min-width:0;max-width:320px;background:#0f172a;color:#e2f6ff;border:1px solid rgba(148,163,184,.65);border-radius:6px;padding:4px 8px;font-size:12px}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35}\n'
        '#warn{position:absolute;left:10px;bottom:8px;right:180px;z-index:3;font-size:10px;color:rgba(251,191,36,.95);pointer-events:none}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.65);pointer-events:none;user-select:none}\n'
        '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\n'
        '</style></head><body>\n'
        '<div id="wrap" role="group" tabindex="0" aria-label="Spiral journey visualization" aria-describedby="hint announce">\n'
        '<div id="toolbar"><label for="journeySelect">Journey</label><select id="journeySelect"></select></div>\n'
        '<canvas id="c" aria-label="Milestones arranged on a progress spiral"></canvas><div id="tip"></div><div id="warn"></div>\n'
        '<div id="hint">Arrow keys inspect milestones; drag to pan, scroll to zoom, double-click to reset.</div>\n'
        '<div id="announce" class="sr-only" aria-live="polite"></div></div>\n'
        '<script>\n'
        'const payload = __SPIRAL_PAYLOAD__;\n'
        'const wrap=document.getElementById(\'wrap\'),canvas=document.getElementById(\'c\'),tip=document.getElementById(\'tip\');\n'
        'const warn=document.getElementById(\'warn\'),toolbar=document.getElementById(\'toolbar\'),select=document.getElementById(\'journeySelect\');\n'
        'const announce=document.getElementById(\'announce\'),ctx=canvas.getContext(\'2d\');\n'
        'const cfg=Object.assign({show_labels:true,show_risk_glow:true,show_variance:true,space_by_timeline:false},payload&&payload.visualConfig||{});\n'
        'const allRecords=Array.isArray(payload&&payload.records)?payload.records.slice():[];\n'
        'const journeys=Array.isArray(payload&&payload.journeys)?payload.journeys.slice():[];\n'
        'let selectedJourney=String(payload&&payload.selected_journey||\'\'),selectedIndex=-1,scene=[];\n'
        'let panX=0,panY=0,zoom=1,dragging=false,didDrag=false,startX=0,startY=0,baseX=0,baseY=0;\n'
        'const RISK_THRESHOLD=70,MIN_ZOOM=.45,MAX_ZOOM=2.5;\n'
        'const STATUS_STROKE={complete:\'#34d399\',active:\'#38bdf8\',delayed:\'#fbbf24\',blocked:\'#f87171\',not_started:\'rgba(148,163,184,.7)\'};\n'
        'function num(v,d){const n=Number(v);return Number.isFinite(n)?n:d}\n'
        'function esc(v){return String(v).replace(/[&<>"\']/g,c=>({\'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\'}[c]))}\n'
        'function selectedRecords(){return allRecords.filter(r=>!selectedJourney||String(r.journey_name)===selectedJourney).slice().sort((a,b)=>String(a.timeline||\'\').localeCompare(String(b.timeline||\'\')))}\n'
        'function parseTimeline(v){if(v==null||v===\'\')return null;const s=String(v).trim(),ms=Date.parse(s);if(!Number.isNaN(ms))return ms;const n=Number(s);return Number.isFinite(n)?n:null}\n'
        'function fractions(rows){if(rows.length<=1)return [0];if(!cfg.space_by_timeline)return rows.map((_,i)=>i/(rows.length-1));\n'
        '  const parsed=rows.map(r=>parseTimeline(r.timeline));let values;\n'
        '  if(parsed.every(v=>v!==null))values=parsed;else{const labels=Array.from(new Set(rows.map(r=>String(r.timeline||\'\')))).sort();const rank=new Map(labels.map((v,i)=>[v,i]));values=rows.map(r=>rank.get(String(r.timeline||\'\'))||0)}\n'
        '  const min=Math.min(...values),max=Math.max(...values);return max===min?rows.map((_,i)=>i/(rows.length-1)):values.map(v=>(v-min)/(max-min))}\n'
        'function variance(r){return num(r.schedule_variance_days,0)}\n'
        'function details(r){const parts=[String(r.stage||\'Milestone\'),\'Journey \'+String(r.journey_name||\'\'),\'Timeline \'+String(r.timeline||\'\'),\'Progress \'+num(r.progress_pct,0).toFixed(0)+\'%\',\'Metric \'+num(r.metric_value,0).toLocaleString()];\n'
        '  if(r.status)parts.push(\'Status \'+String(r.status).replaceAll(\'_\',\' \'));if(r.risk_score!=null)parts.push(\'Risk \'+num(r.risk_score,0).toFixed(0));if(r.schedule_variance_days!=null)parts.push(\'Variance \'+variance(r)+\' days\');\n'
        '  if(r.owner)parts.push(\'Owner \'+String(r.owner));if(r.target_date)parts.push(\'Target \'+String(r.target_date));if(r.actual_date)parts.push(\'Actual \'+String(r.actual_date));if(r.key_achievement)parts.push(String(r.key_achievement));if(r.cost!=null)parts.push(\'Cost \'+num(r.cost,0).toLocaleString());return parts.join(\'. \')}\n'
        'function resize(){const rect=wrap.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);draw()}\n'
        'function markerRows(rows,w,h){const padTop=journeys.length>1?46:20,padBottom=36,cx=w/2,cy=(padTop+h-padBottom)/2,maxR=Math.min(w,h-padTop-padBottom)*.38,a=maxR*.08;\n'
        '  const turns=Math.max(1.6,Math.min(2.8,1.2+rows.length*.18)),b=(maxR-a)/(turns*Math.PI*2),metrics=rows.map(r=>num(r.metric_value,0));\n'
        '  const min=Math.min(0,...metrics),max=Math.max(1,...metrics),span=Math.max(1,max-min),steps=fractions(rows);\n'
        '  return rows.map((r,i)=>{const theta=steps[i]*turns*Math.PI*2,radius=a+b*theta;return {record:r,index:i,x:cx+radius*Math.cos(theta-Math.PI/2),y:cy+radius*Math.sin(theta-Math.PI/2),radius:10+((num(r.metric_value,0)-min)/span)*14,theta}})}\n'
        'function draw(){const rect=wrap.getBoundingClientRect(),w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);const rows=selectedRecords();scene=markerRows(rows,w,h);ctx.save();ctx.translate(panX,panY);ctx.scale(zoom,zoom);\n'
        '  if(scene.length){const first=scene[0],last=scene[scene.length-1],maxR=Math.min(w,h-(journeys.length>1?46:20)-36)*.38,a=maxR*.08,turns=Math.max(1.6,Math.min(2.8,1.2+rows.length*.18)),b=(maxR-a)/(turns*Math.PI*2),cx=w/2,cy=((journeys.length>1?46:20)+h-36)/2;\n'
        '    ctx.beginPath();for(let i=0;i<=Math.max(80,Math.floor(turns*64));i++){const t=i/Math.max(80,Math.floor(turns*64)),theta=t*turns*Math.PI*2,r=a+b*theta,x=cx+r*Math.cos(theta-Math.PI/2),y=cy+r*Math.sin(theta-Math.PI/2);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle=\'rgba(56,189,248,.32)\';ctx.lineWidth=2;ctx.stroke();\n'
        '    scene.forEach((m,i)=>drawMarker(m,i===selectedIndex));\n'
        '    const current=rows.filter(r=>String(r.status||\'\').toLowerCase().replace(/[\\s-]+/g,\'_\')!==\'not_started\').at(-1);\n'
        '    const highest=rows.reduce((best,r)=>!best||num(r.metric_value,0)>num(best.metric_value,0)?r:best,null);\n'
        '    const avg=rows.length?rows.reduce((s,r)=>s+num(r.progress_pct,0),0)/rows.length:0;\n'
        '    const delayed=rows.filter(r=>String(r.status||\'\').toLowerCase().replace(/[\\s-]+/g,\'_\')===\'delayed\'||variance(r)>0).length;\n'
        '    ctx.fillStyle=\'rgba(226,246,255,.82)\';ctx.font=\'11px system-ui\';ctx.textAlign=\'left\';ctx.fillText(\'Milestones: \'+rows.length+\' · Avg progress: \'+avg.toFixed(0)+\'%\',12,h-14);\n'
        '    const footer=(current?\'Current: \'+current.stage:\'\')+(highest?((current?\' · \':\'\')+\'Highest value: \'+highest.stage):\'\')+\' · Delayed: \'+delayed;ctx.textAlign=\'right\';ctx.fillText(footer,w-12,h-14);\n'
        '  } else {ctx.fillStyle=\'#cbd5e1\';ctx.font=\'13px system-ui\';ctx.textAlign=\'center\';ctx.fillText(\'No spiral milestones after filtering.\',w/2,h/2)}\n'
        '  ctx.restore();const warnings=Array.isArray(payload&&payload.summary&&payload.summary.warnings)?payload.summary.warnings:[];warn.textContent=warnings.join(\' \');if(scene.length>0&&scene.length<3)warn.textContent=\'Fewer than 3 milestones — spiral story may be less meaningful.\'}\n'
        'function drawMarker(m,highlighted){const r=m.record,progress=Math.max(0,Math.min(100,num(r.progress_pct,0)))/100,risk=num(r.risk_score,-1),status=String(r.status||\'\').toLowerCase().replace(/[\\s-]+/g,\'_\');\n'
        '  if(cfg.show_risk_glow&&risk>=RISK_THRESHOLD){const glow=ctx.createRadialGradient(m.x,m.y,m.radius*.4,m.x,m.y,m.radius*2.2);glow.addColorStop(0,\'rgba(248,113,113,.38)\');glow.addColorStop(1,\'rgba(248,113,113,0)\');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(m.x,m.y,m.radius*2.2,0,Math.PI*2);ctx.fill()}\n'
        '  ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.fillStyle=\'rgba(15,23,42,.95)\';ctx.fill();ctx.save();ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.clip();ctx.fillStyle=highlighted?\'rgba(224,242,254,.9)\':\'rgba(56,189,248,.62)\';ctx.fillRect(m.x-m.radius,m.y+m.radius-m.radius*2*progress,m.radius*2,m.radius*2*progress);ctx.restore();\n'
        '  ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.lineWidth=highlighted?3:2;ctx.strokeStyle=STATUS_STROKE[status]||\'rgba(148,163,184,.8)\';ctx.stroke();\n'
        '  if(cfg.show_variance&&variance(r)!==0){ctx.beginPath();ctx.moveTo(m.x+m.radius*.7,m.y-m.radius*.7);ctx.lineTo(m.x+m.radius*1.25,m.y-m.radius*1.25);ctx.strokeStyle=variance(r)>0?\'#f87171\':\'#34d399\';ctx.lineWidth=2;ctx.stroke()}\n'
        '  if(cfg.show_labels){ctx.fillStyle=\'#e2f6ff\';ctx.font=\'10px system-ui\';ctx.textAlign=\'center\';ctx.fillText(String(r.stage||\'\'),m.x,m.y+m.radius+13)} }\n'
        'function hit(x,y){const p={x:(x-panX)/zoom,y:(y-panY)/zoom};for(let i=scene.length-1;i>=0;i--){const m=scene[i];if(Math.hypot(p.x-m.x,p.y-m.y)<=m.radius+5)return m}return null}\n'
        'function announceIndex(index){const rows=selectedRecords();if(index<0||index>=rows.length){announce.textContent=\'Milestone selection cleared.\';return}selectedIndex=index;const r=rows[index];announce.textContent=\'Milestone \'+(index+1)+\' of \'+rows.length+\'. \'+details(r);draw()}\n'
        'function showTip(m,x,y){if(!m){tip.style.display=\'none\';return}tip.innerHTML=\'<strong>\'+esc(m.record.stage||\'Milestone\')+\'</strong><br>\'+esc(details(m.record));tip.style.display=\'block\';tip.style.left=Math.max(8,Math.min(x+12,wrap.clientWidth-290))+\'px\';tip.style.top=Math.max(8,Math.min(y+12,wrap.clientHeight-130))+\'px\'}\n'
        'function initSelector(){if(journeys.length<2)return;toolbar.style.display=\'flex\';journeys.forEach(name=>{const option=document.createElement(\'option\');option.value=String(name);option.textContent=String(name);select.appendChild(option)});select.value=selectedJourney;select.addEventListener(\'change\',()=>{selectedJourney=select.value;selectedIndex=-1;draw();announce.textContent=\'Journey selected: \'+selectedJourney})}\n'
        'function reset(){panX=0;panY=0;zoom=1;draw()}\n'
        'function pointer(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}\n'
        'canvas.addEventListener(\'mousedown\',e=>{const p=pointer(e);dragging=true;didDrag=false;startX=p.x;startY=p.y;baseX=panX;baseY=panY;canvas.style.cursor=\'grabbing\'});\n'
        'window.addEventListener(\'mousemove\',e=>{const p=pointer(e);if(dragging){if(Math.hypot(p.x-startX,p.y-startY)>4)didDrag=true;if(didDrag){panX=baseX+p.x-startX;panY=baseY+p.y-startY;draw()}return}const marker=hit(p.x,p.y);canvas.style.cursor=marker?\'pointer\':\'grab\';showTip(marker,p.x,p.y)});\n'
        'window.addEventListener(\'mouseup\',e=>{if(!dragging)return;dragging=false;canvas.style.cursor=\'grab\';const p=pointer(e);if(!didDrag){const marker=hit(p.x,p.y);if(marker)announceIndex(marker.index)}});\n'
        'canvas.addEventListener(\'mouseleave\',()=>{if(!dragging)tip.style.display=\'none\'});\n'
        'canvas.addEventListener(\'dblclick\',reset);\n'
        'canvas.addEventListener(\'wheel\',e=>{e.preventDefault();const p=pointer(e),worldX=(p.x-panX)/zoom,worldY=(p.y-panY)/zoom;zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom*(e.deltaY<0?1.1:.9)));panX=p.x-worldX*zoom;panY=p.y-worldY*zoom;draw()},{passive:false});\n'
        'wrap.addEventListener(\'keydown\',e=>{const rows=selectedRecords();if(!rows.length)return;let next=selectedIndex;\n'
        '  if(e.key===\'ArrowRight\'||e.key===\'ArrowDown\'){next=Math.min(rows.length-1,selectedIndex+1)}else if(e.key===\'ArrowLeft\'||e.key===\'ArrowUp\'){next=Math.max(0,selectedIndex<0?0:selectedIndex-1)}else if(e.key===\'Home\'){next=0}else if(e.key===\'End\'){next=rows.length-1}else if(e.key===\'Escape\'){selectedIndex=-1;reset();announce.textContent=\'Milestone selection cleared.\';e.preventDefault();return}else if(e.key===\'+\'||e.key===\'=\'){zoom=Math.min(MAX_ZOOM,zoom*1.15);draw();e.preventDefault();return}else if(e.key===\'-\'){zoom=Math.max(MIN_ZOOM,zoom/1.15);draw();e.preventDefault();return}else if(e.key===\'Enter\'||e.key===\' \'){if(selectedIndex<0)next=0;announceIndex(next);e.preventDefault();return}else{return}\n'
        '  e.preventDefault();announceIndex(next)});\n'
        'initSelector();window.addEventListener(\'resize\',resize);resize();\n'
        '</script></body></html>\n'
    )
    vdab_journeytracker_html = vdab_journeytracker_html.replace('__SPIRAL_PAYLOAD__', json.dumps(vdab_journeytracker_payload, default=str, allow_nan=False).replace('<', '\\u003c'))
    components.html(vdab_journeytracker_html, height=560, scrolling=False)
