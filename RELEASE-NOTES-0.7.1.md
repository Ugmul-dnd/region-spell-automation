# Ugmuls 5.5e Automation v0.7.1

This release expands class and feat automation, adds Sorcerer Metamagic support, and reorganizes the options menu.

## Class and feat automation

- Stunning Strike joins the damage dialog, spends Focus, prompts its save, and applies Stunned or the successful-save effects with Undo support.
- Unarmed Grapple / Prone prompts use the target's better Strength/Dexterity save and the appropriate attacker DC. Grappler can retain damage plus Grapple once on your turn and grants advantage against creatures grappled by you.
- Combined Stunning Strike and Grapple resolve in order. Stunned targets automatically fail the Grapple/Prone save, then damage and effects continue automatically.
- Divine Smite, Eldritch Smite, Hunter's Prey and Frenzy add eligible damage to the existing roll with resource and turn limits.
- Bonus Action, Reaction and character spell-slot trackers help enforce combat usage. Used markers are reused and become inactive when reset.
- Reckless Attack activates on your first attack of the turn and lasts through qualifying reaction attacks until your next turn starts.

## Sorcerer and damage improvements

- Innate Sorcery recommends advantage on Sorcerer spell attacks.
- Transmuted, Heightened and Careful Spell are selected before rolling, with target selection, Sorcery Point costs and supported combination limits.
- Empowered Spell lets you choose damage dice to reroll; Seeking Spell rerolls a d20 on a missed spell attack.
- Metamagic tags appear on damage cards with tooltip details.
- Damage Configuration uses Yes/No selectors and live dice previews. Savage Attacker defaults to Yes; once-per-turn choices clearly show when used.
- Pending damage/healing cards let a GM or owner reopen a canceled or unattended prompt. Player retries fill the original card correctly, without duplicate Dice So Nice animations.

## Options and fixes

- Automations is organized into Unique Classes, Weapon Masteries, Feats, Common and Spells.
- Filter Unique Classes by All or any core class. Category and class selectors remain visible while settings scroll below them; drag the bottom-right corner to resize the window.
- The main mastery toggle disables and greys out its child options while retaining their selections. Grappler and unarmed prompts have separate settings.
- Ordinary area casts skip unnecessary target confirmation; selective casts and applicable Metamagic retain it.
- Improved card scrolling, Stunning Strike Apply/Undo controls, turn-marker renewal, combat-end cleanup and Seeking Spell reroll stability.

## Updating

Existing v0.7.0 installations keep the same module ID and saved settings. No clean installation is required for this update.

Requires Foundry VTT v14 and D&D5e 6.0.5 or newer; tested on Foundry build 369 and D&D5e 6.0.6. Developed and tested with official Foundry Player's Handbook (2024) content. D&D Beyond Importer content remains untested.

Restart Foundry and hard-refresh connected browsers after updating. Automation options remain configurable for your table.
