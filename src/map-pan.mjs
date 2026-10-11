// Course nodes support click-to-inspect and drag-to-pan. Capture stays on the
// original node so an unmoved press still produces a normal course click.
export function attachMapPan(viewport,{getPosition,onPan,threshold=5}){
 let gesture=null,suppressPointerClick=false;
 const down=e=>{
  if(e.button!==0 || e.isPrimary===false || gesture)return;
  suppressPointerClick=false;
  if(e.target.closest('button:not(.course-node),a,input,select,textarea'))return;
  e.preventDefault();
  viewport.ownerDocument.defaultView.getSelection()?.removeAllRanges();
  const origin=getPosition(),capture=e.target.closest('.course-node,[data-connection]') || viewport;
  gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:origin.x,y:origin.y,capture,moved:false};
  capture.setPointerCapture(e.pointerId);
 };
 const move=e=>{
  if(!gesture || gesture.id!==e.pointerId)return;
  e.preventDefault();
  const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;
  if(!gesture.moved && Math.hypot(dx,dy)<threshold)return;
  gesture.moved=true;
  viewport.classList.add('dragging');
  const requested={x:gesture.x+dx,y:gesture.y+dy},applied=onPan(requested);
  // Absorb blocked movement at an edge, so reversing a drag responds immediately.
  if(applied){gesture.x+=applied.x-requested.x;gesture.y+=applied.y-requested.y;}
 };
 const end=e=>{
  if(!gesture || gesture.id!==e.pointerId)return;
  const current=gesture;gesture=null;
  suppressPointerClick=current.moved && e.type==='pointerup';
  viewport.classList.remove('dragging');
  if(current.capture.hasPointerCapture(current.id))current.capture.releasePointerCapture(current.id);
 };
 const click=e=>{
  // Keyboard activation has detail=0 and must always remain available.
  if(suppressPointerClick && e.detail!==0){
   suppressPointerClick=false;e.preventDefault();e.stopImmediatePropagation();
  }
 };
 const nativeDrag=e=>e.preventDefault();
 viewport.addEventListener('pointerdown',down);
 viewport.addEventListener('pointermove',move);
 viewport.addEventListener('pointerup',end);
 viewport.addEventListener('pointercancel',end);
 viewport.addEventListener('lostpointercapture',end);
 viewport.addEventListener('click',click,true);
 viewport.addEventListener('dragstart',nativeDrag);
 return ()=>{
  for(const [name,fn] of [['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end],['dragstart',nativeDrag]])viewport.removeEventListener(name,fn);
  viewport.removeEventListener('click',click,true);
  viewport.classList.remove('dragging');gesture=null;
 };
}
