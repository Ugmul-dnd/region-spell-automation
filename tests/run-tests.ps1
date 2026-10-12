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
$rsaOldInstantSource = $env:RSA_INSTANT_CLEANUP_SOURCE
$rsaOldRetargetSource = $env:RSA_RETARGET_SOURCE
$rsaOldSaveControlsSource = $env:RSA_SAVE_CONTROLS_SOURCE
$rsaOldAreaConfirmSource = $env:RSA_AREA_CONFIRM_SOURCE
try {
    $env:RSA_SHARED_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/shared-activity-card.js')))
    $env:RSA_RUNTIME_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/region-spell-automation.js')))
    $env:RSA_MOVEMENT_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/movement-damage.js')))
    $env:RSA_STARTER_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/starter-spells.js')))
    $rsaSaveSource = [System.IO.File]::ReadAllText((Join-Path $rsaProject 'scripts/save-prompts.js'))
    $rsaSaveSource = $rsaSaveSource.Replace('"./shared-activity-card.js"', '"data:text/javascript;base64,' + $env:RSA_SHARED_SOURCE + '"')
    $env:RSA_SAVE_PROMPT_SOURCE = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($rsaSaveSource))
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
    $env:RSA_INSTANT_CLEANUP_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/instant-region-cleanup.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'instant-region-cleanup.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Instant Region cleanup tests failed.' }
    $env:RSA_RETARGET_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/retarget-card.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'retarget-card.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Retarget tests failed.' }
    $env:RSA_SAVE_CONTROLS_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/save-roll-controls.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'save-roll-controls.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Save mode tests failed.' }
    $env:RSA_AREA_CONFIRM_SOURCE = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/area-target-confirmation.js')))
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'area-target-confirmation.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Area confirmation tests failed.' }
    Get-Content -LiteralPath (Join-Path $PSScriptRoot 'target-eligibility.test.mjs') -Raw | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Target eligibility tests failed.' }
    $rsaOldDamageSource = $env:RSA_DAMAGE_SOURCE
    try {
        $env:RSA_DAMAGE_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/damage-prompts.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'damage-prompts.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Damage prompt tests failed.'}
    } finally {$env:RSA_DAMAGE_SOURCE = $rsaOldDamageSource}
    $rsaOldEffectAutomationSource = $env:RSA_EFFECT_AUTOMATION_SOURCE
    try {
        $env:RSA_EFFECT_AUTOMATION_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/effect-automation.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'effect-automation.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Effect automation tests failed.'}
    } finally {$env:RSA_EFFECT_AUTOMATION_SOURCE = $rsaOldEffectAutomationSource}
    $rsaOldShieldSource = $env:RSA_SHIELD_SOURCE
    try {
        $env:RSA_SHIELD_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/shield-reaction.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'shield-reaction.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Shield reaction tests failed.'}
    } finally {$env:RSA_SHIELD_SOURCE = $rsaOldShieldSource}
    $rsaOldCardPresentationSource = $env:RSA_CARD_PRESENTATION_SOURCE
    try {
        $env:RSA_CARD_PRESENTATION_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/card-presentation.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'card-presentation.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Card presentation tests failed.'}
    } finally {$env:RSA_CARD_PRESENTATION_SOURCE = $rsaOldCardPresentationSource}
    $rsaOldDamageModeSource = $env:RSA_DAMAGE_MODE_SOURCE
    try {
        $env:RSA_DAMAGE_MODE_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/damage-roll-controls.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'damage-roll-controls.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Damage mode tests failed.'}
    } finally {$env:RSA_DAMAGE_MODE_SOURCE = $rsaOldDamageModeSource}
    $rsaOldPlacementSource = $env:RSA_PLACEMENT_SOURCE
    try {
        $env:RSA_PLACEMENT_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/region-placement-controls.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'region-placement-controls.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Placement control tests failed.'}
    } finally {$env:RSA_PLACEMENT_SOURCE = $rsaOldPlacementSource}
    $rsaOldModuleSettingsSource = $env:RSA_MODULE_SETTINGS_SOURCE
    try {
        $env:RSA_MODULE_SETTINGS_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/module-settings.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'module-settings.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Module settings interface tests failed.'}
    } finally {$env:RSA_MODULE_SETTINGS_SOURCE = $rsaOldModuleSettingsSource}
    $rsaOldMasterySource = $env:RSA_MASTERY_SOURCE
    try {
        $env:RSA_MASTERY_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/weapon-masteries.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'weapon-masteries.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Weapon mastery tests failed.'}
    } finally {$env:RSA_MASTERY_SOURCE = $rsaOldMasterySource}
    $rsaOldDamageUndoSource = $env:RSA_DAMAGE_UNDO_SOURCE
    try {
        $env:RSA_DAMAGE_UNDO_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/damage-undo.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'damage-undo.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'Damage undo tests failed.'}
    } finally {$env:RSA_DAMAGE_UNDO_SOURCE = $rsaOldDamageUndoSource}
    $rsaOldNpcDamageSource = $env:RSA_NPC_DAMAGE_SOURCE
    try {
        $env:RSA_NPC_DAMAGE_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/npc-damage-automation.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'npc-damage-automation.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) {throw 'NPC and damage automation tests failed.'}
    } finally {$env:RSA_NPC_DAMAGE_SOURCE = $rsaOldNpcDamageSource}
    $rsaOldConditionsSource = $env:RSA_CONDITIONS_SOURCE
    $rsaOldConditionsManifest = $env:RSA_CONDITIONS_MANIFEST
    try {
        $env:RSA_CONDITIONS_MANIFEST = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'module.json')))
        $env:RSA_CONDITIONS_SOURCE = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $rsaProject 'scripts/region-conditions.js')))
        Get-Content -LiteralPath (Join-Path $PSScriptRoot 'region-conditions.test.mjs') -Raw | node --input-type=module
        if ($LASTEXITCODE -ne 0) { throw 'Region condition tests failed.' }
    } finally {
        $env:RSA_CONDITIONS_SOURCE = $rsaOldConditionsSource
        $env:RSA_CONDITIONS_MANIFEST = $rsaOldConditionsManifest
    }
} finally {
    $env:RSA_SHARED_SOURCE = $rsaOldSharedSource
    $env:RSA_RUNTIME_SOURCE = $rsaOldRuntimeSource
    $env:RSA_MOVEMENT_SOURCE = $rsaOldMovementSource
    $env:RSA_HUD_SOURCE = $rsaOldHudSource
    $env:RSA_STARTER_SOURCE = $rsaOldStarterSource
    $env:RSA_MANAGER_SOURCE = $rsaOldManagerSource
    $env:RSA_SAVE_PROMPT_SOURCE = $rsaOldSavePromptSource
    $env:RSA_CAST_SAVE_SOURCE = $rsaOldCastSaveSource
    $env:RSA_INSTANT_CLEANUP_SOURCE = $rsaOldInstantSource
    $env:RSA_RETARGET_SOURCE = $rsaOldRetargetSource
    $env:RSA_SAVE_CONTROLS_SOURCE = $rsaOldSaveControlsSource
    $env:RSA_AREA_CONFIRM_SOURCE = $rsaOldAreaConfirmSource
}
