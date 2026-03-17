#requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:XTokenCache = @{}

function Get-LocalOauth2FileValues {
    param([string]$Path = ".env.oauth2")

    if (-not (Test-Path $Path)) { return @{} }

    $map = @{}
    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
        $parts = $line.Split("=", 2)
        $k = $parts[0].Trim()
        $v = $parts[1].Trim().Trim("'\"")
        if ($k) { $map[$k] = $v }
    }
    return $map
}

function Resolve-XValue {
    param(
        [string]$Key,
        [hashtable]$FileFallback
    )
    $ev = [Environment]::GetEnvironmentVariable($Key)
    if (-not [string]::IsNullOrWhiteSpace($ev)) { return $ev.Trim() }
    if ($FileFallback.ContainsKey($Key)) { return [string]$FileFallback[$Key] }
    return $null
}

function Mask-Secret {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return "<empty>" }
    if ($Value.Length -le 8) { return $Value.Substring(0, [Math]::Min(2, $Value.Length)) + "***" }
    return $Value.Substring(0, 4) + "***" + $Value.Substring($Value.Length - 4)
}

function Get-XRuntimeConfig {
    $isRender = ($env:RENDER -eq "true") -or (-not [string]::IsNullOrWhiteSpace($env:RENDER_SERVICE_ID))
    if ($isRender) {
        Write-Host "Render runtime erkannt; lade X-Konfiguration aus Environment"
    } else {
        Write-Host "Lokale Runtime erkannt; `.env.oauth2` wird als Fallback verwendet"
    }

    $fallback = if ($isRender) { @{} } else { Get-LocalOauth2FileValues }

    $cfg = [ordered]@{
        Runtime = if ($isRender) { "render" } else { "local" }
        X_CLIENT_ID = Resolve-XValue -Key "X_CLIENT_ID" -FileFallback $fallback
        X_CLIENT_SECRET = Resolve-XValue -Key "X_CLIENT_SECRET" -FileFallback $fallback
        X_REFRESH_TOKEN = Resolve-XValue -Key "X_REFRESH_TOKEN" -FileFallback $fallback
        X_ACCESS_TOKEN = Resolve-XValue -Key "X_ACCESS_TOKEN" -FileFallback $fallback
        X_EXPIRES_IN = if (Resolve-XValue -Key "X_EXPIRES_IN" -FileFallback $fallback) { [int](Resolve-XValue -Key "X_EXPIRES_IN" -FileFallback $fallback) } else { $null }
        X_TOKEN_CREATED_AT = Resolve-XValue -Key "X_TOKEN_CREATED_AT" -FileFallback $fallback
        X_REFRESH_BUFFER_SECONDS = if (Resolve-XValue -Key "X_REFRESH_BUFFER_SECONDS" -FileFallback $fallback) { [int](Resolve-XValue -Key "X_REFRESH_BUFFER_SECONDS" -FileFallback $fallback) } else { 300 }
        X_OAUTH_TOKEN_URL = if (Resolve-XValue -Key "X_OAUTH_TOKEN_URL" -FileFallback $fallback) { Resolve-XValue -Key "X_OAUTH_TOKEN_URL" -FileFallback $fallback } else { "https://api.x.com/2/oauth2/token" }
        X_BOT_USER_ID = Resolve-XValue -Key "X_BOT_USER_ID" -FileFallback $fallback
        X_BOT_USERNAME = if (Resolve-XValue -Key "X_BOT_USERNAME" -FileFallback $fallback) { Resolve-XValue -Key "X_BOT_USERNAME" -FileFallback $fallback } else { Resolve-XValue -Key "BOT_USERNAME" -FileFallback $fallback }
        RENDER_SERVICE_TYPE = $env:RENDER_SERVICE_TYPE
    }

    foreach ($key in @("X_CLIENT_ID", "X_CLIENT_SECRET", "X_REFRESH_TOKEN")) {
        if ([string]::IsNullOrWhiteSpace($cfg[$key])) {
            throw "Fehlende Pflichtvariable: $key"
        }
    }

    return [pscustomobject]$cfg
}

function Test-TokenNeedsRefresh {
    param(
        [string]$AccessToken,
        [Nullable[int]]$CreatedAt,
        [Nullable[int]]$ExpiresIn,
        [int]$BufferSeconds = 300
    )

    if ([string]::IsNullOrWhiteSpace($AccessToken)) { return $true }
    if (-not $CreatedAt -or -not $ExpiresIn) { return $true }

    $now = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $expiresAt = $CreatedAt.Value + $ExpiresIn.Value
    return (($expiresAt - $now) -le $BufferSeconds)
}

function Request-XTokenRefresh {
    <#
    .SYNOPSIS
    Refresh-only OAuth2 helper.

    .DESCRIPTION
    Uses grant_type=refresh_token with an already valid refresh token.
    This function does not run full browser PKCE authorization and cannot mint a new refresh token if
    the current refresh token is invalid/revoked. For that recovery case use scripts/Generate-XOAuthTokens.ps1.
    #>
    param([pscustomobject]$Config)

    $pair = "{0}:{1}" -f $Config.X_CLIENT_ID, $Config.X_CLIENT_SECRET
    $basic = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($pair))

    $body = @{
        grant_type    = "refresh_token"
        refresh_token = if ($script:XTokenCache.refresh_token) { $script:XTokenCache.refresh_token } else { $Config.X_REFRESH_TOKEN }
        client_id     = $Config.X_CLIENT_ID
    }

    try {
        $resp = Invoke-RestMethod -Method Post -Uri $Config.X_OAUTH_TOKEN_URL -Headers @{ Authorization = "Basic $basic" } -ContentType "application/x-www-form-urlencoded" -Body $body
    } catch {
        $message = $_.Exception.Message
        if ($message -match "400" -or $message -match "invalid") {
            throw "[XAuth] Refresh-Only Flow fehlgeschlagen: gespeicherter X_REFRESH_TOKEN scheint ungültig. Führe scripts/Generate-XOAuthTokens.ps1 für vollständige PKCE Re-Authorisierung aus."
        }
        throw
    }

    $rotated = -not [string]::IsNullOrWhiteSpace($resp.refresh_token) -and ($resp.refresh_token -ne $Config.X_REFRESH_TOKEN)
    if ($rotated) {
        Write-Warning ("Provider hat einen neuen refresh_token zurückgegeben; persistente Rotation ist nicht automatisch aktiviert: " + (Mask-Secret $resp.refresh_token))
    }

    return [pscustomobject]@{
        access_token          = $resp.access_token
        token_type            = if ($resp.token_type) { $resp.token_type } else { "bearer" }
        expires_in            = if ($resp.expires_in) { [int]$resp.expires_in } else { 7200 }
        created_at            = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        refresh_token         = $resp.refresh_token
        refresh_token_rotated = $rotated
        nextRefreshToken      = $resp.refresh_token
    }
}

function Get-ValidXAccessToken {
    param([switch]$ForceRefresh)

    $cfg = Get-XRuntimeConfig

    if (-not $script:XTokenCache.access_token -and $cfg.X_ACCESS_TOKEN) {
        $script:XTokenCache.access_token = $cfg.X_ACCESS_TOKEN
        $script:XTokenCache.expires_in = $cfg.X_EXPIRES_IN
        if ($cfg.X_TOKEN_CREATED_AT) {
            try {
                $script:XTokenCache.created_at = [int][DateTimeOffset]::Parse($cfg.X_TOKEN_CREATED_AT).ToUnixTimeSeconds()
            } catch {
                $script:XTokenCache.created_at = $null
            }
        }
        $script:XTokenCache.refresh_token = $cfg.X_REFRESH_TOKEN
    }

    $needs = $ForceRefresh.IsPresent -or (Test-TokenNeedsRefresh -AccessToken $script:XTokenCache.access_token -CreatedAt $script:XTokenCache.created_at -ExpiresIn $script:XTokenCache.expires_in -BufferSeconds $cfg.X_REFRESH_BUFFER_SECONDS)

    if (-not $needs) {
        Write-Host "Access Token gültig, kein Refresh nötig"
        return $script:XTokenCache.access_token
    }

    Write-Host "Access Token wird erneuert"
    $ref = Request-XTokenRefresh -Config $cfg
    $script:XTokenCache.access_token = $ref.access_token
    $script:XTokenCache.expires_in = $ref.expires_in
    $script:XTokenCache.created_at = $ref.created_at
    $script:XTokenCache.refresh_token = if ($ref.refresh_token) { $ref.refresh_token } else { $script:XTokenCache.refresh_token }

    return $script:XTokenCache.access_token
}
