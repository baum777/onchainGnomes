#requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "[XAuthRuntime] Starte Runtime-Check..."

$isRender = ($env:RENDER -eq "true") -or (-not [string]::IsNullOrWhiteSpace($env:RENDER_SERVICE_ID))
if ($isRender) {
  Write-Host "[XAuthRuntime] Render runtime erkannt"
} else {
  Write-Host "[XAuthRuntime] Lokale runtime erkannt"
}

$required = @("X_CLIENT_ID", "X_CLIENT_SECRET", "X_REFRESH_TOKEN")
$missing = @()

foreach ($k in $required) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($k))) {
    $missing += $k
  }
}

if ($missing.Count -gt 0) {
  Write-Warning ("[XAuthRuntime] Fehlende Pflichtvariablen: " + ($missing -join ", "))
} else {
  Write-Host "[XAuthRuntime] Pflichtvariablen vorhanden"
}

$mask = {
  param([string]$v)
  if ([string]::IsNullOrWhiteSpace($v)) { return "<empty>" }
  if ($v.Length -le 8) { return $v.Substring(0, [Math]::Min(2, $v.Length)) + "***" }
  return $v.Substring(0,4) + "***" + $v.Substring($v.Length-4)
}

Write-Host ("[XAuthRuntime] X_CLIENT_ID=" + (& $mask $env:X_CLIENT_ID))
Write-Host ("[XAuthRuntime] X_REFRESH_TOKEN=" + (& $mask $env:X_REFRESH_TOKEN))
Write-Host "[XAuthRuntime] Hinweis: Validen Access Token bitte über ts runtime prüfen (scripts/check_auth.ts)."
