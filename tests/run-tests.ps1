$ErrorActionPreference = 'Stop'
$rsaProject = Split-Path -Parent $PSScriptRoot
$rsaOldSharedSource = $env:RSA_SHARED_SOURCE
$rsaOldRuntimeSource = $env:RSA_RUNTIME_SOURCE
$rsaOldMovementSource = $env:RSA_MOVEMENT_SOURCE
$rsaOldHudSource = $env:RSA_HUD_SOURCE
$rsaOldStarterSource = $env:RSA_STARTER_SOURCE
$rsaOldManagerSource = $env:RSA_MANAGER_SOURCE
$rsaOldSavePromptSource = $env:RSA_SAVE_PROMPT_SOURCE
$rsaOldCastSaveSource = $env:RSA_CAST_SAVE_SOURCE
try {
    $env:RSA_SHARED_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/shared-activity-card.js')))
    $env:RSA_RUNTIME_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/region-spell-automation.js')))
    $env:RSA_MOVEMENT_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/movement-damage.js')))
    $env:RSA_STARTER_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/starter-spells.js')))
    $env:RSA_SAVE_PROMPT_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/save-prompts.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'shared-card.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Shared-card tests failed.' }
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'movement-damage.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Movement damage tests failed.' }
    $env:RSA_HUD_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/concentration-hud.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'concentration-hud.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Concentration HUD tests failed.' }
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'starter-spells.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Starter spell tests failed.' }
    $env:RSA_MANAGER_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/spell-manager.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'spell-selection.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Spell selection tests failed.' }
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'save-prompts.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Save prompt tests failed.' }
    $env:RSA_CAST_SAVE_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/spell-save-prompts.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'spell-save-prompts.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Spell-cast save prompt tests failed.' }
} finally {
    $env:RSA_SHARED_SOURCE = $rsaOldSharedSource
    $env:RSA_RUNTIME_SOURCE = $rsaOldRuntimeSource
    $env:RSA_MOVEMENT_SOURCE = $rsaOldMovementSource
    $env:RSA_HUD_SOURCE = $rsaOldHudSource
    $env:RSA_STARTER_SOURCE = $rsaOldStarterSource
    $env:RSA_MANAGER_SOURCE = $rsaOldManagerSource
    $env:RSA_SAVE_PROMPT_SOURCE = $rsaOldSavePromptSource
    $env:RSA_CAST_SAVE_SOURCE = $rsaOldCastSaveSource
}
