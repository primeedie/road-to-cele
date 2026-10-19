import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES,COURSE_BY_ID} from '../src/curriculum.mjs';
import {newProgress,requiredCourses,confirmSpecialization,academicLoad,courseAccess,recordAcademicProgress,startCourseRetake,setAcademicTerm,gateStatus,recordIntegrationAssessment} from '../src/progression.mjs';
import {buildAdvisingPlan,applyAdvisingImport} from '../src/advising-import.mjs';
import {adminAcademicProgress} from '../src/admin-mode.mjs';
import {renderCoursePanel} from '../src/course-panel.mjs';
import {hydrateProgress} from '../src/storage.mjs';

// Use catalog units to build a precise load independently of the enrollment code.
function ordinary(units,exclude=[]){
 const p={...newProgress(),academicYear:4,academicTerm:10},sums=new Map([[0,[]]]);
 for(const c of COURSES.filter(c=>!c.specialization&&!exclude.includes(c.id))){
  for(const [sum,ids]of [...sums])if(sum+c.units<=units&&!sums.has(sum+c.units))sums.set(sum+c.units,[...ids,c.id]);
 }
 assert.ok(sums.has(units));
 for(const id of sums.get(units))p.academicRecords[id]={status:'ACTIVE',takenInTerm:1,events:[]};
 return p;
}
function finalTerm(){
 const p=confirmSpecialization({...newProgress(),academicYear:4,academicTerm:11},'STE',{confirmed:true});
 for(const c of requiredCourses(p))p.academicRecords[c.id]={status:'COMPLETED',takenInTerm:c.term,events:[]};
 // 22 active units plus a 2-unit hydrology course whose prerequisites are passed.
 for(const id of ['FNDMATH','BASCHEM','BASPHYS','FNDSTAT','LBYME1A','CEORIEN','ENGTREP','LBYEC2A','LBYCV2A'])p.academicRecords[id]={status:'ACTIVE',takenInTerm:11,events:[]};
 delete p.academicRecords.CEHDROL;
 return p;
}
test('ordinary activations allow exactly 21 units, block 22 atomically, and explain the limit in the course panel',()=>{
 const p=ordinary(20,['LBYEC2A']),next=recordAcademicProgress(p,'LBYEC2A','ACTIVE');
 assert.equal(academicLoad(next).activeUnits,21);assert.equal(p.academicRecords.LBYEC2A,undefined);
 const full=ordinary(21,['LBYEC2A']),before=structuredClone(full),access=courseAccess(full,'LBYEC2A');
 assert.equal(access.allowed,false);assert.match(access.reason,/22 active technical units.*limit is 21/);
 assert.throws(()=>recordAcademicProgress(full,'LBYEC2A','ACTIVE'),/limit is 21/);assert.deepEqual(full,before);
 assert.match(renderCoursePanel(full,COURSE_BY_ID.LBYEC2A),/22 active technical units/);
 assert.equal(courseAccess(setAcademicTerm(full,12),'LBYEC2A').allowed,false);
});
test('lecture partners consume their combined units atomically and an active partner is counted once',()=>{
 const excluded=['CEMEDEF','CESTRUC','ENGMEC3'];
 const p=ordinary(19,excluded);p.academicRecords.ENGMEC3={status:'COMPLETED'};
 assert.throws(()=>recordAcademicProgress(p,'CEMEDEF','ACTIVE'),/24 active technical units.*limit is 21/);
 assert.equal(p.academicRecords.CEMEDEF,undefined);assert.equal(p.academicRecords.CESTRUC,undefined);
 const room=ordinary(16,excluded);room.academicRecords.ENGMEC3={status:'COMPLETED'};
 const next=recordAcademicProgress(room,'CESTRUC','ACTIVE');assert.equal(academicLoad(next).activeUnits,21);
 assert.equal(next.academicRecords.CEMEDEF.status,'ACTIVE');assert.equal(next.academicRecords.CESTRUC.status,'ACTIVE');
 assert.equal(courseAccess(next,'CESTRUC').allowed,true);
});
test('final-term allowance is derived from unfinished confirmed-path units, includes retakes and stops at 24',()=>{
 const p=finalTerm(),load=academicLoad(p);assert.equal(load.remainingUnits,24);assert.equal(load.finalTerm,true);assert.equal(load.limit,24);
 const next=recordAcademicProgress(p,'CEHDROL','ACTIVE');assert.equal(academicLoad(next).activeUnits,24);
 const notFinal=structuredClone(p);notFinal.academicRecords.LBYCV3C={status:'FAILED',takenInTerm:10};
 assert.equal(academicLoad(notFinal).remainingUnits,25);assert.equal(academicLoad(notFinal).limit,21);
 assert.equal(courseAccess(notFinal,'CEHDROL').allowed,false);
 const undecided=structuredClone(p);undecided.specializationProgression=newProgress().specializationProgression;assert.equal(academicLoad(undecided).finalTerm,false);
 const over=structuredClone(p);over.academicRecords.GTEROCK={status:'ACTIVE',takenInTerm:10};
 assert.throws(()=>recordAcademicProgress(over,'CEHDROL','ACTIVE'),/27 active technical units.*limit is 24/);
});
test('retakes consume capacity, respect the final-term allowance and retain the failed attempt',()=>{
 const failed={status:'FAILED',takenInTerm:1,gradeAttempts:[{term:1,grade:0,outcome:'FAILED'}],events:[]};
 const p=ordinary(17,['FNDMATH']);p.academicRecords.FNDMATH=structuredClone(failed);const before=structuredClone(p);
 assert.throws(()=>startCourseRetake(p,'FNDMATH',11),/22 active technical units.*limit is 21/);assert.deepEqual(p,before);
 const room=ordinary(16,['FNDMATH']);room.academicRecords.FNDMATH=structuredClone(failed);
 const next=startCourseRetake(room,'FNDMATH',11);assert.equal(academicLoad(next).activeUnits,21);assert.deepEqual(next.academicRecords.FNDMATH.gradeAttempts,failed.gradeAttempts);
 const last=finalTerm();delete last.academicRecords.FNDMATH;last.academicRecords.FNDMATH=structuredClone(failed);
 const retake=startCourseRetake(last,'FNDMATH',12);assert.equal(academicLoad(retake).activeUnits,22);assert.equal(academicLoad(retake).limit,24);
 assert.equal(academicLoad(startCourseRetake(p,'FNDMATH',11,{admin:true})).activeUnits,22);
});
test('existing excessive loads remain readable and completable, and admin experiments stay unrestricted',()=>{
 const p=ordinary(24,['LBYEC2A']),id=Object.keys(p.academicRecords).find(id=>!COURSE_BY_ID[id].hardPrerequisites.length&&!COURSE_BY_ID[id].softPrerequisites.length&&!COURSE_BY_ID[id].corequisites.length);
 assert.ok(id);assert.deepEqual(hydrateProgress(p),p);
 assert.equal(recordAcademicProgress(p,id,'COMPLETED').academicRecords[id].status,'COMPLETED');
 const admin=adminAcademicProgress(p,'LBYEC2A','ACTIVE');assert.equal(academicLoad(admin).activeUnits,25);
});
test('CIVINCO requires full activation coverage and at most 24 active units, independently of completion and mastery',()=>{
 const p=recordAcademicProgress(finalTerm(),'CEHDROL','ACTIVE'),g=gateStatus(p);
 assert.equal(g.load.activeUnits,24);assert.equal(g.activated.complete,g.activated.total);assert.equal(g.eligible,true);assert.equal(g.cleared,false);assert.equal(g.hardmodeUnlocked,false);assert.equal(g.summary.mastery.complete,0);
 const failed=structuredClone(p);failed.academicRecords.FNDMATH.status='FAILED';assert.equal(gateStatus(failed).eligible,true);
 const missing=structuredClone(p);delete missing.academicRecords.LBYEC2A;assert.equal(gateStatus(missing).eligible,false);
 const over=structuredClone(p);over.academicRecords.LBYCV3C.status='ACTIVE';assert.equal(gateStatus(over).load.activeUnits,25);assert.equal(gateStatus(over).eligible,false);
 assert.throws(()=>recordIntegrationAssessment(over,{passed:true,attemptId:'blocked'}),/at or below 24/);
 const passed=recordIntegrationAssessment(p,{passed:true,attemptId:'pass'});assert.equal(gateStatus(passed).hardmodeUnlocked,false);assert.equal(gateStatus(passed).eligible,true);
 const undecided=structuredClone(p);undecided.specializationProgression=newProgress().specializationProgression;assert.equal(gateStatus(undecided).eligible,false);
});
test('imports enforce active-load limits atomically but never reject finished historical terms for their old load',()=>{
 const p=ordinary(21,['LBYEC2A']),parsed={rows:[{code:'LBYEC2A',units:1,gradeText:'',term:10}]},plan=buildAdvisingPlan(p,parsed);
 assert.throws(()=>applyAdvisingImport(p,plan,{confirmed:true,activeKeys:['LBYEC2A:10'],currentTerm:10}),/22 active technical units/);assert.equal(p.academicRecords.LBYEC2A,undefined);
 assert.equal(academicLoad(applyAdvisingImport(p,plan,{confirmed:true,activeKeys:['LBYEC2A:10'],currentTerm:10,admin:true})).activeUnits,22);
 const history={rows:COURSES.filter(c=>!c.specialization&&c.term<=3).map(c=>({code:c.id,units:c.units,gradeText:'2.00',term:1}))},historical=buildAdvisingPlan(newProgress(),history);
 const imported=applyAdvisingImport(newProgress(),historical,{confirmed:true,selectedKeys:historical.rows.map(r=>r.key),currentTerm:2});
 assert.equal(academicLoad(imported).activeUnits,0);assert.equal(Object.keys(imported.academicRecords).length,history.rows.length);
});
