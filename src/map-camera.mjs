import {NODE_GROUND_X,NODE_GROUND_Y} from './sky-layout.mjs';

// Retain the same point in the sky when the available screen space changes.
export function resizeCamera(camera,previous,next){
 if(!previous?.width||!previous.height||!next.width||!next.height)return {...camera};
 return {...camera,x:camera.x+(next.width-previous.width)/2,y:camera.y+(next.height-previous.height)/2};
}

const union=rectangles=>({minX:Math.min(...rectangles.map(r=>r.minX)),minY:Math.min(...rectangles.map(r=>r.minY)),maxX:Math.max(...rectangles.map(r=>r.maxX)),maxY:Math.max(...rectangles.map(r=>r.maxY))});
function territory(courses,positions,label){
 const rectangles=courses.map(c=>{
  const p=positions[c.id],x=p.x+NODE_GROUND_X,y=p.y+NODE_GROUND_Y,s=p.perspective,half=Math.max(110,80*s);
  return {minX:x-half,maxX:x+half,minY:y-150*s,maxY:Math.max(y+35*s,p.y+p.labelY+50)};
 });
 rectangles.push({minX:label.x,minY:label.y,maxX:label.x+340,maxY:label.y+120});
 return {...union(rectangles),targets:rectangles};
}
export function sceneBounds(map){
 const territories=map.charts.map(({term,label})=>territory(map.courses.filter(c=>!c.specialization&&c.term===term),map.positions,label));
 if(map.branchChart)territories.push(territory(map.courses.filter(c=>c.specialization),map.positions,map.branchLabel));
 return {...union(territories),territories,targets:territories.flatMap(t=>t.targets)};
}
function clampAxis(position,min,max,scale,size,padding){
 const length=(max-min)*scale;
 if(length<=size)return (size-length)/2-min*scale;
 return Math.max(size-padding-max*scale,Math.min(padding-min*scale,position));
}
export function constrainCamera(camera,viewport,bounds,padding=64){
 if(!viewport.width||!viewport.height)return {...camera};
 const {scale}=camera;
 const y=clampAxis(camera.y,bounds.minY,bounds.maxY,scale,viewport.height,padding);
 const top=-y/scale,bottom=(viewport.height-y)/scale;
 // The specialist lane exists beside Years III–IV, not beside empty earlier years.
 const visible=(bounds.targets || bounds.territories).filter(r=>r.maxY>=top&&r.minY<=bottom);
 const horizontal=visible.length?union(visible):bounds;
 const x=clampAxis(camera.x,horizontal.minX,horizontal.maxX,scale,viewport.width,padding);
 return {x,y,scale};
}
export function overviewCamera(viewport,bounds,padding=48){
 const scale=Math.min(Math.max(1,viewport.width-padding*2)/(bounds.maxX-bounds.minX),Math.max(1,viewport.height-padding*2)/(bounds.maxY-bounds.minY),1);
 return {scale,x:viewport.width/2-(bounds.minX+bounds.maxX)/2*scale,y:viewport.height/2-(bounds.minY+bounds.maxY)/2*scale};
}
