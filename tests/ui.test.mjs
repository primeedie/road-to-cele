import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { newProgress } from '../src/progression.mjs';
import { COURSES } from '../src/curriculum.mjs';
import { progressSummary } from '../src/progression.mjs';
import { STORAGE_KEY } from '../src/storage.mjs';
test('actual website interactions keep exploration separate from academic progression',async t=>{
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://atlas.test/',pretendToBeVisual:true});
 const w=dom.window;Object.assign(globalThis,{document:w.document,window:w,localStorage:w.localStorage,ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn()});
 w.scrollTo=()=>{};
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:800,height:500,left:0,top:0});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 // Node's native FormData does not accept an HTML form; use the DOM implementation.
 globalThis.FormData=w.FormData;
 const $=s=>document.querySelector(s),click=s=>$(s).click();
 await import('../src/app.js');
 const saved=()=>JSON.parse(localStorage.getItem(STORAGE_KEY));
 await t.test('map portal opens gate requirements without granting completion or changing records',()=>{
  assert.equal($('.civinco-portal').dataset.gateState,'locked');click('.civinco-portal');
  assert.equal($('#gate-page').classList.contains('hidden'),false);assert.ok($('#gate-page button').disabled);
  assert.equal(localStorage.getItem(STORAGE_KEY),null);click('[data-page="map"]');
 });
 await t.test('expanded tree retains browsing state, protects modal Escape, and returns without changing progress',()=>{
  const pose=$('#world').style.transform,total=document.querySelectorAll('.course-node').length;
  click('#expand-map');assert.ok($('.map-panel').classList.contains('map-expanded'));
  assert.equal($('#expand-map').getAttribute('aria-pressed'),'true');assert.equal($('.rail').inert,true);
  assert.equal($('#world').style.transform,pose);assert.equal(document.querySelectorAll('.course-node').length,total);
  click('[data-course="FNDMATH"]');assert.equal($('#course-card').open,true);
  document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.ok($('.map-panel').classList.contains('map-expanded'));
  $('#course-card').dispatchEvent(new w.Event('cancel',{cancelable:true}));
  document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal($('.map-panel').classList.contains('map-expanded'),false);assert.equal($('.rail').inert,false);
  assert.equal($('#expand-map').getAttribute('aria-pressed'),'false');assert.equal(document.activeElement,$('#expand-map'));
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
 });
 await t.test('specializations begin collapsed and browsing the dropdown never saves progress',()=>{
  assert.equal($('#specialization-menu').open,false);
  $('#specialization-menu summary').click();assert.equal($('#specialization-menu').open,true);
  assert.equal(document.querySelectorAll('#branch-cards .branch-card').length,5);
  click('.branch-card[data-branch="STE"]');assert.equal($('#specialization-menu').open,false);assert.match($('#specialization-selection').textContent,/STE.*Preview/);
  assert.equal(localStorage.getItem(STORAGE_KEY),null);click('.branch-card[data-branch="STE"]');
 });
 await t.test('wardrobe choices persist cosmetics without changing academic progress or mastering a course',()=>{
  click('#companion-button');assert.equal($('#wardrobe-dialog').open,true);
  assert.ok($('#wardrobe-dialog [data-frame="first-light"]').disabled);
  click('#wardrobe-dialog [data-avatar="fox"]');assert.equal(saved().cosmetics.avatar,'fox');assert.deepEqual(saved().academicRecords,{});assert.deepEqual(saved().masteryRecords,{});
  assert.equal($('#wardrobe-dialog [data-avatar="fox"]').getAttribute('aria-pressed'),'true');
  click('#wardrobe-dialog [data-avatar="owl"]');click('[data-action="close-wardrobe"]');assert.equal($('#wardrobe-dialog').open,false);
  // Restore isolated test storage so subsequent preview checks start from a pristine journey.
  localStorage.removeItem(STORAGE_KEY);
 });
 await t.test('all years share one sky and year navigation moves without filtering or saving',()=>{
  const total=document.querySelectorAll('.course-node').length;
  assert.ok(total>60);
  for(const id of ['FNDMATH','ENGMEC1','CEGEOEN','CEFOUND'])assert.ok($(`[data-course="${id}"]`));
  click('[data-year="4"]');
  assert.equal(document.querySelectorAll('.course-node').length,total);
  assert.ok($('#world').classList.contains('navigation-motion'));
  const heading=$('.term-label[data-term="10"]');
  assert.match(heading.textContent,/Year IV.*Term 10/);
  const pose=$('#world').style.transform.match(/translate\(([-.\d]+)px,([-.\d]+)px\) scale\(([-.\d]+)\)/),camera={x:+pose[1],y:+pose[2],scale:+pose[3]};
  assert.ok(COURSES.filter(c=>c.year===4&&!c.specialization).some(c=>{const node=$(`[data-course="${c.id}"]`),x=(parseFloat(node.style.left)+125)*camera.scale+camera.x,y=(parseFloat(node.style.top)+176)*camera.scale+camera.y;return x>=0&&x<=800&&y>=0&&y<=500;}));
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
  click('[data-year="1"]');
 });
 await t.test('minimal sidebar opens specialist courses from the map and year controls remain usable',()=>{
  assert.ok($('.atlas-sidebar .year-tabs'));assert.ok($('.atlas-sidebar #specialization-menu'));
  assert.equal($('.atlas-course-index'),null);assert.equal($('#course-search'),null);
  const before=localStorage.getItem(STORAGE_KEY);
  click('.branch-card[data-branch="STE"]');click('[data-course="STERQUA"]');
  assert.equal($('#course-card').open,true);assert.ok($('.workspace').classList.contains('inspector-open'));assert.match($('#dossier-title').textContent,/Earthquake Engineering/);assert.match($('#course-card').textContent,/Preview only/);
  click('[data-year="2"]');assert.equal($('#course-card').open,false);assert.equal($('.workspace').classList.contains('inspector-open'),false);assert.equal(localStorage.getItem(STORAGE_KEY),before);
  click('.branch-card[data-branch="STE"]');click('[data-year="1"]');
 });
 await t.test('real map gestures stay bounded and overview zoom increases gradually without changing records',()=>{
  const viewport=$('#map-viewport'),captures=new Map();
  w.Element.prototype.setPointerCapture=function(id){captures.set(id,this);};
  w.Element.prototype.hasPointerCapture=function(id){return captures.get(id)===this;};
  w.Element.prototype.releasePointerCapture=function(id){captures.delete(id);};
  const pointer=(type,x,y)=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true}});viewport.dispatchEvent(event);};
  const pose=()=>{const match=$('#world').style.transform.match(/translate\(([-.\d]+)px,([-.\d]+)px\) scale\(([-.\d]+)\)/);return {x:+match[1],y:+match[2],scale:+match[3]};};
  for(const x of [-100000,100000])for(const y of [-100000,100000]){
   pointer('pointerdown',100,100);pointer('pointermove',x,y);pointer('pointerup',x,y);
   const camera=pose();
   const courseVisible=[...document.querySelectorAll('.course-node')].some(n=>{const sx=(parseFloat(n.style.left)+125)*camera.scale+camera.x,sy=(parseFloat(n.style.top)+176)*camera.scale+camera.y;return sx>-110&&sx<910&&sy>-80&&sy<650;});
   const portal=$('.civinco-portal'),px=parseFloat(portal.style.left),py=parseFloat(portal.style.top),pw=parseFloat(portal.style.width);
   const gateVisible=(px+pw*.85)*camera.scale+camera.x>0&&(px+pw*.15)*camera.scale+camera.x<800&&(py+1170)*camera.scale+camera.y>0&&(py+30)*camera.scale+camera.y<500;
   assert.ok(courseVisible||gateVisible,'Panning retains a course or the CIVINCO destination in view');
  }
  click('#fit-map');const fit=pose().scale;assert.ok(fit<.28);
  const originalFrame=w.requestAnimationFrame,originalCancel=w.cancelAnimationFrame,originalNow=w.performance.now;
  let frame=null,clock=0;
  w.requestAnimationFrame=fn=>{frame=fn;return 1;};w.cancelAnimationFrame=()=>{frame=null;};w.performance.now=()=>clock;
  const step=()=>{clock+=1000/144;if(frame){const fn=frame;frame=null;fn(clock);}};
  try{
   click('#zoom-in');assert.equal(pose().scale,fit);assert.ok(viewport.classList.contains('zooming'));
   step();assert.ok(pose().scale>fit&&pose().scale<fit*1.2);
   for(let i=0;i<400&&frame;i++)step();
   assert.ok(pose().scale>fit&&pose().scale<fit*1.3);assert.equal(viewport.classList.contains('zooming'),false);
   const beforeWheel=pose();viewport.dispatchEvent(new w.WheelEvent('wheel',{deltaY:-2,clientX:300,clientY:200,bubbles:true,cancelable:true}));
   assert.deepEqual(pose(),beforeWheel);step();assert.ok(pose().scale>beforeWheel.scale);
   pointer('pointerdown',300,200);assert.equal(viewport.classList.contains('zooming'),false);assert.equal(frame,null);pointer('pointerup',300,200);
  }finally{w.requestAnimationFrame=originalFrame;w.cancelAnimationFrame=originalCancel;w.performance.now=originalNow;}
  assert.equal(localStorage.getItem(STORAGE_KEY),null);assert.equal(captures.size,0);
  click('[data-year="1"]');
 });
 await t.test('Roman numeral course chapters are inspectable placeholders with keyboard navigation',()=>{
  click('[data-course="FNDMATH"]');
  assert.equal($('#course-card').open,true);
  assert.equal(document.querySelectorAll('#course-card [role="tab"]').length,5);
  assert.match($('#course-section').textContent,/official course description/);
  for(const [section,title] of [[1,'Topic rundown'],[2,'Skills for the future'],[3,'Grade calculator'],[4,'Mastery quiz']]){
   click(`[data-course-section="${section}"]`);
   assert.equal($('#course-card [aria-selected="true"]').dataset.courseSection,String(section));
   assert.match($('.dossier-section-heading').textContent,new RegExp(title));
   assert.equal(localStorage.getItem(STORAGE_KEY),null);
  }
  assert.ok($('#course-section button').disabled);
  $('#course-tab-4').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));
  assert.equal($('#course-tab-0').getAttribute('aria-selected'),'true');
  assert.equal(document.activeElement,$('#course-tab-0'));
  $('#course-card').dispatchEvent(new w.Event('cancel',{cancelable:true}));
  assert.equal($('#course-card').open,false);
  assert.equal($('#course-card').innerHTML,'');
  assert.equal(document.activeElement,$('[data-course="FNDMATH"]'));
 });
 await t.test('onboarding has no required specialization and branch previews never save progress',()=>{
  assert.equal($('#path-dialog').open,false);assert.equal($('#commitment-banner').textContent,'');
  assert.match($('#path-card').textContent,/Undecided/);
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
  for(const branch of ['STE','GTE','HWR','TRE','CTM']){click(`.branch-card[data-branch="${branch}"]`);assert.match($('#map-mode').textContent,/PREVIEW/);click(`[data-specialization="${branch}"]`);assert.match($('#course-card').textContent,/Preview only/);assert.equal($('#course-card [data-academic]'),null);}
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
 });
 await t.test('lab chapters end at grade calculator and keyboard navigation wraps within four tabs',()=>{
  click('[data-course="LBYPH1A"]');assert.equal(document.querySelectorAll('#course-card [role="tab"]').length,4);assert.equal($('#course-tab-4'),null);
  $('#course-tab-0').dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal($('#course-tab-3').getAttribute('aria-selected'),'true');assert.match($('#course-section').textContent,/laboratory grading scheme/);
  $('#course-tab-3').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal($('#course-tab-0').getAttribute('aria-selected'),'true');
  assert.equal(localStorage.getItem(STORAGE_KEY),null);click('[data-action="close-inspector"]');
 });
 await t.test('course details expose downstream H/S requirements and co-requisites from both sides without saving',()=>{
  click('[data-year="1"]');click('[data-course="FNDMATH"]');
  const future='[aria-label="Courses that require this course"]';
  assert.ok($(`${future} [data-related-course="CALENG1"][data-relation-type="H"]`));
  assert.ok($(`${future} [data-related-course="CESURVE"][data-relation-type="S"]`));
  click(`${future} [data-course-link="CALENG1"]`);
  assert.match($('#dossier-title').textContent,/Differential Calculus/);
  click('[data-action="close-inspector"]');click('[data-course="ENGCHEM"]');
  assert.ok($('[aria-label="Co-requisite courses"] [data-course-link="LBYCH1A"]'));
  click('[aria-label="Co-requisite courses"] [data-course-link="LBYCH1A"]');
  assert.ok($('[aria-label="Co-requisite courses"] [data-course-link="ENGCHEM"]'));
  click('[data-action="close-inspector"]');
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
  assert.equal($('#reset-progress').closest('.map-tools')!==null,true);
 });
 await t.test('one revealed specialization adds its nodes and paths without replacing shared stars',()=>{
  const sharedIds=COURSES.filter(c=>!c.specialization).map(c=>c.id);
  const sharedPosition=$('[data-course="FNDMATH"]').getAttribute('style');
  const value=$('#academic-progress').getAttribute('aria-valuenow'),total=$('#academic-progress').getAttribute('aria-valuemax'),fill=$('.journey-fill').style.width;
  for(const branch of ['STE','GTE','HWR','TRE','CTM']){
   click(`.branch-card[data-branch="${branch}"]`);
   const ids=[...document.querySelectorAll('.course-node')].map(n=>n.dataset.course);
   assert.equal(new Set(ids).size,ids.length);
   for(const id of sharedIds)assert.ok(ids.includes(id));
   const specialistIds=COURSES.filter(c=>c.specialization===branch).map(c=>c.id);
   assert.equal(ids.length,sharedIds.length+specialistIds.length);
   assert.deepEqual([...document.querySelectorAll('.specialization-node')].map(n=>n.dataset.course),specialistIds);
   assert.equal(document.querySelectorAll('.branch-card[aria-pressed="true"]').length,1);
   assert.equal($('[data-course="FNDMATH"]').getAttribute('style'),sharedPosition);
   const first=COURSES.find(c=>c.specialization===branch);
   for(const id of first.hardPrerequisites)assert.ok($(`[data-connection="${id}:${first.id}:H"]`));
   assert.equal($('#academic-progress').getAttribute('aria-valuenow'),value);
   assert.equal($('#academic-progress').getAttribute('aria-valuemax'),total);
   assert.equal($('.journey-fill').style.width,fill);
   assert.equal(localStorage.getItem(STORAGE_KEY),null);
  }
  click('[data-year="1"]');assert.equal(document.querySelectorAll('.specialization-node').length,4);
  click('.branch-card[data-branch="CTM"]');assert.equal(document.querySelectorAll('.specialization-node').length,0);
  assert.equal(document.querySelectorAll('.course-node').length,sharedIds.length);
 });
 await t.test('only an outside press and click dismiss the course popup',()=>{
  click('[data-year="1"]');click('[data-course="FNDMATH"]');
  const modal=$('#course-card'),pointer=(type,x,y)=>modal.dispatchEvent(new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y}));
  pointer('pointerdown',30,30);pointer('click',30,30);assert.equal(modal.open,true);
  pointer('pointerdown',30,30);pointer('click',900,30);assert.equal(modal.open,true);
  pointer('pointerdown',900,30);pointer('click',900,30);assert.equal(modal.open,false);
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
 });
 await t.test('clicking a prerequisite traces connected courses, supports keyboard selection and never records progress',()=>{
  const selector='[data-connection="FNDMATH:CALENG1:H"]';
  $(selector).focus();assert.equal(document.querySelectorAll('.connection-focused').length,1);
  assert.equal($('.connection-focused').dataset.edge,'FNDMATH:CALENG1:H');
  $('#fit-map').focus();assert.equal(document.querySelectorAll('.connection-focused').length,0);
  $(selector).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  assert.equal($('#connection-card').hidden,false);
  assert.match($('#connection-card').textContent,/Hard prerequisite/);
  assert.ok($('[data-course="CALENG2"]').classList.contains('path-member'));
  assert.ok($('[data-course="CEORIEN"]').classList.contains('path-muted'));
  click('#connection-card [data-course="CALENG1"]');
  assert.match($('#dossier-title').textContent,/Differential Calculus/);
  click('[data-action="close-inspector"]');click('[data-action="clear-connection"]');
  assert.equal($('#connection-card').hidden,true);
  $(selector).dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.equal($('#connection-card').hidden,false);
  document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal($('#connection-card').hidden,true);
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
 });
 await t.test('shared courses keep their academic access while another specialization is shown',()=>{
  const before=localStorage.getItem(STORAGE_KEY);
  if($('.branch-card[data-branch="STE"]').getAttribute('aria-pressed')!=='true')click('.branch-card[data-branch="STE"]');click('[data-course="FNDMATH"]');
  assert.doesNotMatch($('#course-card').textContent,/Preview only/);
  assert.equal($('#course-card [data-academic]').disabled,false);
  click('[data-action="close-inspector"]');assert.equal($('#course-card').innerHTML,'');
  assert.equal(localStorage.getItem(STORAGE_KEY),before);
 });
 await t.test('map year controls browse only and explicit exploration prevents shared progress',()=>{
  click('[data-year="3"]');assert.equal(localStorage.getItem(STORAGE_KEY),null);assert.match($('#traveler-year').textContent,/Year 1/);
  click('[data-year="1"]');click('[data-course="FNDMATH"]');
  const chart='.sky-outline[data-constellation="Ori"]';assert.equal($(chart).classList.contains('constellation-lit'),false);
  click('[data-academic="ACTIVE"]');assert.equal(saved().academicRecords.FNDMATH.status,'ACTIVE');
  assert.ok($('[data-course="FNDMATH"]').classList.contains('active-course'));
  assert.equal($(chart).classList.contains('constellation-lit'),true);assert.equal($(chart).dataset.litCourses,'1');
  assert.ok($(chart+' .local-light-segment'));assert.ok([...document.querySelectorAll(chart+' stop')].some(stop=>+stop.getAttribute('stop-opacity')===.7));
  const before=localStorage.getItem(STORAGE_KEY);click('#explore-toggle');assert.equal($('#course-card [data-academic]'),null);assert.match($('#course-card').textContent,/Preview only/);
  assert.equal(document.querySelectorAll('.local-light-segment').length,0);
  click('.branch-card[data-branch="STE"]');click('.course-node');assert.equal(localStorage.getItem(STORAGE_KEY),before);
  click('#explore-toggle');click('[data-year="1"]');click('[data-course="FNDMATH"]');click('[data-academic="COMPLETED"]');assert.equal(saved().academicRecords.FNDMATH.status,'COMPLETED');
  assert.match($('.completion-reward').textContent,/A new star in your sky/);
  assert.deepEqual(saved().masteryRecords,{});
  assert.equal($('#academic-progress').getAttribute('aria-valuenow'),'1');
  assert.equal($('#academic-progress').getAttribute('aria-valuemax'),String(COURSES.filter(c=>!c.specialization).length));
  assert.ok(parseFloat($('.journey-fill').style.width)>0);
  click('[data-action="close-inspector"]');assert.ok($('[data-course="FNDMATH"]').classList.contains('just-completed'));
  click('[data-course="FNDMATH"]');assert.equal($('.completion-reward'),null);
 });
 await t.test('actual Year 3 standing reveals milestone and confirmation creates a self-reported active path',()=>{
  click('[data-page="journal"]');$('#academic-year').value='3';$('#academic-year').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(saved().academicYear,3);assert.match($('#commitment-banner').textContent,/Choose your calling/);
  click('[data-page="map"]');click('#commitment-banner [data-action="confirm"]');assert.equal($('#path-dialog').open,true);
  assert.match($('#path-dialog').textContent,/not university-verified/);
  $('#path-dialog input[value="STE"]').checked=true;$('#acceptance-check').checked=true;$('#path-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('#path-dialog').open,false);assert.equal(saved().specializationProgression.selectedSpecialization,'STE');assert.equal(saved().specializationProgression.confirmationMethod,'SELF_REPORTED');
  assert.match($('#path-card').textContent,/STE · Confirmed/);assert.ok($('.branch-card[data-branch="STE"]').classList.contains('current'));assert.equal($('#commitment-banner').textContent,'');
  const expected=progressSummary(saved()).academic;assert.equal($('#academic-progress').getAttribute('aria-valuemax'),String(expected.total));
  const before=localStorage.getItem(STORAGE_KEY);click('.branch-card[data-branch="GTE"]');click('[data-specialization="GTE"]');assert.equal($('#course-card [data-academic]'),null);assert.equal(localStorage.getItem(STORAGE_KEY),before);
  assert.equal($('#academic-progress').getAttribute('aria-valuenow'),String(expected.complete));assert.equal($('#academic-progress').getAttribute('aria-valuemax'),String(expected.total));
 });
 await t.test('a transfer to the longer transportation path recalculates the meter without resetting records',()=>{
  const previousTotal=+$('#academic-progress').getAttribute('aria-valuemax');
  const academic=saved().academicRecords;
  click('#path-card [data-action="change"]');
  $('#path-dialog input[value="TRE"]').checked=true;$('#transfer-reason').value='Accepted transfer to Transportation';$('#acceptance-check').checked=true;$('#path-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(saved().specializationProgression.selectedSpecialization,'TRE');
  assert.deepEqual(saved().academicRecords,academic);
  assert.equal($('#academic-progress').getAttribute('aria-valuemax'),String(previousTotal+1));
  assert.equal($('#academic-progress').getAttribute('aria-valuenow'),'1');
  const before=localStorage.getItem(STORAGE_KEY),fill=$('.journey-fill').style.width;
  click('.branch-card[data-branch="CTM"]');
  assert.ok($('.branch-card[data-branch="TRE"]').classList.contains('current'));
  assert.equal($('#academic-progress').getAttribute('aria-valuemax'),String(previousTotal+1));
  assert.equal($('.journey-fill').style.width,fill);
  assert.equal(localStorage.getItem(STORAGE_KEY),before);
 });
 await t.test('separate confirmed transfer retains academic records and recalculates active branch',()=>{
  click('#path-card [data-action="change"]');assert.equal($('#path-dialog').open,true);assert.equal($('#transfer-reason').required,true);
  $('#path-dialog input[value="CTM"]').checked=true;$('#transfer-reason').value='Accepted academic transfer';$('#acceptance-check').checked=true;$('#path-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(saved().specializationProgression.selectedSpecialization,'CTM');assert.equal(saved().specializationProgression.previousSpecializationHistory.length,2);assert.equal(saved().academicRecords.FNDMATH.status,'COMPLETED');assert.ok($('.branch-card[data-branch="CTM"]').classList.contains('current'));assert.match($('#map-mode').textContent,/ACTIVE/);
  const a=progressSummary(saved()).academic;assert.equal($('#academic-progress').getAttribute('aria-valuenow'),String(a.complete));assert.equal($('#academic-progress').getAttribute('aria-valuemax'),String(a.total));
  click('[data-page="gate"]');assert.match($('#gate-page').textContent,/Unselected specialization branches never block/);assert.ok($('#gate-page button').disabled);assert.match($('#gate-page').textContent,/LOCKED UNTIL CIVINCO/);
 });
 await t.test('reset requires confirmation, preserves progress when canceled, and clears only the app record',()=>{
  const before=localStorage.getItem(STORAGE_KEY);
  localStorage.setItem('other-app.setting','keep this');
  click('[data-page="map"]');click('#reset-progress');
  assert.equal($('#reset-dialog').open,true);
  assert.equal(document.activeElement,$('#cancel-reset'));
  assert.equal(localStorage.getItem(STORAGE_KEY),before);
  click('#cancel-reset');assert.equal($('#reset-dialog').open,false);
  assert.equal(localStorage.getItem(STORAGE_KEY),before);
  assert.equal(document.activeElement,$('#reset-progress'));
  click('[data-page="journal"]');click('#journal-page [data-action="reset-progress"]');
  $('#reset-dialog').dispatchEvent(new w.Event('cancel',{cancelable:true}));
  assert.equal($('#reset-dialog').open,false);assert.equal(localStorage.getItem(STORAGE_KEY),before);
  click('#journal-page [data-action="reset-progress"]');click('[data-action="confirm-reset"]');
  assert.deepEqual(saved(),newProgress());
  assert.equal(localStorage.getItem('other-app.setting'),'keep this');
  assert.equal($('#reset-dialog').open,false);
  assert.equal($('#map-page').classList.contains('hidden'),false);
  assert.equal($('#academic-progress').getAttribute('aria-valuenow'),'0');
  assert.equal($('.journey-fill').style.width,'0%');
  assert.equal($('#explore-toggle').getAttribute('aria-pressed'),'false');
  assert.equal(document.querySelectorAll('.specialization-node').length,0);
  assert.equal(document.querySelectorAll('.branch-card.current').length,0);
  assert.equal($('#course-card').open,false);
  assert.equal($('#connection-card').hidden,true);
  assert.equal($('#commitment-banner').textContent,'');
  assert.equal(document.querySelectorAll('.constellation-lit').length,0);
  assert.match($('#traveler-year').textContent,/Year 1/);
  assert.match($('#gate-page').textContent,/LOCKED UNTIL CIVINCO/);
  assert.equal(document.activeElement,$('#reset-progress'));
 });
 dom.window.close();
});
