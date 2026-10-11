import { newProgress } from './progression.mjs';
import { hydrateProgress, loadProgress, saveProgress } from './storage.mjs';

export const accountStorageKey = id => 'road-to-cele.account.v1.'+id;
export const hasProgress = p => JSON.stringify(p)!==JSON.stringify(newProgress());

// Guest and account saves are separate. Revision checks prevent stale-device overwrites.
export function createAccountProgress({storage,service=null,onProgress=()=>{},onState=()=>{}}) {
 let current,guestReadable=true;try{current=loadProgress(storage);}catch{current=newProgress();guestReadable=false;}
 let user=null,epoch=0,base=0,dirty=false,ready=!service,phase=service?'connecting':'guest',message='',choice=null,remote=null;
 if(!guestReadable&&!service){phase='local-error';message='An existing guest save could not be read. It is retained until you explicitly reset; export this session before leaving.';}
 let queue=Promise.resolve(),loading=Promise.resolve();
 const state=()=>({user,phase,ready,dirty,message,choice,configured:!!service});
 const emit=()=>onState(state());
 const publish=()=>{onProgress(structuredClone(current));emit();};
 const cache=()=>{if(user)storage.setItem(accountStorageKey(user.id),JSON.stringify({progress:current,revision:base,dirty}));else {if(!guestReadable)throw Error('Unreadable guest save');saveProgress(storage,current);}};
 const safeCache=()=>{try{cache();return true;}catch{message='Device storage is unavailable. Export a backup before leaving.';return false;}};
 const enqueue=()=>{
  const owner=user?.id,token=epoch;
  queue=queue.catch(()=>{}).then(async()=>{
   if(!owner||token!==epoch||user?.id!==owner||!dirty||!ready||choice)return;
   const snapshot=structuredClone(current),expected=base;phase='saving';emit();
   try {
    const result=await service.write(snapshot,expected,owner);
    if(token!==epoch)return;
    if(result.conflict){ready=false;phase='loading';emit();await reconcile(token);return;}
    base=result.revision;
    dirty=JSON.stringify(current)!==JSON.stringify(snapshot);
    safeCache();phase=dirty?'pending':'saved';message='';emit();
   }catch(error){if(token!==epoch)return;phase='offline';message=error.message;emit();}
  });
  return queue;
 };
 async function reconcile(token) {
  const owner=user?.id;
  try {
   const row=await service.read(owner);if(token!==epoch)return;
   remote=row;
   if(dirty&&row&&row.revision!==base){choice='conflict';ready=false;phase='choice';message='This account has a newer save on another device. Choose which copy to keep.';emit();return;}
   if(dirty&&!row&&base!==0)throw Error('The cloud record is unavailable. Your local changes are safe.');
   if(dirty){ready=true;phase='pending';emit();enqueue();return;}
   if(row){current=row.progress;base=row.revision;ready=true;phase='saved';message='';safeCache();publish();return;}
   let guest;try{guest=loadProgress(storage);}catch{guest=newProgress();}
   if(base===0&&hasProgress(guest)){choice='import';ready=false;phase='choice';message='Bring your guest journey into this account, or start a new account journey.';emit();return;}
   current=newProgress();base=0;dirty=true;ready=true;phase='pending';safeCache();publish();enqueue();
  }catch(error){if(token!==epoch)return;ready=true;phase='offline';message=error.message;emit();}
 }
 return {
  state,progress:()=>structuredClone(current),
  setUser(next) {
   if(next?.id===user?.id&&(ready||user))return loading;
   const token=++epoch;user=next;choice=null;remote=null;message='';dirty=false;base=0;
   if(!user){try{current=loadProgress(storage);guestReadable=true;}catch{current=newProgress();guestReadable=false;}ready=true;phase=guestReadable?'guest':'local-error';publish();return Promise.resolve();}
   current=newProgress();
   try{const raw=storage.getItem(accountStorageKey(user.id));if(raw){const saved=JSON.parse(raw);current=hydrateProgress(saved.progress);if(!Number.isSafeInteger(saved.revision)||saved.revision<0)throw Error();base=saved.revision;dirty=saved.dirty===true;}}
   catch{current=newProgress();base=0;dirty=false;message='The account cache could not be read. Loading the cloud copy.';}
   ready=false;phase='loading';publish();loading=reconcile(token);return loading;
  },
  save(next) {
   if(!ready||choice)throw Error('Finish loading or choosing your account save first.');
   current=hydrateProgress(next);dirty=!!user;
   const stored=safeCache();
   if(user){phase='pending';emit();if(phase!=='offline')enqueue();}
   else {phase=stored?'guest':'local-error';emit();}
  },
  resetGuest() {if(user)throw Error('Guest reset requires guest mode');const clean=newProgress();saveProgress(storage,clean);guestReadable=true;current=clean;dirty=false;phase='guest';message='';emit();return clean;},
  async resolve(which) {
   if(!user||!choice)throw Error('No save choice is pending.');
   if(choice==='import') {
    if(!['guest','new'].includes(which))throw Error('Choose guest progress or a new journey.');
    current=which==='guest'?loadProgress(storage):newProgress();base=0;
   } else {
    if(!['cloud','device'].includes(which))throw Error('Choose the cloud or device copy.');
    if(which==='cloud'){current=remote.progress;base=remote.revision;dirty=false;choice=null;ready=true;phase='saved';message='';safeCache();publish();return;}
    // Explicitly preserve a recoverable copy before replacing the cloud snapshot.
    storage.setItem(accountStorageKey(user.id)+'.conflict-backup',JSON.stringify(remote));
    base=remote.revision;
   }
   dirty=true;choice=null;ready=true;phase='pending';message='';safeCache();publish();await enqueue();
  },
  retry(){if(!user)return Promise.resolve();ready=false;phase='loading';message='';emit();loading=reconcile(epoch);return loading;},
  async flush(){await loading;await queue;if(dirty&&ready&&!choice&&user){await enqueue();}await queue;},
  snapshotChoices(){return {device:structuredClone(current),cloud:remote?structuredClone(remote.progress):null};}
 };
}
