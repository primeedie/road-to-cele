// Give each real constellation enough room to turn without crossing another chart.
import {NODE_GROUND_X,NODE_GROUND_Y} from './sky-layout.mjs';
export function chartOrbit(chart){
 const xs=chart.vertices.map(p=>p.x),ys=chart.vertices.map(p=>p.y);
 const center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
 return {center,radius:Math.max(...chart.vertices.map(p=>Math.hypot(p.x-center.x,p.y-center.y)))};
}
export function createOrbitLayout(source){
 const sharedRadius=Math.max(...source.charts.map(c=>chartOrbit(c.chart).radius))+230,spacing=sharedRadius*2+210;
 const positions={},charts=[];
 function place(chart,courses,x,y){
  const orbit=chartOrbit(chart),dx=x-orbit.center.x,dy=y-orbit.center.y;
  const moved={...chart,vertices:chart.vertices.map(p=>({...p,x:p.x+dx,y:p.y+dy,catalogX:p.catalogX+dx,catalogY:p.catalogY+dy})),orbit:{center:{x,y},radius:orbit.radius+230}};
  for(const c of courses){const old=source.positions[c.id],point=moved.vertices[old.anchorIndex];positions[c.id]={...old,x:point.x-NODE_GROUND_X,y:point.y-NODE_GROUND_Y};}
  return {chart:moved,label:{x:x-orbit.radius*.5-40,y:y-orbit.radius*.5-80}};
 }
 for(const entry of source.charts){
  const courses=source.courses.filter(c=>!c.specialization&&c.term===entry.term),col=(entry.term-1)%3,row=Math.ceil(entry.term/3)-1;
  charts.push({...entry,...place(entry.chart,courses,sharedRadius+100+col*spacing,sharedRadius+280+row*(spacing+90))});
 }
 let branchChart=null,branchLabel=null;
 if(source.branchChart){
  const courses=source.courses.filter(c=>c.specialization),r=chartOrbit(source.branchChart).radius+230;
  const branch=place(source.branchChart,courses,sharedRadius*2+100+spacing*2+r+280,sharedRadius+280+2.5*(spacing+90));
  branchChart=branch.chart;branchLabel=branch.label;
 }
 const groups=[...charts.map(c=>c.chart),...(branchChart?[branchChart]:[])];
 const width=Math.max(...groups.map(c=>c.orbit.center.x+c.orbit.radius))+450,height=Math.max(...groups.map(c=>c.orbit.center.y+c.orbit.radius))+380;
 return {...source,charts,positions,branchChart,branchLabel,width,height};
}
export function orbitSceneBounds(map){
 const groups=[...map.charts.map(c=>({chart:c.chart,label:c.label})),...(map.branchChart?[{chart:map.branchChart,label:map.branchLabel}]:[])];
 const territories=groups.map(({chart,label})=>({minX:Math.min(chart.orbit.center.x-chart.orbit.radius,label.x)-50,maxX:Math.max(chart.orbit.center.x+chart.orbit.radius,label.x+340)+50,minY:Math.min(chart.orbit.center.y-chart.orbit.radius,label.y)-50,maxY:chart.orbit.center.y+chart.orbit.radius+90}));
 return {minX:Math.min(...territories.map(t=>t.minX)),minY:Math.min(...territories.map(t=>t.minY)),maxX:Math.max(...territories.map(t=>t.maxX)),maxY:Math.max(...territories.map(t=>t.maxY)),territories,targets:territories};
}
