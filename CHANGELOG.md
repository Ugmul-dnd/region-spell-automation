# Changelog

## v0.7.5 — Pending Cards, Concentration & Targeting

- Initially empty shared spell Regions wait for their first recorded target before prompting damage. The original cast card routes that prompt to the connected caster owner, with GM fallback; later targets reuse the roll.
- The regular Damage action reuses an unresolved Pending damage card instead of leaving a separate placeholder behind. Stale dialogs are invalidated, and targets added while a damage dialog is open are retained when the roll is published.

- Recognize native Willing Creature targets in automatic Utility buff effects. Upcast Fly and similar buffs apply to each recorded willing recipient, rather than only passing the caster through the self check. Uses native scaled effect preparation and existing Undo tracking.

- Automatic buffs fall back to the usage token or recorded caster target when the chat speaker token is missing or belongs to another actor. Character casters without a scene token can still buff explicitly friendly recipients, including additional upcast Fly targets. Native effect application and hostile-target filtering remain in place.

- Refresh grouped saving-throw cards when Dice So Nice finishes, even when the save has no standalone chat element. This clears stale Pending rows for multi-target casts without rerolling or scanning the chat log.

- Require a selected target for direct attacks and targeted spells/features, including healing and marks. Validate single-target limits after native upcast scaling and before resource consumption; multi-target spells accept partial groups. Self and area/template activities retain their normal targeting flow.

- Concentration checks keep their pending status until Dice So Nice animations finish on active clients, then show the outcome and end concentration on failure. Background clients retain the animation bypass; GM takeover remains available during the wait.

- Add concentration challenge popups using native damage-triggered prompt cards and native concentration saves. Route to an active owning player, otherwise the GM; GM-run NPCs follow the existing automatic NPC-save setting. Pending checks support retry and GM takeover, including owner disconnects.
- Add separate Prompt Concentration Checks and End Concentration on Failed Checks settings under Rolls & Damage / Healing. Failures end only the concentration effects recorded for the check, preserving newer spells and using native Region cleanup.

- **Dice So Nice integration — background GM and player windows:** switching tabs, minimizing, or losing window focus during an animation no longer leaves this module’s evaluated roll workflow waiting for that client to reactivate. Animation waits release even when focus changes mid-animation; active clients continue waiting normally. This fix ships with Ugmuls 5.5e Automation and runs on connected clients after updating and refreshing. It does not modify Dice So Nice itself or change the dice results.

- Keep initial attack usage cards visible until the linked result is displayed, including Dice So Nice animation delays. Show a waiting status and prevent duplicate attack clicks during the handoff. Refresh only linked cards through the shared queue, and restore the source if its result is removed.

- Publish a native Pending usage card before a player configures a spell/feature cast, then reuse it through targeting, Metamagic, template placement and the first roll. Preserve whisper/blind roll modes and native source grouping.
- Canceling a pre-roll usage, target, template or roll dialog removes its pending usage card and refunds native consumption and cast-time Metamagic. Cast-owned bonus/spell/reaction markers are cleared without changing unrelated uses.
- Preserve previous concentration until the new cast commits; remove newly created cast effects and templates on cancellation. Actual roll results commit the cast and prevent later refunds.

## v0.7.4 — Performance & Parry

- Coalesce reaction and feature card refreshes through a shared queue. Actor changes skip features they do not have, own-roll and defender actions target related cards, and overlapping requests refresh each card once per batch. Rendering yields between batches of eight cards.
- Index damage/healing cards by source usage for repeated roll-lock checks. Message creation, updates, and deletion invalidate the index; HP/Undo flags remain live.
- Keep combat resource writes, effect expiry, and roll evaluation outside the deferred presentation queue.

- Add Battle Master Parry on incoming single-target melee damage cards. Spend a Reaction and current Superiority Die, reduce existing damage by the die plus the higher Strength/Dexterity modifier, and preserve original dice. Includes resource rollback and player-to-GM handling.

## v0.7.3 — Character Creation, Bards & Barbarians

This release adds guided player-character creation and expands Bard and Barbarian automation through the existing attack, save, damage, and effect card workflows.

### Guided character creation

- Create Player in the Actors directory walks through name and ownership, default PC token setup, Standard Array or 27-point buy, class, background, species, equipment or starting gold, class spells, preparation, and review.
- Native advancement and spell pickers respect enabled Compendium Sources. Token artwork remains manual.
- Ability scores start unassigned. Standard Array choices share a remaining-value pool; point buy shows remaining points and affordable choices. Reset clears the selections.
- Continue Character Creator Wizard on an owned PC checks the current sheet and saved progress so setup can resume without duplicating starting equipment.
- Standard and Tidy spell Add buttons offer eligible full-list preparation classes a missing-spell loader. It adds only currently castable leveled spells from enabled sources, unprepared, preserving existing and always-prepared spells. Paladins use the compendium browser.

### Bard automation

- Bardic Inspiration automatically applies the native Inspired effect and tracks its source Bard and granted die. Failed attacks, saves, and checks can add that die while preserving the original d20. The die is consumed when rolled.
- Cutting Words offers eligible enemy attack and damage adjustments within 60 feet, using the Bard's Reaction and Inspiration resource while preserving existing dice.
- Peerless Skill adjusts the Bard's own failed attacks and ability checks, spending Inspiration only when the adjusted test succeeds.
- Valor Combat Inspiration adds its damage die in the initial damage configuration, including critical damage. Defense uses the recipient's Reaction to add AC against an incoming attack and combines with Shield.
- Unknown-DC adjustments request the information needed to determine the result.

### Barbarian automation

- Zealot Divine Fury adds its scaled Radiant or Necrotic damage to the first eligible hit on the raging Barbarian's turn.
- Fanatical Focus offers a single replacement d20 plus Rage Damage bonus on a failed save, once per Rage. Previous advantage/disadvantage is not reused, and recorded targeting is restored afterward.
- Zealous Presence grants advantage on attacks and saves until the source Barbarian's next turn, combining normally with disadvantage and AC5E.
- Brutal Strike sits above Normal in the attack prompt; Reckless sits above Advantage. Brutal can activate Reckless on the first attack, or reuse it later, and requires a Strength attack without disadvantage on the Barbarian's turn.
- Brutal damage rolls with the weapon damage and supports native scaling and criticals. Damage configuration selects Forceful or Hamstring Blow; Improved Brutal Strike adds Staggering and Sundering, and Improved Brutal Strike (2) permits two different effects.
- Selected native Hamstrung, Staggered, and Sundered effects apply to hit targets with source-turn expiry, manual Apply, and Undo support. Movement remains manual.
- Sundered adds one +5 bonus to the next single-target attack by another creature, then consumes qualifying effects after the roll, hit or miss. Canceling the prompt preserves the effect.
- Staggered supplies disadvantage on the next save through AC5E or the standalone flow. It cancels Magic Resistance advantage to Normal. The effect remains until expiry for its Opportunity Attack restriction after the save benefit is spent.

### Workflow improvements

- Shield spends an available limited/free use first, then the lowest available eligible spell slot, including upcasting and Pact slots.
- Automatic damage and healing application have separate settings.
- Damage cards hide when a later attack adjustment makes every target a miss, and return if the attack becomes a hit again.
- Save-card borders include the initial card; Bardic prompts use constrained icons and chat scrolls after Inspiration application.
- Published attack cards provide a second hit-to-damage prompt check; manual damage retains its originating attack for rider eligibility.

### Fixes and validation

- Restore Sundering Blow's +5 after the native attack dialog rebuilds its formula. Sundered is consumed only when the completed attack includes the bonus.
- Preserve Staggered's ongoing effect after spending its next-save disadvantage, and reset that allowance when the effect is reapplied.
- All 54 local regression test files pass.
- Hard-refresh GM and player clients after updating.

## v0.7.2 — Battle Master Update

## Battle Master

- Precision Attack adds the current Superiority Die to an existing missed attack, preserving the original d20. Undo applied damage before adjusting the attack.
- Trip Attack adds damage and prompts a Strength save for Large or smaller targets. Failure uses the native Prone condition, recognized by standard condition controls and Automated Conditions 5e.
- Distracting Strike adds damage and grants advantage to the next attacker other than the Fighter, then clears its effect.
- Menacing Attack adds damage and prompts a Wisdom save. Failure applies native Frightened linked to the Fighter until the end of their next turn.
- Goading Attack adds damage and prompts a Wisdom save. Failure causes disadvantage against creatures other than the Fighter until the end of the Fighter’s next turn. Advantage and disadvantage cancel normally.
- Maneuvering Attack adds damage and a reminder tag. Ally selection, reaction use, and movement remain manual.
- Pushing Attack adds damage and prompts a Strength save for Large or smaller targets. A reminder tag leaves movement to the GM.
- Maneuvers use the configured current Superiority Die, including d10/d12 progression, support critical damage, and share a one-maneuver-per-attack limit.
- Relentless adds a Superiority Die dropdown beneath Maneuver. Spend the current die by default, or choose a free d8 once per active combat turn. An empty normal pool defaults to the free d8 when available. Precision Attack shares the same free-use limit; canceling does not consume it.
- Fighter automation settings allow individual maneuvers and Relentless to be enabled or disabled. Applicable effects retain Apply/Undo controls.

## Great Weapon feats

- Great Weapon Fighting treats damage dice of 1 or 2 as 3 on qualifying two-handed melee weapon attacks, including attached riders and Savage Attacker pools.
- Great Weapon Master offers proficiency-bonus damage on Heavy-weapon hits made with the Attack action on your turn. Bonus-action and reaction attacks are excluded; Hew remains manual.
- Both settings are under Automations → Feats.

## Fixes and presentation

- Weapon and rider damage dice animate together in one Dice So Nice throw when resolving pending damage.
- Damage cards show Goading, Maneuvering, Pushing, and Relentless tags with reminder tooltips.
- Goading effects participate in native turn-end expiry tracking; existing effects are repaired when the active GM reloads.
- Great Weapon Fighting previews handle native die methods and nested dice pools correctly, and retain their minimum through critical-hit adjustments.
- The Relentless die selector can be changed before selecting a maneuver.

Hard-refresh GM and player clients after updating.

## v0.7.1

### Added

- **Stunning Strike:** a default-No damage Configuration option for confirmed Monk weapon and Unarmed Strike hits. Spends 1 Focus Point once per combat turn and creates a native Constitution save card. Failure applies Stunned; success halves Speed and grants advantage on the next attack. Effects expire at the Monk's next turn start and support Undo Effect.
- **Grapple / Prone:** qualifying action-based Unarmed, Empowered and Elemental Strike hits offer No, Grapple, or Prone for any creature. Attempts replace damage and create independent save cards, without modifying existing item activities. Saves use the target's higher Strength/Dexterity save modifier, choosing Strength on ties; Martial Arts can use Dexterity for the DC.
- **Grappler:** a separate feat automation preserves damage plus Grapple once on the attacker's turn and recommends advantage against creatures grappled by that attacker. Later attempts replace damage. Grappled is a Temporary effect for token HUD visibility, without a timed expiry.
- **Combined Stunning Strike and Grapple:** Stunning Strike resolves first, including animation and automatic effects. Stunned targets automatically fail the subsequent Grapple/Prone save; other targets receive their normal prompt.
- **Divine Smite:** melee weapon hit damage offers the configured free cast or an available spell slot, consumes the appropriate resource and bonus action, and automatically adds the Fiend/Undead bonus. A golden glow and info tooltip identify the bonus. Critical damage follows the weapon roll.
- **Eldritch Smite:** a default-No pact-weapon damage rider consumes a Pact Magic slot, scales Force damage with its level, and is limited to once per combat turn without spending a bonus action.
- **Hunter's Prey / Colossus Slayer:** a remembered Yes/No rider, initially No, adds the feature damage against an injured single target once per combat turn. Damage matches the weapon and supports criticals.
- **Frenzy:** the first qualifying Strength-based weapon hit on the Barbarian's turn while Rage and Reckless Attack are active automatically adds the feature damage. Matches the weapon damage type, supports criticals, and locks after use that turn.
- **Innate Sorcery:** active Innate Sorcery recommends advantage on Sorcerer spell attacks, with Automated Conditions integration and normal disadvantage cancellation.
- **Empowered Spell:** a feature-icon action on spell damage cards lets users select active damage dice up to their Charisma modifier (minimum one), spend 1 Sorcery Point, and replace the selected results. Supports critical dice and animation timing. Opening the picker stops automatic application; applied damage must be undone before adjustment.
- **Seeking Spell:** a missed-spell-attack action spends 1 Sorcery Point to reroll one d20 and use the new result, refreshing hit/critical outcomes and prompting damage when appropriate.
- **Cast-time Metamagic:** Transmuted, Heightened and Careful Spell choices support single-target and area casts. Resource costs and combination limits respect Sorcery Incarnate with active Innate Sorcery and Arcane Apotheosis. Empowered and Seeking remain available on result cards.
- **Metamagic card tags:** spell damage cards show the applied options beside Spell/Magical, with element or target details in tooltips. Result-time reroll tags stay with the relevant attack or damage card.
- **Pending damage and healing:** prompts create a clickable ---pending--- card before rolling. A GM or owner can reopen the prompt for themselves; older prompts are invalidated. Results fill the same card after animations, retaining Apply and Undo controls.
- **Combat resource trackers:** Bonus Action and Reaction tracking cover all active combat participants and reset at their next turn start. Consumed Spell Slot tracks character actors only and resets at the current turn's end. Cantrips, free casts and non-spell slot expenditures do not count toward that spell-casting limit. Trackers do not run out of combat.

### Changed

- **Automation settings:** Module Options opens to Automations, with Unique Classes, Weapon Masteries, Feats, Common and Spells submenus. Unique Classes has an All/class filter covering all twelve core classes. Navigation stays above the scrolling settings, and the window has a bottom-right resize handle.
- Disabling the main Weapon Mastery Effect Automation switch greys out its child options while preserving their selections. Grappler Feat Automation is separate from the Common Unarmed Grapple / Prone Prompts setting.
- Damage Configuration uses Yes/No selectors and live dice previews. Savage Attacker defaults to Yes, Sneak Attack matches the weapon damage type, and once-per-turn lockouts display No - Already Used in the selector.
- Conjure Minor Elementals uses its remembered elemental selector in the damage row, with extra spacing below Situational Bonus and no duplicate Configuration selector.
- Ordinary area casts proceed after collecting targets unless Choose Targets is enabled or applicable cast-time Metamagic requires confirmation. Metamagic-only confirmation keeps the target list fixed; Careful selects protection without removing targets. Retarget remains available for corrections.
- Reckless Attack can be activated only on the first attack roll of the attacker's own turn. Its advantage persists until the start of the attacker's next turn, including qualifying reaction attacks.
- Divine Smite uses the shared bonus-action and spell-slot trackers instead of a separate per-turn marker. Spent markers are reused and become inactive when reset; Eldritch Smite retains its own once-per-turn limit.

### Fixed

- Pending-damage retries made by players now publish their results through the GM correctly. Original rolls and retries suppress duplicate Dice So Nice animation when the card is populated.
- Chat follows pending-damage card expansion to the bottom, while respecting users who have scrolled up.
- Linked rider save updates resume the original damage card, so automatic Stunned failures continue through damage and Grapple effect application without a manual click or duplicate application.
- Stunning Strike hides Apply Effects after application. Undo Effect restores it and unlocks save advantage/normal/disadvantage independently of weapon damage; reapplication locks the save again.
- Renewing Savage Attacker and other spent markers clears stored expiry state, restoring once-per-turn limits after reset.
- Combat-end tracker cleanup avoids conflicts with native effect expiry/deletion.
- Seeking Spell ignores animation and rendering-only metadata changes during rerolls, while genuine attack edits still cancel and refund the point.

## v0.7.0

Renamed to **Ugmuls 5.5e Automation**, with repository, module ID, installation folder and release ZIP named `ugmuls-5-5e-automation`. This is a clean installation identity; settings and stored world references from the previous ID are not migrated. Starter spells can be added through the manager.

## v0.6.1

Release prepared from the three development commits on `v0.6.1dev` since v0.6.0.

### Added

- Eldritch Blast and Scorching Ray open a remaining-attacks window after casting, with character-level or slot-level counts. The Attack button reuses the scaled cast and current single target without another spell-slot spend, retaining normal attack/damage controls. Canceled rolls do not consume a shot. Additional spell damage uses each attack's target. Toggle under Bonus Damage Riders.

- Conjure Minor Elementals adds a checked attack-damage rider when the target is inside that caster's active concentrated spell Region. Uses the spell's Bonus Attack Damage activity and Region cast level, with Acid/Cold/Fire/Lightning choice, critical support and existing Apply/Undo Damage. No custom marker effect required. Single-target cards only; setting under Bonus Damage Riders.

- Sneak Attack adds a damage popup checkbox for owned attackers with the feature: checked by default for Advantage, manually selectable otherwise. Uses the feature's configured damage activity for scaling and the weapon damage type, supports criticals and Apply/Undo Damage. Once per combat turn, resetting on turn transition for later reaction attacks. Canceling does not consume it. Setting under Bonus Damage Riders.

- Off-turn Reaction Tracker marks manual spell, weapon and feature uses with Reaction - used, blocking further off-turn uses until disabled/deleted or expired at next turn start. Saves, linked damage rolls and automated Region triggers remain available. Toggle under Effects.

- Hex and 2024 Hunter's Mark damage riders track each caster's concentration and marked token. Attack damage popups offer checked Hex/Hunter's Mark options, adding labeled 1d6 Necrotic/Force components to the same damage card, with standard/maximized criticals and existing damage undo/application. Changing targets on the mark's usage card updates the association. Single-target cards only; separate enable settings in Bonus Damage Riders.

- Pending save buttons open a manual saving throw prompt for the clicking GM or token owner. Taking over closes the previous module save popup on connected clients, allowing a GM to handle an AFK player's pending save.

- Applied damage locks retroactive ADV/Normal/DIS and Normal/Critical controls on the damage card and linked attack/save rolls. Undo Damage unlocks adjustments; manual or automatic reapplication locks them again. Outstanding linked applications must all be reversed first.

- Savage Attacker adds an optional weapon damage popup toggle. Roll the weapon dice as two complete sets and keep the higher set with native roll details. A Savage Used effect prevents reuse until next turn start; canceling does not consume it. Includes a setting under Weapon Mastery & Attack Properties. After Undo Damage, Normal/Critical controls convert each weapon dice set, recalculate the winner, and preserve cached rolls, supporting standard and maximized criticals.

- Reckless Attack assistance adds a split Adv/Reckless control to owned attackers with the feature. Reckless applies the configured feature effect (or a marker for text-only imports), submits the native Strength attack, expires at the source's next turn start, and recommends advantage for subsequent Strength attacks and attacks against the Reckless creature. Automated Conditions integration preserves disadvantage cancellation. Includes an independent Attack Properties setting.

### Fixed

- Manual damage/attack interaction stops only that attack's damage automation, allowing later Scorching Ray/Eldritch Blast shots to continue independently. Explicit cast-level manual handoffs remain respected. The remaining-attacks window closes at zero.

- Bonus riders resolve missing damage-popup targets through the linked cast card. Conjure Minor Elementals checks native Region containment rather than relying on a client's reverse token membership cache.

- Hunter's Mark's configured Utility effect can auto-apply to its single hostile marked target through existing GM effect automation. Hex retains manual effect selection.

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
