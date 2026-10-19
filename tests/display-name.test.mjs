import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {parseDisplayName,customDisplayName} from '../src/display-name.mjs';
import {accountName} from '../src/username-account.mjs';
import {publicLeaderboardName,leaderboardPrivacyForm} from '../src/leaderboard-privacy.mjs';
import {setupAccount} from '../src/account-browser.mjs';
import {newProgress} from '../src/progression.mjs';

test('custom display names support Unicode, escape markup, and never fall back to a real name after an invalid custom value',()=>{
 assert.equal(parseDisplayName('  Sky Builder  '),'Sky Builder');assert.equal(parseDisplayName('  '),null);assert.equal(parseDisplayName('🌟'.repeat(60)),'🌟'.repeat(60));
 for(const name of ['x'.repeat(61),'mail@example.test','bad\nname',42,{}])assert.throws(()=>parseDisplayName(name));
 const user={email:'private@example.test',user_metadata:{full_name:'Private full name',display_name:'<Sky & Stars>'}};
 assert.equal(accountName(user),'<Sky & Stars>');assert.equal(publicLeaderboardName(user),'<Sky & Stars>');
 const dom=new JSDOM(leaderboardPrivacyForm(user));assert.equal(dom.window.document.querySelector('input[name="displayName"]').value,'<Sky & Stars>');assert.equal(dom.window.document.querySelector('sky'),null);assert.equal(dom.window.document.querySelector('[type="checkbox"]').checked,false);dom.window.close();
 assert.equal(publicLeaderboardName({...user,user_metadata:{...user.user_metadata,display_name:42}}),null);
 assert.equal(customDisplayName({...user,user_metadata:{display_name:null}}),null);
});

test('saving a display name is explicit, keeps login and grades, and blocks custom-name sharing until the server supports it',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/'}),w=dom.window,doc=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let user={id:'student',email:'private@example.test',user_metadata:{batch_id:122,full_name:'Private full name'}},updates=[],missing=true,fail=false;
 const p=newProgress();p.academicRecords.FNDMATH={status:'COMPLETED',events:[]};
 const client={auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user}}}),updateUser:async input=>{updates.push(input);if(fail)return {error:Error('offline')};user={...user,user_metadata:{...user.user_metadata,...input.data}};return {data:{user}};}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{progress:p,revision:1}})})})}),rpc:async name=>{assert.equal(name,'get_batch_leaderboard_v2');return {error:missing?{code:'PGRST202'}:null};}};
 const account=setupAccount({document:doc,storage:w.localStorage,onProgress:()=>{},config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client});
 const field=()=>doc.querySelector('[name="displayName"]'),share=()=>doc.querySelector('[name="showLeaderboardIdentity"]'),submit=async()=>{doc.querySelector('[data-leaderboard-privacy-form]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,5));};
 try{
  await account.start();doc.querySelector('[data-account="open"]').click();const before=account.model.progress();field().value='Sky Builder';assert.equal(updates.length,0);assert.equal(accountName(account.model.state().user),'Private full name');
  await submit();assert.equal(accountName(account.model.state().user),'Sky Builder');assert.equal(publicLeaderboardName(account.model.state().user),'Sky Builder');assert.equal(user.user_metadata.leaderboard_show_identity,false);assert.equal(user.user_metadata.full_name,'Private full name');assert.equal(user.email,'private@example.test');assert.deepEqual(account.model.progress(),before);
  share().checked=true;await submit();assert.equal(updates.length,1);assert.match(doc.querySelector('.account-dialog-error').textContent,/awaiting database setup/);assert.equal(user.user_metadata.leaderboard_show_identity,false);
  missing=false;await submit();assert.equal(user.user_metadata.leaderboard_show_identity,true);assert.match(doc.querySelector('#account-panel').textContent,/Sky Builder/);
  fail=true;field().value='New draft';await submit();assert.equal(accountName(account.model.state().user),'Sky Builder');assert.equal(field().value,'New draft');assert.match(doc.querySelector('.account-dialog-error').textContent,/could not be saved/);
  fail=false;field().value='';share().checked=false;await submit();assert.equal(user.user_metadata.display_name,null);assert.equal(accountName(account.model.state().user),'Private full name');assert.deepEqual(account.model.progress(),before);
 }finally{dom.window.close();}
});
