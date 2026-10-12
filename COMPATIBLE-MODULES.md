# Module Compatibility and Test Setup

This reference records Region Spell Automation v0.6.0 development testing in **Fragment of the Fallen**.

- Snapshot date: **2026-10-12**.
- Foundry VTT: **14.369**.
- D&D5e system: **6.0.6**.
- Enabled modules: **48**, including Region Spell Automation (47 companion modules).

The enabled list comes from the world's saved module configuration. Versions come from installed module manifests. This is a saved configuration snapshot, not a live inspection of every browser or proof that every enabled module's features have been tested. Browser caches can retain older code until clients reload.

## Specific integrations

| Module | Installed version | Compatibility evidence and behavior |
| --- | --- | --- |
| Automated Conditions 5e | 14.606.2 | The earlier Vex/Sap roll-default conflict was resolved and confirmed in testing. Region Spell Automation registers these sources through its public usage-rule API so condition-based advantage/disadvantage and cancellation remain intact. Magic Resistance uses the same integration; its automated checks pass. |
| Dice So Nice! | 6.4.4 | Damage prompting and application wait for visible roll animations, including player damage and saving throw dice. This behavior was confirmed in testing with the GM window in the background. |

These integrations are optional. Region Spell Automation does not declare additional required modules. Without Automated Conditions, it uses its native roll-default fallback. Without Dice So Nice, it does not wait for 3D dice animation.

## Modules requiring separate notes

- **Carousel Combat Tracker (combat-tracker-dock):** enabled. An earlier console screenshot showed a CombatDock._onCombatTurn/querySelector error attributed by Foundry to this package. Record that separately when diagnosing errors; this module has not received a complete compatibility test.

## Enabled modules in the test world

Except for the specific evidence above, this table means **enabled in the testing setup**, rather than individually certified compatible. Region Spell Automation itself is included to show the complete saved list.

| Module | Installed version | Module ID |
| --- | --- | --- |
| Always HP | 14.01 | `always-hp` |
| Argon - Combat HUD (CORE) | 5.0.1 | `enhancedcombathud` |
| Argon - Combat HUD (DND5E) | 5.2.2 | `enhancedcombathud-dnd5e` |
| Aura Effects | 2.2.3 | `auraeffects` |
| Automated Animations | 7.1.7 | `autoanimations` |
| Automated Conditions 5e | 14.606.2 | `automated-conditions-5e` |
| Automated Evocations - Companion Manager | 6.0.0 | `automated-evocations` |
| Bossbar | 5.0.1 | `bossbar` |
| Carousel Combat Tracker | 5.0.2 | `combat-tracker-dock` |
| Chat Log Prune | 1.1.10 | `chatlog-prune` |
| D&D5e Animations | 3.3.0 | `dnd5e-animations` |
| DFreds Convenient Effects | 9.2.7 | `dfreds-convenient-effects` |
| DFreds Droppables | 6.2.1 | `dfreds-droppables` |
| DFreds Effects Panel | 6.2.3 | `dfreds-effects-panel` |
| DFreds Obvious Settings | 3.0.0 | `dfreds-obvious-settings` |
| Dice So Nice! | 6.4.4 | `dice-so-nice` |
| Dice Tray | 4.0.5 | `dice-calculator` |
| Dungeon Alchemist Level Importer | 0.0.8 | `da-level-importer` |
| Dungeons & Dragons Dungeon Master's Guide | 2.0.0 | `dnd-dungeon-masters-guide` |
| Dungeons & Dragons Monster Manual | 1.4.0 | `dnd-monster-manual` |
| Dungeons & Dragons Player's Handbook | 2.2.0 | `dnd-players-handbook` |
| Enhanced Region Behavior | 1.5.0 | `enhanced-region-behavior` |
| GM Token-Drag Visibility v2 | 13.0.0 | `gm-token-drag-visibility-v2` |
| Health Estimate | 35.2.2 | `healthEstimate` |
| Image Hover | 3.2 | `image-hover` |
| Item Piles | 3.3.4 | `item-piles` |
| JB2A - Jules and Ben's Animated Assets - Free Content | 0.9.4 | `JB2A_DnD5e` |
| Lib: DFreds Migrations | 1.0.4 | `lib-dfreds-migrations` |
| Lib: DFreds UI Extender | 2.5.0 | `lib-dfreds-ui-extender` |
| libWrapper | 1.13.5.1 | `lib-wrapper` |
| Monk's Active Tile Triggers | 14.01 | `monks-active-tiles` |
| Monk's Bloodsplats | 14.01 | `monks-bloodsplats` |
| Monk's Combat Details | 14.03 | `monks-combat-details` |
| Monk's Little Details | 14.01 | `monks-little-details` |
| Monk's Player Settings | 14.01 | `monks-player-settings` |
| Portal | 4.0.0 | `portal-lib` |
| PSFX - Peri's Sound Effects | 0.18.0 | `psfx` |
| Region Spell Automation | 0.6.0 | `region-spell-automation` |
| Remote Highlight UI | 2.3.6 | `remote-highlight-ui` |
| Sequencer | 4.2.3 | `sequencer` |
| Smart Doors | 1.8.0 | `smart-doors` |
| Smart Target | 4.0.2 | `smarttarget` |
| socketlib | v1.1.4 | `socketlib` |
| Tagger | 1.6.0 | `tagger` |
| Tidy 5e Sheets | 14.1.2 | `tidy5e-sheet` |
| Token Magic FX | 0.8.4 | `tokenmagic` |
| Token Magic FX - Automatic Wounds | 1.1.27 | `tokenmagic-automatic-wounds` |
| Tokenizer | 5.0.3 | `vtta-tokenizer` |

## Retesting and issue reports

When testing a new module version, reload the GM and player clients. If a browser keeps old scripts, empty its cache and hard-refresh. Reload the scene when testing changes to existing managed region filters.

For a suspected interaction, record the reproduction steps, relevant module versions, which automation options were enabled, and console errors. Recheck with the overlapping workflow enabled in only one module, then confirm whether the issue depends on the other module. Update this reference when a combination has been specifically verified or a conflict reproduced.
