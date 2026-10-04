# Region Spell Automation

Automate D&D5e spell Regions with configurable activity triggers and native Region Active Effects in Foundry Virtual Tabletop.

Configure a spell once, then cast it normally. The module attaches configured behaviors to the Regions created by that spell. The spell's activities define saves, damage, and other activity behavior.

## Compatibility

- Module version: **0.5.5**.
- Foundry VTT: **v14**.
- D&D5e system: **6.0.5+**; the current working setup uses 6.0.5. Later versions need testing.
- No additional module dependencies are declared.

## Features

- Multiple activity triggers per spell and multiple events per trigger.
- Per-trigger targeting and optional Once Per Turn limiting.
- Existing Active Effects attached as native D&D5e Region Effects.
- Follow-up activities use the original spell and stored cast level without consuming resources again, beginning concentration again, or creating another measured template.
- Previous user targets are restored after activity execution.
- Concentration cleanup removes Regions linked to the originating spell item across scenes.
- End-turn activity triggers skip tokens at 0 HP, with the `dead` status, or marked defeated in combat.
- A spell manager with search and configuration editing.

## Installation

### Manual installation

Place the module folder at `Data/modules/region-spell-automation` in your Foundry user data directory. It must contain `module.json` and these files:

```text
scripts/region-spell-automation.js
scripts/concentration-cleanup.js
scripts/spell-manager.js
```

Restart Foundry if necessary, open your D&D5e world, and enable **Region Spell Automation** under **Manage Modules**.

### Install through Foundry

Manifest installation is not configured in the current manifest. Once public release assets are available, paste the release manifest URL into **Install Module → Manifest URL** on Foundry's setup screen. See [RELEASING.md](RELEASING.md) for the remaining setup.

## Quick start

1. Prepare a spell whose casting activity creates a D&D5e Region.
2. Add follow-up activities to that same spell item, such as recurring save/damage activities.
3. As GM, open **Configure Settings**, locate Region Spell Automation, and select **Manage Region Spells**.
4. Add the spell configuration and its triggers. Match spell and activity names exactly. Choose events, targeting, and Once Per Turn behavior.
5. Add existing Active Effects as Region Effects if desired.
6. Enable the spell configuration, cast the spell, and place its area.
7. Test the selected events, effect entry/exit, and concentration cleanup.

Use a fresh cast after changing events or Region Effects. Existing Regions retain the behaviors attached when they were created.

## Trigger events

| Manager label | Event | When it runs |
| --- | --- | --- |
| Token Enters | `tokenEnter` | A token enters the Region. |
| Token Exits | `tokenExit` | A token exits the Region. |
| Token Moves Within | `tokenMoveWithin` | Foundry reports movement within the Region. |
| Token Starts Turn | `tokenTurnStart` | A token starts its combat turn in the Region. |
| Token Ends Turn | `tokenTurnEnd` | A token ends its combat turn in the Region. |

Events on one trigger invoke the same activity and share its Once Per Turn allowance. Use separate triggers for different activities or timing rules.

Foundry's Region events determine placement and movement behavior. Test casting over stationary tokens and moving areas separately from token entry. Movement events do not implement automatic damage for each distance increment traveled.

## Targeting

Targeting compares token dispositions relative to the caster.

| Mode | Behavior |
| --- | --- |
| Everyone | Includes all tokens, including the caster. |
| Exclude Friendlies | Excludes the caster and tokens with the same disposition. |
| Friendlies Only | Includes tokens with the same disposition, including the caster. |
| Hostiles Only | Excludes the caster and includes tokens with a different disposition. |

Different dispositions can include neutral creatures. Exclude Friendlies and Hostiles Only currently produce the same result when the caster resolves. If the caster cannot be resolved, Everyone and Exclude Friendlies allow the event; the other modes reject it.

These filters apply to activity triggers. Native Region Effects are attached with empty disposition, size, and creature-type filters and do not inherit trigger targeting.

## Once Per Turn

This option limits a trigger to one use per target during the current **combat turn**, including another creature's turn. It is not once per round.

The allowance is keyed by combat ID, round, turn, token ID, and trigger ID. Events sharing a trigger share the allowance. Multiple Regions with the same trigger ID also share it; the key does not distinguish Regions or casters.

Without combat turn information, events can repeat. History is client-local, resets on reload or combat deletion, and is not a cross-client lock. Rewinding combat can encounter a previously recorded allowance. An activity error releases the allowance; a canceled activity that returns normally may still consume it.

## Region Effects and concentration

Region Effects reference existing Active Effects by UUID and attach the native `dnd5e.applyActiveEffect` behavior. Keep the referenced effects available. Check application on entry and removal on exit or Region deletion.

When D&D5e reports concentration ending, the cleanup script removes Regions whose `dnd5e.item` flag matches the concentration effect's item UUID. It searches all scenes. This is item-based cleanup, not a general duration timer or a per-cast identifier.

## Example: separate start- and end-turn activities

For a spell such as Hunger of Hadar, prepare two activities on the originating item and configure two triggers:

| Trigger | Activity | Event | Targeting |
| --- | --- | --- | --- |
| Start-turn damage | Your cold-damage activity | Token Starts Turn | Everyone |
| End-turn save/damage | Your acid save/damage activity | Token Ends Turn | Everyone |

Match timing to the spell version used in your world. End-turn activity handling skips tokens at 0 HP, dead, or defeated; start-turn handling does not. Configure ongoing conditions or movement modifiers separately as Region Effects.

## Limitations

- Configuration is world-scoped and keyed by exact spell name. Same-name items share it; renaming a spell can break lookup.
- Follow-up activities are found by exact name on the originating item.
- Activity handling requires D&D5e origin metadata and a triggering token rendered on the canvas. Arbitrary drawn Regions are insufficient.
- Activity workflows may still require save, damage, or other user interaction.
- Cast-level scaling depends on the activity's configuration.
- Disposition filtering does not implement individually selected spell exemptions.
- Conditions alone do not implement obscuration, vision, or all spell rules.
- Player casting, multiple connected clients, concurrent triggers, and other automation modules need testing with your module stack.

## Troubleshooting and support

| Symptom | Check |
| --- | --- |
| Module is missing | Folder name, manifest location, and valid JSON; restart Foundry. |
| Activity does not run | Enabled configuration, exact names, D&D5e Region metadata, events, and targeting. Test a fresh cast. |
| Activity not found | Match the configured activity name to one on the originating spell. |
| Turn events do not run | Active combat, turn progression, occupancy, and targeting. |
| End-turn activity is skipped | HP, `dead` status, and combatant Defeated flag. |
| Duplicate cards | Duplicate triggers/behaviors, connected clients, and other automation modules. |
| Effect is missing | Referenced effect UUID, effect data, and native Region behavior. |
| Region remains after concentration | Concentration effect item UUID, Region item flag, and console errors. |
| Upcast damage is incorrect | Stored Region spell level and activity scaling. |

Open the browser console with **F12** and look for `Region Spell Automation |` messages. When [reporting an issue](https://github.com/Ugmul-dnd/region-spell-automation/issues), include Foundry, D&D5e, and module versions, reproduction steps, other active automation modules, and relevant console errors.

## Development and releases

The runtime lives in `scripts/region-spell-automation.js`, cleanup in `scripts/concentration-cleanup.js`, and the manager in `scripts/spell-manager.js`. The manager's v0.5.4 header reflects its component revision; the module version is defined in `module.json`.

See [RELEASING.md](RELEASING.md) for packaging and the public-release checklist.
