# Region Spell Automation v0.5.7

- Added hover controls to adjust saving throws between ADV, NORMAL, and DISADV, including inline card results. Original dice are retained, extra dice are cached, and native save outcomes refresh. Applied damage is not reversed.

- New instantaneous spell and Feature Regions, such as Fireball or Hell Hound Fire Breath, are cleaned up at their user's combat turn end. Manager-configured triggers/effects and lingering areas are preserved; chat cards remain available.

- Added **Hide Region from Players** to each spell configuration in the manager.
- Added the world setting **Prompt for Save on Region Triggers**, enabled by default. Prompts the affected token's player (or GM for NPCs); shared cards prompt newly added targets only. Ordinary spell casts use a separate setting.
- Added the independent world setting **Prompt for Save on Spells and Features**, enabled by default. Save activities on spells, player features, and monster abilities prompt recorded targets using player-owner/GM routing. The earlier spell-cast setting preference is preserved. Region-generated uses and attack-only activities are excluded.
- Defaults to unchecked for existing, new, and starter configurations.
- Checked configurations give newly created, item-linked Regions native Gamemaster visibility. The `hidden` flag and automation behavior are unchanged.
- Applies before creation when the item can be resolved synchronously, with a GM-side fallback after creation.
- Existing Regions are not changed retroactively. Recast to test the setting.

Visibility persistence, creation handling, and the existing automation regression suite pass. Verify GM/player overlays, entry/turn triggers, native effects, and cleanup in Foundry v14 with your module stack. Player-owned Regions on an active Region layer may be visible to their observers under Foundry's native visibility rules.

Manually drawn Regions without a configured originating-item link are outside the module's existing matching model. Set their native visibility directly in Foundry; this release introduces no trap mechanics.
