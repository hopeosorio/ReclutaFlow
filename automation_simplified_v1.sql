-- automation_simplified_v1.sql
-- Simplificación del flujo de reclutamiento y automatización de procesos clave.

-- 1. EXTENSION DE ESQUEMA (Si no existe)
ALTER TABLE public.recruit_interviews DROP CONSTRAINT IF EXISTS recruit_interviews_interview_type_check;
ALTER TABLE public.recruit_interviews ADD CONSTRAINT recruit_interviews_interview_type_check 
  CHECK (interview_type IN ('phone', 'in_person', 'virtual'));

ALTER TABLE public.recruit_applications ADD COLUMN IF NOT EXISTS meet_link text;

-- 2. REINICIO Y SIMPLIFICACIÓN DE ESTADOS
-- Desactivamos triggers de usuario temporalmente para permitir el reseteo masivo
-- Usamos 'USER' para no afectar triggers de sistema (FKs) y evitar errores de permisos
ALTER TABLE public.recruit_applications DISABLE TRIGGER USER;

DELETE FROM public.recruit_status_transitions;
DELETE FROM public.recruit_application_status_history;

-- Aseguramos que 'new' exista antes de mover todo ahí
INSERT INTO public.recruit_statuses (status_key, label, sort_order) 
VALUES ('new', 'Solicitud Recibida', 10) 
ON CONFLICT (status_key) DO NOTHING;

-- Movemos aplicaciones existentes al estado base
UPDATE public.recruit_applications SET status_key = 'new', status_reason = null;

-- Ahora sí podemos limpiar el catálogo anterior (excepto 'new')
DELETE FROM public.recruit_statuses WHERE status_key != 'new';

-- Insertamos/Actualizamos los nuevos estados simplificados
INSERT INTO public.recruit_statuses (status_key, label, sort_order, category)
VALUES
  ('new', 'Solicitud Recibida', 10, 'pipeline'),
  ('validation', 'En Validación', 20, 'pipeline'),
  ('interview_scheduled', 'Entrevista Virtual', 30, 'pipeline'),
  ('onboarding', 'Onboarding', 40, 'outcome'),
  ('rejected', 'No Seleccionado', 50, 'outcome')
ON CONFLICT (status_key) DO UPDATE SET 
  label = EXCLUDED.label, 
  sort_order = EXCLUDED.sort_order, 
  category = EXCLUDED.category;

-- Reactivamos los mecanismos de validación
ALTER TABLE public.recruit_applications ENABLE TRIGGER USER;

INSERT INTO public.recruit_status_transitions (from_status_key, to_status_key, template_key)
VALUES
  ('new', 'validation', null),
  ('validation', 'interview_scheduled', 'schedule_interview'),
  ('validation', 'rejected', 'reject_after_call'),
  ('interview_scheduled', 'onboarding', 'onboarding_details'),
  ('interview_scheduled', 'rejected', 'reject_after_call');

-- 3. AUTOMATIZACIÓN: ASIGNACIÓN DE RECLUTADOR
CREATE OR REPLACE FUNCTION public.fn_auto_assign_recruiter()
RETURNS TRIGGER AS $$
DECLARE
  rec_id uuid;
BEGIN
  -- Buscar reclutador con menos carga de trabajo activa
  SELECT p.id INTO rec_id
  FROM public.profiles p
  WHERE p.role IN ('rh_recruiter', 'rh_admin')
  ORDER BY (
    SELECT count(*) 
    FROM public.recruit_applications a 
    WHERE a.assigned_to = p.id 
      AND a.status_key NOT IN ('onboarding', 'rejected')
  ) ASC
  LIMIT 1;

  NEW.assigned_to := rec_id;
  
  -- Auto-mover a 'validation' para que RH empiece a revisar documentos
  IF NEW.status_key = 'new' THEN
    NEW.status_key := 'validation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_recruiter ON public.recruit_applications;
CREATE TRIGGER trg_auto_assign_recruiter
BEFORE INSERT ON public.recruit_applications
FOR EACH ROW EXECUTE FUNCTION public.fn_auto_assign_recruiter();

-- 4. AUTOMATIZACIÓN: COMUNICACIONES Y ENTREVISTAS
CREATE OR REPLACE FUNCTION public.fn_handle_status_automation()
RETURNS TRIGGER AS $$
DECLARE
  cand_email text;
  temp_id uuid;
  scheduled_time timestamptz;
BEGIN
  -- Obtener información del candidato
  SELECT p.email INTO cand_email
  FROM public.recruit_candidates c
  JOIN public.recruit_persons p ON c.person_id = p.id
  WHERE c.id = NEW.candidate_id;

  -- 0. AUTOMATIZACIÓN DE BIENVENIDA (Al crear la aplicación)
  IF (TG_OP = 'INSERT') THEN
    SELECT id INTO temp_id FROM public.recruit_message_templates WHERE template_key = 'welcome_candidate' LIMIT 1;
    IF temp_id IS NOT NULL THEN
      INSERT INTO public.recruit_message_logs (application_id, template_id, to_address, status, channel)
      VALUES (NEW.id, temp_id, cand_email, 'queued', 'email');
    END IF;
  END IF;

  -- A. AUTOMATIZACIÓN DE ENTREVISTA VIRTUAL
  IF (NEW.status_key = 'interview_scheduled' AND (TG_OP = 'INSERT' OR OLD.status_key IS DISTINCT FROM 'interview_scheduled')) THEN
    -- 1. Generar Link de Meet (Si no existe)
    IF NEW.meet_link IS NULL THEN
       -- Update the NEW record during BEFORE trigger (if using AFTER, we'd need an UPDATE)
       -- We are using AFTER, so we must issue an UPDATE command on the table itself
       UPDATE public.recruit_applications 
       SET meet_link = 'https://meet.google.com/mewi-' || lower(substring(replace(NEW.id::text, '-', ''), 1, 10))
       WHERE id = NEW.id AND meet_link IS NULL;
    END IF;
    
    -- 2. Seleccionar primer horario sugerido como oficial
    scheduled_time := COALESCE(NEW.suggested_slot_1, now() + interval '24 hours');

    -- 3. Crear registro en recruit_interviews si no existe
    INSERT INTO public.recruit_interviews (application_id, interview_type, scheduled_at, location, interviewer_id)
    VALUES (NEW.id, 'virtual', scheduled_time, COALESCE(NEW.meet_link, 'Reunión Virtual'), NEW.assigned_to)
    ON CONFLICT DO NOTHING;
    
    -- 4. Enviar Correo de Citación
    SELECT id INTO temp_id FROM public.recruit_message_templates WHERE template_key = 'schedule_interview' LIMIT 1;
    IF temp_id IS NOT NULL THEN
      INSERT INTO public.recruit_message_logs (application_id, template_id, to_address, status, channel)
      VALUES (NEW.id, temp_id, cand_email, 'queued', 'email');
    END IF;
  END IF;

  -- B. AUTOMATIZACIÓN DE RECHAZO (Agradecimiento)
  IF (NEW.status_key = 'rejected' AND (TG_OP = 'INSERT' OR OLD.status_key IS DISTINCT FROM 'rejected')) THEN
    SELECT id INTO temp_id FROM public.recruit_message_templates WHERE template_key = 'reject_after_call' LIMIT 1;
    IF temp_id IS NOT NULL THEN
        INSERT INTO public.recruit_message_logs (application_id, template_id, to_address, status, channel)
        VALUES (NEW.id, temp_id, cand_email, 'queued', 'email');
    END IF;
  END IF;

  -- C. AUTOMATIZACIÓN DE ONBOARDING
  IF (NEW.status_key = 'onboarding' AND (TG_OP = 'INSERT' OR OLD.status_key IS DISTINCT FROM 'onboarding')) THEN
    SELECT id INTO temp_id FROM public.recruit_message_templates WHERE template_key = 'onboarding_details' LIMIT 1;
    IF temp_id IS NOT NULL THEN
        INSERT INTO public.recruit_message_logs (application_id, template_id, to_address, status, channel)
        VALUES (NEW.id, temp_id, cand_email, 'queued', 'email');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_status_automation ON public.recruit_applications;
CREATE TRIGGER trg_status_automation
AFTER INSERT OR UPDATE ON public.recruit_applications
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_status_automation();
