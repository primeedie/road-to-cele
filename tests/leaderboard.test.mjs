import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {newProgress,confirmSpecialization,requiredCourses} from '../src/progression.mjs';
import {loadBatchLeaderboard} from '../src/leaderboard-service.mjs';
import {leaderboardPrivacyForm,publicLeaderboardName} from '../src/leaderboard-privacy.mjs';
import {attachBatchLeaderboard} from '../src/leaderboard-browser.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333',d='44444444-4444-4444-8444-444444444444',seed='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('batch RPC keeps private records private, computes path percentage and enforces identity consent before returning data',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610110001_student_progress.sql',import.meta.url),'utf8'));
  const migration=await readFile(new URL('../supabase/migrations/202610190004_batch_leaderboard.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
  for(const [id,email,meta]of [[a,'freshmilchh@accounts.road-to-cele.invalid',{batch_id:122,username:'freshmilchh',full_name:'Private real name'}],[b,'bob@example.test',{batch_id:122,full_name:'Never expose Bob'}],[c,'carol@example.test',{batch_id:122,full_name:'Carol',leaderboard_show_identity:true}],[d,'other@example.test',{batch_id:123,full_name:'Other batch'}]])await db.query('insert into auth.users values($1,$2,$3::jsonb)',[id,email,JSON.stringify(meta)]);
  const pa=confirmSpecialization({...newProgress(),academicYear:4},'STE',{confirmed:true});pa.academicRecords.FNDMATH={status:'COMPLETED'};pa.academicRecords.GTEROCK={status:'COMPLETED'};pa.academicRecords.FAKECOURSE={status:'COMPLETED'};
  const pb=newProgress();pb.academicRecords.FNDMATH={status:'COMPLETED'};pb.academicRecords.BASCHEM={status:'COMPLETED'};pb.profilePhoto='private-photo-data';
  for(const [id,p]of [[a,pa],[b,pb],[d,newProgress()]])await db.query('insert into public.student_progress(user_id,progress) values($1,$2::jsonb)',[id,JSON.stringify(p)]);
  const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role authenticated');};
  const read=async(s=seed,page=0,size=50)=>(await db.query('select public.get_batch_leaderboard($1::uuid,$2,$3) result',[s,page,size])).rows[0].result;
  await db.exec('set role anon');await assert.rejects(read(),/permission denied/);await login(null);await assert.rejects(read(),/Authentication required/);await login(a);
  const result=await read();assert.equal(result.batch_id,122);assert.equal(result.total_users,3);assert.equal(result.self.completed_courses,1);assert.equal(result.self.required_courses,requiredCourses(pa).length);assert.equal(result.self.rank,2);assert.equal(result.self.display_name,null);assert.equal(result.rows[0].completed_courses,2);assert.equal(result.rows[0].rank,1);
  const serialized=JSON.stringify(result);for(const secret of [a,b,c,d,'bob@example.test','Never expose Bob','Private real name','private-photo-data','academicRecords','gradeAttempts','freshmilchh'])assert.ok(!serialized.includes(secret),secret+' leaked');assert.ok(serialized.includes('Carol'));
  assert.equal(new Set(result.rows.map(r=>r.anonymous_label)).size,3);assert.ok(result.rows.every(r=>/^Anon 122 #\d{4}$/.test(r.anonymous_label)));
  assert.deepEqual(await read(),result,'the same view seed preserves aliases and page order');const aliases=new Set();for(let i=0;i<12;i++){const key=i.toString(16).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa';aliases.add((await read(key)).self.anonymous_label);}assert.ok(aliases.size>1,'self is not always #0001');
  const first=await read(seed,0,1),second=await read(seed,1,1);assert.equal(first.rows.length,1);assert.equal(second.rows.length,1);assert.notEqual(first.rows[0].anonymous_label,second.rows[0].anonymous_label);assert.equal(second.self.anonymous_label,result.self.anonymous_label);
  await assert.rejects(read(seed,-1),/Invalid leaderboard page/);await assert.rejects(read(seed,0,1000),/Invalid leaderboard page/);
  assert.equal((await db.query('select user_id from public.student_progress')).rows.length,1);await assert.rejects(db.query('select * from auth.users'),/permission denied/);
  await db.exec('reset role');await db.query("update auth.users set raw_user_meta_data=raw_user_meta_data||'{\"leaderboard_show_identity\":true}'::jsonb where id=$1",[a]);await login(a);assert.equal((await read()).self.display_name,'freshmilchh');
  await db.exec('reset role');await db.query("update auth.users set raw_user_meta_data=raw_user_meta_data||'{\"leaderboard_show_identity\":false}'::jsonb where id=$1",[a]);await login(a);assert.equal((await read()).self.display_name,null);
  await login(d);assert.equal((await read()).total_users,1);assert.equal((await read()).batch_id,123);assert.notEqual((await read()).self.anonymous_label,(await read('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).self.anonymous_label,'even a single-member batch receives random numbers rather than always #0001');
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a]);assert.equal((await db.query('select * from public.student_progress where user_id=$1',[a])).rows.length,0);await login(b);assert.equal((await read()).total_users,2);
 }finally{await db.close();}
});
test('privacy defaults to anonymous, never derives public Google names from email, and safely escapes opted-in names',()=>{
 const user={id:a,email:'private@example.test',user_metadata:{batch_id:122,full_name:'<img src=x>'}},dom=new JSDOM(leaderboardPrivacyForm(user));assert.equal(dom.window.document.querySelector('input').checked,false);assert.equal(dom.window.document.querySelector('img'),null);assert.equal(publicLeaderboardName({email:'private@example.test',user_metadata:{}}),null);assert.equal(publicLeaderboardName({user_metadata:{full_name:'email@example.test'}}),null);dom.window.close();
});
test('leaderboard response whitelists display fields and rejects cross-batch or malformed results',async()=>{
 const row={rank:1,completed_courses:1,required_courses:71,percentage:1.41,anonymous_label:'Anon 122 #0023',display_name:null,is_self:true,private_data:'discard'},data={batch_id:122,page:0,page_size:50,total_users:1,rows:[row],self:row};let args;
 const result=await loadBatchLeaderboard({rpc:async(name,input)=>{assert.equal(name,'get_batch_leaderboard');args=input;return {data,error:null};}},{batch:122,seed});assert.equal(result.rows[0].name,'Anon 122 #0023');assert.equal(result.rows[0].private_data,undefined);assert.deepEqual(args,{p_alias_seed:seed,p_page:0,p_page_size:50});
 await assert.rejects(loadBatchLeaderboard({rpc:async()=>({data:{...data,batch_id:123}})},{batch:122,seed}),/batch changed/);
 await assert.rejects(loadBatchLeaderboard({rpc:async()=>({error:{code:'PGRST202'}})},{batch:122,seed}),error=>error.setupRequired===true);
 const unicode='🌟'.repeat(40),unicodeData={...data,rows:[{...row,display_name:unicode}]};assert.equal((await loadBatchLeaderboard({rpc:async()=>({data:unicodeData})},{batch:122,seed})).rows[0].name,unicode);
});
test('leaderboard discards late responses on account/batch changes and preserves alias seed across pages only',async()=>{
 const dom=new JSDOM('<section></section>'),el=dom.window.document.querySelector('section');let state={user:{id:a,user_metadata:{batch_id:122}},ready:true},resolvers=[],requests=[],count=0;
 const api=attachBatchLeaderboard(el,{getState:()=>state,makeSeed:()=>String(++count),load:options=>{requests.push(options);return new Promise(r=>resolvers.push(r));}});
 api.open();assert.equal(requests.length,1);state={user:{id:b,user_metadata:{batch_id:123}},ready:true};api.syncIdentity();assert.equal(requests.length,2);const fresh=resolvers[1];
 resolvers[0]({rows:[{name:'Old account identity'}]});await Promise.resolve();assert.doesNotMatch(el.textContent,/Old account identity/);
 fresh({batch:123,total:1,page:0,pageSize:50,self:null,rows:[{rank:1,name:'Anon 123 #0009',completed:0,required:67,percentage:0,self:false}]});await Promise.resolve();assert.match(el.textContent,/Anon 123/);assert.doesNotMatch(el.textContent,/Anon 122/);
 el.querySelector('[data-leaderboard="refresh"]').click();assert.notEqual(requests[1].seed,requests[2].seed);api.close();resolvers[2]({rows:[{name:'Late identity'}]});await Promise.resolve();assert.doesNotMatch(el.textContent,/Late identity/);dom.window.close();
});
