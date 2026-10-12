import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setupAccount} from '../src/account-browser.mjs';
import {usernameIdentifier} from '../src/username-account.mjs';
const delay=()=>new Promise(r=>setTimeout(r,10));
test('Show/Hide retains entered values; recovery confirms passwords and never stores plaintext codes or passwords',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test'}),doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
 const user={id:'alice',email:usernameIdentifier('alice')},calls=[],codes=Array.from({length:8},(_,i)=>String(i).repeat(8)+'-ABCDEF01-23456789-ABCDEF01');
 const client={auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session:{user,access_token:'student-token'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),rpc:async()=>({data:{saved:true,revision:1},error:null})};
 const setup=setupAccount({storage:dom.window.localStorage,document:doc,onProgress:()=>{},config:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client,recoveryFetcher:async(path,options)=>{const data=options.body?JSON.parse(options.body):null;calls.push(data);return Response.json(data?data.action==='issue'?{codes}:{recovered:true}:{available:true});}});
 const click=action=>doc.querySelector(`[data-account="${action}"]`).click();
 const submit=async(values)=>{const form=doc.querySelector('[data-recovery-form]');for(const [k,v] of Object.entries(values))form.elements.namedItem(k).value=v;form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await delay();};
 try{
  await setup.start();click('open');click('recovery-codes');await delay();
  const password=doc.querySelector('[name="password"]');password.value='private-password';const toggle=doc.querySelector('[data-password-toggle]');toggle.click();assert.equal(password.type,'text');assert.equal(password.value,'private-password');assert.equal(toggle.getAttribute('aria-pressed'),'true');toggle.click();assert.equal(password.type,'password');
  await submit({password:'private-password'});assert.equal(doc.querySelectorAll('.recovery-codes code').length,8);assert.equal(doc.querySelector('[data-account="finish-codes"]').disabled,true);
  for(let i=0;i<dom.window.localStorage.length;i++){const stored=dom.window.localStorage.getItem(dom.window.localStorage.key(i));assert.ok(!stored.includes('private-password'));assert.ok(!stored.includes(codes[0]));}
  const saved=doc.querySelector('[data-recovery-saved]');saved.checked=true;saved.dispatchEvent(new dom.window.Event('change',{bubbles:true}));click('finish-codes');assert.equal(doc.querySelector('.recovery-codes'),null);
  await setup.model.setUser(null);click('open');click('recover');await delay();
  await submit({username:'ALICE',code:codes[0],password:'new-password',confirmPassword:'different'});assert.ok(!calls.some(c=>c?.action==='recover'));assert.match(doc.querySelector('#account-dialog').textContent,/do not match/);
  await submit({username:'ALICE',code:codes[0],password:'new-password',confirmPassword:'new-password'});assert.deepEqual(calls.at(-1),{action:'recover',username:'alice',code:codes[0],password:'new-password'});assert.match(doc.querySelector('#account-dialog').textContent,/Password updated/);
  click('recovery-back');assert.ok(doc.querySelector('[data-account="login"]'));assert.ok(doc.querySelector('[data-username-form]'));
 }finally{dom.window.close();}
});
