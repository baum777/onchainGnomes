#requires -Version 7.0

param(
    [Parameter(Mandatory = $true)]
    [string]$ClientId,

    [Parameter(Mandatory = $true)]
    [string]$ClientSecret,

    [Parameter(Mandatory = $true)]
    [string]$RefreshToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-BasicAuthHeader {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Id,

        [Parameter(Mandatory = $true)]
        [string]$Secret
    )

    $pair = "{0}:{1}" -f $Id, $Secret
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
    $basic = [Convert]::ToBase64String($bytes)

    return @{
        Authorization = "Basic $basic"
    }
}

$headers = New-BasicAuthHeader -Id $ClientId -Secret $ClientSecret

$body = @{
    grant_type    = "refresh_token"
    refresh_token = $RefreshToken
    client_id     = $ClientId
}

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.x.com/2/oauth2/token" `
    -Headers $headers `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $body

$response | ConvertTo-Json -Depth 10