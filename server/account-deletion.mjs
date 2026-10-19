import {cloudConfig} from '../dist/runtime-config.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function readInput(request){
 const reader=request.body?.getReader();if(!reader)throw Error();let text='',length=0;const decoder=new TextDecoder();
 while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>1024){await reader.cancel();throw Error();}text+=decoder.decode(value,{stream:true});}
 return JSON.parse(text+decoder.decode());
}
export async function handleAccountDeletion(request,env,{fetcher=fetch}={}){
 const key=env.SUPABASE_ADMIN_SECRET_KEY||env.SUPABASE_RECOVERY_SECRET_KEY,configured=!!(key&&cloudConfig.url&&cloudConfig.publishableKey);
 if(request.method==='GET')return reply({available:configured});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Request not allowed'},403);
 const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer ')||bearer.length>8192)return reply({error:'Sign in again before deleting your account.'},401);
 if(!configured)return reply({error:'Account deletion is awaiting server setup.'},503);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Invalid request'},400);
 let input;try{input=await readInput(request);}catch{return reply({error:'Invalid request'},400);}
 if(!input||Array.isArray(input)||input.confirmation!=='DELETE MY ACCOUNT'||Object.keys(input).some(k=>k!=='confirmation'))return reply({error:'Type DELETE MY ACCOUNT to confirm.'},400);
 let user;
 try{const r=await fetcher(cloudConfig.url+'/auth/v1/user',{headers:{apikey:cloudConfig.publishableKey,Authorization:bearer},signal:AbortSignal.timeout(10000)});if(!r.ok)return reply({error:'Sign in again before deleting your account.'},401);user=await r.json();}catch{return reply({error:'Account verification is unavailable. Nothing was deleted.'},503);}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id||''))return reply({error:'Sign in again before deleting your account.'},401);
 try{
  const r=await fetcher(cloudConfig.url+'/auth/v1/admin/users/'+encodeURIComponent(user.id),{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({should_soft_delete:false}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)return reply({error:'Account deletion could not finish. Please try again.'},503);
  return reply({deleted:true});
 }catch{return reply({error:'The deletion result could not be confirmed. Sign in again to check your account.'},503);}
}
