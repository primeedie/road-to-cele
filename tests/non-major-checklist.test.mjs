import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {nonMajorCourses,NON_MAJOR_COMMON} from '../src/non-major-courses.mjs';
import {setNonMajorRecord,setNonMajorBatch,nonMajorSummary,normalizeNonMajorRecords,renderNonMajorChecklist,attachNonMajorChecklist} from '../src/non-major-checklist.mjs';
import {newProgress,progressSummary,gateStatus} from '../src/progression.mjs';
import {hydrateProgress} from '../src/storage.mjs';
import {createAccountProgress} from '../src/account-progress.mjs';
import {createAdminWorkspace} from '../src/admin-mode.mjs';
test('source-backed common rows and batch-specific PE never mix; no prescribed term groups',()=>{
 assert.equal(NON_MAJOR_COMMON.length,27);
 for(const batch of [119,122,123,128]){const rows=nonMajorCourses(batch);assert.equal(rows.length,31);assert.equal(new Set(rows.map(c=>c.id)).size,31);assert.equal(rows.find(c=>c.id==='GEMATMW').units,3);assert.equal(rows.filter(c=>c.parenthesized).length,5);assert.ok(rows.every(c=>c.term===undefined&&c.year===undefined));assert.equal(rows.some(c=>c.id==='GEFTWEL'),batch<=122);assert.equal(rows.some(c=>c.id==='PE1CRDO'),batch>=123);}
 assert.equal(nonMajorCourses(null).length,27);
 const unknown=new JSDOM(renderNonMajorChecklist(newProgress()));assert.match(unknown.window.document.body.textContent,/Choose a batch to show/);assert.equal(unknown.window.document.querySelectorAll('tbody tr').length,27);unknown.window.close();
});
test('explicit taken status requires both dropdowns, persists partial edits, and preserves technical records and gates',()=>{
 const p=newProgress();p.academicRecords.FNDMATH={status:'COMPLETED',events:[{status:'COMPLETED'}]};p.quizAttempts=[{id:'previous'}];
 const before=structuredClone(p);assert.throws(()=>setNonMajorRecord(p,'GEMATMW',{taken:true}),/year and term/);
 let next=setNonMajorRecord(p,'GEMATMW',{year:1});assert.equal(next.nonMajorRecords.GEMATMW.taken,false);next=setNonMajorRecord(next,'GEMATMW',{term:2});assert.equal(next.nonMajorRecords.GEMATMW.taken,false);next=setNonMajorRecord(next,'GEMATMW',{taken:true});assert.equal(next.nonMajorRecords.GEMATMW.taken,true);
 assert.deepEqual(progressSummary(next),progressSummary(p));assert.deepEqual(gateStatus(next),gateStatus(p));assert.deepEqual(p,before);assert.deepEqual(next.academicRecords,p.academicRecords);assert.deepEqual(next.quizAttempts,p.quizAttempts);
 assert.deepEqual(hydrateProgress(next),next);assert.deepEqual(hydrateProgress(p),p);
 next=setNonMajorRecord(next,'GEMATMW',{term:null});assert.equal(next.nonMajorRecords.GEMATMW.taken,false);next=setNonMajorRecord(next,'GEMATMW',{year:null});assert.equal(next.nonMajorRecords,undefined);
 for(const [id,patch]of [['bad',{year:1}],['constructor',{year:1}],['GEMATMW',{year:0}],['GEMATMW',{year:21}],['GEMATMW',{year:'1'}],['GEMATMW',{term:4}],['GEMATMW',{taken:'true'}],['GEMATMW',{code:'NOPE'}]])assert.throws(()=>setNonMajorRecord(p,id,patch));
 const damaged=hydrateProgress({...p,nonMajorRecords:{GEMATMW:{year:1,term:999,taken:true},bad:{year:1,term:2,taken:true}},nonMajorBatchId:100});assert.equal(damaged.nonMajorRecords.GEMATMW.taken,false);assert.equal(damaged.nonMajorRecords.bad,undefined);assert.equal(damaged.nonMajorBatchId,undefined);assert.deepEqual(damaged.academicRecords,p.academicRecords);
 assert.deepEqual(normalizeNonMajorRecords([]),{});
});
test('batch corrections retain both PE histories but count only the applicable sequence, and naming is escaped',()=>{
 let p=setNonMajorRecord(newProgress(),'GEFTWEL',{year:1,term:2,taken:true});p=setNonMajorRecord(p,'PE1CRDO',{year:2,term:1,taken:true});
 assert.equal(nonMajorSummary(p,122).taken,1);assert.equal(nonMajorSummary(p,123).taken,1);assert.equal(nonMajorSummary(p,null).taken,0);
 p=setNonMajorBatch(p,122);p=setNonMajorBatch(p,123);assert.ok(hydrateProgress(p).nonMajorRecords.GEFTWEL.taken);assert.ok(p.nonMajorRecords.PE1CRDO.taken);
 p=setNonMajorRecord(p,'GELECAH',{code:'GE<ART>',title:'<img src=x onerror=alert(1)>'});const dom=new JSDOM(renderNonMajorChecklist(p,{batch:123}));assert.equal(dom.window.document.querySelector('img'),null);assert.match(dom.window.document.querySelector('[data-checklist-row="GELECAH"]').textContent,/GE<ART>/);assert.equal(dom.window.document.querySelectorAll('tbody tr').length,31);assert.equal(dom.window.document.querySelector('[data-checklist-row="GEFTWEL"]'),null);assert.ok(dom.window.document.querySelector('[data-checklist-row="PE1CRDO"]'));dom.window.close();
 assert.throws(()=>setNonMajorBatch(p,129));assert.throws(()=>setNonMajorRecord(p,'GELECAH',{title:'x'.repeat(161)}));
});
test('row controls preserve focus, date changes save independently, and loading or detached controls cannot mutate another account',()=>{
 const dom=new JSDOM('<section id="checklist"></section>'),w=dom.window,root=w.document.querySelector('section');let p=setNonMajorBatch(newProgress(),123),ready=true,writes=0;const errors=[];
 const editor=attachNonMajorChecklist(root,{getProgress:()=>p,getState:()=>({ready}),save:next=>{p=next;writes++;},onError:m=>errors.push(m)});editor.render();
 const input=(id,field)=>root.querySelector(`[data-non-major="${id}"][data-field="${field}"]`),change=(id,field,value)=>{const el=input(id,field);el.focus();if(field==='taken')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 assert.equal(input('GEMATMW','taken').disabled,true);change('GEMATMW','year','2');assert.equal(w.document.activeElement,input('GEMATMW','year'));change('GEMATMW','term','3');assert.equal(input('GEMATMW','taken').disabled,false);change('GEMATMW','taken',true);assert.equal(p.nonMajorRecords.GEMATMW.taken,true);assert.match(root.querySelector('.checklist-progress').textContent,/1 \/ 31/);
 root.querySelector('[data-checklist-row="GELECAH"] details').open=true;change('GELECAH','code','GETEST');assert.equal(root.querySelector('[data-checklist-row="GELECAH"] details').open,true);assert.equal(input('GELECAH','code').value,'GETEST');
 ready=false;editor.render();const before=writes;change('GEMATMW','year','4');assert.equal(writes,before);assert.match(errors.at(-1),/loading/);
 const stale=input('GEMATMW','year');ready=true;p=setNonMajorBatch(newProgress(),122);editor.render();stale.value='5';stale.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(writes,before);assert.equal(input('GEMATMW','year').value,'');assert.equal(input('GELECAH','code').value,'');
 editor.destroy();dom.window.close();
});
test('private account checklist sync survives reload and account switches; admin changes stay isolated',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},rows=new Map(),service={read:async id=>structuredClone(rows.get(id)||null),write:async(p,revision,id)=>{const current=rows.get(id);if((current?.revision||0)!==revision)return {conflict:true};rows.set(id,{progress:structuredClone(p),revision:revision+1});return {revision:revision+1};}};
 const model=createAccountProgress({storage,service});await model.setUser({id:'student-a'});await model.flush();model.save(setNonMajorRecord(model.progress(),'GEMATMW',{year:1,term:2,taken:true}));await model.flush();assert.ok(rows.get('student-a').progress.nonMajorRecords.GEMATMW.taken);
 const reloaded=createAccountProgress({storage,service});await reloaded.setUser({id:'student-a'});assert.ok(reloaded.progress().nonMajorRecords.GEMATMW.taken);await reloaded.setUser({id:'student-b'});await reloaded.flush();assert.equal(reloaded.progress().nonMajorRecords,undefined);await reloaded.setUser({id:'student-a'});assert.ok(reloaded.progress().nonMajorRecords.GEMATMW.taken);
 const admin=createAdminWorkspace({storage,authorize:async u=>({admin:true,userId:u.id})});await admin.setUser({id:'owner'});admin.switchView('admin');admin.save(setNonMajorRecord(admin.progress(),'GERIZAL',{year:1,term:1,taken:true}));assert.equal(rows.get('student-a').progress.nonMajorRecords.GERIZAL,undefined);admin.reset();assert.equal(admin.progress().nonMajorRecords,undefined);assert.ok(rows.get('student-a').progress.nonMajorRecords.GEMATMW.taken);
});
