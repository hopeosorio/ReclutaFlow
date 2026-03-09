-- catalog_and_events.sql
-- Adds template variables catalog + event logs for metrics

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

alter table public.recruit_template_variables enable row level security;
alter table public.recruit_event_logs enable row level security;

drop policy if exists recruit_template_variables_select_rh on public.recruit_template_variables;
create policy recruit_template_variables_select_rh on public.recruit_template_variables
  for select using (public.is_rh());

drop policy if exists recruit_template_variables_admin_all on public.recruit_template_variables;
create policy recruit_template_variables_admin_all on public.recruit_template_variables
  for all using (public.is_rh_admin()) with check (public.is_rh_admin());

drop policy if exists recruit_event_logs_select_admin on public.recruit_event_logs;
create policy recruit_event_logs_select_admin on public.recruit_event_logs
  for select using (public.is_rh_admin());

drop policy if exists recruit_event_logs_insert_rh on public.recruit_event_logs;
create policy recruit_event_logs_insert_rh on public.recruit_event_logs
  for insert with check (public.is_rh());

insert into public.recruit_template_variables (variable_key, label, description, example_value, sort_order, is_active)
values
  ('name','Nombre del candidato','Nombre completo del postulante','Ana Perez',10,true),
  ('job_title','Vacante','Nombre de la vacante asignada','Asesor de Ventas',20,true),
  ('job_branch','Sucursal','Sucursal donde se ofrece la vacante','Sucursal Centro',30,true),
  ('schedule_date','Fecha agenda','Fecha de entrevista o cita','10/03/2026',40,true),
  ('schedule_time','Hora agenda','Hora de entrevista o cita','10:00',50,true),
  ('location','Lugar','Direccion o sala de entrevista','Sucursal Centro, Piso 2',60,true),
  ('recruiter_name','Reclutador','Nombre del reclutador responsable','Laura Gomez',70,true),
  ('interviewer_name','Entrevistador','Nombre del entrevistador','Carlos Ruiz',80,true),
  ('coupon_code','Cupon','Codigo de cortesia','MEWI-2026',90,true),
  ('onboarding_date','Fecha onboarding','Fecha de presentacion','17/03/2026',100,true),
  ('onboarding_time','Hora onboarding','Hora de presentacion','09:00',110,true),
  ('dress_code','Vestimenta','Codigo de vestimenta','Formal ejecutivo',120,true),
  ('contact_phone','Telefono contacto','Telefono de RH','55 1234 5678',130,true),
  ('contact_email','Correo contacto','Correo de RH','rh@mewi.com',140,true)
on conflict (variable_key) do update
set label = excluded.label,
    description = excluded.description,
    example_value = excluded.example_value,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;
