-- RLS patch: permitir lectura pública para preguntas y documentos del formulario
-- Ejecuta en Supabase SQL Editor

-- Preguntas rápidas (solo vacantes activas)
drop policy if exists recruit_screening_questions_public_read on public.recruit_screening_questions;
create policy recruit_screening_questions_public_read on public.recruit_screening_questions
  for select using (
    exists (
      select 1 from public.recruit_job_postings jp
      where jp.id = recruit_screening_questions.job_posting_id
        and jp.status = 'active'
    )
  );

-- Documentos (solo etapa solicitud)
drop policy if exists recruit_document_types_public_read on public.recruit_document_types;
create policy recruit_document_types_public_read on public.recruit_document_types
  for select using (stage = 'application');
