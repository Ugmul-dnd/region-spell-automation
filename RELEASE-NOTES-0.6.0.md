# Ugmuls 5.5e Automation v0.6.0

This revision expands the module's configurable region, combat-card, weapon mastery, damage, and effect automation. Each optional gameplay feature can be controlled through the Module Options window.

## Regions and targeting

- Spell and Region Management supports spells, player features, monster abilities, and auras.
- Self-origin emanations can attach automatically to the caster's token.
- Cone placement snaps to grid intersections. Scroll rotates during placement, Shift-scroll rotates precisely, and Ctrl-scroll zooms.
- Region effects and conditions follow trigger targeting relative to the caster. Hostile-only regions exclude friendlies, including when the caster is an NPC.
- Region effects take priority over card effects. Matching active effects already on a target are left unchanged, preventing duplicate effects such as Spirit Guardians' speed reduction.
- Turn-only auras defer their save and damage prompts until the configured turn event.

## Combat cards and roll controls

- Attack rolls support retroactive Advantage, Normal, and Disadvantage controls; damage rolls from attacks support Normal/Critical corrections, including powerful critical dice.
- Automatic damage prompts open for save activities with damage and confirmed attack hits, with remembered attack/save/damage dialog positions.
- Compact attack cards retain Damage, Retarget, roll controls, and reaction actions while hiding processed base cards. Attack, damage, and save cards use matching green, red, and blue accents.
- Retarget refreshes attack results against current AC and updates linked damage targets.
- Shield reaction cues allow native casting from attack results. After Shield is applied and results refreshed, damage cards hide when every target is now missed.
- Chat opening and hover expansion keep the newest card controls visible at the bottom of the log.

## Saves, damage, and effects

- GM-run NPC saves can roll automatically using recommended advantage/disadvantage. PCs and player-owned NPCs keep their prompts.
- Separate options control Auto Apply Damage, Auto Apply Saved Effects, and Autoapply Status on Hit.
- Auto Apply Damage and Healing also handles healing and temporary HP after dice animations, using native HP caps and temporary-HP replacement. GM Undo Healing restores the recorded changes and reopens the Apply controls; healing supports unconscious targets at 0 HP.
- Automatic damage waits for all required save results and visible damage/save dice animations on connected clients. The GM window can remain in the background.
- Pending save buttons remain visible until dice finish and can reopen accidentally canceled prompts without stopping automation.
- Save effects respect each assigned effect's On Save setting. Attack effects apply only to hit targets. Effects can resolve independently when automatic damage is disabled.
- Magic Resistance is recognized without requiring an Active Effect, granting recommended advantage against spells and features marked Magical while preserving disadvantage cancellation and Automated Conditions integration.
- Configured utility buffs can apply automatically to self, allies, and friendly targets; applied effect trays collapse.
- GM Undo Damage restores recorded HP and temporary HP changes and reopens the damage controls.
- GM Undo Effect removes created effects or restores refreshed effects, preserving applications superseded by a later cast. Manual Apply Effect restores its undo action, including first applications after retroactive save corrections.

## Weapon masteries

- Independently enable Graze, Sap, Slow, Topple, and Vex for characters with the matching unlocked weapon mastery.
- Sap applies on hit. Vex and Slow apply after damage is dealt, with manual correction controls.
- Vex tracks the affected creature for the next matching attack. Sap and Vex combine with Automated Conditions advantage/disadvantage rules.
- Topple posts a save request immediately, then fills in the defender's roll and result. Graze damage is clearly labeled separately from a standard attack damage roll.
- Graze automatically creates a damage card on misses and uses the damage automation setting. Undoing it restores HP, hides the card, and restores the linked attack's Damage/Graze controls for corrections.
- Push, Nick, and Cleave remain outside the module's mastery automation.

## Options and compatibility

The tabbed Module Options window groups Regions, Targeting, Rolls & Damage, Effects, Weapon Mastery & Attack Properties, GM NPC & Damage, and Chat. Existing stored settings are retained.

- Foundry VTT: v14; tested on build 369.
- D&D5e: minimum 6.0.5; verified with 6.0.6.
- An active GM is required for authoritative automatic damage/effect application and GM region setup.
- Dice So Nice and Automated Conditions integrations are optional.

After updating, reload the GM and player clients. If a browser retains older scripts, empty its cache and hard-refresh. Reload the scene to refresh existing managed region targeting filters.
