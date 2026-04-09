-- 🌱 RECLUTAFLOW SEED v5.2 (Sincronización Total - Producción)
-- Este archivo es el corazón de la configuración de datos del CRM.

-- 1. ESTATUS DEL PIPELINE
insert into public.recruit_statuses (status_key, label, sort_order, category, requires_reason, is_active)
values
  ('new','Solicitud recibida',10,'pipeline',false,true),
  ('validation','En validación',20,'pipeline',false,true),
  ('interview_scheduled','Entrevista agendada',30,'pipeline',false,true),
  ('documents_pending','Expediente pendiente',40,'pipeline',false,true),
  ('documents_complete','Expediente completo',50,'pipeline',false,true),
  ('onboarding_scheduled','Onboarding programado',60,'pipeline',false,true),
  ('hired','Contratado',70,'outcome',false,true),
  ('interview_done_pass','Entrevista aprobada',60,'outcome',false,true),
  ('interview_done_fail','No aprobado en entrevista',80,'outcome',true,true),
  ('rejected','Rechazado',90,'outcome',true,true)
on conflict (status_key) do update
set label = excluded.label, is_active = excluded.is_active, sort_order = excluded.sort_order;

-- 2. CATÁLOGO DE DOCUMENTOS (Oficial ReclutaFlow 2026)
-- Desactivar antiguos por seguridad (Evitar conflicto de Foreign Key)
update public.recruit_document_types set is_active = false;

insert into public.recruit_document_types (name, label, stage, is_required, is_active)
values
  ('cv_solicitud','CV y/o Solicitud de Empleo','application',true, true),
  ('acta_nacimiento','Acta de Nacimiento (Mayor de 18 años)','onboarding',true, true),
  ('curp','CURP (Fecha de impresión reciente)','onboarding',true, true),
  ('rfc','RFC (En caso de contar con él)','onboarding',false, true),
  ('ine','INE (Identificación Oficial)','onboarding',true, true),
  ('comprobante_domicilio','Comprobante de domicilio','onboarding',true, true),
  ('constancia_estudios','Constancia de estudios','onboarding',true, true),
  ('cartas_recomendacion','2 Cartas de Recomendación','onboarding',true, true),
  ('examen_medico','Examen médico','onboarding',true, true),
  ('tipo_sangre','Comprobante de Tipo de Sangre','onboarding',true, true)
on conflict (name) do update
set stage = excluded.stage, is_required = excluded.is_required, label = excluded.label, is_active = true;

-- 3. TRANSICIONES Y REGLAS DE CORREO
insert into public.recruit_status_transitions (from_status_key, to_status_key, is_active, template_key)
values
  ('new', 'validation', true, null),
  ('validation', 'interview_scheduled', true, 'schedule_interview'),
  ('validation', 'rejected', true, 'reject_after_call'),
  ('interview_scheduled', 'documents_pending', true, 'interview_passed_docs'),
  ('interview_scheduled', 'interview_done_fail', true, 'reject_after_call'),
  ('documents_pending', 'documents_complete', true, null),
  ('documents_complete', 'onboarding_scheduled', true, null),
  ('onboarding_scheduled', 'hired', true, null)
on conflict (from_status_key, to_status_key) do update
set template_key = excluded.template_key, is_active = excluded.is_active;
