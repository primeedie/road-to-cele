-- Recovery belongs to the server, separate from academic progress.
create table if not exists public.account_recovery_codes (
 code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 username text not null check (username ~ '^[a-z0-9_]{3,24}$'),
 created_at timestamptz not null default now(),
 used_at timestamptz
);
create index if not exists account_recovery_codes_owner on public.account_recovery_codes(user_id);
create table if not exists public.account_recovery_limits (
 key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
 window_started timestamptz not null default now(),
 attempts integer not null default 1
);
alter table public.account_recovery_codes enable row level security;
alter table public.account_recovery_limits enable row level security;
revoke all on public.account_recovery_codes,public.account_recovery_limits from public,anon,authenticated,service_role;

create or replace function public.recovery_ready()
returns boolean language sql security definer set search_path='' as $$ select true $$;

-- Each bucket is atomic across concurrent requests and Cloudflare instances.
create or replace function public.recovery_rate_limit(p_key text,p_limit integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_key !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 60 then raise exception 'Invalid limit'; end if;
 delete from public.account_recovery_limits where window_started < now()-interval '2 days';
 insert into public.account_recovery_limits as limits(key_hash) values(p_key)
 on conflict(key_hash) do update set
 attempts=case when limits.window_started < now()-interval '15 minutes' then 1 else limits.attempts+1 end,
 window_started=case when limits.window_started < now()-interval '15 minutes' then now() else limits.window_started end
 returning attempts into n;
 return n<=p_limit;
end $$;

create or replace function public.recovery_replace_codes(p_user_id uuid,p_username text,p_hashes text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if cardinality(p_hashes)<>8 or p_hashes is null or
   exists(select 1 from unnest(p_hashes) h where h is null or h !~ '^[a-f0-9]{64}$') or
   not exists(select 1 from auth.users where id=p_user_id and email=p_username||'@accounts.road-to-cele.invalid')
 then raise exception 'Invalid recovery account'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text));
 delete from public.account_recovery_codes where user_id=p_user_id;
 insert into public.account_recovery_codes(code_hash,user_id,username) select h,p_user_id,p_username from unnest(p_hashes) h;
end $$;

-- Consume before the Auth password update: an upstream failure burns one code,
-- rather than making a credential reusable. Concurrent claims cannot both win.
create or replace function public.recovery_claim_code(p_username text,p_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 update public.account_recovery_codes c set used_at=now()
 where c.username=p_username and c.code_hash=p_hash and c.used_at is null
 and exists(select 1 from auth.users u where u.id=c.user_id and u.email=p_username||'@accounts.road-to-cele.invalid')
 returning c.user_id into owner_id;
 return owner_id;
end $$;

revoke all on function public.recovery_ready(),public.recovery_rate_limit(text,integer),public.recovery_replace_codes(uuid,text,text[]),public.recovery_claim_code(text,text) from public,anon,authenticated;
grant execute on function public.recovery_ready(),public.recovery_rate_limit(text,integer),public.recovery_replace_codes(uuid,text,text[]),public.recovery_claim_code(text,text) to service_role;
