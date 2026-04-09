-- ── Asignar plantillas de correo a las transiciones del pipeline ──
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor)

-- 1. Candidato recibe confirmación cuando su postulación entra a revisión
UPDATE public.recruit_status_transitions
  SET template_key = 'welcome_candidate'
  WHERE from_status_key = 'new' AND to_status_key = 'validation';

-- 2. Candidato recibe citación cuando se agenda reunión virtual
UPDATE public.recruit_status_transitions
  SET template_key = 'schedule_interview'
  WHERE to_status_key = 'virtual_scheduled';

-- 3. Candidato aprobado en reunión virtual → se le pide documentación
UPDATE public.recruit_status_transitions
  SET template_key = 'interview_passed_docs'
  WHERE from_status_key = 'virtual_done' AND to_status_key = 'documents_pending';

-- 4. Solicitud de documentos desde cualquier otro estatus
UPDATE public.recruit_status_transitions
  SET template_key = 'documents_request'
  WHERE to_status_key = 'documents_pending'
    AND from_status_key != 'virtual_done';

-- 5. Onboarding programado
UPDATE public.recruit_status_transitions
  SET template_key = 'onboarding_details'
  WHERE to_status_key = 'onboarding_scheduled';

-- 6. Candidato contratado → bienvenida al equipo
UPDATE public.recruit_status_transitions
  SET template_key = 'welcome_onboarding'
  WHERE to_status_key = 'hired';

-- 7. Rechazo desde cualquier estatus
UPDATE public.recruit_status_transitions
  SET template_key = 'rejected'
  WHERE to_status_key = 'rejected';

-- Verificar resultado
SELECT from_status_key, to_status_key, template_key, is_active
FROM public.recruit_status_transitions
ORDER BY from_status_key, to_status_key;
