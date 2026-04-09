-- RLS smoke tests (replace the UUIDs below)
-- Requires existing auth.users rows for these IDs.
-- Run as postgres, then set role authenticated inside transaction.

-- Replace these with real auth user IDs
-- ADMIN_ID
-- RECRUITER_ID
-- INTERVIEWER_ID

begin;

-- Seed profiles for test users
insert into public.profiles (id, role, full_name)
values
  ('<ADMIN_ID>', 'rh_admin', 'Admin Test'),
  ('<RECRUITER_ID>', 'rh_recruiter', 'Recruiter Test'),
  ('<INTERVIEWER_ID>', 'interviewer', 'Interviewer Test')
on conflict (id) do update
set role = excluded.role,
    full_name = excluded.full_name;

-- Create base data
select set_config('rls.test.job_id', gen_random_uuid()::text, true);
select set_config('rls.test.person_id', gen_random_uuid()::text, true);
select set_config('rls.test.candidate_id', gen_random_uuid()::text, true);
select set_config('rls.test.app_id', gen_random_uuid()::text, true);
select set_config('rls.test.app_id_2', gen_random_uuid()::text, true);
select set_config('rls.test.interview_id', gen_random_uuid()::text, true);

insert into public.recruit_job_postings (id, title, status)
values (current_setting('rls.test.job_id')::uuid, 'Test Posting', 'active');

insert into public.recruit_persons (id, first_name, last_name)
values (current_setting('rls.test.person_id')::uuid, 'Ana', 'Perez');

insert into public.recruit_candidates (id, person_id)
values (current_setting('rls.test.candidate_id')::uuid, current_setting('rls.test.person_id')::uuid);

-- Application assigned to recruiter
insert into public.recruit_applications (id, job_posting_id, candidate_id, status_key, assigned_to)
values (
  current_setting('rls.test.app_id')::uuid,
  current_setting('rls.test.job_id')::uuid,
  current_setting('rls.test.candidate_id')::uuid,
  'new',
  '<RECRUITER_ID>'
);

-- Unassigned application (admin only)
insert into public.recruit_applications (id, job_posting_id, candidate_id, status_key, assigned_to)
values (
  current_setting('rls.test.app_id_2')::uuid,
  current_setting('rls.test.job_id')::uuid,
  current_setting('rls.test.candidate_id')::uuid,
  'new',
  null
);

-- Interview for interviewer access
insert into public.recruit_interviews (id, application_id, interview_type, interviewer_id)
values (
  current_setting('rls.test.interview_id')::uuid,
  current_setting('rls.test.app_id')::uuid,
  'phone',
  '<INTERVIEWER_ID>'
);

-- Switch to authenticated role to enforce RLS
set local role authenticated;

-- Recruiter should see assigned application, not unassigned
select set_config('request.jwt.claim.sub', '<RECRUITER_ID>', true);

do $$
begin
  if (select count(*) from public.recruit_applications where id = current_setting('rls.test.app_id')::uuid) <> 1 then
    raise exception 'Recruiter cannot see assigned application';
  end if;
  if (select count(*) from public.recruit_applications where id = current_setting('rls.test.app_id_2')::uuid) <> 0 then
    raise exception 'Recruiter can see unassigned application';
  end if;
end $$;

-- Interviewer should see application only if interview assigned
select set_config('request.jwt.claim.sub', '<INTERVIEWER_ID>', true);

do $$
begin
  if (select count(*) from public.recruit_applications where id = current_setting('rls.test.app_id')::uuid) <> 1 then
    raise exception 'Interviewer cannot see application with assigned interview';
  end if;
end $$;

-- Interviewer should not be able to update application status
select set_config('request.jwt.claim.sub', '<INTERVIEWER_ID>', true);

do $$
begin
  begin
    update public.recruit_applications
    set status_key = 'to_call'
    where id = current_setting('rls.test.app_id')::uuid;
    raise exception 'Interviewer status update should have failed';
  exception when others then
    -- expected
  end;
end $$;

-- Admin can update status
select set_config('request.jwt.claim.sub', '<ADMIN_ID>', true);
update public.recruit_applications
set status_key = 'to_call'
where id = current_setting('rls.test.app_id')::uuid;

rollback;
