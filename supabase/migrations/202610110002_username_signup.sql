-- Select this function as the Before User Created hook, then turn off email
-- confirmation for password accounts. Google remains available independently.
-- Password accounts use reserved internal identifiers, never real mailboxes.
create or replace function public.road_to_cele_before_signup(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
 provider text := event->'user'->'app_metadata'->>'provider';
 identifier text := event->'user'->>'email';
 username text := event->'user'->'user_metadata'->>'username';
begin
 if provider = 'google' then return '{}'::jsonb; end if;
 if provider = 'email'
  and coalesce(identifier ~ '^[a-z0-9_]{3,24}@accounts[.]road-to-cele[.]invalid$',false)
  and coalesce(username = pg_catalog.split_part(identifier,'@',1),false)
 then return '{}'::jsonb; end if;
 return pg_catalog.jsonb_build_object('error',pg_catalog.jsonb_build_object(
  'http_code',400,'message','Use Google or create a username account on Road to CELE.'
 ));
end $$;
revoke all on function public.road_to_cele_before_signup(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.road_to_cele_before_signup(jsonb) to supabase_auth_admin;
