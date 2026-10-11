import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { newProgress } from '../src/progression.mjs';

test('PostgreSQL migration restricts reads/writes to the owner and detects stale revisions',async t=>{
 const db=new PGlite();
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
   insert into auth.users values('${alice}'),('${bob}');`);
  const migration=await readFile(new URL('../supabase/migrations/202610110001_student_progress.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration); // Safe to apply again to the same project.
  const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const save=(p,r,id)=>db.query('select public.save_student_progress($1::jsonb,$2::bigint,$3::uuid) result',[JSON.stringify(p),r,id]);
  await t.test('anonymous clients cannot read or save student records',async()=>{
   await db.exec('set role anon');await assert.rejects(db.query('select * from public.student_progress'),/permission denied/);
   await assert.rejects(save(newProgress(),0,alice),/permission denied/);await db.exec('reset role');
  });
  await t.test('authenticated students can save only for their own account',async()=>{
   await login(alice);assert.equal((await save(newProgress(),0,alice)).rows[0].result.saved,true);
   await assert.rejects(save(newProgress(),0,bob),/Authentication required/);
   await assert.rejects(db.query('update public.student_progress set revision=99'),/permission denied/);
   await assert.rejects(db.query('delete from public.student_progress'),/permission denied/);
  });
  await t.test('other students cannot read the first student record',async()=>{
   await login(bob);assert.equal((await db.query('select * from public.student_progress')).rows.length,0);
   assert.equal((await save(newProgress(),0,bob)).rows[0].result.saved,true);
   assert.equal((await db.query('select user_id from public.student_progress')).rows[0].user_id,bob);
  });
  await t.test('stale writes leave the current cloud snapshot unchanged',async()=>{
   await login(alice);const p=newProgress();p.academicYear=3;
   assert.deepEqual((await save(p,1,alice)).rows[0].result,{saved:true,revision:2});
   assert.equal((await save(newProgress(),1,alice)).rows[0].result.saved,false);
   const row=(await db.query('select progress,revision from public.student_progress')).rows[0];assert.equal(row.progress.academicYear,3);assert.equal(row.revision,2);
  });
  await t.test('malformed progress cannot replace a valid row',async()=>{
   await assert.rejects(save({},2,alice),/student_progress_v3/);
   const p=newProgress();p.specializationProgression.specializationStatus='CONFIRMED';
   await assert.rejects(save(p,2,alice),/student_progress_v3/);
   assert.equal((await db.query('select revision from public.student_progress')).rows[0].revision,2);
  });
 }finally{await db.close();}
});
