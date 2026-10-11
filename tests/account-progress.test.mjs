import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountProgress, accountStorageKey } from '../src/account-progress.mjs';
import { newProgress, confirmSpecialization, changeSpecialization, setAcademicYear } from '../src/progression.mjs';
import { STORAGE_KEY, saveProgress, loadProgress } from '../src/storage.mjs';
import { publicCloudConfig } from '../scripts/cloud-config.mjs';
import { accountMarkup, accountDialogMarkup } from '../src/account-ui.mjs';

const storage=()=>{const rows=new Map();return {getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),rows};};
const completed=()=>{const p=newProgress();p.academicRecords.FNDMATH={status:'COMPLETED',events:[]};return p;};
function backend() {
 const rows=new Map(),writes=[];let failing=false;
 return {rows,writes,setFail:value=>failing=value,
  async read(id){if(failing)throw Error('offline');return structuredClone(rows.get(id)||null);},
  async write(p,revision,id){if(failing)throw Error('offline');const row=rows.get(id);if((row?.revision||0)!==revision)return {conflict:true};const next=revision+1;rows.set(id,{progress:structuredClone(p),revision:next});writes.push({id,revision:next,progress:structuredClone(p)});return {revision:next};}
 };
}
const a={id:'student-a',email:'student-a@example.test'},b={id:'student-b',email:'student-b@example.test'};

test('unconfigured guest progression retains the existing storage key and preview is read only',()=>{
 const store=storage();saveProgress(store,completed());const model=createAccountProgress({storage:store});
 assert.deepEqual(model.progress(),completed());assert.equal(model.state().phase,'guest');
 const before=store.getItem(STORAGE_KEY);model.progress();model.state();model.snapshotChoices();assert.equal(store.getItem(STORAGE_KEY),before);
 model.save(setAcademicYear(model.progress(),2));assert.equal(loadProgress(store).academicYear,2);
});
test('first login asks before importing guest progress and leaves the guest save intact',async()=>{
 const store=storage(),service=backend();saveProgress(store,completed());const encoded=store.getItem(STORAGE_KEY);
 const model=createAccountProgress({storage:store,service});await model.setUser(a);
 assert.equal(model.state().choice,'import');assert.equal(service.writes.length,0);assert.equal(model.state().ready,false);
 assert.throws(()=>model.save(newProgress()),/choosing/);
 await model.resolve('guest');await model.flush();assert.deepEqual(service.rows.get(a.id).progress,completed());
 assert.equal(store.getItem(STORAGE_KEY),encoded);await model.setUser(null);assert.deepEqual(model.progress(),completed());
});
test('a new account can start fresh without copying guest history',async()=>{
 const store=storage(),service=backend();saveProgress(store,completed());const model=createAccountProgress({storage:store,service});
 await model.setUser(a);await model.resolve('new');await model.flush();assert.deepEqual(service.rows.get(a.id).progress,newProgress());assert.deepEqual(loadProgress(store),completed());
});
test('cloud progress replaces the active view without overwriting guest or another account',async()=>{
 const store=storage(),service=backend();saveProgress(store,completed());
 service.rows.set(a.id,{progress:setAcademicYear(newProgress(),3),revision:7});service.rows.set(b.id,{progress:newProgress(),revision:1});
 const model=createAccountProgress({storage:store,service});await model.setUser(a);assert.equal(model.progress().academicYear,3);
 model.save(setAcademicYear(model.progress(),4));await model.flush();assert.equal(service.rows.get(a.id).revision,8);
 await model.setUser(b);assert.equal(model.progress().academicYear,1);assert.equal(service.rows.get(b.id).revision,1);
 await model.setUser(null);assert.deepEqual(model.progress(),completed());assert.ok(store.getItem(accountStorageKey(a.id)));assert.ok(store.getItem(accountStorageKey(b.id)));
});
test('offline changes persist in the account cache and retry sends them to that account',async()=>{
 const store=storage(),service=backend();service.rows.set(a.id,{progress:newProgress(),revision:1});
 const model=createAccountProgress({storage:store,service});await model.setUser(a);service.setFail(true);model.save(completed());await model.flush();
 assert.equal(model.state().phase,'offline');assert.equal(JSON.parse(store.getItem(accountStorageKey(a.id))).dirty,true);
 service.setFail(false);const resumed=createAccountProgress({storage:store,service});await resumed.setUser(a);await resumed.flush();
 assert.deepEqual(service.rows.get(a.id).progress,completed());assert.equal(resumed.state().phase,'saved');
});
test('stale-device writes require a choice and preserve both snapshots until resolved',async()=>{
 const store=storage(),service=backend();service.rows.set(a.id,{progress:newProgress(),revision:1});
 const model=createAccountProgress({storage:store,service});await model.setUser(a);
 service.rows.set(a.id,{progress:setAcademicYear(newProgress(),3),revision:2});model.save(completed());await model.flush();
 assert.equal(model.state().choice,'conflict');assert.equal(service.rows.get(a.id).progress.academicYear,3);
 assert.equal(model.snapshotChoices().device.academicRecords.FNDMATH.status,'COMPLETED');
 await model.resolve('device');await model.flush();assert.deepEqual(service.rows.get(a.id).progress,completed());
 assert.equal(JSON.parse(store.getItem(accountStorageKey(a.id)+'.conflict-backup')).progress.academicYear,3);
});
test('choosing the newer cloud copy does not upload stale device progress',async()=>{
 const store=storage(),service=backend();service.rows.set(a.id,{progress:newProgress(),revision:1});
 const model=createAccountProgress({storage:store,service});await model.setUser(a);service.rows.set(a.id,{progress:setAcademicYear(newProgress(),2),revision:2});
 model.save(completed());await model.flush();await model.resolve('cloud');assert.equal(model.progress().academicYear,2);assert.equal(service.writes.length,0);
});
test('account switches ignore late reads and queued saves never target a different account',async()=>{
 const store=storage(),service=backend();let release;
 const realRead=service.read;service.read=id=>id===a.id?new Promise(resolve=>release=resolve):realRead(id);
 service.rows.set(b.id,{progress:setAcademicYear(newProgress(),2),revision:4});
 const model=createAccountProgress({storage:store,service});const first=model.setUser(a);await model.setUser(b);
 release({progress:completed(),revision:9});await first;assert.equal(model.progress().academicYear,2);assert.equal(model.state().user.id,b.id);
 model.save(completed());await model.setUser(null);await model.flush();assert.equal(service.writes.length,0);assert.deepEqual(model.progress(),newProgress());
});
test('specialization transfers retain all academic and quiz history through cloud persistence; reset is scoped',async()=>{
 const store=storage(),service=backend();saveProgress(store,completed());
 let p=confirmSpecialization(setAcademicYear(completed(),3),'STE',{confirmed:true});p.quizAttempts=[{id:'old-attempt',courseId:'STE-test'}];p.academicRecords['old-specialist']={status:'COMPLETED'};
 service.rows.set(a.id,{progress:p,revision:1});const model=createAccountProgress({storage:store,service});await model.setUser(a);
 model.save(changeSpecialization(model.progress(),'GTE',{confirmed:true,reason:'Academic transfer'}));await model.flush();
 const cloud=service.rows.get(a.id).progress;assert.equal(cloud.quizAttempts.length,1);assert.ok(cloud.academicRecords['old-specialist']);assert.equal(cloud.specializationProgression.previousSpecializationHistory.length,1);
 model.save(newProgress());await model.flush();assert.deepEqual(service.rows.get(a.id).progress,newProgress());assert.deepEqual(loadProgress(store),completed());
});
test('public build config rejects privileged secrets and incomplete or unsafe URLs',()=>{
 assert.deepEqual(publicCloudConfig({}),{url:'',publishableKey:''});
 const env={PUBLIC_SUPABASE_URL:'https://example.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};assert.equal(publicCloudConfig(env).url,env.PUBLIC_SUPABASE_URL);
 assert.throws(()=>publicCloudConfig({...env,PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}),/never a secret/);
 const jwt=role=>'e30.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
 assert.throws(()=>publicCloudConfig({...env,PUBLIC_SUPABASE_PUBLISHABLE_KEY:jwt('service_role')}),/never a secret/);
 assert.equal(publicCloudConfig({...env,PUBLIC_SUPABASE_PUBLISHABLE_KEY:jwt('anon')}).publishableKey,jwt('anon'));
 assert.throws(()=>publicCloudConfig({PUBLIC_SUPABASE_URL:env.PUBLIC_SUPABASE_URL}),/both/);
 assert.throws(()=>publicCloudConfig({...env,PUBLIC_SUPABASE_URL:'https://password@example.supabase.co'}),/credentials/);
});
test('account UI uses honest save states and escapes account identity',()=>{
 assert.match(accountMarkup({phase:'guest',configured:false}),/awaiting setup/);
 const html=accountMarkup({phase:'offline',user:{email:'<script>evil</script>'}});assert.ok(!html.includes('<script>'));assert.match(html,/saved on device/);
 assert.match(accountDialogMarkup({choice:'conflict'},{device:completed(),cloud:newProgress()}),/Use this device · 1 completed/);
});
test('an unreadable guest save is preserved until an explicit reset',()=>{
 const store=storage();store.setItem(STORAGE_KEY,'bad json');const model=createAccountProgress({storage:store});
 assert.equal(model.state().phase,'local-error');model.save(completed());assert.equal(store.getItem(STORAGE_KEY),'bad json');
 model.resetGuest();assert.deepEqual(loadProgress(store),newProgress());assert.equal(model.state().phase,'guest');
});
