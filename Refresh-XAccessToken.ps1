#requires -Version 7.0
<#
.SYNOPSIS
Refreshes an X OAuth2 access token with an already valid refresh token.

.DESCRIPTION
This script only executes the OAuth2 refresh_token grant against the X token endpoint.
It requires X_REFRESH_TOKEN to be valid already.

IMPORTANT:
- This script does NOT run a full OAuth2 PKCE browser flow.
- This script does NOT mint a brand new refresh token when the current refresh token is invalid/revoked.
- If refresh fails with invalid_grant / invalid_request / invalid token, run scripts/Generate-XOAuthTokens.ps1.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot/scripts/lib/XOAuthToken.ps1"

Write-Host "[XAuth] Refresh-Only Flow: versuche Access Token mit bestehendem X_REFRESH_TOKEN zu erneuern"
Write-Host "[XAuth] Hinweis: Für neue Refresh Tokens ist scripts/Generate-XOAuthTokens.ps1 erforderlich"

$config = Get-XRuntimeConfig
$result = Request-XTokenRefresh -Config $config
$result | ConvertTo-Json -Depth 10
