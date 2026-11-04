/** Self-contained legacy-derived accessible SpiralStory canvas. */
export const SPIRAL_STORY_HTML = String.raw`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif}
#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;color:#e2f6ff}
canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
#wrap:focus-visible{outline:2px solid #38bdf8;outline-offset:-2px}
#toolbar{position:absolute;top:8px;left:10px;right:10px;z-index:5;display:none;align-items:center;gap:8px}
#toolbar label{font-size:11px;color:rgba(226,246,255,.8);white-space:nowrap}
#journeySelect{flex:1;min-width:0;max-width:320px;background:#0f172a;color:#e2f6ff;border:1px solid rgba(148,163,184,.65);border-radius:6px;padding:4px 8px;font-size:12px}
#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35}
#warn{position:absolute;left:10px;bottom:8px;right:180px;z-index:3;font-size:10px;color:rgba(251,191,36,.95);pointer-events:none}
#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.65);pointer-events:none;user-select:none}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style></head><body>
<div id="wrap" role="group" tabindex="0" aria-label="Spiral journey visualization" aria-describedby="hint announce">
<div id="toolbar"><label for="journeySelect">Journey</label><select id="journeySelect"></select></div>
<canvas id="c" aria-label="Milestones arranged on a progress spiral"></canvas><div id="tip"></div><div id="warn"></div>
<div id="hint">Arrow keys inspect milestones; drag to pan, scroll to zoom, double-click to reset.</div>
<div id="announce" class="sr-only" aria-live="polite"></div></div>
<script>
const payload = __SPIRAL_PAYLOAD__;
const wrap=document.getElementById('wrap'),canvas=document.getElementById('c'),tip=document.getElementById('tip');
const warn=document.getElementById('warn'),toolbar=document.getElementById('toolbar'),select=document.getElementById('journeySelect');
const announce=document.getElementById('announce'),ctx=canvas.getContext('2d');
const cfg=Object.assign({show_labels:true,show_risk_glow:true,show_variance:true,space_by_timeline:false},payload&&payload.visualConfig||{});
const allRecords=Array.isArray(payload&&payload.records)?payload.records.slice():[];
const journeys=Array.isArray(payload&&payload.journeys)?payload.journeys.slice():[];
let selectedJourney=String(payload&&payload.selected_journey||''),selectedIndex=-1,scene=[];
let panX=0,panY=0,zoom=1,dragging=false,didDrag=false,startX=0,startY=0,baseX=0,baseY=0;
const RISK_THRESHOLD=70,MIN_ZOOM=.45,MAX_ZOOM=2.5;
const STATUS_STROKE={complete:'#34d399',active:'#38bdf8',delayed:'#fbbf24',blocked:'#f87171',not_started:'rgba(148,163,184,.7)'};
function num(v,d){const n=Number(v);return Number.isFinite(n)?n:d}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function selectedRecords(){return allRecords.filter(r=>!selectedJourney||String(r.journey_name)===selectedJourney).slice().sort((a,b)=>String(a.timeline||'').localeCompare(String(b.timeline||'')))}
function parseTimeline(v){if(v==null||v==='')return null;const s=String(v).trim(),ms=Date.parse(s);if(!Number.isNaN(ms))return ms;const n=Number(s);return Number.isFinite(n)?n:null}
function fractions(rows){if(rows.length<=1)return [0];if(!cfg.space_by_timeline)return rows.map((_,i)=>i/(rows.length-1));
  const parsed=rows.map(r=>parseTimeline(r.timeline));let values;
  if(parsed.every(v=>v!==null))values=parsed;else{const labels=Array.from(new Set(rows.map(r=>String(r.timeline||'')))).sort();const rank=new Map(labels.map((v,i)=>[v,i]));values=rows.map(r=>rank.get(String(r.timeline||''))||0)}
  const min=Math.min(...values),max=Math.max(...values);return max===min?rows.map((_,i)=>i/(rows.length-1)):values.map(v=>(v-min)/(max-min))}
function variance(r){return num(r.schedule_variance_days,0)}
function details(r){const parts=[String(r.stage||'Milestone'),'Journey '+String(r.journey_name||''),'Timeline '+String(r.timeline||''),'Progress '+num(r.progress_pct,0).toFixed(0)+'%','Metric '+num(r.metric_value,0).toLocaleString()];
  if(r.status)parts.push('Status '+String(r.status).replaceAll('_',' '));if(r.risk_score!=null)parts.push('Risk '+num(r.risk_score,0).toFixed(0));if(r.schedule_variance_days!=null)parts.push('Variance '+variance(r)+' days');
  if(r.owner)parts.push('Owner '+String(r.owner));if(r.target_date)parts.push('Target '+String(r.target_date));if(r.actual_date)parts.push('Actual '+String(r.actual_date));if(r.key_achievement)parts.push(String(r.key_achievement));if(r.cost!=null)parts.push('Cost '+num(r.cost,0).toLocaleString());return parts.join('. ')}
function resize(){const rect=wrap.getBoundingClientRect(),dpr=Math.max(1,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
function markerRows(rows,w,h){const padTop=journeys.length>1?46:20,padBottom=36,cx=w/2,cy=(padTop+h-padBottom)/2,maxR=Math.min(w,h-padTop-padBottom)*.38,a=maxR*.08;
  const turns=Math.max(1.6,Math.min(2.8,1.2+rows.length*.18)),b=(maxR-a)/(turns*Math.PI*2),metrics=rows.map(r=>num(r.metric_value,0));
  const min=Math.min(0,...metrics),max=Math.max(1,...metrics),span=Math.max(1,max-min),steps=fractions(rows);
  return rows.map((r,i)=>{const theta=steps[i]*turns*Math.PI*2,radius=a+b*theta;return {record:r,index:i,x:cx+radius*Math.cos(theta-Math.PI/2),y:cy+radius*Math.sin(theta-Math.PI/2),radius:10+((num(r.metric_value,0)-min)/span)*14,theta}})}
function draw(){const rect=wrap.getBoundingClientRect(),w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);const rows=selectedRecords();scene=markerRows(rows,w,h);ctx.save();ctx.translate(panX,panY);ctx.scale(zoom,zoom);
  if(scene.length){const first=scene[0],last=scene[scene.length-1],maxR=Math.min(w,h-(journeys.length>1?46:20)-36)*.38,a=maxR*.08,turns=Math.max(1.6,Math.min(2.8,1.2+rows.length*.18)),b=(maxR-a)/(turns*Math.PI*2),cx=w/2,cy=((journeys.length>1?46:20)+h-36)/2;
    ctx.beginPath();for(let i=0;i<=Math.max(80,Math.floor(turns*64));i++){const t=i/Math.max(80,Math.floor(turns*64)),theta=t*turns*Math.PI*2,r=a+b*theta,x=cx+r*Math.cos(theta-Math.PI/2),y=cy+r*Math.sin(theta-Math.PI/2);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle='rgba(56,189,248,.32)';ctx.lineWidth=2;ctx.stroke();
    scene.forEach((m,i)=>drawMarker(m,i===selectedIndex));
    const current=rows.filter(r=>String(r.status||'').toLowerCase().replace(/[\s-]+/g,'_')!=='not_started').at(-1);
    const highest=rows.reduce((best,r)=>!best||num(r.metric_value,0)>num(best.metric_value,0)?r:best,null);
    const avg=rows.length?rows.reduce((s,r)=>s+num(r.progress_pct,0),0)/rows.length:0;
    const delayed=rows.filter(r=>String(r.status||'').toLowerCase().replace(/[\s-]+/g,'_')==='delayed'||variance(r)>0).length;
    ctx.fillStyle='rgba(226,246,255,.82)';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('Milestones: '+rows.length+' · Avg progress: '+avg.toFixed(0)+'%',12,h-14);
    const footer=(current?'Current: '+current.stage:'')+(highest?((current?' · ':'')+'Highest value: '+highest.stage):'')+' · Delayed: '+delayed;ctx.textAlign='right';ctx.fillText(footer,w-12,h-14);
  } else {ctx.fillStyle='#cbd5e1';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('No spiral milestones after filtering.',w/2,h/2)}
  ctx.restore();const warnings=Array.isArray(payload&&payload.summary&&payload.summary.warnings)?payload.summary.warnings:[];warn.textContent=warnings.join(' ');if(scene.length>0&&scene.length<3)warn.textContent='Fewer than 3 milestones — spiral story may be less meaningful.'}
function drawMarker(m,highlighted){const r=m.record,progress=Math.max(0,Math.min(100,num(r.progress_pct,0)))/100,risk=num(r.risk_score,-1),status=String(r.status||'').toLowerCase().replace(/[\s-]+/g,'_');
  if(cfg.show_risk_glow&&risk>=RISK_THRESHOLD){const glow=ctx.createRadialGradient(m.x,m.y,m.radius*.4,m.x,m.y,m.radius*2.2);glow.addColorStop(0,'rgba(248,113,113,.38)');glow.addColorStop(1,'rgba(248,113,113,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(m.x,m.y,m.radius*2.2,0,Math.PI*2);ctx.fill()}
  ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.fillStyle='rgba(15,23,42,.95)';ctx.fill();ctx.save();ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.clip();ctx.fillStyle=highlighted?'rgba(224,242,254,.9)':'rgba(56,189,248,.62)';ctx.fillRect(m.x-m.radius,m.y+m.radius-m.radius*2*progress,m.radius*2,m.radius*2*progress);ctx.restore();
  ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.lineWidth=highlighted?3:2;ctx.strokeStyle=STATUS_STROKE[status]||'rgba(148,163,184,.8)';ctx.stroke();
  if(cfg.show_variance&&variance(r)!==0){ctx.beginPath();ctx.moveTo(m.x+m.radius*.7,m.y-m.radius*.7);ctx.lineTo(m.x+m.radius*1.25,m.y-m.radius*1.25);ctx.strokeStyle=variance(r)>0?'#f87171':'#34d399';ctx.lineWidth=2;ctx.stroke()}
  if(cfg.show_labels){ctx.fillStyle='#e2f6ff';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(String(r.stage||''),m.x,m.y+m.radius+13)} }
function hit(x,y){const p={x:(x-panX)/zoom,y:(y-panY)/zoom};for(let i=scene.length-1;i>=0;i--){const m=scene[i];if(Math.hypot(p.x-m.x,p.y-m.y)<=m.radius+5)return m}return null}
function announceIndex(index){const rows=selectedRecords();if(index<0||index>=rows.length){announce.textContent='Milestone selection cleared.';return}selectedIndex=index;const r=rows[index];announce.textContent='Milestone '+(index+1)+' of '+rows.length+'. '+details(r);draw()}
function showTip(m,x,y){if(!m){tip.style.display='none';return}tip.innerHTML='<strong>'+esc(m.record.stage||'Milestone')+'</strong><br>'+esc(details(m.record));tip.style.display='block';tip.style.left=Math.max(8,Math.min(x+12,wrap.clientWidth-290))+'px';tip.style.top=Math.max(8,Math.min(y+12,wrap.clientHeight-130))+'px'}
function initSelector(){if(journeys.length<2)return;toolbar.style.display='flex';journeys.forEach(name=>{const option=document.createElement('option');option.value=String(name);option.textContent=String(name);select.appendChild(option)});select.value=selectedJourney;select.addEventListener('change',()=>{selectedJourney=select.value;selectedIndex=-1;draw();announce.textContent='Journey selected: '+selectedJourney})}
function reset(){panX=0;panY=0;zoom=1;draw()}
function pointer(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
canvas.addEventListener('mousedown',e=>{const p=pointer(e);dragging=true;didDrag=false;startX=p.x;startY=p.y;baseX=panX;baseY=panY;canvas.style.cursor='grabbing'});
window.addEventListener('mousemove',e=>{const p=pointer(e);if(dragging){if(Math.hypot(p.x-startX,p.y-startY)>4)didDrag=true;if(didDrag){panX=baseX+p.x-startX;panY=baseY+p.y-startY;draw()}return}const marker=hit(p.x,p.y);canvas.style.cursor=marker?'pointer':'grab';showTip(marker,p.x,p.y)});
window.addEventListener('mouseup',e=>{if(!dragging)return;dragging=false;canvas.style.cursor='grab';const p=pointer(e);if(!didDrag){const marker=hit(p.x,p.y);if(marker)announceIndex(marker.index)}});
canvas.addEventListener('mouseleave',()=>{if(!dragging)tip.style.display='none'});
canvas.addEventListener('dblclick',reset);
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointer(e),worldX=(p.x-panX)/zoom,worldY=(p.y-panY)/zoom;zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom*(e.deltaY<0?1.1:.9)));panX=p.x-worldX*zoom;panY=p.y-worldY*zoom;draw()},{passive:false});
wrap.addEventListener('keydown',e=>{const rows=selectedRecords();if(!rows.length)return;let next=selectedIndex;
  if(e.key==='ArrowRight'||e.key==='ArrowDown'){next=Math.min(rows.length-1,selectedIndex+1)}else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){next=Math.max(0,selectedIndex<0?0:selectedIndex-1)}else if(e.key==='Home'){next=0}else if(e.key==='End'){next=rows.length-1}else if(e.key==='Escape'){selectedIndex=-1;reset();announce.textContent='Milestone selection cleared.';e.preventDefault();return}else if(e.key==='+'||e.key==='='){zoom=Math.min(MAX_ZOOM,zoom*1.15);draw();e.preventDefault();return}else if(e.key==='-'){zoom=Math.max(MIN_ZOOM,zoom/1.15);draw();e.preventDefault();return}else if(e.key==='Enter'||e.key===' '){if(selectedIndex<0)next=0;announceIndex(next);e.preventDefault();return}else{return}
  e.preventDefault();announceIndex(next)});
initSelector();window.addEventListener('resize',resize);resize();
</script></body></html>`;
