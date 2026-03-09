-- job_profile_advanced.sql
-- Adds advanced job profile fields for richer vacancy descriptions.

alter table public.recruit_job_profiles
  add column if not exists role_summary text,
  add column if not exists responsibilities text,
  add column if not exists qualifications text,
  add column if not exists benefits text,
  add column if not exists schedule text,
  add column if not exists salary_range text,
  add column if not exists location_details text,
  add column if not exists growth_plan text,
  add column if not exists internal_notes text;
