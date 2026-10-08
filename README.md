# Region Spell Automation

Automate D&D5e spell Regions with configurable activity triggers and native Region Active Effects in Foundry Virtual Tabletop.

Configure a spell once, then cast it normally. The module attaches configured behaviors to the Regions created by that spell. The spell's activities define saves, damage, and other activity behavior.

## Compatibility

- Module version: **0.5.7**.
- Foundry VTT: **v14**.
- D&D5e system: **6.0.5+**; tested with **6.0.6**, with no issues reported so far. Later versions need testing.
- No additional module dependencies are declared.

An active GM must be connected when spells create Regions. The module uses the
active GM's client to attach Region behaviors and track movement damage,
including for player casts. Normal activity triggers run on the connected
caster's client if they own the originating actor, falling back to the active GM;
players do not need GM permissions for this setup.

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
scripts/shared-activity-card.js
scripts/movement-damage.js
scripts/concentration-cleanup.js
scripts/concentration-hud.js
scripts/spell-manager.js
scripts/starter-spells.js
```

Restart Foundry if necessary, open your D&D5e world, and enable **Region Spell Automation** under **Manage Modules**.

### Install through Foundry

The manifest is configured for GitHub releases. Once the public release assets are published, paste this URL into **Install Module → Manifest URL** on Foundry's setup screen:

```text
https://github.com/Ugmul-dnd/region-spell-automation/releases/latest/download/module.json
```

The URL requires a published release containing `module.json` and `region-spell-automation.zip`. See [RELEASING.md](RELEASING.md) for the remaining setup.

## Quick start

GMs can open the manager directly from **Compendiums → Open Region Spell
Manager**, beneath D&D5e's **Open Compendium Browser** button. The settings-menu
entry remains available.

Click **Add New Spell Region**, beside **Add Starting Spell List**, to open the
spell drop popup. Drop a spell there to open its activity-trigger configuration.

For a starting configuration, click **Add Starting Spell List** in the manager.
It adds six missing recipes, disabled for review, without replacing your saved
settings. They are based on Ugmul's Foundry Player's Handbook setup; matching
activities/effects must exist on your own spell items. See
[Starting Spell List](STARTER-SPELLS.md) for the spells and required setup.

1. Prepare a spell whose casting activity creates a D&D5e Region.
2. Add follow-up activities to that same spell item, such as recurring save/damage activities.
3. As GM, open **Configure Settings**, locate Region Spell Automation, and select **Manage Region Spells**.
4. Add the spell configuration and its triggers. Match spell and activity names exactly. Choose events, targeting, and Once Per Turn behavior.
5. Add existing Active Effects as Region Effects if desired.
6. Enable the spell configuration, cast the spell, and place its area.
7. Test the selected events, effect entry/exit, and concentration cleanup.

Use a fresh cast after changing events or Region Effects. Existing Regions retain the behaviors attached when they were created.

The checkbox beside each spell selects it for bulk actions. Use the separate
**Enable** or **Disable** button beside **Delete Spell** to toggle automation.
**Select all** includes all configured spells, even those hidden by search;
**Deselect all** clears selection. **Delete Selected** lists the selected spell
configurations and requires a Yes/No confirmation that deletion cannot be undone.
It removes saved module configurations, not the actors' spell items.

**Enable Selected** and **Disable Selected**, below the selection controls,
change automation for selected spells only. Disabled spells show **(Disabled)**
after their names; enabled spells display their names without a suffix.

**Show Disabled** and **Show Enabled**, below search, filter the list by state
and combine with the search text. Click the active filter again to show both
states. Search, filter, selection, and scroll position are preserved when
enabling or disabling spells.

## Hide Region from Players

Each spell card has a **Hide Region from Players** checkbox, unchecked by default.
It is saved with that configuration and applies only to newly created Regions
linked to its originating spell or Feature item. When checked, the Region uses
Foundry's native **Gamemaster** visibility. Its `hidden` flag is not changed, so
configured behaviors stay active. GM controls, animations, concentration, and
cleanup keep their existing behavior. Unchecking leaves new Region visibility
at the value supplied by the system or creating module; existing Regions are
never changed by this option.

Use this when an animation or map artwork represents the area. Manually drawn
trap/hazard Regions without an originating-item link are not matched to a module
configuration; set their native visibility in Foundry's Region configuration.
Foundry may show Regions to observers while their Region layer is active,
regardless of the Gamemaster visibility mode. Test player-owned Regions and
any modules that expose Region-layer controls to players.

## Trigger events

| Manager label | Event | When it runs |
| --- | --- | --- |
| Token Enters | `tokenEnter` | A token enters the Region. |
| Token Exits | `tokenExit` | A token exits the Region. |
| Token Moves Within | `tokenMoveWithin` | Foundry reports movement within the Region. |
| Token Starts Turn | `tokenTurnStart` | A token starts its combat turn in the Region. |
| Token Ends Turn | `tokenTurnEnd` | A token ends its combat turn in the Region. |

Events on one trigger invoke the same activity and share its Once Per Turn allowance. Use separate triggers for different activities or timing rules.

Foundry's Region events determine placement and movement behavior. Test casting over stationary tokens and moving areas separately from token entry. Ordinary activity triggers do not measure distance; use the optional Movement Damage mode below for distance-based damage.

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

## Prompt for Save on Region Triggers

In **Configure Settings → Region Spell Automation**, use **Prompt for Save on
Region Triggers** to control save prompts for the whole world. It defaults on
and is no longer configured separately on each trigger.
The affected token's connected player gets the native saving-throw dialog;
NPCs and targets with no connected player owner fall back to the active GM.
When several players own the actor, the assigned character's player is preferred,
then one active owner is chosen. The casting player is not the recipient unless
they also control the affected creature.

The prompt uses the activity's save ability, DC, bonus, and originating chat card.
Shared cards prompt only newly added targets, and Once Per Turn still applies.
The option does not apply to ordinary spell casts, movement damage, or non-Save
activities. Canceling a prompt leaves the card's Save button available for a
manual retry. Other modules or native fast-roll preferences may alter dialogs;
test with both GM and player clients after reloading.

## Prompt for Save on Spells and Features

The world setting **Prompt for Save on Spells and Features** defaults on. When
a spell, player feature, or monster ability uses a Save activity, each token listed on its activity card receives
its native saving-throw prompt on one connected owner's client. NPCs use the
active GM. For example, Fireball with four targeted tokens sends four prompts,
with the spell's save ability, DC, bonuses, and original card association.

Select the targets before casting, or ensure the system/module records them on
the cast card. NPC saves from a GM cast stay on that GM's client, even when
another GM is designated active. Actor-only target records are resolved to their
synthetic token or a unique active token; ambiguous actor-only targets are logged
and skipped rather than guessing.

This feature does not scan template geometry to choose targets. It waits briefly
for asynchronous AOE targeting updates and watches recorded-target changes on
casts made during the current session, prompting only newly recorded tokens.
Token names and added name labels do not affect routing. It applies to Save
spell and Feature activities, not attack/damage-only activities or saves mentioned
only in descriptive text. Region-generated
activity uses are excluded and continue to use **Prompt for Save on Region
Triggers**. The two settings can be toggled independently. Canceled prompts
leave the card's Save button available.

This is the renamed spell-cast setting: its saved on/off preference is preserved.
It does not add on-hit save mechanics or determine whether an attack hit.

## Once Per Turn

This option limits a trigger to one use per target during the current **combat turn**, including another creature's turn. It is not once per round.

The allowance is keyed by combat ID, round, turn, token ID, and trigger ID. Events sharing a trigger share the allowance. Multiple Regions with the same trigger ID also share it; the key does not distinguish Regions or casters.

Without combat turn information, events can repeat. History is client-local, resets on reload or combat deletion, and is not a cross-client lock. Rewinding combat can encounter a previously recorded allowance. An activity error releases the allowance; a canceled activity that returns normally may still consume it.

## Shared Activity Card Per Turn (development)

Enable **Share Activity Card Per Turn** when editing a trigger to add newly affected
tokens to one activity card during the current combat turn. For Spirit Guardians,
enable this alongside **Once Per Turn**: each creature still triggers at most once,
but new creatures encountered as the caster moves are added to the existing card.

When the initial cast uses the same activity configured in the shared trigger,
its activity card is registered for the newly created Regions. New creatures
encountered later during that cast's combat turn join the initial card and its
existing damage cards. Its initial targets also receive the per-turn allowance
when Once Per Turn is enabled. Different casting and trigger activities are not
automatically combined. Shared-card keys are stored on the chat message so the
designated executor can reuse a player's initial cast card across clients.
Normal activities execute on the connected caster's client; only the active GM
tracks movement damage. Other modules may still alter native roll prompts.

If damage has already been rolled from that card, new targets are also added to
its associated damage cards without another roll. Saves and damage application
remain native D&D5e actions; select the appropriate creatures when resolving them
and avoid applying damage twice to earlier targets. Target lists accumulate for
the turn, even if a creature later leaves the area.

A new combat turn creates a fresh card. Different Regions, originating spell
items, and triggers have separate cards. Outside combat this option falls back
to the usual per-event activity use. The local shared-card cache resets on reload
or combat deletion; message metadata allows an existing card to be found again.
Each activity has one designated caster-or-GM executor. Deleting a
shared card allows a fresh card for a newly qualifying target.

This option changes no existing configurations until enabled. It is intended for
save/damage activities; activities with other on-use actions run those actions
only for the first target. Verify with your module stack before using it at the
table. The shared-card workflow was confirmed working in-world by the author
with D&D5e 6.0.6 on October 7, 2026. Other module combinations still need testing.

## Movement Damage (development)

For Spike Growth, prepare a **Damage** activity with **2d4 piercing** damage on
the originating spell. In its trigger, enable **Accumulate Movement Damage** and
set **Distance Per Damage Increment** to **5** on a scene measured in feet.
Save and recast the spell so the new movement behaviors are attached.

The module measures movement inside the Region and maintains a pending damage
chat card for each creature, Region, trigger, and combat turn. Three 5-foot moves,
or one 15-foot move, accumulate three increments. Click **Roll Pending Damage**
to roll **6d4**, then apply it with the native damage card. Further movement adds
new pending damage; previously rolled increments are not rolled again. Each
movement counts whole increments: partial boundary steps round up instead of
carrying fractional feet forward.

A newly created pending card starts with at least one full damage increment,
including a non-teleport boundary-only entry. A 2.5-foot entry counts as
one 5-foot step; a 15-foot move inside counts as three. The final outward step
adds no damage; earlier internal steps during a longer exit move still count.
This simplified model can
count repeated small unsnapped moves more than their combined physical distance.
Duplicate reports of the same move are ignored.

Use **+** and **−** on the pending card to add or remove one pending damage
increment manually. These controls are GM-only. The casting player can use
**Roll Pending Damage** while connected and owning the originating actor; the
GM reserves the count and the player's client performs the native damage roll.
An active GM must remain connected. GMs can also roll as a fallback.
The count stops at zero; adjustments do not change previous
rolls or movement history. Corrections are saved on the card and included in the
next pending damage roll.

This mode automatically uses movement-in/within/out events and overrides event
selections, Once Per Turn, and shared-card options for that trigger. It requires
a Damage activity without saves or attacks. Each increment repeats the activity's
damage dice and bonuses independently. Rolling does not consume resources,
begin concentration, or create another area.

Distances use Foundry's Region-clipped token path and scene measurement rules,
not movement cost; difficult terrain does not double damage. Teleport segments
are excluded. Set the increment in scene units, converting 5 feet if using a
metric scene. Forced movement counts when it has a measurable non-teleport path;
the module does not decide spell-rule exemptions.

A new combat turn starts a new pending card; older cards remain usable. Outside
combat, movement accumulates on the same card. Pending totals are stored on chat
messages and survive reload; deleting a pending card deletes its record. This
feature does not provide a cross-client lock. Damage application remains manual.
Automated checks pass; in-world verification is still needed.

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

### Retarget a spell or Feature card

Use **Retarget** on a spell or Feature activity card to replace its recorded targets with
your currently targeted tokens (target markers, not merely controlled/selected
tokens). With no current targets, it clears the list. The GM or card owner can
use the button. Associated damage cards you can edit receive the same list.

This switches the card to targeted mode without rerolling saves/damage,
consuming resources, or undoing previously applied damage. Retarget itself does
not request new saving throws; use the card's Save button as needed. After placing
a template, choose the desired targets and click Retarget to correct an overly
broad initial list. Another module can still change targets afterward.

After retargeting, inline save summaries for removed targets are hidden on the
card. Their original rolls remain in chat history, and applied damage is not
undone. Adding a target back allows its existing summary to appear again.

### Instantaneous spell area cleanup

New Regions created by instantaneous spells and Features, such as Fireball or
Hell Hound Fire Breath, are removed when
their activity duration is instantaneous. Feature durations are read from the
originating activity; spells retain their item duration unless explicitly overridden.
These areas are removed when
the caster's combat turn ends. The spell must have its originating item and
caster token linked to the Region, and an active GM must be connected. Save
and damage chat cards remain available after the area is removed.

Spells or Features with activity triggers or Region Effects configured in the manager,
lasting-duration spells, and concentration spells are preserved. A configuration
added before cleanup is also respected. Existing Regions are not retroactively
tracked. Outside combat, areas stay for manual removal; combat rewinds do not
delete them. Finish resolving saves and damage before ending the caster's turn.

### End concentration from the token HUD

Right-click a concentrating token to show its HUD. A concentration icon with a
red **×** appears for the GM or an actor owner. Hover to see the concentrating
spell names; click to end concentration immediately through D&D5e's normal
workflow, including linked Region cleanup. If the actor is allowed to maintain
multiple concentration effects, this control ends all of them.

The control appears only while concentration is active. Repeated clicks during
the same operation are ignored.

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

## License

Copyright (c) 2026 Ugmul. Released under the [MIT License](LICENSE).
