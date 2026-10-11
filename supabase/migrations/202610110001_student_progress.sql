-- App records are self-reported. Auth confirms account ownership, not university acceptance.
create table if not exists public.student_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 progress jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint student_progress_v3 check (coalesce((
  jsonb_typeof(progress) = 'object' and
  progress->>'version' = '3' and
  progress->>'academicYear' in ('1','2','3','4') and
  jsonb_typeof(progress->'specializationProgression') = 'object' and
  jsonb_typeof(progress->'academicRecords') = 'object' and
  jsonb_typeof(progress->'masteryRecords') = 'object' and
  jsonb_typeof(progress->'quizAttempts') = 'array' and
  jsonb_typeof(progress->'integrationAssessments') = 'array' and
  jsonb_typeof(progress#>'{specializationProgression,previousSpecializationHistory}') = 'array' and
  (
   (progress#>>'{specializationProgression,specializationStatus}' = 'UNDECIDED' and
    progress#>'{specializationProgression,selectedSpecialization}' = 'null'::jsonb)
   or
   (progress#>>'{specializationProgression,specializationStatus}' = 'CONFIRMED' and
    progress#>>'{specializationProgression,selectedSpecialization}' in ('STE','GTE','HWR','TRE','CTM') and
    progress#>>'{specializationProgression,confirmationMethod}' = 'SELF_REPORTED' and
    length(progress#>>'{specializationProgression,confirmedAt}') > 0)
  )
 ),false))
);
alter table public.student_progress enable row level security;
revoke all on public.student_progress from anon, authenticated;
grant select on public.student_progress to authenticated;
drop policy if exists student_reads_own_progress on public.student_progress;
create policy student_reads_own_progress on public.student_progress
 for select to authenticated using ((select auth.uid()) = user_id);

-- Only this ownership-checked function can write. expected_revision detects concurrent edits.
create or replace function public.save_student_progress(p_progress jsonb, p_expected_revision bigint, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); saved_revision bigint;
begin
 if owner is null or owner is distinct from p_user_id then raise exception 'Authentication required for this account'; end if;
 if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision'; end if;
 if p_progress is null or pg_catalog.octet_length(p_progress::text) > 1048576 then raise exception 'Invalid progress size'; end if;
 if p_expected_revision = 0 then
  insert into public.student_progress(user_id,progress,revision)
   values(owner,p_progress,1) on conflict (user_id) do nothing
   returning revision into saved_revision;
 else
  update public.student_progress set progress=p_progress, revision=revision+1, updated_at=now()
   where user_id=owner and revision=p_expected_revision returning revision into saved_revision;
 end if;
 return pg_catalog.jsonb_build_object('saved',saved_revision is not null,'revision',saved_revision);
end $$;
revoke all on function public.save_student_progress(jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_student_progress(jsonb,bigint,uuid) to authenticated;
