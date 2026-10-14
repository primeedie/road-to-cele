import {courseConnections,traceConnection} from './connections.mjs';
import {SKY_COLORS} from './sky-palette.mjs';
import {localLightSegments,starBadge,NODE_GROUND_X,NODE_GROUND_Y} from './sky-layout.mjs';

const color=id=>SKY_COLORS[id]||'#a9b8ce';
const box=points=>({minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y))});
const overlaps=(a,b)=>a.maxX>=b.minX&&a.minX<=b.maxX&&a.maxY>=b.minY&&a.minY<=b.maxY;
const white=(hex,amount)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-amount)+255*amount).toString(16).padStart(2,'0')).join('');
export const MOBILE_SKY_QUERY='(max-width: 760px), (pointer: coarse)';

export function createMobileScene(map,{getState=()=> 'locked',selectedCourse=null,connectionKey=null,gateLabel='View gate requirements'}={}){
 const trace=traceConnection(map.courses,connectionKey);
 const nodes=map.courses.map(course=>{
  const p=map.positions[course.id];
  return {course,p,state:getState(course),color:color(p.chart),selected:course.id===selectedCourse,muted:!!trace&&!trace.ids.has(course.id),bounds:{minX:p.x-25,minY:p.y-30,maxX:p.x+275,maxY:p.y+p.labelY+55}};
 });
 const groups=[...map.charts,...(map.branchChart?[{chart:map.branchChart,label:map.branchLabel,branch:map.courses.find(c=>c.specialization)?.specialization}]:[])];
 const charts=groups.map(group=>{
  const members=nodes.filter(n=>group.courseIds?group.courseIds.includes(n.course.id):group.branch?n.course.specialization===group.branch:!n.course.specialization&&n.course.term===group.term);
  const lights=members.filter(n=>['active-course','completed'].includes(n.state)).map(n=>({anchor:n.p.anchorIndex,strength:n.state==='completed'?1:.7}));
  return {...group,color:color(group.chart.id),bounds:group.chart.orbit.bounds,lights:localLightSegments(group.chart,lights)};
 });
 const edges=courseConnections(map.courses).map(edge=>{
  const a=map.positions[edge.from],b=map.positions[edge.to],from={x:a.x+NODE_GROUND_X,y:a.y+NODE_GROUND_Y},to={x:b.x+NODE_GROUND_X,y:b.y+NODE_GROUND_Y},bend=Math.min(180,Math.abs(to.x-from.x)*.4);
  const controls=[from,{x:from.x+bend,y:from.y},{x:to.x-bend,y:to.y},to];
  const points=Array.from({length:25},(_,i)=>{const t=i/24,u=1-t;return {x:u*u*u*from.x+3*u*u*t*controls[1].x+3*u*t*t*controls[2].x+t*t*t*to.x,y:u*u*u*from.y+3*u*u*t*from.y+3*u*t*t*to.y+t*t*t*to.y};});
  return {...edge,controls,points,bounds:box(controls),selected:edge.key===connectionKey,traced:!!trace?.edges.has(edge.key),muted:!!trace&&!trace.edges.has(edge.key)};
 });
 return {nodes,charts,edges,portal:map.portal,gateLabel,tracing:!!trace};
}
export function visibleMobileItems(scene,camera,viewport,padding=32){
 const bounds={minX:(-camera.x-padding)/camera.scale,minY:(-camera.y-padding)/camera.scale,maxX:(viewport.width-camera.x+padding)/camera.scale,maxY:(viewport.height-camera.y+padding)/camera.scale};
 return {nodes:scene.nodes.filter(n=>overlaps(n.bounds,bounds)),charts:scene.charts.filter(c=>overlaps(c.bounds,bounds)),edges:scene.edges.filter(e=>overlaps(e.bounds,bounds)),portal:scene.portal&&overlaps(scene.portal.bounds,bounds)?scene.portal:null};
}
function distanceToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function pickMobileItem(scene,camera,point){
 const p={x:(point.x-camera.x)/camera.scale,y:(point.y-camera.y)/camera.scale};
 // Small stars get a usable finger target; select the closest when targets overlap.
 let nearest=null,distance=Infinity;
 for(const n of scene.nodes){
  const center={x:n.p.x+125,y:n.p.y+176+(70*4/3-176)*n.p.perspective},d=Math.hypot((p.x-center.x)*camera.scale,(p.y-center.y)*camera.scale);
  const code={minX:n.p.x+45,minY:n.p.y+n.p.labelY,maxX:n.p.x+205,maxY:n.p.y+n.p.labelY+48};
  if((d<=Math.max(18,55*n.p.perspective*camera.scale)||overlaps(code,{minX:p.x,minY:p.y,maxX:p.x,maxY:p.y}))&&d<distance){nearest={kind:'course',id:n.course.id};distance=d;}
 }
 if(nearest)return nearest;
 for(const group of scene.charts){if(group.branch&&overlaps({minX:group.label.x,minY:group.label.y+92,maxX:group.label.x+235,maxY:group.label.y+137},{minX:p.x,minY:p.y,maxX:p.x,maxY:p.y}))return {kind:'hidebranch'};}
 if(scene.portal&&overlaps(scene.portal.bounds,{minX:p.x,minY:p.y,maxX:p.x,maxY:p.y}))return {kind:'gate'};
 for(const edge of scene.edges){
  for(let i=1;i<edge.points.length;i++){const d=distanceToSegment(p,edge.points[i-1],edge.points[i])*camera.scale;if(d<=9&&d<distance){nearest={kind:'connection',id:edge.key};distance=d;}}
 }
 return nearest;
}

export function createMobilePainter({makeCanvas,Path,cacheBytes=24*1024*1024}){
 const paths=Object.fromEntries([...starBadge().matchAll(/<path class="([^"]+)" d="([^"]+)"/g)].map(([,key,d])=>[key,new Path(d)]));
 const sprites=new Map();let bytes=0;
 function sprite(node,density,overview){
  const key=[node.course.id,node.color,node.state,node.p.perspective,node.p.labelY,density,overview].join(':');
  if(sprites.has(key)){const value=sprites.get(key);sprites.delete(key);sprites.set(key,value);return value;}
  const width=300,height=Math.max(300,node.p.labelY+55),image=makeCanvas(Math.ceil(width*density),Math.ceil(height*density)),ctx=image.getContext('2d');
  ctx.scale(density,density);ctx.translate(25,25);
  const accent=node.color,active=node.state==='active-course',complete=node.state==='completed',lit=active||complete;
  ctx.save();ctx.translate(125,176);ctx.scale(node.p.perspective,node.p.perspective);ctx.translate(-96,-176);ctx.scale(4/3,4/3);
  ctx.fillStyle='#01030a';ctx.globalAlpha=.75;ctx.beginPath();ctx.ellipse(72,148,55,20,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#132135';ctx.strokeStyle=accent;ctx.globalAlpha=lit?.18:.14;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(72,132,49,23,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#090d1b';ctx.fill(paths['elevation-base-side']);ctx.globalAlpha=.25;ctx.stroke(paths['elevation-base-light']);ctx.stroke(paths['elevation-stem']);
  ctx.translate(72,70);const boost=complete?1+.4*overview:active?1+.25*overview:1;ctx.scale(boost,boost);ctx.translate(-72,-52);
  const opacity=lit?1:node.state==='locked'?.5:node.state==='preview'?.55:.65;
  ctx.globalAlpha=opacity*.65;ctx.fillStyle=accent;ctx.save();ctx.translate(0,5);ctx.fill(paths['star-extrusion']);ctx.restore();
  ctx.globalAlpha=opacity*(lit?1:.8);ctx.fillStyle=complete?'#fff':active?white(accent,.8):accent;ctx.fill(paths['star-rays']);
  if(lit){ctx.strokeStyle=white(accent,complete?.85:.55);ctx.lineWidth=1.2;ctx.stroke(paths['star-rays']);}
  ctx.globalAlpha=opacity*(lit?1:.7);ctx.fillStyle=complete?'#fff':active?'#f3faff':white(accent,.68);ctx.fill(paths['star-facet-light']);
  ctx.fillStyle=white(accent,complete?.82:active?.52:.12);ctx.globalAlpha=opacity;ctx.fill(paths['star-facet-dark']);
  ctx.fillStyle=lit?'#fff':white(accent,.45);ctx.globalAlpha=opacity*(lit?1:.88);ctx.fill(paths['star-center']);
  ctx.globalAlpha=opacity;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(72,52,complete?6:active?4.5:3,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.globalAlpha=1;ctx.font='800 30px "CELE WenHei", Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  const code=node.course.code||node.course.id,labelWidth=Math.max(100,ctx.measureText(code).width+18),left=125-labelWidth/2,y=node.p.labelY;
  ctx.fillStyle='#00000088';ctx.fillRect(left,y,labelWidth,43);ctx.globalAlpha=.24;ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.strokeRect(left,y,labelWidth,43);
  ctx.globalAlpha=1;ctx.fillStyle=complete?'#fff':white(accent,active?.65:.26);ctx.fillText(code,125,y+5);
  if(node.course.archivedAttempt||node.course.retake){ctx.font='800 18px "CELE WenHei", Arial, sans-serif';ctx.fillStyle=node.course.archivedAttempt?'#ebb599':'#e3ca96';ctx.fillText(node.course.archivedAttempt?'0.0 · previous attempt':'Retake',125,y+48);}
  const value={image,width,height,bytes:image.width*image.height*4};sprites.set(key,value);bytes+=value.bytes;
  while(bytes>cacheBytes&&sprites.size>1){const [old,item]=sprites.entries().next().value;sprites.delete(old);bytes-=item.bytes;}
  return value;
 }
 function drawPortal(ctx,p,label){
  const scale=p.height*.75/480,left=p.x+(p.width-720*scale)/2;
  ctx.save();ctx.translate(left,p.y);ctx.scale(scale,scale);ctx.strokeStyle='#d8b779';ctx.globalAlpha=.7;ctx.lineWidth=2.5;
  for(const [rx,ry] of [[284,100],[267,86]]){ctx.beginPath();ctx.ellipse(360,225,rx,ry,-.244,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=.85;ctx.beginPath();ctx.moveTo(88,260);ctx.bezierCurveTo(182,86,480,93,624,155);ctx.stroke();
  const rim=ctx.createRadialGradient(360,225,88,360,225,104);rim.addColorStop(0,'#000');rim.addColorStop(.75,'#241c10');rim.addColorStop(.94,'#edc784');rim.addColorStop(1,'#fff4d5');
  ctx.globalAlpha=1;ctx.fillStyle=rim;ctx.beginPath();ctx.arc(360,225,104,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ffedc8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(97,281);ctx.bezierCurveTo(218,320,433,304,632,181);ctx.stroke();
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(257,230);ctx.quadraticCurveTo(345,194,463,214);ctx.stroke();
  ctx.fillStyle='#e7ce98';ctx.beginPath();ctx.moveTo(352,176);ctx.lineTo(360,160);ctx.lineTo(368,176);ctx.lineTo(360,192);ctx.closePath();ctx.fill();
  ctx.font='800 40px "CELE WenHei", Arial, sans-serif';ctx.textAlign='center';ctx.fillText('C',360,244);ctx.restore();
  ctx.textAlign='center';ctx.fillStyle='#ead9b7';ctx.font='800 40px "CELE WenHei", Arial, sans-serif';ctx.fillText('CIVINCO',p.x+p.width/2,p.y+p.height*.75+52);
  ctx.fillStyle='#c1b69f';ctx.font='800 23px "CELE WenHei", Arial, sans-serif';ctx.fillText(label,p.x+p.width/2,p.y+p.height*.75+88);
 }
 function paint(ctx,scene,camera,viewport,{dpr=1,styleScale=camera.scale,focusedCourse=null,focusedConnection=null}={}){
  const visible=visibleMobileItems(scene,camera,viewport),overview=Math.round(Math.max(0,Math.min(1,(.4-styleScale)/.25))*10)/10,density=Math.max(.25,Math.min(4,Math.ceil(camera.scale*dpr*4)/4));
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.setTransform(dpr*camera.scale,0,0,dpr*camera.scale,dpr*camera.x,dpr*camera.y);
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const edge of visible.edges){
   const [a,b,c,d]=edge.controls,focused=edge.key===focusedConnection;
   ctx.globalAlpha=edge.muted?.045:edge.selected||focused?.95:edge.traced?.85:.15;ctx.strokeStyle=edge.selected||focused?'#f3dec0':edge.traced?'#acc9d8':'#827c72';ctx.lineWidth=edge.selected||focused?3:1.6;ctx.setLineDash(edge.selected?[12,18]:edge.type==='C'?[2,6]:[4,7]);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y);ctx.stroke();
  }
  ctx.setLineDash([]);
  for(const group of visible.charts){
   const {chart}=group;ctx.strokeStyle=group.color;ctx.globalAlpha=(.3-.06*overview)*(scene.tracing?.25:1);ctx.lineWidth=Math.max(1.8,.4/styleScale);
   for(const path of chart.paths){ctx.beginPath();path.forEach((id,i)=>{const p=chart.vertices[id];if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.stroke();}
   ctx.fillStyle=group.color;ctx.globalAlpha=.3;for(const p of chart.vertices){ctx.beginPath();ctx.arc(p.x,p.y,p.degree>2?4:2.8,0,Math.PI*2);ctx.fill();}
   ctx.globalAlpha=scene.tracing?.35:1;ctx.lineWidth=Math.max(3,.65/styleScale);
   for(const light of group.lights){const a=chart.vertices[light.from],b=chart.vertices[light.to],gradient=ctx.createLinearGradient(a.x,a.y,b.x,b.y),tone=white(group.color,.58);gradient.addColorStop(0,tone+Math.round(light.start*255).toString(16).padStart(2,'0'));gradient.addColorStop(.5,tone+'00');gradient.addColorStop(1,tone+Math.round(light.end*255).toString(16).padStart(2,'0'));ctx.strokeStyle=gradient;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
   ctx.globalAlpha=1;ctx.textAlign='left';ctx.textBaseline='top';ctx.font='800 24px "CELE WenHei", Arial, sans-serif';ctx.fillStyle='#ccc';ctx.fillText(group.branch||'Year '+(['I','II','III','IV'][Math.ceil(group.term/3)-1]||Math.ceil(group.term/3)),group.label.x,group.label.y);
   if(!group.branch){ctx.font='800 18px "CELE WenHei", Arial, sans-serif';ctx.fillStyle='#aaa';ctx.fillText('Term '+String(group.term).padStart(2,'0'),group.label.x+110,group.label.y+3);}
   ctx.font='800 42px "CELE WenHei", Arial, sans-serif';ctx.fillStyle=group.color;ctx.fillText(chart.name,group.label.x,group.label.y+34);
   if(group.branch){ctx.font='800 21px "CELE WenHei", Arial, sans-serif';ctx.fillStyle='#ccc';ctx.fillText('Hide constellation',group.label.x+10,group.label.y+105);ctx.globalAlpha=.3;ctx.strokeStyle=group.color;ctx.lineWidth=1;ctx.strokeRect(group.label.x,group.label.y+92,235,45);ctx.globalAlpha=1;}
  }
  if(visible.portal){ctx.globalAlpha=1;ctx.textBaseline='alphabetic';drawPortal(ctx,visible.portal,scene.gateLabel);}
  for(const node of visible.nodes){
   const asset=sprite(node,density,overview);ctx.globalAlpha=node.muted?.3:1;ctx.drawImage(asset.image,node.p.x-25,node.p.y-25,asset.width,asset.height);
   if(node.selected||node.course.id===focusedCourse){ctx.globalAlpha=1;ctx.strokeStyle=node.color;ctx.lineWidth=2/camera.scale;ctx.strokeRect(node.p.x+36,node.p.y+node.p.labelY-3,178,49);}
  }
  ctx.globalAlpha=1;
  return {nodes:visible.nodes.length,totalNodes:scene.nodes.length,charts:visible.charts.length,edges:visible.edges.length,cacheBytes:bytes};
 }
 return {paint,clear(){sprites.clear();bytes=0;}};
}

export function attachMobileSky(viewport,{getCamera,getViewport,onModeChange=()=>{},makeCanvas,Path,contextFactory}={}){
 const doc=viewport.ownerDocument,win=doc.defaultView,query=win.matchMedia?.(MOBILE_SKY_QUERY),canvas=doc.createElement('canvas');
 canvas.className='mobile-sky-canvas';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;viewport.append(canvas);
 let scene=null,ctx=null,painter=null,active=false,styleScale=null,stats=null;
 makeCanvas??=(width,height)=>{const c=doc.createElement('canvas');c.width=width;c.height=height;return c;};Path??=win.Path2D;
 function mode(notify=true){
  const before=active;active=false;
  if(query?.matches&&Path){try{ctx??=contextFactory?.(canvas)||canvas.getContext('2d');if(ctx){painter??=createMobilePainter({makeCanvas,Path});active=true;}}catch{active=false;}}
  canvas.hidden=!active;viewport.classList.toggle('canvas-sky-mode',active);
  if(before!==active&&notify)onModeChange();
 }
 function paint(){
  if(!active||!scene)return;
  const camera=getCamera(),r=getViewport(),dpr=Math.max(1,Math.min(2,win.devicePixelRatio||1)),width=Math.max(1,Math.round(r.width*dpr)),height=Math.max(1,Math.round(r.height*dpr));
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  if(styleScale===null||!viewport.matches('.dragging,.zooming'))styleScale=camera.scale;
  stats=painter.paint(ctx,scene,camera,r,{dpr,styleScale,focusedCourse:doc.activeElement?.dataset.course,focusedConnection:doc.activeElement?.dataset.connection});
 }
 const change=()=>mode(),fontReady=()=>{painter?.clear();paint();};
 query?.addEventListener('change',change);doc.fonts?.ready.then(fontReady).catch(()=>{});mode(false);
 return {get active(){return active;},get stats(){return stats;},setScene(next){scene=next;},paint,pick(point){return active&&scene?pickMobileItem(scene,getCamera(),point):null;},destroy(){query?.removeEventListener('change',change);painter?.clear();canvas.remove();viewport.classList.remove('canvas-sky-mode');active=false;}};
}
