namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

/// <summary>
/// Builds the self-contained HTML/JS canvas renderer for Terrain Story (Streamlit components.html).
/// Payload is injected at runtime via the <c>__TERRAIN_PAYLOAD__</c> placeholder.
/// Surface-mode algorithm is kept in sync with client <c>terrainCanvasDraw.ts</c>.
/// </summary>
internal static class TerrainStreamlitHtmlHelper
{
    public const string PayloadPlaceholder = "__TERRAIN_PAYLOAD__";

    public const int DefaultHeightPx = 580;

    /// <summary>
    /// Returns a Python triple-quoted HTML string literal (content only; caller wraps assignment).
    /// </summary>
    public static string GetHtmlTemplatePythonLiteral() =>
        StoryStreamlitHtmlChrome.EscapeForPythonTripleQuoted(GetHtmlTemplate());

    public static string GetHtmlTemplate() =>
        StoryStreamlitHtmlChrome.BuildDocument(
            wrapBackground: "#0a1628",
            tipBackground: "rgba(10,22,40,.96)",
            tipZIndex: 4,
            tipMaxWidthPx: 280,
            extraCss: """
#toolbar{position:absolute;left:10px;top:10px;z-index:4;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.tbtn{cursor:pointer;padding:3px 8px;border-radius:6px;font-size:11px;background:rgba(15,23,42,.85);color:#e2e8f0;border:1px solid #475569;user-select:none;}
.tbtn.off{opacity:.4;text-decoration:line-through;}
""",
            wrapInnerHtml: "<div id=\"toolbar\"><span class=\"tbtn\" id=\"togPeaks\">Peaks</span><span class=\"tbtn\" id=\"togValleys\">Valleys</span><span class=\"tbtn\" id=\"togEvents\">Events</span></div><canvas id=\"c\"></canvas><div id=\"tip\"></div><div id=\"hint\">Drag to pan · scroll to zoom · double-click to reset</div>",
            rendererScript: GetRendererScript());

    private static string GetRendererScript()
    {
        // Keep surface/ridge/heat algorithm in sync with client terrainCanvasDraw.ts
        return """
const payload = __TERRAIN_PAYLOAD__;
const canvas = document.getElementById('c');
const tip = document.getElementById('tip');
const ctx = canvas.getContext('2d');
const cfg = Object.assign({
  terrain_mode: 'surface', height_scale: 1, interpolation: 'bilinear', grid_resolution: 60,
  color_by: 'height_metric', show_peak_labels: true, show_valley_labels: true,
  camera_preset: 'angled', aggregation_method: 'sum'
}, (payload && payload.visualConfig) || {});
let records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];
let callouts = Array.isArray(payload && payload.callouts) ? payload.callouts.slice() : [];
const summary = (payload && payload.summary) || {};
let peaks = Array.isArray(summary.top_peaks) ? summary.top_peaks : [];
let valleys = Array.isArray(summary.bottom_valleys) ? summary.bottom_valleys : [];
let showPeaks = cfg.show_peak_labels !== false;
let showValleys = cfg.show_valley_labels !== false;
let showEvents = true;
let selectedKey = null;
let hoverKey = null;
let panX = 0, panY = 0, zoom = 1;
let dragging = false, didDrag = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
const MIN_ZOOM = 0.55, MAX_ZOOM = 2.75;
const MAX_DENSE = 80;

function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function cellKey(x,y){ return String(x)+'|'+String(y); }
function heightColor(t){
  const stops=[[0,'#0c4a6e'],[0.25,'#0e7490'],[0.5,'#14b8a6'],[0.75,'#fbbf24'],[1,'#f97316']];
  t=Math.max(0,Math.min(1,t));
  for(let i=0;i<stops.length-1;i++){
    if(t<=stops[i+1][0]){
      const a=stops[i], b=stops[i+1];
      const u=(t-a[0])/((b[0]-a[0])||1);
      return lerpHex(a[1],b[1],u);
    }
  }
  return stops[stops.length-1][1];
}
function riskColor(r){ const v=Math.max(0,Math.min(100,num(r,0))); return `rgb(${Math.round(80+v*1.7)},${Math.round(200-v*1.4)},70)`; }
function lerpHex(a,b,t){
  const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
  const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
  const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
  const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t);
  return `rgb(${r},${g},${bl})`;
}
function darkenRgb(css, factor){
  const m=String(css).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if(!m) return css;
  const f=Math.max(0,Math.min(1,factor));
  return `rgb(${Math.round(+m[1]*f)},${Math.round(+m[2]*f)},${Math.round(+m[3]*f)})`;
}
function categoryColor(c){
  const cols=['#2dd4bf','#38bdf8','#a78bfa','#f472b6','#fbbf24','#34d399'];
  let h=0; for(let i=0;i<String(c).length;i++){ h=((h<<5)-h)+String(c).charCodeAt(i); h|=0; }
  return cols[Math.abs(h)%cols.length];
}

function buildGrid(){
  const xs=[...new Set(records.map(r=>String(r.x)))].sort();
  const ys=[...new Set(records.map(r=>String(r.y)))].sort();
  const map=new Map();
  records.forEach(r=>map.set(cellKey(r.x,r.y), r));
  const heights=records.map(r=>num(r.height,0));
  const minH=heights.length?Math.min(...heights):0;
  const maxH=heights.length?Math.max(...heights):1;
  return {xs, ys, map, minH, maxH};
}

function cellFill(rec, minH, maxH){
  const mode=(cfg.color_by||'height_metric').toLowerCase();
  if(mode==='risk_score') return riskColor(rec.risk_score);
  if(mode==='variance'){
    const v=num(rec.variance,0);
    const t=0.5+Math.max(-0.5,Math.min(0.5,v/((maxH-minH)||1)));
    return heightColor(t);
  }
  if(mode==='category') return categoryColor(rec.category||'Other');
  const t=((num(rec.height,0)-minH)/((maxH-minH)||1));
  return heightColor(Math.pow(Math.max(0,t), 1/Math.max(cfg.height_scale||1,0.1)));
}

function heightNormColor(h, minH, maxH){
  const t=((h-minH)/((maxH-minH)||1));
  return heightColor(Math.pow(Math.max(0,Math.min(1,t)), 1/Math.max(cfg.height_scale||1,0.1)));
}

function sparseHeights(grid){
  const rows=grid.ys.length, cols=grid.xs.length;
  const H=Array.from({length:rows},()=>Array(cols).fill(null));
  for(let yi=0;yi<rows;yi++){
    for(let xi=0;xi<cols;xi++){
      const rec=grid.map.get(cellKey(grid.xs[xi],grid.ys[yi]));
      if(rec) H[yi][xi]=num(rec.height,0);
    }
  }
  return H;
}

function sampleSparse(H, fx, fy){
  const rows=H.length, cols=H[0]?H[0].length:0;
  if(rows===0||cols===0) return null;
  const x0=Math.floor(fx), y0=Math.floor(fy);
  const x1=Math.min(x0+1, cols-1), y1=Math.min(y0+1, rows-1);
  const tx=fx-x0, ty=fy-y0;
  const v00=H[y0][x0], v10=H[y0][x1], v01=H[y1][x0], v11=H[y1][x1];
  const known=[v00,v10,v01,v11].filter(v=>v!=null);
  if(!known.length) return null;
  const a=v00!=null?v00:(v10!=null?v10:(v01!=null?v01:v11));
  const b=v10!=null?v10:(v00!=null?v00:(v11!=null?v11:v01));
  const c=v01!=null?v01:(v00!=null?v00:(v11!=null?v11:v10));
  const d=v11!=null?v11:(v10!=null?v10:(v01!=null?v01:v00));
  const top=a+(b-a)*tx, bot=c+(d-c)*tx;
  return top+(bot-top)*ty;
}

function buildDense(grid){
  const sparse=sparseHeights(grid);
  const rows=grid.ys.length, cols=grid.xs.length;
  const useBilinear=(cfg.interpolation||'bilinear').toLowerCase()==='bilinear';
  const want=Math.min(MAX_DENSE, Math.max(10, num(cfg.grid_resolution,60)|0));
  let denseCols=cols, denseRows=rows;
  if(useBilinear && Math.max(cols,rows)>1){
    if(cols>=rows){ denseCols=Math.max(cols, want); denseRows=Math.max(rows, Math.round(want*(rows/Math.max(cols,1)))); }
    else { denseRows=Math.max(rows, want); denseCols=Math.max(cols, Math.round(want*(cols/Math.max(rows,1)))); }
    denseCols=Math.min(MAX_DENSE, denseCols);
    denseRows=Math.min(MAX_DENSE, denseRows);
  }
  const dense=Array.from({length:denseRows},()=>Array(denseCols).fill(null));
  for(let yi=0;yi<denseRows;yi++){
    for(let xi=0;xi<denseCols;xi++){
      const fx=cols<=1?0:(xi/(denseCols-1))*(cols-1);
      const fy=rows<=1?0:(yi/(denseRows-1))*(rows-1);
      if(useBilinear) dense[yi][xi]=sampleSparse(sparse, fx, fy);
      else {
        const sx=Math.round(fx), sy=Math.round(fy);
        dense[yi][xi]=sparse[sy]?sparse[sy][sx]:null;
      }
    }
  }
  return {dense, denseCols, denseRows, sparseCols:cols, sparseRows:rows};
}

function cameraFactors(){
  const cam=(cfg.camera_preset||'angled').toLowerCase();
  if(cam==='front') return {xSkew:0.15, yDepth:0.55, elevMul:1.15};
  if(cam==='top') return {xSkew:0.55, yDepth:0.35, elevMul:0.45};
  return {xSkew:0.55, yDepth:0.42, elevMul:1}; // angled / free
}

function layoutHeat(W,H,grid){
  const padL=90, padR=16, padT=40, padB=50;
  const cw=Math.max(20,(W-padL-padR)/Math.max(grid.xs.length,1));
  const ch=Math.max(16,(H-padT-padB)/Math.max(grid.ys.length,1));
  return {padL,padR,padT,padB,cw,ch};
}

function drawHeat(W,H){
  const grid=buildGrid();
  if(!grid.xs.length||!grid.ys.length) return null;
  const L=layoutHeat(W,H,grid);
  ctx.save();
  ctx.translate(panX,panY); ctx.scale(zoom,zoom);

  grid.ys.forEach((y,yi)=>{
    grid.xs.forEach((x,xi)=>{
      const rec=grid.map.get(cellKey(x,y));
      const px=L.padL+xi*L.cw, py=L.padT+yi*L.ch;
      ctx.fillStyle=rec?cellFill(rec,grid.minH,grid.maxH):'rgba(30,41,59,.4)';
      ctx.globalAlpha = (selectedKey && selectedKey!==cellKey(x,y)) ? 0.35 : 1;
      ctx.fillRect(px+1,py+1,L.cw-2,L.ch-2);
      if(hoverKey===cellKey(x,y) || selectedKey===cellKey(x,y)){
        ctx.strokeStyle='#f8fafc'; ctx.lineWidth=2/Math.max(zoom,0.5);
        ctx.strokeRect(px+1,py+1,L.cw-2,L.ch-2);
      }
      ctx.globalAlpha=1;
    });
  });

  ctx.fillStyle='#94a3b8'; ctx.font='11px system-ui,sans-serif'; ctx.textAlign='right';
  grid.ys.forEach((y,yi)=>{
    ctx.fillText(String(y).slice(0,14), L.padL-6, L.padT+yi*L.ch+L.ch*0.65);
  });
  ctx.textAlign='center';
  grid.xs.forEach((x,xi)=>{
    const label=String(x).slice(0,10);
    ctx.save();
    ctx.translate(L.padL+xi*L.cw+L.cw/2, L.padT+grid.ys.length*L.ch+14);
    ctx.rotate(-0.35);
    ctx.fillText(label,0,0);
    ctx.restore();
  });

  drawMarkers(grid, L, false, null);
  ctx.restore();
  return {grid,L,mode:'heat'};
}

function drawRidge(W,H){
  const grid=buildGrid();
  if(!grid.xs.length||!grid.ys.length) return null;
  const pad=40;
  const ox=W*0.18, oy=H*0.72;
  const sx=((W-pad*2)/Math.max(grid.xs.length,1))*0.7;
  const sy=((H-pad*2)/Math.max(grid.ys.length,1))*0.45;
  const hz=H*0.40*(cfg.height_scale||1);

  ctx.save();
  ctx.translate(panX,panY); ctx.scale(zoom,zoom);

  for(let yi=0; yi<grid.ys.length; yi++){
    for(let xi=0; xi<grid.xs.length; xi++){
      const x=grid.xs[xi], y=grid.ys[yi];
      const rec=grid.map.get(cellKey(x,y));
      const h=rec?num(rec.height,0):0;
      const elev=((h-grid.minH)/((grid.maxH-grid.minH)||1))*hz;
      const px=ox+xi*sx - yi*sx*0.45;
      const py=oy+yi*sy - elev;
      const w=sx*0.85, d=sy*0.7;
      ctx.globalAlpha = (selectedKey && selectedKey!==cellKey(x,y)) ? 0.3 : 0.95;
      ctx.fillStyle=rec?cellFill(rec,grid.minH,grid.maxH):'#334155';
      ctx.beginPath();
      ctx.moveTo(px,py); ctx.lineTo(px+w,py); ctx.lineTo(px+w*0.55,py-d); ctx.lineTo(px-w*0.35,py-d);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,.22)';
      ctx.beginPath();
      ctx.moveTo(px,py); ctx.lineTo(px+w,py); ctx.lineTo(px+w,py+Math.max(6,elev*0.2)); ctx.lineTo(px,py+Math.max(6,elev*0.2));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
    }
  }
  drawMarkers(grid, {padL:ox,padT:oy,cw:sx,ch:sy,ridge:true,hz,minH:grid.minH,maxH:grid.maxH}, true, null);
  ctx.restore();
  return {grid,mode:'ridge',L:{padL:ox,padT:oy,cw:sx,ch:sy,hz,minH:grid.minH,maxH:grid.maxH}};
}

function projectIso(xi, yi, h, layout){
  const elev=((h-layout.minH)/((layout.maxH-layout.minH)||1))*layout.baseElev*layout.elevMul*(cfg.height_scale||1);
  const sx=layout.originX + (xi - yi*layout.xSkew)*layout.cellW;
  const sy=layout.originY + (xi + yi)*layout.cellH - elev;
  return {x:sx, y:sy, elev};
}

function drawSurface(W,H){
  const grid=buildGrid();
  if(!grid.xs.length||!grid.ys.length) return null;
  const mesh=buildDense(grid);
  const cam=cameraFactors();
  const nX=mesh.denseCols, nY=mesh.denseRows;
  const span=Math.max(nX,nY,1);
  const cellW=Math.min((W*0.72)/span, (H*0.55)/span);
  const cellH=cellW*cam.yDepth;
  const baseElev=H*0.40;
  const originX=W*0.5 - ((nX-1)-(nY-1)*cam.xSkew)*cellW*0.5;
  const originY=H*0.62;
  const layout={originX,originY,cellW,cellH,baseElev,elevMul:cam.elevMul,xSkew:cam.xSkew,minH:grid.minH,maxH:grid.maxH,nX,nY,mesh};

  ctx.save();
  ctx.translate(panX,panY); ctx.scale(zoom,zoom);

  // ground shadow plate
  ctx.fillStyle='rgba(15,23,42,.55)';
  const g0=projectIso(0,0,grid.minH,layout);
  const g1=projectIso(nX-1,0,grid.minH,layout);
  const g2=projectIso(nX-1,nY-1,grid.minH,layout);
  const g3=projectIso(0,nY-1,grid.minH,layout);
  ctx.beginPath();
  ctx.moveTo(g0.x,g0.y+8); ctx.lineTo(g1.x,g1.y+8); ctx.lineTo(g2.x,g2.y+8); ctx.lineTo(g3.x,g3.y+8);
  ctx.closePath(); ctx.fill();

  const faces=[];
  for(let yi=0;yi<nY-1;yi++){
    for(let xi=0;xi<nX-1;xi++){
      const h00=mesh.dense[yi][xi], h10=mesh.dense[yi][xi+1];
      const h01=mesh.dense[yi+1][xi], h11=mesh.dense[yi+1][xi+1];
      if(h00==null||h10==null||h01==null||h11==null) continue;
      const p00=projectIso(xi,yi,h00,layout);
      const p10=projectIso(xi+1,yi,h10,layout);
      const p01=projectIso(xi,yi+1,h01,layout);
      const p11=projectIso(xi+1,yi+1,h11,layout);
      const avgH=(h00+h10+h01+h11)/4;
      const depth=xi+yi;
      faces.push({depth, avgH, p00,p10,p01,p11, xi, yi});
    }
  }
  faces.sort((a,b)=>a.depth-b.depth || a.avgH-b.avgH);

  faces.forEach(f=>{
    const top=heightNormColor(f.avgH, grid.minH, grid.maxH);
    const side=darkenRgb(top, 0.55);
    const front=darkenRgb(top, 0.72);
    // left/back side strip (toward +y)
    ctx.fillStyle=side;
    ctx.beginPath();
    ctx.moveTo(f.p01.x,f.p01.y); ctx.lineTo(f.p11.x,f.p11.y);
    ctx.lineTo(f.p11.x,f.p11.y+Math.max(2,f.p11.elev*0.08));
    ctx.lineTo(f.p01.x,f.p01.y+Math.max(2,f.p01.elev*0.08));
    ctx.closePath(); ctx.fill();
    // right/front strip (toward +x)
    ctx.fillStyle=front;
    ctx.beginPath();
    ctx.moveTo(f.p10.x,f.p10.y); ctx.lineTo(f.p11.x,f.p11.y);
    ctx.lineTo(f.p11.x,f.p11.y+Math.max(2,f.p11.elev*0.08));
    ctx.lineTo(f.p10.x,f.p10.y+Math.max(2,f.p10.elev*0.08));
    ctx.closePath(); ctx.fill();
    // top face
    ctx.fillStyle=top;
    ctx.beginPath();
    ctx.moveTo(f.p00.x,f.p00.y); ctx.lineTo(f.p10.x,f.p10.y);
    ctx.lineTo(f.p11.x,f.p11.y); ctx.lineTo(f.p01.x,f.p01.y);
    ctx.closePath(); ctx.fill();
    if(hoverKey && String(hoverKey)===cellKey(grid.xs[Math.min(Math.round(f.xi*grid.xs.length/Math.max(nX,1)),grid.xs.length-1)], grid.ys[Math.min(Math.round(f.yi*grid.ys.length/Math.max(nY,1)),grid.ys.length-1)])){
      ctx.strokeStyle='rgba(248,250,252,.7)'; ctx.lineWidth=1;
      ctx.stroke();
    }
  });

  // axis labels (sparse)
  ctx.fillStyle='#94a3b8'; ctx.font='10px system-ui,sans-serif';
  grid.xs.forEach((x,xi)=>{
    const fx=nX<=1?0:(xi/(grid.xs.length-1||1))*(nX-1);
    const p=projectIso(fx, nY-1, grid.minH, layout);
    ctx.textAlign='center';
    ctx.fillText(String(x).slice(0,10), p.x, p.y+18);
  });
  grid.ys.forEach((y,yi)=>{
    const fy=nY<=1?0:(yi/(grid.ys.length-1||1))*(nY-1);
    const p=projectIso(0, fy, grid.minH, layout);
    ctx.textAlign='right';
    ctx.fillText(String(y).slice(0,12), p.x-8, p.y+4);
  });

  drawMarkers(grid, layout, false, mesh);
  ctx.restore();
  return {grid,L:layout,mode:'surface',mesh};
}

function sparseToDenseCoord(si, sparseCount, denseCount){
  if(sparseCount<=1) return 0;
  return (si/(sparseCount-1))*(denseCount-1);
}

function drawMarkers(grid, L, ridge, mesh){
  const mark=(list, color, prefix)=>{
    list.forEach((p,i)=>{
      const xi=grid.xs.indexOf(String(p.x)), yi=grid.ys.indexOf(String(p.y));
      if(xi<0||yi<0) return;
      let px, py;
      if(ridge){
        const elev=((num(p.height,0)-L.minH)/((L.maxH-L.minH)||1))*L.hz;
        px=L.padL+xi*L.cw - yi*L.cw*0.45 + L.cw*0.3;
        py=L.padT+yi*L.ch - elev - 10;
      } else if(mesh && L.baseElev!=null){
        const dx=sparseToDenseCoord(xi, grid.xs.length, mesh.denseCols);
        const dy=sparseToDenseCoord(yi, grid.ys.length, mesh.denseRows);
        const h=num(p.height,0);
        const pt=projectIso(dx, dy, h, L);
        px=pt.x; py=pt.y-10;
      } else {
        px=L.padL+xi*L.cw+L.cw/2;
        py=L.padT+yi*L.ch+L.ch/2;
      }
      const r=7/Math.max(zoom,0.6);
      ctx.fillStyle='rgba(15,23,42,.75)';
      ctx.beginPath(); ctx.arc(px,py,r+2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=color;
      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#0a1628'; ctx.lineWidth=2/Math.max(zoom,0.6);
      ctx.fillStyle='#f8fafc';
      ctx.font=`bold ${11/Math.max(zoom,0.7)}px system-ui`;
      ctx.textAlign='left';
      ctx.strokeText(prefix+(i+1), px+r+3, py+4);
      ctx.fillText(prefix+(i+1), px+r+3, py+4);
    });
  };
  if(showPeaks) mark(peaks, '#f97316', 'P');
  if(showValleys) mark(valleys, '#38bdf8', 'V');
  if(showEvents){
    callouts.forEach(c=>{
      const xi=grid.xs.indexOf(String(c.x)), yi=grid.ys.indexOf(String(c.y));
      if(xi<0||yi<0) return;
      let px, py;
      if(ridge){
        px=L.padL+xi*L.cw - yi*L.cw*0.45 + L.cw*0.3;
        py=L.padT+yi*L.ch - 18;
      } else if(mesh && L.baseElev!=null){
        const dx=sparseToDenseCoord(xi, grid.xs.length, mesh.denseCols);
        const dy=sparseToDenseCoord(yi, grid.ys.length, mesh.denseRows);
        const h=grid.map.get(cellKey(c.x,c.y));
        const pt=projectIso(dx, dy, h?num(h.height,0):grid.minH, L);
        px=pt.x; py=pt.y-14;
      } else {
        px=L.padL+xi*L.cw+L.cw/2;
        py=L.padT+yi*L.ch+8;
      }
      ctx.fillStyle='#f472b6';
      ctx.beginPath();
      ctx.moveTo(px,py); ctx.lineTo(px-5,py-10); ctx.lineTo(px+5,py-10); ctx.closePath();
      ctx.fill();
    });
  }
}

let lastLayout=null;
function draw(){
  const wrap=canvas.parentElement;
  const W=wrap.clientWidth||640, H=wrap.clientHeight||540;
  const dpr=window.devicePixelRatio||1;
  if(canvas.width!==W*dpr || canvas.height!==H*dpr){
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  const mode=(cfg.terrain_mode||'surface').toLowerCase();
  if(mode==='ridge') lastLayout = drawRidge(W,H);
  else if(mode==='heat_surface') lastLayout = drawHeat(W,H);
  else lastLayout = drawSurface(W,H);
  requestAnimationFrame(draw);
}

function hitCell(sx,sy){
  if(!lastLayout || !lastLayout.grid) return null;
  const grid=lastLayout.grid;
  const p={x:(sx-panX)/zoom, y:(sy-panY)/zoom};
  if(lastLayout.mode==='heat'){
    const L=lastLayout.L;
    const xi=Math.floor((p.x-L.padL)/L.cw);
    const yi=Math.floor((p.y-L.padT)/L.ch);
    if(xi<0||yi<0||xi>=grid.xs.length||yi>=grid.ys.length) return null;
    return grid.map.get(cellKey(grid.xs[xi], grid.ys[yi])) || null;
  }
  // surface / ridge: nearest sparse cell by projected ground distance
  const L=lastLayout.L;
  if(!L) return null;
  let best=null, bestD=Infinity;
  for(let yi=0;yi<grid.ys.length;yi++){
    for(let xi=0;xi<grid.xs.length;xi++){
      const rec=grid.map.get(cellKey(grid.xs[xi],grid.ys[yi]));
      if(!rec) continue;
      let cx, cy;
      if(lastLayout.mode==='surface' && lastLayout.mesh){
        const dx=sparseToDenseCoord(xi, grid.xs.length, lastLayout.mesh.denseCols);
        const dy=sparseToDenseCoord(yi, grid.ys.length, lastLayout.mesh.denseRows);
        const pt=projectIso(dx, dy, num(rec.height,0), L);
        cx=pt.x; cy=pt.y;
      } else if(lastLayout.mode==='ridge'){
        const elev=((num(rec.height,0)-L.minH)/((L.maxH-L.minH)||1))*L.hz;
        cx=L.padL+xi*L.cw - yi*L.cw*0.45 + L.cw*0.3;
        cy=L.padT+yi*L.ch - elev;
      } else continue;
      const d=(cx-p.x)*(cx-p.x)+(cy-p.y)*(cy-p.y);
      if(d<bestD){ bestD=d; best=rec; }
    }
  }
  return bestD<2200 ? best : null;
}

function showTip(html,sx,sy){
  tip.innerHTML=html; tip.style.display='block';
  const wrap=canvas.parentElement.getBoundingClientRect();
  tip.style.left=Math.min(sx+12, wrap.width-240)+'px';
  tip.style.top=Math.min(sy+12, wrap.height-90)+'px';
}
function hideTip(){ tip.style.display='none'; }

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
  const rec=hitCell(sx,sy);
  hoverKey=rec?cellKey(rec.x,rec.y):null;
  if(rec){
    showTip(`<strong>${esc(rec.x)} × ${esc(rec.y)}</strong><br/>Height: ${num(rec.height,0)}`
      +(rec.risk_score!=null?`<br/>Risk: ${num(rec.risk_score,0)}`:'')
      +(rec.target_value!=null?`<br/>Target: ${num(rec.target_value,0)}`:'')
      +(rec.baseline_value!=null?`<br/>Baseline: ${num(rec.baseline_value,0)}`:'')
      +(rec.forecast_value!=null?`<br/>Forecast: ${num(rec.forecast_value,0)}`:'')
      +(rec.volume_value!=null?`<br/>Volume: ${num(rec.volume_value,0)}`:'')
      +(rec.variance!=null?`<br/>Variance: ${Math.round(num(rec.variance,0)*10)/10}`:'')
      +(rec.status?`<br/>Status: ${esc(rec.status)}`:'')
      +(rec.category?`<br/>Category: ${esc(rec.category)}`:''), sx, sy);
  } else hideTip();
});
canvas.addEventListener('pointerup', (ev)=>{
  dragging=false;
  if(!didDrag){
    const rect=canvas.getBoundingClientRect();
    const rec=hitCell(ev.clientX-rect.left, ev.clientY-rect.top);
    const key=rec?cellKey(rec.x,rec.y):null;
    selectedKey = key && selectedKey===key ? null : key;
  }
});
canvas.addEventListener('pointerleave', ()=>{ hoverKey=null; hideTip(); });
canvas.addEventListener('wheel', (ev)=>{
  ev.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;
  const before={x:(sx-panX)/zoom, y:(sy-panY)/zoom};
  zoom=Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom*(ev.deltaY>0?0.92:1.08)));
  panX=sx-before.x*zoom; panY=sy-before.y*zoom;
}, {passive:false});
canvas.addEventListener('dblclick', ()=>{ panX=0; panY=0; zoom=1; selectedKey=null; });

document.getElementById('togPeaks').onclick=function(){ showPeaks=!showPeaks; this.classList.toggle('off', !showPeaks); };
document.getElementById('togValleys').onclick=function(){ showValleys=!showValleys; this.classList.toggle('off', !showValleys); };
document.getElementById('togEvents').onclick=function(){ showEvents=!showEvents; this.classList.toggle('off', !showEvents); };
if(!showPeaks) document.getElementById('togPeaks').classList.add('off');
if(!showValleys) document.getElementById('togValleys').classList.add('off');

function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

requestAnimationFrame(draw);
""";
    }
}
