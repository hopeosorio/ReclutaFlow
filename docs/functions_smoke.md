# Edge Functions Smoke Test (curl)

## Prereqs
- Set BASE_URL to your functions base URL.
- Have an active job posting and document type IDs.
- Have a valid recruiter JWT.
- By default, `send_email` runs in log-only mode (`EMAIL_SEND_MODE=log_only`).
- To send real emails, configure provider secrets and set `EMAIL_SEND_MODE=sendgrid` or `EMAIL_SEND_MODE=smtp`.
- SMTP requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (and optional `SMTP_SECURE`).

## 1) submit_application (public)
```bash
export BASE_URL="https://lwjyxfflpxptdmgupgmj.functions.supabase.co"

curl -s -X POST "$BASE_URL/submit_application" \
  -H "Content-Type: application/json" \
  -d '{
    "job_posting_id": "<job_posting_uuid>",
    "person": { "first_name": "Ana", "last_name": "Perez", "email": "ana@correo.com" },
    "candidate": { "education_level": "Bachillerato", "has_education_certificate": true },
    "consent": { "accepted": true },
    "signature": { "request_signed_upload": true, "signer_name": "Ana Perez" },
    "documents": [{ "document_type_id": "<doc_type_uuid>", "file_name": "cv.pdf" }],
    "create_signed_upload_urls": true
  }'
```

## 2) change_status (internal)
```bash
export JWT="<recruiter_jwt>"

curl -s -X POST "$BASE_URL/change_status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "application_id": "<application_uuid>",
    "status_key": "to_call",
    "note": "Intento de contacto"
  }'
```

## 3) send_email (internal)
```bash
curl -s -X POST "$BASE_URL/send_email" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "application_id": "<application_uuid>",
    "template_key": "schedule_interview",
    "variables": { "schedule_instructions": "Contesta este correo con tu disponibilidad." }
  }'
```
