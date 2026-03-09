-- seed.sql — CLEAN (MVP seeds)
-- Generated: 2026-03-04 04:35 UTC

insert into public.recruit_statuses (status_key, label, sort_order, category, requires_reason, is_active)
values
  ('new','Solicitud recibida',10,'pipeline',false,true),
  ('to_call','Por llamar',20,'pipeline',false,true),
  ('rejected_after_call','Rechazado (después de llamada)',30,'outcome',true,true),
  ('in_person_interview','Pasa a entrevista presencial',40,'pipeline',false,true),
  ('interview_scheduled','Entrevista agendada',50,'pipeline',false,true),
  ('interview_done_pass','Entrevista realizada (aprobado)',60,'outcome',false,true),
  ('interview_done_fail','Entrevista realizada (no aprobado)',70,'outcome',true,true),
  ('documents_pending','Documentos pendientes',80,'pipeline',false,true),
  ('documents_complete','Documentos completos',90,'pipeline',false,true),
  ('onboarding_scheduled','Onboarding programado',100,'pipeline',false,true),
  ('hired','Contratado',110,'outcome',false,true)
on conflict (status_key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    category = excluded.category,
    requires_reason = excluded.requires_reason,
    is_active = excluded.is_active;

insert into public.recruit_status_transitions (from_status_key, to_status_key, template_key, is_active)
values
  ('new','to_call',null,true),
  ('to_call','rejected_after_call','reject_after_call',true),
  ('to_call','in_person_interview',null,true),
  ('in_person_interview','interview_scheduled','schedule_interview',true),
  ('in_person_interview','interview_done_pass',null,true),
  ('in_person_interview','interview_done_fail','fail_after_interview_with_coupon',true),
  ('interview_scheduled','interview_done_pass',null,true),
  ('interview_scheduled','interview_done_fail','fail_after_interview_with_coupon',true),
  ('interview_done_pass','documents_pending',null,true),
  ('documents_pending','documents_complete',null,true),
  ('documents_complete','onboarding_scheduled','onboarding_details',true),
  ('onboarding_scheduled','hired',null,true)
on conflict (from_status_key, to_status_key) do update
set template_key = excluded.template_key,
    is_active = excluded.is_active;

insert into public.recruit_privacy_notices (version, content_md, is_active)
values
  ('v1', '## Aviso de Privacidad\n\n(Coloca aquí el texto oficial del aviso de privacidad del cliente.)\n\n**Finalidad:** Reclutamiento y selección de personal.\n\n**Derechos ARCO:** (definir).', true)
on conflict (version) do update
set content_md = excluded.content_md,
    is_active = excluded.is_active;

insert into public.recruit_message_templates (template_key, subject, body_md, is_active)
values
  ('reject_after_call','Gracias por tu interés','Hola {name},\n\nGracias por tu tiempo. En esta ocasión no continuaremos con tu proceso.\n\nTe agradecemos tu interés.\n\nAtentamente,\nRH', true),
  ('schedule_interview','Agenda tu entrevista','Hola {name},\n\nGracias por tu interés. Para continuar, te esperamos en:\n\n- **Fecha:** {schedule_date}\n- **Hora:** {schedule_time}\n- **Lugar:** {location}\n- **Reclutador:** {recruiter_name}\n\nAtentamente,\nRH', true),
  ('fail_after_interview_with_coupon','Gracias por asistir','Hola {name},\n\nGracias por asistir a tu entrevista. En esta ocasión no continuaremos con tu proceso.\n\nComo agradecimiento, aquí tienes tu cupón Mewi: **{coupon_code}**\n\nAtentamente,\nRH', true),
  ('onboarding_details','Detalles de tu presentación','Hola {name},\n\n¡Felicidades! Te confirmamos tu presentación:\n\n- **Fecha:** {onboarding_date}\n- **Hora:** {onboarding_time}\n- **Lugar:** {location}\n- **Código de vestimenta:** {dress_code}\n- **Te recibirá:** {recruiter_name}\n\nBienvenido/a.\n\nAtentamente,\nRH', true)
  on conflict (template_key) do update
  set subject = excluded.subject,
      body_md = excluded.body_md,
      is_active = excluded.is_active;

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

insert into public.recruit_document_types (name, stage, is_required)
values
  ('solicitud_empleo','application', false),
  ('cv','application', false),
  ('identificacion_oficial','post_interview', true),
  ('comprobante_domicilio','post_interview', true),
  ('comprobante_estudios','post_interview', false),
  ('contrato_firmado','onboarding', true),
  ('alta_imss','onboarding', false)
on conflict (name) do update
set stage = excluded.stage,
    is_required = excluded.is_required;
