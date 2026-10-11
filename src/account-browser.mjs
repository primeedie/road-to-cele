import { cloudConfig } from './runtime-config.mjs';
import { createAccountProgress } from './account-progress.mjs';
import { cloudService } from './cloud-service.mjs';
import { accountMarkup, accountDialogMarkup } from './account-ui.mjs';
import { attachBackdropDismiss } from './dialog-dismiss.mjs';

export function setupAccount({storage,document,onProgress,onError=()=>{},config=cloudConfig,clientFactory=null}) {
 let client=null,model,error='',starting=false;
 const configured=!!config.url;
 const service=configured?{
  read:id=>cloudService(client).read(id),
  write:(p,r,id)=>cloudService(client).write(p,r,id)
 }:null;
 const dialog=document.querySelector('#account-dialog');
 function paint(s) {
  document.querySelector('#account-panel').innerHTML=accountMarkup(s);
  if(s.choice&&!dialog.open)dialog.showModal();
  if(dialog.open) {
   dialog.innerHTML=`<button class="account-dialog-close" data-account="close" aria-label="Close account">×</button>${accountDialogMarkup(s,model.snapshotChoices())}<p class="account-dialog-error" role="alert">${error.replace(/[<>&]/g,'')}</p>`;
  }
 }
 model=createAccountProgress({storage,service,onProgress,onState:paint});
 async function start() {
  if(!configured||starting)return;
  starting=true;
  try {
   const createClient=clientFactory||(await import('./supabase-client.mjs')).createClient;
   client=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
   // Auth callbacks are synchronous; SDK requests run outside its auth lock.
   client.auth.onAuthStateChange((event,session)=>{
    if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(()=>model.setUser(session?.user||null).catch(onError),0);
   });
   const {data,error:authError}=await client.auth.getSession();
   if(authError)throw authError;
   await model.setUser(data.session?.user||null);
  }catch{error='Cloud login could not connect. Reload to try again; your device records are retained.';paint({...model.state(),message:error});onError(error);}
 }
 document.addEventListener('click',async event=>{
  const action=event.target.closest('[data-account]')?.dataset.account;if(!action)return;
  error='';
  try {
   if(action==='close'){dialog.close();return;}
   if(action==='open'){dialog.showModal();paint(model.state());return;}
   if(action==='login'){
    if(!client)throw Error('Cloud login is still connecting. Please reload if it does not finish.');
    const {error:oauthError}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:document.defaultView.location.origin+'/'}});
    if(oauthError)throw oauthError;return;
   }
   if(action==='logout'){
    await model.flush();
    const {error:signoutError}=await client.auth.signOut({scope:'local'});
    if(signoutError)throw signoutError;
    await model.setUser(null);dialog.close();return;
   }
   if(action==='retry'){await model.retry();return;}
   if(['guest','new','cloud','device'].includes(action)){
    await model.resolve(action);if(!model.state().choice)dialog.close();return;
   }
  }catch {error='That account action could not finish. Your existing journey is retained. Please try again.';paint(model.state());onError(error);}
 });
 attachBackdropDismiss(dialog,()=>dialog.close());
 paint(model.state());
 return {model,start};
}
