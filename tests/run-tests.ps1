$ErrorActionPreference = 'Stop'
$rsaProject = Split-Path -Parent $PSScriptRoot
$rsaOldSharedSource = $env:RSA_SHARED_SOURCE
$rsaOldRuntimeSource = $env:RSA_RUNTIME_SOURCE
$rsaOldMovementSource = $env:RSA_MOVEMENT_SOURCE
try {
    $env:RSA_SHARED_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/shared-activity-card.js')))
    $env:RSA_RUNTIME_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/region-spell-automation.js')))
    $env:RSA_MOVEMENT_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/movement-damage.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'shared-card.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Shared-card tests failed.' }
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'movement-damage.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Movement damage tests failed.' }
} finally {
    $env:RSA_SHARED_SOURCE = $rsaOldSharedSource
    $env:RSA_RUNTIME_SOURCE = $rsaOldRuntimeSource
    $env:RSA_MOVEMENT_SOURCE = $rsaOldMovementSource
}
