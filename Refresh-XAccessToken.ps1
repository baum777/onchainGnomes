#requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot/scripts/lib/XOAuthToken.ps1"

$config = Get-XRuntimeConfig
$result = Request-XTokenRefresh -Config $config
$result | ConvertTo-Json -Depth 10
