import test from 'node:test';
import assert from 'node:assert/strict';
import { completionMoment } from '../src/completion.mjs';
import { newProgress, recordAcademicProgress, requiredCourses, gateStatus } from '../src/progression.mjs';

test('completion rewards identify newly available courses without granting mastery or repeating',()=>{
 const before=recordAcademicProgress(newProgress(),'FNDMATH','ACTIVE');
 const after=recordAcademicProgress(before,'FNDMATH','COMPLETED');
 const original=JSON.stringify(after),reward=completionMoment(before,after,'FNDMATH');
 assert.equal(reward.academic.complete,1);assert.equal(reward.termComplete,false);
 assert.ok(reward.newlyAvailable.includes('CALENG1'));
 assert.equal(completionMoment(after,after,'FNDMATH'),null);
 assert.equal(completionMoment(newProgress(),before,'FNDMATH'),null);
 assert.deepEqual(after.masteryRecords,{});assert.equal(gateStatus(after).hardmodeUnlocked,false);
 assert.equal(JSON.stringify(after),original);
});
test('a term celebration requires every required course in the term to be complete',()=>{
 const courses=requiredCourses(newProgress()).filter(c=>c.term===1);
 let progress=newProgress(),lastReward;
 for(const c of courses){const next=recordAcademicProgress(progress,c.id,'COMPLETED');lastReward=completionMoment(progress,next,c.id);progress=next;}
 assert.equal(lastReward.termComplete,true);assert.equal(lastReward.term,1);
 assert.equal(lastReward.academic.complete,courses.length);
});
