import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {COURSES} from '../src/curriculum.mjs';
import {createSkyMap} from '../src/map-curriculum.mjs';
import {createOrbitLayout,orbitSceneBounds} from '../src/orbit-layout.mjs';
import {rotatedCluster} from '../src/constellation-rotation.mjs';
import {filterCourseIndex,courseIndexMarkup} from '../src/course-index.mjs';
import {showCourseDossier,attachSidePanelDismiss} from '../src/side-panel.mjs';

test('course index searches codes, titles and branches without duplicate map IDs or unsafe markup',()=>{
 assert.equal(filterCourseIndex(COURSES,'  fndmath ')[0].id,'FNDMATH');
 assert.ok(filterCourseIndex(COURSES,'reinforced concrete').every(c=>/Reinforced Concrete/.test(c.title)));
 assert.equal(filterCourseIndex(COURSES,'xyz no course').length,0);
 const result=courseIndexMarkup(COURSES,'earthquake');assert.equal(result.count,1);assert.match(result.html,/data-course-index="STERQUA"/);assert.ok(!result.html.includes('data-course="'));
 assert.ok(!courseIndexMarkup([{id:'SAFE',title:'<script>bad</script>',year:1}], 'safe').html.includes('<script>'));
});
test('full-turn footprints remain separate and inside pan bounds for every specialization, preserving source graphs',()=>{
 for(const branch of [null,'STE','GTE','HWR','TRE','CTM']){
  const source=createSkyMap(branch),before=JSON.stringify(source),map=createOrbitLayout(source),bounds=orbitSceneBounds(map),groups=[...map.charts,...(map.branchChart?[{chart:map.branchChart,label:map.branchLabel,branch:true}]:[])];
  assert.equal(JSON.stringify(source),before);assert.equal(new Set(map.courses.map(c=>c.id)).size,map.courses.length);
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
   const a=groups[i].chart.orbit,b=groups[j].chart.orbit;assert.ok(Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)>a.radius+b.radius);
  }
  for(const group of groups)for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const courses=map.courses.filter(c=>group.branch?!!c.specialization:!c.specialization&&c.term===group.term),pose=rotatedCluster(group.chart,map.positions,courses,group.label,angle);
   for(const point of pose.vertices){assert.ok(point.x>=bounds.minX&&point.x<=bounds.maxX);assert.ok(point.y>=bounds.minY&&point.y<=bounds.maxY);}
   assert.deepEqual(pose.label,group.label);
  }
  assert.ok(map.width>=bounds.maxX&&map.height>=bounds.maxY);
 }
});
test('course file uses a nonmodal dialog and dismisses only background presses, preserving controls and pan gestures',()=>{
 const dom=new JSDOM('<div id="map"></div><button id="year">Year II</button><dialog id="course"><button>Close</button></dialog>'),doc=dom.window.document,dialog=doc.querySelector('dialog');
 let native=0,modal=0,dismissed=0;dialog.show=()=>{native++;dialog.open=true;};dialog.showModal=()=>modal++;
 showCourseDossier(dialog);assert.equal(native,1);assert.equal(modal,0);
 const detach=attachSidePanelDismiss(dialog,()=>{dismissed++;dialog.open=false;});
 const send=(selector,type)=>doc.querySelector(selector).dispatchEvent(new dom.window.MouseEvent(type,{bubbles:true,button:0}));
 try{
  send('#year','pointerdown');send('#year','click');assert.equal(dismissed,0);
  send('dialog button','pointerdown');send('#map','click');assert.equal(dismissed,0);
  send('#map','pointerdown');send('#map','pointercancel');send('#map','click');assert.equal(dismissed,0);
  send('#map','pointerdown');send('#map','click');assert.equal(dismissed,1);
 }finally{detach();dom.window.close();}
});
