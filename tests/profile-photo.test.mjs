import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {JSDOM} from 'jsdom';
import {prepareProfilePhoto,normalizeProfilePhoto,withProfilePhoto,validatePhotoFile,PHOTO_SIZE,PHOTO_MAX_DATA_LENGTH} from '../src/profile-photo.mjs';
import {setupAccount} from '../src/account-browser.mjs';
import {accountMarkup} from '../src/account-ui.mjs';
import {newProgress,progressSummary,recordAcademicProgress} from '../src/progression.mjs';
import {hydrateProgress,STORAGE_KEY} from '../src/storage.mjs';
const source=createCanvas(600,300),ctx=source.getContext('2d');ctx.fillStyle='#e33232';ctx.fillRect(0,0,600,300);ctx.fillStyle='#2266cc';ctx.fillRect(150,0,300,300);
const png=source.toBuffer('image/png'),photo=source.toDataURL('image/jpeg',.8),tick=()=>new Promise(r=>setTimeout(r,0));
test('uploads are square cropped and re-encoded to a small JPEG; native output keeps the centered area, not side edges',async()=>{
 let disposed=0;
 const result=await prepareProfilePhoto({size:png.length,type:'image/png'},{decode:async()=>({image:await loadImage(png),dispose:()=>disposed++}),createCanvas:()=>createCanvas(1,1)});
 assert.equal(normalizeProfilePhoto(result),result);assert.ok(result.length<=PHOTO_MAX_DATA_LENGTH);assert.equal(disposed,1);
 const image=await loadImage(Buffer.from(result.slice(23),'base64'));assert.equal(image.width,PHOTO_SIZE);assert.equal(image.height,PHOTO_SIZE);
 const output=createCanvas(PHOTO_SIZE,PHOTO_SIZE),c=output.getContext('2d');c.drawImage(image,0,0);for(const x of [5,128,250]){const p=c.getImageData(x,128,1,1).data;assert.ok(p[2]>180&&p[0]<80,'centered blue region survives the crop');}
});
test('invalid/oversized files and unsafe persisted URLs are rejected without changing academic data',async()=>{
 for(const file of [null,{type:'image/svg+xml',size:100},{type:'text/html',size:100},{type:'image/jpeg',size:0},{type:'image/png',size:11*1024*1024}])assert.throws(()=>validatePhotoFile(file));
 for(const value of ['javascript:alert(1)','https://tracker.test/photo.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,PHNjcmlwdD4=','data:image/jpeg;base64,'+'A'.repeat(PHOTO_MAX_DATA_LENGTH),'<img onerror=alert(1)>'])assert.equal(normalizeProfilePhoto(value),null);
 const p=newProgress();p.academicRecords.FNDMATH={status:'COMPLETED',events:[]};const changed=withProfilePhoto(p,photo);assert.equal(p.profilePhoto,undefined);assert.deepEqual(progressSummary(changed),progressSummary(p));assert.deepEqual(changed.academicRecords,p.academicRecords);assert.equal(hydrateProgress(changed).profilePhoto,photo);assert.deepEqual(withProfilePhoto(changed,null),p);
 const bad=hydrateProgress({...p,profilePhoto:'data:image/svg+xml;base64,PHN2Zz4='});assert.deepEqual(bad,p);
 let disposed=0;await assert.rejects(()=>prepareProfilePhoto({type:'image/png',size:100},{decode:async()=>({image:{width:10000,height:10000},dispose:()=>disposed++})}),/megapixels/);assert.equal(disposed,1);
 const dom=new JSDOM(accountMarkup({user:{user_metadata:{username:'photo-user'}},phase:'saved'},{photo:'"><script>bad</script>'}));assert.equal(dom.window.document.querySelector('img'),null);assert.equal(dom.window.document.querySelector('script'),null);dom.window.close();
});
function fixture(processor=async()=>photo){
 const dom=new JSDOM('<div id="account-panel"></div><dialog id="account-dialog"></dialog>',{url:'https://photo.test/'}),w=dom.window,doc=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const user={id:'photo-owner',email:'photo@accounts.road-to-cele.invalid',user_metadata:{username:'photo-owner',batch_id:122}},other={id:'other-owner',user_metadata:{username:'other-owner',batch_id:123}},rows=new Map(),writes=[],changes=[];
 const p=newProgress();p.academicRecords.FNDMATH={status:'COMPLETED',takenInTerm:1,events:[]};rows.set(user.id,{progress:p,revision:3});rows.set(other.id,{progress:newProgress(),revision:1});let fail=false;
 const client={auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session:{user}},error:null}),updateUser:()=>{throw Error('Photos must not go into Auth metadata');}},from:()=>({select:()=>({eq:(_,id)=>({maybeSingle:async()=>({data:structuredClone(rows.get(id)),error:null})})})}),rpc:async(name,args)=>{
  assert.equal(name,'save_student_progress');writes.push(structuredClone(args));if(fail)return {error:Error('offline')};const revision=rows.get(args.p_user_id).revision+1;rows.set(args.p_user_id,{progress:structuredClone(args.p_progress),revision});return {data:{saved:true,revision},error:null};
 }};
 const setup=setupAccount({document:doc,storage:w.localStorage,onProgress:()=>{},onProfilePhotoChange:p=>changes.push(p),photoProcessor:processor,config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},clientFactory:()=>client});
 const $=s=>doc.querySelector(s),choose=async()=>{const input=$('[data-profile-photo]');Object.defineProperty(input,'files',{value:[new w.File([png],'portrait.png',{type:'image/png'})],configurable:true});input.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();};
 return {dom,w,doc,user,other,rows,writes,changes,setup,$,choose,setOffline:()=>{fail=true;}};
}
test('Account previews without saving, cancels, applies and removes an owner-scoped photo while preserving course records and displaying it in the header',async()=>{
 const f=fixture(),{$,setup,rows,user,writes}=f;
 try{
  await setup.start();$('[data-account="open"]').click();const before=setup.model.progress(),guest=f.w.localStorage.getItem(STORAGE_KEY);
  await f.choose();assert.equal(writes.length,0);assert.equal($('#account-panel img'),null);assert.equal($('.profile-photo-preview img').src,photo);assert.match($('.profile-photo-status').textContent,/Preview only/);
  $('[data-photo-action="cancel"]').click();assert.deepEqual(setup.model.progress(),before);assert.equal($('.profile-photo-preview img'),null);
  await f.choose();$('[data-photo-action="save"]').click();await setup.model.flush();await tick();
  assert.equal(rows.get(user.id).progress.profilePhoto,photo);assert.equal($('#account-panel img').src,photo);assert.match($('.profile-photo-status').textContent,/saved to your account/);assert.equal(f.changes.length,1);assert.deepEqual(rows.get(user.id).progress.academicRecords,before.academicRecords);assert.equal(f.w.localStorage.getItem(STORAGE_KEY),guest);
  const later=recordAcademicProgress(f.changes[0],'BASCHEM','ACTIVE');setup.model.save(later);await setup.model.flush();assert.equal(rows.get(user.id).progress.profilePhoto,photo);
  const cache=JSON.parse(f.w.localStorage.getItem('road-to-cele.account.v1.'+user.id));assert.equal(hydrateProgress(cache.progress).profilePhoto,photo);
  $('[data-photo-action="remove"]').click();await setup.model.flush();await tick();assert.equal(rows.get(user.id).progress.profilePhoto,undefined);assert.equal($('#account-panel img'),null);assert.equal(f.changes.length,2);assert.equal(rows.get(user.id).progress.academicRecords.FNDMATH.status,'COMPLETED');assert.equal(rows.get(user.id).progress.academicRecords.BASCHEM.status,'ACTIVE');
 }finally{f.dom.window.close();}
});
test('late image work cannot cross accounts or reappear after closing; invalid images retain the saved photo',async()=>{
 let finish;const f=fixture(()=>new Promise(r=>finish=r));
 try{
  await f.setup.start();f.$('[data-account="open"]').click();await f.choose();await f.setup.model.setUser(f.other);finish(photo);await tick();assert.equal(f.$('.profile-photo-preview img'),null);assert.equal(f.setup.model.progress().profilePhoto,undefined);assert.equal(f.writes.length,0);
  await f.setup.model.setUser(f.user);f.$('[data-account="open"]').click();await f.choose();f.$('[data-account="close"]').click();finish(photo);await tick();f.$('[data-account="open"]').click();assert.equal(f.$('[data-photo-action="save"]'),null);assert.equal(f.writes.length,0);
 }finally{f.dom.window.close();}
 const bad=fixture(async()=>{throw Error('This image could not be opened.');});try{bad.rows.get(bad.user.id).progress.profilePhoto=photo;await bad.setup.start();bad.$('[data-account="open"]').click();await bad.choose();assert.match(bad.$('.profile-photo-status').textContent,/could not be opened/);assert.equal(bad.$('.profile-photo-preview img').src,photo);assert.equal(bad.$('[data-photo-action="save"]'),null);assert.equal(bad.writes.length,0);}finally{bad.dom.window.close();}
});
test('cloud failure retains the photo in the correct account cache and reports pending sync, never a cloud save',async()=>{
 const f=fixture();try{await f.setup.start();f.setOffline();f.$('[data-account="open"]').click();await f.choose();f.$('[data-photo-action="save"]').click();await f.setup.model.flush();await tick();assert.match(f.$('.profile-photo-status').textContent,/device; cloud sync is pending/);assert.equal(f.setup.model.state().phase,'offline');assert.equal(f.rows.get(f.user.id).progress.profilePhoto,undefined);assert.equal(JSON.parse(f.w.localStorage.getItem('road-to-cele.account.v1.'+f.user.id)).progress.profilePhoto,photo);await f.setup.model.setUser(f.other);assert.equal(f.$('#account-panel img'),null);assert.equal(f.setup.model.progress().profilePhoto,undefined);}finally{f.dom.window.close();}
});
