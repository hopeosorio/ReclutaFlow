-- status_transition_templates.sql
-- Adds email template mapping to status transitions + updates default templates.

alter table public.recruit_status_transitions
  add column if not exists template_key text;

alter table public.recruit_status_transitions
  drop constraint if exists recruit_status_transitions_template_fk;
alter table public.recruit_status_transitions
  add constraint recruit_status_transitions_template_fk
  foreign key (template_key)
  references public.recruit_message_templates(template_key)
  on delete set null;

update public.recruit_status_transitions
set template_key = 'reject_after_call'
where from_status_key = 'to_call' and to_status_key = 'rejected_after_call';

update public.recruit_status_transitions
set template_key = 'schedule_interview'
where from_status_key = 'in_person_interview' and to_status_key = 'interview_scheduled';

update public.recruit_status_transitions
set template_key = 'fail_after_interview_with_coupon'
where to_status_key = 'interview_done_fail';

update public.recruit_status_transitions
set template_key = 'onboarding_details'
where from_status_key = 'documents_complete' and to_status_key = 'onboarding_scheduled';

update public.recruit_message_templates
set body_md = 'Hola {name},\n\nGracias por tu interés. Para continuar, te esperamos en:\n\n- **Fecha:** {schedule_date}\n- **Hora:** {schedule_time}\n- **Lugar:** {location}\n- **Reclutador:** {recruiter_name}\n\nAtentamente,\nRH'
where template_key = 'schedule_interview';

update public.recruit_message_templates
set body_md = 'Hola {name},\n\n¡Felicidades! Te confirmamos tu presentación:\n\n- **Fecha:** {onboarding_date}\n- **Hora:** {onboarding_time}\n- **Lugar:** {location}\n- **Código de vestimenta:** {dress_code}\n- **Te recibirá:** {recruiter_name}\n\nBienvenido/a.\n\nAtentamente,\nRH'
where template_key = 'onboarding_details';
