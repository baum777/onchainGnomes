#requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot/XOAuthToken.ps1"

function Get-XAuthHeaders {
    $token = Get-ValidXAccessToken
    return @{ Authorization = "Bearer $token" }
}

function Invoke-XApiRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [object]$Body,
        [string]$ContentType = "application/json",
        [switch]$ForceJson
    )

    function Invoke-Once([switch]$ForceRefresh) {
        if ($ForceRefresh.IsPresent) {
            [void](Get-ValidXAccessToken -ForceRefresh)
        }

        $headers = Get-XAuthHeaders
        if ($Body) {
            $payload = if ($ForceJson.IsPresent -or $ContentType -match "application/json") { $Body | ConvertTo-Json -Depth 20 } else { $Body }
            return Invoke-WebRequest -Method $Method -Uri $Uri -Headers $headers -ContentType $ContentType -Body $payload -SkipHttpErrorCheck
        }

        return Invoke-WebRequest -Method $Method -Uri $Uri -Headers $headers -SkipHttpErrorCheck
    }

    $response = Invoke-Once
    if ($response.StatusCode -eq 401) {
        Write-Warning "401 erhalten, forced refresh + einmaliger Retry"
        $response = Invoke-Once -ForceRefresh
    }

    if ($response.StatusCode -ge 400) {
        throw "X API request failed ($($response.StatusCode)): $($response.Content)"
    }

    if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
    try { return $response.Content | ConvertFrom-Json } catch { return $response.Content }
}
