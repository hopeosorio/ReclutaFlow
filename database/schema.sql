-- =============================================================
-- ReclutaFlow — Esquema de Base de Datos
-- Fuente: BD viva en Supabase (extraído 2026-04-20)
-- Proyecto: lwjyxfflpxptdmgupgmj.supabase.co
-- PostgreSQL 17.6 — us-east-1
-- =============================================================
-- ADVERTENCIA: Este archivo es referencia. La BD en Supabase
-- es la fuente de verdad. No ejecutar en producción sin revisar.
-- =============================================================

-- ─── Extensiones ─────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─── Helpers ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Funciones de autorización (security definer) ─────────────
create or replace function public.is_rh()
returns boolean language sql stable security definer
set search_path = public set row_security = off as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('rh_admin','rh_recruiter','interviewer')
  );
$$;

create or replace function public.is_rh_admin()
returns boolean language sql stable security definer
set search_path = public set row_security = off as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'rh_admin'
  );
$$;

create or replace function public.is_rh_recruiter()
returns boolean language sql stable security definer
set search_path = public set row_security = off as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'rh_recruiter'
  );
$$;

create or replace function public.is_interviewer()
returns boolean language sql stable security definer
set search_path = public set row_security = off as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'interviewer'
  );
$$;

create or replace function public.is_interviewer_for_application(app_id uuid)
returns boolean language sql stable security definer
set search_path = public set row_security = off as $$
  select exists (
    select 1 from public.recruit_interviews i
    where i.application_id = app_id and i.interviewer_id = auth.uid()
  );
$$;

create or replace function public.can_access_application(app_id uuid)
returns boolean language sql stable as $$
  select
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_applications a
      where a.id = app_id and a.assigned_to = auth.uid()
    )
    or public.is_interviewer_for_application(app_id);
$$;

create or replace function public.can_access_candidate(candidate_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.recruit_applications a
    where a.candidate_id = candidate_id
      and public.can_access_application(a.id)
  );
$$;

create or replace function public.can_access_person(person_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.recruit_candidates c
    where c.person_id = person_id
      and public.can_access_candidate(c.id)
  );
$$;

-- ─── Función: obtener email de un usuario ─────────────────────
create or replace function public.get_user_email(p_user_id uuid)
returns text language sql stable security definer
set search_path = public as $$
  select email from auth.users where id = p_user_id;
$$;

-- ─── Función: application_id desde path de Storage ───────────
create or replace function public.application_id_from_path(p text)
returns uuid language sql stable as $$
  select case
    when split_part(p,'/',1) = 'applications'
     and split_part(p,'/',2) ~* '^[0-9a-f-]{36}$'
    then split_part(p,'/',2)::uuid
    else null
  end;
$$;

-- ─── Función: perfil automático al crear usuario en Auth ──────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'rh_recruiter'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- 1. PERFILES (Personal de RH)
-- =============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('rh_admin','rh_recruiter','interviewer')),
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy profiles_select_own   on public.profiles for select using (auth.uid() = id);
create policy profiles_admin_all    on public.profiles for all    using (public.is_rh_admin()) with check (public.is_rh_admin());

-- =============================================================
-- 2. EMPLEADOS (Fase 2 — tabla vacía actualmente)
-- =============================================================
create table if not exists public.core_employees (
  id           uuid primary key default gen_random_uuid(),
  first_name   text,
  last_name    text,
  phone_mobile text,
  email_work   text,
  position     text,
  branch       text,
  hire_date    date,
  status       text not null default 'active' check (status in ('active','inactive')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_core_employees_updated_at
  before update on public.core_employees
  for each row execute function public.set_updated_at();

alter table public.core_employees enable row level security;
create policy core_employees_admin_all on public.core_employees
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

-- =============================================================
-- 3. VACANTES
-- =============================================================
create table if not exists public.recruit_job_postings (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  branch            text,
  area              text,
  employment_type   text,
  description_short text,
  status            text not null default 'active' check (status in ('active','paused','closed')),
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_job_postings_updated_at
  before update on public.recruit_job_postings
  for each row execute function public.set_updated_at();

alter table public.recruit_job_postings enable row level security;
create policy recruit_job_postings_public_read on public.recruit_job_postings
  for select using (status = 'active');
create policy recruit_job_postings_rh_all on public.recruit_job_postings
  for all using (public.is_rh()) with check (public.is_rh());

-- ─── Perfil extendido de vacante (1:1) ───────────────────────
create table if not exists public.recruit_job_profiles (
  id               uuid primary key default gen_random_uuid(),
  job_posting_id   uuid not null unique references public.recruit_job_postings(id) on delete cascade,
  requirements     text,
  min_education    text,
  skills           text,
  experience       text,
  role_summary     text,
  responsibilities text,
  qualifications   text,
  benefits         text,
  schedule         text,
  salary_range     text,
  location_details text,
  growth_plan      text,
  internal_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_job_profiles_updated_at
  before update on public.recruit_job_profiles
  for each row execute function public.set_updated_at();

alter table public.recruit_job_profiles enable row level security;
create policy recruit_job_profiles_public_read on public.recruit_job_profiles
  for select using (
    exists (select 1 from public.recruit_job_postings jp
            where jp.id = recruit_job_profiles.job_posting_id and jp.status = 'active')
  );
create policy recruit_job_profiles_rh_all on public.recruit_job_profiles
  for all using (public.is_rh()) with check (public.is_rh());

-- =============================================================
-- 4. CATÁLOGO DE ESTATUS
-- sort_order real en BD: new=1, validation=2, virtual_scheduled=3, virtual_done=4,
-- documents_pending=5, documents_complete=6, onboarding=7,
-- onboarding_scheduled=8, hired=9, rejected=10
-- =============================================================
create table if not exists public.recruit_statuses (
  status_key       text primary key,
  label            text not null,
  sort_order       integer not null default 0,
  category         text,    -- 'pipeline' | 'interview' | 'outcome'
  requires_reason  boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_recruit_statuses_updated_at
  before update on public.recruit_statuses
  for each row execute function public.set_updated_at();

alter table public.recruit_statuses enable row level security;
create policy recruit_statuses_public_read   on public.recruit_statuses for select using (is_active = true);
create policy recruit_statuses_select_rh     on public.recruit_statuses for select using (public.is_rh());
create policy recruit_statuses_admin_all     on public.recruit_statuses for all    using (public.is_rh_admin()) with check (public.is_rh_admin());

-- =============================================================
-- 5. PLANTILLAS DE CORREO
-- (Declarada antes de recruit_status_transitions por FK)
-- =============================================================
create table if not exists public.recruit_message_templates (
  id           uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  subject      text not null,
  body_md      text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.recruit_message_templates enable row level security;
create policy recruit_message_templates_public_read on public.recruit_message_templates
  for select using (is_active = true);
create policy recruit_message_templates_select_rh on public.recruit_message_templates
  for select using (public.is_rh());
create policy recruit_message_templates_admin_all on public.recruit_message_templates
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

-- ─── Transiciones de estatus ──────────────────────────────────
create table if not exists public.recruit_status_transitions (
  from_status_key text not null references public.recruit_statuses(status_key),
  to_status_key   text not null references public.recruit_statuses(status_key),
  template_key    text references public.recruit_message_templates(template_key) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (from_status_key, to_status_key)
);

alter table public.recruit_status_transitions enable row level security;
create policy recruit_status_transitions_select_rh  on public.recruit_status_transitions for select using (public.is_rh());
create policy recruit_status_transitions_admin_all  on public.recruit_status_transitions for all    using (public.is_rh_admin()) with check (public.is_rh_admin());

-- =============================================================
-- 6. PERSONAS Y CANDIDATOS
-- =============================================================
create table if not exists public.recruit_persons (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  phone        text,
  email        text,
  address_line1 text,
  address_line2 text,
  neighborhood text,
  city         text,
  state        text,
  postal_code  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_recruit_persons_updated_at
  before update on public.recruit_persons
  for each row execute function public.set_updated_at();

alter table public.recruit_persons enable row level security;
create policy recruit_persons_public_insert    on public.recruit_persons for insert with check (true);
create policy recruit_persons_select_access    on public.recruit_persons for select using (public.can_access_person(recruit_persons.id));
create policy recruit_persons_insert_rh        on public.recruit_persons for insert with check (public.is_rh_admin() or public.is_rh_recruiter());
create policy recruit_persons_update_assigned  on public.recruit_persons
  for update using (public.is_rh_admin() or public.can_access_person(recruit_persons.id))
  with check (public.is_rh_admin() or public.is_rh_recruiter());

create table if not exists public.recruit_candidates (
  id                        uuid primary key default gen_random_uuid(),
  person_id                 uuid not null unique references public.recruit_persons(id) on delete cascade,
  education_level           text,
  has_education_certificate boolean,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger trg_recruit_candidates_updated_at
  before update on public.recruit_candidates
  for each row execute function public.set_updated_at();

alter table public.recruit_candidates enable row level security;
create policy recruit_candidates_public_insert   on public.recruit_candidates for insert with check (true);
create policy recruit_candidates_select_access   on public.recruit_candidates for select using (public.can_access_candidate(recruit_candidates.id));
create policy recruit_candidates_insert_rh       on public.recruit_candidates for insert with check (public.is_rh_admin() or public.is_rh_recruiter());
create policy recruit_candidates_update_assigned on public.recruit_candidates
  for update using (public.is_rh_admin() or public.can_access_candidate(recruit_candidates.id))
  with check (public.is_rh_admin() or public.is_rh_recruiter());

-- =============================================================
-- 7. POSTULACIONES
-- =============================================================
create table if not exists public.recruit_applications (
  id                 uuid primary key default gen_random_uuid(),
  job_posting_id     uuid not null references public.recruit_job_postings(id),
  candidate_id       uuid not null references public.recruit_candidates(id),
  status_key         text not null references public.recruit_statuses(status_key),
  status_reason      text,
  traffic_light      text check (traffic_light in ('red','yellow','green')),
  assigned_to        uuid references public.profiles(id),
  submitted_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  hired_employee_id  uuid references public.core_employees(id),
  suggested_slot_1   timestamptz,
  suggested_slot_2   timestamptz,
  suggested_slot_3   timestamptz,
  meet_link          text,
  unique (job_posting_id, candidate_id)
);

create index if not exists idx_recruit_applications_job    on public.recruit_applications(job_posting_id);
create index if not exists idx_recruit_applications_status on public.recruit_applications(status_key);

create trigger trg_recruit_applications_updated_at
  before update on public.recruit_applications
  for each row execute function public.set_updated_at();

-- Trigger: validar transición de estatus + reason requerida
create or replace function public.recruit_enforce_status_change()
returns trigger language plpgsql as $$
declare
  v_requires_reason boolean;
  v_allowed boolean;
begin
  if (tg_op = 'INSERT') then
    select s.requires_reason into v_requires_reason
    from public.recruit_statuses s where s.status_key = new.status_key and s.is_active = true;
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
      from public.recruit_statuses s where s.status_key = new.status_key and s.is_active = true;
      if v_requires_reason is null then
        raise exception 'invalid status_key: %', new.status_key;
      end if;
      if v_requires_reason and (new.status_reason is null or length(trim(new.status_reason)) = 0) then
        raise exception 'status_reason is required for status %', new.status_key;
      end if;
    end if;
    if (new.status_key is distinct from old.status_key) then
      select exists (
        select 1 from public.recruit_status_transitions t
        where t.from_status_key = old.status_key and t.to_status_key = new.status_key and t.is_active = true
      ) into v_allowed;
      if not v_allowed then
        raise exception 'status transition not allowed: % -> %', old.status_key, new.status_key;
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger trg_recruit_applications_status_guard
  before insert or update of status_key, status_reason on public.recruit_applications
  for each row execute function public.recruit_enforce_status_change();

-- Trigger: registrar cambio de estatus en historial
create or replace function public.recruit_log_status_change()
returns trigger language plpgsql as $$
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

create trigger trg_recruit_applications_status_log_insert
  after insert on public.recruit_applications
  for each row execute function public.recruit_log_status_change();

create trigger trg_recruit_applications_status_log_update
  after update of status_key, status_reason on public.recruit_applications
  for each row execute function public.recruit_log_status_change();

-- Trigger: inmutabilidad de campos para no-admin
create or replace function public.enforce_recruit_applications_immutable()
returns trigger language plpgsql as $$
begin
  if not public.is_rh_admin() then
    if new.job_posting_id    is distinct from old.job_posting_id    then raise exception 'job_posting_id is immutable for non-admin users'; end if;
    if new.candidate_id      is distinct from old.candidate_id      then raise exception 'candidate_id is immutable for non-admin users'; end if;
    if new.assigned_to       is distinct from old.assigned_to       then raise exception 'assigned_to can only be changed by admin users'; end if;
    if new.hired_employee_id is distinct from old.hired_employee_id then raise exception 'hired_employee_id can only be changed by admin users'; end if;
    if new.submitted_at      is distinct from old.submitted_at      then raise exception 'submitted_at is immutable for non-admin users'; end if;
    if new.created_at        is distinct from old.created_at        then raise exception 'created_at is immutable for non-admin users'; end if;
  end if;
  return new;
end $$;

create trigger trg_recruit_applications_immutable
  before update on public.recruit_applications
  for each row execute function public.enforce_recruit_applications_immutable();

-- Trigger: auto-asignación de reclutador al insertar
create or replace function public.auto_assign_recruiter()
returns trigger language plpgsql security definer as $$
declare
  selected_recruiter_id uuid;
begin
  if new.assigned_to is not null then return new; end if;
  selected_recruiter_id := (
    select p.id
    from public.profiles p
    left join public.recruit_applications a
      on a.assigned_to = p.id and a.status_key not in ('rejected','hired')
    where p.role = 'rh_recruiter'
    group by p.id
    order by count(a.id) asc, random()
    limit 1
  );
  if selected_recruiter_id is not null then
    new.assigned_to := selected_recruiter_id;
  end if;
  return new;
end $$;

create trigger trigger_auto_assign_recruiter
  before insert on public.recruit_applications
  for each row execute function public.auto_assign_recruiter();

-- Trigger: notificar al reclutador asignado
create or replace function public.notify_recruiter_on_assignment()
returns trigger language plpgsql security definer as $$
declare
  recruiter_email text;
  template_id_var uuid;
begin
  select u.email into recruiter_email from auth.users u where u.id = new.assigned_to;
  select id into template_id_var from public.recruit_message_templates
    where template_key = 'new_assignment_recruiter' limit 1;
  if recruiter_email is not null and template_id_var is not null then
    insert into public.recruit_message_logs (application_id, template_id, to_address, status, channel)
    values (new.id, template_id_var, recruiter_email, 'queued', 'email');
  end if;
  return new;
end $$;

create trigger trigger_notify_recruiter
  after insert on public.recruit_applications
  for each row execute function public.notify_recruiter_on_assignment();

alter table public.recruit_applications enable row level security;
create policy recruit_applications_public_insert on public.recruit_applications
  for insert with check (status_key = 'new');
create policy recruit_applications_select_access on public.recruit_applications
  for select using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and recruit_applications.assigned_to = auth.uid())
    or (public.is_interviewer() and public.is_interviewer_for_application(recruit_applications.id))
  );
create policy recruit_applications_insert_rh on public.recruit_applications
  for insert with check (
    public.is_rh_admin() or (public.is_rh_recruiter() and recruit_applications.assigned_to is null)
  );
create policy recruit_applications_update_assigned on public.recruit_applications
  for update using (
    public.is_rh_admin() or (public.is_rh_recruiter() and recruit_applications.assigned_to = auth.uid())
  ) with check (
    public.is_rh_admin() or (public.is_rh_recruiter() and recruit_applications.assigned_to = auth.uid())
  );
create policy recruit_applications_delete_admin on public.recruit_applications
  for delete using (public.is_rh_admin());

-- RPC: cambio de estatus autorizado
create or replace function public.recruit_change_status(
  p_application_id uuid,
  p_status_key text,
  p_reason text default null,
  p_note text default null
) returns void language plpgsql as $$
begin
  if not public.is_rh_admin() and not (
    public.is_rh_recruiter()
    and exists (
      select 1 from public.recruit_applications a
      where a.id = p_application_id and a.assigned_to = auth.uid()
    )
  ) then
    raise exception 'not authorized to change status for application %', p_application_id;
  end if;
  update public.recruit_applications
    set status_key = p_status_key, status_reason = p_reason
    where id = p_application_id;
  if not found then
    raise exception 'application not found: %', p_application_id;
  end if;
  if p_note is not null and length(trim(p_note)) > 0 then
    insert into public.recruit_notes(application_id, note, created_by)
    values (p_application_id, p_note, auth.uid());
  end if;
end $$;

-- =============================================================
-- 8. HISTORIAL DE ESTATUS
-- =============================================================
create table if not exists public.recruit_application_status_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  status_key     text not null references public.recruit_statuses(status_key),
  reason         text,
  notes          text,
  changed_by     uuid references public.profiles(id),
  changed_at     timestamptz not null default now()
);

alter table public.recruit_application_status_history enable row level security;
create policy recruit_status_history_public_insert   on public.recruit_application_status_history for insert with check (true);
create policy recruit_status_history_select_access   on public.recruit_application_status_history
  for select using (public.can_access_application(recruit_application_status_history.application_id));
create policy recruit_status_history_insert_assigned on public.recruit_application_status_history
  for insert with check (
    public.is_rh_admin() or (
      public.is_rh_recruiter() and exists (
        select 1 from public.recruit_applications a
        where a.id = recruit_application_status_history.application_id and a.assigned_to = auth.uid()
      )
    )
  );

-- =============================================================
-- 9. NOTAS
-- =============================================================
create table if not exists public.recruit_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  note           text not null,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

alter table public.recruit_notes enable row level security;
create policy recruit_notes_select_access on public.recruit_notes
  for select using (public.can_access_application(recruit_notes.application_id));
create policy recruit_notes_insert_access on public.recruit_notes
  for insert with check (public.is_rh() and public.can_access_application(recruit_notes.application_id));
create policy recruit_notes_update_owner  on public.recruit_notes
  for update using (public.can_access_application(recruit_notes.application_id) and (public.is_rh_admin() or recruit_notes.created_by = auth.uid()))
  with check (public.can_access_application(recruit_notes.application_id) and (public.is_rh_admin() or recruit_notes.created_by = auth.uid()));
create policy recruit_notes_delete_admin  on public.recruit_notes
  for delete using (public.is_rh_admin());

-- =============================================================
-- 10. AVISO DE PRIVACIDAD Y CONSENTIMIENTOS
-- =============================================================
create table if not exists public.recruit_privacy_notices (
  id         uuid primary key default gen_random_uuid(),
  version    text not null unique,
  content_md text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recruit_privacy_notices enable row level security;
create policy recruit_privacy_notices_public_read on public.recruit_privacy_notices for select using (is_active = true);
create policy recruit_privacy_notices_rh_all      on public.recruit_privacy_notices for all    using (public.is_rh()) with check (public.is_rh());

create table if not exists public.recruit_privacy_consents (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references public.recruit_applications(id) on delete cascade,
  privacy_notice_id uuid not null references public.recruit_privacy_notices(id),
  accepted          boolean not null,
  accepted_at       timestamptz not null default now(),
  user_agent        text,
  ip_address        inet
);

alter table public.recruit_privacy_consents enable row level security;
create policy recruit_privacy_consents_public_insert  on public.recruit_privacy_consents for insert with check (true);
create policy recruit_privacy_consents_select_access  on public.recruit_privacy_consents
  for select using (public.can_access_application(recruit_privacy_consents.application_id));
create policy recruit_privacy_consents_insert_admin   on public.recruit_privacy_consents
  for insert with check (public.is_rh_admin());

-- ─── Firmas digitales ─────────────────────────────────────────
create table if not exists public.recruit_digital_signatures (
  id                      uuid primary key default gen_random_uuid(),
  application_id          uuid not null references public.recruit_applications(id) on delete cascade,
  signer_name             text not null,
  signature_storage_path  text,
  signature_json          jsonb,
  signed_at               timestamptz not null default now()
);

alter table public.recruit_digital_signatures enable row level security;
create policy recruit_digital_signatures_public_insert  on public.recruit_digital_signatures for insert with check (true);
create policy recruit_digital_signatures_select_access  on public.recruit_digital_signatures
  for select using (public.can_access_application(recruit_digital_signatures.application_id));
create policy recruit_digital_signatures_insert_admin   on public.recruit_digital_signatures
  for insert with check (public.is_rh_admin());

-- =============================================================
-- 11. SCREENING
-- =============================================================
create table if not exists public.recruit_screening_questions (
  id             uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.recruit_job_postings(id) on delete cascade,
  question_text  text not null,
  question_type  text not null check (question_type in ('text','boolean','single_choice','multi_choice','number')),
  options        jsonb,
  is_required    boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table public.recruit_screening_questions enable row level security;
create policy recruit_screening_questions_public_read on public.recruit_screening_questions
  for select using (
    exists (select 1 from public.recruit_job_postings jp
            where jp.id = recruit_screening_questions.job_posting_id and jp.status = 'active')
  );
create policy recruit_screening_questions_select_rh on public.recruit_screening_questions
  for select using (public.is_rh());
create policy recruit_screening_questions_admin_all on public.recruit_screening_questions
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

create table if not exists public.recruit_screening_answers (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  question_id    uuid not null references public.recruit_screening_questions(id) on delete cascade,
  answer_text    text,
  answer_json    jsonb,
  created_at     timestamptz not null default now(),
  unique (application_id, question_id)
);

alter table public.recruit_screening_answers enable row level security;
create policy recruit_screening_answers_public_insert  on public.recruit_screening_answers for insert with check (true);
create policy recruit_screening_answers_select_access  on public.recruit_screening_answers
  for select using (public.can_access_application(recruit_screening_answers.application_id));
create policy recruit_screening_answers_insert_admin   on public.recruit_screening_answers
  for insert with check (public.is_rh_admin());

-- =============================================================
-- 12. ENTREVISTAS
-- =============================================================
create table if not exists public.recruit_interviews (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  interview_type text not null check (interview_type in ('phone','in_person','virtual')),
  scheduled_at   timestamptz,
  location       text,
  interviewer_id uuid references public.profiles(id),
  result         text not null default 'pending' check (result in ('pending','pass','fail','no_show','reschedule')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_recruit_interviews_updated_at
  before update on public.recruit_interviews
  for each row execute function public.set_updated_at();

create or replace function public.enforce_recruit_interviews_immutable()
returns trigger language plpgsql as $$
begin
  if not public.is_rh_admin() then
    if new.application_id  is distinct from old.application_id  then raise exception 'application_id is immutable for non-admin users'; end if;
    if new.interview_type  is distinct from old.interview_type  then raise exception 'interview_type is immutable for non-admin users'; end if;
    if new.created_at      is distinct from old.created_at      then raise exception 'created_at is immutable for non-admin users'; end if;
  end if;
  if public.is_interviewer() and not public.is_rh_recruiter() and not public.is_rh_admin() then
    if new.scheduled_at   is distinct from old.scheduled_at   then raise exception 'scheduled_at can only be changed by recruiters or admin'; end if;
    if new.location       is distinct from old.location       then raise exception 'location can only be changed by recruiters or admin'; end if;
    if new.interviewer_id is distinct from old.interviewer_id then raise exception 'interviewer_id can only be changed by recruiters or admin'; end if;
  end if;
  return new;
end $$;

create trigger trg_recruit_interviews_immutable
  before update on public.recruit_interviews
  for each row execute function public.enforce_recruit_interviews_immutable();

alter table public.recruit_interviews enable row level security;
create policy recruit_interviews_select_access on public.recruit_interviews
  for select using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_interviews.application_id and a.assigned_to = auth.uid()
    ))
    or (public.is_interviewer() and recruit_interviews.interviewer_id = auth.uid())
  );
create policy recruit_interviews_insert_assigned on public.recruit_interviews
  for insert with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_interviews.application_id and a.assigned_to = auth.uid()
    ))
  );
create policy recruit_interviews_update_access on public.recruit_interviews
  for update using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_interviews.application_id and a.assigned_to = auth.uid()
    ))
    or (public.is_interviewer() and recruit_interviews.interviewer_id = auth.uid())
  ) with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_interviews.application_id and a.assigned_to = auth.uid()
    ))
    or (public.is_interviewer() and recruit_interviews.interviewer_id = auth.uid())
  );
create policy recruit_interviews_delete_admin on public.recruit_interviews
  for delete using (public.is_rh_admin());

-- ─── Eventos de calendario ────────────────────────────────────
create table if not exists public.recruit_calendar_events (
  id           uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.recruit_interviews(id) on delete cascade,
  provider     text not null default 'email_only' check (provider in ('google_calendar','email_only')),
  event_id     text,
  event_link   text,
  created_at   timestamptz not null default now()
);

alter table public.recruit_calendar_events enable row level security;
create policy recruit_calendar_events_select_access on public.recruit_calendar_events
  for select using (
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_interviews i
      where i.id = recruit_calendar_events.interview_id
        and (
          (public.is_rh_recruiter() and exists (
            select 1 from public.recruit_applications a
            where a.id = i.application_id and a.assigned_to = auth.uid()
          ))
          or (public.is_interviewer() and i.interviewer_id = auth.uid())
        )
    )
  );
create policy recruit_calendar_events_insert_assigned on public.recruit_calendar_events
  for insert with check (
    public.is_rh_admin()
    or exists (
      select 1 from public.recruit_interviews i
      where i.id = recruit_calendar_events.interview_id
        and public.is_rh_recruiter()
        and exists (select 1 from public.recruit_applications a where a.id = i.application_id and a.assigned_to = auth.uid())
    )
  );
create policy recruit_calendar_events_delete_admin on public.recruit_calendar_events
  for delete using (public.is_rh_admin());

-- =============================================================
-- 13. TIPOS Y REGISTROS DE DOCUMENTOS
-- =============================================================
create table if not exists public.recruit_document_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  label       text,
  stage       text not null check (stage in ('application','post_interview','onboarding')),
  is_required boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.recruit_document_types enable row level security;
create policy recruit_document_types_public_read on public.recruit_document_types
  for select using (stage = 'application' and is_active = true);
create policy recruit_document_types_select_rh  on public.recruit_document_types for select using (public.is_rh());
create policy recruit_document_types_admin_all  on public.recruit_document_types for all    using (public.is_rh_admin()) with check (public.is_rh_admin());

create table if not exists public.recruit_application_documents (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references public.recruit_applications(id) on delete cascade,
  document_type_id  uuid not null references public.recruit_document_types(id),
  storage_path      text not null,
  validation_status text not null default 'pending' check (validation_status in ('pending','under_review','validated','rejected')),
  validation_notes  text,
  uploaded_at       timestamptz not null default now(),
  validated_at      timestamptz
);

create or replace function public.enforce_recruit_documents_immutable()
returns trigger language plpgsql as $$
begin
  if not public.is_rh_admin() then
    if new.application_id   is distinct from old.application_id   then raise exception 'application_id is immutable for non-admin users'; end if;
    if new.document_type_id is distinct from old.document_type_id then raise exception 'document_type_id is immutable for non-admin users'; end if;
    if new.storage_path     is distinct from old.storage_path     then raise exception 'storage_path is immutable for non-admin users'; end if;
    if new.uploaded_at      is distinct from old.uploaded_at      then raise exception 'uploaded_at is immutable for non-admin users'; end if;
  end if;
  return new;
end $$;

create trigger trg_recruit_application_documents_immutable
  before update on public.recruit_application_documents
  for each row execute function public.enforce_recruit_documents_immutable();

alter table public.recruit_application_documents enable row level security;
create policy recruit_application_documents_public_insert  on public.recruit_application_documents for insert with check (true);
create policy recruit_application_documents_select_access  on public.recruit_application_documents
  for select using (public.can_access_application(recruit_application_documents.application_id));
create policy recruit_application_documents_write_assigned on public.recruit_application_documents
  for all using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_application_documents.application_id and a.assigned_to = auth.uid()
    ))
  ) with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_application_documents.application_id and a.assigned_to = auth.uid()
    ))
  );

-- =============================================================
-- 14. MENSAJERÍA
-- =============================================================

-- ─── Variables de plantilla ───────────────────────────────────
create table if not exists public.recruit_template_variables (
  variable_key  text primary key,
  label         text not null,
  description   text,
  example_value text,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.recruit_template_variables enable row level security;
create policy recruit_template_variables_select_rh  on public.recruit_template_variables for select using (public.is_rh());
create policy recruit_template_variables_admin_all  on public.recruit_template_variables for all    using (public.is_rh_admin()) with check (public.is_rh_admin());

-- ─── Cola de mensajes ─────────────────────────────────────────
create table if not exists public.recruit_message_logs (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null references public.recruit_applications(id) on delete cascade,
  template_id         uuid references public.recruit_message_templates(id),
  channel             text not null default 'email' check (channel in ('email','calendar','other')),
  to_address          text,
  status              text not null default 'queued' check (status in ('queued','sent','failed')),
  provider_message_id text,
  error               text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.recruit_message_logs enable row level security;
create policy recruit_message_logs_public_insert   on public.recruit_message_logs for insert with check (true);
create policy recruit_message_logs_select_access   on public.recruit_message_logs
  for select using (public.can_access_application(recruit_message_logs.application_id));
create policy recruit_message_logs_insert_assigned on public.recruit_message_logs
  for insert with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_message_logs.application_id and a.assigned_to = auth.uid()
    ))
  );

-- ─── Logs de eventos ─────────────────────────────────────────
create table if not exists public.recruit_event_logs (
  id             uuid primary key default gen_random_uuid(),
  event_key      text not null,
  entity_type    text not null,
  entity_id      uuid,
  application_id uuid references public.recruit_applications(id) on delete set null,
  template_id    uuid references public.recruit_message_templates(id),
  metadata       jsonb not null default '{}'::jsonb,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

alter table public.recruit_event_logs enable row level security;
create policy recruit_event_logs_select_admin on public.recruit_event_logs for select using (public.is_rh_admin());
create policy recruit_event_logs_insert_rh    on public.recruit_event_logs for insert with check (public.is_rh());

-- =============================================================
-- 15. SEMÁFORO DE REINGRESO
-- =============================================================
create table if not exists public.recruit_rehire_flags (
  id        uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.recruit_persons(id) on delete cascade,
  color     text not null check (color in ('red','yellow','green')),
  reason    text not null,
  set_by    uuid references public.profiles(id),
  set_at    timestamptz not null default now()
);

alter table public.recruit_rehire_flags enable row level security;
create policy recruit_rehire_flags_select_access  on public.recruit_rehire_flags
  for select using (public.can_access_person(recruit_rehire_flags.person_id));
create policy recruit_rehire_flags_write_assigned on public.recruit_rehire_flags
  for all using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and public.can_access_person(recruit_rehire_flags.person_id))
  ) with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and public.can_access_person(recruit_rehire_flags.person_id))
  );

-- =============================================================
-- 16. ONBOARDING
-- =============================================================
create table if not exists public.recruit_onboarding_hosts (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text not null,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recruit_onboarding_hosts enable row level security;
create policy rh_read_hosts    on public.recruit_onboarding_hosts for select to authenticated using (public.is_rh());
create policy admin_manage_hosts on public.recruit_onboarding_hosts for all to authenticated
  using (public.is_rh_admin()) with check (public.is_rh_admin());

create table if not exists public.recruit_onboarding_plans (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.recruit_applications(id) on delete cascade,
  scheduled_at   timestamptz,
  location       text,
  dress_code     text,
  host_name      text,
  host_id        uuid references public.recruit_onboarding_hosts(id) on delete set null,
  notes          text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_recruit_onboarding_plans_updated_at
  before update on public.recruit_onboarding_plans
  for each row execute function public.set_updated_at();

alter table public.recruit_onboarding_plans enable row level security;
create policy recruit_onboarding_plans_select_access on public.recruit_onboarding_plans
  for select using (public.can_access_application(recruit_onboarding_plans.application_id));
create policy recruit_onboarding_plans_write_assigned on public.recruit_onboarding_plans
  for all using (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_onboarding_plans.application_id and a.assigned_to = auth.uid()
    ))
  ) with check (
    public.is_rh_admin()
    or (public.is_rh_recruiter() and exists (
      select 1 from public.recruit_applications a
      where a.id = recruit_onboarding_plans.application_id and a.assigned_to = auth.uid()
    ))
  );

-- =============================================================
-- 17. STORAGE: bucket recruit-docs
-- =============================================================
insert into storage.buckets (id, name, public)
  values ('recruit-docs', 'recruit-docs', false)
  on conflict (id) do update set public = excluded.public;

alter table storage.objects enable row level security;

-- Lectura: RH con acceso a la postulación
drop policy if exists storage_recruit_docs_read on storage.objects;
create policy storage_recruit_docs_read on storage.objects
  for select using (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  );

-- Inserción pública (candidatos en flujo de postulación)
drop policy if exists storage_recruit_docs_public_insert on storage.objects;
create policy storage_recruit_docs_public_insert on storage.objects
  for insert with check (
    bucket_id = 'recruit-docs'
    and (auth.role() = 'anon' or auth.role() = 'authenticated')
    and split_part(name, '/', 1) = 'applications'
  );

-- Inserción interna (RH con acceso)
drop policy if exists storage_recruit_docs_insert on storage.objects;
create policy storage_recruit_docs_insert on storage.objects
  for insert with check (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  );

-- Actualización: RH con acceso
drop policy if exists storage_recruit_docs_update on storage.objects;
create policy storage_recruit_docs_update on storage.objects
  for update using (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  ) with check (
    bucket_id = 'recruit-docs'
    and public.is_rh()
    and public.can_access_application(public.application_id_from_path(name))
  );

-- Eliminación: solo admin
drop policy if exists storage_recruit_docs_delete on storage.objects;
create policy storage_recruit_docs_delete on storage.objects
  for delete using (bucket_id = 'recruit-docs' and public.is_rh_admin());

-- =============================================================
-- 18. RPCs ADICIONALES
-- =============================================================

-- Slots ocupados para el calendario de candidatos
create or replace function public.get_occupied_slots()
returns table (slot timestamptz) language sql stable security definer as $$
  select scheduled_at from public.recruit_interviews
  where result = 'pending' and scheduled_at is not null
  union
  select suggested_slot_1 from public.recruit_applications
  where suggested_slot_1 is not null
    and status_key not in ('rejected','hired');
$$;

-- Mejor reclutador disponible para slots propuestos
create or replace function public.get_best_recruiter_for_slots(
  p_slot1 timestamptz default null,
  p_slot2 timestamptz default null,
  p_slot3 timestamptz default null
) returns uuid language plpgsql stable security definer
set search_path = public as $$
declare
  v_slot_1_start timestamptz := date_trunc('hour', p_slot1);
  v_slot_2_start timestamptz := date_trunc('hour', p_slot2);
  v_slot_3_start timestamptz := date_trunc('hour', p_slot3);
  v_recruiter_id uuid;
begin
  with eligible_recruiters as (
    select p.id from public.profiles p
    where p.role = 'rh_recruiter'
      and not exists (
        select 1 from public.recruit_interviews ri
        where ri.interviewer_id = p.id and ri.result = 'pending'
          and (
            (p_slot1 is not null and date_trunc('hour', ri.scheduled_at) = v_slot_1_start) or
            (p_slot2 is not null and date_trunc('hour', ri.scheduled_at) = v_slot_2_start) or
            (p_slot3 is not null and date_trunc('hour', ri.scheduled_at) = v_slot_3_start)
          )
      )
      and not exists (
        select 1 from public.recruit_applications ra
        where ra.assigned_to = p.id and ra.status_key in ('new','validation','virtual_scheduled')
          and (
            (p_slot1 is not null and date_trunc('hour', ra.suggested_slot_1::timestamptz) = v_slot_1_start) or
            (p_slot2 is not null and date_trunc('hour', ra.suggested_slot_1::timestamptz) = v_slot_2_start) or
            (p_slot3 is not null and date_trunc('hour', ra.suggested_slot_1::timestamptz) = v_slot_3_start)
          )
      )
  )
  select er.id into v_recruiter_id
  from eligible_recruiters er
  left join public.recruit_applications ra on ra.assigned_to = er.id
    and ra.created_at >= date_trunc('day', now())
  group by er.id
  order by count(ra.id) asc, random()
  limit 1;
  return v_recruiter_id;
end $$;

-- Alias: reclutador disponible para un único slot
create or replace function public.get_available_recruiter_for_slot(p_slot timestamptz)
returns uuid language sql stable as $$
  select public.get_best_recruiter_for_slots(p_slot, null, null);
$$;

-- =============================================================
-- GRANTS para anon (flujo público de postulación)
-- =============================================================
grant select on public.recruit_document_types      to anon;
grant select on public.recruit_screening_questions to anon;
grant select on public.recruit_job_postings        to anon;
grant select on public.recruit_privacy_notices     to anon;
grant select on public.recruit_statuses            to anon;
grant select on public.recruit_message_templates   to anon;
grant insert on public.recruit_message_logs        to anon;
