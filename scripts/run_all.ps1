param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,
  [Parameter(Mandatory = $true)]
  [string]$FunctionsBaseUrl,
  [Parameter(Mandatory = $false)]
  [string]$RecruiterJwt,
  [Parameter(Mandatory = $false)]
  [string]$AdminJwt,
  [Parameter(Mandatory = $false)]
  [string]$RecruiterUserId,
  [Parameter(Mandatory = $true)]
  [string]$JobPostingId,
  [Parameter(Mandatory = $true)]
  [string]$DocumentTypeId,
  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$SupabaseAnonKey
)

Write-Host "Deploying functions..."
.\scripts\deploy_functions.ps1 -ProjectRef $ProjectRef

Write-Host "Running smoke tests..."

if (-not $RecruiterJwt -and -not $AdminJwt) {
  throw "Provide RecruiterJwt or AdminJwt."
}

$internalJwt = $RecruiterJwt
if ($AdminJwt -and -not $RecruiterJwt) {
  $internalJwt = $AdminJwt
  Write-Host "Using AdminJwt for internal calls."
}

function Invoke-RestGet($Uri, $Jwt) {
  return Invoke-RestMethod -Method Get -Uri $Uri -Headers @{
    apikey = $SupabaseAnonKey
    Authorization = "Bearer $Jwt"
  }
}

$submitBody = @{
  job_posting_id = $JobPostingId
  person = @{ first_name = "Ana"; last_name = "Perez"; email = "ana@correo.com" }
  candidate = @{ education_level = "Bachillerato"; has_education_certificate = $true }
  consent = @{ accepted = $true }
  signature = @{ request_signed_upload = $true; signer_name = "Ana Perez" }
  documents = @(@{ document_type_id = $DocumentTypeId; file_name = "cv.pdf" })
  create_signed_upload_urls = $true
} | ConvertTo-Json -Depth 6

$submitResp = Invoke-RestMethod -Method Post -Uri "$FunctionsBaseUrl/submit_application" -ContentType "application/json" -Body $submitBody
$applicationId = $submitResp.application_id

if (-not $applicationId) {
  throw "submit_application did not return application_id"
}

Write-Host "submit_application ok: $applicationId"

if ($AdminJwt -and $RecruiterUserId) {
  $assignBody = @{ assigned_to = $RecruiterUserId } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/recruit_applications?id=eq.$applicationId" `
    -Headers @{
      apikey = $SupabaseAnonKey
      Authorization = "Bearer $AdminJwt"
      Prefer = "return=representation"
    } `
    -ContentType "application/json" -Body $assignBody | Out-Null
  Write-Host "assigned_to set for recruiter"
} elseif (-not $AdminJwt -and $RecruiterJwt) {
  Write-Host "Note: recruiter can only act on assigned applications. Provide AdminJwt + RecruiterUserId to auto-assign."
}

$readJwt = $AdminJwt
if (-not $readJwt) { $readJwt = $internalJwt }

$appResp = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_applications?select=id,status_key,assigned_to&id=eq.$applicationId" $readJwt
$appRows = @($appResp)
if ($appRows.Count -eq 0) { throw "Application not found via REST." }
if ($appRows[0].status_key -ne "new") { throw "Expected status_key=new, got $($appRows[0].status_key)" }

$consentResp = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_privacy_consents?select=id&application_id=eq.$applicationId" $readJwt
if (@($consentResp).Count -eq 0) { throw "Consent row missing." }

$sigResp = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_digital_signatures?select=id&application_id=eq.$applicationId" $readJwt
if (@($sigResp).Count -eq 0) { throw "Signature row missing." }

$docResp = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_application_documents?select=id,validation_status&application_id=eq.$applicationId" $readJwt
$docRows = @($docResp)
if ($docRows.Count -eq 0) { throw "Document rows missing." }
if (($docRows | Where-Object { $_.validation_status -ne "pending" }).Count -gt 0) {
  throw "Expected all documents in pending status."
}

$histResp = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_application_status_history?select=status_key&application_id=eq.$applicationId" $readJwt
$histRows = @($histResp)
if (($histRows | Where-Object { $_.status_key -eq "new" }).Count -eq 0) {
  throw "Status history missing initial 'new' entry."
}

$changeStatusBody = @{
  application_id = $applicationId
  status_key = "to_call"
  note = "Intento de contacto"
} | ConvertTo-Json

$changeHeaders = @{ Authorization = "Bearer $internalJwt" }
Invoke-RestMethod -Method Post -Uri "$FunctionsBaseUrl/change_status" -ContentType "application/json" -Headers $changeHeaders -Body $changeStatusBody | Out-Null
Write-Host "change_status ok"

$appResp2 = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_applications?select=status_key&id=eq.$applicationId" $readJwt
$appRows2 = @($appResp2)
if ($appRows2.Count -eq 0 -or $appRows2[0].status_key -ne "to_call") {
  throw "Status not updated to to_call."
}

$histResp2 = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_application_status_history?select=status_key&application_id=eq.$applicationId" $readJwt
$histRows2 = @($histResp2)
if (($histRows2 | Where-Object { $_.status_key -eq "to_call" }).Count -eq 0) {
  throw "Status history missing 'to_call' entry."
}

$sendEmailBody = @{
  application_id = $applicationId
  template_key = "schedule_interview"
  variables = @{ schedule_instructions = "Responde con tu disponibilidad." }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post -Uri "$FunctionsBaseUrl/send_email" -ContentType "application/json" -Headers $changeHeaders -Body $sendEmailBody | Out-Null
Write-Host "send_email ok"

$logsResp = Invoke-RestGet "$SupabaseUrl/rest/v1/recruit_message_logs?select=id,status&application_id=eq.$applicationId" $readJwt
$logRows = @($logsResp)
if ($logRows.Count -eq 0) { throw "message_logs not found." }
if (($logRows | Where-Object { $_.status -eq "sent" }).Count -eq 0) { throw "message_logs missing sent status." }

Write-Host "All done."
