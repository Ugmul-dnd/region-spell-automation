# Region Spell Automation v0.5.7

Adds area target confirmation, automatic saving throw prompts, Region conditions,
and a simpler spell manager.

## New features

- Automatically target eligible creatures after placing spell or feature Regions.
  Confirm targets in a popup, add targets on the map, or click a name to remove it.
  Token thumbnails and hover highlights help identify targets.
- Prompt affected players to roll saves for spells, player features, monster
  abilities, and Region triggers. NPC saves route to a GM.
- Retarget spell and feature chat cards using your current map targets; removed
  targets disappear from the summary while existing rolls are preserved.
- Adjust saving throws between advantage, normal, and disadvantage using inline
  hover controls, with dice animation for new dice and a smooth card expansion.
- Apply standard Region conditions while creatures are inside. Exiting or deleting
  the Region removes only its own condition effects, preserving other sources.
- Hide newly created configured Regions from players using native GM visibility.
- Remove new instantaneous spell and feature targeting Regions at the caster's
  combat turn end. Configured automation and lingering areas remain.

## Improvements

- Compact spell rows with selection, enabled state, Edit, and Delete.
- Separate configuration windows for triggers, conditions, visibility, and effects.
- Dropped spells save and open their full configuration instead of requiring a trigger.
- Alphabetical condition picker with explicit confirmation.
- Hidden, dead, defeated, and zero-HP targets are excluded from automatic targeting,
  Region activity triggers, and saving throw prompts.
- Optional targeting, save prompts, save adjustment, Retarget, cleanup, and
  concentration controls can be enabled or disabled in module settings.
- Starter configurations include no preloaded Region Effects or spell content.

## Updating

Restart the Foundry server after updating, then refresh GM and player browsers.
If a browser retains old scripts, use a hard refresh or temporarily disable its
cache in developer tools. Keep an active GM connected for Region setup and conditions.

Recast existing areas to use changed visibility or condition configuration.
Disable competing live template targeting in D&D5e Tweaks when using this module's
area confirmation. Save adjustments do not undo damage already applied.

Tested by the author on Foundry VTT v14 Stable, build 369, with D&D5e 6.0.6,
including GM and player casting, monster abilities, saving throws, and Region conditions.
