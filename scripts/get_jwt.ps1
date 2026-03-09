param(
  [Parameter(Mandatory = $false)]
  [string]$Email,
  [Parameter(Mandatory = $false)]
  [string]$Password,
  [Parameter(Mandatory = $false)]
  [string]$EnvVarName = "RECRUITER_JWT",
  [switch]$PersistToEnvFile
)

function Load-DotEnv($Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    $existing = $null
    try {
      $existing = (Get-Item -Path "Env:$k" -ErrorAction SilentlyContinue).Value
    } catch {
      $existing = $null
    }
    if (-not $existing) {
      Set-Item -Path "Env:$k" -Value $v.Trim().Trim('"')
    }
  }
}

Load-DotEnv (Join-Path (Get-Location) '.env')

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_ANON_KEY) {
  throw "SUPABASE_URL and SUPABASE_ANON_KEY must be set (in .env or environment)."
}

if (-not $Email) {
  $Email = Read-Host "Email"
}

$plainPassword = $Password
if (-not $plainPassword) {
  $secure = Read-Host -AsSecureString "Password"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$body = @{ email = $Email; password = $plainPassword } | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Method Post `
    -Uri "$($env:SUPABASE_URL)/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $env:SUPABASE_ANON_KEY; "Content-Type" = "application/json" } `
    -Body $body
} catch {
  throw "Failed to get token: $($_.Exception.Message)"
}

if (-not $resp.access_token) {
  throw "No access_token returned."
}

$token = $resp.access_token
Set-Item -Path "Env:$EnvVarName" -Value $token
Write-Host "Token stored in env: $EnvVarName"
Write-Output $token

if ($PersistToEnvFile) {
  $envPath = Join-Path (Get-Location) '.env'
  $lines = @()
  if (Test-Path $envPath) { $lines = Get-Content $envPath }
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^$EnvVarName=") {
      $lines[$i] = "$EnvVarName=$token"
      $found = $true
    }
  }
  if (-not $found) {
    $lines += "$EnvVarName=$token"
  }
  $lines | Set-Content -Encoding ascii $envPath
  Write-Host "Updated .env with $EnvVarName"
}
