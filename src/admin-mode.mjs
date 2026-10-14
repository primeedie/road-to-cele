import {newProgress} from './progression.mjs';
import {hydrateProgress} from './storage.mjs';
import {COURSE_BY_ID} from './curriculum.mjs';
const clean=()=>({...newProgress(),academicYear:4});
export const adminStorageKey=id=>'road-to-cele.admin-workspace.v1.'+id;
export async function verifyAdminAccess(user,getToken,{fetcher=fetch}={}){
 const token=await getToken();if(!token)return {admin:false,userId:user.id};
 const headers={Authorization:'Bearer '+token};
 const r=await fetcher('/api/admin-access',{headers,cache:'no-store'}),result=await r.json();
 return r.ok?result:{admin:false,userId:user.id,setupRequired:result.setupRequired===true};
}
export function createAdminWorkspace({storage,authorize,onChange=()=>{},onError=()=>{}}){
 let owner=null,verified=false,active=false,epoch=0,current=clean(),setupRequired=false;
 const emit=()=>onChange();
 return {
  allowed:()=>verified,active:()=>verified&&active,setupRequired:()=>setupRequired,
  progress:()=>structuredClone(current),
  async setUser(user){
   if((user?.id||null)===owner)return;
   const token=++epoch;owner=user?.id||null;verified=false;active=false;setupRequired=false;current=clean();emit();
   if(!owner)return;
   try{const result=await authorize(user);if(token!==epoch)return;verified=result.admin===true&&result.userId===owner;setupRequired=result.setupRequired===true;
    if(verified){const raw=storage.getItem(adminStorageKey(owner));if(raw)current=hydrateProgress(JSON.parse(raw));}emit();
   }catch{if(token===epoch){verified=false;active=false;emit();onError('Admin access could not be verified. Student view is available.');}}
  },
  switchView(mode){if(!verified)throw Error('Administrator access required.');if(!['student','admin'].includes(mode))throw Error('Unknown view');active=mode==='admin';emit();},
  save(next){if(!verified||!active)throw Error('Administrator access required.');const validated=hydrateProgress(next);storage.setItem(adminStorageKey(owner),JSON.stringify(validated));current=validated;},
  reset(){if(!verified||!active)throw Error('Administrator access required.');const next=clean();storage.setItem(adminStorageKey(owner),JSON.stringify(next));current=next;return structuredClone(next);}
 };
}
export function adminAcademicProgress(p,id,status){
 if(!COURSE_BY_ID[id]||!['ACTIVE','COMPLETED'].includes(status))throw Error('Unknown course or status');
 const next=structuredClone(p),old=next.academicRecords[id]||{};
 next.academicRecords[id]={...old,status,takenInTerm:COURSE_BY_ID[id].term,events:[...(old.events||[]),{status,at:new Date().toISOString(),method:'ADMIN_TEST'}]};return next;
}
export function adminViewMarkup(workspace){
 if(!workspace.allowed())return workspace.setupRequired()?'<p class="admin-setup-note">Administrator access is awaiting server setup.</p>':'';
 return '<div class="admin-view-switch" role="group" aria-label="Account view"><button data-admin-view="student" aria-pressed="'+!workspace.active()+'">Student view</button><button data-admin-view="admin" aria-pressed="'+workspace.active()+'">Admin view</button></div><p class="admin-view-note">'+(workspace.active()?'Admin workspace · all courses open · saved separately on this device.':'Student view · regular progression rules.')+'</p>';
}
