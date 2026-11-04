/* Self-contained interactive graph renderer ported from the retained legacy output. */
export const NETWORK_WEB_STORY_HTML = String.raw`<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}
#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}
canvas{display:block;width:100%;height:100%;touch-action:none;}
#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:260px;line-height:1.35;}
#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.55);pointer-events:none;user-select:none;}
#toolbar{position:absolute;left:10px;top:10px;z-index:4;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:92%;}
#search{background:rgba(15,23,42,.85);color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:12px;min-width:140px;}
#legend{position:absolute;left:10px;bottom:28px;z-index:3;display:flex;flex-wrap:wrap;gap:6px;max-width:80%;}
.leg{cursor:pointer;padding:3px 8px;border:0;border-radius:999px;font:inherit;font-size:11px;color:#0b1220;opacity:.95;user-select:none;}
.leg.off{opacity:.35;text-decoration:line-through;}
button:focus-visible,input:focus-visible,canvas:focus-visible{outline:2px solid #67e8f9;outline-offset:2px;}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
</style></head><body>
<div id="wrap"><div id="toolbar"><input id="search" type="search" placeholder="Search nodes…" aria-label="Search nodes by label"/></div><canvas id="c" role="group" tabindex="0" aria-describedby="hint" aria-label="Interactive relationship graph. Use arrow keys to move between nodes, Enter or Space to select a node, Escape to clear selection, plus and minus to zoom, and Home to reset the view."></canvas><div id="tip"></div><div id="legend" role="group" aria-label="Filter graph categories and relationship types"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset · click node to highlight · use arrow keys to navigate</div><div id="announce" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div></div>
<script>
const payload = __NETWORK_WEB_PAYLOAD__;
const canvas = document.getElementById('c');
const tip = document.getElementById('tip');
const legendEl = document.getElementById('legend');
const searchEl = document.getElementById('search');
const announcer = document.getElementById('announce');
const ctx = canvas.getContext('2d');
const cfg = Object.assign({
  layout_algorithm: 'force', node_size_by: 'degree', node_color_by: 'category',
  edge_width_by: 'weight', edge_color_by: 'relationship_type', show_arrows: true,
  highlight_depth: 1, min_weight_filter: 0,
  max_nodes: 300, max_edges: 800
}, (payload && payload.visualConfig) || {});
let nodes = Array.isArray(payload && payload.nodes) ? payload.nodes.map(n => Object.assign({}, n)) : [];
let edges = Array.isArray(payload && payload.edges) ? payload.edges.map(e => Object.assign({}, e)) : [];
const hiddenCats = new Set();
const hiddenTypes = new Set();
let selectedId = null;
let keyboardNodeId = null;
let hoverNodeId = null;
let hoverEdgeKey = null;
let searchQuery = '';
let panX = 0, panY = 0, zoom = 1;
let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
let settled = false;
const CATEGORY_COLORS = ['#2dd4bf','#38bdf8','#a78bfa','#f472b6','#fbbf24','#34d399','#fb7185','#60a5fa','#c084fc','#4ade80'];
const TYPE_COLORS = ['#67e8f9','#fcd34d','#f9a8d4','#86efac','#fdba74','#a5b4fc','#5eead4','#fda4af'];
const MIN_ZOOM = 0.4, MAX_ZOOM = 3.0;

function hashStr(s){ let h=0; for(let i=0;i<String(s).length;i++){ h=((h<<5)-h)+String(s).charCodeAt(i); h|=0;} return Math.abs(h); }
function catColor(cat){ return CATEGORY_COLORS[hashStr(cat)%CATEGORY_COLORS.length]; }
function typeColor(t){ return TYPE_COLORS[hashStr(t)%TYPE_COLORS.length]; }
function healthColor(h){ const v=Math.max(0,Math.min(100,Number(h)||0)); const r=Math.round(255*(1-v/100)); const g=Math.round(180*(v/100)+40); return \`rgb(\${r},\${g},120)\`; }
function riskColor(r){ const v=Math.max(0,Math.min(100,Number(r)||0)); return \`rgb(\${Math.round(120+v*1.3)},\${Math.round(200-v*1.5)},90)\`; }
function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function edgeKey(e){ return e.source+'|'+e.target+'|'+(e.relationship_type||''); }

function nodeRadius(n){
  const mode=(cfg.node_size_by||'degree').toLowerCase();
  if(mode==='none') return 8;
  let v = mode==='value' ? num(n.value, num(n.degree,1)) : num(n.degree,1);
  const vals = nodes.map(x => mode==='value' ? num(x.value, num(x.degree,1)) : num(x.degree,1));
  const lo=Math.min(...vals), hi=Math.max(...vals);
  if(!(hi>lo)) return 10;
  const t=(v-lo)/(hi-lo);
  return 6 + Math.sqrt(t)*14;
}
function nodeFill(n){
  const mode=(cfg.node_color_by||'category').toLowerCase();
  if(mode==='health_score') return healthColor(n.health_score);
  if(mode==='risk_score') return riskColor(n.risk_score);
  return catColor(n.category||'Other');
}
function edgeWidth(e){
  const mode=(cfg.edge_width_by||'weight').toLowerCase();
  if(mode==='none') return 1.2;
  let v = mode==='frequency' ? num(e.frequency,1) : mode==='value' ? num(e.edge_value, num(e.weight,1)) : num(e.weight,1);
  const vals = edges.map(x => mode==='frequency' ? num(x.frequency,1) : mode==='value' ? num(x.edge_value, num(x.weight,1)) : num(x.weight,1));
  const lo=Math.min(...vals), hi=Math.max(...vals);
  if(!(hi>lo)) return 1.5;
  return 0.8 + ((v-lo)/(hi-lo))*4.5;
}
function edgeStroke(e){
  const mode=(cfg.edge_color_by||'relationship_type').toLowerCase();
  if(mode==='none') return 'rgba(148,163,184,.55)';
  if(mode==='risk_score') return riskColor(e.edge_risk_score);
  if(mode==='status'){
    const s=String(e.edge_status||'').toLowerCase();
    if(s==='blocked') return '#f87171';
    if(s==='watch') return '#fbbf24';
    return '#34d399';
  }
  return typeColor(e.relationship_type||'link');
}

function initLayout(W,H){
  const pad=36;
  const mode=(cfg.layout_algorithm||'force').toLowerCase();
  nodes.forEach((n,i)=>{
    if(mode==='radial'){
      const ang=(i/Math.max(nodes.length,1))*Math.PI*2;
      const rad=Math.min(W,H)*0.35;
      n.x=W/2+Math.cos(ang)*rad;
      n.y=H/2+Math.sin(ang)*rad;
    } else {
      const ang=hashStr(n.id)%360 * Math.PI/180;
      const rad=20+(hashStr(n.id+'r')%100);
      n.x=W/2+Math.cos(ang)*rad*(0.4+Math.random()*0.6);
      n.y=H/2+Math.sin(ang)*rad*(0.4+Math.random()*0.6);
    }
    n.vx=0; n.vy=0; n._r=nodeRadius(n);
  });
  if(mode!=='radial'){
    for(let iter=0; iter<180; iter++){
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const a=nodes[i], b=nodes[j];
          let dx=a.x-b.x, dy=a.y-b.y;
          let dist=Math.sqrt(dx*dx+dy*dy)||0.01;
          const force=900/(dist*dist);
          dx=(dx/dist)*force; dy=(dy/dist)*force;
          a.vx+=dx; a.vy+=dy; b.vx-=dx; b.vy-=dy;
        }
      }
      edges.forEach(e=>{
        const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);
        if(!a||!b) return;
        let dx=b.x-a.x, dy=b.y-a.y;
        let dist=Math.sqrt(dx*dx+dy*dy)||0.01;
        const ideal=70;
        const force=(dist-ideal)*0.02;
        dx=(dx/dist)*force; dy=(dy/dist)*force;
        a.vx+=dx; a.vy+=dy; b.vx-=dx; b.vy-=dy;
      });
      nodes.forEach(n=>{
        n.vx+=(W/2-n.x)*0.004; n.vy+=(H/2-n.y)*0.004;
        n.vx*=0.85; n.vy*=0.85;
        n.x+=n.vx; n.y+=n.vy;
        n.x=Math.max(pad+n._r, Math.min(W-pad-n._r, n.x));
        n.y=Math.max(pad+n._r, Math.min(H-pad-n._r, n.y));
      });
    }
  }
  settled=true;
}

function visibleNodes(){
  return nodes.filter(n=>{
    if(hiddenCats.has(String(n.category||'Other'))) return false;
    if(searchQuery){
      const q=searchQuery.toLowerCase();
      if(!String(n.label||'').toLowerCase().includes(q) && !String(n.id).toLowerCase().includes(q)) return false;
    }
    return true;
  });
}
function visibleNodeIds(){ return new Set(visibleNodes().map(n=>n.id)); }
function visibleEdges(){
  const ids=visibleNodeIds();
  return edges.filter(e=>{
    if(hiddenTypes.has(String(e.relationship_type||''))) return false;
    return ids.has(e.source) && ids.has(e.target);
  });
}

function neighborhood(rootId, depth){
  const keep=new Set([rootId]);
  let frontier=new Set([rootId]);
  for(let d=0;d<depth;d++){
    const next=new Set();
    edges.forEach(e=>{
      if(frontier.has(e.source) && !keep.has(e.target)){ next.add(e.target); keep.add(e.target); }
      if(frontier.has(e.target) && !keep.has(e.source)){ next.add(e.source); keep.add(e.source); }
    });
    frontier=next;
  }
  return keep;
}

function screenToWorld(sx,sy){ return { x:(sx-panX)/zoom, y:(sy-panY)/zoom }; }
function hitNode(sx,sy){
  const p=screenToWorld(sx,sy);
  const vis=visibleNodes();
  for(let i=vis.length-1;i>=0;i--){
    const n=vis[i];
    const dx=p.x-n.x, dy=p.y-n.y;
    if(dx*dx+dy*dy <= (n._r+2)*(n._r+2)) return n;
  }
  return null;
}
function hitEdge(sx,sy){
  const p=screenToWorld(sx,sy);
  const vis=visibleEdges();
  let best=null, bestD=8/zoom;
  vis.forEach(e=>{
    const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);
    if(!a||!b) return;
    const dx=b.x-a.x, dy=b.y-a.y;
    const len2=dx*dx+dy*dy||1;
    let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2;
    t=Math.max(0,Math.min(1,t));
    const hx=a.x+t*dx, hy=a.y+t*dy;
    const d=Math.hypot(p.x-hx,p.y-hy);
    if(d<bestD){ bestD=d; best=e; }
  });
  return best;
}

function drawArrow(ax,ay,bx,by,color,width){
  const ang=Math.atan2(by-ay,bx-ax);
  const mx=(ax+bx)/2, my=(ay+by)/2;
  const s=6+width;
  ctx.beginPath();
  ctx.moveTo(mx,my);
  ctx.lineTo(mx-s*Math.cos(ang-0.4), my-s*Math.sin(ang-0.4));
  ctx.lineTo(mx-s*Math.cos(ang+0.4), my-s*Math.sin(ang+0.4));
  ctx.closePath();
  ctx.fillStyle=color;
  ctx.fill();
}

function draw(){
  const wrap=canvas.parentElement;
  const W=wrap.clientWidth||640, H=wrap.clientHeight||560;
  const dpr=window.devicePixelRatio||1;
  if(canvas.width!==W*dpr || canvas.height!==H*dpr){
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  if(!settled && nodes.length){ initLayout(W,H); buildLegend(); }

  const highlight = selectedId ? neighborhood(selectedId, cfg.highlight_depth||1) : null;
  const visNodes=visibleNodes();
  const visEdges=visibleEdges();

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  visEdges.forEach(e=>{
    const a=nodes.find(n=>n.id===e.source), b=nodes.find(n=>n.id===e.target);
    if(!a||!b) return;
    const dim = highlight && !(highlight.has(e.source) && highlight.has(e.target));
    const color=edgeStroke(e);
    const w=edgeWidth(e);
    ctx.beginPath();
    ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=dim ? 'rgba(100,116,139,.2)' : color;
    ctx.globalAlpha=dim ? 0.35 : (hoverEdgeKey===edgeKey(e) ? 1 : 0.75);
    ctx.lineWidth=w / Math.max(zoom,0.5);
    ctx.stroke();
    ctx.globalAlpha=1;
    if(cfg.show_arrows && !dim) drawArrow(a.x,a.y,b.x,b.y,color,w);
  });

  visNodes.forEach(n=>{
    const dim = highlight && !highlight.has(n.id);
    const r=n._r||nodeRadius(n);
    n._r=r;
    ctx.beginPath();
    ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fillStyle=dim ? 'rgba(100,116,139,.35)' : nodeFill(n);
    ctx.globalAlpha=dim ? 0.35 : 1;
    ctx.fill();
    ctx.lineWidth=(n.id===keyboardNodeId ? 3.5 : (n.id===selectedId || n.id===hoverNodeId ? 2.5 : 1.2)) / Math.max(zoom,0.5);
    ctx.strokeStyle=n.id===keyboardNodeId ? '#67e8f9' : (n.id===selectedId ? '#f8fafc' : 'rgba(15,23,42,.55)');
    ctx.stroke();
    ctx.globalAlpha=1;
    if(!dim && (zoom>0.7 || n.id===selectedId || n.id===hoverNodeId)){
      ctx.fillStyle='#e2e8f0';
      ctx.font=\`\${11/Math.max(zoom,0.7)}px system-ui,sans-serif\`;
      ctx.textAlign='center';
      ctx.fillText(String(n.label||n.id).slice(0,18), n.x, n.y+r+12/Math.max(zoom,0.7));
    }
  });
  ctx.restore();
  requestAnimationFrame(draw);
}

function buildLegend(){
  legendEl.innerHTML='';
  const cats=[...new Set(nodes.map(n=>String(n.category||'Other')))].sort();
  const types=[...new Set(edges.map(e=>String(e.relationship_type||'link')))].sort();
  cats.forEach(cat=>{
    const el=document.createElement('button');
    el.type='button';
    el.className='leg'+(hiddenCats.has(cat)?' off':'');
    el.style.background=catColor(cat);
    el.textContent='● '+cat;
    el.setAttribute('aria-label','Toggle category '+cat);
    el.setAttribute('aria-pressed',String(!hiddenCats.has(cat)));
    el.onclick=()=>{ if(hiddenCats.has(cat)) hiddenCats.delete(cat); else hiddenCats.add(cat); el.classList.toggle('off'); el.setAttribute('aria-pressed',String(!hiddenCats.has(cat))); };
    legendEl.appendChild(el);
  });
  types.forEach(t=>{
    const el=document.createElement('button');
    el.type='button';
    el.className='leg'+(hiddenTypes.has(t)?' off':'');
    el.style.background=typeColor(t);
    el.textContent='— '+t;
    el.setAttribute('aria-label','Toggle relationship type '+t);
    el.setAttribute('aria-pressed',String(!hiddenTypes.has(t)));
    el.onclick=()=>{ if(hiddenTypes.has(t)) hiddenTypes.delete(t); else hiddenTypes.add(t); el.classList.toggle('off'); el.setAttribute('aria-pressed',String(!hiddenTypes.has(t))); };
    legendEl.appendChild(el);
  });
}

function showTip(html, sx, sy){
  tip.innerHTML=html; tip.style.display='block';
  const wrap=canvas.parentElement.getBoundingClientRect();
  tip.style.left=Math.min(sx+12, wrap.width-220)+'px';
  tip.style.top=Math.min(sy+12, wrap.height-80)+'px';
}
function hideTip(){ tip.style.display='none'; }
function keyboardTipHtml(n){
  return '<strong>'+esc(n.label||n.id)+'</strong><br/>Category: '+esc(n.category||'—')+'<br/>Degree: '+num(n.degree,0);
}
function selectKeyboardNode(direction){
  const candidates=visibleNodes();
  if(!candidates.length) return;
  const currentIndex=candidates.findIndex(n=>n.id===keyboardNodeId);
  const nextIndex=currentIndex<0 ? (direction<0 ? candidates.length-1 : 0) : (currentIndex+direction+candidates.length)%candidates.length;
  const node=candidates[nextIndex];
  keyboardNodeId=node.id;
  const rect=canvas.getBoundingClientRect();
  showTip(keyboardTipHtml(node),12,Math.min(12,rect.height-80));
  announcer.textContent='Focused node '+String(node.label||node.id)+'. Press Enter or Space to toggle its highlight.';
  draw();
}

canvas.addEventListener('pointerdown', (ev)=>{
  dragging=true; didDrag=false;
  dragStartX=ev.clientX; dragStartY=ev.clientY;
  panStartX=panX; panStartY=panY;
  canvas.setPointerCapture(ev.pointerId);
});
canvas.addEventListener('pointermove', (ev)=>{
  const rect=canvas.getBoundingClientRect();
  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;
  if(dragging){
    const dx=ev.clientX-dragStartX, dy=ev.clientY-dragStartY;
    if(Math.hypot(dx,dy)>3) didDrag=true;
    panX=panStartX+dx; panY=panStartY+dy;
    hideTip(); return;
  }
  const n=hitNode(sx,sy);
  const e=n?null:hitEdge(sx,sy);
  hoverNodeId=n?n.id:null;
  hoverEdgeKey=e?edgeKey(e):null;
  if(n){
    showTip(\`<strong>\${esc(n.label||n.id)}</strong><br/>Category: \${esc(n.category||'—')}<br/>Degree: \${num(n.degree,0)}\`
      +(n.value!=null?\`<br/>Value: \${num(n.value,0)}\`:'')
      +(n.health_score!=null?\`<br/>Health: \${num(n.health_score,0)}\`:'')
      +(n.risk_score!=null?\`<br/>Risk: \${num(n.risk_score,0)}\`:''), sx, sy);
  } else if(e){
    showTip(\`<strong>\${esc(e.relationship_type||'link')}</strong><br/>\${esc(e.source)} → \${esc(e.target)}<br/>Weight: \${num(e.weight,0)}\`
      +(e.edge_status?\`<br/>Status: \${esc(e.edge_status)}\`:'')
      +(e.edge_risk_score!=null?\`<br/>Risk: \${num(e.edge_risk_score,0)}\`:''), sx, sy);
  } else hideTip();
});
canvas.addEventListener('pointerup', (ev)=>{
  dragging=false;
  if(!didDrag){
    const rect=canvas.getBoundingClientRect();
    const n=hitNode(ev.clientX-rect.left, ev.clientY-rect.top);
    keyboardNodeId=null;
    selectedId = n ? (selectedId===n.id ? null : n.id) : null;
  }
});
canvas.addEventListener('pointerleave', ()=>{ hoverNodeId=null; hoverEdgeKey=null; hideTip(); });
canvas.addEventListener('wheel', (ev)=>{
  ev.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;
  const before=screenToWorld(sx,sy);
  const factor=ev.deltaY>0 ? 0.92 : 1.08;
  zoom=Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom*factor));
  panX=sx-before.x*zoom; panY=sy-before.y*zoom;
}, {passive:false});
canvas.addEventListener('dblclick', ()=>{ panX=0; panY=0; zoom=1; selectedId=null; keyboardNodeId=null; });
searchEl.addEventListener('input', ()=>{ searchQuery=searchEl.value.trim(); });
canvas.addEventListener('keydown', (ev)=>{
  if(ev.key==='ArrowRight'||ev.key==='ArrowDown'){ ev.preventDefault(); selectKeyboardNode(1); return; }
  if(ev.key==='ArrowLeft'||ev.key==='ArrowUp'){ ev.preventDefault(); selectKeyboardNode(-1); return; }
  if(ev.key==='Enter'||ev.key===' '){
    if(keyboardNodeId!==null){
      ev.preventDefault();
      selectedId=selectedId===keyboardNodeId?null:keyboardNodeId;
      const node=nodes.find(candidate=>candidate.id===keyboardNodeId);
      announcer.textContent=node ? (selectedId===null ? 'Cleared highlight for ' : 'Highlighted ')+String(node.label||node.id)+'.' : 'Graph selection cleared.';
      draw();
    }
    return;
  }
  if(ev.key==='Escape'){ selectedId=null; keyboardNodeId=null; hideTip(); announcer.textContent='Graph selection cleared.'; draw(); return; }
  if(ev.key==='Home'){ panX=0; panY=0; zoom=1; selectedId=null; keyboardNodeId=null; hideTip(); announcer.textContent='Graph view reset.'; draw(); return; }
  if(ev.key==='+'||ev.key==='='){ ev.preventDefault(); zoom=Math.min(MAX_ZOOM,zoom*1.1); draw(); return; }
  if(ev.key==='-'){ ev.preventDefault(); zoom=Math.max(MIN_ZOOM,zoom/1.1); draw(); }
});

function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

requestAnimationFrame(draw);
</script></body></html>`.replaceAll("\\`", "`").replaceAll("\\${", "${");
