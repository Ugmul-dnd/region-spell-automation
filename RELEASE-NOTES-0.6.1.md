# Region Spell Automation v0.6.1

Attack assistance, bonus damage riders, and repeat-attack controls, with easier correction of automated damage.

## Added

- **Eldritch Blast and Scorching Ray:** a Pending Attacks window counts remaining shots by character or cast level. Choose targets between attacks without spending another slot. Canceling does not consume a shot; the window closes at zero.
- **Sneak Attack:** a damage checkbox defaults on after Advantage, remains manually selectable otherwise, and uses the feature's configured damage. Its once-per-turn marker resets at the end of the current combat turn, permitting use on later reaction attacks.
- **Reaction tracking:** manual off-turn spell, weapon and feature uses apply Reaction - used. Further uses are blocked until the effect is disabled/deleted or expires at next turn start. Saves, linked damage and automated Region triggers remain available.
- **Damage correction:** applied damage locks retroactive attack/save ADV/Normal/DIS and damage Normal/Critical controls. Undo Damage unlocks them; applying again relocks them.
- **Pending save takeover:** the clicking GM or token owner gets the saving throw prompt; the previous module popup closes on connected clients when still open.
- **Savage Attacker:** an optional weapon damage checkbox rolls two complete dice sets and keeps the higher total, showing both in roll details. A used marker prevents reuse until next turn start. Normal/Critical conversion supports standard and maximized criticals, preserves previous results and recalculates the winning set.

- Conjure Minor Elementals rider: attacks against a target inside your active concentrated spell Region include an optional scaled Bonus Attack Damage component and Acid/Cold/Fire/Lightning choice. Remembers each user's last elemental type. Uses existing critical, application and undo controls without a custom target effect.

- Hex and Hunter's Mark: caster-specific marked-target bonus damage in attack damage dialogs, with checked options, critical support, and existing Apply/Undo Damage. Requires active concentration and a single target. Configure each spell under Bonus Damage Riders.

- Reckless Attack assistance: a split Adv/Reckless control uses the character's
  configured feature effect and completes the Strength attack. The effect ends
  at their next turn start. Subsequent Strength attacks and attacks against the
  Reckless creature recommend advantage, with Automated Conditions integration
  and normal advantage/disadvantage cancellation. Includes an independent setting
  under Weapon Mastery & Attack Properties.

## Fixes

- Managed Region effects add/remove through the active GM, including player aura cancellation affecting NPCs. Recurring Region damage prompts select a connected caster owner with GM fallback.
- Manual interaction with one attack's damage no longer stops later rays in the same cast from applying automatically. Each shot's damage uses its own attack target.
- Divine Smite and other critical-enabled Damage activities receive retroactive Normal/Critical controls; save spells and Graze remain excluded.
- Hunter's Mark's configured effect can auto-apply to its single hostile target through the GM. Hex keeps manual effect selection.
- Player riders resolve linked cast targets and native Region geometry, avoiding local membership-cache differences.
- Reckless Attack works on its first roll with Automated Conditions, using real disadvantage-source counts instead of Normal-mode flags.

## Options and limits

New settings are grouped under Bonus Damage Riders, Weapon Mastery & Attack Properties, and Effects. Hex, Hunter's Mark and Conjure Minor Elementals riders currently support single-target damage cards. Bonus damage uses existing critical, Apply Damage and Undo Damage controls.

## Compatibility

- Foundry VTT: v14; existing verification on build 369.
- D&D5e: minimum 6.0.5; existing verification with 6.0.6.

After updating, restart Foundry and hard-refresh connected browsers to load the new scripts.

