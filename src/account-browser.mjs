import { cloudConfig } from './runtime-config.mjs';
import { createAccountProgress } from './account-progress.mjs';
import { cloudService } from './cloud-service.mjs';
import { accountMarkup, accountDialogMarkup } from './account-ui.mjs';
import { attachBackdropDismiss } from './dialog-dismiss.mjs';

export function setupAccount({storage,document,onProgress,onError=()=>{},config=cloudConfig,clientFactory=null}) {
 let client=null,model,error='',starting=false,busy=false,confirmSignout=false;
 const configured=!!config.url;
 const service=configured?{
  read:id=>cloudService(client).read(id),
  write:(p,r,id)=>cloudService(client).write(p,r,id)
 }:null;
 const dialog=document.querySelector('#account-dialog');
 function paint(s) {
  document.querySelector('#account-panel').innerHTML=accountMarkup(s);
  if(s.choice&&!dialog.open){document.querySelectorAll('dialog[open]').forEach(d=>d.close());dialog.showModal();}
  if(dialog.open) {
   dialog.innerHTML=`<button class="account-dialog-close" data-account="close" aria-label="Close account">×</button>${confirmSignout?'<h2>Your cloud save is pending</h2><p>Your latest changes are kept on this device. Retry syncing before signing out, or keep the device copy and sign out now.</p><div class="account-choice"><button class="primary" data-account="retry-signout">Retry sync</button><button class="secondary" data-account="logout-anyway">Keep device copy and sign out</button></div>':accountDialogMarkup(s,model.snapshotChoices())}<p class="account-dialog-error" role="alert">${error.replace(/[<>&]/g,'')}</p>`;
  }
 }
 model=createAccountProgress({storage,service,onProgress,onState:paint});
 async function start() {
  if(!configured||starting)return;
  error='';
  starting=true;
  try {
   const createClient=clientFactory||(await import('./supabase-client.mjs')).createClient;
   client??=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
   // Auth callbacks are synchronous; SDK requests run outside its auth lock.
   client.auth.onAuthStateChange((event,session)=>{
    if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(()=>model.setUser(session?.user||null).catch(onError),0);
   });
   const {data,error:authError}=await client.auth.getSession();
   if(authError)throw authError;
   await model.setUser(data.session?.user||null);
   const location=document.defaultView.location,params=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
   if(params.has('error')||hash.has('error')){error='Google sign-in did not finish. Check that your Google account is allowed to test the app, then try again.';onError(error);for(const key of ['error','error_code','error_description']){params.delete(key);hash.delete(key);}document.defaultView.history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+(hash.size?'#'+hash:''));}
  }catch{error='Cloud login could not connect. Your guest records are retained. Please retry connecting.';await model.setUser(null);paint({...model.state(),message:error});onError(error);}finally{starting=false;}
 }
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-account]'),action=button?.dataset.account;if(!action||busy)return;
  error='';
  try {
   if(action==='close'){dialog.close();return;}
   if(action==='open'){confirmSignout=false;dialog.showModal();paint(model.state());return;}
   if(action==='login'){
    if(!client){await start();if(!client)throw Error('Cloud login is still connecting.');}
    busy=true;button.disabled=true;
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
    await model.resolve(action);if(!model.state().choice)dialog.close();return;
   }
  }catch {error='That account action could not finish. Your existing journey is retained. Please try again.';paint(model.state());onError(error);}finally{busy=false;button.disabled=false;}
 });
 document.defaultView.addEventListener('online',()=>{if(model.state().user&&model.state().phase==='offline')model.retry().catch(onError);});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&model.state().user&&model.state().ready&&!model.state().dirty)model.retry().catch(onError);});
 attachBackdropDismiss(dialog,()=>dialog.close());
 paint(model.state());
 return {model,start};
}
