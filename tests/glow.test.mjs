import test from 'node:test';
import assert from 'node:assert/strict';
import {drawConstellation,projectConstellation,starBadge} from '../src/sky-layout.mjs';
import {JSDOM} from 'jsdom';
import {createSkyMap} from '../src/map-curriculum.mjs';
import {createOrbitLayout} from '../src/orbit-layout.mjs';
import {createMobileScene} from '../src/mobile-sky.mjs';
test('stars have no circular aura; only full academic completion brightens the whole constellation',()=>{
 assert.ok(!starBadge().includes('star-aura'));assert.ok(starBadge().includes('star-facet-light'));
 const chart=projectConstellation('Ori',{x:0,y:0,width:100,height:100});
 const level=opts=>Number(drawConstellation(chart,opts).match(/--constellation-brightness:([\d.]+)/)[1]);
 const faint=level({total:4}),active=level({total:4,activated:4}),complete=level({total:4,completed:1}),max=level({total:4,completed:4});
 assert.equal(faint,.3);assert.equal(active,faint);assert.equal(complete,faint);assert.equal(max,.64);
 assert.match(drawConstellation(chart,{total:4,activated:1,completed:2}),/data-lit-courses="3" data-completed-courses="2"/);
});
test('partial and mixed activation retain local segments; full completion reveals the hologram without thick local overlays',()=>{
 const chart=projectConstellation('Ori',{x:0,y:0,width:100,height:100}),lights=[{anchor:0,strength:1}];
 for(const counts of [{total:0},{total:4,activated:4},{total:4,completed:3,activated:1},{total:4,completed:3}]){
  const dom=new JSDOM(drawConstellation(chart,{...counts,lights}));
  assert.equal(dom.window.document.querySelector('.constellation-complete'),null);assert.equal(dom.window.document.querySelector('.constellation-hologram'),null);assert.ok(dom.window.document.querySelector('.local-light-segment'));dom.window.close();
 }
 const dom=new JSDOM(drawConstellation(chart,{total:4,completed:4,lights})),doc=dom.window.document;
 assert.ok(doc.querySelector('.constellation-complete'));assert.equal(doc.querySelector('.local-light-segment'),null);
 assert.equal(doc.querySelectorAll('.hologram-wire polyline').length,chart.paths.length);assert.equal(doc.querySelectorAll('.hologram-glint polyline[pathLength="100"]').length,chart.paths.length);
 assert.equal(doc.querySelector('svg').getAttribute('aria-hidden'),'true');assert.equal(doc.querySelectorAll('button,a,filter,animate').length,0);dom.window.close();
});
test('mobile completion lighting is per constellation and previews, active or failed subjects cannot unlock it',()=>{
 const map=createOrbitLayout(createSkyMap('STE')),first=map.charts[0],ids=new Set(map.courses.filter(c=>!c.specialization&&c.term===first.term).map(c=>c.id)),one=[...ids][0];
 for(const state of ['active-course','preview','locked']){
  const scene=createMobileScene(map,{getState:c=>ids.has(c.id)?c.id===one?state:'completed':'locked'});
  assert.equal(scene.charts[0].lighting.complete,false);assert.equal(scene.charts[0].lighting.brightness,.3);assert.ok(scene.charts[0].lights.length);
 }
 const before=JSON.stringify(map),scene=createMobileScene(map,{getState:c=>ids.has(c.id)?'completed':'locked'});
 assert.equal(scene.charts[0].lighting.complete,true);assert.equal(scene.charts[0].lighting.brightness,.64);assert.equal(scene.charts[0].lights.length,0);assert.ok(scene.charts.slice(1).every(c=>!c.lighting.complete));assert.equal(JSON.stringify(map),before);
 const branch=createMobileScene(map,{getState:c=>c.specialization==='STE'?'completed':'locked'});
 assert.equal(branch.charts.at(-1).lighting.complete,true);assert.ok(branch.charts.slice(0,-1).every(c=>!c.lighting.complete));
});
