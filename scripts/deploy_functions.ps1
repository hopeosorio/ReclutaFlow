param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef
)

Write-Host "Deploying Supabase Edge Functions..."

# Public (no JWT required)
supabase functions deploy submit_application --project-ref $ProjectRef --no-verify-jwt

# Internal (all use --no-verify-jwt and implement their own auth)
supabase functions deploy change_status --project-ref $ProjectRef --no-verify-jwt
supabase functions deploy send_email --project-ref $ProjectRef --no-verify-jwt
supabase functions deploy schedule_interview --project-ref $ProjectRef --no-verify-jwt
supabase functions deploy get_application_preview --project-ref $ProjectRef --no-verify-jwt
supabase functions deploy get_crm_metrics --project-ref $ProjectRef --no-verify-jwt
supabase functions deploy remind_interviews --project-ref $ProjectRef --no-verify-jwt

Write-Host "Done (7 functions deployed). Remember to set secrets: SUPABASE_SERVICE_ROLE_KEY, EMAIL_SEND_MODE, SMTP_*, SENDGRID_*, FRONTEND_URL."
