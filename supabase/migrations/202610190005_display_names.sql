-- Display-name aware leaderboard. Run after 202610190004_batch_leaderboard.sql.
-- Keep the original RPC as a compatibility wrapper so older clients also use chosen names.
-- Ranking = exact completed / required technical-course ratio. Batch is self-reported.
-- Anonymous aliases are a per-view seeded permutation, independent of ranks and signup order.
create or replace function public.get_batch_leaderboard_v2(p_alias_seed uuid, p_page integer default 0, p_page_size integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare viewer uuid := auth.uid(); viewer_batch text;
begin
 if viewer is null then raise exception 'Authentication required'; end if;
 select u.raw_user_meta_data->>'batch_id' into viewer_batch from auth.users u where u.id=viewer;
 if viewer_batch is null or viewer_batch !~ '^(119|12[0-8])$' then raise exception 'Choose a valid batch first'; end if;
 if p_alias_seed is null or p_page is null or p_page<0 or p_page>100000 or p_page_size is null or p_page_size<1 or p_page_size>100 then raise exception 'Invalid leaderboard page'; end if;
 return (
  with catalog(id,branch) as (values
   ('FNDMATH',null),
   ('BASCHEM',null),
   ('BASPHYS',null),
   ('FNDSTAT',null),
   ('LBYME1A',null),
   ('CEORIEN',null),
   ('CESURVE',null),
   ('CALENG1',null),
   ('ENGCHEM',null),
   ('LBYCH1A',null),
   ('ENGPHYS',null),
   ('LBYPH1A',null),
   ('LBYCV1A',null),
   ('ENGENVI',null),
   ('CEECONO',null),
   ('CEGEOLO',null),
   ('CALENG2',null),
   ('LBYCV2A',null),
   ('DATAENG',null),
   ('ENGMEC1',null),
   ('CEHDROL',null),
   ('LBYCV2B',null),
   ('LBYME1B',null),
   ('CALENG3',null),
   ('ENGMEC2',null),
   ('CEHDRA1',null),
   ('CENUMER',null),
   ('LBYCV2C',null),
   ('ENGMEC3',null),
   ('CEMANAG',null),
   ('CEHDRA2',null),
   ('LBYCV2D',null),
   ('CEMEDEF',null),
   ('CESTRUC',null),
   ('LBYCV2E',null),
   ('LBYEC2A',null),
   ('CEGEOEN',null),
   ('LBYCV3A',null),
   ('CEHIWAY',null),
   ('CEMATEL',null),
   ('LBYCV3B',null),
   ('CEBUILD',null),
   ('LBYCV3C',null),
   ('CERCDES',null),
   ('LBYCV3D',null),
   ('CETRANS',null),
   ('LBYCV3E',null),
   ('CEUTIL1',null),
   ('ENGTREP',null),
   ('CEPROJ1',null),
   ('CESTEEL',null),
   ('LBYCV3F',null),
   ('THSVIL1',null),
   ('LBYCV3G',null),
   ('CEETHIC',null),
   ('LBYCV4A',null),
   ('CEQSURV',null),
   ('LBYCV4B',null),
   ('CEUTIL2',null),
   ('CESPECS',null),
   ('LBYEC3A',null),
   ('CEPROJ2',null),
   ('LBYCV4C',null),
   ('THSVIL2',null),
   ('CECONMA',null),
   ('LBYCV4D',null),
   ('CEFOUND',null),
   ('STEMTRX','STE'),
   ('STERQUA','STE'),
   ('STEBLDG','STE'),
   ('STEBRDG','STE'),
   ('GTEROCK','GTE'),
   ('GTEENVI','GTE'),
   ('GTEUGRD','GTE'),
   ('GTESLOP','GTE'),
   ('HWRRGIS','HWR'),
   ('HWRFCDE','HWR'),
   ('HWRSDPD','HWR'),
   ('HWRCORI','HWR'),
   ('TREMMTT','TRE'),
   ('TREATPE','TRE'),
   ('LBYCV4E','TRE'),
   ('TREAPHS','TRE'),
   ('TRETRNS','TRE'),
   ('CTMQAQC','CTM'),
   ('CTMPROM','CTM'),
   ('CTMBLDR','CTM'),
   ('CTMBUEN','CTM')
  ), members as (
   select u.id, p.progress->'academicRecords' as academic_records,
    case when p.progress#>>'{specializationProgression,specializationStatus}'='CONFIRMED' then p.progress#>>'{specializationProgression,selectedSpecialization}' end as branch,
    case when u.raw_user_meta_data->'leaderboard_show_identity'='true'::jsonb then
     case when u.raw_user_meta_data->'display_name' is not null and u.raw_user_meta_data->'display_name'<>'null'::jsonb and u.raw_user_meta_data->>'display_name'<>'' then
       case when pg_catalog.jsonb_typeof(u.raw_user_meta_data->'display_name')='string'
        and u.raw_user_meta_data->>'display_name' !~ '[@[:cntrl:]]'
        and pg_catalog.length(pg_catalog.btrim(u.raw_user_meta_data->>'display_name')) between 1 and 60
        then pg_catalog.btrim(u.raw_user_meta_data->>'display_name') end
      when u.email ~ '^[a-z0-9_]{3,24}@accounts[.]road-to-cele[.]invalid$' then pg_catalog.split_part(u.email,'@',1)
      when coalesce(nullif(u.raw_user_meta_data->>'full_name',''),u.raw_user_meta_data->>'name','') !~ '[@[:cntrl:]]' then
       nullif(pg_catalog.left(pg_catalog.btrim(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),u.raw_user_meta_data->>'name','')),60),'')
     end
    end as display_name
   from auth.users u left join public.student_progress p on p.user_id=u.id
   where u.raw_user_meta_data->>'batch_id'=viewer_batch
  ), counts as (
   select m.id,m.display_name,
    pg_catalog.count(*)::integer as required_courses,
    pg_catalog.count(*) filter(where m.academic_records->c.id->>'status'='COMPLETED')::integer as completed_courses
   from members m join catalog c on c.branch is null or c.branch=m.branch
   group by m.id,m.display_name
  ), ranked as (
   select c.*,
    pg_catalog.rank() over(order by c.completed_courses::numeric/c.required_courses desc)::integer as rank,
    pg_catalog.row_number() over(order by pg_catalog.md5(c.id::text||p_alias_seed::text),c.id)::integer as alias_order,
    pg_catalog.round(100.0*c.completed_courses/c.required_courses,2) as percentage
   from counts c
  ), numbered as (
   select r.*,
    ((r.alias_order-1+(('x'||pg_catalog.substr(pg_catalog.md5(p_alias_seed::text),1,7))::bit(28)::integer)) % greatest(9999,(select pg_catalog.count(*)::integer from members)))+1 as alias_number
   from ranked r
  ), public_rows as (
   select r.id,r.alias_order,r.completed_courses::numeric/r.required_courses as ratio,
    pg_catalog.jsonb_build_object('rank',r.rank,'anonymous_label','Anon '||viewer_batch||' #'||pg_catalog.lpad(r.alias_number::text,greatest(4,pg_catalog.length(r.alias_number::text)),'0'),
     'display_name',r.display_name,'completed_courses',r.completed_courses,'required_courses',r.required_courses,'percentage',r.percentage,'is_self',r.id=viewer) as value
   from numbered r
  ), page_rows as (
   select r.* from public_rows r order by r.ratio desc,r.alias_order limit p_page_size offset (p_page::bigint*p_page_size)
  )
  select pg_catalog.jsonb_build_object('batch_id',viewer_batch::integer,'page',p_page,'page_size',p_page_size,'total_users',(select pg_catalog.count(*) from members),
   'rows',coalesce((select pg_catalog.jsonb_agg(r.value order by r.ratio desc,r.alias_order) from page_rows r),'[]'::jsonb),
   'self',(select r.value from public_rows r where r.id=viewer))
 );
end $$;
revoke all on function public.get_batch_leaderboard_v2(uuid,integer,integer) from public,anon;
grant execute on function public.get_batch_leaderboard_v2(uuid,integer,integer) to authenticated;

create or replace function public.get_batch_leaderboard(p_alias_seed uuid, p_page integer default 0, p_page_size integer default 50)
returns jsonb language sql security invoker set search_path = '' as $$
 select public.get_batch_leaderboard_v2(p_alias_seed,p_page,p_page_size);
$$;
revoke all on function public.get_batch_leaderboard(uuid,integer,integer) from public,anon;
grant execute on function public.get_batch_leaderboard(uuid,integer,integer) to authenticated;
