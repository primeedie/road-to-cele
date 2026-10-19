import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {handleAccountDeletion} from '../server/account-deletion.mjs';
import {setupAccount} from '../src/account-browser.mjs';
import {newProgress} from '../src/progression.mjs';
import {accountStorageKey} from '../src/account-progress.mjs';
import {adminStorageKey} from '../src/admin-mode.mjs';
import {STORAGE_KEY} from '../src/storage.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',base='https://road.test',env={SUPABASE_RECOVERY_SECRET_KEY:'sb_secret_server_test'};
const request=(data={confirmation:'DELETE MY ACCOUNT'},headers={})=>new Request(base+'/api/account-deletion',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Authorization:'Bearer student-token',...headers},body:JSON.stringify(data)});
const tick=()=>new Promise(r=>setTimeout(r,10));
test('Pages routes forward account deletion to its server function',async()=>{
 const routes=JSON.parse(await readFile(new URL('../src/_routes.json',import.meta.url),'utf8'));
 assert.ok(routes.include.includes('/api/account-deletion'));
 assert.ok(!routes.exclude.some(path=>path==='/api/*'||path==='/api/account-deletion'||path==='/*'));
 const entry=await readFile(new URL('../functions/api/account-deletion.js',import.meta.url),'utf8');
 assert.match(entry,/handleAccountDeletion/);
});
test('deletion requires same-origin explicit confirmation and deletes only the server-verified bearer owner',async()=>{
 let calls=[];const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/auth/v1/user'))return Response.json({id:owner,email:'private@example.test'});assert.ok(url.endsWith('/auth/v1/admin/users/'+owner));return Response.json({id:owner});};
 assert.equal((await handleAccountDeletion(request(),{}, {fetcher})).status,503);assert.equal(calls.length,0);
 for(const r of [request({confirmation:'no'}),request({confirmation:'DELETE MY ACCOUNT',userId:other}),request(undefined,{Origin:'https://evil.test'}),request(undefined,{Authorization:''})]){assert.ok((await handleAccountDeletion(r,env,{fetcher})).status>=400);assert.equal(calls.length,0);}
 const result=await handleAccountDeletion(request(),env,{fetcher});assert.deepEqual(await result.json(),{deleted:true});assert.equal(calls.length,2);assert.equal(calls[0].options.headers.Authorization,'Bearer student-token');assert.equal(calls[1].options.headers.apikey,env.SUPABASE_RECOVERY_SECRET_KEY);assert.equal(calls[1].options.method,'DELETE');assert.deepEqual(JSON.parse(calls[1].options.body),{should_soft_delete:false});assert.equal(result.headers.get('Cache-Control'),'no-store');
 calls=[];assert.equal((await handleAccountDeletion(request(),env,{fetcher:async()=>Response.json({}, {status:401})})).status,401);assert.equal(calls.length,0);
 assert.equal((await handleAccountDeletion(request(),env,{fetcher:async()=>{throw Error('private server detail');}})).status,503);
});
function fixture(fetcher){
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:base}),w=dom.window,doc=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 let user={id:owner,email:'freshmilchh@accounts.road-to-cele.invalid',user_metadata:{username:'freshmilchh',batch_id:122}},callback,signouts=0;
 const progress=newProgress();progress.academicRecords.FNDMATH={status:'COMPLETED',events:[]};
 const guest={...newProgress(),academicYear:2};w.localStorage.setItem(STORAGE_KEY,JSON.stringify(guest));w.localStorage.setItem(accountStorageKey(other),'unrelated account');w.localStorage.setItem(adminStorageKey(owner),'admin workspace');
 const client={auth:{onAuthStateChange:fn=>callback=fn,getSession:async()=>({data:{session:user?{user,access_token:'student-token'}:null}}),signOut:async()=>{signouts++;user=null;callback('SIGNED_OUT',null);return {error:null};}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{progress,revision:1}})})})}),rpc:async()=>({data:{saved:true,revision:2}})};
 const messages=[],account=setupAccount({document:doc,storage:w.localStorage,config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client,deletionFetcher:fetcher,onProgress:()=>{},onError:message=>messages.push(message)}),$=s=>doc.querySelector(s),click=s=>$(s).click();
 return {dom,w,doc,account,$,click,messages,guest,get signouts(){return signouts;},otherUser(){user={...user,id:other,email:'other@example.test'};return account.model.setUser(user);}};
}
test('settings delete option can cancel, requires typed confirmation, and clears only the deleted account after confirmed success',async()=>{
 let posts=0;const f=fixture(async(path,options)=>{if(!options?.method)return Response.json({available:true});posts++;assert.equal(options.headers.Authorization,'Bearer student-token');assert.deepEqual(JSON.parse(options.body),{confirmation:'DELETE MY ACCOUNT'});return Response.json({deleted:true});});
 try{
  await f.account.start();f.click('[data-account="open"]');f.click('[data-account="delete-account"]');await tick();assert.ok(f.$('[data-account-deletion-form]'));f.click('[data-account="cancel-deletion"]');assert.equal(posts,0);assert.ok(f.account.model.state().user);
  f.click('[data-account="delete-account"]');await tick();let form=f.$('[data-account-deletion-form]');form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(posts,0);assert.match(f.$('.account-dialog-error').textContent,/Type DELETE MY ACCOUNT/);
  form=f.$('[data-account-deletion-form]');form.elements.namedItem('confirmation').value='DELETE MY ACCOUNT';form.elements.namedItem('acknowledge').checked=true;form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(posts,1);assert.equal(f.signouts,1);assert.equal(f.account.model.state().user,null);assert.equal(f.w.localStorage.getItem(accountStorageKey(owner)),null);assert.equal(f.w.localStorage.getItem(adminStorageKey(owner)),null);assert.equal(f.w.localStorage.getItem(accountStorageKey(other)),'unrelated account');assert.deepEqual(JSON.parse(f.w.localStorage.getItem(STORAGE_KEY)),f.guest);assert.match(f.messages.at(-1),/has been deleted/);
 }finally{f.dom.window.close();}
});
test('closing or changing account cancels pending deletion setup; failed deletion preserves the account and saved journey',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));
 try{await f.account.start();f.click('[data-account="open"]');f.click('[data-account="delete-account"]');await f.otherUser();resolve(Response.json({available:true}));await tick();assert.equal(f.$('[data-account-deletion-form]'),null);assert.equal(f.account.model.state().user.id,other);}finally{f.dom.window.close();}
 const g=fixture(async(path,options)=>options?.method?Response.json({error:'Unavailable'},{status:503}):Response.json({available:true}));
 try{await g.account.start();const before=g.account.model.progress();g.click('[data-account="open"]');g.click('[data-account="delete-account"]');await tick();const form=g.$('[data-account-deletion-form]');form.elements.namedItem('confirmation').value='DELETE MY ACCOUNT';form.elements.namedItem('acknowledge').checked=true;form.dispatchEvent(new g.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(g.account.model.state().user.id,owner);assert.deepEqual(g.account.model.progress(),before);assert.equal(g.signouts,0);assert.match(g.$('.account-dialog-error').textContent,/Unavailable/);}finally{g.dom.window.close();}
});
