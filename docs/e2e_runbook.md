# E2E Runbook (Recruitment MVP)

## Preconditions
1. Seed data loaded (statuses, privacy notice, templates, document types).
2. At least one active job posting in `recruit_job_postings`.
3. Internal users exist in `auth.users` and `profiles` with roles.
4. Storage bucket `recruit-docs` exists and policies are configured.

## Step 1: Submit application (public)
POST to `submit_application` with a sample payload. Example:

```
{
  "job_posting_id": "<job_posting_uuid>",
  "person": { "first_name": "Ana", "last_name": "Perez", "email": "ana@correo.com" },
  "candidate": { "education_level": "Bachillerato", "has_education_certificate": true },
  "consent": { "accepted": true },
  "signature": { "request_signed_upload": true, "signer_name": "Ana Perez" },
  "documents": [{ "document_type_id": "<doc_type_uuid>", "file_name": "cv.pdf" }],
  "create_signed_upload_urls": true
}
```

Expected:
- Returns `application_id`, `candidate_id`, `person_id`.
- Returns `signature_upload` and `document_uploads` with signed URLs if requested.

## Step 2: Upload signature and documents
Use the returned signed URLs to upload files.

Option A: Supabase JS
- Use `storage.from('recruit-docs').uploadToSignedUrl(path, token, file)`.

Option B: HTTP PUT (if allowed by signed URL)
- `PUT <signed_url>` with file bytes and `Content-Type`.

## Step 3: Change status (internal)
Call `change_status` with a recruiter JWT.

```
{ "application_id": "<uuid>", "status_key": "to_call", "note": "Intento de contacto" }
```

Expected:
- `ok: true`
- New row in `recruit_application_status_history`.

## Step 4: Send email (internal)
Call `send_email` with recruiter JWT.

```
{ "application_id": "<uuid>", "template_key": "schedule_interview" }
```

Expected:
- `ok: true`
- Row in `recruit_message_logs` with status `sent` or `failed`.
- Note: in log-only mode (`EMAIL_SEND_MODE=log_only`), no external email is sent. Configure `EMAIL_SEND_MODE=sendgrid` or `EMAIL_SEND_MODE=smtp` for real delivery.
- For SMTP mode, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (optional `SMTP_SECURE`).

## Step 5: DB verification queries
```
select * from recruit_application_status_history where application_id = '<uuid>' order by changed_at desc;
select * from recruit_message_logs where application_id = '<uuid>' order by created_at desc;
select * from recruit_application_documents where application_id = '<uuid>';
```
