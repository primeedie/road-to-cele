// This module is imported only by the Pages Function, never by the browser build.
// The site build emits these validated public settings before Functions compile.
// Plain ESM also works with the older Wrangler compiler used by Pages builds.
import {cloudConfig} from '../dist/runtime-config.mjs';
const domain='accounts.road-to-cele.invalid';
const username=value=>typeof value==='string'&&/^[a-z0-9_]{3,24}$/.test(value)?value:null;
export const normalizeRecoveryCode=value=>String(value||'').replace(/[\s-]/g,'').toLowerCase();
export async function hashRecoveryValue(value){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function generateRecoveryCodes(){
 return Array.from({length:8},()=>[...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{8}/g).join('-'));
}
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function bodyJSON(request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');
 const chunks=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4096){await reader.cancel();throw Error('Body too large');}chunks.push(value);}
 const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(data));
}
export async function handleRecovery(request,env,{fetcher=fetch}={}) {
 const key=env.SUPABASE_RECOVERY_SECRET_KEY;
 const base=cloudConfig.url,publishable=cloudConfig.publishableKey;
 const configured=!!(key&&base&&publishable);
 const adminHeaders={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 async function api(path,{method='POST',data,headers=adminHeaders}={}){
  const result=await fetcher(base+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
  if(!result.ok)throw Error('Upstream rejected');
  return result.status===204?null:result.json();
 }
 const rpc=(name,data)=>api('/rest/v1/rpc/'+name,{data});
 if(request.method==='GET'){
  if(!configured)return response({available:false});
  try{return response({available:(await rpc('recovery_ready',{}))===true});}catch{return response({available:false});}
 }
 if(request.method!=='POST')return response({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return response({error:'Request not allowed'},403);
 if(!configured)return response({error:'Recovery is awaiting server setup. Google sign-in and username sign-in are available.'},503);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'Invalid request'},400);
 let input;try{input=await bodyJSON(request);}catch{return response({error:'Invalid request'},400);}
 if(!['issue','recover'].includes(input?.action))return response({error:'Invalid request'},400);
 let name;
 const ip=request.headers.get('cf-connecting-ip')||'local';
 async function limited(scope,value,limit){
  // HMAC avoids retaining raw IP addresses or exposing a reversible IP hash.
  const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',secret,new TextEncoder().encode(scope+':'+value));
  const hash=[...new Uint8Array(signature)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return rpc('recovery_rate_limit',{p_key:hash,p_limit:limit});
 }
 try{
  if(!(await limited('ip',ip,30)))return response({error:'Too many attempts. Wait 15 minutes and try again.'},429);
  if(input.action==='issue'){
   const bearer=request.headers.get('authorization');
   if(!bearer?.startsWith('Bearer '))return response({error:'Sign in first'},401);
   const user=await api('/auth/v1/user',{method:'GET',headers:{apikey:publishable,Authorization:bearer}});
   name=username(user.email?.endsWith('@'+domain)?user.email.slice(0,-domain.length-1):null);
   if(!name)return response({error:'Recovery codes are for username accounts. Use Google to recover a Google account.'},400);
   if(!(await limited('account',name,5)))return response({error:'Too many attempts. Wait 15 minutes and try again.'},429);
   if(typeof input.password!=='string'||!input.password||input.password.length>128)return response({error:'Enter your current password'},400);
   let verified;try{verified=await api('/auth/v1/token?grant_type=password',{headers:{apikey:publishable,'Content-Type':'application/json'},data:{email:name+'@'+domain,password:input.password}});}catch{return response({error:'Current password is incorrect'},400);}
   if(verified.user?.id!==user.id)return response({error:'Current password is incorrect'},400);
   // The reauthentication session is disposable; don't leave a refresh token behind.
   await api('/auth/v1/logout?scope=local',{headers:{apikey:publishable,Authorization:'Bearer '+verified.access_token},data:{}});
   const codes=generateRecoveryCodes(),hashes=await Promise.all(codes.map(c=>hashRecoveryValue(normalizeRecoveryCode(c))));
   await rpc('recovery_replace_codes',{p_user_id:user.id,p_username:name,p_hashes:hashes});
   return response({codes});
  }
  name=username(typeof input.username==='string'?input.username.trim().toLowerCase():null);
  if(!name||typeof input.password!=='string'||input.password.length<8||input.password.length>128)return response({error:'Use a valid username and a password of 8–128 characters'},400);
  if(!(await limited('account',name,5)))return response({error:'Too many attempts. Wait 15 minutes and try again.'},429);
  const normalized=normalizeRecoveryCode(input.code);
  if(!/^[a-f0-9]{32}$/.test(normalized))return response({error:'Username or recovery code is incorrect or already used'},400);
  const owner=await rpc('recovery_claim_code',{p_username:name,p_hash:await hashRecoveryValue(normalized)});
  if(!owner)return response({error:'Username or recovery code is incorrect or already used'},400);
  try{await api('/auth/v1/admin/users/'+encodeURIComponent(owner),{method:'PUT',data:{password:input.password}});}
  catch{return response({error:'The password update could not finish. This code was consumed; use another saved code.'},502);}
  return response({recovered:true});
 }catch{return response({error:'Recovery could not connect. Try again later.'},503);}
}
