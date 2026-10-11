import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
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
 await t.test('onboarding has no required specialization and branch previews never save progress',()=>{
  assert.equal($('#path-dialog').open,false);assert.equal($('#commitment-banner').textContent,'');
  assert.match($('#path-card').textContent,/Undecided/);
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
  for(const branch of ['STE','GTE','HWR','TRE','CTM']){click(`.branch-card[data-branch="${branch}"]`);assert.match($('#map-mode').textContent,/PREVIEW/);click('.course-node');assert.match($('#course-card').textContent,/Preview only/);assert.equal($('#course-card [data-academic]'),null);}
  assert.equal(localStorage.getItem(STORAGE_KEY),null);
 });
 await t.test('map year controls browse only and explicit exploration prevents shared progress',()=>{
  click('[data-year="3"]');assert.equal(localStorage.getItem(STORAGE_KEY),null);assert.match($('#traveler-year').textContent,/Year 1/);
  click('[data-year="1"]');click('[data-course="FNDMATH"]');click('[data-academic="ACTIVE"]');assert.equal(saved().academicRecords.FNDMATH.status,'ACTIVE');
  const before=localStorage.getItem(STORAGE_KEY);click('#explore-toggle');assert.equal($('#course-card [data-academic]'),null);assert.match($('#course-card').textContent,/Preview only/);
  click('.branch-card[data-branch="STE"]');click('.course-node');assert.equal(localStorage.getItem(STORAGE_KEY),before);
  click('#explore-toggle');click('[data-year="1"]');click('[data-course="FNDMATH"]');click('[data-academic="COMPLETED"]');assert.equal(saved().academicRecords.FNDMATH.status,'COMPLETED');
 });
 await t.test('actual Year 3 standing reveals milestone and confirmation creates a self-reported active path',()=>{
  click('[data-page="journal"]');$('#academic-year').value='3';$('#academic-year').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(saved().academicYear,3);assert.match($('#commitment-banner').textContent,/Choose your calling/);
  click('[data-page="map"]');click('#commitment-banner [data-action="confirm"]');assert.equal($('#path-dialog').open,true);
  assert.match($('#path-dialog').textContent,/not university-verified/);
  $('#path-dialog input[value="STE"]').checked=true;$('#acceptance-check').checked=true;$('#path-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('#path-dialog').open,false);assert.equal(saved().specializationProgression.selectedSpecialization,'STE');assert.equal(saved().specializationProgression.confirmationMethod,'SELF_REPORTED');
  assert.match($('#path-card').textContent,/STE · Confirmed/);assert.ok($('.branch-card[data-branch="STE"]').classList.contains('current'));assert.equal($('#commitment-banner').textContent,'');
  const before=localStorage.getItem(STORAGE_KEY);click('.branch-card[data-branch="GTE"]');click('.course-node');assert.equal($('#course-card [data-academic]'),null);assert.equal(localStorage.getItem(STORAGE_KEY),before);
 });
 await t.test('separate confirmed transfer retains academic records and recalculates active branch',()=>{
  click('#path-card [data-action="change"]');assert.equal($('#path-dialog').open,true);assert.equal($('#transfer-reason').required,true);
  $('#path-dialog input[value="CTM"]').checked=true;$('#transfer-reason').value='Accepted academic transfer';$('#acceptance-check').checked=true;$('#path-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(saved().specializationProgression.selectedSpecialization,'CTM');assert.equal(saved().specializationProgression.previousSpecializationHistory.length,1);assert.equal(saved().academicRecords.FNDMATH.status,'COMPLETED');assert.ok($('.branch-card[data-branch="CTM"]').classList.contains('current'));assert.match($('#map-mode').textContent,/ACTIVE/);
  click('[data-page="gate"]');assert.match($('#gate-page').textContent,/Unselected specialization branches never block/);assert.ok($('#gate-page button').disabled);assert.match($('#gate-page').textContent,/LOCKED UNTIL CIVINCO/);
 });
 dom.window.close();
});
