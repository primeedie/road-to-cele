import { hydrateProgress } from './storage.mjs';

export function cloudService(client) {
 return {
  async read(userId) {
   const {data,error}=await client.from('student_progress').select('progress,revision').eq('user_id',userId).maybeSingle();
   if(error)throw Error('Cloud progress could not be loaded. Your local copy is safe.');
   return data?{progress:hydrateProgress(data.progress),revision:data.revision}:null;
  },
  async write(progress,revision,userId) {
   const {data,error}=await client.rpc('save_student_progress',{p_progress:progress,p_expected_revision:revision,p_user_id:userId});
   if(error)throw Error('Cloud save failed. Your changes are kept on this device.');
   if(!data?.saved)return {conflict:true};
   return {revision:data.revision};
  }
 };
}
