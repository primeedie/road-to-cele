import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkyMap} from '../src/map-curriculum.mjs';
import {sceneBounds,constrainCamera,overviewCamera} from '../src/map-camera.mjs';
import {NODE_GROUND_X,NODE_GROUND_Y} from '../src/sky-layout.mjs';

test('extreme panning stops at visible course content for shared and specialist maps',()=>{
 for(const branch of [null,'STE','GTE','HWR','TRE','CTM']){
  const map=createSkyMap(branch),bounds=sceneBounds(map),before=JSON.stringify(map.positions);
  for(const scale of [.5,1,1.8])for(const x of [-1e6,1e6])for(const y of [-1e6,1e6]){
   const camera=constrainCamera({x,y,scale},{width:800,height:500},bounds);
   const visible=map.courses.some(c=>{
    const p=map.positions[c.id],sx=(p.x+NODE_GROUND_X)*scale+camera.x,sy=(p.y+NODE_GROUND_Y)*scale+camera.y;
    return sx>-110*scale&&sx<800+110*scale&&sy>-80*scale&&sy<500+150*scale;
   });
   assert.ok(visible,`${branch||'shared'} ${scale} ${x} ${y} must retain a course in view`);
  }
  assert.equal(JSON.stringify(map.positions),before);
 }
});
test('overview fits course content and an already fitted small map cannot be dragged away',()=>{
 const bounds=sceneBounds(createSkyMap('TRE')),viewport={width:800,height:500},camera=overviewCamera(viewport,bounds);
 assert.ok(bounds.minX*camera.scale+camera.x>=47);
 assert.ok(bounds.maxX*camera.scale+camera.x<=753);
 assert.ok(bounds.minY*camera.scale+camera.y>=47);
 assert.ok(bounds.maxY*camera.scale+camera.y<=453);
 const dragged=constrainCamera({...camera,x:1e6,y:-1e6},viewport,bounds);
 assert.ok(Math.abs(dragged.x-camera.x)<1e-8);assert.ok(Math.abs(dragged.y-camera.y)<1e-8);
});
test('year groups have compact gaps and headings remain near their actual topmost course',()=>{
 const map=createSkyMap(),bounds=sceneBounds(map);
 let previousBottom;
 for(let year=1;year<=4;year++){
  const groups=bounds.territories.slice((year-1)*3,year*3),top=Math.min(...groups.map(g=>g.minY)),bottom=Math.max(...groups.map(g=>g.maxY));
  if(previousBottom!==undefined){assert.ok(top-previousBottom>=120);assert.ok(top-previousBottom<=160);}
  previousBottom=bottom;
 }
 for(const {term,label} of map.charts){
  const top=Math.min(...map.courses.filter(c=>!c.specialization&&c.term===term).map(c=>{const p=map.positions[c.id];return p.y+NODE_GROUND_Y-140*p.perspective;}));
  assert.ok(top-label.y>=85&&top-label.y<=110);
 }
});
