import test from 'node:test';
import assert from 'node:assert/strict';
import {newProgress,setAcademicYear,setAcademicTerm,recordAcademicProgress,courseAccess} from '../src/progression.mjs';
import {hydrateProgress} from '../src/storage.mjs';
import {COURSE_BY_ID} from '../src/curriculum.mjs';
import {renderCoursePanel} from '../src/course-panel.mjs';

test('activation satisfies soft requirements, while hard requirements need academic completion, never mastery',()=>{
 let p=newProgress();p.masteryRecords.FNDMATH={mastered:true};assert.equal(courseAccess(p,'CALENG1').allowed,false);
 p=recordAcademicProgress(p,'FNDMATH','ACTIVE');assert.equal(courseAccess(p,'CALENG1').allowed,false);
 p.academicRecords.LBYME1A={status:'COMPLETED'};assert.equal(courseAccess(p,'CESURVE').allowed,true);
 assert.equal(p.masteryRecords.CESURVE,undefined);
 p=recordAcademicProgress(p,'FNDMATH','COMPLETED');assert.equal(courseAccess(p,'CALENG1').allowed,true);
});
test('lecture co-requisites activate atomically in either order, with independent hard requirements enforced',()=>{
 for(const id of ['CEMEDEF','CESTRUC']){
  let p=setAcademicTerm(setAcademicYear(newProgress(),2),6),before=structuredClone(p);
  assert.equal(courseAccess(p,id).allowed,false);assert.throws(()=>recordAcademicProgress(p,id,'ACTIVE'));assert.deepEqual(p,before);
  p.academicRecords.ENGMEC3={status:'COMPLETED'};
  assert.deepEqual(courseAccess(p,id).coactivate,[id==='CEMEDEF'?'CESTRUC':'CEMEDEF']);
  assert.match(renderCoursePanel(p,COURSE_BY_ID[id]),/Activate (CEMEDEF \+ CESTRUC|CESTRUC \+ CEMEDEF)/);
  p=recordAcademicProgress(p,id,'ACTIVE');
  for(const course of ['CEMEDEF','CESTRUC']){assert.equal(p.academicRecords[course].status,'ACTIVE');assert.equal(p.academicRecords[course].takenInTerm,6);}
  assert.equal(p.academicRecords.LBYCV2E,undefined);
 }
});
test('labs cannot come first; active same-term, earlier-term, and completed lectures qualify',()=>{
 let p=newProgress();assert.equal(courseAccess(p,'LBYCH1A').allowed,false);
 p.academicRecords.BASCHEM={status:'COMPLETED'};p=setAcademicTerm(p,2);
 p=recordAcademicProgress(p,'ENGCHEM','ACTIVE');assert.equal(p.academicRecords.LBYCH1A,undefined);
 assert.equal(courseAccess(p,'LBYCH1A').allowed,true);
 p=setAcademicTerm(p,1);assert.equal(courseAccess(p,'LBYCH1A').allowed,false);
 p=setAcademicTerm(p,3);assert.equal(courseAccess(p,'LBYCH1A').allowed,true);
 p=recordAcademicProgress(p,'ENGCHEM','COMPLETED');assert.equal(p.academicRecords.ENGCHEM.takenInTerm,2);
 p=recordAcademicProgress(p,'LBYCH1A','ACTIVE');assert.equal(p.academicRecords.LBYCH1A.takenInTerm,3);
 assert.throws(()=>recordAcademicProgress(p,'ENGCHEM','ACTIVE'),/already completed/);
});
test('legacy records retain their eligibility and history; invalid terms cannot enter persistence',()=>{
 const p=newProgress();p.academicRecords.ENGCHEM={status:'ACTIVE',events:[]};
 const hydrated=hydrateProgress(p);assert.deepEqual(hydrated.academicRecords,p.academicRecords);assert.equal(courseAccess(hydrated,'LBYCH1A').allowed,true);
 assert.throws(()=>setAcademicTerm(p,4),/current academic year/);
 assert.throws(()=>hydrateProgress({...p,academicTerm:4}),/Invalid academic term/);
});
