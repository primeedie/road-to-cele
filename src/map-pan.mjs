// One finger pans; two fingers zoom around their midpoint. A gesture never opens a course.
export function attachMapPan(viewport,{getPosition,onPan,onZoom,onEnd,threshold=5}){
 let gesture=null,pinch=null,suppressPointerClick=false;
 const touches=new Map();
 const release=(target,id)=>{if(target.hasPointerCapture?.(id))target.releasePointerCapture(id);};
 const capture=(target,id)=>target.setPointerCapture?.(id);
 const pair=()=>{const [a,b]=[...touches.values()];return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
 const down=e=>{
  if(e.button!==0||e.target.closest('button:not(.course-node),a,input,select,textarea'))return;
  const touch=e.pointerType==='touch';
  if(!touch&&e.isPrimary===false)return;
  if(gesture&&(!touch||!gesture.touch))return;
  e.preventDefault();viewport.ownerDocument.defaultView.getSelection()?.removeAllRanges();
  if(touch&&onZoom){
   if(touches.size>=2)return;
   touches.set(e.pointerId,{x:e.clientX,y:e.clientY,capture:e.target.closest('.course-node,[data-connection]')||viewport});
   capture(touches.get(e.pointerId).capture,e.pointerId);
   if(touches.size===2){gesture.moved=true;pinch=pair();viewport.classList.add('dragging');return;}
  }
  if(gesture)return;
  suppressPointerClick=false;
  const origin=getPosition(),target=e.target.closest('.course-node,[data-connection]')||viewport;
  gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:origin.x,y:origin.y,capture:target,moved:false,touch};
  capture(target,e.pointerId);
 };
 const move=e=>{
  if(touches.has(e.pointerId))Object.assign(touches.get(e.pointerId),{x:e.clientX,y:e.clientY});
  if(pinch&&touches.size===2){
   if(!touches.has(e.pointerId))return;
   e.preventDefault();const next=pair(),r=viewport.getBoundingClientRect();
   onZoom(next.distance/pinch.distance,pinch.x-r.left,pinch.y-r.top);
   const position=getPosition();onPan({x:position.x+next.x-pinch.x,y:position.y+next.y-pinch.y});pinch=next;return;
  }
  if(!gesture||gesture.id!==e.pointerId)return;
  e.preventDefault();const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;
  if(!gesture.moved&&Math.hypot(dx,dy)<(gesture.touch?Math.max(9,threshold):threshold))return;
  gesture.moved=true;viewport.classList.add('dragging');
  const requested={x:gesture.x+dx,y:gesture.y+dy},applied=onPan(requested);
  if(applied){gesture.x+=applied.x-requested.x;gesture.y+=applied.y-requested.y;}
 };
 const end=e=>{
  if(gesture&&(e.type==='pointercancel'||e.type==='lostpointercapture'))gesture.moved=true;
  if(touches.has(e.pointerId)){
   const point=touches.get(e.pointerId);touches.delete(e.pointerId);release(point.capture,e.pointerId);
   if(pinch){
    suppressPointerClick=true;pinch=null;
    if(touches.size){const [id,p]=touches.entries().next().value,origin=getPosition();gesture={id,startX:p.x,startY:p.y,x:origin.x,y:origin.y,capture:p.capture,moved:true,touch:true};return;}
   }
  }
  if(!gesture||gesture.id!==e.pointerId)return;
  const current=gesture;gesture=null;suppressPointerClick=current.moved;
  viewport.classList.remove('dragging');release(current.capture,current.id);if(current.moved)onEnd?.();
 };
 const click=e=>{if(suppressPointerClick&&e.detail!==0){suppressPointerClick=false;e.preventDefault();e.stopImmediatePropagation();}};
 const nativeDrag=e=>e.preventDefault();
 const blur=()=>{
  const points=[...touches.entries()],current=gesture;
  touches.clear();gesture=null;pinch=null;suppressPointerClick=true;viewport.classList.remove('dragging');
  for(const [id,p] of points)release(p.capture,id);if(current)release(current.capture,current.id);
  if(current?.moved)onEnd?.();
 };
 const handlers=[['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end],['dragstart',nativeDrag]];
 for(const [name,fn] of handlers)viewport.addEventListener(name,fn);
 viewport.addEventListener('click',click,true);
 viewport.ownerDocument.defaultView.addEventListener('blur',blur);
 return ()=>{for(const [name,fn] of handlers)viewport.removeEventListener(name,fn);viewport.removeEventListener('click',click,true);viewport.ownerDocument.defaultView.removeEventListener('blur',blur);blur();};
}
