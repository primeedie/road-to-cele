import {courseConnections} from './connections.mjs';
import {NODE_GROUND_X,NODE_GROUND_Y} from './sky-layout.mjs';
import {constellationAngle} from './rotation-range.mjs';

export function rotateSkyPoint(point,center,angle){
 const x=point.x-center.x,y=point.y-center.y,c=Math.cos(angle),s=Math.sin(angle);
 return {...point,x:center.x+x*c-y*s,y:center.y+x*s+y*c};
}
export function rotatedCluster(chart,positions,courses,label,angle){
 const center=chart.orbit?.center||{x:chart.vertices.reduce((sum,p)=>sum+p.x,0)/chart.vertices.length,y:chart.vertices.reduce((sum,p)=>sum+p.y,0)/chart.vertices.length};
 const vertices=chart.vertices.map(p=>rotateSkyPoint(p,center,angle)),moved={};
 for(const c of courses){const old=positions[c.id],anchor=vertices[old.anchorIndex];moved[c.id]={...old,x:anchor.x-NODE_GROUND_X,y:anchor.y-NODE_GROUND_Y};}
 return {vertices,positions:moved,label:{...label}};
}
export function connectionCurve(start,end){
 const sx=start.x+NODE_GROUND_X,sy=start.y+NODE_GROUND_Y,ex=end.x+NODE_GROUND_X,ey=end.y+NODE_GROUND_Y,bend=Math.min(180,Math.abs(ex-sx)*.4);
 return `M ${sx} ${sy} C ${sx+bend} ${sy}, ${ex-bend} ${ey}, ${ex} ${ey}`;
}
export function attachConstellationRotation(viewport,button,{requestFrame,cancelFrame}={}){
 const doc=viewport.ownerDocument,win=doc.defaultView,query=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 const frameInterval=win.matchMedia?.('(pointer: coarse)')?.matches?100:50;
 requestFrame??=fn=>win.requestAnimationFrame(fn);cancelFrame??=id=>win.cancelAnimationFrame(id);
 let enabled=!!query&&!query.matches,frame=null,last=null,painted=0,map=null,clusters=[],links=[],nodes=new Map(),positions={},hovered=null,pointerDown=false,blurred=false;
 const clocks=new Map();
 function paintButton(){button.disabled=!!query?.matches;button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Pause constellation rotation':'Start constellation rotation');button.title=query?.matches?'Rotation disabled by reduced-motion preference':enabled?'Pause constellation rotation':'Start constellation rotation';doc.body.classList.toggle('constellations-rotating',enabled&&!query?.matches);}
 function cancel(){if(frame!==null)cancelFrame(frame);frame=null;last=null;}
 function paused(){return !enabled||query?.matches||doc.hidden||blurred||pointerDown||hovered||viewport.classList.contains('dragging')||viewport.classList.contains('tracing-path')||!!doc.querySelector('dialog[open]')||!!doc.querySelector('#map-page.hidden');}
 function wake(){if(!paused()&&map&&frame===null)frame=requestFrame(tick);}
 function updateCluster(cluster){
  const clock=clocks.get(cluster.key),angle=constellationAngle(clock.time);
  const pose=rotatedCluster(cluster.chart,map.positions,cluster.courses,cluster.label,angle);
  cluster.trails.forEach((path,i)=>{const ids=cluster.chart.paths[i%cluster.chart.paths.length];path.setAttribute('points',ids.map(id=>`${pose.vertices[id].x},${pose.vertices[id].y}`).join(' '));});
  cluster.stars.forEach((circle,i)=>{const point=pose.vertices[i%pose.vertices.length];circle.setAttribute('cx',point.x);circle.setAttribute('cy',point.y);});
  for(const [id,p] of Object.entries(pose.positions)){positions[id]=p;const node=nodes.get(id);if(node){node.style.left=p.x+'px';node.style.top=p.y+'px';}}
 }
 function draw(){
  for(const cluster of clusters)updateCluster(cluster);
  for(const {edge,paths} of links){const d=connectionCurve(positions[edge.from],positions[edge.to]);for(const path of paths)path?.setAttribute('d',d);}
 }
 function tick(now){
  frame=null;if(paused()){last=null;return;}
  if(last===null)last=now;
  if(now-painted>=frameInterval){
   const elapsed=Math.min(.15,Math.max(0,(now-last)/1000));last=now;painted=now;
   for(const cluster of clusters){if(cluster.key!==hovered)clocks.get(cluster.key).time+=elapsed;}
   draw();
  }
  wake();
 }
 function setMap(next){
  map=next;positions={...map.positions};nodes=new Map([...viewport.querySelectorAll('.course-node')].map(n=>[n.dataset.course,n]));
  const outlines=[...viewport.querySelectorAll('.sky-outline')];
  const source=[...map.charts.map(({chart,term,label})=>({chart,label,key:'term-'+term,courses:map.courses.filter(c=>!c.specialization&&c.term===term),heading:viewport.querySelector('[data-term="'+term+'"]')})),...(map.branchChart?[{chart:map.branchChart,label:map.branchLabel,key:'branch-'+map.courses.find(c=>c.specialization)?.specialization,courses:map.courses.filter(c=>c.specialization),heading:viewport.querySelector('.specialization-heading')}]:[])];
  clusters=source.map((c,index)=>({...c,index,svg:outlines[index],trails:[...outlines[index].querySelectorAll('.sky-trails polyline,.sky-plane-shadow polyline')],stars:[...outlines[index].querySelectorAll('.catalog-stars circle,.sky-plane-shadow circle')]}));
  for(const cluster of clusters){if(!clocks.has(cluster.key))clocks.set(cluster.key,{time:0});}
  const lines=viewport.querySelectorAll('.connection-line'),hits=viewport.querySelectorAll('.connection-hit'),shadows=viewport.querySelectorAll('.thread-shadows path');
  links=courseConnections(map.courses).map((edge,i)=>({edge,paths:[lines[i],hits[i],shadows[i]]}));
  if(enabled&&!query?.matches)draw();wake();
 }
 function state(){if(paused())cancel();else wake();}
 function toggle(){enabled=!enabled;paintButton();state();}
 function preference(){if(query.matches){enabled=false;paintButton();cancel();if(map){for(const clock of clocks.values())clock.time=0;draw();}}else{paintButton();state();}}
 function hover(event){
  const node=event.target.closest?.('.course-node'),path=event.target.closest?.('[data-connection]');
  hovered=path?'path':node?clusters.find(c=>c.courses.some(course=>course.id===node.dataset.course))?.key||null:null;
  state();
 }
 const leave=()=>{hovered=null;state();};
 const down=()=>{pointerDown=true;state();};const up=()=>{pointerDown=false;state();};
 const blur=()=>{blurred=true;pointerDown=false;hovered=null;state();},focus=()=>{blurred=false;state();};
 const observer=win.MutationObserver?new win.MutationObserver(state):null;
 observer?.observe(viewport,{attributes:true,attributeFilter:['class']});
 for(const target of doc.querySelectorAll('dialog,#map-page'))observer?.observe(target,{attributes:true,attributeFilter:['open','class']});
 button.addEventListener('click',toggle);viewport.addEventListener('pointerover',hover);viewport.addEventListener('focusin',hover);viewport.addEventListener('pointerleave',leave);viewport.addEventListener('focusout',leave);viewport.addEventListener('pointerdown',down);
 win.addEventListener('pointerup',up);win.addEventListener('pointercancel',up);win.addEventListener('blur',blur);win.addEventListener('focus',focus);doc.addEventListener('visibilitychange',state);query?.addEventListener('change',preference);
 paintButton();
 return {setMap,getPosition:id=>positions[id]?{...positions[id]}:null,destroy(){cancel();observer?.disconnect();button.removeEventListener('click',toggle);viewport.removeEventListener('pointerover',hover);viewport.removeEventListener('focusin',hover);viewport.removeEventListener('pointerleave',leave);viewport.removeEventListener('focusout',leave);viewport.removeEventListener('pointerdown',down);win.removeEventListener('pointerup',up);win.removeEventListener('pointercancel',up);win.removeEventListener('blur',blur);win.removeEventListener('focus',focus);doc.removeEventListener('visibilitychange',state);query?.removeEventListener('change',preference);doc.body.classList.remove('constellations-rotating');}};
}
