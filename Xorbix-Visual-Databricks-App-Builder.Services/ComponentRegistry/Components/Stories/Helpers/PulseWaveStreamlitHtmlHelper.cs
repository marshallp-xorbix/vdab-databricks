namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds the self-contained HTML/JS canvas renderer for Pulse Wave Story (Streamlit components.html).
/// Payload is injected at runtime via the <c>__PULSE_WAVE_PAYLOAD__</c> placeholder.
/// Wave algorithm is kept in sync with client <c>pulseWaveCanvasDraw.ts</c>.
/// </summary>
internal static class PulseWaveStreamlitHtmlHelper
{
    public const string PayloadPlaceholder = "__PULSE_WAVE_PAYLOAD__";

    public const int DefaultHeightPx = 520;

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
#warn{position:absolute;left:10px;bottom:8px;right:200px;z-index:3;font-size:10px;color:rgba(251,191,36,.85);pointer-events:none;}
""",
            wrapInnerHtml: "<canvas id=\"c\"></canvas><div id=\"tip\"></div><div id=\"warn\"></div><div id=\"hint\">Drag to pan · scroll to zoom · double-click to reset</div>",
            rendererScript: GetRendererScript());

    private static string GetRendererScript() =>
        """

const payload = __PULSE_WAVE_PAYLOAD__;
const canvas = document.getElementById('c');
const tip = document.getElementById('tip');
const warn = document.getElementById('warn');
const ctx = canvas.getContext('2d');
const cfg = Object.assign({
  metric_name: 'Metric', y_axis_label: 'Metric', aggregation_method: 'sum',
  show_baseline: true, show_events: true, show_anomaly_markers: true, fill_under_wave: true
}, (payload && payload.visualConfig) || {});
const records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];
const events = Array.isArray(payload && payload.events) ? payload.events.slice() : [];
const summary = (payload && payload.summary) || {};
let hoverIndex = -1;
let viewStart = 0, viewEnd = 1;
let dragging = false, dragStartX = 0, dragViewStart = 0, dragViewEnd = 1;
const MIN_SPAN = 0.05;

function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function clampView(){
  viewStart = Math.max(0, Math.min(1, viewStart));
  viewEnd = Math.max(0, Math.min(1, viewEnd));
  if(viewEnd - viewStart < MIN_SPAN){
    const mid = (viewStart + viewEnd) / 2;
    viewStart = Math.max(0, mid - MIN_SPAN / 2);
    viewEnd = Math.min(1, mid + MIN_SPAN / 2);
  }
  if(viewEnd <= viewStart){ viewStart = 0; viewEnd = 1; }
}
function resize(){
  const r = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
function pad(){ return { l: 62, r: 18, t: 20, b: 36 }; }
function layout(){
  const r = canvas.parentElement.getBoundingClientRect();
  const p = pad();
  return { w: r.width, h: r.height, p, iw: Math.max(1, r.width - p.l - p.r), ih: Math.max(1, r.height - p.t - p.b) };
}
function yRange(recs){
  let min = Infinity, max = -Infinity;
  recs.forEach(rec => {
    const m = num(rec.metric_value, 0), b = num(rec.baseline_value, 0);
    min = Math.min(min, m, b); max = Math.max(max, m, b);
  });
  if(!Number.isFinite(min) || !Number.isFinite(max)){ min = 0; max = 1; }
  if(min === max){ min -= 1; max += 1; }
  const padY = (max - min) * 0.12;
  return { min: min - padY, max: max + padY };
}
function yPos(v, yr, L){ return L.p.t + (1 - ((v - yr.min) / (yr.max - yr.min || 1))) * L.ih; }
function eventByPeriod(){
  const map = {};
  events.forEach(e => { if(e && e.time_period) map[String(e.time_period)] = e; });
  return map;
}
function drawWavePath(pts, closeToBaseline, baseY){
  if(pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let i = 1; i < pts.length; i++){
    const p0 = pts[i - 1], p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(cx, p0.y, cx, p1.y, p1.x, p1.y);
  }
  if(closeToBaseline && pts.length){
    ctx.lineTo(pts[pts.length - 1].x, baseY);
    ctx.lineTo(pts[0].x, baseY);
    ctx.closePath();
  }
}
function buildVisiblePoints(yr, L){
  const n = records.length;
  if(n === 0) return [];
  if(n === 1){
    return [{ x: L.p.l + L.iw / 2, y: yPos(num(records[0].metric_value, 0), yr, L), i: 0, rec: records[0] }];
  }
  const startFrac = viewStart * (n - 1);
  const endFrac = viewEnd * (n - 1);
  const span = endFrac - startFrac || 1;
  const i0 = Math.max(0, Math.floor(startFrac));
  const i1 = Math.min(n - 1, Math.ceil(endFrac));
  const pts = [];
  for(let i = i0; i <= i1; i++){
    pts.push({
      x: L.p.l + ((i - startFrac) / span) * L.iw,
      y: yPos(num(records[i].metric_value, 0), yr, L),
      i, rec: records[i]
    });
  }
  return pts;
}
function drawYAxisLabel(L){
  const text = String(cfg.y_axis_label || cfg.metric_name || 'Metric').trim() || 'Metric';
  ctx.save();
  ctx.fillStyle = 'rgba(226,246,255,.85)';
  ctx.font = '11px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(14, L.p.t + L.ih / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
function draw(){
  clampView();
  const L = layout();
  const n = records.length;
  const evtMap = eventByPeriod();
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, L.w, L.h);

  let visible = records;
  if(n > 1){
    const startFrac = viewStart * (n - 1);
    const endFrac = viewEnd * (n - 1);
    const i0 = Math.max(0, Math.floor(startFrac));
    const i1 = Math.min(n - 1, Math.ceil(endFrac));
    visible = records.slice(i0, i1 + 1);
  }
  const yr = yRange(visible.length ? visible : records);

  ctx.strokeStyle = 'rgba(148,163,184,.18)';
  ctx.lineWidth = 1;
  for(let g = 0; g <= 4; g++){
    const y = L.p.t + (g / 4) * L.ih;
    ctx.beginPath(); ctx.moveTo(L.p.l, y); ctx.lineTo(L.p.l + L.iw, y); ctx.stroke();
    const val = yr.max - (g / 4) * (yr.max - yr.min);
    ctx.fillStyle = 'rgba(226,246,255,.55)';
    ctx.font = '10px system-ui,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatCompact(val), L.p.l - 6, y + 3);
  }
  drawYAxisLabel(L);

  if(n === 0){
    ctx.fillStyle = 'rgba(148,163,184,.8)';
    ctx.textAlign = 'center';
    ctx.fillText('No data', L.w / 2, L.h / 2);
    return;
  }

  const pts = buildVisiblePoints(yr, L);
  const baseFloor = yPos(yr.min, yr, L);

  ctx.save();
  ctx.beginPath();
  ctx.rect(L.p.l, L.p.t, L.iw, L.ih);
  ctx.clip();

  if(cfg.fill_under_wave){
    ctx.fillStyle = 'rgba(56,189,248,.16)';
    drawWavePath(pts, true, baseFloor);
    ctx.fill();
  }

  if(cfg.show_baseline){
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(251,191,36,.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const y = yPos(num(pt.rec.baseline_value, 0), yr, L);
      if(i === 0) ctx.moveTo(pt.x, y); else ctx.lineTo(pt.x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.25;
  ctx.lineJoin = 'round';
  drawWavePath(pts, false, 0);
  ctx.stroke();

  const spikePeriod = summary.largest_spike && summary.largest_spike.time_period;
  const dropPeriod = summary.largest_drop && summary.largest_drop.time_period;
  if(cfg.show_anomaly_markers){
    pts.forEach(pt => {
      const period = String(pt.rec.time_period || '');
      if(period && (period === String(spikePeriod) || period === String(dropPeriod))){
        const isSpike = period === String(spikePeriod);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = isSpike ? '#4ade80' : '#f87171';
        ctx.fill();
        ctx.strokeStyle = '#0b1220';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  if(cfg.show_events){
    pts.forEach(pt => {
      const evt = evtMap[String(pt.rec.time_period || '')];
      if(!evt) return;
      const type = String(evt.event_type || 'neutral').toLowerCase();
      const color = type === 'positive' ? '#4ade80' : type === 'negative' ? '#f87171' : '#a78bfa';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(pt.x, L.p.t);
      ctx.lineTo(pt.x, L.p.t + L.ih);
      ctx.stroke();
      ctx.setLineDash([]);
      const impact = num(evt.impact_score, 40);
      const r = 3 + Math.min(6, impact / 20);
      ctx.beginPath();
      ctx.arc(pt.x, L.p.t + 8, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      const label = String(evt.event_name || '').slice(0, 18);
      if(label){
        ctx.fillStyle = 'rgba(226,246,255,.8)';
        ctx.font = '9px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, pt.x, L.p.t + 22);
      }
    });
  }

  if(hoverIndex >= 0){
    const pt = pts.find(p => p.i === hoverIndex);
    if(pt){
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#e0f2fe';
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(226,246,255,.55)';
  ctx.font = '10px system-ui,sans-serif';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.ceil(pts.length / 6));
  for(let i = 0; i < pts.length; i += labelStep){
    ctx.fillText(String(pts[i].rec.time_period || '').slice(0, 10), pts[i].x, L.h - 12);
  }

  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
  warn.textContent = warnings.length ? warnings[0] : '';
}
function formatCompact(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if(a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if(a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}
function canvasXToSeriesFrac(mx){
  const L = layout();
  const t = (mx - L.p.l) / (L.iw || 1);
  const u = Math.max(0, Math.min(1, t));
  return viewStart + u * (viewEnd - viewStart);
}
function hitIndex(mx){
  const L = layout();
  const yr = yRange(records);
  const pts = buildVisiblePoints(yr, L);
  if(pts.length === 0) return -1;
  let best = -1, bestDist = Infinity;
  pts.forEach(pt => {
    const d = Math.abs(mx - pt.x);
    if(d < bestDist){ bestDist = d; best = pt.i; }
  });
  return bestDist <= 18 ? best : -1;
}
function zoomAt(mx, factor){
  const anchor = canvasXToSeriesFrac(mx);
  const span = viewEnd - viewStart;
  const nextSpan = Math.max(MIN_SPAN, Math.min(1, span * factor));
  const ratio = span > 0 ? (anchor - viewStart) / span : 0.5;
  viewStart = anchor - ratio * nextSpan;
  viewEnd = viewStart + nextSpan;
  if(viewStart < 0){ viewStart = 0; viewEnd = nextSpan; }
  if(viewEnd > 1){ viewEnd = 1; viewStart = 1 - nextSpan; }
  clampView();
  draw();
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  zoomAt(mx, e.deltaY < 0 ? 0.85 : 1.18);
}, { passive: false });
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragStartX = e.clientX;
  dragViewStart = viewStart;
  dragViewEnd = viewEnd;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if(dragging){
    const L = layout();
    const span = dragViewEnd - dragViewStart;
    const deltaFrac = -((e.clientX - dragStartX) / (L.iw || 1)) * span;
    viewStart = dragViewStart + deltaFrac;
    viewEnd = dragViewEnd + deltaFrac;
    if(viewStart < 0){ viewStart = 0; viewEnd = span; }
    if(viewEnd > 1){ viewEnd = 1; viewStart = 1 - span; }
    clampView();
    tip.style.display = 'none';
    draw();
    return;
  }
  const idx = hitIndex(mx);
  hoverIndex = idx;
  draw();
  if(idx < 0){ tip.style.display = 'none'; return; }
  const rec = records[idx];
  const prev = idx > 0 ? records[idx - 1] : null;
  const delta = prev ? num(rec.metric_value, 0) - num(prev.metric_value, 0) : null;
  const evtMap = eventByPeriod();
  const evt = evtMap[String(rec.time_period || '')];
  const metricLabel = cfg.y_axis_label || cfg.metric_name || 'Metric';
  let html = '<strong>' + esc(rec.time_period || '') + '</strong><br/>'
    + esc(metricLabel) + ': ' + formatCompact(rec.metric_value) + '<br/>'
    + 'Baseline: ' + formatCompact(rec.baseline_value);
  if(delta != null) html += '<br/>Δ prior: ' + (delta >= 0 ? '+' : '') + formatCompact(delta);
  if(evt) html += '<br/>Event: ' + esc(evt.event_name || '');
  tip.innerHTML = html;
  tip.style.display = 'block';
  tip.style.left = Math.min(rect.width - 160, Math.max(8, mx + 12)) + 'px';
  tip.style.top = Math.max(8, my - 10) + 'px';
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('mouseleave', () => { if(!dragging){ hoverIndex = -1; tip.style.display = 'none'; draw(); } });
canvas.addEventListener('dblclick', () => { viewStart = 0; viewEnd = 1; draw(); });
window.addEventListener('resize', resize);
resize();

""";
}
