import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {BATCH_IDS,batchSelect,parseBatchId,studentBatch} from '../src/student-profile.mjs';
import {setupAccount} from '../src/account-browser.mjs';
import {newProgress} from '../src/progression.mjs';

test('batch selection permits exactly IDs 119 through 128 and rejects malformed profile values',()=>{
 const dom=new JSDOM(batchSelect()),select=dom.window.document.querySelector('select');
 assert.equal(select.required,true);assert.equal(select.value,'');
 assert.deepEqual([...select.options].slice(1).map(o=>+o.value),BATCH_IDS);
 for(const id of BATCH_IDS){assert.equal(parseBatchId(String(id)),id);assert.equal(studentBatch({user_metadata:{batch_id:id}}),id);}
 for(const invalid of ['',null,118,129,'119.0','1e2','<script>',true]){assert.throws(()=>parseBatchId(invalid));assert.equal(studentBatch({user_metadata:{batch_id:invalid}}),null);}
 dom.window.close();
});

test('Google and existing accounts choose a batch without replacing their journey or reloading cloud records',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/'}),doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const progress=newProgress();progress.academicYear=3;progress.academicRecords.FNDMATH={status:'COMPLETED',events:[]};
 let user={id:'google-student',email:'student@example.test',user_metadata:{full_name:'Student'}},reads=0,writes=0,callback,fail=true,args;
 const client={auth:{onAuthStateChange:fn=>callback=fn,getSession:async()=>({data:{session:{user}},error:null}),updateUser:async input=>{args=input;if(fail)return {data:{user:null},error:Error('offline')};user={...user,user_metadata:{...user.user_metadata,...input.data}};callback('USER_UPDATED',{user});return {data:{user},error:null};}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{reads++;return {data:{progress,revision:7},error:null};}})})}),rpc:async()=>{writes++;return {data:{saved:true,revision:8},error:null};}};
 let published=0;const account=setupAccount({document:doc,storage:dom.window.localStorage,onProgress:()=>published++,config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client});
 const submit=async()=>{doc.querySelector('[data-profile-form]').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,10));};
 try{
  await account.start();assert.equal(doc.querySelector('dialog').open,true);assert.ok(doc.querySelector('[data-profile-form]'));const before=account.model.progress(),publishedBefore=published;
  doc.querySelector('[name="batchId"]').value='127';await submit();assert.match(doc.querySelector('.account-dialog-error').textContent,/could not be saved/);assert.equal(studentBatch(account.model.state().user),null);assert.equal(doc.querySelector('[name="batchId"]').value,'127');
  fail=false;await submit();assert.deepEqual(args,{data:{batch_id:127}});assert.equal(studentBatch(account.model.state().user),127);assert.match(doc.querySelector('.profile-save-state').textContent,/Batch saved/);assert.equal(doc.querySelector('[name="batchId"]').value,'127');
  assert.deepEqual(account.model.progress(),before);assert.equal(reads,1);assert.equal(writes,0);assert.equal(published,publishedBefore);assert.equal(account.model.state().user.user_metadata.full_name,'Student');
 }finally{dom.window.close();}
});

test('identity sharing requires an explicit settings save, can be revoked, and never changes academic progress',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/'}),doc=dom.window.document,w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let user={id:'owner',email:'freshmilchh@accounts.road-to-cele.invalid',user_metadata:{batch_id:122,username:'freshmilchh'}},updates=[];
 const p=newProgress();p.academicRecords.FNDMATH={status:'COMPLETED',events:[]};
 const client={auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user}}}),updateUser:async data=>{updates.push(data);user={...user,user_metadata:{...user.user_metadata,...data.data}};return {data:{user}};}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{progress:p,revision:1}})})})}),rpc:async()=>({data:{saved:true,revision:2}})};
 const account=setupAccount({document:doc,storage:w.localStorage,config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client,onProgress:()=>{}});
 try{await account.start();doc.querySelector('[data-account="open"]').click();const before=account.model.progress();assert.equal(doc.querySelector('[name="showLeaderboardIdentity"]').checked,false);
  for(const share of [true,false]){const form=doc.querySelector('[data-leaderboard-privacy-form]');form.elements.namedItem('showLeaderboardIdentity').checked=share;form.elements.namedItem('showLeaderboardIdentity').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(updates.length,share?0:1);form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,5));assert.equal(account.model.state().user.user_metadata.leaderboard_show_identity,share);assert.equal(doc.querySelector('[name="showLeaderboardIdentity"]').checked,share);}
  assert.deepEqual(updates,[{data:{display_name:null,leaderboard_show_identity:true}},{data:{display_name:null,leaderboard_show_identity:false}}]);assert.deepEqual(account.model.progress(),before);assert.equal(account.model.state().user.user_metadata.batch_id,122);assert.match(doc.querySelector('.leaderboard-privacy-status').textContent,/anonymous/);
 }finally{dom.window.close();}
});
