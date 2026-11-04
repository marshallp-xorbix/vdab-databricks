/** Self-contained HoneycombStory canvas renderer ported from the retained legacy output. */
export const HONEYCOMB_STORY_HTML = String.raw`<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}
#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}
canvas{display:block;width:100%;height:100%;touch-action:none;}
#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35;}
#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}
#warn{position:absolute;left:10px;bottom:8px;right:180px;z-index:3;font-size:10px;color:rgba(251,191,36,.85);pointer-events:none;}
</style></head><body>
<div id="wrap"><canvas id="c"></canvas><div id="tip"></div><div id="warn"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset</div></div>
<script>
const payload = __HONEYCOMB_PAYLOAD__;
const canvas = document.getElementById('c');
const tip = document.getElementById('tip');
const warn = document.getElementById('warn');
const ctx = canvas.getContext('2d');
const cfg = Object.assign({
  show_labels: true, show_risk_borders: true, show_trend_arrows: true
}, (payload && payload.visualConfig) || {});
const records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];
const summary = (payload && payload.summary) || {};
let hoverKey = null;
let panX = 0, panY = 0, zoom = 1;
let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
const CAT_COLORS = ['#2dd4bf','#38bdf8','#a78bfa','#f472b6','#fbbf24','#34d399','#fb7185','#60a5fa'];
const RISK_THRESHOLD = 70;
const MIN_ZOOM = 0.45, MAX_ZOOM = 2.5;
const PREFERRED_RADIUS = 58;
const CLUSTER_GAP = 40;
const LABEL_GAP = 22;
const HEX_STEP_X = 2.2;
const HEX_STEP_Y = 1.95;

function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function dpr(){ return Math.max(1, window.devicePixelRatio || 1); }
function layout(){
  const r = canvas.parentElement.getBoundingClientRect();
  return { w: r.width, h: r.height, p: { l: 24, r: 24, t: 20, b: 36 } };
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
function hexPath(cx, cy, radius){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a = Math.PI/6 + i * Math.PI/3;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
}
function pointInHex(mx, my, cx, cy, radius){
  return Math.hypot(mx - cx, my - cy) <= radius * 0.92;
}
function priorityWeight(p){
  const s = String(p || '').toLowerCase();
  if(s === 'high' || s === '1' || s === '5') return 2.5;
  if(s === 'medium' || s === 'med' || s === '2' || s === '3' || s === '4') return 1.75;
  return 1.25;
}
function hexToRgba(hex, a){
  const h = String(hex || '').replace('#','');
  if(h.length !== 6) return 'rgba(56,189,248,' + a + ')';
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}
function buildCells(){
  const byCat = {};
  records.forEach(r => {
    const cat = String(r.category || 'Other');
    if(!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(r);
  });
  const categories = Object.keys(byCat).sort((a,b) => a.localeCompare(b));
  categories.forEach(c => byCat[c].sort((a,b) => num(b.impact_score,0) - num(a.impact_score,0)));
  const impacts = records.map(r => num(r.impact_score,0));
  const minI = impacts.length ? Math.min(...impacts) : 0;
  const maxI = impacts.length ? Math.max(...impacts) : 1;
  const spanI = Math.max(1, maxI - minI);
  const catCount = Math.max(1, categories.length);
  const cols = catCount <= 1 ? 1 : (catCount <= 3 ? catCount : 2);
  const rows = Math.ceil(catCount / cols);

  // Build each cluster in local space with a readable hex size, then pack tightly.
  const clusters = categories.map((cat, catIndex) => {
    const items = byCat[cat];
    const n = items.length;
    const gridCols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const gridRows = Math.ceil(n / gridCols);
    const baseR = Math.max(44, Math.min(PREFERRED_RADIUS, 68 - gridCols * 2));
    const stepX = baseR * HEX_STEP_X;
    const stepY = baseR * HEX_STEP_Y;
    const locals = [];
    items.forEach((rec, i) => {
      const gx = i % gridCols;
      const gy = Math.floor(i / gridCols);
      const t = (num(rec.impact_score,0) - minI) / spanI;
      const radius = baseR * (0.82 + 0.35 * t);
      const cx = gx * stepX + (gy % 2 ? stepX * 0.5 : 0);
      const cy = gy * stepY;
      locals.push({ rec, cx, cy, radius });
    });
    const minX = Math.min(...locals.map(c => c.cx - c.radius));
    const maxX = Math.max(...locals.map(c => c.cx + c.radius));
    const minY = Math.min(...locals.map(c => c.cy - c.radius));
    const maxY = Math.max(...locals.map(c => c.cy + c.radius));
    return {
      cat, catIndex, locals,
      width: Math.max(120, maxX - minX),
      height: Math.max(80, maxY - minY) + LABEL_GAP,
      originX: minX,
      originY: minY - LABEL_GAP
    };
  });

  const colWidths = Array.from({ length: cols }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);
  clusters.forEach((cluster, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colWidths[col] = Math.max(colWidths[col], cluster.width);
    rowHeights[row] = Math.max(rowHeights[row], cluster.height);
  });
  const boardW = colWidths.reduce((a,b) => a+b, 0) + CLUSTER_GAP * Math.max(0, cols - 1);
  const boardH = rowHeights.reduce((a,b) => a+b, 0) + CLUSTER_GAP * Math.max(0, rows - 1);
  const cells = [];
  const labels = [];
  clusters.forEach((cluster, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    let ox = 0, oy = 0;
    for(let c=0;c<col;c++) ox += colWidths[c] + CLUSTER_GAP;
    for(let r=0;r<row;r++) oy += rowHeights[r] + CLUSTER_GAP;
    ox += (colWidths[col] - cluster.width) / 2;
    oy += (rowHeights[row] - cluster.height) / 2;
    labels.push({
      cat: cluster.cat,
      catIndex: cluster.catIndex,
      x: ox,
      y: oy + 12
    });
    cluster.locals.forEach(local => {
      cells.push({
        key: String(local.rec.item_name),
        rec: local.rec,
        cat: cluster.cat,
        catIndex: cluster.catIndex,
        cx: ox + (local.cx - cluster.originX),
        cy: oy + (local.cy - cluster.originY),
        radius: local.radius,
        color: CAT_COLORS[cluster.catIndex % CAT_COLORS.length]
      });
    });
  });
  return { cells, labels, boardW, boardH };
}
function wrapLabelLines(text, maxWidth, maxLines){
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if(!words.length) return [];
  const lines = [];
  let current = words[0];
  for(let i=1;i<words.length;i++){
    const candidate = current + ' ' + words[i];
    if(ctx.measureText(candidate).width <= maxWidth){
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if(lines.length === maxLines - 1){
        lines.push([current].concat(words.slice(i+1)).join(' '));
        return lines;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}
function fitHexName(name, maxWidth){
  const maxFont = 12, minFont = 8;
  for(let fontSize = maxFont; fontSize >= minFont; fontSize--){
    ctx.font = '600 ' + fontSize + 'px system-ui,sans-serif';
    if(ctx.measureText(name).width <= maxWidth){
      return { lines: [name], fontSize };
    }
    const lines = wrapLabelLines(name, maxWidth, 2);
    if(lines.length && lines.every(line => ctx.measureText(line).width <= maxWidth)){
      return { lines, fontSize };
    }
  }
  ctx.font = '600 ' + minFont + 'px system-ui,sans-serif';
  let lines = wrapLabelLines(name, maxWidth, 2);
  if(!lines.length) lines = [name];
  lines = lines.map(line => {
    if(ctx.measureText(line).width <= maxWidth) return line;
    let trimmed = line;
    while(trimmed.length > 1 && ctx.measureText(trimmed + '…').width > maxWidth){
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed + '…';
  });
  return { lines, fontSize: minFont };
}
function drawHex(cell, highlighted){
  const rec = cell.rec;
  const progress = Math.max(0, Math.min(100, num(rec.progress_pct, 0))) / 100;
  hexPath(cell.cx, cell.cy, cell.radius);
  ctx.fillStyle = 'rgba(15,23,42,.92)';
  ctx.fill();
  ctx.save();
  hexPath(cell.cx, cell.cy, cell.radius);
  ctx.clip();
  const top = cell.cy + cell.radius;
  const fillH = cell.radius * 2 * progress;
  ctx.fillStyle = highlighted ? 'rgba(224,242,254,.8)' : hexToRgba(cell.color, 0.55);
  ctx.fillRect(cell.cx - cell.radius, top - fillH, cell.radius * 2, fillH);
  ctx.restore();
  hexPath(cell.cx, cell.cy, cell.radius);
  const risk = num(rec.risk_score, -1);
  const highRisk = cfg.show_risk_borders && risk >= RISK_THRESHOLD;
  ctx.lineWidth = highRisk ? 2.75 : priorityWeight(rec.priority_level);
  ctx.strokeStyle = highRisk ? '#f87171' : (highlighted ? '#e0f2fe' : 'rgba(148,163,184,.65)');
  ctx.stroke();
  if(cfg.show_labels){
    const maxWidth = cell.radius * 1.45;
    const name = String(rec.item_name || '');
    const fitted = fitHexName(name, maxWidth);
    const lineHeight = fitted.fontSize + 2;
    const blockHeight = fitted.lines.length * lineHeight;
    const nameTop = cell.cy - blockHeight / 2 - 4;
    ctx.fillStyle = 'rgba(226,246,255,.95)';
    ctx.font = '600 ' + fitted.fontSize + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    fitted.lines.forEach((line, index) => {
      ctx.fillText(line, cell.cx, nameTop + index * lineHeight);
    });
    ctx.fillStyle = 'rgba(148,163,184,.95)';
    ctx.font = '10px system-ui,sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.round(num(rec.progress_pct,0)) + '%', cell.cx, nameTop + blockHeight + 2);
  }
  if(cfg.show_trend_arrows && rec.trend){
    const t = String(rec.trend).toLowerCase();
    let arrow = '';
    if(t.indexOf('improv') >= 0 || t === 'up' || t === 'rising') arrow = '↑';
    else if(t.indexOf('declin') >= 0 || t === 'down' || t === 'falling') arrow = '↓';
    else if(t.indexOf('flat') >= 0 || t === 'stable') arrow = '→';
    if(arrow){
      ctx.fillStyle = arrow === '↑' ? '#34d399' : (arrow === '↓' ? '#f87171' : 'rgba(148,163,184,.9)');
      ctx.font = '700 20px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(arrow, cell.cx + cell.radius * 0.58, cell.cy - cell.radius * 0.62);
    }
  }
}
function draw(){
  const L = layout();
  ctx.setTransform(dpr(),0,0,dpr(),0,0);
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, L.w, L.h);
  if(records.length === 0){
    ctx.fillStyle = 'rgba(148,163,184,.8)';
    ctx.textAlign = 'center';
    ctx.fillText('No data', L.w / 2, L.h / 2);
    return;
  }
  const scene = buildCells();
  const originX = (L.w - scene.boardW) / 2;
  const originY = (L.h - scene.boardH) / 2 - 4;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);
  ctx.translate(originX, originY);

  scene.labels.forEach(label => {
    ctx.fillStyle = hexToRgba(CAT_COLORS[label.catIndex % CAT_COLORS.length], 0.95);
    ctx.font = '600 12px system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label.cat, label.x, label.y);
  });
  scene.cells.forEach(cell => drawHex(cell, hoverKey === cell.key));
  ctx.restore();

  let footer = '';
  const hilp = Array.isArray(summary.high_impact_low_progress) ? summary.high_impact_low_progress : [];
  if(hilp.length){
    footer = 'High impact / low progress: ' + hilp.map(x => x.item_name).slice(0,3).join(', ');
  } else if(summary.highest_risk){
    footer = 'Highest risk: ' + summary.highest_risk.item_name + ' (' + Math.round(num(summary.highest_risk.risk_score,0)) + ')';
  }
  if(summary.delivery_health){
    const dh = summary.delivery_health;
    footer += (footer ? ' · ' : '') + 'Health: ' + (dh.on_track||0) + ' on track, ' + (dh.at_risk||0) + ' at risk, ' + (dh.behind||0) + ' behind';
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
function hitCell(sx, sy){
  const L = layout();
  const scene = buildCells();
  const originX = (L.w - scene.boardW) / 2;
  const originY = (L.h - scene.boardH) / 2 - 4;
  const world = screenToWorld(sx, sy);
  const mx = world.x - originX;
  const my = world.y - originY;
  let best = null, bestDist = Infinity;
  scene.cells.forEach(cell => {
    if(!pointInHex(mx, my, cell.cx, cell.cy, cell.radius)) return;
    const d = Math.hypot(mx - cell.cx, my - cell.cy);
    if(d < bestDist){ bestDist = d; best = cell; }
  });
  return best;
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
  const cell = hitCell(p.x, p.y);
  hoverKey = cell ? cell.key : null;
  canvas.style.cursor = cell ? 'pointer' : 'grab';
  draw();
  if(!cell){ tip.style.display = 'none'; return; }
  const r = cell.rec;
  let html = '<strong>' + esc(r.item_name) + '</strong><br/>Impact: ' + Math.round(num(r.impact_score,0));
  html += '<br/>Progress: ' + Math.round(num(r.progress_pct,0)) + '%';
  if(r.priority_level) html += '<br/>Priority: ' + esc(r.priority_level);
  if(r.category) html += '<br/>Category: ' + esc(r.category);
  if(r.risk_score != null) html += '<br/>Risk: ' + Math.round(num(r.risk_score,0));
  if(r.trend) html += '<br/>Trend: ' + esc(r.trend);
  if(r.owner) html += '<br/>Owner: ' + esc(r.owner);
  if(r.due_date) html += '<br/>Due: ' + esc(r.due_date);
  if(r.status) html += '<br/>Status: ' + esc(r.status);
  if(r.delivery_health) html += '<br/>Health: ' + esc(r.delivery_health);
  if(r.investment != null) html += '<br/>Investment: ' + Number(r.investment).toLocaleString();
  if(r.benefit_value != null) html += '<br/>Benefit: ' + Number(r.benefit_value).toLocaleString();
  if(r.notes) html += '<br/>' + esc(String(r.notes).slice(0, 120));
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
resize();
</script></body></html>`;