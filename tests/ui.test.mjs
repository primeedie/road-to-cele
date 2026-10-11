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
 await t.test('all years share one sky and year navigation moves without filtering or saving',()=>{
  const total=document.querySelectorAll('.course-node').length;
  assert.ok(total>60);
  for(const id of ['FNDMATH','ENGMEC1','CEGEOEN','CEFOUND'])assert.ok($(`[data-course="${id}"]`));
  click('[data-year="4"]');
  assert.equal(document.querySelectorAll('.course-node').length,total);
  assert.ok($('#world').classList.contains('navigation-motion'));
  const heading=$('.term-label[data-term="10"]');
  assert.match(heading.textContent,/Year IV.*Term 10/);
  assert.equal($('#world').style.transform,`translate(12px,${32-parseFloat(heading.style.top)}px) scale(1)`);
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
  click('[data-year="1"]');
 });
 await t.test('Roman numeral course chapters are inspectable placeholders with keyboard navigation',()=>{
  click('[data-course="FNDMATH"]');
  assert.equal($('#course-card').open,true);
  assert.equal(document.querySelectorAll('#course-card [role="tab"]').length,4);
  assert.match($('#course-section').textContent,/official course description/);
  for(const [section,title] of [[1,'Topic rundown'],[2,'Skills for the future'],[3,'Mastery quiz']]){
   click(`[data-course-section="${section}"]`);
   assert.equal($('#course-card [aria-selected="true"]').dataset.courseSection,String(section));
   assert.match($('.dossier-section-heading').textContent,new RegExp(title));
   assert.equal(localStorage.getItem(STORAGE_KEY),null);
  }
  assert.ok($('#course-section button').disabled);
  $('#course-tab-3').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));
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
  click('[data-year="1"]');click('[data-course="FNDMATH"]');click('[data-academic="ACTIVE"]');assert.equal(saved().academicRecords.FNDMATH.status,'ACTIVE');
  const before=localStorage.getItem(STORAGE_KEY);click('#explore-toggle');assert.equal($('#course-card [data-academic]'),null);assert.match($('#course-card').textContent,/Preview only/);
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
  assert.match($('#traveler-year').textContent,/Year 1/);
  assert.match($('#gate-page').textContent,/LOCKED UNTIL CIVINCO/);
  assert.equal(document.activeElement,$('#reset-progress'));
 });
 dom.window.close();
});
