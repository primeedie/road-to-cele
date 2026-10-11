import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress } from '../src/progression.mjs';
import { resetProgress, loadProgress, saveProgress, STORAGE_KEY } from '../src/storage.mjs';

test('testing reset clears every progression history and remains reset after loading again',()=>{
 const old=newProgress();old.academicYear=4;
 old.specializationProgression={selectedSpecialization:'STE',specializationStatus:'CONFIRMED',confirmedAt:'2026-10-11',confirmationMethod:'SELF_REPORTED',previousSpecializationHistory:[{selectedSpecialization:'GTE'}]};
 old.academicRecords={FNDMATH:{status:'COMPLETED',events:[{status:'COMPLETED'}]}};
 old.masteryRecords={FNDMATH:{mastered:true}};
 old.quizAttempts=[{id:'test-quiz',passed:true}];old.integrationAssessments=[{id:'test-integration',passed:true}];
 const records=new Map([['other-app','untouched']]);
 const storage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value)};
 saveProgress(storage,old);resetProgress(storage);
 assert.deepEqual(loadProgress(storage),newProgress());
 assert.equal(records.get('other-app'),'untouched');
});
test('failed reset storage write preserves the previous academic record',()=>{
 const old=newProgress();old.academicRecords.FNDMATH={status:'COMPLETED'};
 const encoded=JSON.stringify(old);
 const storage={getItem:()=>encoded,setItem:()=>{throw Error('Storage is unavailable');}};
 assert.throws(()=>resetProgress(storage),/unavailable/);
 assert.equal(storage.getItem(STORAGE_KEY),encoded);
 assert.deepEqual(loadProgress(storage),old);
});
