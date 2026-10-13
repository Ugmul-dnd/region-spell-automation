# Changelog

## v0.6.1 — Unreleased

Development revision on the `v0.6.1dev` branch. Based on v0.6.0; future changes will be recorded in this section.

### Added

- Pending save buttons open a manual saving throw prompt for the clicking GM or token owner. Taking over closes the previous module save popup on connected clients, allowing a GM to handle an AFK player's pending save.

- Applied damage locks retroactive ADV/Normal/DIS and Normal/Critical controls on the damage card and linked attack/save rolls. Undo Damage unlocks adjustments; manual or automatic reapplication locks them again. Outstanding linked applications must all be reversed first.

- Savage Attacker adds an optional weapon damage popup toggle. Roll the weapon dice as two complete sets and keep the higher set with native roll details. A Savage Used effect prevents reuse until next turn start; canceling does not consume it. Includes a setting under Weapon Mastery & Attack Properties. After Undo Damage, Normal/Critical controls convert each weapon dice set, recalculate the winner, and preserve cached rolls, supporting standard and maximized criticals.

- Reckless Attack assistance adds a split Adv/Reckless control to owned attackers with the feature. Reckless applies the configured feature effect (or a marker for text-only imports), submits the native Strength attack, expires at the source's next turn start, and recommends advantage for subsequent Strength attacks and attacks against the Reckless creature. Automated Conditions integration preserves disadvantage cancellation. Includes an independent Attack Properties setting.

### Fixed

- Managed native Region effects add/remove through the active GM, including player-triggered aura exits and deletion. Players ending concentration on Region auras delegate cleanup to a GM after ownership validation, preventing permission errors on NPC effects.

- Recurring Region damage dialogs select a connected player who owns the caster before falling back to a GM, including Regions initially placed by a GM for a player character. Region activity execution retains its original authority so routing a popup does not change effect processing.

- Retroactive Normal/Critical damage controls also recognize damage activities with the native Allow Critical setting, including Divine Smite. Save spells, healing and Graze remain excluded.

- Preserve the first Reckless attack's selected advantage through post-dialog condition processing. Use Automated Conditions' actual source counts instead of its Normal-mode boolean flags, retaining cancellation when real disadvantage is present.

## v0.6.0

### Added

- Character Inventory/Spells Add Item buttons open the native compendium browser on Items/Spells. Spell browsing preselects matching class spell lists, including multiclass characters, with editable filters. The Chat & Sheets tab includes an independent option.

- Healing and temporary HP cards share Auto Apply Damage and Healing, with client dice-animation waits, native healing caps and temporary-HP replacement, unconscious-target support, and a GM Undo Healing action. Native healing prompts reuse recorded/self targets and remembered damage/healing dialog positions; healing areas resume their roll after confirmation.

- Module compatibility reference records the Fragment of the Fallen test world's enabled modules and installed versions, distinguishing confirmed integrations from modules merely present during testing.

- The first manual Apply Effect also records Undo Effect history, including effects applied after a retroactive save correction with no previous undo.

- Manually reapplying effects after Undo Effect records a fresh application and restores the Undo Effect button, supporting repeated undo/apply cycles.

- Region effects take priority over automatic card effects. Existing matching active effects are left unchanged, and card automation defers to applicable native region effects without adding Undo ownership. Region effects and conditions inherit trigger targeting relative to the caster; hostile-only regions exclude friendlies. Existing managed region filters refresh when a scene loads.

- GM-only Undo Effect beside Undo Damage for automatically applied activity effects. Removes newly created effects, restores previously refreshed effects, preserves applications superseded by another cast, and reopens manual effect controls. Effects-only activities retain Undo Effect on their source card.

- Magic Resistance feature detection for saves against spells and features marked Magical, with an independent setting and Automated Conditions integration that preserves advantage/disadvantage cancellation.

- Independent Auto Apply Damage, Auto Apply Saved Effects, and Autoapply Status on Hit options. Save effects wait for all outcomes and client dice animations, respect each effect's On Save setting, and follow automatic damage when enabled. Attack effects apply only to hit targets through native effect application, with duplicate protection and collapsed completed trays.

- Requested saving throws display a named `---pending---` button until the local dice animation finishes. Owners and the GM can click it to reopen a canceled save prompt without stopping automatic damage.

- Automatic damage waits for visible damage and saving throw dice animations on connected clients, including players, while allowing the GM window to remain in the background.

- **GM NPC & Damage:** optional native autorolls for prompted GM-run NPC saves (player-owned NPCs stay manual), and automatic damage application for all casters after every required save resolves. Non-save attacks apply only to hit targets. Manual card interaction or application stops automation; native calculations and Undo Damage remain available.

- GM-only Undo Damage actions record actual HP and temporary HP changes from damage cards, reverse those applications, and reopen the Apply tray without rerolling.

- Separate Graze, Sap, Slow, Topple, and Vex enable/disable options beneath the overall Weapon Mastery toggle.

- **Weapon Mastery automation:** unlocked weapon masteries add attack-card actions. Sap applies on hit; Vex waits for damage dealt and tracks the exact target. Both default the next eligible attack mode and are consumed on attack. Graze creates miss-only ability-modifier damage; Slow is a non-stacking post-damage toggle; Topple prompts a Constitution save and applies a source-tracked Prone effect on failure. Push, Nick and Cleave are excluded.

- Self-origin spell/feature emanations can automatically attach to the casting token, skipping manual placement. The Regions options tab includes an independent toggle.

- Dedicated Module Options window with Regions, Targeting, Rolls & Damage, Effects, Weapon Mastery & Attack Properties, GM NPC & Damage, and Chat tabs. Existing settings are preserved; drafts save on confirmation, with GM-only world edits and per-client options.

- Spell/feature placement controls: cone origins snap to square-grid intersections; scroll rotates 15 degrees, Shift-scroll rotates 5 degrees, and Ctrl-scroll zooms. Square rotation is allowed during casting previews.

- Damage Normal/Critical toggles also support powerful critical: rolled damage dice plus their maximized bonus, preserving modifiers without rerolling.

- Normal/Critical damage hover controls with an independent setting. Standard damage dice retain original results and bonuses; added critical dice roll once and are cached. Applied damage is not reversed.

- **Shield reaction cue:** optional manual casting icon on successful attack results for owned targets with a configured Shield reaction. Native casting handles resources; applying its buff refreshes that attack against current AC.

- Retarget supports weapon and attack cards and refreshes linked attack results using current target AC, allowing reassessment after reactions such as Shield without rerolling.

- **Effect Automation:** optional automatic application of configured buffs from non-rolling Utility spells and features to Self, Allies, or friendly targeted creatures. Native effect application preserves duration, concentration, and scaling; existing matching active effects are left unchanged. Attack and Save effects use their independent automation options, while healing rolls remain manual and region effects keep their region lifecycle.

- Spell and Region Management accepts monster abilities and player features,
  including auras, alongside spells.
- Independent settings to automatically open the caster's damage dialog for
  Save activities and the attacker's damage dialog after a confirmed hit.
- Attack damage prompts wait for Dice So Nice animations to finish. Native
  critical-hit, weapon-mode, consumption, and scaling options are preserved.
- Separate remembered positions for prompted attack, save, and damage dialogs
  on each user's client.
- Retroactive ADV / NORMAL / DISADV controls for attack rolls on spell, weapon,
  and feature cards, with an independent enable/disable setting.

### Changed

- Graze automatically creates its damage card on a confirmed miss and uses the existing Auto Apply Damage setting. Undo Damage restores HP, hides the Graze card, and resets the linked attack's Damage/Graze actions; canceled cards cannot be applied again.

- Slow automatically applies after damage is dealt, like Vex; its apply/remove button remains available for corrections.

- Topple immediately posts a native saving-throw request card, which populates with the defender result when the save is processed.

- Vex defaults only the next attack against the affected target to Advantage and is consumed by that matching attack. Attacks against other creatures preserve it; target matching also works through Automated Conditions.

- Attack actions and roll borders are green, damage red, and saves blue. Optional processed-attack cleanup hides used base-card buttons and removes the base face after the attack roll exists, with a native Damage button beside Retarget on the attack result, retaining all underlying messages and result controls.

- Damage cards linked to Shield-refreshed attacks are hidden when every target is now a miss. Rolls and application history are retained; cards stay visible if any target is still hit.

- Advantage adjustment buttons for attacks and saves use 75% of the standard
  button height.
- Configured turn-only feature auras defer initial save and damage prompts to
  their Region turn events.

### Fixed

- Manual damage/healing applications always restore their Undo action, including retargeted mass healing after an undo. Native Apply records the actual recipients, refreshes linked cards, resets stale button state, and retains a harmless Undo/reopen action when HP caps prevent any change.

- Undo Damage, Undo Healing, and Undo Effect preserve the chat bottom while cards rerender and their trays expand. Reading older messages is preserved, and manual scrolling cancels the following behavior.

- Attack/save Advantage and Disadvantage corrections retain the old total until newly added dice finish animating, including player clients and Dice So Nice's immediate-chat mode. Cached dice switches stay immediate.

- Vex/Sap integrate with Automated Conditions 5e through its public runtime-rule API, preserving condition-based advantage/disadvantage and cancellation.

- Automatic damage dialogs no longer receive invalid mouse-based positions.

### Direction for the next revision

- Keep one configurable module, organized into Region management, targeting,
  and roll-control components.
- Retain independent settings for optional features. Disabled features should
  stop their gameplay behavior as well as hide their controls.
- Consider separate modules only if a component needs independent publication,
  broader system support, or separate maintenance.
- A broader module name remains a future consideration; no rename is scheduled.

Version 0.6.0 is the previous release baseline.

## v0.5.7

See [v0.5.7 release notes](RELEASE-NOTES-0.5.7.md) for the documented release changes.

## 0.5.6

### Added

- Optional Shared Activity Card Per Turn: newly affected creatures join one activity card and its existing damage cards without another damage roll. The initial cast is included when it uses the trigger's configured activity.
- Accumulated movement damage for spells such as Spike Growth. Whole movement steps add independent damage dice, with a pending card per creature and a Roll Pending Damage button.
- GM-only +/− controls for pending movement damage. Casting players can roll their pending damage through a GM-coordinated reservation; GMs can also roll.
- Token HUD concentration control: end concentration from the caster's right-click controls using D&D5e's normal workflow.
- Optional starting configurations for Hunger of Hadar, Spirit Guardians, Grease, Spike Growth, Fog Cloud, and Conjure Animals, based on Ugmul's Foundry Player's Handbook setup. Existing configurations are preserved, and new recipes start disabled for review.
- Compendium sidebar shortcut to the Region Spell Manager.
- Spell selection, Select all/Deselect all, confirmed bulk deletion, and bulk Enable/Disable controls.
- Show Enabled/Show Disabled filters that combine with spell-name search.

### Changed and fixed

- Region behaviors are attached by the active GM, allowing player casts without granting GM permissions.
- Normal Region-triggered activities run on the connected caster's client when they own the actor, with active-GM fallback. Movement tracking runs only on the active GM to avoid duplicate cards.
- Shared-card registration is stored on chat messages for initial-cast reuse across clients.
- Movement entry and continuation are counted together, preventing duplicate first-step increments. The final outward step adds no damage; earlier internal steps remain counted.
- Disabled spells display (Disabled) after their names. Selection checkboxes are independent of automation state.
- Spell search, state filters, selection, and scroll position persist through manager updates.
- The spell drop area is now a popup opened by Add New Spell Region.
- Trigger explanations use Foundry hover tooltips, with a scrollable trigger editor and no duplicate browser tooltip.
- D&D5e 6.0.6 is marked verified. The minimum remains 6.0.5; Foundry v14 remains required.

### Updating

- Restart the Foundry server after updating, then reload GM and player clients. This release enables a module socket for player movement-damage rolls.
- Keep an active GM connected for Region setup and movement tracking.
- Recast areas when changing trigger events or movement mode; existing Regions retain attached behaviors.
- Configure optional shared-card/movement modes in the manager. Existing spell configurations are not automatically rewritten.
- Starter recipes include configuration only. Users must supply matching spell activities and effects on their own items; no Player's Handbook content is bundled.

Validated with automated regression checks and user testing on Foundry v14 with D&D5e 6.0.6. Other module combinations may alter native workflows.

## 0.5.5

- Initial public package release.
- Configurable Region activity triggers, targeting, Once Per Turn, native Region Active Effects, and concentration cleanup.
- End-turn activity triggers skip tokens at 0 HP, with the dead status, or marked defeated.
