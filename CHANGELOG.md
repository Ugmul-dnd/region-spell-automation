# Changelog

## Unreleased

- Combat Inspiration Offense now appears as a default-No damage configuration option. Its die previews and rolls with initial attack damage; confirming spends Inspired, canceling preserves it. The post-roll offense button has been removed; Defense remains on incoming attack cards.

- Valor Combat Inspiration: source-tracked Inspired dice offer Offense on single-target attack damage cards and Defense on incoming hits. Offense adds native critical-aware damage; Defense spends the recipient’s reaction for AC against that attack only and combines with Shield. Both consume the granted Inspired effect, not another source Bard use.

- Peerless Skill: add the Bard’s current Inspiration die to their own failed attack or ability check, preserving original rolls. Spend a use only when the adjusted test succeeds. Unknown-DC checks request the GM-provided DC before rolling.

- Cutting Words: eligible Bards can spend their Reaction and a Bardic Inspiration use from enemy attack-hit or damage cards within 60 feet. Original dice are preserved, damage is floored at zero, and each damage component is selectable. Sight walls block eligibility; users confirm visibility. Undo applied damage before adjusting it.

- Shield reaction button now spends an available limited/free cast before selecting the lowest available spell slot, including higher-level and Pact slot fallback. Native consumption preserves reaction and spell-slot turn tracking.

- Bardic Inspiration: add the source Bard’s die to failed attack, save, or check cards while preserving the existing d20. Consume the Inspired effect, retain the granted die size, and refresh results through the existing workflow. Unknown-DC rolls require confirmation of failure.

### Added

- Spell New/Add buttons on standard and Tidy character sheets offer Browse Compendium or Load Unprepared Spells for full-list preparation classes. Loading respects enabled Compendium Sources, existing spell identifiers, configured slot capacity, and each class’s progression. Only missing leveled spells are added, initially unprepared; existing preparation and always-prepared spells are preserved. The option is configurable under Chat & Sheets.

- Owned PCs in the Actors directory now have a Continue Character Creator Wizard right-click action. It checks current character data against saved progress, reopens at the first incomplete step, and supports Back navigation for review. Existing equipment without a wizard receipt must be reviewed before any new starting items or gold are added.

- Guided PC creation now includes class cantrips, class spells / Wizard spellbook, and preparation. Native class scales and preparation limits guide counts; native pickers respect Compendium Sources and class lists. Full-list preparation classes can load currently castable spell levels unprepared, then choose their prepared spells. Always-prepared and background/species/feat spells keep their existing configuration.

- Create Player in the Actors sidebar opens a resumable level-one PC setup wizard: character/player ownership, default PC token with matching name, Standard Array or 27-point buy, native source-filtered class/background/species selection and advancement, starting equipment packages or fixed gold alternatives, and review. Equipment comes from book data, including quantities and container contents. Portraits and token artwork remain manual. Base scores lock after native advancement to avoid overwriting background increases; completed equipment is not granted twice.


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
