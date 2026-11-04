/** Self-contained, keyboard-accessible PulseWaveStory canvas based on the retained renderer. */
export const PULSE_WAVE_STORY_HTML = String.raw`<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,sans-serif;}
#wrap{position:relative;width:100%;height:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;background:#0b1220;box-shadow:0 1px 2px rgba(15,23,42,.08);}
canvas{display:block;width:100%;height:100%;touch-action:none;}
#tip{display:none;position:absolute;pointer-events:none;z-index:4;background:rgba(11,18,32,.96);color:#e8f4f8;border:1px solid rgba(0,200,255,.35);border-radius:8px;padding:8px 10px;font-size:12px;max-width:280px;line-height:1.35;}
#warn{position:absolute;left:10px;bottom:8px;right:220px;z-index:3;font-size:10px;color:#fbbf24;pointer-events:none;}
#hint{position:absolute;right:10px;bottom:8px;z-index:3;font-size:10px;color:rgba(226,246,255,.72);pointer-events:none;user-select:none;}
canvas:focus-visible{outline:2px solid #67e8f9;outline-offset:-3px;}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
</style></head><body>
<div id="wrap"><canvas id="c" role="group" tabindex="0" aria-describedby="hint" aria-label="Interactive Pulse Wave time-series chart. Use left and right arrow keys to inspect points, Enter or Space to select, Escape to clear selection, plus and minus to zoom, and Home to reset the view."></canvas><div id="tip"></div><div id="warn" role="note"></div><div id="hint">Drag to pan · scroll to zoom · double-click to reset · use arrow keys to inspect points</div><div id="announce" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div></div>
<script>
const payload = __PULSE_WAVE_PAYLOAD__;
const canvas = document.getElementById('c');
const tip = document.getElementById('tip');
const warn = document.getElementById('warn');
const announcer = document.getElementById('announce');
const ctx = canvas.getContext('2d');
const cfg = Object.assign({
  metric_name: 'Metric', y_axis_label: 'Metric', aggregation_method: 'sum',
  show_baseline: true, show_events: true, show_anomaly_markers: true, fill_under_wave: true
}, (payload && payload.visualConfig) || {});
const records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];
const events = Array.isArray(payload && payload.events) ? payload.events.slice() : [];
const summary = (payload && payload.summary) || {};
let hoverIndex = -1;
let keyboardIndex = -1;
let selectedIndex = -1;
let viewStart = 0, viewEnd = 1;
let dragging = false, dragStartX = 0, dragViewStart = 0, dragViewEnd = 1;
const MIN_SPAN = 0.05;

function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function clampView(){
  viewStart=Math.max(0,Math.min(1,viewStart)); viewEnd=Math.max(0,Math.min(1,viewEnd));
  if(viewEnd-viewStart<MIN_SPAN){ const mid=(viewStart+viewEnd)/2; viewStart=Math.max(0,mid-MIN_SPAN/2); viewEnd=Math.min(1,mid+MIN_SPAN/2); }
  if(viewEnd<=viewStart){ viewStart=0; viewEnd=1; }
}
function layout(){
  const rect=canvas.getBoundingClientRect(), p={l:62,r:18,t:20,b:36};
  return {w:rect.width,h:rect.height,p,iw:Math.max(1,rect.width-p.l-p.r),ih:Math.max(1,rect.height-p.t-p.b)};
}
function yRange(values){
  let min=Infinity,max=-Infinity;
  values.forEach(rec=>{ const metric=num(rec.metric_value,0), baseline=num(rec.baseline_value,0); min=Math.min(min,metric,baseline); max=Math.max(max,metric,baseline); });
  if(!Number.isFinite(min)||!Number.isFinite(max)){ min=0; max=1; }
  if(min===max){ min-=1; max+=1; }
  const padding=(max-min)*0.12;
  return {min:min-padding,max:max+padding};
}
function yPosition(value,range,L){ return L.p.t+(1-((value-range.min)/(range.max-range.min||1)))*L.ih; }
function eventMap(){
  const result=Object.create(null);
  events.forEach(event=>{ if(event&&event.time_period) result[String(event.time_period)]=event; });
  return result;
}
function visiblePoints(range,L){
  const count=records.length;
  if(count===0) return [];
  if(count===1) return [{x:L.p.l+L.iw/2,y:yPosition(num(records[0].metric_value,0),range,L),index:0,record:records[0]}];
  const start=viewStart*(count-1),end=viewEnd*(count-1),span=end-start||1;
  const first=Math.max(0,Math.floor(start)),last=Math.min(count-1,Math.ceil(end)),points=[];
  for(let index=first;index<=last;index++) points.push({x:L.p.l+((index-start)/span)*L.iw,y:yPosition(num(records[index].metric_value,0),range,L),index,record:records[index]});
  return points;
}
function drawWave(points,closeToFloor,floorY){
  if(points.length===0) return;
  ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
  for(let index=1;index<points.length;index++){
    const previous=points[index-1],current=points[index],middle=(previous.x+current.x)/2;
    ctx.bezierCurveTo(middle,previous.y,middle,current.y,current.x,current.y);
  }
  if(closeToFloor){ ctx.lineTo(points[points.length-1].x,floorY); ctx.lineTo(points[0].x,floorY); ctx.closePath(); }
}
function compact(value){
  const number=Number(value); if(!Number.isFinite(number)) return '';
  const absolute=Math.abs(number);
  if(absolute>=1e6) return (number/1e6).toFixed(1)+'M';
  if(absolute>=1e3) return (number/1e3).toFixed(1)+'k';
  return Math.round(number).toString();
}
function draw(){
  clampView();
  const L=layout(),eventRows=eventMap(),count=records.length;
  ctx.clearRect(0,0,L.w,L.h); ctx.fillStyle='#0b1220'; ctx.fillRect(0,0,L.w,L.h);
  let visible=records;
  if(count>1){ const first=Math.floor(viewStart*(count-1)),last=Math.min(count-1,Math.ceil(viewEnd*(count-1))); visible=records.slice(first,last+1); }
  const range=yRange(visible.length?visible:records);
  ctx.strokeStyle='rgba(148,163,184,.24)'; ctx.lineWidth=1;
  for(let grid=0;grid<=4;grid++){
    const y=L.p.t+(grid/4)*L.ih,value=range.max-(grid/4)*(range.max-range.min);
    ctx.beginPath(); ctx.moveTo(L.p.l,y); ctx.lineTo(L.p.l+L.iw,y); ctx.stroke();
    ctx.fillStyle='rgba(226,246,255,.72)'; ctx.font='10px system-ui,sans-serif'; ctx.textAlign='right'; ctx.fillText(compact(value),L.p.l-6,y+3);
  }
  ctx.save(); ctx.fillStyle='rgba(226,246,255,.9)'; ctx.font='11px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.translate(14,L.p.t+L.ih/2); ctx.rotate(-Math.PI/2); ctx.fillText(String(cfg.y_axis_label||cfg.metric_name||'Metric'),0,0); ctx.restore();
  if(count===0){ ctx.fillStyle='rgba(226,246,255,.8)'; ctx.textAlign='center'; ctx.fillText('No data',L.w/2,L.h/2); warn.textContent=''; return; }
  const points=visiblePoints(range,L),floorY=yPosition(range.min,range,L);
  ctx.save(); ctx.beginPath(); ctx.rect(L.p.l,L.p.t,L.iw,L.ih); ctx.clip();
  if(cfg.fill_under_wave){ ctx.fillStyle='rgba(56,189,248,.16)'; drawWave(points,true,floorY); ctx.fill(); }
  if(cfg.show_baseline){
    ctx.setLineDash([5,4]); ctx.strokeStyle='rgba(251,191,36,.82)'; ctx.lineWidth=1.5; ctx.beginPath();
    points.forEach((point,index)=>{ const y=yPosition(num(point.record.baseline_value,0),range,L); if(index===0) ctx.moveTo(point.x,y); else ctx.lineTo(point.x,y); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle='#38bdf8'; ctx.lineWidth=2.25; ctx.lineJoin='round'; drawWave(points,false,0); ctx.stroke();
  if(cfg.show_anomaly_markers){
    const spike=summary.largest_spike&&String(summary.largest_spike.time_period),drop=summary.largest_drop&&String(summary.largest_drop.time_period);
    points.forEach(point=>{ const period=String(point.record.time_period||''); if(period&& (period===spike||period===drop)){ ctx.beginPath(); ctx.arc(point.x,point.y,5,0,Math.PI*2); ctx.fillStyle=period===spike?'#4ade80':'#f87171'; ctx.fill(); ctx.strokeStyle='#0b1220'; ctx.lineWidth=1.5; ctx.stroke(); } });
  }
  if(cfg.show_events){
    points.forEach(point=>{
      const event=eventRows[String(point.record.time_period||'')]; if(!event) return;
      const type=String(event.event_type||'neutral').toLowerCase(),color=type==='positive'?'#4ade80':type==='negative'?'#f87171':'#a78bfa';
      ctx.strokeStyle=color; ctx.lineWidth=1.25; ctx.setLineDash([2,3]); ctx.beginPath(); ctx.moveTo(point.x,L.p.t); ctx.lineTo(point.x,L.p.t+L.ih); ctx.stroke(); ctx.setLineDash([]);
      const radius=3+Math.max(0,Math.min(6,num(event.impact_score,40)/20)); ctx.beginPath(); ctx.arc(point.x,L.p.t+8,radius,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
      const label=String(event.event_name||'').slice(0,18); if(label){ ctx.fillStyle='rgba(226,246,255,.9)'; ctx.font='9px system-ui,sans-serif'; ctx.textAlign='center'; ctx.fillText(label,point.x,L.p.t+22); }
    });
  }
  const highlighted=keyboardIndex>=0?keyboardIndex:hoverIndex;
  const activePoint=points.find(point=>point.index===highlighted);
  if(activePoint){
    ctx.strokeStyle='#67e8f9'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(activePoint.x,L.p.t); ctx.lineTo(activePoint.x,L.p.t+L.ih); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(activePoint.x,activePoint.y,5,0,Math.PI*2); ctx.fillStyle=selectedIndex===highlighted?'#f8fafc':'#e0f2fe'; ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle='rgba(226,246,255,.72)'; ctx.font='10px system-ui,sans-serif'; ctx.textAlign='center';
  const step=Math.max(1,Math.ceil(points.length/6));
  for(let index=0;index<points.length;index+=step) ctx.fillText(String(points[index].record.time_period||'').slice(0,10),points[index].x,L.h-12);
  const warnings=Array.isArray(summary.warnings)?summary.warnings:[]; warn.textContent=warnings.length?String(warnings[0]):'';
}
function seriesFraction(x){ const L=layout(),ratio=Math.max(0,Math.min(1,(x-L.p.l)/(L.iw||1))); return viewStart+ratio*(viewEnd-viewStart); }
function zoomAt(x,factor){
  const anchor=seriesFraction(x),span=viewEnd-viewStart,next=Math.max(MIN_SPAN,Math.min(1,span*factor)),ratio=span>0?(anchor-viewStart)/span:0.5;
  viewStart=anchor-ratio*next; viewEnd=viewStart+next;
  if(viewStart<0){viewStart=0;viewEnd=next;} if(viewEnd>1){viewEnd=1;viewStart=1-next;} draw();
}
function hitIndex(x){
  const L=layout(),points=visiblePoints(yRange(records),L); let best=-1,bestDistance=Infinity;
  points.forEach(point=>{ const distance=Math.abs(x-point.x); if(distance<bestDistance){bestDistance=distance;best=point.index;} });
  return bestDistance<=18?best:-1;
}
function pointDetails(index){
  const record=records[index]; if(!record) return '';
  const previous=index>0?records[index-1]:null,delta=previous?num(record.metric_value,0)-num(previous.metric_value,0):null,event=eventMap()[String(record.time_period||'')];
  let details=String(record.time_period||'')+'. '+String(cfg.y_axis_label||cfg.metric_name||'Metric')+' '+compact(record.metric_value)+'. Baseline '+compact(record.baseline_value)+'.';
  if(delta!==null) details+=' Change from prior point '+(delta>=0?'+':'')+compact(delta)+'.';
  if(event) details+=' Event '+String(event.event_name||'')+'.';
  return details;
}
function showPointTip(index,x,y){
  const record=records[index]; if(!record){tip.style.display='none';return;}
  const previous=index>0?records[index-1]:null,delta=previous?num(record.metric_value,0)-num(previous.metric_value,0):null,event=eventMap()[String(record.time_period||'')];
  let html='<strong>'+esc(record.time_period||'')+'</strong><br/>'+esc(cfg.y_axis_label||cfg.metric_name||'Metric')+': '+compact(record.metric_value)+'<br/>Baseline: '+compact(record.baseline_value);
  if(delta!==null) html+='<br/>Δ prior: '+(delta>=0?'+':'')+compact(delta);
  if(event) html+='<br/>Event: '+esc(event.event_name||'');
  tip.innerHTML=html; tip.style.display='block'; const rect=canvas.parentElement.getBoundingClientRect();
  tip.style.left=Math.min(rect.width-180,Math.max(8,x+12))+'px'; tip.style.top=Math.max(8,Math.min(rect.height-80,y-10))+'px';
}
function moveKeyboardPoint(direction){
  if(records.length===0) return;
  keyboardIndex=keyboardIndex<0?(direction<0?records.length-1:0):(keyboardIndex+direction+records.length)%records.length;
  selectedIndex=-1; const L=layout(),point=visiblePoints(yRange(records),L).find(candidate=>candidate.index===keyboardIndex);
  if(point) showPointTip(keyboardIndex,point.x,point.y); else tip.style.display='none';
  announcer.textContent=pointDetails(keyboardIndex); draw();
}
function resize(){
  const rect=canvas.getBoundingClientRect(),ratio=Math.max(1,window.devicePixelRatio||1);
  canvas.width=Math.max(1,Math.floor(rect.width*ratio)); canvas.height=Math.max(1,Math.floor(rect.height*ratio)); ctx.setTransform(ratio,0,0,ratio,0,0); draw();
}
canvas.addEventListener('wheel',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect();zoomAt(event.clientX-rect.left,event.deltaY<0?0.85:1.18);},{passive:false});
canvas.addEventListener('pointerdown',event=>{dragging=true;dragStartX=event.clientX;dragViewStart=viewStart;dragViewEnd=viewEnd;canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(dragging){const span=dragViewEnd-dragViewStart,delta=-(event.clientX-dragStartX)/(layout().iw||1)*span;viewStart=dragViewStart+delta;viewEnd=dragViewEnd+delta;if(viewStart<0){viewStart=0;viewEnd=span;}if(viewEnd>1){viewEnd=1;viewStart=1-span;}tip.style.display='none';draw();return;}
  keyboardIndex=-1; selectedIndex=-1; hoverIndex=hitIndex(x); draw();
  if(hoverIndex<0){tip.style.display='none';return;} showPointTip(hoverIndex,x,y);
});
canvas.addEventListener('pointerup',event=>{dragging=false;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);});
canvas.addEventListener('pointercancel',()=>{dragging=false;});
canvas.addEventListener('pointerleave',()=>{if(!dragging){hoverIndex=-1;tip.style.display='none';draw();}});
canvas.addEventListener('dblclick',()=>{viewStart=0;viewEnd=1;keyboardIndex=-1;selectedIndex=-1;tip.style.display='none';announcer.textContent='Chart view reset.';draw();});
canvas.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight'||event.key==='ArrowDown'){event.preventDefault();moveKeyboardPoint(1);return;}
  if(event.key==='ArrowLeft'||event.key==='ArrowUp'){event.preventDefault();moveKeyboardPoint(-1);return;}
  if((event.key==='Enter'||event.key===' ')&&keyboardIndex>=0){event.preventDefault();selectedIndex=selectedIndex===keyboardIndex?-1:keyboardIndex;announcer.textContent=(selectedIndex<0?'Cleared selection. ':'Selected. ')+pointDetails(keyboardIndex);draw();return;}
  if(event.key==='Escape'){keyboardIndex=-1;selectedIndex=-1;tip.style.display='none';announcer.textContent='Chart selection cleared.';draw();return;}
  if(event.key==='Home'){viewStart=0;viewEnd=1;keyboardIndex=-1;selectedIndex=-1;tip.style.display='none';announcer.textContent='Chart view reset.';draw();return;}
  if(event.key==='+'||event.key==='='){event.preventDefault();zoomAt(layout().w/2,0.85);return;}
  if(event.key==='-'){event.preventDefault();zoomAt(layout().w/2,1.18);}
});
window.addEventListener('resize',resize); resize();
</script></body></html>`;
