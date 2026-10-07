# Changelog

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
