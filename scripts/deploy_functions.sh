#!/usr/bin/env bash
set -euo pipefail

if [ -z "${PROJECT_REF:-}" ]; then
  echo "PROJECT_REF env var is required" >&2
  exit 1
fi

SUPABASE_CMD=(supabase)
if ! command -v supabase >/dev/null 2>&1; then
  if command -v npx >/dev/null 2>&1; then
    SUPABASE_CMD=(npx --yes supabase)
  else
    echo "Supabase CLI not found. Install it (e.g., via Scoop) or ensure npx is available." >&2
    exit 1
  fi
fi

echo "Deploying Supabase Edge Functions..."

# Public (no JWT required)
"${SUPABASE_CMD[@]}" functions deploy submit_application --project-ref "$PROJECT_REF" --no-verify-jwt

# Internal (all use --no-verify-jwt and implement their own auth)
"${SUPABASE_CMD[@]}" functions deploy change_status --project-ref "$PROJECT_REF" --no-verify-jwt
"${SUPABASE_CMD[@]}" functions deploy send_email --project-ref "$PROJECT_REF" --no-verify-jwt
"${SUPABASE_CMD[@]}" functions deploy schedule_interview --project-ref "$PROJECT_REF" --no-verify-jwt
"${SUPABASE_CMD[@]}" functions deploy get_application_preview --project-ref "$PROJECT_REF" --no-verify-jwt
"${SUPABASE_CMD[@]}" functions deploy get_crm_metrics --project-ref "$PROJECT_REF" --no-verify-jwt
"${SUPABASE_CMD[@]}" functions deploy remind_interviews --project-ref "$PROJECT_REF" --no-verify-jwt

echo "Done (7 functions deployed). Remember to set secrets: SUPABASE_SERVICE_ROLE_KEY, EMAIL_SEND_MODE, SMTP_*, SENDGRID_*, FRONTEND_URL."
