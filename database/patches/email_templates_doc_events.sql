-- Templates for document lifecycle events
-- Run once against the live Supabase DB

INSERT INTO recruit_message_templates (template_key, subject, body_md, is_active)
VALUES
(
  'document_rejected',
  'Documento pendiente de corrección — {job_title}',
  'Hola **{name}**,

Hemos revisado tu expediente para la vacante de **{job_title}** y encontramos un problema con el siguiente documento:

> **{doc_name}**

**Motivo:** {rejection_reason}

Te pedimos que ingreses nuevamente a tu expediente y sustituyas el archivo con una versión correcta. El proceso es sencillo: localiza el documento señalado y sube la nueva versión.

[CORREGIR MI EXPEDIENTE]({track_url})

Si tienes alguna duda, comunícate con tu reclutador asignado, **{recruiter_name}**.

Saludos,
**Equipo de Reclutamiento**',
  true
),
(
  'all_docs_uploaded',
  'Expediente listo para revisión — {name} ({job_title})',
  'Hola **{recruiter_name}**,

El candidato **{name}** ha completado la carga de sus documentos para la vacante de **{job_title}**.

Su expediente está disponible para revisión en el CRM. Puedes validar cada archivo y avanzar el proceso cuando lo consideres.

[REVISAR EXPEDIENTE]({crm_url})

Saludos,
**Sistema ReclutaFlow**',
  true
)
ON CONFLICT (template_key) DO UPDATE
  SET subject  = EXCLUDED.subject,
      body_md  = EXCLUDED.body_md,
      is_active = EXCLUDED.is_active;
