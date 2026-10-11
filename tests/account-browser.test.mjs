import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { setupAccount } from '../src/account-browser.mjs';
import { newProgress } from '../src/progression.mjs';
import { STORAGE_KEY, saveProgress } from '../src/storage.mjs';

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
 doc.querySelector('[data-account="login"]').click();await new Promise(resolve=>setTimeout(resolve,0));
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
