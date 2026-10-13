import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createSkyMap} from '../src/map-curriculum.mjs';
import {drawConstellation,NODE_GROUND_X,NODE_GROUND_Y} from '../src/sky-layout.mjs';
import {rotatedCluster,rotateSkyPoint,connectionCurve,attachConstellationRotation} from '../src/constellation-rotation.mjs';
import {constellationAngle,ROTATION_LIMIT,ROTATION_PERIOD} from '../src/rotation-range.mjs';

test('rotation makes a bounded 45-degree loop with a smooth return and no reset jump',()=>{
 assert.equal(constellationAngle(0),0);assert.equal(constellationAngle(ROTATION_PERIOD/2),ROTATION_LIMIT);
 assert.equal(constellationAngle(ROTATION_PERIOD),0);
 for(let t=0;t<1000;t+=.5){const angle=constellationAngle(t);assert.ok(angle>=0&&angle<=ROTATION_LIMIT);}
 for(const t of [0,ROTATION_PERIOD/2,ROTATION_PERIOD])assert.ok(Math.abs(constellationAngle(t+.01)-constellationAngle(t-.01))<1e-8);
});

test('rotation keeps courses on catalog anchors in every shared and specialist constellation without changing source data',()=>{
 assert.ok(Math.abs(rotateSkyPoint({x:1,y:0},{x:0,y:0},Math.PI/2).y-1)<1e-9);
 for(const branch of [null,'STE','GTE','HWR','TRE','CTM']){
  const map=createSkyMap(branch),before=JSON.stringify(map);
  const groups=[...map.charts.map(c=>({...c,courses:map.courses.filter(course=>!course.specialization&&course.term===c.term)})),...(map.branchChart?[{chart:map.branchChart,label:map.branchLabel,courses:map.courses.filter(c=>c.specialization)}]:[])];
  for(const group of groups){const pose=rotatedCluster(group.chart,map.positions,group.courses,group.label,.05);
   for(const c of group.courses){const p=pose.positions[c.id],anchor=pose.vertices[p.anchorIndex];assert.equal(p.x+NODE_GROUND_X,anchor.x);assert.equal(p.y+NODE_GROUND_Y,anchor.y);assert.equal(p.perspective,map.positions[c.id].perspective);}
   const [a,b]=group.chart.edges[0],distance=vertices=>Math.hypot(vertices[a].x-vertices[b].x,vertices[a].y-vertices[b].y);assert.ok(Math.abs(distance(pose.vertices)-distance(group.chart.vertices))<1e-8);
  }
  assert.equal(JSON.stringify(map),before);
 }
});
test('rotation updates visible and clickable paths together, pauses interaction, and honors reduced motion',async()=>{
 const map=createSkyMap(),cluster=map.charts[0],courses=map.courses.filter(c=>c.term===1),nodes=courses.map(c=>`<button class="course-node" data-course="${c.id}" style="left:${map.positions[c.id].x}px;top:${map.positions[c.id].y}px"></button>`).join('');
 const dom=new JSDOM(`<button id="rotate"></button><section id="map-page"><div id="map">${drawConstellation(cluster.chart)}<div data-term="1"></div>${nodes}<svg class="graph-lines"></svg></div></section><dialog></dialog>`,{pretendToBeVisual:true,url:'https://road.test/'}),win=dom.window,doc=win.document,viewport=doc.querySelector('#map'),button=doc.querySelector('#rotate');
 let reduced=false,preference;win.matchMedia=()=>({get matches(){return reduced;},addEventListener:(event,fn)=>{preference=fn;},removeEventListener:()=>{}});
 let scheduled=null;const rotation=attachConstellationRotation(viewport,button,{requestFrame:fn=>{scheduled=fn;return 1;},cancelFrame:()=>{scheduled=null;}});
 // Keep a small graph with a dependency joining these two stars for this runtime test.
 const [a,b]=courses.slice(0,2);const localMap={...map,courses:[{...a,hardPrerequisites:[],softPrerequisites:[],corequisites:[]},{...b,hardPrerequisites:[a.id],softPrerequisites:[],corequisites:[]}],charts:[cluster]};
 doc.querySelector('.graph-lines').innerHTML='<g class="thread-shadows"><path/></g><path class="connection-line"/><path class="connection-hit"/>';
 const step=time=>{assert.ok(scheduled);const fn=scheduled;scheduled=null;fn(time);};
 try{
  rotation.setMap(localMap);step(100);step(200);
  const node=doc.querySelector(`[data-course="${a.id}"]`),before=node.style.left;assert.notEqual(before,map.positions[a.id].x+'px');
  const d=doc.querySelector('.connection-line').getAttribute('d');assert.equal(doc.querySelector('.connection-hit').getAttribute('d'),d);assert.equal(doc.querySelector('.thread-shadows path').getAttribute('d'),d);
  assert.ok(d.startsWith(`M ${parseFloat(node.style.left)+NODE_GROUND_X} ${parseFloat(node.style.top)+NODE_GROUND_Y}`));
  node.dispatchEvent(new win.Event('pointerover',{bubbles:true}));assert.equal(scheduled,null);assert.equal(node.style.left,before);viewport.dispatchEvent(new win.Event('pointerleave'));assert.ok(scheduled);
  viewport.dispatchEvent(new win.Event('pointerdown'));assert.equal(scheduled,null);win.dispatchEvent(new win.Event('pointerup'));assert.ok(scheduled);
  viewport.classList.add('zooming');await Promise.resolve();assert.equal(scheduled,null);
  viewport.classList.remove('zooming');await Promise.resolve();assert.ok(scheduled);
  button.click();assert.equal(scheduled,null);assert.equal(button.getAttribute('aria-pressed'),'false');button.click();assert.ok(scheduled);
  doc.querySelector('dialog').setAttribute('open','');await Promise.resolve();assert.equal(scheduled,null);doc.querySelector('dialog').removeAttribute('open');await Promise.resolve();assert.ok(scheduled);
  reduced=true;preference();assert.equal(scheduled,null);assert.equal(button.disabled,true);assert.equal(node.style.left,map.positions[a.id].x+'px');assert.equal(win.localStorage.length,0);
 }finally{rotation.destroy();win.close();}
});
