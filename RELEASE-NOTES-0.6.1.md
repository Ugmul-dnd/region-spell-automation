# Region Spell Automation v0.6.1

**Development draft — unreleased.**

Development is on the `v0.6.1dev` branch, starting from the v0.6.0 codebase.

## Added

- Hex and Hunter's Mark: caster-specific marked-target bonus damage in attack damage dialogs, with checked options, critical support, and existing Apply/Undo Damage. Requires active concentration and a single target. Configure each spell under Bonus Damage Riders.

- Reckless Attack assistance: a split Adv/Reckless control uses the character's
  configured feature effect and completes the Strength attack. The effect ends
  at their next turn start. Subsequent Strength attacks and attacks against the
  Reckless creature recommend advantage, with Automated Conditions integration
  and normal advantage/disadvantage cancellation. Includes an independent setting
  under Weapon Mastery & Attack Properties.

## Compatibility

- Foundry VTT: v14; existing verification on build 369.
- D&D5e: minimum 6.0.5; existing verification with 6.0.6.

Finalize these notes and the v0.6.1 changelog section before publishing.
# Savage Attacker

Weapon damage dialogs offer Savage Attacker for characters with the feat: keep the higher of two weapon dice sets, with both sets recorded in native roll details. Savage Used expires at next turn start. Enable it under Weapon Mastery & Attack Properties. Undo Damage, adjust Normal/Critical, and reapply; both standard and maximized criticals are supported, with the winning dice set recalculated.

