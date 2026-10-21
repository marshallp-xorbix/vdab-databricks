import streamlit as st
import streamlit.components.v1 as components
import json
import os
import pandas as pd
import re
import time
import urllib.error
import urllib.parse
import urllib.request

st.set_page_config(page_title='Portfolio story', layout='wide')
st.title('Portfolio story')

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

_vdab_lbl_vdab_amoebastory1 = ui_overrides.get('labels', {}).get('amoebaStory1', None)
_vdab_disp_lbl_vdab_amoebastory1 = _vdab_lbl_vdab_amoebastory1 if _vdab_lbl_vdab_amoebastory1 is not None else 'Portfolio story'
st.subheader(_vdab_disp_lbl_vdab_amoebastory1)
try:
    vdab_amoebastory1_data = _vdab_sql_query_df('main', 'sales', 'portfolio', 100, query_statement='SELECT `entity_id` AS entity_id, MAX(`entity_name`) AS entity_label, MAX(`segment`) AS category, SUM(`size`) AS size_value, AVG(`x_position`) AS x_value, AVG(`y_position`) AS y_value, AVG(`change_value`) AS change_value FROM `main`.`sales`.`portfolio` GROUP BY `entity_id`')
except RuntimeError as vdab_error_vdab_amoebastory1:
    st.error(str(vdab_error_vdab_amoebastory1))
    vdab_amoebastory1_data = pd.DataFrame()
if vdab_amoebastory1_data is None or vdab_amoebastory1_data.empty or 'entity_id' not in vdab_amoebastory1_data.columns:
    st.info('No AmoebaStory records returned. Check bindings and field mappings.')
else:
    vdab_amoebastory1_df = vdab_amoebastory1_data.copy()
    for _vdab_col in ['size_value', 'x_value', 'y_value', 'change_value', 'health_score', 'risk_score']:
        if _vdab_col in vdab_amoebastory1_df.columns:
            vdab_amoebastory1_df[_vdab_col] = pd.to_numeric(vdab_amoebastory1_df[_vdab_col], errors='coerce')
    vdab_amoebastory1_df = vdab_amoebastory1_df.dropna(subset=['entity_id'])
    vdab_amoebastory1_records = []
    for _, _vdab_row in vdab_amoebastory1_df.iterrows():
        _vdab_record = {
            'entity_id': None if pd.isna(_vdab_row.get('entity_id')) else _vdab_row.get('entity_id'),
            'entity_label': '' if pd.isna(_vdab_row.get('entity_label', '')) else str(_vdab_row.get('entity_label', '')),
            'category': '' if pd.isna(_vdab_row.get('category', '')) else str(_vdab_row.get('category', '')),
            'size_value': None if pd.isna(_vdab_row.get('size_value')) else float(_vdab_row.get('size_value')),
            'x_value': None if pd.isna(_vdab_row.get('x_value')) else float(_vdab_row.get('x_value')),
            'y_value': None if pd.isna(_vdab_row.get('y_value')) else float(_vdab_row.get('y_value')),
            'change_value': None if pd.isna(_vdab_row.get('change_value')) else float(_vdab_row.get('change_value')),
        }
        for _vdab_optional in ('health_score', 'risk_score'):
            if _vdab_optional in vdab_amoebastory1_df.columns and not pd.isna(_vdab_row.get(_vdab_optional)):
                _vdab_record[_vdab_optional] = float(_vdab_row.get(_vdab_optional))
        vdab_amoebastory1_records.append(_vdab_record)
    vdab_amoebastory1_payload = {
        'records': vdab_amoebastory1_records,
        'visualConfig': {
        'layout_mode': 'hybrid',
        'size_scale': 'sqrt',
        'min_radius_px': 42,
        'max_radius_px': 130,
        'color_by': 'category',
        'pulse_by': 'risk_score',
        'pulse_threshold': 50,
        'pulse_threshold_mode': 'above',
        'shape_variation': 0.35,
        'label_mode': 'compact',
        'animation_enabled': True,
        'animation_speed': 1,
        },
        'summary': {'total_entities': len(vdab_amoebastory1_records), 'excluded_rows': 0, 'warnings': []},
    }
    vdab_amoebastory1_html = (
        '<!DOCTYPE html>\n'
        '<html><head><meta charset="utf-8"/>\n'
        '<style>\n'
        'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}\n'
        '#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#061827;box-shadow:0 1px 2px rgba(15,23,42,.08);}\n'
        'canvas{display:block;width:100%;height:100%;touch-action:none;}\n'
        '#tip{display:none;position:absolute;pointer-events:none;z-index:3;background:rgba(6,24,39,.94);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:240px;line-height:1.35;}\n'
        '#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}\n'
        '#legend{position:absolute;left:10px;bottom:28px;z-index:3;display:flex;flex-wrap:wrap;gap:6px;max-width:75%;}\n'
        '.leg{cursor:pointer;padding:3px 8px;border-radius:999px;font-size:11px;color:#061827;opacity:.95;user-select:none;}\n'
        '.leg.off{opacity:.35;text-decoration:line-through;}\n'
        '</style></head><body>\n'
        '<div id="wrap"><canvas id="c"></canvas><div id="tip"></div><div id="legend"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset</div></div>\n'
        '<script>\n'
        'const payload = __AMOEBA_PAYLOAD__;\n'
        'const canvas = document.getElementById(\'c\');\n'
        'const tip = document.getElementById(\'tip\');\n'
        'const legendEl = document.getElementById(\'legend\');\n'
        'const ctx = canvas.getContext(\'2d\');\n'
        'const cfg = Object.assign({\n'
        '  layout_mode: \'hybrid\', size_scale: \'sqrt\', min_radius_px: 42, max_radius_px: 130,\n'
        '  color_by: \'category\', pulse_by: \'risk_score\', pulse_threshold: 50,\n'
        '  pulse_threshold_mode: \'above\', shape_variation: 0.35,\n'
        '  label_mode: \'compact\', animation_enabled: true, animation_speed: 1\n'
        '}, (payload && payload.visualConfig) || {});\n'
        'let records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];\n'
        'const hiddenCats = new Set();\n'
        'let selectedId = null;\n'
        'let hoverId = null;\n'
        'let t0 = performance.now();\n'
        'let panX = 0, panY = 0, zoom = 1;\n'
        'let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;\n'
        'let layoutCache = { key: \'\', nodes: [], W: 0, H: 0 };\n'
        'const CATEGORY_COLORS = [\'#2dd4bf\',\'#38bdf8\',\'#a78bfa\',\'#f472b6\',\'#fbbf24\',\'#34d399\',\'#fb7185\',\'#60a5fa\'];\n'
        'const MIN_ZOOM = 0.55, MAX_ZOOM = 2.75;\n'
        '\n'
        'function hashStr(s){ let h=0; for(let i=0;i<String(s).length;i++){ h=((h<<5)-h)+String(s).charCodeAt(i); h|=0;} return Math.abs(h); }\n'
        'function catColor(cat){ return CATEGORY_COLORS[hashStr(cat)%CATEGORY_COLORS.length]; }\n'
        'function healthColor(h){ const v=Math.max(0,Math.min(100,Number(h)||0)); const r=Math.round(255*(1-v/100)); const g=Math.round(180*(v/100)+40); return `rgb(${r},${g},120)`; }\n'
        'function scaleSize(v,minV,maxV){\n'
        '  const lo=cfg.min_radius_px||42, hi=cfg.max_radius_px||130;\n'
        '  if(!(maxV>minV)) return (lo+hi)/2;\n'
        '  let t=(v-minV)/(maxV-minV);\n'
        '  const mode=(cfg.size_scale||\'sqrt\').toLowerCase();\n'
        '  if(mode===\'log\'){ t=Math.log1p(t*9)/Math.log(10); }\n'
        '  else if(mode===\'sqrt\'){ t=Math.sqrt(t); }\n'
        '  return lo+t*(hi-lo);\n'
        '}\n'
        'function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }\n'
        '\n'
        'function layout(nodes, W, H){\n'
        '  const maxR = Math.max(...nodes.map(n=>n._r), cfg.min_radius_px||42);\n'
        '  const pad = Math.max(28, maxR + 16);\n'
        '  const mode=(cfg.layout_mode||\'hybrid\').toLowerCase();\n'
        '  const cats=[...new Set(nodes.map(n=>String(n.category||\'Other\')))];\n'
        '  const xs=nodes.map(n=>num(n.x_value,0)), ys=nodes.map(n=>num(n.y_value,0));\n'
        '  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);\n'
        '  const nx=(x)=> pad+((x-minX)/((maxX-minX)||1))*(W-2*pad);\n'
        '  const ny=(y)=> H-pad-((y-minY)/((maxY-minY)||1))*(H-2*pad);\n'
        '  nodes.forEach((n)=>{\n'
        '    const scatterX=nx(num(n.x_value,0)), scatterY=ny(num(n.y_value,0));\n'
        '    const ci=cats.indexOf(String(n.category||\'Other\'));\n'
        '    const cols=Math.ceil(Math.sqrt(Math.max(cats.length,1)));\n'
        '    const rows=Math.ceil(cats.length/cols);\n'
        '    const cx=pad+((ci%cols)+0.5)*((W-2*pad)/cols);\n'
        '    const cy=pad+(Math.floor(ci/cols)+0.5)*((H-2*pad)/rows);\n'
        '    const jitter=((hashStr(n.entity_id)-5e8)/1e9)*Math.min(W,H)*0.06;\n'
        '    if(mode===\'scatter\'){ n._x=scatterX; n._y=scatterY; }\n'
        '    else if(mode===\'cluster\'){ n._x=cx+jitter; n._y=cy+jitter*0.7; }\n'
        '    else { n._x=scatterX*0.65+cx*0.35+jitter*0.5; n._y=scatterY*0.65+cy*0.35+jitter*0.4; }\n'
        '  });\n'
        '  for(let iter=0; iter<18; iter++){\n'
        '    for(let i=0;i<nodes.length;i++){\n'
        '      for(let j=i+1;j<nodes.length;j++){\n'
        '        const a=nodes[i], b=nodes[j];\n'
        '        const dx=b._x-a._x, dy=b._y-a._y;\n'
        '        const dist=Math.hypot(dx,dy)||0.01;\n'
        '        const minD=(a._r+b._r)*0.92;\n'
        '        if(dist<minD){\n'
        '          const push=(minD-dist)*0.5;\n'
        '          const ux=dx/dist, uy=dy/dist;\n'
        '          a._x-=ux*push; a._y-=uy*push; b._x+=ux*push; b._y+=uy*push;\n'
        '        }\n'
        '      }\n'
        '    }\n'
        '  }\n'
        '  // Keep full blob (center ± radius) inside the plot so edges are not clipped at rest.\n'
        '  nodes.forEach(n=>{\n'
        '    const m = n._r + 8;\n'
        '    n._x = Math.min(W - m, Math.max(m, n._x));\n'
        '    n._y = Math.min(H - m, Math.max(m, n._y));\n'
        '  });\n'
        '}\n'
        '\n'
        'function blobPath(cx,cy,r,seed,variation){\n'
        '  const pts=8; const v=Math.max(0,Math.min(1,variation||0.35));\n'
        '  const path=[];\n'
        '  for(let i=0;i<pts;i++){\n'
        '    const ang=(i/pts)*Math.PI*2;\n'
        '    // Static organic outline — no time-based rotation/wobble.\n'
        '    const wobble=1+v*0.35*Math.sin(ang*3+seed)+v*0.2*Math.cos(ang*2-seed);\n'
        '    path.push([cx+Math.cos(ang)*r*wobble, cy+Math.sin(ang)*r*wobble]);\n'
        '  }\n'
        '  return path;\n'
        '}\n'
        'function drawBlob(path, fill, stroke, lineW){\n'
        '  if(path.length<3) return;\n'
        '  ctx.beginPath();\n'
        '  ctx.moveTo(path[0][0], path[0][1]);\n'
        '  for(let i=0;i<path.length;i++){\n'
        '    const p1=path[(i+1)%path.length], p2=path[(i+2)%path.length];\n'
        '    const mx=(p1[0]+p2[0])/2, my=(p1[1]+p2[1])/2;\n'
        '    ctx.quadraticCurveTo(p1[0], p1[1], mx, my);\n'
        '  }\n'
        '  ctx.closePath();\n'
        '  ctx.fillStyle=fill; ctx.fill();\n'
        '  if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=lineW||2; ctx.stroke(); }\n'
        '}\n'
        '\n'
        'function prepare(){\n'
        '  const visible=records.filter(r=>!hiddenCats.has(String(r.category||\'Other\')));\n'
        '  const sizes=visible.map(r=>num(r.size_value,0));\n'
        '  const minS=Math.min(...sizes,0), maxS=Math.max(...sizes,1);\n'
        '  visible.forEach(r=>{\n'
        '    r._r=scaleSize(num(r.size_value,0), minS, maxS);\n'
        '    r._seed=hashStr(r.entity_id)*0.001;\n'
        '  });\n'
        '  return visible;\n'
        '}\n'
        '\n'
        'function layoutKey(nodes, W, H){\n'
        '  return W+\'x\'+H+\'|\'+nodes.map(n=>n.entity_id).join(\',\')+\'|\'+ (cfg.layout_mode||\'hybrid\') +\'|\'+hiddenCats.size;\n'
        '}\n'
        '\n'
        'function getLaidOutNodes(W, H){\n'
        '  const nodes = prepare();\n'
        '  const key = layoutKey(nodes, W, H);\n'
        '  if(layoutCache.key === key && layoutCache.nodes.length === nodes.length){\n'
        '    return layoutCache.nodes;\n'
        '  }\n'
        '  layout(nodes, W, H);\n'
        '  layoutCache = { key, nodes, W, H };\n'
        '  return nodes;\n'
        '}\n'
        '\n'
        'function resize(){\n'
        '  const wrap=document.getElementById(\'wrap\');\n'
        '  const dpr=window.devicePixelRatio||1;\n'
        '  const W=wrap.clientWidth||640, H=wrap.clientHeight||520;\n'
        '  canvas.width=W*dpr; canvas.height=H*dpr;\n'
        '  canvas.style.width=W+\'px\'; canvas.style.height=H+\'px\';\n'
        '  ctx.setTransform(dpr,0,0,dpr,0,0);\n'
        '  return {W,H};\n'
        '}\n'
        '\n'
        'function screenToWorld(sx, sy){\n'
        '  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };\n'
        '}\n'
        '\n'
        'function buildLegend(){\n'
        '  legendEl.innerHTML=\'\';\n'
        '  const cats=[...new Set(records.map(r=>String(r.category||\'Other\')))];\n'
        '  cats.forEach(cat=>{\n'
        '    const el=document.createElement(\'div\');\n'
        '    el.className=\'leg\'+(hiddenCats.has(cat)?\' off\':\'\');\n'
        '    el.style.background=catColor(cat);\n'
        '    el.textContent=cat;\n'
        '    el.onclick=(ev)=>{\n'
        '      ev.stopPropagation();\n'
        '      if(hiddenCats.has(cat)) hiddenCats.delete(cat); else hiddenCats.add(cat);\n'
        '      el.classList.toggle(\'off\');\n'
        '      layoutCache.key = \'\';\n'
        '    };\n'
        '    legendEl.appendChild(el);\n'
        '  });\n'
        '}\n'
        '\n'
        'function hitTest(nodes, wx, wy){\n'
        '  let best=null, bestD=1e9;\n'
        '  for(const n of nodes){\n'
        '    const d=Math.hypot(n._x-wx,n._y-wy);\n'
        '    if(d<n._r && d<bestD){ best=n; bestD=d; }\n'
        '  }\n'
        '  return best;\n'
        '}\n'
        '\n'
        'function render(){\n'
        '  const {W,H}=resize();\n'
        '  const nodes=getLaidOutNodes(W,H);\n'
        '  const t=performance.now()-t0;\n'
        '  ctx.clearRect(0,0,W,H);\n'
        '  const g=ctx.createLinearGradient(0,0,W,H);\n'
        '  g.addColorStop(0,\'#061827\'); g.addColorStop(1,\'#0a2a3a\');\n'
        '  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);\n'
        '\n'
        '  ctx.save();\n'
        '  ctx.translate(panX, panY);\n'
        '  ctx.scale(zoom, zoom);\n'
        '\n'
        '  nodes.forEach(n=>{\n'
        '    const threshold=num(cfg.pulse_threshold,50);\n'
        '    const mode=(cfg.pulse_threshold_mode||\'above\').toLowerCase();\n'
        '    const risk=num(n.risk_score,0);\n'
        '    const meetsThreshold=mode===\'below\' ? risk<threshold : risk>threshold;\n'
        '    const pulseOn=(cfg.pulse_by||\'risk_score\')!==\'none\' && meetsThreshold && cfg.animation_enabled;\n'
        '    const speed=Math.max(0.25, Math.min(3, num(cfg.animation_speed,1)));\n'
        '    const pulse=pulseOn? (0.55+0.45*Math.sin(t*0.005*speed+n._seed)) : 1;\n'
        '    const base=(cfg.color_by===\'health_score\' && n.health_score!=null)\n'
        '      ? healthColor(n.health_score) : catColor(n.category);\n'
        '    const alpha= selectedId && String(n.entity_id)!==String(selectedId) ? 0.35 : 0.72;\n'
        '    const fill=`rgba(${toRgb(base)},${alpha})`;\n'
        '    const path=blobPath(n._x,n._y,n._r*pulse,n._seed,cfg.shape_variation);\n'
        '    const stroke=(String(hoverId)===String(n.entity_id)||selectedId===String(n.entity_id))\n'
        '      ? \'#e2f6ff\'\n'
        '      : (pulseOn ? \'rgba(255,80,120,.85)\' : \'rgba(255,255,255,.18)\');\n'
        '    drawBlob(path, fill, stroke, selectedId===String(n.entity_id)?3:2);\n'
        '\n'
        '    const labelMode=(cfg.label_mode||\'compact\').toLowerCase();\n'
        '    if(labelMode!==\'none\'){\n'
        '      ctx.fillStyle=\'#f0f9ff\'; ctx.font=\'600 11px system-ui,sans-serif\'; ctx.textAlign=\'center\'; ctx.textBaseline=\'middle\';\n'
        '      const label=String(n.entity_label||n.entity_id||\'\');\n'
        '      const short=label.length>14?label.slice(0,12)+\'…\':label;\n'
        '      ctx.fillText(short, n._x, n._y - (labelMode===\'full\'?6:0));\n'
        '      if(labelMode===\'full\'){\n'
        '        ctx.font=\'10px system-ui,sans-serif\'; ctx.fillStyle=\'rgba(226,246,255,.85)\';\n'
        '        const ch=num(n.change_value,0);\n'
        '        ctx.fillText((ch>=0?\'+\':\'\')+ch.toFixed(1)+\'%\', n._x, n._y+10);\n'
        '      }\n'
        '    }\n'
        '  });\n'
        '  ctx.restore();\n'
        '  requestAnimationFrame(render);\n'
        '}\n'
        '\n'
        'function toRgb(c){\n'
        '  if(c.startsWith(\'#\')){\n'
        '    const h=c.slice(1); const n=parseInt(h.length===3?h.split(\'\').map(x=>x+x).join(\'\'):h,16);\n'
        '    return [(n>>16)&255,(n>>8)&255,n&255].join(\',\');\n'
        '  }\n'
        '  const m=c.match(/(\\d+)/g); return m?m.slice(0,3).join(\',\'):\'45,212,191\';\n'
        '}\n'
        '\n'
        'function pointerPos(e){\n'
        '  const rect=canvas.getBoundingClientRect();\n'
        '  return { x:e.clientX-rect.left, y:e.clientY-rect.top };\n'
        '}\n'
        '\n'
        'canvas.addEventListener(\'mousedown\', (e)=>{\n'
        '  if(e.button!==0) return;\n'
        '  dragging = true;\n'
        '  didDrag = false;\n'
        '  const p = pointerPos(e);\n'
        '  dragStartX = p.x; dragStartY = p.y;\n'
        '  panStartX = panX; panStartY = panY;\n'
        '});\n'
        'window.addEventListener(\'mousemove\', (e)=>{\n'
        '  const p = pointerPos(e);\n'
        '  if(dragging){\n'
        '    const dx = p.x - dragStartX, dy = p.y - dragStartY;\n'
        '    if(Math.hypot(dx,dy) > 4){\n'
        '      didDrag = true;\n'
        '      panX = panStartX + dx;\n'
        '      panY = panStartY + dy;\n'
        '      tip.style.display=\'none\';\n'
        '      canvas.style.cursor=\'grabbing\';\n'
        '    }\n'
        '    return;\n'
        '  }\n'
        '  const {W,H}=resize();\n'
        '  const nodes=getLaidOutNodes(W,H);\n'
        '  const world = screenToWorld(p.x, p.y);\n'
        '  const hit=hitTest(nodes, world.x, world.y);\n'
        '  hoverId=hit?hit.entity_id:null;\n'
        '  canvas.style.cursor=hit?\'pointer\':\'grab\';\n'
        '  if(hit){\n'
        '    tip.style.display=\'block\';\n'
        '    tip.style.left=Math.min(p.x+12, W-220)+\'px\';\n'
        '    tip.style.top=Math.min(p.y+12, H-90)+\'px\';\n'
        '    tip.innerHTML=`<b>${esc(hit.entity_label||hit.entity_id)}</b><br/>${esc(hit.category||\'\')}<br/>size: ${num(hit.size_value,0).toLocaleString()}<br/>x: ${num(hit.x_value,0)} · y: ${num(hit.y_value,0)}<br/>change: ${num(hit.change_value,0)}`\n'
        '      +(hit.health_score!=null?`<br/>health: ${num(hit.health_score,0)}`:\'\')\n'
        '      +(hit.risk_score!=null?`<br/>risk: ${num(hit.risk_score,0)}`:\'\');\n'
        '  } else tip.style.display=\'none\';\n'
        '});\n'
        'window.addEventListener(\'mouseup\', (e)=>{\n'
        '  if(!dragging) return;\n'
        '  dragging = false;\n'
        '  canvas.style.cursor=\'grab\';\n'
        '  if(didDrag) return;\n'
        '  const p = pointerPos(e);\n'
        '  const {W,H}=resize();\n'
        '  const nodes=getLaidOutNodes(W,H);\n'
        '  const world = screenToWorld(p.x, p.y);\n'
        '  const hit=hitTest(nodes, world.x, world.y);\n'
        '  selectedId=hit?String(hit.entity_id):null;\n'
        '});\n'
        'canvas.addEventListener(\'mouseleave\', ()=>{ tip.style.display=\'none\'; hoverId=null; });\n'
        'canvas.addEventListener(\'dblclick\', ()=>{ panX=0; panY=0; zoom=1; });\n'
        'canvas.addEventListener(\'wheel\', (e)=>{\n'
        '  e.preventDefault();\n'
        '  const p = pointerPos(e);\n'
        '  const before = screenToWorld(p.x, p.y);\n'
        '  const factor = e.deltaY < 0 ? 1.08 : 1/1.08;\n'
        '  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));\n'
        '  panX = p.x - before.x * zoom;\n'
        '  panY = p.y - before.y * zoom;\n'
        '}, { passive: false });\n'
        '\n'
        'function esc(s){ return String(s).replace(/[&<>"\']/g, c=>({ \'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\' }[c])); }\n'
        '\n'
        'buildLegend();\n'
        'requestAnimationFrame(render);\n'
        '</script></body></html>\n'
    )
    vdab_amoebastory1_html = vdab_amoebastory1_html.replace('__AMOEBA_PAYLOAD__', json.dumps(vdab_amoebastory1_payload, default=str).replace('<', '\\u003c'))
    components.html(vdab_amoebastory1_html, height=560, scrolling=False)
