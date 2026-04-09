-- storage_policies.sql
-- Storage bucket + RLS for recruit documents (private)

-- If you get "must be owner of table objects", run with:
-- set role supabase_storage_admin;

-- Bucket
insert into storage.buckets (id, name, public)
values ('recruit-docs', 'recruit-docs', false)
on conflict (id) do update
set public = excluded.public;

-- Helper to extract application_id from object path:
-- Expected path: applications/{application_id}/...
create or replace function public.application_id_from_path(p text)
returns uuid
language sql
stable
as $$
  select case
    when split_part(p,'/',1) = 'applications'
     and split_part(p,'/',2) ~* '^[0-9a-f-]{36}$'
    then split_part(p,'/',2)::uuid
    else null
  end;
$$;

alter table storage.objects enable row level security;

-- Read (internal only, must have access to application)
drop policy if exists storage_recruit_docs_read on storage.objects;
create policy storage_recruit_docs_read on storage.objects
  for select using (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  );

-- Insert (internal only, must have access to application)
drop policy if exists storage_recruit_docs_insert on storage.objects;
create policy storage_recruit_docs_insert on storage.objects
  for insert with check (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  );

-- Update (internal only, must have access to application)
drop policy if exists storage_recruit_docs_update on storage.objects;
create policy storage_recruit_docs_update on storage.objects
  for update using (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  )
  with check (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  );

-- Delete (admin only)
drop policy if exists storage_recruit_docs_delete on storage.objects;
create policy storage_recruit_docs_delete on storage.objects
  for delete using (
    bucket_id = 'recruit-docs'
    and public.is_rh_admin()
  );
