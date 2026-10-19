import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {CIVINCO_DOMAINS,CELE_DOMAINS} from '../src/curriculum.mjs';
import {newProgress,requiredCourses,confirmSpecialization,civincoReviewStatus} from '../src/progression.mjs';
import {renderCivincoReview} from '../src/civinco-review.mjs';
import {STORAGE_KEY} from '../src/storage.mjs';
function ready(){const p=confirmSpecialization({...newProgress(),academicYear:4},'STE',{confirmed:true});for(const c of requiredCourses(p))p.academicRecords[c.id]={status:'COMPLETED',takenInTerm:c.term,events:[]};return p;}
test('CIVINCO uses MSTE / PSAD with construction / HGE and remains separate from CELE MSTC / PSAD / HGE',()=>{
 assert.deepEqual(CIVINCO_DOMAINS,['MSTE','PSAD','HGE']);assert.deepEqual(CELE_DOMAINS,['MSTC','PSAD','HGE']);
 const p=ready(),before=structuredClone(p),dom=new JSDOM(renderCivincoReview(p,{domain:'PSAD'})),doc=dom.window.document;
 assert.equal(doc.querySelector('#civinco-area-title').textContent,'PSAD');assert.match(doc.querySelector('.review-construction').textContent,/Construction.*PSAD/);
 assert.equal(doc.querySelectorAll('[data-civinco-domain]').length,3);assert.match(doc.body.textContent,/0 review sets/);assert.doesNotMatch(doc.body.textContent,/Hardmode|unlock.*CELE|Passed/);assert.deepEqual(p,before);dom.window.close();
 const locked=new JSDOM(renderCivincoReview(newProgress()));assert.equal(locked.window.document.querySelector('[data-civinco-domain]'),null);assert.ok(locked.window.document.querySelector('[data-civinco-enter]').disabled);locked.window.close();
});
test('actual portal enters the review dimension, switches areas and returns to the map without changing saved records',async()=>{
 const dom=new JSDOM(await readFile(new URL('../src/index.html',import.meta.url),'utf8'),{url:'https://review.test/',pretendToBeVisual:true}),w=dom.window;
 const names=['document','window','localStorage','ResizeObserver','requestAnimationFrame','FormData'],previous=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{document:w.document,window:w,localStorage:w.localStorage,ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),FormData:w.FormData});
 w.scrollTo=()=>{};w.HTMLElement.prototype.getBoundingClientRect=()=>({width:800,height:500,left:0,top:0});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const p=ready();p.integrationAssessments=[{passed:true,attemptId:'old-assessment',at:'2026-10-11',specializationAtAttempt:'STE'}];w.localStorage.setItem(STORAGE_KEY,JSON.stringify(p));const before=w.localStorage.getItem(STORAGE_KEY),$=s=>w.document.querySelector(s),click=s=>$(s).click();
 try{
  await import('../src/app.js?civinco-review-regression');assert.equal(civincoReviewStatus(p).hardmodeUnlocked,false);assert.match($('.civinco-portal').textContent,/Enter CIVINCO review/);
  click('#expand-map');click('.civinco-portal');assert.equal(w.document.body.classList.contains('tree-expanded'),false);assert.equal($('.rail').inert,false);
  assert.equal($('#gate-page').dataset.civincoState,'review');assert.equal(w.document.body.classList.contains('in-civinco'),true);assert.equal(w.document.activeElement,$('#civinco-title'));assert.equal($('#map-page').classList.contains('hidden'),true);
  click('[data-civinco-domain="PSAD"]');assert.equal($('#civinco-area-title').textContent,'PSAD');assert.match($('.review-construction').textContent,/Construction/);assert.equal(w.document.activeElement,$('[data-civinco-domain="PSAD"]'));
  click('[data-civinco-domain="HGE"]');assert.equal($('#civinco-area-title').textContent,'HGE');assert.equal($('.review-construction'),null);
  click('#gate-page [data-page="map"]');assert.equal(w.document.body.classList.contains('in-civinco'),false);assert.equal($('#map-page').classList.contains('hidden'),false);assert.equal(w.localStorage.getItem(STORAGE_KEY),before);
 }finally{dom.window.close();for(const name of names){if(previous[name]===undefined)delete globalThis[name];else globalThis[name]=previous[name];}}
});
