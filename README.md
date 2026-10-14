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
- **Attack assistance:** retroactive Advantage/Normal/Disadvantage and Normal/Critical controls, Shield assistance, Reckless Attack, Savage Attacker, Sneak Attack, and off-turn reaction tracking.
- **Bonus damage riders:** Hex, Hunter's Mark, and Conjure Minor Elementals add eligible bonus damage to the existing damage card. These spell riders currently support single-target damage cards.
- **Multiple spell attacks:** Eldritch Blast and Scorching Ray offer a remaining-attacks window so users can choose targets between shots without casting or spending a slot again.
- **Weapon masteries:** assistance for Graze, Sap, Slow, Topple, and Vex, with individual enable/disable options. Push, Nick, and Cleave are not automated.
- **Interface conveniences:** compact chat cards, remembered roll-popup positions, chat scrolling improvements, and character-sheet Add Item buttons that open the matching compendium browser tab.

Use the module's tabbed options interface to enable the features that suit your table. Automatic damage and effect application are optional; manual card controls remain available.

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
