#requires -Version 7.0
<#
.SYNOPSIS
Runs a full OAuth 2.0 Authorization Code + PKCE flow for X and stores token response locally.

.DESCRIPTION
Use this script when your existing X_REFRESH_TOKEN is invalid/revoked and runtime refresh can no longer recover.
The script opens a browser, captures the callback via local HttpListener, exchanges code for tokens,
and writes the full token payload to a local JSON file.

WARNING:
Log in with the BOT account that should own the tokens. Do NOT authorize with a management/admin account.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ClientId,

    [Parameter(Mandatory = $true)]
    [string]$ClientSecret,

    [string]$RedirectUri = "http://127.0.0.1:8080/callback",

    [string]$Scopes = "tweet.read tweet.write users.read offline.access",

    [string]$TokenUrl = "https://api.x.com/2/oauth2/token",

    [string]$AuthorizeUrl = "https://x.com/i/oauth2/authorize",

    [string]$OutputPath = ".x-oauth2-token-response.json",

    [int]$ListenerTimeoutSeconds = 240
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-RandomUrlSafeString {
    param([int]$ByteLength = 32)
    $bytes = New-Object byte[] $ByteLength
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $base = [Convert]::ToBase64String($bytes)
    return $base.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function ConvertTo-Sha256Base64Url {
    param([Parameter(Mandatory = $true)][string]$Input)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($Input))
        $base = [Convert]::ToBase64String($hash)
        return $base.TrimEnd('=').Replace('+', '-').Replace('/', '_')
    } finally {
        $sha.Dispose()
    }
}

function Get-HttpPrefixFromRedirectUri {
    param([Parameter(Mandatory = $true)][string]$Uri)
    $parsed = [System.Uri]$Uri
    if ($parsed.Scheme -ne 'http') {
        throw "RedirectUri muss http:// sein, damit HttpListener lokal genutzt werden kann. Erhalten: $Uri"
    }
    $portPart = if ($parsed.IsDefaultPort) { "" } else { ":$($parsed.Port)" }
    $path = if ([string]::IsNullOrWhiteSpace($parsed.AbsolutePath) -or $parsed.AbsolutePath -eq "/") { "/" } else { $parsed.AbsolutePath }
    if (-not $path.EndsWith('/')) { $path = "$path/" }
    return "{0}://{1}{2}{3}" -f $parsed.Scheme, $parsed.Host, $portPart, $path
}

Write-Warning "[XAuth] WICHTIG: Bitte im Browser mit dem BOT-Account einloggen (nicht mit Management-/Owner-Account)."
Write-Warning "[XAuth] offline.access muss im Scope enthalten sein, sonst wird kein refresh_token ausgegeben."

if ($Scopes -notmatch '(^|\s)offline\.access(\s|$)') {
    Write-Warning "[XAuth] Scope enthält offline.access nicht. Ohne offline.access erhalten Sie keinen refresh_token."
}

$codeVerifier = New-RandomUrlSafeString -ByteLength 64
$codeChallenge = ConvertTo-Sha256Base64Url -Input $codeVerifier
$state = New-RandomUrlSafeString -ByteLength 24

$params = [ordered]@{
    response_type = 'code'
    client_id = $ClientId
    redirect_uri = $RedirectUri
    scope = $Scopes
    state = $state
    code_challenge = $codeChallenge
    code_challenge_method = 'S256'
}

$query = ($params.GetEnumerator() | ForEach-Object {
    "{0}={1}" -f [System.Uri]::EscapeDataString([string]$_.Key), [System.Uri]::EscapeDataString([string]$_.Value)
}) -join '&'

$authUrl = "$AuthorizeUrl`?$query"
$prefix = Get-HttpPrefixFromRedirectUri -Uri $RedirectUri

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "[XAuth] Browser wird geöffnet für OAuth2 PKCE Autorisierung..."
    Write-Host "[XAuth] URL: $authUrl"
    Start-Process $authUrl | Out-Null

    $contextTask = $listener.GetContextAsync()
    $waited = $contextTask.Wait([TimeSpan]::FromSeconds($ListenerTimeoutSeconds))
    if (-not $waited) {
        throw "Kein Callback innerhalb von $ListenerTimeoutSeconds Sekunden erhalten."
    }

    $context = $contextTask.Result
    $request = $context.Request
    $response = $context.Response

    $incomingState = $request.QueryString['state']
    $code = $request.QueryString['code']
    $error = $request.QueryString['error']
    $errorDescription = $request.QueryString['error_description']

    if ($error) {
        throw "OAuth Autorisierung fehlgeschlagen: $error ($errorDescription)"
    }

    if ([string]::IsNullOrWhiteSpace($code)) {
        throw "Callback enthält keinen authorization code."
    }

    if ($incomingState -ne $state) {
        throw "State-Mismatch erkannt. Erwartet '$state', erhalten '$incomingState'."
    }

    $html = @"
<html><body><h2>OAuth erfolgreich</h2><p>Sie können dieses Fenster schließen und zur Konsole zurückkehren.</p></body></html>
"@
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
    $response.ContentType = 'text/html; charset=utf-8'
    $response.StatusCode = 200
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.Close()

    $basic = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("$ClientId`:$ClientSecret"))
    $tokenBody = @{
        grant_type = 'authorization_code'
        code = $code
        redirect_uri = $RedirectUri
        code_verifier = $codeVerifier
    }

    Write-Host "[XAuth] Tausche authorization code gegen access_token + refresh_token ..."
    $tokenResponse = Invoke-RestMethod -Method Post -Uri $TokenUrl -Headers @{ Authorization = "Basic $basic" } -ContentType 'application/x-www-form-urlencoded' -Body $tokenBody

    $tokenResponse | ConvertTo-Json -Depth 12 | Set-Content -Path $OutputPath -Encoding UTF8

    Write-Host "[XAuth] Tokenantwort lokal gespeichert: $OutputPath"
    Write-Host "[XAuth] access_token: $($tokenResponse.access_token)"
    Write-Host "[XAuth] refresh_token: $($tokenResponse.refresh_token)"
    Write-Host "[XAuth] expires_in: $($tokenResponse.expires_in)"
    Write-Host "[XAuth] scope: $($tokenResponse.scope)"
    Write-Host "[XAuth] Nächster Schritt: refresh_token sicher als X_REFRESH_TOKEN im Runtime-Secret-Store hinterlegen."
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
