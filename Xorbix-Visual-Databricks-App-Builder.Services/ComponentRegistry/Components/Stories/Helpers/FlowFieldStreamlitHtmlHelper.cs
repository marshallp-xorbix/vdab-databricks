namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds the self-contained HTML/JS canvas renderer for Flow Field Story (Streamlit components.html).
/// Payload is injected at runtime via the <c>__FLOW_FIELD_PAYLOAD__</c> placeholder.
/// Column Sankey layout is kept in sync with client <c>flowFieldCanvasDraw.ts</c>.
/// </summary>
internal static class FlowFieldStreamlitHtmlHelper
{
    public const string PayloadPlaceholder = "__FLOW_FIELD_PAYLOAD__";

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
#warn{position:absolute;left:10px;bottom:8px;right:160px;z-index:3;font-size:10px;color:rgba(251,191,36,.85);pointer-events:none;}
""",
            wrapInnerHtml: "<canvas id=\"c\"></canvas><div id=\"tip\"></div><div id=\"warn\"></div><div id=\"hint\">Hover streams for details</div>",
            rendererScript: GetRendererScript());

    private static string GetRendererScript() =>
        """

const payload = __FLOW_FIELD_PAYLOAD__;
const canvas = document.getElementById('c');
const tip = document.getElementById('tip');
const warn = document.getElementById('warn');
const ctx = canvas.getContext('2d');
const cfg = Object.assign({
  show_drop_offs: true, show_labels: true
}, (payload && payload.visualConfig) || {});
const stages = Array.isArray(payload && payload.stages) ? payload.stages.slice() : [];
const flows = Array.isArray(payload && payload.flows) ? payload.flows.slice() : [];
const summary = (payload && payload.summary) || {};
let hoverKey = null;
const NODE_WIDTH = 88, NODE_GAP_Y = 16, MIN_NODE_HEIGHT = 40, COLUMN_INSET = 8;

function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function flowKey(f){ return String(f.source) + '→' + String(f.destination); }
function resize(){
  const r = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
function pad(){ return { l: 36, r: 36, t: 24, b: 36 }; }
function layout(){
  const r = canvas.parentElement.getBoundingClientRect();
  const p = pad();
  return { w: r.width, h: r.height, p, iw: Math.max(1, r.width - p.l - p.r), ih: Math.max(1, r.height - p.t - p.b) };
}
function formatCompact(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if(a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if(a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}
function statusColor(status){
  const s = String(status || 'normal').toLowerCase();
  if(s === 'delayed' || s === 'blocked' || s === 'failed') return 'rgba(248,113,113,.72)';
  return 'rgba(56,189,248,.72)';
}
function roundRect(x,y,w,h,r){
  const rr = Math.min(r, w/2, h/2);
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}
function nodeVolume(name){
  let incoming = 0, outgoing = 0;
  flows.forEach(f => {
    if(String(f.destination) === name) incoming += Math.max(0, num(f.volume, 0));
    if(String(f.source) === name) outgoing += Math.max(0, num(f.volume, 0));
  });
  return Math.max(incoming, outgoing, 1);
}
function dropOffByStage(){
  const totals = {};
  flows.forEach(f => {
    const drop = num(f.drop_off, 0);
    if(drop > 0){
      const s = String(f.source);
      totals[s] = (totals[s] || 0) + drop;
    }
  });
  return totals;
}
function drawRibbon(link){
  const midX = (link.x0 + link.x1) / 2;
  ctx.beginPath();
  ctx.moveTo(link.x0, link.y0Top);
  ctx.bezierCurveTo(midX, link.y0Top, midX, link.y1Top, link.x1, link.y1Top);
  ctx.lineTo(link.x1, link.y1Bot);
  ctx.bezierCurveTo(midX, link.y1Bot, midX, link.y0Bot, link.x0, link.y0Bot);
  ctx.closePath();
  ctx.fillStyle = link.key === hoverKey ? 'rgba(224,242,254,.85)' : link.color;
  ctx.fill();
}
function buildLayout(L){
  const columns = [...new Set(stages.map(s => num(s.order, 0)))].sort((a,b) => a-b);
  const columnCount = columns.length;
  const columnWidth = columnCount <= 1 ? L.iw : L.iw / Math.max(1, columnCount - 1);
  const nodes = {};
  columns.forEach((order, columnIndex) => {
    const columnStages = stages.filter(s => num(s.order, 0) === order)
      .sort((a,b) => String(a.name).localeCompare(String(b.name)));
    const volumes = columnStages.map(s => nodeVolume(String(s.name)));
    const volumeSum = volumes.reduce((a,b) => a+b, 0) || 1;
    const usableHeight = L.ih - NODE_GAP_Y * Math.max(0, columnStages.length - 1);
    const x = columnCount <= 1 ? L.p.l + L.iw / 2 : L.p.l + columnIndex * columnWidth;
    let cursorY = L.p.t;
    columnStages.forEach((stage, index) => {
      const weight = volumes[index] / volumeSum;
      const nodeHeight = Math.max(MIN_NODE_HEIGHT, usableHeight * Math.max(0.18, weight));
      nodes[String(stage.name)] = {
        name: String(stage.name),
        order: num(stage.order, 0),
        x, y: cursorY + nodeHeight / 2,
        width: NODE_WIDTH, height: nodeHeight
      };
      cursorY += nodeHeight + NODE_GAP_Y;
    });
  });

  const orderedFlows = flows
    .filter(f => nodes[String(f.source)] && nodes[String(f.destination)])
    .slice()
    .sort((a,b) => {
      const d = (nodes[String(a.source)].order - nodes[String(b.source)].order);
      if(d !== 0) return d;
      return num(b.volume,0) - num(a.volume,0);
    });

  const outOffset = {}, inOffset = {}, outTotal = {}, inTotal = {};
  orderedFlows.forEach(f => {
    const s = String(f.source), d = String(f.destination);
    outTotal[s] = (outTotal[s] || 0) + num(f.volume, 0);
    inTotal[d] = (inTotal[d] || 0) + num(f.volume, 0);
  });

  const links = [];
  orderedFlows.forEach(f => {
    const source = nodes[String(f.source)];
    const destination = nodes[String(f.destination)];
    const vol = num(f.volume, 0);
    const sourceSpan = Math.max(12, source.height - COLUMN_INSET * 2);
    const destSpan = Math.max(12, destination.height - COLUMN_INSET * 2);
    const sourceTop = source.y - sourceSpan / 2;
    const destTop = destination.y - destSpan / 2;
    const outUsed = outOffset[String(f.source)] || 0;
    const inUsed = inOffset[String(f.destination)] || 0;
    const outFrac = vol / (outTotal[String(f.source)] || vol || 1);
    const inFrac = vol / (inTotal[String(f.destination)] || vol || 1);
    const y0Top = sourceTop + outUsed * sourceSpan;
    const y0Bot = y0Top + outFrac * sourceSpan;
    const y1Top = destTop + inUsed * destSpan;
    const y1Bot = y1Top + inFrac * destSpan;
    outOffset[String(f.source)] = outUsed + outFrac;
    inOffset[String(f.destination)] = inUsed + inFrac;
    links.push({
      flow: f, key: flowKey(f),
      x0: source.x + source.width / 2, y0Top, y0Bot,
      x1: destination.x - destination.width / 2, y1Top, y1Bot,
      color: statusColor(f.status)
    });
  });
  return { nodes, links };
}
function draw(){
  const L = layout();
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, L.w, L.h);
  if(stages.length === 0){
    ctx.fillStyle = 'rgba(148,163,184,.8)';
    ctx.textAlign = 'center';
    ctx.fillText('No data', L.w / 2, L.h / 2);
    return;
  }
  const { nodes, links } = buildLayout(L);
  links.forEach(drawRibbon);

  const dropOffs = dropOffByStage();
  const bottleneckName = summary.bottleneck_stage && summary.bottleneck_stage.name;
  Object.keys(nodes).forEach(name => {
    const node = nodes[name];
    const isBottleneck = String(bottleneckName) === name;
    const left = node.x - node.width / 2;
    const top = node.y - node.height / 2;
    ctx.beginPath();
    roundRect(left, top, node.width, node.height, 10);
    ctx.fillStyle = isBottleneck ? 'rgba(251,191,36,.18)' : 'rgba(15,23,42,.96)';
    ctx.fill();
    ctx.lineWidth = isBottleneck ? 2 : 1.25;
    ctx.strokeStyle = isBottleneck ? '#fbbf24' : 'rgba(148,163,184,.55)';
    ctx.stroke();
    if(cfg.show_labels){
      ctx.fillStyle = 'rgba(226,246,255,.95)';
      ctx.font = '600 12px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.slice(0, 14), node.x, node.y - 6);
      ctx.fillStyle = 'rgba(148,163,184,.9)';
      ctx.font = '10px system-ui,sans-serif';
      ctx.fillText(formatCompact(nodeVolume(name)), node.x, node.y + 10);
    }
    if(cfg.show_drop_offs && (dropOffs[name] || 0) > 0){
      ctx.fillStyle = 'rgba(248,113,113,.9)';
      ctx.font = '9px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↓ ' + formatCompact(dropOffs[name]), node.x, top + node.height + 14);
    }
  });

  if(summary.largest_drop_off){
    ctx.fillStyle = 'rgba(226,246,255,.45)';
    ctx.font = '10px system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      'Largest drop-off: ' + summary.largest_drop_off.source + ' → ' + summary.largest_drop_off.destination
        + ' (' + formatCompact(summary.largest_drop_off.drop_off) + ')',
      L.p.l, L.h - 10
    );
  }
  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
  warn.textContent = warnings.length ? warnings[0] : '';
}
function ribbonEdgeY(y0, y1, t){
  const mt = 1 - t;
  return mt*mt*mt*y0 + 3*mt*mt*t*y0 + 3*mt*t*t*y1 + t*t*t*y1;
}
function linkContains(link, mx, my){
  const minX = Math.min(link.x0, link.x1);
  const maxX = Math.max(link.x0, link.x1);
  if(mx < minX - 1 || mx > maxX + 1) return false;
  const spanX = link.x1 - link.x0;
  if(Math.abs(spanX) < 0.001) return false;
  const t = Math.max(0, Math.min(1, (mx - link.x0) / spanX));
  const yTop = ribbonEdgeY(link.y0Top, link.y1Top, t);
  const yBot = ribbonEdgeY(link.y0Bot, link.y1Bot, t);
  const lo = Math.min(yTop, yBot) - 1;
  const hi = Math.max(yTop, yBot) + 1;
  return my >= lo && my <= hi;
}
function hitLink(mx, my){
  const L = layout();
  const { links } = buildLayout(L);
  let best = null, bestThickness = Infinity;
  links.forEach(link => {
    if(!linkContains(link, mx, my)) return;
    const thickness = (Math.abs(link.y0Bot - link.y0Top) + Math.abs(link.y1Bot - link.y1Top)) / 2;
    if(thickness <= bestThickness){ bestThickness = thickness; best = link; }
  });
  return best;
}
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const link = hitLink(mx, my);
  hoverKey = link ? link.key : null;
  draw();
  if(!link){ tip.style.display = 'none'; return; }
  const f = link.flow;
  let html = '<strong>' + esc(f.source) + ' → ' + esc(f.destination) + '</strong><br/>Volume: ' + formatCompact(f.volume);
  if(f.conversion_pct != null) html += '<br/>Conversion: ' + Number(f.conversion_pct).toFixed(1) + '%';
  if(f.drop_off != null) html += '<br/>Drop-off: ' + formatCompact(f.drop_off);
  if(f.avg_time_in_stage != null) html += '<br/>Avg time: ' + Number(f.avg_time_in_stage).toFixed(1);
  if(f.status) html += '<br/>Status: ' + esc(f.status);
  tip.innerHTML = html;
  tip.style.display = 'block';
  tip.style.left = Math.min(rect.width - 160, Math.max(8, mx + 12)) + 'px';
  tip.style.top = Math.max(8, my - 10) + 'px';
});
canvas.addEventListener('mouseleave', () => { hoverKey = null; tip.style.display = 'none'; draw(); });
window.addEventListener('resize', resize);
resize();

""";
}
