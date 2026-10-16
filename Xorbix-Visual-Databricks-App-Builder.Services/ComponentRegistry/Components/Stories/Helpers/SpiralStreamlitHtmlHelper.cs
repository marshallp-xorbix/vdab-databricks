namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds the self-contained HTML/JS canvas renderer for Spiral Story (Streamlit components.html).
/// Payload is injected at runtime via the <c>__SPIRAL_PAYLOAD__</c> placeholder.
/// Archimedean spiral layout is kept in sync with client <c>spiralCanvasDraw.ts</c>.
/// </summary>
internal static class SpiralStreamlitHtmlHelper
{
    public const string PayloadPlaceholder = "__SPIRAL_PAYLOAD__";

    public const int DefaultHeightPx = 560;

    /// <summary>
    /// Returns a Python triple-quoted HTML string literal (content only; caller wraps assignment).
    /// </summary>
    public static string GetHtmlTemplatePythonLiteral() =>
        StoryStreamlitHtmlChrome.EscapeForPythonTripleQuoted(GetHtmlTemplate());

    public static string GetHtmlTemplate() =>
        StoryStreamlitHtmlChrome.BuildDocument(
            wrapBackground: "#0b1220",
            tipBackground: "rgba(11,18,32,.96)",
            tipZIndex: 4,
            tipMaxWidthPx: 280,
            extraCss: """
#toolbar{position:absolute;top:8px;left:10px;right:10px;z-index:5;display:none;align-items:center;gap:8px;}
#toolbar label{font-size:11px;color:rgba(226,246,255,.7);white-space:nowrap;}
#journeySelect{flex:1;min-width:0;max-width:320px;background:#0f172a;color:#e2f6ff;border:1px solid rgba(148,163,184,.45);border-radius:6px;padding:4px 8px;font-size:12px;}
#warn{position:absolute;left:10px;bottom:8px;right:180px;z-index:3;font-size:10px;color:rgba(251,191,36,.85);pointer-events:none;}
""",
            wrapInnerHtml: "<div id=\"toolbar\"><label for=\"journeySelect\">Journey</label><select id=\"journeySelect\"></select></div><canvas id=\"c\"></canvas><div id=\"tip\"></div><div id=\"warn\"></div><div id=\"hint\">Drag to pan · scroll to zoom · double-click to reset</div>",
            rendererScript: GetRendererScript());

    private static string GetRendererScript() =>
        """

const payload = __SPIRAL_PAYLOAD__;
const canvas = document.getElementById('c');
const tip = document.getElementById('tip');
const warn = document.getElementById('warn');
const toolbar = document.getElementById('toolbar');
const journeySelect = document.getElementById('journeySelect');
const ctx = canvas.getContext('2d');
const cfg = Object.assign({
  show_labels: true, show_risk_glow: true, show_variance: true, space_by_timeline: false
}, (payload && payload.visualConfig) || {});
const allRecords = Array.isArray(payload && payload.records) ? payload.records.slice() : [];
const journeys = Array.isArray(payload && payload.journeys) ? payload.journeys.slice() : [];
let selectedJourney = String((payload && payload.selected_journey) || '');
let summary = (payload && payload.summary) || {};
let hoverKey = null;
let panX = 0, panY = 0, zoom = 1;
let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
const RISK_THRESHOLD = 70;
const MIN_ZOOM = 0.45, MAX_ZOOM = 2.5;
const STATUS_STROKE = {
  complete: '#34d399',
  active: '#38bdf8',
  delayed: '#fbbf24',
  blocked: '#f87171',
  not_started: 'rgba(148,163,184,.55)'
};

function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function dpr(){ return Math.max(1, window.devicePixelRatio || 1); }
function hasJourneySelect(){ return journeys.length > 1; }
function layout(){
  const r = canvas.parentElement.getBoundingClientRect();
  return { w: r.width, h: r.height, p: { l: 24, r: 24, t: hasJourneySelect() ? 44 : 20, b: 36 } };
}
function resize(){
  const r = canvas.parentElement.getBoundingClientRect();
  const scale = dpr();
  canvas.width = Math.max(1, Math.floor(r.width * scale));
  canvas.height = Math.max(1, Math.floor(r.height * scale));
  ctx.setTransform(scale,0,0,scale,0,0);
  draw();
  return { W: r.width, H: r.height };
}
function screenToWorld(sx, sy){
  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
}
function pointerPos(e){
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function normalizeStatus(s){
  return String(s || '').toLowerCase().replace(/[\\s-]+/g, '_');
}
function activeRecords(){
  if(!selectedJourney) return allRecords.slice();
  return allRecords.filter(r => String(r.journey_name) === selectedJourney);
}
function sortedRecords(recs){
  return recs.slice().sort((a,b) => String(a.timeline||'').localeCompare(String(b.timeline||'')));
}
function parseTimelineValue(raw){
  if(raw == null || raw === '') return null;
  const s = String(raw).trim();
  const ms = Date.parse(s);
  if(!Number.isNaN(ms)) return ms;
  const n = Number(s);
  if(Number.isFinite(n)) return n;
  return null;
}
function placementFractions(sorted, spaceByTimeline){
  const n = sorted.length;
  if(n <= 1) return [0];
  const equal = () => sorted.map((_, i) => i / (n - 1));
  if(!spaceByTimeline) return equal();
  const parsed = sorted.map(r => parseTimelineValue(r.timeline));
  let values = null;
  if(parsed.every(v => v != null)){
    values = parsed;
  } else {
    const unique = [];
    sorted.forEach(r => {
      const key = String(r.timeline || '');
      if(unique.indexOf(key) < 0) unique.push(key);
    });
    unique.sort((a,b) => a.localeCompare(b));
    const rank = {};
    unique.forEach((k, i) => { rank[k] = i; });
    values = sorted.map(r => rank[String(r.timeline || '')]);
  }
  const minV = Math.min.apply(null, values);
  const maxV = Math.max.apply(null, values);
  if(maxV === minV) return equal();
  return values.map(v => (v - minV) / (maxV - minV));
}
function computeSummary(recs, journeyName){
  const sorted = sortedRecords(recs);
  const warnings = [];
  if(sorted.length > 0 && sorted.length < 3){
    warnings.push('Fewer than 3 milestones — spiral story may be less meaningful.');
  }
  let current = null;
  sorted.forEach(r => {
    const st = normalizeStatus(r.status);
    if(st !== 'not_started') current = r.stage;
  });
  if(current == null && sorted.length) current = sorted[sorted.length - 1].stage;
  let highest = null;
  sorted.forEach(r => {
    if(!highest || num(r.metric_value,0) > num(highest.metric_value,0)) highest = r;
  });
  const avg = sorted.length
    ? sorted.reduce((s, r) => s + num(r.progress_pct, 0), 0) / sorted.length
    : 0;
  const delayed = sorted.filter(r =>
    normalizeStatus(r.status) === 'delayed' || num(r.schedule_variance_days, 0) > 0
  ).length;
  return {
    journey_name: journeyName || '',
    milestone_count: sorted.length,
    current_stage: current,
    avg_progress: avg,
    highest_value_milestone: highest
      ? { stage: highest.stage, metric_value: highest.metric_value }
      : null,
    delayed_count: delayed,
    warnings: warnings
  };
}
function buildMarkers(L, recs){
  const sorted = sortedRecords(recs);
  const n = sorted.length;
  const metrics = sorted.map(r => num(r.metric_value, 0));
  const minM = metrics.length ? Math.min.apply(null, metrics) : 0;
  const maxM = metrics.length ? Math.max.apply(null, metrics) : 1;
  const spanM = Math.max(1, maxM - minM);
  const cx = L.w / 2;
  const cy = (L.p.t + (L.h - L.p.b)) / 2;
  const maxR = Math.min(L.w, L.h - L.p.t - L.p.b) * 0.38;
  const a = maxR * 0.08;
  const turns = Math.max(1.6, Math.min(2.8, 1.2 + n * 0.18));
  const b = (maxR - a) / (turns * Math.PI * 2);
  const fracs = placementFractions(sorted, !!cfg.space_by_timeline);
  const markers = [];
  for(let i=0;i<n;i++){
    const rec = sorted[i];
    const t = fracs[i];
    const theta = t * turns * Math.PI * 2;
    const radius = a + b * theta;
    const x = cx + radius * Math.cos(theta - Math.PI / 2);
    const y = cy + radius * Math.sin(theta - Math.PI / 2);
    const metricT = (num(rec.metric_value,0) - minM) / spanM;
    const markerR = 10 + metricT * 14;
    markers.push({ key: String(rec.stage) + '|' + i, rec, x, y, markerR, theta, radius });
  }
  return { markers, cx, cy, a, b, turns, maxR };
}
function drawSpiralPath(scene){
  ctx.beginPath();
  const steps = Math.max(80, Math.floor(scene.turns * 64));
  for(let i=0;i<=steps;i++){
    const t = i / steps;
    const theta = t * scene.turns * Math.PI * 2;
    const r = scene.a + scene.b * theta;
    const x = scene.cx + r * Math.cos(theta - Math.PI / 2);
    const y = scene.cy + r * Math.sin(theta - Math.PI / 2);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.strokeStyle = 'rgba(56,189,248,.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
function drawMarker(m, highlighted){
  const rec = m.rec;
  const progress = Math.max(0, Math.min(100, num(rec.progress_pct, 0))) / 100;
  const status = normalizeStatus(rec.status);
  const risk = num(rec.risk_score, -1);
  const variance = num(rec.schedule_variance_days, 0);
  if(cfg.show_risk_glow && risk >= RISK_THRESHOLD){
    const grd = ctx.createRadialGradient(m.x, m.y, m.markerR * 0.4, m.x, m.y, m.markerR * 2.2);
    grd.addColorStop(0, 'rgba(248,113,113,.35)');
    grd.addColorStop(1, 'rgba(248,113,113,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.markerR * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.markerR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15,23,42,.92)';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.markerR, 0, Math.PI * 2);
  ctx.clip();
  const top = m.y + m.markerR;
  const fillH = m.markerR * 2 * progress;
  ctx.fillStyle = highlighted ? 'rgba(224,242,254,.85)' : 'rgba(56,189,248,.55)';
  ctx.fillRect(m.x - m.markerR, top - fillH, m.markerR * 2, fillH);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.markerR, 0, Math.PI * 2);
  ctx.lineWidth = highlighted ? 2.5 : 2;
  ctx.strokeStyle = STATUS_STROKE[status] || (highlighted ? '#e0f2fe' : 'rgba(148,163,184,.7)');
  ctx.stroke();
  if(cfg.show_variance && variance > 0){
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.markerR + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251,191,36,.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if(cfg.show_labels){
    const label = String(rec.stage || '');
    ctx.fillStyle = 'rgba(226,246,255,.92)';
    ctx.font = '600 11px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label.length > 18 ? label.slice(0,17) + '…' : label, m.x, m.y - m.markerR - 6);
  }
}
function draw(){
  const L = layout();
  const recs = activeRecords();
  summary = computeSummary(recs, selectedJourney);
  ctx.setTransform(dpr(),0,0,dpr(),0,0);
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, L.w, L.h);
  if(recs.length === 0){
    ctx.fillStyle = 'rgba(148,163,184,.8)';
    ctx.textAlign = 'center';
    ctx.fillText('No data', L.w / 2, L.h / 2);
    warn.textContent = '';
    return;
  }
  const scene = buildMarkers(L, recs);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);
  drawSpiralPath(scene);
  scene.markers.forEach(m => drawMarker(m, hoverKey === m.key));
  ctx.restore();

  let footer = '';
  if(summary.current_stage){
    footer = 'Current: ' + String(summary.current_stage);
  }
  if(summary.highest_value_milestone && summary.highest_value_milestone.stage){
    footer += (footer ? ' · ' : '') + 'Highest value: ' + summary.highest_value_milestone.stage;
  }
  if(summary.journey_name){
    footer += (footer ? ' · ' : '') + String(summary.journey_name);
  }
  if(footer){
    ctx.fillStyle = 'rgba(226,246,255,.45)';
    ctx.font = '10px system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(footer.slice(0, 140), L.p.l, L.h - 12);
  }
  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
  warn.textContent = warnings.length ? warnings[0] : '';
}
function hitMarker(sx, sy){
  const L = layout();
  const scene = buildMarkers(L, activeRecords());
  const world = screenToWorld(sx, sy);
  let best = null, bestDist = Infinity;
  scene.markers.forEach(m => {
    const d = Math.hypot(world.x - m.x, world.y - m.y);
    if(d <= m.markerR && d < bestDist){ bestDist = d; best = m; }
  });
  return best;
}
function initJourneySelect(){
  if(!hasJourneySelect()){
    toolbar.style.display = 'none';
    if(!selectedJourney && journeys.length === 1) selectedJourney = journeys[0];
    return;
  }
  toolbar.style.display = 'flex';
  journeySelect.innerHTML = '';
  journeys.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j;
    opt.textContent = j;
    journeySelect.appendChild(opt);
  });
  if(!selectedJourney || journeys.indexOf(selectedJourney) < 0){
    selectedJourney = journeys.slice().sort((a,b) => {
      const ca = allRecords.filter(r => r.journey_name === a).length;
      const cb = allRecords.filter(r => r.journey_name === b).length;
      return cb - ca || a.localeCompare(b);
    })[0];
  }
  journeySelect.value = selectedJourney;
  journeySelect.addEventListener('change', () => {
    selectedJourney = journeySelect.value;
    hoverKey = null;
    tip.style.display = 'none';
    draw();
  });
}
canvas.addEventListener('mousedown', (e) => {
  if(e.button !== 0) return;
  dragging = true;
  didDrag = false;
  const p = pointerPos(e);
  dragStartX = p.x; dragStartY = p.y;
  panStartX = panX; panStartY = panY;
});
window.addEventListener('mousemove', (e) => {
  const p = pointerPos(e);
  if(dragging){
    const dx = p.x - dragStartX, dy = p.y - dragStartY;
    if(Math.hypot(dx, dy) > 4){
      didDrag = true;
      panX = panStartX + dx;
      panY = panStartY + dy;
      tip.style.display = 'none';
      canvas.style.cursor = 'grabbing';
      draw();
    }
    return;
  }
  const marker = hitMarker(p.x, p.y);
  hoverKey = marker ? marker.key : null;
  canvas.style.cursor = marker ? 'pointer' : 'grab';
  draw();
  if(!marker){ tip.style.display = 'none'; return; }
  const r = marker.rec;
  let html = '<strong>' + esc(r.stage) + '</strong>';
  if(r.timeline) html += '<br/>Timeline: ' + esc(r.timeline);
  html += '<br/>Progress: ' + Math.round(num(r.progress_pct,0)) + '%';
  html += '<br/>Metric: ' + Number(r.metric_value||0).toLocaleString();
  if(r.status) html += '<br/>Status: ' + esc(r.status);
  if(r.risk_score != null) html += '<br/>Risk: ' + Math.round(num(r.risk_score,0));
  if(r.target_date) html += '<br/>Target: ' + esc(r.target_date);
  if(r.actual_date) html += '<br/>Actual: ' + esc(r.actual_date);
  if(r.schedule_variance_days != null) html += '<br/>Variance: ' + num(r.schedule_variance_days,0) + ' days';
  if(r.owner) html += '<br/>Owner: ' + esc(r.owner);
  if(r.key_achievement) html += '<br/>' + esc(String(r.key_achievement).slice(0, 120));
  if(r.cost != null) html += '<br/>Cost: ' + Number(r.cost).toLocaleString();
  tip.innerHTML = html;
  tip.style.display = 'block';
  const rect = canvas.getBoundingClientRect();
  tip.style.left = Math.min(rect.width - 160, Math.max(8, p.x + 12)) + 'px';
  tip.style.top = Math.max(8, p.y - 10) + 'px';
});
window.addEventListener('mouseup', () => {
  if(!dragging) return;
  dragging = false;
  canvas.style.cursor = 'grab';
});
canvas.addEventListener('mouseleave', () => {
  if(dragging) return;
  hoverKey = null;
  tip.style.display = 'none';
  draw();
});
canvas.addEventListener('dblclick', () => {
  panX = 0; panY = 0; zoom = 1;
  draw();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = pointerPos(e);
  const before = screenToWorld(p.x, p.y);
  const factor = e.deltaY < 0 ? 1.08 : 1/1.08;
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
  panX = p.x - before.x * zoom;
  panY = p.y - before.y * zoom;
  draw();
}, { passive: false });
window.addEventListener('resize', resize);
initJourneySelect();
resize();

""";
}
