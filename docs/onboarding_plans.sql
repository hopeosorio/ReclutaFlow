-- onboarding_plans.sql
-- Adds onboarding planning details per application.

create table if not exists public.recruit_onboarding_plans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  scheduled_at timestamptz,
  location text,
  dress_code text,
  host_name text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id)
);

drop trigger if exists trg_recruit_onboarding_updated_at on public.recruit_onboarding_plans;
create trigger trg_recruit_onboarding_updated_at
before update on public.recruit_onboarding_plans
for each row execute function public.set_updated_at();

alter table public.recruit_onboarding_plans enable row level security;

drop policy if exists recruit_onboarding_select_access on public.recruit_onboarding_plans;
create policy recruit_onboarding_select_access on public.recruit_onboarding_plans
  for select using (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_onboarding_plans.application_id
          and a.assigned_to = auth.uid()
      )
    )
  );

drop policy if exists recruit_onboarding_insert_access on public.recruit_onboarding_plans;
create policy recruit_onboarding_insert_access on public.recruit_onboarding_plans
  for insert with check (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_onboarding_plans.application_id
          and a.assigned_to = auth.uid()
      )
    )
  );

drop policy if exists recruit_onboarding_update_access on public.recruit_onboarding_plans;
create policy recruit_onboarding_update_access on public.recruit_onboarding_plans
  for update using (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_onboarding_plans.application_id
          and a.assigned_to = auth.uid()
      )
    )
  )
  with check (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_onboarding_plans.application_id
          and a.assigned_to = auth.uid()
      )
    )
  );

drop policy if exists recruit_onboarding_delete_admin on public.recruit_onboarding_plans;
create policy recruit_onboarding_delete_admin on public.recruit_onboarding_plans
  for delete using (public.is_rh_admin());
