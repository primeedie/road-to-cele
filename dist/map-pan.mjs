// One finger pans; two fingers zoom around their midpoint. A gesture never opens a course.
export function attachMapPan(viewport,{getPosition,onPan,onZoom,onPinch,onEnd,onFrame,getViewport,requestFrame,cancelFrame,threshold=5}){
 let gesture=null,pinch=null,suppressPointerClick=false,frame=null,rect=null;
 const touches=new Map();
 const release=(target,id)=>{if(target.hasPointerCapture?.(id))target.releasePointerCapture(id);};
 const capture=(target,id)=>target.setPointerCapture?.(id);
 const pair=()=>{const [a,b]=[...touches.values()];return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
 // Input only records finger positions. Apply the latest pair once per display frame.
 function paint(){
  frame=null;
  if(pinch&&touches.size===2){
   const next=pair(),from={x:pinch.x-rect.left,y:pinch.y-rect.top},to={x:next.x-rect.left,y:next.y-rect.top};
   if(onPinch)onPinch({factor:next.distance/pinch.distance,from,to});
   else{onZoom(next.distance/pinch.distance,from.x,from.y);const position=getPosition();onPan({x:position.x+to.x-from.x,y:position.y+to.y-from.y});}
   pinch=next;
  }else if(gesture?.moved&&gesture.point){
   const {x,y}=gesture.point,requested={x:gesture.x+x-gesture.startX,y:gesture.y+y-gesture.startY},applied=onPan(requested);
   if(applied){gesture.x+=applied.x-requested.x;gesture.y+=applied.y-requested.y;}
  }
  onFrame?.();
 }
 const schedule=()=>{if(!requestFrame){paint();return;}if(frame===null)frame=requestFrame(paint);};
 const flush=()=>{if(frame!==null){cancelFrame(frame);frame=null;paint();}};
 const down=e=>{
  if(e.button!==0||e.target.closest('button:not(.course-node),a,input,select,textarea'))return;
  const touch=e.pointerType==='touch';
  if(!touch&&e.isPrimary===false)return;
  if(gesture&&(!touch||!gesture.touch))return;
  e.preventDefault();viewport.ownerDocument.defaultView.getSelection()?.removeAllRanges();
  if(touch&&(onZoom||onPinch)){
   if(touches.size>=2)return;
   flush();if(!touches.size)rect=getViewport?.()||viewport.getBoundingClientRect();
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
   e.preventDefault();schedule();return;
  }
  if(!gesture||gesture.id!==e.pointerId)return;
  e.preventDefault();const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;
  if(!gesture.moved&&Math.hypot(dx,dy)<(gesture.touch?Math.max(9,threshold):threshold))return;
  if(!gesture.moved){gesture.moved=true;viewport.classList.add('dragging');}
  gesture.point={x:e.clientX,y:e.clientY};schedule();
 };
 const end=e=>{
  if(gesture?.id===e.pointerId||touches.has(e.pointerId))flush();
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
  viewport.classList.remove('dragging');rect=null;release(current.capture,current.id);if(current.moved)onEnd?.();
 };
 const click=e=>{if(suppressPointerClick&&e.detail!==0){suppressPointerClick=false;e.preventDefault();e.stopImmediatePropagation();}};
 const nativeDrag=e=>e.preventDefault();
 const blur=()=>{
  flush();
  const points=[...touches.entries()],current=gesture;
  touches.clear();gesture=null;pinch=null;rect=null;suppressPointerClick=true;viewport.classList.remove('dragging');
  for(const [id,p] of points)release(p.capture,id);if(current)release(current.capture,current.id);
  if(current?.moved)onEnd?.();
 };
 const handlers=[['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end],['dragstart',nativeDrag]];
 for(const [name,fn] of handlers)viewport.addEventListener(name,fn);
 viewport.addEventListener('click',click,true);
 viewport.ownerDocument.defaultView.addEventListener('blur',blur);
 return ()=>{for(const [name,fn] of handlers)viewport.removeEventListener(name,fn);viewport.removeEventListener('click',click,true);viewport.ownerDocument.defaultView.removeEventListener('blur',blur);blur();};
}
