-- public_submission_policies.sql
-- Permitiendo que candidatos (anon) puedan postularse directamente

-- 1. Personas (Insertar datos bÃ¡sicos)
drop policy if exists recruit_persons_public_insert on public.recruit_persons;
create policy recruit_persons_public_insert on public.recruit_persons
  for insert with check (true); -- Permitir que cualquiera cree su registro de persona

-- 2. Candidatos (Insertar perfil)
drop policy if exists recruit_candidates_public_insert on public.recruit_candidates;
create policy recruit_candidates_public_insert on public.recruit_candidates
  for insert with check (true);

-- 3. Aplicaciones (PostulaciÃ³n inicial)
drop policy if exists recruit_applications_public_insert on public.recruit_applications;
create policy recruit_applications_public_insert on public.recruit_applications
  for insert with check (
    status_key = 'new' -- Forzar que empiecen en 'new'
  );

-- 4. Consentimientos y Firmas
drop policy if exists recruit_privacy_consents_public_insert on public.recruit_privacy_consents;
create policy recruit_privacy_consents_public_insert on public.recruit_privacy_consents
  for insert with check (true);

drop policy if exists recruit_digital_signatures_public_insert on public.recruit_digital_signatures;
create policy recruit_digital_signatures_public_insert on public.recruit_digital_signatures
  for insert with check (true);

-- 5. Respuestas de screening
drop policy if exists recruit_screening_answers_public_insert on public.recruit_screening_answers;
create policy recruit_screening_answers_public_insert on public.recruit_screening_answers
  for insert with check (true);

-- 6. Documentos (Registros en la DB)
drop policy if exists recruit_application_documents_public_insert on public.recruit_application_documents;
create policy recruit_application_documents_public_insert on public.recruit_application_documents
  for insert with check (true);

-- 7. Historial de Estatus (CrÃtico para el trigger)
drop policy if exists recruit_status_history_public_insert on public.recruit_application_status_history;
create policy recruit_status_history_public_insert on public.recruit_application_status_history
  for insert with check (true);

-- 8. Permiso para encolar el correo de bienvenida (Motor Elite)
drop policy if exists recruit_message_logs_public_insert on public.recruit_message_logs;
create policy recruit_message_logs_public_insert on public.recruit_message_logs
  for insert with check (true);

drop policy if exists recruit_message_templates_public_read on public.recruit_message_templates;
create policy recruit_message_templates_public_read on public.recruit_message_templates
  for select using (is_active = true);

-- 9. STORAGE: Permitir que anon suba archivos a su carpeta de aplicaciÃ³n
drop policy if exists storage_recruit_docs_public_insert on storage.objects;
create policy storage_recruit_docs_public_insert on storage.objects
  for insert with check (
    bucket_id = 'recruit-docs'
    and (auth.role() = 'anon' or auth.role() = 'authenticated')
    and split_part(name, '/', 1) = 'applications'
  );

-- Permitir que el anon vea los tipos de documentos, preguntas, ESTATUS y PLANTILLAS (crÃtico para el trigger)
drop policy if exists recruit_statuses_public_read on public.recruit_statuses;
create policy recruit_statuses_public_read on public.recruit_statuses for select using (is_active = true);

grant select on public.recruit_document_types to anon;
grant select on public.recruit_screening_questions to anon;
grant select on public.recruit_job_postings to anon;
grant select on public.recruit_privacy_notices to anon;
grant select on public.recruit_statuses to anon;
grant select on public.recruit_message_templates to anon;
grant insert on public.recruit_message_logs to anon;
