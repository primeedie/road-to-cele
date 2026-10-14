import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {localLightSegments,drawConstellation} from '../src/sky-layout.mjs';
import {attachOverviewTooltip} from '../src/overview-tooltip.mjs';
import {attachComets} from '../src/comets.mjs';
import {civincoPortalMarkup} from '../src/civinco-portal.mjs';
import {createOrbitLayout,orbitSceneBounds} from '../src/orbit-layout.mjs';
import {createSkyMap} from '../src/map-curriculum.mjs';
import {renderCoursePanel} from '../src/course-panel.mjs';
import {newProgress} from '../src/progression.mjs';
import {COURSES} from '../src/curriculum.mjs';

test('nearby light follows incident edges only, fades out at their midpoint and deduplicates shared edges',()=>{
 const chart={id:'Ori',vertices:[{x:0,y:0},{x:1000,y:0},{x:1200,y:200},{x:1500,y:300}],edges:[[0,1],[1,0],[1,2],[2,3]],paths:[[0,1,2,3]]};
 assert.deepEqual(localLightSegments(chart,[]),[]);
 assert.deepEqual(localLightSegments(chart,[{anchor:0,strength:.7}]),[{from:0,to:1,start:.7,end:0}]);
 const light=localLightSegments(chart,[{anchor:0,strength:.7},{anchor:1,strength:1}]);
 assert.equal(light.length,2);assert.equal(light[0].end,1);assert.equal(light[1].end,0);
 const dom=new JSDOM(drawConstellation(chart,{lights:[{anchor:0,strength:.7}],scope:'FNDMATH'})),doc=dom.window.document;
 assert.equal(doc.querySelectorAll('.local-light-segment').length,1);
 const stops=[...doc.querySelectorAll('stop')];assert.equal(+stops[1].getAttribute('offset'),.5);assert.equal(+stops[1].getAttribute('stop-opacity'),0);assert.equal(+stops[2].getAttribute('offset'),.5);assert.equal(+stops[2].getAttribute('stop-opacity'),0);
 assert.notEqual(doc.querySelector('linearGradient').id,new JSDOM(drawConstellation(chart,{lights:[{anchor:0,strength:1}],scope:'STERQUA'})).window.document.querySelector('linearGradient').id);
 dom.window.close();
});

test('overview hover and keyboard cards are readable, escaped, clamped, and disappear above 20% or during interaction',()=>{
 const dom=new JSDOM('<div id="map"><button class="course-node active-course" data-course="TEST"><svg></svg></button></div><dialog></dialog>',{pretendToBeVisual:true}),win=dom.window,doc=win.document,viewport=doc.querySelector('#map'),node=doc.querySelector('button');
 viewport.getBoundingClientRect=()=>({left:20,top:30,width:400,height:260});node.getBoundingClientRect=()=>({left:370,top:250,width:20,height:20});
 let scale=.2,frame;const api=attachOverviewTooltip(viewport,{getCourse:()=>({id:'TEST',title:'<script>unsafe</script>',year:2,term:5}),getScale:()=>scale,requestFrame:fn=>{frame=fn;return 1;},cancelFrame:()=>{frame=null;}}),card=doc.querySelector('[role="tooltip"]');
 const hover=()=>node.querySelector('svg').dispatchEvent(new win.MouseEvent('pointerover',{bubbles:true,clientX:390,clientY:280}));
 try{
  hover();frame();assert.equal(card.hidden,false);assert.match(card.textContent,/Year 2 · Term 2 · Active/);assert.equal(card.querySelector('script'),null);assert.equal(node.getAttribute('aria-describedby'),card.id);
  assert.ok(parseFloat(card.style.left)<=108);assert.ok(parseFloat(card.style.top)>=12);
  scale=.201;api.refresh();assert.equal(card.hidden,true);assert.equal(node.hasAttribute('aria-describedby'),false);
  scale=.1;node.dispatchEvent(new win.FocusEvent('focusin',{bubbles:true}));frame();assert.equal(card.hidden,false);
  viewport.classList.add('zooming');api.refresh();assert.equal(card.hidden,true);viewport.classList.remove('zooming');api.refresh();assert.equal(card.hidden,false);
  viewport.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));api.refresh();assert.equal(card.hidden,true);
  viewport.dispatchEvent(new win.Event('pointerleave'));hover();assert.equal(card.hidden,false);
  doc.querySelector('dialog').open=true;api.refresh();assert.equal(card.hidden,true);
 }finally{api.destroy();win.close();}
});

test('CIVINCO portal occupies a bounded unused column and its actions only open the existing gate',()=>{
 for(const branch of [null,'STE','GTE','HWR','TRE','CTM']){
  const map=createOrbitLayout(createSkyMap(branch)),p=map.portal.bounds,b=orbitSceneBounds(map);
  const finalTerm=map.charts.find(c=>c.term===11).chart.orbit.bounds;
  assert.ok(map.portal.width>=1800&&map.portal.height>=1200);assert.ok(p.minX-finalTerm.maxX>=450);
  assert.ok(p.minY-map.charts.find(c=>c.term===9).chart.orbit.bounds.maxY>=60);
  assert.ok(p.minX>=b.minX&&p.maxX<=b.maxX&&p.minY>=b.minY&&p.maxY<=b.maxY);
  for(const chart of [...map.charts.map(c=>c.chart),...(map.branchChart?[map.branchChart]:[])]){const c=chart.orbit.bounds;assert.ok(p.maxX<=c.minX||p.minX>=c.maxX||p.maxY<=c.minY||p.minY>=c.maxY);}
  for(const [gate,state] of [[{eligible:false,cleared:false},'locked'],[{eligible:true,cleared:false},'ready'],[{eligible:false,cleared:true},'cleared']]){
   const dom=new JSDOM(civincoPortalMarkup(map.portal,gate)),button=dom.window.document.querySelector('button');assert.equal(button.dataset.page,'gate');assert.equal(button.dataset.gateState,state);assert.equal(button.hasAttribute('data-academic'),false);dom.window.close();
  }
 }
});

test('comets are rare, singular, and stop for zoom, dialogs, background tabs and reduced motion',async()=>{
 const dom=new JSDOM('<section id="map-page"><div id="map"></div></section><dialog></dialog>',{pretendToBeVisual:true,url:'https://road.test'}),win=dom.window,doc=win.document,viewport=doc.querySelector('#map');
 let reduced=false,preference,next=0;const timers=new Map();win.matchMedia=()=>({get matches(){return reduced;},addEventListener:(_,fn)=>preference=fn,removeEventListener:()=>{}});
 const api=attachComets(viewport,{random:()=>.5,setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer:id=>timers.delete(id)});
 const fire=()=>{const [id,{fn,ms}]=timers.entries().next().value;timers.delete(id);fn();return ms;};
 try{
  assert.equal(timers.size,1);assert.equal(fire(),57500);assert.equal(viewport.querySelectorAll('.sky-comet').length,1);assert.equal(timers.size,1);assert.equal(fire(),4200);assert.equal(viewport.querySelector('.sky-comet'),null);
  viewport.classList.add('zooming');await Promise.resolve();assert.equal(timers.size,0);viewport.classList.remove('zooming');await Promise.resolve();assert.equal(timers.size,1);
  fire();doc.querySelector('dialog').open=true;await Promise.resolve();assert.equal(viewport.querySelector('.sky-comet'),null);assert.equal(timers.size,0);doc.querySelector('dialog').open=false;await Promise.resolve();
  win.dispatchEvent(new win.Event('blur'));assert.equal(timers.size,0);win.dispatchEvent(new win.Event('focus'));assert.equal(timers.size,1);
  reduced=true;preference();assert.equal(timers.size,0);reduced=false;preference();assert.equal(timers.size,1);
  doc.querySelector('#map-page').classList.add('hidden');await Promise.resolve();assert.equal(timers.size,0);assert.equal(win.localStorage.length,0);
 }finally{api.destroy();assert.equal(timers.size,0);win.close();}
});

test('future skills prepare lab evidence and lecture callbacks without inventing course coverage',()=>{
 const lab=COURSES.find(c=>c.courseKind==='LAB'),lecture=COURSES.find(c=>c.courseKind!=='LAB');
 const p=newProgress();p.academicRecords[lab.id]={status:'ACTIVE'};p.academicRecords[lecture.id]={status:'ACTIVE'};
 assert.match(renderCoursePanel(p,lab,{section:2}),/Evidence and resume wording/);
 assert.match(renderCoursePanel(p,lecture,{section:2}),/This topic will be used and recalled in/);
 assert.match(renderCoursePanel(p,lecture,{section:1}),/Syllabus-based overview/);
});
