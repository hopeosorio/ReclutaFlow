#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env automatically (if present)
ENV_FILE="${ROOT_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key val; do
    if [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    key="$(echo "$key" | tr -d ' \r')"
    # Strip UTF-8 BOM if present
    key="${key#$'\xef\xbb\xbf'}"
    # Support lines like: export KEY=VALUE
    if [[ "$key" == export* ]]; then
      key="${key#export}"
      key="$(echo "$key" | tr -d ' ')"
    fi
    if [[ -z "$key" ]]; then
      continue
    fi
    # Only accept valid bash identifiers
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi
    val="$(echo "${val:-}" | sed 's/\r$//')"
    val="$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    val="${val%\"}"
    val="${val#\"}"
    val="${val%\'}"
    val="${val#\'}"
    export "$key=$val"
  done < "$ENV_FILE"
fi

check_jwt_exp() {
  local jwt="$1"
  local label="$2"
  if [[ -z "$jwt" ]]; then
    return 0
  fi
  if ! command -v base64 >/dev/null 2>&1; then
    return 0
  fi
  local payload json exp now pad
  payload="$(echo -n "$jwt" | cut -d. -f2)"
  if [[ -z "$payload" ]]; then
    return 0
  fi
  payload="${payload//-/+}"
  payload="${payload//_/\/}"
  pad=$(( (4 - ${#payload} % 4) % 4 ))
  if [ "$pad" -gt 0 ]; then
    payload="${payload}$(printf '=%.0s' $(seq 1 $pad))"
  fi
  json="$(echo -n "$payload" | base64 -d 2>/dev/null || echo -n "$payload" | base64 --decode 2>/dev/null || true)"
  if [[ -z "$json" ]]; then
    return 0
  fi
  exp="$(echo "$json" | sed -n 's/.*\"exp\"[[:space:]]*:[[:space:]]*\\([0-9]\\+\\).*/\\1/p')"
  if [[ -z "$exp" ]]; then
    return 0
  fi
  now="$(date +%s)"
  if [ "$exp" -le "$now" ]; then
    echo "$label JWT expired. Regenerate token and update .env." >&2
    exit 1
  fi
}

if [ -z "${PROJECT_REF:-}" ] || [ -z "${FUNCTIONS_BASE_URL:-}" ] || [ -z "${JOB_POSTING_ID:-}" ] || [ -z "${DOCUMENT_TYPE_ID:-}" ] || [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "Missing env vars: PROJECT_REF, FUNCTIONS_BASE_URL, JOB_POSTING_ID, DOCUMENT_TYPE_ID, SUPABASE_URL, SUPABASE_ANON_KEY" >&2
  exit 1
fi

if [ -z "${RECRUITER_JWT:-}" ] && [ -z "${ADMIN_JWT:-}" ]; then
  echo "Missing env vars: RECRUITER_JWT or ADMIN_JWT" >&2
  exit 1
fi

bash scripts/deploy_functions.sh

internal_jwt="${RECRUITER_JWT:-}"
if [ -z "$internal_jwt" ] && [ -n "${ADMIN_JWT:-}" ]; then
  internal_jwt="$ADMIN_JWT"
  echo "Using ADMIN_JWT for internal calls."
fi
internal_jwt="${internal_jwt#Bearer }"
internal_jwt="${internal_jwt#bearer }"
internal_jwt="$(echo "$internal_jwt" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
if [[ "$internal_jwt" != *.*.* ]]; then
  echo "Invalid JWT format (expected 3 parts). Check RECRUITER_JWT/ADMIN_JWT in .env." >&2
  exit 1
fi
check_jwt_exp "$internal_jwt" "Internal"

submit_payload=$(cat <<EOF
{
  "job_posting_id": "${JOB_POSTING_ID}",
  "person": { "first_name": "Ana", "last_name": "Perez", "email": "ana@correo.com" },
  "candidate": { "education_level": "Bachillerato", "has_education_certificate": true },
  "consent": { "accepted": true },
  "signature": { "request_signed_upload": true, "signer_name": "Ana Perez" },
  "documents": [{ "document_type_id": "${DOCUMENT_TYPE_ID}", "file_name": "cv.pdf" }],
  "create_signed_upload_urls": true
}
EOF
)

submit_resp=$(curl -s -X POST "${FUNCTIONS_BASE_URL}/submit_application" \
  -H "Content-Type: application/json" \
  -d "$submit_payload")

application_id=$(echo "$submit_resp" | sed -n 's/.*"application_id"[ ]*:[ ]*"\([^"]*\)".*/\1/p')
if [ -z "$application_id" ]; then
  echo "submit_application failed: $submit_resp" >&2
  exit 1
fi

echo "submit_application ok: $application_id"

if [ -n "${ADMIN_JWT:-}" ] && [ -n "${RECRUITER_USER_ID:-}" ]; then
  assign_resp=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/recruit_applications?id=eq.${application_id}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${ADMIN_JWT}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"assigned_to\":\"${RECRUITER_USER_ID}\"}")
  if [[ "$assign_resp" == "[]" ]]; then
    echo "Failed to assign application to recruiter." >&2
    exit 1
  fi
  echo "assigned_to set for recruiter"
elif [ -z "${ADMIN_JWT:-}" ] && [ -n "${RECRUITER_JWT:-}" ]; then
  echo "Note: recruiter can only act on assigned applications. Provide ADMIN_JWT + RECRUITER_USER_ID to auto-assign."
fi

read_jwt="${ADMIN_JWT:-$internal_jwt}"
read_jwt="${read_jwt#Bearer }"
read_jwt="${read_jwt#bearer }"
read_jwt="$(echo "$read_jwt" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
check_jwt_exp "$read_jwt" "Read"

app_resp=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_applications?select=id,status_key,assigned_to&id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$app_resp" == "[]" ]]; then
  echo "Application not found via REST." >&2
  exit 1
fi
if [[ "$app_resp" != *"\"status_key\":\"new\""* ]]; then
  echo "Expected status_key=new, got: $app_resp" >&2
  exit 1
fi

consent_resp=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_privacy_consents?select=id&application_id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$consent_resp" == "[]" ]]; then
  echo "Consent row missing." >&2
  exit 1
fi

sig_resp=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_digital_signatures?select=id&application_id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$sig_resp" == "[]" ]]; then
  echo "Signature row missing." >&2
  exit 1
fi

doc_resp=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_application_documents?select=id,validation_status&application_id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$doc_resp" == "[]" ]]; then
  echo "Document rows missing." >&2
  exit 1
fi
if [[ "$doc_resp" != *"\"validation_status\":\"pending\""* ]]; then
  echo "Expected document validation_status=pending, got: $doc_resp" >&2
  exit 1
fi

hist_resp=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_application_status_history?select=status_key&application_id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$hist_resp" != *"\"status_key\":\"new\""* ]]; then
  echo "Status history missing 'new' entry." >&2
  exit 1
fi

change_payload=$(cat <<EOF
{
  "application_id": "${application_id}",
  "status_key": "to_call",
  "note": "Intento de contacto"
}
EOF
)

change_resp=$(curl -s -X POST "${FUNCTIONS_BASE_URL}/change_status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${internal_jwt}" \
  -d "$change_payload")

if [[ "$change_resp" != *"\"ok\":true"* ]]; then
  echo "change_status failed: $change_resp" >&2
  exit 1
fi

echo "change_status ok"

send_payload=$(cat <<EOF
{
  "application_id": "${application_id}",
  "template_key": "schedule_interview",
  "variables": { "schedule_instructions": "Responde con tu disponibilidad." }
}
EOF
)

send_resp=$(curl -s -X POST "${FUNCTIONS_BASE_URL}/send_email" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${internal_jwt}" \
  -d "$send_payload")

if [[ "$send_resp" != *"\"ok\":true"* ]]; then
  echo "send_email failed: $send_resp" >&2
  exit 1
fi

echo "send_email ok"

app_resp2=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_applications?select=status_key&id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$app_resp2" != *"\"status_key\":\"to_call\""* ]]; then
  echo "Status not updated to to_call: $app_resp2" >&2
  exit 1
fi

hist_resp2=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_application_status_history?select=status_key&application_id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$hist_resp2" != *"\"status_key\":\"to_call\""* ]]; then
  echo "Status history missing 'to_call' entry." >&2
  exit 1
fi

logs_resp=$(curl -s "${SUPABASE_URL}/rest/v1/recruit_message_logs?select=id,status&application_id=eq.${application_id}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${read_jwt}")
if [[ "$logs_resp" == "[]" ]]; then
  echo "message_logs not found: $logs_resp" >&2
  exit 1
fi
if [[ "$logs_resp" != *"\"status\":\"sent\""* ]]; then
  echo "message_logs missing sent status: $logs_resp" >&2
  exit 1
fi

echo "message_logs ok"

echo "All done."
