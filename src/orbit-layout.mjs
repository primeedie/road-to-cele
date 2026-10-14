// Pack the actual 45° sweep envelopes, rather than empty full-turn circles.
import {NODE_GROUND_X,NODE_GROUND_Y} from './sky-layout.mjs';
import {ROTATION_LIMIT} from './rotation-range.mjs';
export function chartOrbit(chart){
 const xs=chart.vertices.map(p=>p.x),ys=chart.vertices.map(p=>p.y);
 const center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
 return {center,radius:Math.max(...chart.vertices.map(p=>Math.hypot(p.x-center.x,p.y-center.y)))};
}
export function chartSweepBounds(chart){
 const {center}=chartOrbit(chart),points=[];
 for(const p of chart.vertices){
  const x=p.x-center.x,y=p.y-center.y,phase=Math.atan2(y,x),angles=[0,ROTATION_LIMIT];
  // Include horizontal/vertical extrema inside the allowed sweep.
  for(let k=-4;k<=4;k++){const angle=k*Math.PI/2-phase;if(angle>0&&angle<ROTATION_LIMIT)angles.push(angle);}
  for(const angle of angles)points.push({x:center.x+x*Math.cos(angle)-y*Math.sin(angle),y:center.y+x*Math.sin(angle)+y*Math.cos(angle)});
 }
 return {minX:Math.min(...points.map(p=>p.x))-145,maxX:Math.max(...points.map(p=>p.x))+145,minY:Math.min(...points.map(p=>p.y))-190,maxY:Math.max(...points.map(p=>p.y))+110};
}
export function createOrbitLayout(source){
 const sizes=source.charts.map(c=>chartSweepBounds(c.chart));
 const widths=[0,1,2].map(col=>Math.max(1,...sizes.filter((b,i)=>(source.charts[i].term-1)%3===col).map(b=>b.maxX-b.minX)));
 const rowCount=Math.max(4,...source.charts.map(c=>(c.layoutRow??Math.ceil(c.term/3)-1)+1));
 const heights=Array.from({length:rowCount},(_,row)=>Math.max(1,...sizes.filter((b,i)=>(source.charts[i].layoutRow??Math.ceil(source.charts[i].term/3)-1)===row).map(b=>b.maxY-b.minY)));
 const offsets=(values,gap)=>values.map((_,i)=>120+values.slice(0,i).reduce((sum,v)=>sum+v+gap,0));
 const columns=offsets(widths,170),rows=offsets(heights,120);
 const positions={},charts=[];
 function place(chart,courses,left,top){
  const orbit=chartOrbit(chart),bounds=chartSweepBounds(chart),dx=left-bounds.minX,dy=top-bounds.minY;
  const movedBounds={minX:left,minY:top,maxX:bounds.maxX+dx,maxY:bounds.maxY+dy};
  const moved={...chart,vertices:chart.vertices.map(p=>({...p,x:p.x+dx,y:p.y+dy,catalogX:p.catalogX+dx,catalogY:p.catalogY+dy})),orbit:{center:{x:orbit.center.x+dx,y:orbit.center.y+dy},radius:orbit.radius+230,bounds:movedBounds}};
  for(const c of courses){const old=source.positions[c.id],point=moved.vertices[old.anchorIndex];positions[c.id]={...old,x:point.x-NODE_GROUND_X,y:point.y-NODE_GROUND_Y};}
  return {chart:moved,label:{x:left+160,y:top+12}};
 }
 for(const entry of source.charts){
  const courses=source.courses.filter(c=>entry.courseIds?entry.courseIds.includes(c.id):!c.specialization&&c.term===entry.term),col=(entry.term-1)%3,row=entry.layoutRow??Math.ceil(entry.term/3)-1;
  charts.push({...entry,...place(entry.chart,courses,columns[col],rows[row])});
 }
 let branchChart=null,branchLabel=null;
 if(source.branchChart){
  const branch=place(source.branchChart,source.courses.filter(c=>c.specialization),columns[2]+widths[2]+170,rows[2]);
  branchChart=branch.chart;branchLabel=branch.label;
 }
 const groups=[...charts.map(c=>c.chart),...(branchChart?[branchChart]:[])];
 // Year IV has two shared terms; its third column holds the integration gate.
 const portalWidth=Math.min(1920,widths[2]),portalHeight=1440;
 const precedingTerm=charts.find(c=>c.term===9).chart.orbit.bounds;
 const portal={x:columns[2]+80,y:(source.personalPlan?Math.max(...groups.map(c=>c.orbit.bounds.maxY)):precedingTerm.maxY)+60,width:portalWidth,height:portalHeight};
 // Bound the visible disk/particles and caption rather than the SVG's empty margins.
 portal.bounds={minX:portal.x+280,minY:portal.y+10,maxX:portal.x+portal.width-280,maxY:portal.y+1200};
 const width=Math.max(portal.bounds.maxX,...groups.map(c=>c.orbit.bounds.maxX))+100,height=Math.max(portal.bounds.maxY,...groups.map(c=>c.orbit.bounds.maxY))+100;
 return {...source,charts,positions,branchChart,branchLabel,portal,width,height};
}
export function orbitSceneBounds(map){
 const territories=[...map.charts.map(c=>c.chart),...(map.branchChart?[map.branchChart]:[])].map(c=>({...c.orbit.bounds}));
 if(map.portal)territories.push({...map.portal.bounds});
 return {minX:Math.min(...territories.map(t=>t.minX)),minY:Math.min(...territories.map(t=>t.minY)),maxX:Math.max(...territories.map(t=>t.maxX)),maxY:Math.max(...territories.map(t=>t.maxY)),territories,targets:territories};
}
