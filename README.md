# Ugmuls 5.5e Automation

Configurable spell regions and combat assistance for D&D5e in Foundry Virtual Tabletop. Automate routine steps while keeping chat-card controls available for manual decisions and corrections.

**[Visit the module website for information and features](https://ugmul-dnd.com/foundry).**

## Supported content

Automations are developed and tested using the official Foundry **[Player's Handbook (2024)](https://foundryvtt.com/packages/dnd-players-handbook)** content.

Most features rely on the spells, class features, activities, chat cards, names, identifiers, and associated Active Effects supplied by that content. Having the expected name alone may not be enough if the item's activities or effects are configured differently.

Some features may work with content from **D&D Beyond Importer**, but imported content has **not been tested**. Imported or homebrew items may need their names, activities, damage formulas, or effects adjusted to match the expected setup. This module does not include the Player's Handbook content.

## Main features

- **Spell and feature regions:** configure entry, movement, and turn triggers; target filters; region conditions and effects; self-attached emanations; and concentration cleanup.
- **Targeting and saving throws:** confirm area targets, retarget attack cards, prompt token owners for saves, and let a GM take over a pending save. Optional automatic saves for GM-run NPCs leave player-owned NPCs manual.
- **Damage, healing, and effects:** optional roll prompts and automatic application, with GM Undo Damage, Undo Healing, and Undo Effect controls. Applied damage locks retroactive roll adjustments until it is undone.
- **Attack assistance:** retroactive Advantage/Normal/Disadvantage and Normal/Critical controls, Shield assistance, Reckless Attack, Savage Attacker, Sneak Attack, and combat reaction, bonus-action, and spell-slot tracking.
- **Bard assistance:** source-tracked Bardic Inspiration, Cutting Words, Peerless Skill, and Valor Combat Inspiration for initial damage and reaction defense.
- **Barbarian assistance:** Zealot Divine Fury, Fanatical Focus, Zealous Presence, and Brutal Strike with improved effect choices, native effects, Sundered attack bonuses, and Staggered save disadvantage.
- **Unarmed combat:** Stunning Strike with native saves and Undo support; Grapple / Prone options on action-based unarmed hits, independent saving throws using the target’s better save, and Grappler’s once-per-turn damage benefit and source-specific attack advantage.
- **Load class spells from the sheet:** Spell New/Add buttons offer full-list preparation casters a source-filtered missing-spell loader. Only currently supported spell levels are added, unprepared; existing spells remain unchanged.
- **Guided PC creation:** Create Player in Actors walks through level-one setup, Standard Array / point buy, native source-filtered class/background/species advancement, starting equipment or gold, class cantrips/spells and preparation, and review. Close and resume from Create Player or the PC’s Actors right-click menu; token artwork stays manual.
- **Great Weapon feats:** Great Weapon Fighting applies a minimum of 3 to qualifying two-handed melee attack damage dice. Great Weapon Master offers proficiency-bonus damage on Heavy-weapon Attack-action hits on your turn; Hew remains manual.
- **Battle Master maneuvers:** Precision Attack adds the current Superiority Die to missed attacks; Trip Attack, Distracting Strike, Menacing Attack, Goading Attack, Maneuvering Attack, and Pushing Attack join damage Configuration with shared resource spending, one maneuver per attack, saves/effects, and Undo support. Relentless offers a free d8 once per active combat turn, shared with Precision Attack.
- **Bonus damage riders:** Hex, Hunter's Mark, and Conjure Minor Elementals add eligible bonus damage to the existing damage card. Class riders include Divine Smite, Eldritch Smite, Hunter's Prey, and Frenzy. Target-dependent riders currently support single-target damage cards.
- **Sorcerer assistance:** Innate Sorcery attack advantage, cast-time Transmuted/Heightened/Careful Spell, and Empowered/Seeking reroll actions with Sorcery Point consumption and Metamagic card tags.
- **Multiple spell attacks:** Eldritch Blast and Scorching Ray offer a remaining-attacks window so users can choose targets between shots without casting or spending a slot again.
- **Weapon masteries:** assistance for Graze, Sap, Slow, Topple, and Vex, with individual enable/disable options. Push, Nick, and Cleave are not automated.
- **Interface conveniences:** compact chat cards, remembered roll-popup positions, chat scrolling improvements, and character-sheet Add Item buttons that open the matching compendium browser tab.

Use the module's tabbed options interface to enable the features that suit your table. The Automations section groups options into Unique Classes, Weapon Masteries, Feats, Common, and Spells. Automatic damage and effect application are optional; manual card controls remain available.

## Compatibility

| Component | Support |
| --- | --- |
| Foundry Virtual Tabletop | v14; tested on build 369 |
| Dungeons & Dragons Fifth Edition system | 6.0.5 minimum; tested with 6.0.6 |
| Official Player's Handbook (2024) | Content used to develop and test the automations |
| D&D Beyond Importer content | May work, but has not been tested |

An **active GM must be connected** for GM-managed region effects, NPC automation, and other operations affecting actors a player does not own.

### Optional module integrations

- **Dice So Nice!** — roll prompts and automatic application coordinate with dice animations.
- **Automated Conditions 5e** — integrates recommended advantage/disadvantage for supported features and preserves cancellation.
- **Tidy 5e Sheets** — supported Add Item controls open the compendium browser, alongside the standard D&D5e character sheet.

No additional module dependencies are declared. See [Module Compatibility and Test Setup](COMPATIBLE-MODULES.md) for the recorded testing environment. Modules listed there as enabled are not all individually certified compatible.

## Installation and updates

Install through Foundry's module browser, or paste this manifest URL into **Install Module → Manifest URL**:

```text
https://github.com/Ugmul-dnd/ugmuls-5-5e-automation/releases/latest/download/module.json
```

Enable **Ugmuls 5.5e Automation** in your D&D5e world's **Manage Modules**, then configure its options in Module Settings.

After updating, **restart Foundry and hard-refresh connected browsers** to load the current scripts.

## Help and release history

- [Module information and features](https://ugmul-dnd.com/foundry)
- [Report a bug](https://github.com/Ugmul-dnd/ugmuls-5-5e-automation/issues)
- [Changelog](CHANGELOG.md)
- [Starter spell configurations](STARTER-SPELLS.md)
