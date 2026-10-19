import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { setupAccount } from '../src/account-browser.mjs';
import { newProgress } from '../src/progression.mjs';
import { STORAGE_KEY, saveProgress } from '../src/storage.mjs';

test('Google sign-in clicked during SDK startup waits for the shared connection and remains retryable',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/'}),doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 let resolveClient,factories=0,subscriptions=0,oauthCalls=0,fail=true;const errors=[];
 const client={auth:{onAuthStateChange:()=>{subscriptions++;},getSession:async()=>({data:{session:null},error:null}),signInWithOAuth:async options=>{oauthCalls++;assert.equal(options.provider,'google');assert.equal(options.options.redirectTo,'https://road.test/');return {error:fail?Error('temporary network failure'):null};}}};
 const setup=setupAccount({document:doc,storage:dom.window.localStorage,onProgress:()=>{},onError:e=>errors.push(e),config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>{factories++;return new Promise(r=>resolveClient=r);}});
 try{
  const connecting=setup.start();doc.querySelector('[data-account="open"]').click();doc.querySelector('[data-account="login"]').click();
  assert.equal(oauthCalls,0);assert.equal(errors.length,0);assert.equal(doc.querySelector('[data-account="login"]').disabled,true);
  resolveClient(client);await connecting;await new Promise(r=>setTimeout(r,0));
  assert.equal(factories,1);assert.equal(subscriptions,1);assert.equal(oauthCalls,1);assert.equal(errors.length,1);
  assert.equal(doc.querySelector('[data-username-form] [type="submit"]').disabled,false);
  assert.equal(doc.querySelector('[data-account="login"]').disabled,false);
  fail=false;doc.querySelector('[data-account="login"]').click();await new Promise(r=>setTimeout(r,0));assert.equal(oauthCalls,2);
  await setup.start();assert.equal(subscriptions,1);assert.equal(factories,1);
 }finally{dom.window.close();}
});

test('account UI uses Google PKCE login, imports only after a choice, and sign-out restores guest',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/'}),doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const guest=newProgress();guest.academicYear=2;saveProgress(dom.window.localStorage,guest);
 let callback,oauthOptions,clientOptions,signoutOptions,active=null,row=null;const snapshots=[];
 const client={auth:{
  onAuthStateChange:fn=>{callback=fn;},getSession:async()=>({data:{session:null},error:null}),
  signInWithOAuth:async options=>{oauthOptions=options;return {error:null};},
  signOut:async options=>{signoutOptions=options;active=null;callback('SIGNED_OUT',null);return {error:null};}
 },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})}),
 rpc:async(name,args)=>{assert.equal(name,'save_student_progress');assert.equal(args.p_user_id,active.id);row={progress:structuredClone(args.p_progress),revision:(row?.revision||0)+1};return {data:{saved:true,revision:row.revision},error:null};}};
 const setup=setupAccount({document:doc,storage:dom.window.localStorage,onProgress:p=>snapshots.push(p),config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:(url,key,options)=>{clientOptions=options;return client;}});
 await setup.start();assert.equal(clientOptions.auth.flowType,'pkce');
 doc.querySelector('[data-account="open"]').click();doc.querySelector('[data-account="login"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(oauthOptions.provider,'google');assert.equal(oauthOptions.options.redirectTo,'https://road.test/');
 active={id:'student',email:'student@example.test'};callback('SIGNED_IN',{user:active});await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(doc.querySelector('#account-dialog').open,true);assert.equal(row,null);
 doc.querySelector('[data-account="guest"]').click();await setup.model.flush();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(row.progress.academicYear,2);assert.match(doc.querySelector('#account-panel').textContent,/Cloud saved/);
 const next=newProgress();next.academicYear=3;setup.model.save(next);await setup.model.flush();
 doc.querySelector('[data-account="open"]').click();doc.querySelector('[data-account="logout"]').click();
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(signoutOptions,{scope:'local'});
 assert.equal(setup.model.progress().academicYear,2);assert.equal(JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY)).academicYear,2);assert.equal(row.progress.academicYear,3);
 dom.window.close();
});

test('pending cloud saves require explicit sign-out and retain a recoverable account cache',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/'}),doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let fail=false,signouts=0;const user={id:'offline-student',email:'offline@example.test'};
 const client={auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session:{user}},error:null}),signOut:async()=>{signouts++;return {error:null};}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{progress:newProgress(),revision:1},error:null})})})}),rpc:async()=>({data:null,error:fail?Error('offline'):null})};
 const setup=setupAccount({document:doc,storage:dom.window.localStorage,onProgress:()=>{},config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client});
 await setup.start();fail=true;const p=newProgress();p.academicYear=3;setup.model.save(p);await setup.model.flush();
 doc.querySelector('[data-account="open"]').click();doc.querySelector('[data-account="logout"]').click();await setup.model.flush();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(signouts,0);assert.ok(doc.querySelector('[data-account="logout-anyway"]'));assert.match(doc.querySelector('#account-dialog').textContent,/cloud save is pending/);
 doc.querySelector('[data-account="logout-anyway"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(signouts,1);assert.equal(setup.model.state().user,null);
 const cache=JSON.parse(dom.window.localStorage.getItem('road-to-cele.account.v1.offline-student'));assert.equal(cache.dirty,true);assert.equal(cache.progress.academicYear,3);dom.window.close();
});

test('canceled Google authorization is explained and error query values are removed from the URL',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/?error=access_denied&error_description=denied'}),doc=dom.window.document,errors=[];
 const client={auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session:null},error:null})}};
 const setup=setupAccount({document:doc,storage:dom.window.localStorage,onProgress:()=>{},onError:e=>errors.push(e),config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client});
 await setup.start();assert.equal(dom.window.location.search,'');assert.match(errors[0],/Google sign-in did not finish/);assert.equal(setup.model.state().ready,true);dom.window.close();
});
