param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef
)

Write-Host "Deploying Supabase Edge Functions..."

# Public function (no JWT required)
supabase functions deploy submit_application --project-ref $ProjectRef --no-verify-jwt

# Internal functions (JWT required)
supabase functions deploy change_status --project-ref $ProjectRef
supabase functions deploy send_email --project-ref $ProjectRef

Write-Host "Done. Remember to set secrets: SUPABASE_SERVICE_ROLE_KEY. Email is log-only unless EMAIL_SEND_MODE=sendgrid or EMAIL_SEND_MODE=smtp."
