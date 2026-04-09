-- schema.sql (Supabase / Postgres) — CLEAN (desde cero)
-- Generated: 2026-03-04 04:35 UTC
-- Single database, single schema: public
-- Prefix convention:
--   recruit_* -> Reclutamiento (CRM)
--   core_*    -> Personal / empleados (fase 2)

create extension if not exists pgcrypto;

-- =========================================================
-- 0) Helpers (updated_at)
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =========================================================
-- 1) Roles / Profiles (RH)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('rh_admin','rh_recruiter','interviewer')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_rh()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('rh_admin','rh_recruiter','interviewer')
  );
$$;

create or replace function public.is_rh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'rh_admin'
  );
$$;

create or replace function public.is_rh_recruiter()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'rh_recruiter'
  );
$$;

create or replace function public.is_interviewer()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'interviewer'
  );
$$;

create or replace function public.is_interviewer_for_application(app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.recruit_interviews i
    where i.application_id = app_id
      and i.interviewer_id = auth.uid()
  );
$$;

create or replace function public.can_access_application(app_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_applications a
      where a.id = app_id
        and a.assigned_to = auth.uid()
    )
    or public.is_interviewer_for_application(app_id);
$$;

create or replace function public.can_access_candidate(candidate_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.recruit_applications a
    where a.candidate_id = candidate_id
      and public.can_access_application(a.id)
  );
$$;

create or replace function public.can_access_person(person_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.recruit_candidates c
    where c.person_id = person_id
      and public.can_access_candidate(c.id)
  );
$$;

-- =========================================================
-- 2) Reclutamiento: Vacantes + perfil
-- =========================================================
create table if not exists public.recruit_job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  branch text,
  area text,
  employment_type text,
  description_short text,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_job_postings_updated_at on public.recruit_job_postings;
create trigger trg_job_postings_updated_at
before update on public.recruit_job_postings
for each row execute function public.set_updated_at();

create table if not exists public.recruit_job_profiles (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.recruit_job_postings(id) on delete cascade,
  requirements text,
  min_education text,
  skills text,
  experience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_posting_id)
);

drop trigger if exists trg_job_profiles_updated_at on public.recruit_job_profiles;
create trigger trg_job_profiles_updated_at
before update on public.recruit_job_profiles
for each row execute function public.set_updated_at();

-- =========================================================
-- 3) Reclutamiento: Catálogo de estatus
-- =========================================================
create table if not exists public.recruit_statuses (
  status_key text primary key,
  label text not null,
  sort_order int not null default 0,
  category text,
  requires_reason boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_recruit_statuses_updated_at on public.recruit_statuses;
create trigger trg_recruit_statuses_updated_at
before update on public.recruit_statuses
for each row execute function public.set_updated_at();

create table if not exists public.recruit_status_transitions (
  from_status_key text not null references public.recruit_statuses(status_key),
  to_status_key text not null references public.recruit_statuses(status_key),
  template_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (from_status_key, to_status_key)
);

-- =========================================================
-- 4) Reclutamiento: Persona / Candidato / Postulación
-- =========================================================
create table if not exists public.recruit_persons (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_recruit_persons_updated_at on public.recruit_persons;
create trigger trg_recruit_persons_updated_at
before update on public.recruit_persons
for each row execute function public.set_updated_at();

create table if not exists public.recruit_candidates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.recruit_persons(id) on delete cascade,
  education_level text,
  has_education_certificate boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id)
);

drop trigger if exists trg_recruit_candidates_updated_at on public.recruit_candidates;
create trigger trg_recruit_candidates_updated_at
before update on public.recruit_candidates
for each row execute function public.set_updated_at();

create table if not exists public.recruit_applications (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.recruit_job_postings(id),
  candidate_id uuid not null references public.recruit_candidates(id),
  status_key text not null references public.recruit_statuses(status_key),
  status_reason text,
  traffic_light text check (traffic_light in ('red','yellow','green')),
  assigned_to uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_posting_id, candidate_id)
);

create index if not exists idx_recruit_applications_job on public.recruit_applications(job_posting_id);
create index if not exists idx_recruit_applications_status on public.recruit_applications(status_key);

drop trigger if exists trg_recruit_applications_updated_at on public.recruit_applications;
create trigger trg_recruit_applications_updated_at
before update on public.recruit_applications
for each row execute function public.set_updated_at();

create or replace function public.enforce_recruit_applications_immutable()
returns trigger
language plpgsql
as $$
begin
  if not public.is_rh_admin() then
    if new.job_posting_id is distinct from old.job_posting_id then
      raise exception 'job_posting_id is immutable for non-admin users';
    end if;
    if new.candidate_id is distinct from old.candidate_id then
      raise exception 'candidate_id is immutable for non-admin users';
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      raise exception 'assigned_to can only be changed by admin users';
    end if;
    if new.hired_employee_id is distinct from old.hired_employee_id then
      raise exception 'hired_employee_id can only be changed by admin users';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception 'submitted_at is immutable for non-admin users';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'created_at is immutable for non-admin users';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_recruit_applications_immutable on public.recruit_applications;
create trigger trg_recruit_applications_immutable
before update on public.recruit_applications
for each row execute function public.enforce_recruit_applications_immutable();

create table if not exists public.recruit_application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  status_key text not null references public.recruit_statuses(status_key),
  reason text,
  notes text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create or replace function public.recruit_log_status_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.recruit_application_status_history(application_id, status_key, reason, notes, changed_by)
    values (new.id, new.status_key, new.status_reason, null, auth.uid());
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if (new.status_key is distinct from old.status_key) or (new.status_reason is distinct from old.status_reason) then
      insert into public.recruit_application_status_history(application_id, status_key, reason, notes, changed_by)
      values (new.id, new.status_key, new.status_reason, null, auth.uid());
    end if;
    return new;
  end if;

  return new;
end $$;

create or replace function public.recruit_enforce_status_change()
returns trigger
language plpgsql
as $$
declare
  v_requires_reason boolean;
  v_allowed boolean;
begin
  if (tg_op = 'INSERT') then
    select s.requires_reason into v_requires_reason
    from public.recruit_statuses s
    where s.status_key = new.status_key
      and s.is_active = true;

    if v_requires_reason is null then
      raise exception 'invalid status_key: %', new.status_key;
    end if;

    if v_requires_reason and (new.status_reason is null or length(trim(new.status_reason)) = 0) then
      raise exception 'status_reason is required for status %', new.status_key;
    end if;

    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if (new.status_key is distinct from old.status_key) or (new.status_reason is distinct from old.status_reason) then
      select s.requires_reason into v_requires_reason
      from public.recruit_statuses s
      where s.status_key = new.status_key
        and s.is_active = true;

      if v_requires_reason is null then
        raise exception 'invalid status_key: %', new.status_key;
      end if;

      if v_requires_reason and (new.status_reason is null or length(trim(new.status_reason)) = 0) then
        raise exception 'status_reason is required for status %', new.status_key;
      end if;
    end if;

    if (new.status_key is distinct from old.status_key) then
      select exists (
        select 1
        from public.recruit_status_transitions t
        where t.from_status_key = old.status_key
          and t.to_status_key = new.status_key
          and t.is_active = true
      ) into v_allowed;

      if not v_allowed then
        raise exception 'status transition not allowed: % -> %', old.status_key, new.status_key;
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_recruit_applications_status_log_insert on public.recruit_applications;
create trigger trg_recruit_applications_status_log_insert
after insert on public.recruit_applications
for each row execute function public.recruit_log_status_change();

drop trigger if exists trg_recruit_applications_status_log_update on public.recruit_applications;
create trigger trg_recruit_applications_status_log_update
after update of status_key, status_reason on public.recruit_applications
for each row execute function public.recruit_log_status_change();

drop trigger if exists trg_recruit_applications_status_guard on public.recruit_applications;
create trigger trg_recruit_applications_status_guard
before insert or update of status_key, status_reason on public.recruit_applications
for each row execute function public.recruit_enforce_status_change();

create or replace function public.recruit_change_status(
  p_application_id uuid,
  p_status_key text,
  p_reason text default null,
  p_note text default null
)
returns void
language plpgsql
as $$
begin
  if not public.is_rh_admin() and not (
    public.is_rh_recruiter()
    and exists (
      select 1 from public.recruit_applications a
      where a.id = p_application_id
        and a.assigned_to = auth.uid()
    )
  ) then
    raise exception 'not authorized to change status for application %', p_application_id;
  end if;

  update public.recruit_applications
  set status_key = p_status_key,
      status_reason = p_reason
  where id = p_application_id;

  if not found then
    raise exception 'application not found: %', p_application_id;
  end if;

  if p_note is not null and length(trim(p_note)) > 0 then
    insert into public.recruit_notes(application_id, note, created_by)
    values (p_application_id, p_note, auth.uid());
  end if;
end $$;

create table if not exists public.recruit_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  note text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- 5) Privacidad + firma
-- =========================================================
create table if not exists public.recruit_privacy_notices (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  content_md text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.recruit_privacy_consents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  privacy_notice_id uuid not null references public.recruit_privacy_notices(id),
  accepted boolean not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  ip_address inet
);

create table if not exists public.recruit_digital_signatures (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  signer_name text not null,
  signature_storage_path text,
  signature_json jsonb,
  signed_at timestamptz not null default now()
);

-- =========================================================
-- 6) Screening
-- =========================================================
create table if not exists public.recruit_screening_questions (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.recruit_job_postings(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('text','boolean','single_choice','multi_choice','number')),
  options jsonb,
  is_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.recruit_screening_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  question_id uuid not null references public.recruit_screening_questions(id) on delete cascade,
  answer_text text,
  answer_json jsonb,
  created_at timestamptz not null default now(),
  unique (application_id, question_id)
);

-- =========================================================
-- 7) Entrevistas
-- =========================================================
create table if not exists public.recruit_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  interview_type text not null check (interview_type in ('phone','in_person')),
  scheduled_at timestamptz,
  location text,
  interviewer_id uuid references public.profiles(id),
  result text not null default 'pending' check (result in ('pending','pass','fail','no_show','reschedule')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_recruit_interviews_updated_at on public.recruit_interviews;
create trigger trg_recruit_interviews_updated_at
before update on public.recruit_interviews
for each row execute function public.set_updated_at();

create or replace function public.enforce_recruit_interviews_immutable()
returns trigger
language plpgsql
as $$
begin
  if not public.is_rh_admin() then
    if new.application_id is distinct from old.application_id then
      raise exception 'application_id is immutable for non-admin users';
    end if;
    if new.interview_type is distinct from old.interview_type then
      raise exception 'interview_type is immutable for non-admin users';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'created_at is immutable for non-admin users';
    end if;
  end if;

  if public.is_interviewer() and not public.is_rh_recruiter() and not public.is_rh_admin() then
    if new.scheduled_at is distinct from old.scheduled_at then
      raise exception 'scheduled_at can only be changed by recruiters or admin';
    end if;
    if new.location is distinct from old.location then
      raise exception 'location can only be changed by recruiters or admin';
    end if;
    if new.interviewer_id is distinct from old.interviewer_id then
      raise exception 'interviewer_id can only be changed by recruiters or admin';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_recruit_interviews_immutable on public.recruit_interviews;
create trigger trg_recruit_interviews_immutable
before update on public.recruit_interviews
for each row execute function public.enforce_recruit_interviews_immutable();

create table if not exists public.recruit_calendar_events (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.recruit_interviews(id) on delete cascade,
  provider text not null default 'email_only' check (provider in ('google_calendar','email_only')),
  event_id text,
  event_link text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 8) Documentos
-- =========================================================
create table if not exists public.recruit_document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  stage text not null check (stage in ('application','post_interview','onboarding')),
  is_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.recruit_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  document_type_id uuid not null references public.recruit_document_types(id),
  storage_path text not null,
  validation_status text not null default 'pending' check (validation_status in ('pending','validated','rejected')),
  validation_notes text,
  uploaded_at timestamptz not null default now(),
  validated_at timestamptz
);

create or replace function public.enforce_recruit_documents_immutable()
returns trigger
language plpgsql
as $$
begin
  if not public.is_rh_admin() then
    if new.application_id is distinct from old.application_id then
      raise exception 'application_id is immutable for non-admin users';
    end if;
    if new.document_type_id is distinct from old.document_type_id then
      raise exception 'document_type_id is immutable for non-admin users';
    end if;
    if new.storage_path is distinct from old.storage_path then
      raise exception 'storage_path is immutable for non-admin users';
    end if;
    if new.uploaded_at is distinct from old.uploaded_at then
      raise exception 'uploaded_at is immutable for non-admin users';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_recruit_application_documents_immutable on public.recruit_application_documents;
create trigger trg_recruit_application_documents_immutable
before update on public.recruit_application_documents
for each row execute function public.enforce_recruit_documents_immutable();

-- =========================================================
-- 9) Mensajes
-- =========================================================
create table if not exists public.recruit_message_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  subject text not null,
  body_md text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recruit_status_transitions
  drop constraint if exists recruit_status_transitions_template_fk;
alter table public.recruit_status_transitions
  add constraint recruit_status_transitions_template_fk
  foreign key (template_key)
  references public.recruit_message_templates(template_key)
  on delete set null;

  create table if not exists public.recruit_message_logs (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.recruit_applications(id) on delete cascade,
    template_id uuid references public.recruit_message_templates(id),
    channel text not null default 'email' check (channel in ('email','calendar','other')),
  to_address text,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  provider_message_id text,
    error text,
    sent_at timestamptz,
    created_at timestamptz not null default now()
  );

  create table if not exists public.recruit_template_variables (
    variable_key text primary key,
    label text not null,
    description text,
    example_value text,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
  );

  create table if not exists public.recruit_event_logs (
    id uuid primary key default gen_random_uuid(),
    event_key text not null,
    entity_type text not null,
    entity_id uuid,
    application_id uuid references public.recruit_applications(id) on delete set null,
    template_id uuid references public.recruit_message_templates(id),
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now()
  );

-- =========================================================
-- 10) Semáforo reingreso
-- =========================================================
create table if not exists public.recruit_rehire_flags (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.recruit_persons(id) on delete cascade,
  color text not null check (color in ('red','yellow','green')),
  reason text not null,
  set_by uuid references public.profiles(id),
  set_at timestamptz not null default now()
);

-- =========================================================
-- 11) Personal (fase 2)
-- =========================================================
create table if not exists public.core_employees (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  phone_mobile text,
  email_work text,
  position text,
  branch text,
  hire_date date,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_core_employees_updated_at on public.core_employees;
create trigger trg_core_employees_updated_at
before update on public.core_employees
for each row execute function public.set_updated_at();

alter table public.recruit_applications
  add column if not exists hired_employee_id uuid references public.core_employees(id);

-- =========================================================
-- 12) RLS baseline
-- =========================================================
alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.is_rh_admin()) with check (public.is_rh_admin());

-- Public read for candidate portal
alter table public.recruit_job_postings enable row level security;
drop policy if exists recruit_job_postings_public_read on public.recruit_job_postings;
create policy recruit_job_postings_public_read on public.recruit_job_postings for select using (status = 'active');

drop policy if exists recruit_job_postings_rh_all on public.recruit_job_postings;
create policy recruit_job_postings_rh_all on public.recruit_job_postings for all using (public.is_rh()) with check (public.is_rh());

alter table public.recruit_job_profiles enable row level security;
drop policy if exists recruit_job_profiles_public_read on public.recruit_job_profiles;
create policy recruit_job_profiles_public_read on public.recruit_job_profiles
  for select using (exists (select 1 from public.recruit_job_postings jp where jp.id = recruit_job_profiles.job_posting_id and jp.status='active'));

drop policy if exists recruit_job_profiles_rh_all on public.recruit_job_profiles;
create policy recruit_job_profiles_rh_all on public.recruit_job_profiles for all using (public.is_rh()) with check (public.is_rh());

alter table public.recruit_privacy_notices enable row level security;
drop policy if exists recruit_privacy_notices_public_read on public.recruit_privacy_notices;
create policy recruit_privacy_notices_public_read on public.recruit_privacy_notices for select using (is_active = true);

drop policy if exists recruit_privacy_notices_rh_all on public.recruit_privacy_notices;
create policy recruit_privacy_notices_rh_all on public.recruit_privacy_notices for all using (public.is_rh()) with check (public.is_rh());

-- Public read for application flow (screening questions + document types)
drop policy if exists recruit_screening_questions_public_read on public.recruit_screening_questions;
create policy recruit_screening_questions_public_read on public.recruit_screening_questions
  for select using (
    exists (
      select 1 from public.recruit_job_postings jp
      where jp.id = recruit_screening_questions.job_posting_id
        and jp.status = 'active'
    )
  );

drop policy if exists recruit_document_types_public_read on public.recruit_document_types;
create policy recruit_document_types_public_read on public.recruit_document_types
  for select using (stage = 'application');

-- Enable RLS for remaining tables and drop previous blanket policies (if any)
do $$
declare t text;
begin
  FOREACH t IN ARRAY ARRAY[
    'recruit_statuses','recruit_status_transitions','recruit_persons','recruit_candidates','recruit_applications',
    'recruit_application_status_history','recruit_notes','recruit_privacy_consents',
    'recruit_digital_signatures','recruit_screening_questions','recruit_screening_answers',
      'recruit_interviews','recruit_calendar_events','recruit_document_types',
      'recruit_application_documents','recruit_message_templates','recruit_message_logs',
      'recruit_template_variables','recruit_event_logs','recruit_rehire_flags','core_employees'
  ]
  LOOP
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_rh_all', t);
  END LOOP;
end $$;

-- =========================================================
-- 12.1) Strict access policies (assignment / interviewer)
-- =========================================================

-- Catalogs (internal read, admin write)
drop policy if exists recruit_statuses_select_rh on public.recruit_statuses;
create policy recruit_statuses_select_rh on public.recruit_statuses
  for select using (public.is_rh());

drop policy if exists recruit_statuses_admin_all on public.recruit_statuses;
create policy recruit_statuses_admin_all on public.recruit_statuses
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

drop policy if exists recruit_status_transitions_select_rh on public.recruit_status_transitions;
create policy recruit_status_transitions_select_rh on public.recruit_status_transitions
  for select using (public.is_rh());

drop policy if exists recruit_status_transitions_admin_all on public.recruit_status_transitions;
create policy recruit_status_transitions_admin_all on public.recruit_status_transitions
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

drop policy if exists recruit_document_types_select_rh on public.recruit_document_types;
create policy recruit_document_types_select_rh on public.recruit_document_types
  for select using (public.is_rh());

drop policy if exists recruit_document_types_admin_all on public.recruit_document_types;
create policy recruit_document_types_admin_all on public.recruit_document_types
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

drop policy if exists recruit_message_templates_select_rh on public.recruit_message_templates;
create policy recruit_message_templates_select_rh on public.recruit_message_templates
  for select using (public.is_rh());

  drop policy if exists recruit_message_templates_admin_all on public.recruit_message_templates;
  create policy recruit_message_templates_admin_all on public.recruit_message_templates
    for all using (public.is_rh_admin()) with check (public.is_rh_admin());

  drop policy if exists recruit_template_variables_select_rh on public.recruit_template_variables;
  create policy recruit_template_variables_select_rh on public.recruit_template_variables
    for select using (public.is_rh());

  drop policy if exists recruit_template_variables_admin_all on public.recruit_template_variables;
  create policy recruit_template_variables_admin_all on public.recruit_template_variables
    for all using (public.is_rh_admin()) with check (public.is_rh_admin());

drop policy if exists recruit_screening_questions_select_rh on public.recruit_screening_questions;
create policy recruit_screening_questions_select_rh on public.recruit_screening_questions
  for select using (public.is_rh());

drop policy if exists recruit_screening_questions_admin_all on public.recruit_screening_questions;
create policy recruit_screening_questions_admin_all on public.recruit_screening_questions
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

-- Candidates / persons
drop policy if exists recruit_persons_select_access on public.recruit_persons;
create policy recruit_persons_select_access on public.recruit_persons
  for select using (public.can_access_person(recruit_persons.id));

drop policy if exists recruit_persons_insert_rh on public.recruit_persons;
create policy recruit_persons_insert_rh on public.recruit_persons
  for insert with check (public.is_rh_admin() or public.is_rh_recruiter());

drop policy if exists recruit_persons_update_assigned on public.recruit_persons;
create policy recruit_persons_update_assigned on public.recruit_persons
  for update using (public.is_rh_admin() or public.can_access_person(recruit_persons.id))
  with check (public.is_rh_admin() or public.is_rh_recruiter());

drop policy if exists recruit_candidates_select_access on public.recruit_candidates;
create policy recruit_candidates_select_access on public.recruit_candidates
  for select using (public.can_access_candidate(recruit_candidates.id));

drop policy if exists recruit_candidates_insert_rh on public.recruit_candidates;
create policy recruit_candidates_insert_rh on public.recruit_candidates
  for insert with check (public.is_rh_admin() or public.is_rh_recruiter());

drop policy if exists recruit_candidates_update_assigned on public.recruit_candidates;
create policy recruit_candidates_update_assigned on public.recruit_candidates
  for update using (public.is_rh_admin() or public.can_access_candidate(recruit_candidates.id))
  with check (public.is_rh_admin() or public.is_rh_recruiter());

-- Applications (strict by assignment or interviewer)
drop policy if exists recruit_applications_select_access on public.recruit_applications;
create policy recruit_applications_select_access on public.recruit_applications
  for select using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and recruit_applications.assigned_to = auth.uid())
    or (public.is_interviewer() and public.is_interviewer_for_application(recruit_applications.id))
  );

drop policy if exists recruit_applications_insert_rh on public.recruit_applications;
create policy recruit_applications_insert_rh on public.recruit_applications
  for insert with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and recruit_applications.assigned_to is null)
  );

drop policy if exists recruit_applications_update_assigned on public.recruit_applications;
create policy recruit_applications_update_assigned on public.recruit_applications
  for update using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and recruit_applications.assigned_to = auth.uid())
  )
  with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and recruit_applications.assigned_to = auth.uid())
  );

drop policy if exists recruit_applications_delete_admin on public.recruit_applications;
create policy recruit_applications_delete_admin on public.recruit_applications
  for delete using (public.is_rh_admin());

-- Status history
drop policy if exists recruit_status_history_select_access on public.recruit_application_status_history;
create policy recruit_status_history_select_access on public.recruit_application_status_history
  for select using (public.can_access_application(recruit_application_status_history.application_id));

drop policy if exists recruit_status_history_insert_assigned on public.recruit_application_status_history;
create policy recruit_status_history_insert_assigned on public.recruit_application_status_history
  for insert with check (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_application_status_history.application_id
          and a.assigned_to = auth.uid()
      )
    )
  );

-- Notes
drop policy if exists recruit_notes_select_access on public.recruit_notes;
create policy recruit_notes_select_access on public.recruit_notes
  for select using (public.can_access_application(recruit_notes.application_id));

drop policy if exists recruit_notes_insert_access on public.recruit_notes;
create policy recruit_notes_insert_access on public.recruit_notes
  for insert with check (
    public.is_rh()
    and public.can_access_application(recruit_notes.application_id)
  );

drop policy if exists recruit_notes_update_owner on public.recruit_notes;
create policy recruit_notes_update_owner on public.recruit_notes
  for update using (
    public.can_access_application(recruit_notes.application_id)
    and (public.is_rh_admin() or recruit_notes.created_by = auth.uid())
  )
  with check (
    public.can_access_application(recruit_notes.application_id)
    and (public.is_rh_admin() or recruit_notes.created_by = auth.uid())
  );

drop policy if exists recruit_notes_delete_admin on public.recruit_notes;
create policy recruit_notes_delete_admin on public.recruit_notes
  for delete using (public.is_rh_admin());

-- Privacy consents and signatures (read if assigned; write by admin/service role)
drop policy if exists recruit_privacy_consents_select_access on public.recruit_privacy_consents;
create policy recruit_privacy_consents_select_access on public.recruit_privacy_consents
  for select using (public.can_access_application(recruit_privacy_consents.application_id));

drop policy if exists recruit_privacy_consents_insert_admin on public.recruit_privacy_consents;
create policy recruit_privacy_consents_insert_admin on public.recruit_privacy_consents
  for insert with check (public.is_rh_admin());

drop policy if exists recruit_digital_signatures_select_access on public.recruit_digital_signatures;
create policy recruit_digital_signatures_select_access on public.recruit_digital_signatures
  for select using (public.can_access_application(recruit_digital_signatures.application_id));

drop policy if exists recruit_digital_signatures_insert_admin on public.recruit_digital_signatures;
create policy recruit_digital_signatures_insert_admin on public.recruit_digital_signatures
  for insert with check (public.is_rh_admin());

-- Screening answers (read if assigned; write by admin/service role)
drop policy if exists recruit_screening_answers_select_access on public.recruit_screening_answers;
create policy recruit_screening_answers_select_access on public.recruit_screening_answers
  for select using (public.can_access_application(recruit_screening_answers.application_id));

drop policy if exists recruit_screening_answers_insert_admin on public.recruit_screening_answers;
create policy recruit_screening_answers_insert_admin on public.recruit_screening_answers
  for insert with check (public.is_rh_admin());

-- Interviews
drop policy if exists recruit_interviews_select_access on public.recruit_interviews;
create policy recruit_interviews_select_access on public.recruit_interviews
  for select using (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_interviews.application_id
          and a.assigned_to = auth.uid()
      )
    )
    or (public.is_interviewer() and recruit_interviews.interviewer_id = auth.uid())
  );

drop policy if exists recruit_interviews_insert_assigned on public.recruit_interviews;
create policy recruit_interviews_insert_assigned on public.recruit_interviews
  for insert with check (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_interviews.application_id
          and a.assigned_to = auth.uid()
      )
    )
  );

drop policy if exists recruit_interviews_update_access on public.recruit_interviews;
create policy recruit_interviews_update_access on public.recruit_interviews
  for update using (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_interviews.application_id
          and a.assigned_to = auth.uid()
      )
    )
    or (public.is_interviewer() and recruit_interviews.interviewer_id = auth.uid())
  )
  with check (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_interviews.application_id
          and a.assigned_to = auth.uid()
      )
    )
    or (public.is_interviewer() and recruit_interviews.interviewer_id = auth.uid())
  );

drop policy if exists recruit_interviews_delete_admin on public.recruit_interviews;
create policy recruit_interviews_delete_admin on public.recruit_interviews
  for delete using (public.is_rh_admin());

-- Calendar events (tied to interview)
drop policy if exists recruit_calendar_events_select_access on public.recruit_calendar_events;
create policy recruit_calendar_events_select_access on public.recruit_calendar_events
  for select using (
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_interviews i
      where i.id = recruit_calendar_events.interview_id
        and (
          (public.is_rh_recruiter() and exists (
            select 1 from public.recruit_applications a
            where a.id = i.application_id
              and a.assigned_to = auth.uid()
          ))
          or (public.is_interviewer() and i.interviewer_id = auth.uid())
        )
    )
  );

drop policy if exists recruit_calendar_events_insert_assigned on public.recruit_calendar_events;
create policy recruit_calendar_events_insert_assigned on public.recruit_calendar_events
  for insert with check (
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_interviews i
      where i.id = recruit_calendar_events.interview_id
        and public.is_rh_recruiter()
        and exists (
          select 1 from public.recruit_applications a
          where a.id = i.application_id
            and a.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists recruit_calendar_events_update_assigned on public.recruit_calendar_events;
create policy recruit_calendar_events_update_assigned on public.recruit_calendar_events
  for update using (
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_interviews i
      where i.id = recruit_calendar_events.interview_id
        and public.is_rh_recruiter()
        and exists (
          select 1 from public.recruit_applications a
          where a.id = i.application_id
            and a.assigned_to = auth.uid()
        )
    )
  )
  with check (
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_interviews i
      where i.id = recruit_calendar_events.interview_id
        and public.is_rh_recruiter()
        and exists (
          select 1 from public.recruit_applications a
          where a.id = i.application_id
            and a.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists recruit_calendar_events_delete_admin on public.recruit_calendar_events;
create policy recruit_calendar_events_delete_admin on public.recruit_calendar_events
  for delete using (public.is_rh_admin());

-- Application documents
drop policy if exists recruit_application_documents_select_access on public.recruit_application_documents;
create policy recruit_application_documents_select_access on public.recruit_application_documents
  for select using (public.can_access_application(recruit_application_documents.application_id));

drop policy if exists recruit_application_documents_write_assigned on public.recruit_application_documents;
create policy recruit_application_documents_write_assigned on public.recruit_application_documents
  for all using (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_application_documents.application_id
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
        where a.id = recruit_application_documents.application_id
          and a.assigned_to = auth.uid()
      )
    )
  );

-- Message logs
drop policy if exists recruit_message_logs_select_access on public.recruit_message_logs;
create policy recruit_message_logs_select_access on public.recruit_message_logs
  for select using (public.can_access_application(recruit_message_logs.application_id));

  drop policy if exists recruit_message_logs_insert_assigned on public.recruit_message_logs;
  create policy recruit_message_logs_insert_assigned on public.recruit_message_logs
    for insert with check (
      public.is_rh_admin()
      or (
        public.is_rh_recruiter()
        and exists (
          select 1 from public.recruit_applications a
          where a.id = recruit_message_logs.application_id
            and a.assigned_to = auth.uid()
        )
      )
    );

  drop policy if exists recruit_event_logs_select_admin on public.recruit_event_logs;
  create policy recruit_event_logs_select_admin on public.recruit_event_logs
    for select using (public.is_rh_admin());

  drop policy if exists recruit_event_logs_insert_rh on public.recruit_event_logs;
  create policy recruit_event_logs_insert_rh on public.recruit_event_logs
    for insert with check (public.is_rh());

-- Rehire flags
drop policy if exists recruit_rehire_flags_select_access on public.recruit_rehire_flags;
create policy recruit_rehire_flags_select_access on public.recruit_rehire_flags
  for select using (public.can_access_person(recruit_rehire_flags.person_id));

drop policy if exists recruit_rehire_flags_write_assigned on public.recruit_rehire_flags;
create policy recruit_rehire_flags_write_assigned on public.recruit_rehire_flags
  for all using (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and public.can_access_person(recruit_rehire_flags.person_id)
    )
  )
  with check (
    public.is_rh_admin()
    or (
      public.is_rh_recruiter()
      and public.can_access_person(recruit_rehire_flags.person_id)
    )
  );

-- Core employees (phase 2)
drop policy if exists core_employees_admin_all on public.core_employees;
create policy core_employees_admin_all on public.core_employees
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());
