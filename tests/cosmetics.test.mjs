import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, changeSpecialization, confirmSpecialization, setAcademicYear, progressSummary, gateStatus } from '../src/progression.mjs';
import { hydrateProgress } from '../src/storage.mjs';
import { equipCosmetic, equippedCosmetics, unlockedFrames, wardrobeMarkup } from '../src/cosmetics.mjs';
import { COURSES } from '../src/curriculum.mjs';

test('avatars and frames are cosmetic only and survive record hydration',()=>{
 const before=newProgress(),after=equipCosmetic(before,'avatar','fox');
 assert.deepEqual(progressSummary(after),progressSummary(before));assert.deepEqual(gateStatus(after),gateStatus(before));assert.deepEqual(after.academicRecords,before.academicRecords);assert.deepEqual(after.quizAttempts,before.quizAttempts);assert.equal(before.cosmetics.avatar,'owl');
 assert.equal(hydrateProgress(after).cosmetics.avatar,'fox');assert.equal(equippedCosmetics(after).frame,'wanderer');
 assert.throws(()=>equipCosmetic(after,'frame','first-light'),/Complete more/);
 assert.throws(()=>equipCosmetic(after,'avatar','made-up'),/Unknown/);
});
test('legacy progression gains a default companion without changing academic history',()=>{
 const old=newProgress();delete old.cosmetics;old.academicRecords.FNDMATH={status:'COMPLETED'};
 const restored=hydrateProgress(old);assert.equal(restored.cosmetics.avatar,'owl');assert.deepEqual(restored.academicRecords,old.academicRecords);
 const malformed=hydrateProgress({...old,cosmetics:{avatar:'<img>',frame:'<script>'}});assert.deepEqual(malformed.cosmetics,{avatar:'owl',frame:'wanderer'});
});
test('frame unlocks require real completed curriculum courses and retain historical transfer rewards',()=>{
 let p=confirmSpecialization(setAcademicYear(newProgress(),3),'STE',{confirmed:true});
 p.academicRecords.fake={status:'COMPLETED'};assert.equal(unlockedFrames(p).length,1);
 for(const c of COURSES.slice(0,8))p.academicRecords[c.id]={status:'COMPLETED'};
 p=equipCosmetic(p,'frame','laurel');const next=changeSpecialization(p,'GTE',{confirmed:true,reason:'Transfer'});
 assert.equal(equippedCosmetics(next).frame,'laurel');assert.ok(unlockedFrames(next).some(f=>f.id==='laurel'));
 assert.match(wardrobeMarkup(next),/data-frame="starbound"[^>]*disabled/);
 assert.equal(equippedCosmetics(newProgress()).frame,'wanderer');
});
