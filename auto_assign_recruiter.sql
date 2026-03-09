-- 1. Asegurar que exista la plantilla para el reclutador
INSERT INTO public.recruit_message_templates (template_key, subject, body_md)
VALUES (
    'new_assignment_recruiter', 
    'Asignación de nueva postulación: {candidate_name}', 
    'Hola **{name}**,\n\nSe te ha asignado una nueva postulación para la vacante **{job_title}**.\n\n**Candidato:** {candidate_name}\n**ID de solicitud:** {application_id}\n\nPuedes revisarla ahora mismo en tu tablero de CRM Elite.'
)
ON CONFLICT (template_key) DO UPDATE 
SET subject = EXCLUDED.subject, body_md = EXCLUDED.body_md;

-- 2. Función de Auto-asignación (Actualizada por Rol y Equidad)
CREATE OR REPLACE FUNCTION public.auto_assign_recruiter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    selected_recruiter_id uuid;
BEGIN
    IF NEW.assigned_to IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Solo asignar a rh_recruiter
    SELECT p.id INTO selected_recruiter_id
    FROM public.profiles p
    LEFT JOIN public.recruit_applications a 
      ON a.assigned_to = p.id 
      AND a.status_key NOT IN ('rejected', 'hired') 
    WHERE p.role = 'rh_recruiter'
    GROUP BY p.id
    ORDER BY COUNT(a.id) ASC, random()
    LIMIT 1;

    IF selected_recruiter_id IS NOT NULL THEN
        NEW.assigned_to := selected_recruiter_id;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Función para Notificar al Reclutador (Post-Inserción)
CREATE OR REPLACE FUNCTION public.notify_recruiter_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    recruiter_email text;
    template_id_var uuid;
BEGIN
    -- CORRECCIÓN: La tabla profiles no tiene columna "email", debemos obtenerlo de auth.users
    SELECT u.email INTO recruiter_email 
    FROM auth.users u
    WHERE u.id = NEW.assigned_to;

    -- Obtener ID de la plantilla
    SELECT id INTO template_id_var 
    FROM public.recruit_message_templates 
    WHERE template_key = 'new_assignment_recruiter'
    LIMIT 1;

    -- Insertar en la cola de correos si hay reclutador y plantilla
    IF recruiter_email IS NOT NULL AND template_id_var IS NOT NULL THEN
        INSERT INTO public.recruit_message_logs (
            application_id, 
            template_id, 
            to_address, 
            status, 
            channel
        ) VALUES (
            NEW.id, 
            template_id_var, 
            recruiter_email, 
            'queued', 
            'email'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Limpieza y Creación de Triggers
DROP TRIGGER IF EXISTS trigger_auto_assign_recruiter ON public.recruit_applications;
CREATE TRIGGER trigger_auto_assign_recruiter
BEFORE INSERT ON public.recruit_applications
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_recruiter();

DROP TRIGGER IF EXISTS trigger_notify_recruiter ON public.recruit_applications;
CREATE TRIGGER trigger_notify_recruiter
AFTER INSERT ON public.recruit_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_recruiter_on_assignment();
