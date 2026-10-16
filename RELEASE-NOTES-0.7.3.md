# Ugmuls 5.5e Automation v0.7.3 — Character Creation, Bards & Barbarians

This release adds guided player-character creation and expands Bard and Barbarian automation through the existing attack, save, damage, and effect card workflows.

## Guided character creation

- Create Player in the Actors directory walks through name and ownership, default PC token setup, Standard Array or 27-point buy, class, background, species, equipment or starting gold, class spells, preparation, and review.
- Native advancement and spell pickers respect enabled Compendium Sources. Token artwork remains manual.
- Ability scores start unassigned. Standard Array choices share a remaining-value pool; point buy shows remaining points and affordable choices. Reset clears the selections.
- Continue Character Creator Wizard on an owned PC checks the current sheet and saved progress so setup can resume without duplicating starting equipment.
- Standard and Tidy spell Add buttons offer eligible full-list preparation classes a missing-spell loader. It adds only currently castable leveled spells from enabled sources, unprepared, preserving existing and always-prepared spells. Paladins use the compendium browser.

## Bard automation

- Bardic Inspiration automatically applies the native Inspired effect and tracks its source Bard and granted die. Failed attacks, saves, and checks can add that die while preserving the original d20. The die is consumed when rolled.
- Cutting Words offers eligible enemy attack and damage adjustments within 60 feet, using the Bard's Reaction and Inspiration resource while preserving existing dice.
- Peerless Skill adjusts the Bard's own failed attacks and ability checks, spending Inspiration only when the adjusted test succeeds.
- Valor Combat Inspiration adds its damage die in the initial damage configuration, including critical damage. Defense uses the recipient's Reaction to add AC against an incoming attack and combines with Shield.
- Unknown-DC adjustments request the information needed to determine the result.

## Barbarian automation

- Zealot Divine Fury adds its scaled Radiant or Necrotic damage to the first eligible hit on the raging Barbarian's turn.
- Fanatical Focus offers a single replacement d20 plus Rage Damage bonus on a failed save, once per Rage. Previous advantage/disadvantage is not reused, and recorded targeting is restored afterward.
- Zealous Presence grants advantage on attacks and saves until the source Barbarian's next turn, combining normally with disadvantage and AC5E.
- Brutal Strike sits above Normal in the attack prompt; Reckless sits above Advantage. Brutal can activate Reckless on the first attack, or reuse it later, and requires a Strength attack without disadvantage on the Barbarian's turn.
- Brutal damage rolls with the weapon damage and supports native scaling and criticals. Damage configuration selects Forceful or Hamstring Blow; Improved Brutal Strike adds Staggering and Sundering, and Improved Brutal Strike (2) permits two different effects.
- Selected native Hamstrung, Staggered, and Sundered effects apply to hit targets with source-turn expiry, manual Apply, and Undo support. Movement remains manual.
- Sundered adds one +5 bonus to the next single-target attack by another creature, then consumes qualifying effects after the roll, hit or miss. Canceling the prompt preserves the effect.
- Staggered supplies disadvantage on the next save through AC5E or the standalone flow. It cancels Magic Resistance advantage to Normal. The effect remains until expiry for its Opportunity Attack restriction after the save benefit is spent.

## Workflow improvements

- Shield spends an available limited/free use first, then the lowest available eligible spell slot, including upcasting and Pact slots.
- Automatic damage and healing application have separate settings.
- Damage cards hide when a later attack adjustment makes every target a miss, and return if the attack becomes a hit again.
- Save-card borders include the initial card; Bardic prompts use constrained icons and chat scrolls after Inspiration application.
- Published attack cards provide a second hit-to-damage prompt check; manual damage retains its originating attack for rider eligibility.

## Validation and compatibility

- All 54 local regression test files pass.
- User testing confirmed the principal combat flows, including Staggered with a second tester.
- Foundry VTT 14; D&D5e minimum 6.0.5, verified 6.0.6. Official 2024 Player's Handbook content is the supported source. Imported/homebrew content may need matching native activities and effects.
- Refresh connected browsers after updating.
