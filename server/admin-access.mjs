import {cloudConfig} from '../dist/runtime-config.mjs';
// Bound to the confirmed account created at the owner's explicit request.
const OWNER_ID='747ef767-6a10-4eac-9c93-f3af9e03d737';
const OWNER_EMAIL='freshmilchh@accounts.road-to-cele.invalid';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleAdminAccess(request,env,{fetcher=fetch}={}){
 if(request.method!=='GET')return reply({error:'Method not allowed'},405);
 const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer ')||bearer.length>8192)return reply({error:'Sign in first'},401);
 let user;
 try{const r=await fetcher(cloudConfig.url+'/auth/v1/user',{headers:{apikey:cloudConfig.publishableKey,Authorization:bearer},signal:AbortSignal.timeout(10000)});if(!r.ok)return reply({error:'Sign in again'},401);user=await r.json();}catch{return reply({error:'Account verification unavailable'},503);}
 if(!user?.id)return reply({error:'Sign in again'},401);
 const owner=user.id===OWNER_ID&&user.email===OWNER_EMAIL;
 return reply({admin:owner||user.app_metadata?.road_to_cele_admin===true,userId:user.id});
}
