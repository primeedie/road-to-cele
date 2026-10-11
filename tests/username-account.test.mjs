import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
import {setupAccount} from '../src/account-browser.mjs';
import {newProgress} from '../src/progression.mjs';
import {saveProgress,STORAGE_KEY} from '../src/storage.mjs';
import {normalizeUsername,usernameIdentifier,accountName} from '../src/username-account.mjs';

test('username identifiers are case-insensitive and never displayed as email addresses',()=>{
 assert.equal(normalizeUsername(' Sky_Builder '),'sky_builder');
 assert.equal(usernameIdentifier('Sky_Builder'),'sky_builder@accounts.road-to-cele.invalid');
 assert.equal(accountName({email:usernameIdentifier('Sky_Builder')}),'sky_builder');
 for(const name of ['a','user@elsewhere.com','bad name','x'.repeat(25),'a<script>'])assert.throws(()=>usernameIdentifier(name));
});

test('username signup and login share cloud progress while retaining Google and guest-import choices',async()=>{
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://road.test/'}),doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const guest=newProgress();guest.academicYear=2;saveProgress(dom.window.localStorage,guest);const before=dom.window.localStorage.getItem(STORAGE_KEY);
 let enabled=false,signupArgs,signinArgs;
 const user={id:'username-student',email:usernameIdentifier('Builder'),user_metadata:{username:'builder'}};
 const client={auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session:null},error:null}),
  signUp:async args=>{signupArgs=args;return {data:{session:{user}},error:null};},
  signInWithPassword:async args=>{signinArgs=args;return {data:{session:{user}},error:null};}
 },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),rpc:async()=>({data:{saved:true,revision:1},error:null})};
 const setup=setupAccount({storage:dom.window.localStorage,document:doc,onProgress:()=>{},config:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client,settingsFetcher:async()=>({mailer_autoconfirm:enabled})});
 const click=action=>doc.querySelector(`[data-account="${action}"]`).click();
 const submit=async values=>{const form=doc.querySelector('[data-username-form]');for(const [name,value] of Object.entries(values))form.elements.namedItem(name).value=value;form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,5));};
 try{
  await setup.start();click('open');assert.ok(doc.querySelector('[data-account="login"]'));assert.equal(doc.querySelector('[type="email"]'),null);
  click('username-signup');
  await submit({username:'Builder',password:'test-password-long',confirmPassword:'different-password'});
  assert.equal(signupArgs,undefined);assert.match(doc.querySelector('#account-dialog').textContent,/do not match/);
  await submit({username:'Builder',password:'test-password-long',confirmPassword:'test-password-long'});
  assert.equal(signupArgs,undefined);assert.match(doc.querySelector('#account-dialog').textContent,/awaiting setup/);
  assert.equal(doc.querySelector('[name="password"]').value,'');
  enabled=true;await submit({username:'Builder',password:'test-password-long',confirmPassword:'test-password-long'});
  assert.deepEqual(signupArgs,{email:usernameIdentifier('Builder'),password:'test-password-long',options:{data:{username:'builder'}}});
  assert.equal(setup.model.state().choice,'import');assert.match(doc.querySelector('#account-panel').textContent,/builder/);
  assert.ok(!doc.querySelector('#account-dialog').textContent.includes('.invalid'));
  assert.equal(dom.window.localStorage.getItem(STORAGE_KEY),before);
  await setup.model.setUser(null);click('open');click('username-signin');
  await submit({username:'BUILDER',password:'test-password-long'});
  assert.deepEqual(signinArgs,{email:usernameIdentifier('Builder'),password:'test-password-long'});
  assert.equal(setup.model.state().choice,'import');
  for(let i=0;i<dom.window.localStorage.length;i++)assert.ok(!dom.window.localStorage.getItem(dom.window.localStorage.key(i)).includes('test-password-long'));
 }finally{dom.window.close();}
});

test('signup hook permits Google and valid username identifiers but rejects real-email password signups and public calls',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role supabase_auth_admin;');
  const sql=await readFile(new URL('../supabase/migrations/202610110002_username_signup.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const check=async(provider,email,username)=>{const result=await db.query('select public.road_to_cele_before_signup($1::jsonb) result',[JSON.stringify({user:{email,app_metadata:{provider},user_metadata:{username}}})]);return result.rows[0].result;};
  await db.exec('set role supabase_auth_admin');
  assert.deepEqual(await check('google','student@gmail.com'),{});
  assert.deepEqual(await check('email',usernameIdentifier('builder'),'builder'),{});
  for(const [provider,email,name] of [['email','student@gmail.com','builder'],['email',usernameIdentifier('builder'),'other'],['email','@accounts.road-to-cele.invalid',''],['phone','',''],[null,null,null]]){
   assert.equal((await check(provider,email,name)).error.http_code,400);
  }
  for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(check('google','student@gmail.com'),/permission denied/);}
 }finally{await db.close();}
});
