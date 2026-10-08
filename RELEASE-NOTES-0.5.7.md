# Region Spell Automation v0.5.7

- Added **Hide Region from Players** to each spell configuration in the manager.
- Added optional **Prompt Saving Throw on Trigger** to Save activity triggers. Prompts the affected token's player (or GM for NPCs); shared cards prompt newly added targets only.
- Defaults to unchecked for existing, new, and starter configurations.
- Checked configurations give newly created, item-linked Regions native Gamemaster visibility. The `hidden` flag and automation behavior are unchanged.
- Applies before creation when the item can be resolved synchronously, with a GM-side fallback after creation.
- Existing Regions are not changed retroactively. Recast to test the setting.

Visibility persistence, creation handling, and the existing automation regression suite pass. Verify GM/player overlays, entry/turn triggers, native effects, and cleanup in Foundry v14 with your module stack. Player-owned Regions on an active Region layer may be visible to their observers under Foundry's native visibility rules.

Manually drawn Regions without a configured originating-item link are outside the module's existing matching model. Set their native visibility directly in Foundry; this release introduces no trap mechanics.
