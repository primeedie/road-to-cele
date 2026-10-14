const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const OVERVIEW_SCALE=.2;
export function overviewCourseMarkup(course,state){
 const term=(course.term-1)%3+1;
 return `<strong class="overview-code">${esc(course.id)}</strong><span class="overview-title">${esc(course.title)}</span><small>Year ${course.year} · Term ${term} · ${esc(state)}</small>`;
}
export function attachOverviewTooltip(viewport,{getCourse,getScale,requestFrame,cancelFrame}){
 const doc=viewport.ownerDocument,win=doc.defaultView,card=doc.createElement('div');
 card.id='overview-course-tooltip';card.className='overview-tooltip';card.role='tooltip';card.hidden=true;viewport.append(card);
 requestFrame??=fn=>win.requestAnimationFrame(fn);cancelFrame??=id=>win.cancelAnimationFrame(id);
 let node=null,point=null,frame=null,dismissed=false;
 function hide(clear=false){if(!card.hidden)card.hidden=true;if(node?.getAttribute('aria-describedby')===card.id)node.removeAttribute('aria-describedby');if(clear){node=null;point=null;dismissed=false;}}
 function position(){
  frame=null;if(card.hidden||!node)return;
  const r=viewport.getBoundingClientRect(),n=node.getBoundingClientRect(),p=point||{x:n.left+n.width/2,y:n.top+n.height/2};
  const width=card.offsetWidth||Math.min(280,r.width-24),height=card.offsetHeight||130;
  const x=Math.max(12,Math.min(r.width-width-12,p.x-r.left+18));
  let y=p.y-r.top+18;if(y+height>r.height-12)y=p.y-r.top-height-15;
  card.style.left=x+'px';card.style.top=Math.max(12,y)+'px';
 }
 function refresh(){
  if(!node?.isConnected||dismissed||getScale()>OVERVIEW_SCALE+1e-6||viewport.matches('.dragging,.zooming')||doc.querySelector('dialog[open]')){hide();return;}
  const c=getCourse(node.dataset.course);if(!c){hide(true);return;}
  const state=node.classList.contains('preview')?'Preview':node.classList.contains('completed')?'Completed':node.classList.contains('active-course')?'Active':'Not activated';
  const html=overviewCourseMarkup(c,state);if(card.innerHTML!==html)card.innerHTML=html;
  card.style.setProperty('--sky-accent',node.style.getPropertyValue('--sky-accent'));
  card.hidden=false;node.setAttribute('aria-describedby',card.id);
  if(frame===null)frame=requestFrame(position);
 }
 function inspect(e){
  if(e.pointerType==='touch'||e.buttons||viewport.matches('.dragging,.zooming')){hide(true);return;}
  const next=e.target.closest?.('.course-node');if(next!==node){hide(true);node=next;}
  if(!node)return;
  point=e.type==='focusin'?null:{x:e.clientX,y:e.clientY};refresh();
 }
 const out=e=>{if(node&&e.relatedTarget?.closest?.('.course-node')===node)return;hide(true);};
 const down=()=>hide(true),escape=e=>{if(e.key==='Escape'){dismissed=true;hide();}};
 const handlers=[['pointerover',inspect],['pointermove',inspect],['focusin',inspect],['pointerout',out],['focusout',out],['pointerleave',down],['pointerdown',down],['keydown',escape]];
 for(const [event,fn] of handlers)viewport.addEventListener(event,fn);
 return {refresh,destroy(){if(frame!==null)cancelFrame(frame);hide(true);for(const [event,fn] of handlers)viewport.removeEventListener(event,fn);card.remove();}};
}
