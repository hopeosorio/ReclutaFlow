-- Plantillas para notificación de reagendado de reunión virtual
-- Ejecutar una sola vez en Supabase SQL Editor

INSERT INTO recruit_message_templates (template_key, subject, body_md, is_active)
VALUES
(
  'virtual_reschedule_candidate',
  'Actualización: Tu reunión virtual ha sido reagendada — {job_title}',
  E'Hola **{name}**,\n\nTe informamos que tu reunión virtual para la vacante de **{job_title}** en **{job_branch}** ha sido reagendada.\n\n**Nueva fecha y hora:**\n- 📅 Fecha: {schedule_date}\n- 🕐 Hora: {schedule_time}\n\n**Enlace para unirte:**\n{meet_link}\n\nSi tienes alguna duda o no puedes asistir en esta nueva fecha, comunícate con tu reclutador **{recruiter_name}**.\n\n— Equipo de Reclutamiento',
  true
),
(
  'virtual_reschedule_recruiter',
  'Reunión reagendada — {name} · {job_title}',
  E'Hola **{recruiter_name}**,\n\nSe ha modificado la fecha de la reunión virtual con el candidato **{name}** para la vacante de **{job_title}** en **{job_branch}**.\n\n**Nueva fecha y hora:**\n- 📅 Fecha: {schedule_date}\n- 🕐 Hora: {schedule_time}\n\n**Enlace de la reunión:**\n{meet_link}\n\nPuedes consultar el expediente completo del candidato en el CRM.\n\n— Sistema ReclutaFlow',
  true
)
ON CONFLICT (template_key) DO UPDATE
  SET subject   = EXCLUDED.subject,
      body_md   = EXCLUDED.body_md,
      is_active = EXCLUDED.is_active;
