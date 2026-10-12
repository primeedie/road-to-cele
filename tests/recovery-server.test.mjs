import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {handleRecovery,generateRecoveryCodes,normalizeRecoveryCode,hashRecoveryValue} from '../server/account-recovery.mjs';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const reply=data=>Response.json(data);
const post=data=>new Request('https://road.test/api/account-recovery',{method:'POST',headers:{origin:'https://road.test','content-type':'application/json',authorization:'Bearer student-token','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(data)});
const env={SUPABASE_RECOVERY_SECRET_KEY:'server-only-test-key'};

test('recovery generates unpredictable 128-bit codes and normalizes only separators',async()=>{
 const codes=generateRecoveryCodes();assert.equal(new Set(codes).size,8);
 for(const code of codes){assert.match(code,/^[A-F0-9]{8}(-[A-F0-9]{8}){3}$/);assert.match(await hashRecoveryValue(normalizeRecoveryCode(code)),/^[a-f0-9]{64}$/);}
 assert.equal(normalizeRecoveryCode('ABCD-abcd ABCD'), 'abcdabcdabcd');assert.ok(!codes.includes(generateRecoveryCodes()[0]));
});
test('recovery SQL permits only the server, rotates hashes, binds ownership, limits attempts and consumes once',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text);
   insert into auth.users values('${alice}','alice@accounts.road-to-cele.invalid'),('${bob}','bob@accounts.road-to-cele.invalid');`);
  const sql=await readFile(new URL('../supabase/migrations/202610120003_recovery_codes.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  const codes=generateRecoveryCodes(),hashes=await Promise.all(codes.map(c=>hashRecoveryValue(normalizeRecoveryCode(c))));
  const replace=(id,name,list)=>db.query('select public.recovery_replace_codes($1::uuid,$2::text,$3::text[])',[id,name,list]);
  const claim=(name,hash)=>db.query('select public.recovery_claim_code($1,$2) owner',[name,hash]);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);await assert.rejects(db.query('select * from public.account_recovery_codes'),/permission denied/);
   await assert.rejects(claim('alice',hashes[0]),/permission denied/);await assert.rejects(replace(alice,'alice',hashes),/permission denied/);await db.exec('reset role');
  }
  await db.exec('set role service_role');await assert.rejects(replace(alice,'bob',hashes),/Invalid recovery account/);
  await assert.rejects(replace(alice,'alice',[null,...hashes.slice(1)]),/Invalid recovery account/);
  await replace(alice,'alice',hashes);assert.equal((await claim('bob',hashes[0])).rows[0].owner,null);
  const attempts=await Promise.all([claim('alice',hashes[0]),claim('alice',hashes[0])]);
  assert.deepEqual(attempts.map(r=>r.rows[0].owner).sort(),[alice,null].sort());
  await replace(alice,'alice',hashes.map(()=> 'f'.repeat(64))).then(()=>assert.fail('Duplicate codes must roll back'),()=>{});
  assert.equal((await claim('alice',hashes[1])).rows[0].owner,alice);
  const fresh=await Promise.all(generateRecoveryCodes().map(c=>hashRecoveryValue(normalizeRecoveryCode(c))));await replace(alice,'alice',fresh);
  assert.equal((await claim('alice',hashes[2])).rows[0].owner,null);assert.equal((await claim('alice',fresh[0])).rows[0].owner,alice);
  const key='a'.repeat(64);for(let i=0;i<6;i++)assert.equal((await db.query('select public.recovery_rate_limit($1,5) allowed',[key])).rows[0].allowed,i<5);
  await db.exec('reset role');const stored=await db.query('select * from public.account_recovery_codes');assert.equal(stored.rows.length,8);assert.ok(!JSON.stringify(stored.rows).includes(codes[0]));
 }finally{await db.close();}
});
test('server issues codes only after bearer identity and password verification, stores hashes without secrets in response',async()=>{
 const calls=[];let wrong=false;
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname,c=options.body?JSON.parse(options.body):null;calls.push({path,body:c});
  if(path.endsWith('recovery_rate_limit'))return reply(true);
  if(path==='/auth/v1/user')return reply({id:alice,email:'alice@accounts.road-to-cele.invalid'});
  if(path==='/auth/v1/token')return wrong?reply({user:{id:bob}}):reply({user:{id:alice},access_token:'reauth-session'});
  if(path==='/auth/v1/logout')return new Response(null,{status:204});
  if(path.endsWith('recovery_replace_codes')){assert.equal(c.p_user_id,alice);assert.equal(c.p_username,'alice');assert.equal(c.p_hashes.length,8);return reply(null);}
  throw Error('Unexpected upstream request');
 };
 const result=await handleRecovery(post({action:'issue',password:'test-password'}),env,{fetcher});assert.equal(result.status,200);
 const body=await result.json();assert.equal(body.codes.length,8);assert.ok(!JSON.stringify(body).includes('server-only'));assert.equal(result.headers.get('cache-control'),'no-store');
 assert.ok(!JSON.stringify(calls.find(c=>c.path.endsWith('recovery_replace_codes'))).includes(body.codes[0]));
 wrong=true;calls.length=0;assert.equal((await handleRecovery(post({action:'issue',password:'test-password'}),env,{fetcher})).status,400);
 assert.ok(!calls.some(c=>c.path.endsWith('recovery_replace_codes')));
});
test('reset claims a code before updating only its owner; invalid or unavailable recovery fails closed',async()=>{
 const calls=[];let valid=true,limited=false,updateFails=false;
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname;calls.push(path);
  if(path.endsWith('recovery_rate_limit'))return reply(!limited);
  if(path.endsWith('recovery_claim_code')){const args=JSON.parse(options.body);assert.equal(args.p_username,'alice');assert.match(args.p_hash,/^[a-f0-9]{64}$/);return reply(valid?alice:null);}
  if(path==='/auth/v1/admin/users/'+alice){assert.deepEqual(JSON.parse(options.body),{password:'new-password'});return updateFails?new Response('{}',{status:500}):reply({id:alice});}
  throw Error('Unexpected request');
 };
 const input={action:'recover',username:'Alice',code:generateRecoveryCodes()[0],password:'new-password'};
 let result=await handleRecovery(post(input),env,{fetcher});assert.deepEqual(await result.json(),{recovered:true});assert.ok(calls.indexOf('/rest/v1/rpc/recovery_claim_code')<calls.indexOf('/auth/v1/admin/users/'+alice));
 calls.length=0;valid=false;result=await handleRecovery(post(input),env,{fetcher});assert.equal(result.status,400);assert.ok(!calls.some(c=>c.includes('/admin/')));
 valid=true;updateFails=true;result=await handleRecovery(post(input),env,{fetcher});assert.equal(result.status,502);assert.match((await result.json()).error,/consumed/);
 limited=true;calls.length=0;assert.equal((await handleRecovery(post(input),env,{fetcher})).status,429);assert.ok(!calls.some(c=>c.includes('claim_code')));
 assert.equal((await handleRecovery(post(input),{}, {fetcher})).status,503);
 const cross=post(input);cross.headers.set('origin','https://other.test');assert.equal((await handleRecovery(cross,env,{fetcher})).status,403);
 const oversized=post({...input,extra:'a'.repeat(5000)});assert.equal((await handleRecovery(oversized,env,{fetcher})).status,400);
});
