import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {accountStorageKey} from '../src/account-progress.mjs';
import {adminStorageKey} from '../src/admin-mode.mjs';
const owner='747ef767-6a10-4eac-9c93-f3af9e03d737';
test('actual admin controls switch isolated journeys, bypass course locks and reset only the admin workspace',async()=>{
 const src=fileURLToPath(new URL('../src/',import.meta.url)),html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
 const bundle=await build({entryPoints:[src+'app.js'],bundle:true,write:false,format:'esm',platform:'browser',plugins:[{name:'account-fixture',setup(b){
  b.onResolve({filter:/account-browser\.mjs$/},()=>({path:'account-fixture',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({resolveDir:src,contents:`import {createAccountProgress} from './account-progress.mjs';import {newProgress} from './progression.mjs';import {accountMarkup} from './account-ui.mjs';
   export function setupAccount({storage,document,onProgress,onIdentity}){const model=createAccountProgress({storage,service:{read:async()=>({progress:newProgress(),revision:1}),write:async()=>({revision:2})},onProgress,onState:s=>{document.querySelector('#account-panel').innerHTML=accountMarkup(s);onIdentity(s.user);}});globalThis.adminTestModel=model;return {model,getAccessToken:async()=>'mock-session',start:async()=>model.setUser({id:'${owner}',email:'freshmilchh@accounts.road-to-cele.invalid',user_metadata:{batch_id:122}})};}` }));
 }}]});
 const dom=new JSDOM(html,{url:'https://admin.test/',pretendToBeVisual:true}),w=dom.window,previous={};
 for(const name of ['document','window','localStorage','ResizeObserver','requestAnimationFrame','fetch','setTimeout','adminTestModel'])previous[name]=globalThis[name];
 const timer=globalThis.setTimeout,timers=[];
 Object.assign(globalThis,{document:w.document,window:w,localStorage:w.localStorage,ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),setTimeout:(fn,ms,...args)=>{const id=timer(fn,ms,...args);timers.push(id);return id;},fetch:async()=>{const id=globalThis.adminTestModel.state().user?.id;return Response.json({admin:id===owner,userId:id});}});
 w.scrollTo=()=>{};w.HTMLElement.prototype.getBoundingClientRect=()=>({width:800,height:500,left:0,top:0});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),click=s=>$(s).click();
 try{
  await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  for(let i=0;i<50&&!$('[data-admin-view]');i++)await new Promise(r=>timer(r,5));
  assert.ok($('[data-admin-view="admin"]'));const studentBefore=w.localStorage.getItem(accountStorageKey(owner));
  click('[data-course="CEFOUND"]');assert.ok($('#course-tab-3').disabled);assert.ok($('#course-card [data-academic]').disabled);assert.equal($('#reset-progress').hidden,false);
  click('[data-admin-view="admin"]');click('#companion-button');assert.equal($('[data-frame="starbound"]').disabled,false);click('[data-frame="starbound"]');assert.equal(JSON.parse(w.localStorage.getItem(adminStorageKey(owner))).cosmetics.frame,'starbound');click('[data-action="close-wardrobe"]');click('[data-course="CEFOUND"]');assert.equal($('#course-tab-3').disabled,false);assert.equal($('#course-card [data-academic]').disabled,false);
  click('[data-academic="ACTIVE"]');assert.equal(JSON.parse(w.localStorage.getItem(adminStorageKey(owner))).academicRecords.CEFOUND.status,'ACTIVE');assert.equal(w.localStorage.getItem(accountStorageKey(owner)),studentBefore);
  click('[data-admin-view="student"]');click('[data-course="CEFOUND"]');assert.ok($('#course-tab-3').disabled);assert.equal($('#reset-progress').hidden,false);
  click('[data-admin-view="admin"]');click('#reset-progress');assert.equal($('#reset-dialog').open,true);click('#cancel-reset');assert.equal(JSON.parse(w.localStorage.getItem(adminStorageKey(owner))).academicRecords.CEFOUND.status,'ACTIVE');
  click('#reset-progress');click('[data-action="confirm-reset"]');assert.deepEqual(JSON.parse(w.localStorage.getItem(adminStorageKey(owner))).academicRecords,{});assert.equal(w.localStorage.getItem(accountStorageKey(owner)),studentBefore);
  await globalThis.adminTestModel.setUser(null);assert.equal($('[data-admin-view]'),null);assert.equal($('#reset-progress').hidden,false);
 }finally{timers.forEach(clearTimeout);w.close();Object.assign(globalThis,previous);}
});
