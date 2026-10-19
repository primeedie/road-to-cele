import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, COURSE_BY_ID, SPECIALIZATIONS, CELE_DOMAINS } from '../src/curriculum.mjs';
import { newProgress, selected, previewBranch, courseAccess, setAcademicYear, confirmSpecialization, changeSpecialization, recordAcademicProgress, requiredCourses, requiredMasteryNodes, recordMasteryResult, progressSummary, gateStatus, recordIntegrationAssessment } from '../src/progression.mjs';
import { hydrateProgress, saveProgress, loadProgress } from '../src/storage.mjs';
const confirm=(branch='STE')=>confirmSpecialization(setAcademicYear(newProgress(),4),branch,{confirmed:true,at:'2026-10-11T00:00:00Z'});
const academicFixture=p=>{for(const c of requiredCourses(p))p.academicRecords[c.id]={status:'COMPLETED',events:[{status:'COMPLETED',method:'SELF_REPORTED',at:'2026-10-11T00:00:00Z'}]};return p;};
function readyFixture(branch='STE'){const p=academicFixture(confirm(branch));for(const c of requiredMasteryNodes(p))p.masteryRecords[c.id]={mastered:true,attemptId:'fixture-'+c.id};return p;}
test('single shared dataset contains all five branches and valid H/S/C graph references',()=>{
 assert.equal(new Set(COURSES.map(c=>c.id)).size,COURSES.length);
 assert.equal(Object.keys(SPECIALIZATIONS).length,5);
 for(const c of COURSES)for(const id of [...c.hardPrerequisites,...c.softPrerequisites,...c.corequisites])assert.ok(COURSE_BY_ID[id],`${c.id}: missing ${id}`);
 for(const branch of Object.keys(SPECIALIZATIONS))assert.equal(COURSES.filter(c=>c.specialization===branch).length,branch==='TRE'?5:4);
 assert.equal(COURSE_BY_ID.CETRANS.specialization,null);assert.equal(COURSE_BY_ID.CEGEOEN.specialization,null);
});
test('Years 1 and 2 can preview all five branches without commitment or data mutation',()=>{
 for(const year of [1,2]){const p=setAcademicYear(newProgress(),year),before=JSON.stringify(p);
 for(const id of Object.keys(SPECIALIZATIONS)){const v=previewBranch(p,id);assert.equal(v.mode,'PREVIEW');assert.ok(v.courses.length);assert.ok(v.courses.every(c=>c.specialization===id));}
 assert.equal(JSON.stringify(p),before);assert.equal(selected(p),null);}
});
test('exploration is read-only, including the confirmed branch in explicit preview mode',()=>{
 const p=confirm(),before=JSON.stringify(p);assert.equal(previewBranch(p,'STE').mode,'ACTIVE');previewBranch(p,'GTE');
 assert.throws(()=>recordAcademicProgress(p,'FNDMATH','COMPLETED',{preview:true}),/Preview/);
 assert.throws(()=>recordMasteryResult(p,'STEMTRX',{passed:true,attemptId:'p',preview:true}),/Preview/);
 assert.equal(JSON.stringify(p),before);
});
test('shared Year 3 technical subjects are accessible while specialization is undecided',()=>{
 const p=setAcademicYear(newProgress(),3);
 for(const id of ['CEMEDEF','CEGEOLO','CEHDROL'])p.academicRecords[id]={status:'COMPLETED',events:[]};
 p.academicRecords.CEORIEN={status:'ACTIVE',events:[]};
 assert.equal(courseAccess(p,'CEGEOEN').allowed,true);
 const next=recordAcademicProgress(p,'CEGEOEN','ACTIVE');assert.equal(next.academicRecords.CEGEOEN.status,'ACTIVE');assert.equal(selected(next),null);
});
test('specialist progression requires Year 3 and explicit self-reported confirmation',()=>{
 const p=setAcademicYear(newProgress(),3);p.academicRecords.CENUMER={status:'COMPLETED'};p.academicRecords.CESTRUC={status:'COMPLETED'};
 assert.equal(courseAccess(p,'STEMTRX').allowed,false);assert.throws(()=>recordAcademicProgress(p,'STEMTRX','ACTIVE'),/Confirm/);
 assert.throws(()=>confirmSpecialization(p,'STE'),/Explicit/);
 assert.throws(()=>confirmSpecialization(newProgress(),'STE',{confirmed:true}),/Year 3/);
 assert.throws(()=>confirmSpecialization(p,'STE',{confirmed:true,method:'UNIVERSITY_VERIFIED'}),/self-reported/);
 const n=confirmSpecialization(p,'STE',{confirmed:true});assert.equal(courseAccess(n,'STEMTRX').allowed,true);
 assert.equal(n.specializationProgression.confirmationMethod,'SELF_REPORTED');assert.ok(n.specializationProgression.confirmedAt);
 assert.throws(()=>confirmSpecialization(n,'GTE',{confirmed:true}),/separate/);
});
test('H, S and C dependencies are enforced separately with no premature progression',()=>{
 let p=newProgress();assert.equal(courseAccess(p,'CALENG1').allowed,false);
 p=recordAcademicProgress(p,'FNDMATH','ACTIVE');assert.equal(p.academicRecords.FNDMATH.status,'ACTIVE');assert.equal(courseAccess(p,'CALENG1').allowed,false);
 p=recordAcademicProgress(p,'FNDMATH','COMPLETED');assert.equal(courseAccess(p,'CALENG1').allowed,true);
 p=setAcademicYear(p,2);p.academicRecords.BASPHYS={status:'COMPLETED'};p.academicRecords.CALENG1={status:'ACTIVE'};
 assert.equal(courseAccess(p,'ENGPHYS').allowed,true);assert.equal(courseAccess(p,'LBYPH1A').allowed,false);
 p=recordAcademicProgress(p,'ENGPHYS','ACTIVE');assert.equal(courseAccess(p,'LBYPH1A').allowed,true);
});
test('only the selected branch affects path academic completion and configured mastery',()=>{
 const p=academicFixture(confirm('STE'));const expected=progressSummary(p);
 for(const c of COURSES.filter(c=>c.specialization&&c.specialization!=='STE')){p.academicRecords[c.id]={status:'COMPLETED'};p.masteryRecords[c.id]={mastered:true};}
 assert.deepEqual(progressSummary(p),expected);
 assert.ok(requiredCourses(p).every(c=>!c.specialization||c.specialization==='STE'));
 assert.ok(requiredMasteryNodes(p).every(c=>c.requiredMastery));
 assert.equal(requiredMasteryNodes(p,{shared:true,selectedSpecialization:false}).filter(c=>c.specialization).length,0);
 assert.throws(()=>recordAcademicProgress(p,'GTEROCK','COMPLETED'),/preview-only/);
 assert.throws(()=>recordMasteryResult(p,'GTEROCK',{passed:true,attemptId:'foreign'}),/Preview/);
});
test('unselected branches never block CIVINCO, across all five specializations',()=>{
 for(const branch of Object.keys(SPECIALIZATIONS)){const p=readyFixture(branch);assert.equal(gateStatus(p).eligible,true);
 assert.ok(COURSES.filter(c=>c.specialization&&c.specialization!==branch).every(c=>!p.academicRecords[c.id]&&!p.masteryRecords[c.id]));}
});
test('activation coverage opens CIVINCO without mastery but does not imply clearance or Hardmode',()=>{
 const p=academicFixture(confirm());assert.equal(progressSummary(p).mastery.complete,0);assert.equal(gateStatus(p).eligible,true);
 assert.equal(gateStatus(p).cleared,false);
 assert.equal(gateStatus(p).hardmodeUnlocked,false);
});
test('CIVINCO requires an assessment pass; Hardmode unlocks common domains only after clearance',()=>{
 let p=readyFixture();assert.equal(gateStatus(p).eligible,true);assert.equal(gateStatus(p).hardmodeUnlocked,false);
 assert.throws(()=>recordIntegrationAssessment(p,{passed:true}),/result/);
 p=recordIntegrationAssessment(p,{passed:false,attemptId:'integration-1'});assert.equal(gateStatus(p).cleared,false);
 p=recordIntegrationAssessment(p,{passed:true,attemptId:'integration-2'});assert.equal(gateStatus(p).cleared,true);assert.equal(gateStatus(p).hardmodeUnlocked,true);assert.equal(CELE_DOMAINS.length,3);
});
test('transfer requires confirmation and preserves academics, mastery, quizzes and integration history',()=>{
 let p=readyFixture('STE');p=recordMasteryResult(p,'STEMTRX',{passed:true,attemptId:'actual-attempt'});
 p=recordIntegrationAssessment(p,{passed:true,attemptId:'gate-pass'});const before=structuredClone(p);
 assert.throws(()=>changeSpecialization(p,'GTE',{reason:'Transfer'}),/confirmation/);
 assert.throws(()=>changeSpecialization(p,'GTE',{confirmed:true}),/reason/);
 const n=changeSpecialization(p,'GTE',{confirmed:true,reason:'Accepted academic transfer',at:'2026-10-12T00:00:00Z'});
 for(const key of ['academicRecords','masteryRecords','quizAttempts','integrationAssessments'])assert.deepEqual(n[key],p[key]);
 assert.deepEqual(p,before);assert.equal(selected(n),'GTE');assert.equal(n.specializationProgression.previousSpecializationHistory.length,1);
 assert.equal(progressSummary(n).academic.complete,COURSES.filter(c=>!c.specialization).length);
 assert.equal(gateStatus(n).eligible,false);assert.equal(gateStatus(n).hardmodeUnlocked,true);
 const back=changeSpecialization(n,'STE',{confirmed:true,reason:'Incorrect transfer selection corrected'});assert.equal(progressSummary(back).academic.percent,100);assert.equal(back.quizAttempts.length,1);
});
test('future-year courses can be inspected but year browsing cannot grant progression',()=>{
 const p=newProgress();assert.equal(courseAccess(p,'CESTEEL').allowed,false);previewBranch(p,'CTM');assert.equal(p.academicYear,1);
 assert.throws(()=>recordAcademicProgress(p,'CESTEEL','ACTIVE'),/Year 3/);
});
test('browser persistence restores specialization, academic events and historical attempts',()=>{
 const entries=new Map();const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
 let p=confirm();p=recordAcademicProgress(p,'FNDMATH','COMPLETED');p=changeSpecialization(p,'CTM',{confirmed:true,reason:'Correction'});
 saveProgress(storage,p);assert.deepEqual(loadProgress(storage),p);assert.throws(()=>hydrateProgress({...p,academicYear:9}),/year/);
 assert.throws(()=>hydrateProgress({...p,specializationProgression:{...p.specializationProgression,confirmationMethod:'VERIFIED'}}),/confirmation/);
});
