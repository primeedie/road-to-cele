import { cloudConfig } from './runtime-config.mjs';
import { createAccountProgress } from './account-progress.mjs';
import { cloudService } from './cloud-service.mjs';
import { accountMarkup, accountDialogMarkup } from './account-ui.mjs';
import { attachBackdropDismiss } from './dialog-dismiss.mjs';
import { usernameForm, usernameCredentials, usernameAuthError, USERNAME_DOMAIN, accountName } from './username-account.mjs';
import { recoveryMarkup, recoveryInput, recoveryRequest, downloadRecoveryCodes } from './recovery-account.mjs';
import {studentBatch,parseBatchId} from './student-profile.mjs';
import {createProfilePhotoEditor} from './profile-photo.mjs';
import {sharesLeaderboardIdentity} from './leaderboard-privacy.mjs';
import {loadBatchLeaderboard} from './leaderboard-service.mjs';
import {accountDeletionMarkup,requestAccountDeletion,removeDeletedAccountCopies,ACCOUNT_DELETION_PHRASE} from './account-deletion.mjs';

export function setupAccount({storage,document,onProgress,onIdentity=()=>{},onProfilePhotoChange=()=>{},onError=()=>{},config=cloudConfig,clientFactory=null,settingsFetcher=null,recoveryFetcher=null,deletionFetcher=null,photoProcessor}) {
 let client=null,model,photoEditor,error='',startPromise=null,busy=false,confirmSignout=false,usernameMode='signin';
 const configured=!!config.url;
 const service=configured?{
  read:id=>cloudService(client).read(id),
  write:(p,r,id)=>cloudService(client).write(p,r,id)
 }:null;
 const dialog=document.querySelector('#account-dialog');
 let recoveryScreen=null,codes=[],recoveryAvailable=false,recoveryEpoch=0,paintedUser=null;
 const batchPrompted=new Set();let profileSaved=false,privacySaved=null;
 let deletionOwner=null,deletionAvailable=false,deletionEpoch=0;
 const clearDeletion=()=>{deletionOwner=null;deletionAvailable=false;deletionEpoch++;};
 const requestRecovery=(data,token)=>recoveryRequest(data,token,recoveryFetcher?{fetcher:recoveryFetcher}:{});
 function clearRecovery(){recoveryEpoch++;recoveryScreen=null;codes=[];}
 function paint(s) {
  const ownerChanged=paintedUser!==s.user?.id;
  if(ownerChanged){clearRecovery();clearDeletion();paintedUser=s.user?.id;profileSaved=false;privacySaved=null;}
  photoEditor?.sync();
  document.querySelector('#account-panel').innerHTML=accountMarkup(s,{photo:model.progress().profilePhoto});
  onIdentity(s.user);
  if(s.choice&&!dialog.open){document.querySelectorAll('dialog[open]').forEach(d=>d.close());dialog.showModal();}
  if(s.user&&s.ready&&!s.choice&&studentBatch(s.user)===null&&!batchPrompted.has(s.user.id)){
   batchPrompted.add(s.user.id);document.querySelectorAll('dialog[open]').forEach(d=>{if(d!==dialog)d.close();});if(!dialog.open)dialog.showModal();
  }
  if(dialog.open) {
   const previous=dialog.querySelector('[data-username-form],[data-recovery-form]'),name=previous?.elements.namedItem('username')?.value||'';
   const batch=ownerChanged?null:dialog.querySelector('[name="batchId"]')?.value;
   const privacyChoice=ownerChanged?null:dialog.querySelector('[name="showLeaderboardIdentity"]')?.checked;
   dialog.innerHTML=`<button class="account-dialog-close" data-account="close" aria-label="Close account">×</button>${confirmSignout?'<h2>Your cloud save is pending</h2><p>Your latest changes are kept on this device. Retry syncing before signing out, or keep the device copy and sign out now.</p><div class="account-choice"><button class="primary" data-account="retry-signout">Retry sync</button><button class="secondary" data-account="logout-anyway">Keep device copy and sign out</button></div>':accountDialogMarkup(s,model.snapshotChoices())+(!s.user&&!s.choice&&configured?usernameForm(usernameMode):'')}<p class="account-dialog-error" role="alert">${error.replace(/[<>&]/g,'')}</p>`;
   if(recoveryScreen&&!s.choice&&!confirmSignout){dialog.innerHTML='<button class="account-dialog-close" data-account="close" aria-label="Close account">×</button>'+recoveryMarkup(recoveryScreen,codes,{available:recoveryAvailable})+'<p class="account-dialog-error" role="alert">'+error.replace(/[<>&]/g,'')+'</p>';}
   else if(s.user?.email?.endsWith('@'+USERNAME_DOMAIN)&&!s.choice&&!confirmSignout)dialog.insertAdjacentHTML('beforeend','<button class="recovery-link" data-account="recovery-codes">Manage recovery codes</button>');
   const form=dialog.querySelector('[data-username-form],[data-recovery-form]');if(form){if(form.elements.namedItem('username'))form.elements.namedItem('username').value=name;form.querySelector('[type="submit"]').disabled=busy;}
   const batchField=dialog.querySelector('[name="batchId"]');if(batchField&&batch&&!(profileSaved&&s.user))batchField.value=batch;
   const privacyField=dialog.querySelector('[name="showLeaderboardIdentity"]');if(privacyField&&privacyChoice!==null&&privacyChoice!==undefined)privacyField.checked=privacyChoice;
   const privacyStatus=dialog.querySelector('.leaderboard-privacy-status');if(privacyStatus&&privacySaved!==null)privacyStatus.textContent=privacySaved?'Your account name is now visible on your batch leaderboard.':'Your leaderboard entry is now anonymous.';
   const profile=dialog.querySelector('[data-profile-form]');if(profile){profile.querySelector('[type="submit"]').disabled=busy;if(profileSaved)profile.insertAdjacentHTML('beforeend','<p class="profile-save-state" role="status">Batch saved to your account.</p>');}
   if(s.user&&!s.choice&&!recoveryScreen&&!confirmSignout){const profile=dialog.querySelector('[data-profile-form]');if(profile)profile.insertAdjacentHTML('beforebegin',photoEditor?.markup()||'');}
   if(deletionOwner===s.user?.id&&!s.choice&&!confirmSignout){dialog.innerHTML='<button class="account-dialog-close" data-account="close" aria-label="Close account">×</button>'+accountDeletionMarkup({available:deletionAvailable,name:accountName(s.user)})+'<p class="account-dialog-error" role="alert">'+error.replace(/[<>&]/g,'')+'</p>';dialog.querySelector('[type="submit"]').disabled=busy||!deletionAvailable;}
  }
 }
 model=createAccountProgress({storage,service,onProgress,onState:paint});
 photoEditor=createProfilePhotoEditor({document,getState:model.state,getProgress:model.progress,save:model.save,flush:model.flush,onSaved:onProfilePhotoChange,processor:photoProcessor});
 function start() {
  if(!configured)return Promise.resolve();
  // A sign-in click during the SDK import must wait for that same connection.
  if(startPromise)return startPromise;
  error='';
  startPromise=(async()=>{
  try {
   const createClient=clientFactory||(await import('./supabase-client.mjs')).createClient;
   if(!client){
   client=await createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
   // Auth callbacks are synchronous; SDK requests run outside its auth lock.
   client.auth.onAuthStateChange((event,session)=>{
    if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(()=>model.setUser(session?.user||null).catch(onError),0);
   });
   }
   const {data,error:authError}=await client.auth.getSession();
   if(authError)throw authError;
   await model.setUser(data.session?.user||null);
   const location=document.defaultView.location,params=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
   if(params.has('error')||hash.has('error')){error='Google sign-in did not finish. Check that your Google account is allowed to test the app, then try again.';onError(error);for(const key of ['error','error_code','error_description']){params.delete(key);hash.delete(key);}document.defaultView.history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+(hash.size?'#'+hash:''));}
  }catch{error='Cloud login could not connect. Your guest records are retained. Please retry connecting.';await model.setUser(null);paint({...model.state(),message:error});onError(error);}finally{startPromise=null;}
  })();
  return startPromise;
 }
 document.addEventListener('click',async event=>{
  const toggle=event.target.closest('[data-password-toggle]');
  if(toggle){const field=toggle.closest('form').elements.namedItem(toggle.dataset.passwordToggle),show=field.type==='password';field.type=show?'text':'password';toggle.textContent=show?'Hide':'Show';toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',(show?'Hide ':'Show ')+(toggle.dataset.passwordToggle==='confirmPassword'?'confirmation password':'password'));return;}
  const button=event.target.closest('[data-account]'),action=button?.dataset.account;if(!action||busy)return;
  error='';
  try {
   if(action==='close'){clearRecovery();clearDeletion();photoEditor.reset();dialog.close();return;}
   if(action==='delete-account'){
    clearRecovery();clearDeletion();photoEditor.reset();if(!model.state().user||!model.state().ready)return;
    deletionOwner=model.state().user.id;const epoch=deletionEpoch;paint(model.state());
    try{const result=await requestAccountDeletion(deletionFetcher?{fetcher:deletionFetcher}:{});if(epoch===deletionEpoch&&deletionOwner===model.state().user?.id){deletionAvailable=result.available===true;paint(model.state());}}catch{if(epoch===deletionEpoch)paint(model.state());}return;
   }
   if(action==='cancel-deletion'){clearDeletion();paint(model.state());return;}
   if(action==='recover'||action==='recovery-codes'){
    clearRecovery();const epoch=recoveryEpoch;recoveryScreen=action==='recover'?'recover':'issue';recoveryAvailable=false;paint(model.state());
    try{const result=await requestRecovery();if(epoch===recoveryEpoch){recoveryAvailable=result.available===true;paint(model.state());}}catch{if(epoch===recoveryEpoch)paint(model.state());}
    return;
   }
   if(action==='recovery-back'){clearRecovery();usernameMode='signin';paint(model.state());return;}
   if(action==='download-codes'){downloadRecoveryCodes(document,codes,accountName(model.state().user));return;}
   if(action==='finish-codes'){if(!dialog.querySelector('[data-recovery-saved]')?.checked)return;clearRecovery();paint(model.state());return;}
   if(action==='open'){confirmSignout=false;dialog.showModal();paint(model.state());return;}
   if(action==='username-signin'||action==='username-signup'){clearRecovery();usernameMode=action.slice(9);paint(model.state());dialog.querySelector('[name="username"]')?.focus();return;}
   if(action==='login'){
    busy=true;button.disabled=true;
    if(!client){await start();if(!client)throw Error('Cloud login is still connecting.');}
    const {error:oauthError}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:document.defaultView.location.origin+'/'}});
    if(oauthError)throw oauthError;return;
   }
   if(['logout','logout-anyway','retry-signout'].includes(action)){
    busy=true;button.disabled=true;
    if(action!=='logout-anyway')await model.flush();
    if(action!=='logout-anyway'&&model.state().dirty){confirmSignout=true;paint(model.state());return;}
    confirmSignout=false;
    const {error:signoutError}=await client.auth.signOut({scope:'local'});
    if(signoutError)throw signoutError;
    await model.setUser(null);dialog.close();return;
   }
   if(action==='retry'){await model.retry();return;}
   if(['guest','new','cloud','device'].includes(action)){
    await model.resolve(action);if(!model.state().choice&&studentBatch(model.state().user)!==null)dialog.close();return;
   }
  }catch {busy=false;error='That account action could not finish. Your existing journey is retained. Please try again.';paint(model.state());onError(error);}finally{busy=false;button.disabled=false;}
 });
 document.addEventListener('submit',async event=>{
  const deletionForm=event.target.closest('[data-account-deletion-form]');
  if(deletionForm){
   event.preventDefault();if(busy)return;const owner=deletionOwner,epoch=deletionEpoch;error='';
   try{
    if(!owner||owner!==model.state().user?.id||!deletionAvailable||!model.state().ready)throw Error('Open account deletion again.');
    if(deletionForm.elements.namedItem('confirmation').value!==ACCOUNT_DELETION_PHRASE||!deletionForm.elements.namedItem('acknowledge').checked)throw Error('Type DELETE MY ACCOUNT and acknowledge permanent deletion.');
    busy=true;deletionForm.querySelector('[type="submit"]').disabled=true;const session=await client.auth.getSession();
    if(epoch!==deletionEpoch||model.state().user?.id!==owner||session.data?.session?.user?.id!==owner)throw Error('Your account changed. Open deletion again.');
    const result=await requestAccountDeletion({token:session.data.session.access_token,confirmation:ACCOUNT_DELETION_PHRASE,...(deletionFetcher?{fetcher:deletionFetcher}:{})});if(result.deleted!==true)throw Error('Deletion could not be confirmed.');
    // Invalidate queued writes before clearing only this account's device copies.
    const currentSession=(await client.auth.getSession()).data?.session;
    if(model.state().user?.id===owner&&(!currentSession?.user||currentSession.user.id===owner)){await model.setUser(null);if(currentSession?.user)try{await client.auth.signOut({scope:'local'});}catch{/* The account is already deleted; still remove its local copies. */}}
    let cleaned=true;try{removeDeletedAccountCopies(storage,owner);}catch{cleaned=false;}
    if(epoch===deletionEpoch||!model.state().user){clearDeletion();dialog.close();}onError(cleaned?'Your account has been deleted.':'Your account was deleted. Some device copies could not be removed; clear this site’s browser data.');
   }catch(failure){if(model.state().user?.id===owner){error=failure.message;paint(model.state());}}
   finally{busy=false;const button=dialog.querySelector('[data-account-deletion-form] [type="submit"]');if(button)button.disabled=!deletionAvailable;}
   return;
  }
  const privacyForm=event.target.closest('[data-leaderboard-privacy-form]');
  if(privacyForm){
   event.preventDefault();if(busy)return;const owner=model.state().user?.id;error='';privacySaved=null;
   try{
    if(!owner||!client||!model.state().ready)throw Error('Finish signing in before changing leaderboard privacy.');
    const share=privacyForm.elements.namedItem('showLeaderboardIdentity').checked;busy=true;privacyForm.querySelector('[type="submit"]').disabled=true;
    const result=await client.auth.updateUser({data:{leaderboard_show_identity:share}});
    if(model.state().user?.id!==owner)return;
    if(result.error||result.data?.user?.id!==owner||sharesLeaderboardIdentity(result.data.user)!==share)throw Error('Leaderboard privacy could not be saved. Please try again.');
    privacySaved=share;await model.setUser(result.data.user);paint(model.state());
   }catch(failure){if(model.state().user?.id===owner){error=failure.message;paint(model.state());}}
   finally{busy=false;const form=dialog.querySelector('[data-leaderboard-privacy-form]');if(form)form.querySelector('[type="submit"]').disabled=false;}
   return;
  }
  const profileForm=event.target.closest('[data-profile-form]');
  if(profileForm){
   event.preventDefault();if(busy)return;error='';profileSaved=false;const owner=model.state().user?.id;
   try{
    const batchId=parseBatchId(profileForm.elements.namedItem('batchId').value);if(!owner||!client)throw Error('Sign in before saving your batch.');
    busy=true;profileForm.querySelector('[type="submit"]').disabled=true;
    const result=await client.auth.updateUser({data:{batch_id:batchId}});
    if(model.state().user?.id!==owner)return;
    if(result.error||result.data?.user?.id!==owner||studentBatch(result.data.user)!==batchId)throw Error('Your batch could not be saved. Please try again.');
    await model.setUser(result.data.user);profileSaved=true;
   }catch(failure){if(model.state().user?.id===owner)error=failure.message;}
   finally{busy=false;paint(model.state());}
   return;
  }
  const recoveryForm=event.target.closest('[data-recovery-form]');
  if(recoveryForm){
   event.preventDefault();if(busy)return;error='';const epoch=recoveryEpoch;
   try{
    const input=recoveryInput(recoveryForm);busy=true;recoveryForm.querySelector('[type="submit"]').disabled=true;
    let token;if(input.action==='issue'){const session=await client.auth.getSession();token=session.data?.session?.access_token;if(!token)throw Error('Sign in again before generating codes.');}
    const result=await requestRecovery(input,token);
    if(epoch!==recoveryEpoch)return;
    if(input.action==='issue'){if(!Array.isArray(result.codes)||result.codes.length!==8)throw Error('Recovery codes could not be generated.');codes=result.codes;recoveryScreen='codes';}
    else if(result.recovered)recoveryScreen='success';else throw Error('Recovery could not finish.');
   }catch(failure){if(epoch===recoveryEpoch)error=failure.message;}
   finally{for(const field of recoveryForm.querySelectorAll('[name="password"],[name="confirmPassword"],[name="code"]'))field.value='';busy=false;paint(model.state());}
   return;
  }
  const form=event.target.closest('[data-username-form]');if(!form)return;
  event.preventDefault();if(busy)return;error='';
  try{
   const credentials=usernameCredentials(form);
   if(!client){await start();if(!client)throw Error('Account login is still connecting.');}
   busy=true;form.querySelector('[type="submit"]').disabled=true;
   let result;
   if(form.dataset.usernameForm==='signup'){
    const settings= settingsFetcher?await settingsFetcher():await (await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.publishableKey}})).json();
    if(settings.mailer_autoconfirm!==true){error='Username accounts are awaiting setup. Google sign-in is available.';return;}
    result=await client.auth.signUp({email:credentials.email,password:credentials.password,options:{data:{username:credentials.username,batch_id:credentials.batchId}}});
   }else result=await client.auth.signInWithPassword({email:credentials.email,password:credentials.password});
   if(result.error){error=usernameAuthError(result.error);return;}
   const user=result.data?.session?.user;
   if(!user){error='Username signup is awaiting setup. Google sign-in is available.';return;}
   await model.setUser(user);if(!model.state().choice)dialog.close();
  }catch(failure){error=busy?usernameAuthError(failure):failure.message;}
  finally{for(const field of form.querySelectorAll('[name="password"],[name="confirmPassword"]'))field.value='';busy=false;paint(model.state());}
 });
 document.defaultView.addEventListener('online',()=>{if(model.state().user&&model.state().phase==='offline')model.retry().catch(onError);});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&model.state().user&&model.state().ready&&!model.state().dirty)model.retry().catch(onError);});
 document.addEventListener('change',event=>{if(event.target.matches('[data-recovery-saved]'))dialog.querySelector('[data-account="finish-codes"]').disabled=!event.target.checked;});
 dialog.addEventListener('close',()=>{clearRecovery();clearDeletion();photoEditor.reset();});dialog.addEventListener('cancel',()=>{clearRecovery();clearDeletion();photoEditor.reset();});
 attachBackdropDismiss(dialog,()=>{clearRecovery();dialog.close();});
 paint(model.state());
 return {model,start,getAccessToken:async()=>client?(await client.auth.getSession()).data?.session?.access_token:null,
  getBatchLeaderboard:async options=>{const state=model.state(),owner=state.user?.id,batch=studentBatch(state.user);if(!client||!owner||!state.ready||batch===null)throw Error('Sign in and choose your batch before opening the leaderboard.');const result=await loadBatchLeaderboard(client,{...options,batch});if(model.state().user?.id!==owner||studentBatch(model.state().user)!==batch)throw Error('Your account changed. Open the leaderboard again.');return result;}};
}
