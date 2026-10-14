import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminWorkspace,adminAcademicProgress,adminStorageKey} from '../src/admin-mode.mjs';
import {newProgress,courseAccess} from '../src/progression.mjs';
import {COURSE_BY_ID} from '../src/curriculum.mjs';
import {renderCoursePanel} from '../src/course-panel.mjs';
import {equipCosmetic} from '../src/cosmetics.mjs';
import {handleAdminAccess} from '../server/admin-access.mjs';
const owner='747ef767-6a10-4eac-9c93-f3af9e03d737',email='freshmilchh@accounts.road-to-cele.invalid';
test('verified admin experiments and resets stay separate from student saves and revoke on account switches',async()=>{
 const records=new Map([['student',JSON.stringify(newProgress())]]),storage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)};
 const w=createAdminWorkspace({storage,authorize:async u=>({admin:u.id===owner,userId:u.id})});
 await w.setUser({id:'student',user_metadata:{road_to_cele_admin:true}});assert.equal(w.allowed(),false);assert.throws(()=>w.switchView('admin'));
 await w.setUser({id:owner});assert.equal(w.active(),false);w.switchView('admin');
 assert.equal(courseAccess(newProgress(),'STEBRDG').allowed,false);w.save(adminAcademicProgress(w.progress(),'STEBRDG','COMPLETED'));assert.equal(w.progress().academicRecords.STEBRDG.status,'COMPLETED');
 assert.equal(records.get('student'),JSON.stringify(newProgress()));assert.ok(records.has(adminStorageKey(owner)));
 const panel=renderCoursePanel(w.progress(),COURSE_BY_ID.STEBRDG,{admin:true,section:3});assert.match(panel,/aria-selected="true"/);assert.doesNotMatch(panel,/disabled aria-disabled/);
 assert.equal(equipCosmetic(w.progress(),'frame','starbound',{unrestricted:true}).cosmetics.frame,'starbound');assert.throws(()=>equipCosmetic(newProgress(),'frame','starbound'));
 w.switchView('student');assert.throws(()=>w.reset());w.switchView('admin');w.reset();assert.deepEqual(w.progress().academicRecords,{});assert.equal(records.get('student'),JSON.stringify(newProgress()));
 await w.setUser({id:'another'});assert.equal(w.allowed(),false);assert.equal(w.active(),false);assert.throws(()=>w.save(newProgress()));
});
test('an old admin permission response cannot authorize a newer account',async()=>{
 let resolve;const w=createAdminWorkspace({storage:{getItem:()=>null,setItem:()=>{}},authorize:u=>u.id===owner?new Promise(r=>resolve=r):Promise.resolve({admin:false,userId:u.id})});
 const pending=w.setUser({id:owner});await w.setUser({id:'student'});resolve({admin:true,userId:owner});await pending;assert.equal(w.allowed(),false);
});
test('server role checks bind to verified immutable identity and ignore editable metadata',async()=>{
 const request=()=>new Request('https://road.test/api/admin-access',{headers:{Authorization:'Bearer mock-session'}});
 const fakeUser={id:'attacker',email,user_metadata:{road_to_cele_admin:true},app_metadata:{}};
 const denied=await handleAdminAccess(request(),{}, {fetcher:async()=>Response.json(fakeUser)});assert.equal((await denied.json()).admin,false);
 const allowed=await handleAdminAccess(request(),{}, {fetcher:async()=>Response.json({id:owner,email,app_metadata:{}})});assert.equal((await allowed.json()).admin,true);
 const wrongName=await handleAdminAccess(request(),{}, {fetcher:async()=>Response.json({id:owner,email:'wrong@example.com',app_metadata:{}})});assert.equal((await wrongName.json()).admin,false);
 const trusted=await handleAdminAccess(request(),{}, {fetcher:async()=>Response.json({id:'other-admin',app_metadata:{road_to_cele_admin:true}})});assert.equal((await trusted.json()).admin,true);
 const invalid=await handleAdminAccess(request(),{}, {fetcher:async()=>Response.json({error:'invalid'},{status:401})});assert.equal(invalid.status,401);
 const unauth=await handleAdminAccess(new Request('https://road.test/api/admin-access'),{});assert.equal(unauth.status,401);
 const post=await handleAdminAccess(new Request('https://road.test/api/admin-access',{method:'POST'}),{});assert.equal(post.status,405);
});
