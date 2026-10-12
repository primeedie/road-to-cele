import { CHARTS } from './data/constellations.mjs';
import { projectScenePoint } from './scene-camera.mjs';
import { skyAccent } from './sky-palette.mjs';
export const SKY_NAMES={Ori:'Orion',Cyg:'Cygnus',UMa:'Ursa Major',Gem:'Gemini',Leo:'Leo',Aur:'Auriga',Cas:'Cassiopeia',Peg:'Pegasus',Aql:'Aquila',Aqr:'Aquarius',Vir:'Virgo',Lyr:'Lyra'};
export const BRANCH_CONSTELLATIONS={STE:'Ori',GTE:'Cas',HWR:'Aqr',TRE:'Cyg',CTM:'Lyr'};
export const TERM_CONSTELLATIONS={1:'Ori',2:'Cyg',3:'UMa',4:'Gem',5:'Leo',6:'Aur',7:'Cas',8:'Peg',9:'Aql',10:'Aqr',11:'Vir'};
export const SHARED_WIDTH=5000;
export const WORLD_WIDTH=7800;
export const YEAR_HEIGHT=2240;
export const WORLD_HEIGHT=YEAR_HEIGHT*4;
export const BRANCH_WIDTH=2600;
export const BRANCH_HEIGHT=1540;
export const NODE_GROUND_X=125;
export const NODE_GROUND_Y=176;
export const NODE_LABEL_Y=216;
export const YEAR_ENTRY_OFFSET=-620;
// RA increases eastward (left on a sky chart); unwrapping handles the 180-degree seam.
// One uniform scale preserves the source outline. This is a schematic sky projection.
export function projectConstellation(id,box,{depth=false}={}){
 const lines=CHARTS[id];if(!lines)throw Error('Unknown constellation');
 const origin=lines[0][0][0],unwrap=ra=>origin+((((ra-origin)+180)%360+360)%360)-180;
 const all=lines.flat(),dec=all.reduce((s,p)=>s+p[1],0)/all.length,cos=Math.cos(dec*Math.PI/180);
 const raw=lines.map(line=>line.map(([ra,d])=>[-unwrap(ra)*cos,-d]));
 const flat=raw.flat(),minX=Math.min(...flat.map(p=>p[0])),maxX=Math.max(...flat.map(p=>p[0])),minY=Math.min(...flat.map(p=>p[1])),maxY=Math.max(...flat.map(p=>p[1]));
 const scale=Math.min(box.width/(maxX-minX),box.height/(maxY-minY));
 const ox=box.x+(box.width-(maxX-minX)*scale)/2,oy=box.y+(box.height-(maxY-minY)*scale)/2;
 const seen=new Map(),vertices=[],edges=[],paths=[];
 raw.forEach(line=>{const path=line.map(p=>{const key=p.join(',');let index=seen.get(key);if(index===undefined){index=vertices.length;seen.set(key,index);vertices.push({x:ox+(p[0]-minX)*scale,y:oy+(p[1]-minY)*scale,degree:0});}return index;});paths.push(path);for(let i=1;i<path.length;i++){edges.push([path[i-1],path[i]]);vertices[path[i-1]].degree++;vertices[path[i]].degree++;}});
 // Assignment uses catalog coordinates, so a course keeps the same anchor in its detail chart.
 vertices.forEach(p=>{p.catalogX=p.x;p.catalogY=p.y;p.perspective=1;const dx=p.x-(box.x+box.width/2),dy=p.y-(box.y+box.height/2),yaw=-Math.PI/22.5;p.selectionX=dx*Math.cos(yaw)-dy*Math.sin(yaw);p.selectionY=(dx*Math.sin(yaw)+dy*Math.cos(yaw))*.5;});
 if(depth){const center={x:box.x+box.width/2,y:box.y+box.height/2};vertices.forEach(p=>Object.assign(p,projectScenePoint(p,center)));}
 return {id,name:SKY_NAMES[id],vertices,edges,paths,scale};
}
export function placeCourses(chart,courses){
 if(courses.length>chart.vertices.length)throw Error('Insufficient catalog anchors for these courses');
 const pool=chart.vertices.map((p,i)=>({...p,index:i}));
 const chosen=[];
 while(chosen.length<courses.length){
  const candidate=pool.filter(p=>!chosen.includes(p)).sort((a,b)=>{
   const score=p=>chosen.length?Math.min(...chosen.map(q=>Math.max(Math.abs(q.selectionX-p.selectionX)/150,Math.abs(q.selectionY-p.selectionY)/210)))*(1+p.degree*.04):p.degree;
   return score(b)-score(a)||a.index-b.index;
  })[0];chosen.push(candidate);
 }
 // Repair dense clusters on a canonical scene so details and map retain identical anchors.
 const minX=Math.min(...pool.map(p=>p.catalogX)),maxX=Math.max(...pool.map(p=>p.catalogX));
 const minY=Math.min(...pool.map(p=>p.catalogY)),maxY=Math.max(...pool.map(p=>p.catalogY));
 const unit=Math.min(1350/(maxX-minX),2200/(maxY-minY));
 const canonical=pool.map(p=>projectScenePoint({x:(p.catalogX-(minX+maxX)/2)*unit,y:(p.catalogY-(minY+maxY)/2)*unit},{x:0,y:0}));
 const boxes=p=>{const q=canonical[p.index],s=q.perspective;return [{x:q.x-55*s,y:q.y-133*s,w:110*s,h:102*s},{x:q.x-68*s,y:q.y-31*s,w:136*s,h:70*s},{x:q.x-78,y:q.y+40+Math.max(0,s-1)*34,w:156,h:45}];};
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 const cost=set=>set.reduce((sum,p,i)=>sum+set.slice(i+1).reduce((s,q)=>s+boxes(p).reduce((t,a)=>t+boxes(q).reduce((v,b)=>v+overlap(a,b),0),0),0),0);
 let current=cost(chosen);
 for(let round=0;round<8&&current>1;round++){
  let best=current,replacement=null;
  chosen.forEach((p,i)=>pool.filter(q=>!chosen.includes(q)).forEach(q=>{const trial=[...chosen];trial[i]=q;const score=cost(trial);if(score<best-1){best=score;replacement={i,q};}}));
  if(!replacement)break;chosen[replacement.i]=replacement.q;current=best;
 }
 const positions={};
 chosen.forEach((point,i)=>{
  positions[courses[i].id]={x:point.x-NODE_GROUND_X,y:point.y-NODE_GROUND_Y,labelX:0,labelY:NODE_LABEL_Y+Math.max(0,point.perspective-1)*34,perspective:point.perspective,chart:chart.id,anchorIndex:point.index};
 });
 return positions;
}
export function drawConstellation(chart,{activated=0,completed=0,total=0}={}){
 const points=chart.vertices;
 const lines=chart.paths.map(path=>`<polyline points="${path.map(i=>`${points[i].x},${points[i].y}`).join(' ')}"/>`).join('');
 const stars=points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${p.degree>2?4:2.8}"/>`).join('');
 const lit=activated+completed>0,brightness=lit ? .35+.65*Math.min(1,(activated*.4+completed)/Math.max(1,total)) : .2;
 return `<svg class="sky-outline ${lit?'constellation-lit':''}" style="${skyAccent(chart.id)};--constellation-brightness:${brightness.toFixed(3)}" data-lit-courses="${activated+completed}" data-completed-courses="${completed}" data-constellation="${chart.id}" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" aria-hidden="true"><g class="sky-plane-shadow" transform="translate(10 24)">${lines}${stars}</g><g class="sky-trails">${lines}</g><g class="catalog-stars">${stars}</g></svg>`;
}
export function starBadge(){return `<svg class="skill-star" viewBox="0 0 144 164" aria-hidden="true"><ellipse class="star-floor-shadow" cx="72" cy="148" rx="55" ry="20"/><path class="elevation-base-side" d="M23 132A49 23 0 0 0 121 132V138A49 23 0 0 1 23 138Z"/><ellipse class="elevation-base" cx="72" cy="132" rx="49" ry="23"/><path class="elevation-base-light" d="M23 132A49 23 0 0 1 121 132"/><ellipse class="elevation-contact" cx="72" cy="132" rx="22" ry="8"/><path class="elevation-stem" d="M72 104V131"/><g transform="translate(0 18)"><g class="star-hover-glyph"><path class="star-extrusion" d="M72 17L79 45L109 52L79 60L72 88L65 60L35 52L65 45Z" transform="translate(0 5)"/><path class="star-rays" d="M72 17L79 45L109 52L79 60L72 88L65 60L35 52L65 45Z"/><path class="star-facet-light" d="M72 17L72 52L65 45ZM35 52L72 52L65 60ZM72 52L79 60L72 88Z"/><path class="star-facet-dark" d="M72 17L79 45L72 52ZM72 52L109 52L79 60ZM72 52L72 88L65 60Z"/><path class="star-center" d="M72 37L77 47L87 52L77 57L72 67L67 57L57 52L67 47Z"/><circle class="star-spark" cx="72" cy="52" r="3"/></g></g></svg>`;}
