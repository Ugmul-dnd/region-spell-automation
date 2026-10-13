# Region Spell Automation

Manage D&D5e spell and feature Regions, targeting, roll controls, weapon masteries, damage, and effect automation in Foundry Virtual Tabletop.

Configure a spell once, then cast it normally. The module attaches configured behaviors to the Regions created by that spell. The spell's activities define saves, damage, and other activity behavior.

## Compatibility

- Module version: **0.6.1 — in development, unreleased**.
- Foundry VTT: **v14**.
- D&D5e system: **6.0.5+**; tested with **6.0.6**, with no issues reported so far. Later versions need testing.
- No additional module dependencies are declared.

See [Module Compatibility and Test Setup](COMPATIBLE-MODULES.md) for the
Fragment of the Fallen test world's enabled modules and installed versions,
confirmed Dice So Nice and Automated Conditions integrations, and overlap notes.
An enabled module in that snapshot is not automatically a certified compatible
module; the document distinguishes specific test evidence from coexistence.

An active GM must be connected when spells create Regions. The module uses the
active GM's client to attach Region behaviors and track movement damage,
including for player casts. Normal activity triggers run on the connected
caster's client if they own the originating actor, falling back to the active GM;
players do not need GM permissions for this setup.

## Features

- Reckless Attack assistance splits the attack dialog's Advantage area into
  **Adv** and **Reckless** for owned attackers with that feature. Reckless applies
  the feature's configured effect and submits the Strength attack; the effect
  expires at the barbarian's next turn start. Subsequent Strength attacks and
  attacks against the Reckless creature recommend advantage, combining with
  Automated Conditions and opposing disadvantage. Ordinary Adv stays separate.
  Enable/disable this under **Weapon Mastery & Attack Properties**.
- Character Inventory and Spells Add Item buttons open the compendium browser on
  the matching tab. Spells preselect available lists for the character's classes;
  multiclass lists are combined and filters remain editable. Configure this under
  **Chat & Sheets → Open Compendium Browser from Add Item**. Supports Tidy 5e
  Sheets' Add Item buttons and matching native sheet controls.
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

### Module settings

These world-wide toggles are available under **Configure Settings → Region Spell
Automation**, enabled by default:

- Prompt for Save on Region Triggers
- Prompt for Save on Spells and Features
- Auto Target and Confirm Spell/Feature Regions
- Adjust Saving Throw Advantage
- Show Retarget on Spell/Feature Cards
- Remove Instantaneous Areas at Turn End
- Show End Concentration on Token HUD

Retarget, save-roll controls, and the concentration HUD refresh when toggled.
Disabling area cleanup stops automatic tracking/deletion; it does not remove
areas itself. Per-spell visibility and per-trigger shared-card/movement options
remain in the manager.

### Area targeting and confirmation

With **Auto Target and Confirm Spell/Feature Regions** enabled (default on),
placing a spell or Feature area selects visible actor tokens inside it and opens
**Confirm Targets**. Enemy/ally targeting is relative to the casting token's
disposition. A matching manager trigger's targeting mode is used when the card
does not specify enemies/allies; otherwise everyone in the area is selected.
Neutral creatures are not automatically enemies.

Target tokens normally on the map to add them, including manual choices outside
the automatic filter. Click a listed name to deselect and remove that token.
Confirming replaces the activity card's target list, prompts the affected owners
for saves if enabled, and opens the damage dialog if the activity has damage.
Region follow-up activities are excluded. No resources are consumed again.

**Close — Resolve Manually** closes the popup without undoing the cast or refunding
resources; the activity card remains available for manual resolution. Turn-end
area cleanup still runs normally, so finish confirming/resolving before ending
the caster's turn. Disable competing live targeting in Tweaks while using this
feature. Initial automatic selection happens after placement; it does not
continuously retarget while you move the mouse.

GMs can open the manager directly from **Compendiums → Open Region Spell
Manager**, beneath D&D5e's **Open Compendium Browser** button. The settings-menu
entry remains available.

Each spell has a single row with selection, name, Enable/Disable, Edit, and Delete.
Disabled spells show **(Disabled)** after their name. Click **Edit** to open a
separate configuration window for Activity Triggers, Hide Region from Players,
and Region Effects.

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

All Region activity events and automatic spell/Feature targeting exclude tokens
that are **hidden**, marked **dead/defeated**, or have numeric HP **0 or lower**.
This also applies to entries, movement, and start-turn triggers, not only end
turn. The confirmation list rejects excluded manual additions and rechecks
targets before confirming. Save prompts and Retarget use the same rule; shared
cards drop newly excluded targets when updated. Existing rolls and applied
damage are not undone. Native ongoing Region Effects keep their own system behavior.

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

### Adjust saving throw advantage after rolling

Enable **Adjust Saving Throw Advantage** in module settings (default on). Hover
over a completed saving throw, including an inline save summary on an activity
card, to show **ADV / NORMAL / DISADV**. The current mode is highlighted.
Turn the setting off to hide the controls; changing it refreshes the chat cards
without another world reload.

The original d20 and bonus dice are preserved. A missing extra d20 is rolled
once and cached; subsequent mode switches reuse the same results. If Dice So
Nice is installed, newly rolled extra dice animate with the save's original
whisper/blind visibility; cached mode switches do not animate a new roll. The save's
total and success/failure update, including its parent card and linked damage
card's save outcomes. Previously applied damage is not reversed. GMs, the roll
author, and the affected actor's owners can use the controls; the active GM
handles remote edits. If Tweaks already provides controls on that standalone
save, the module skips adding a duplicate set. Attack rolls are unchanged.

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

The runtime lives in `scripts/region-spell-automation.js`, cleanup in `scripts/concentration-cleanup.js`, and the manager in `scripts/spell-manager.js`. The module version is defined in `module.json`.

See [RELEASING.md](RELEASING.md) for packaging and the public-release checklist.

## License

Copyright (c) 2026 Ugmul. Released under the [MIT License](LICENSE).

### Region Conditions

In a configured spell or feature's **Edit** window, select standard conditions
under **Region Conditions**. New Regions apply these conditions to creatures
inside them and remove their own effects on exit or Region deletion. Separate
Regions and unrelated effects retain their own condition sources. Keep an active
GM connected. Changes apply to newly created Regions; recast to use new settings.
These conditions apply automatically without a saving throw.

The **Spell and Region Management** window accepts spells and Features, including
monster abilities such as a Pit Fiend's Fear Aura and player features. Use
**Add New Spell / Feature Region**, drop the ability Item, and configure its
triggers, conditions, and effects. The ability's activity must create a D&D5e
Region; the manager does not create an aura for abilities without a Region.

### Automatic Damage Dialogs

**Prompt Damage for Save Activities** opens the caster's native Damage dialog
for Save activities that include damage. Area casts wait for target confirmation.
Turn-only feature auras wait for their configured Region triggers.

**Prompt Damage after an Attack Hit** opens the attacker's native Damage dialog
only when the attack card reports a hit against a target. It waits for Dice So
Nice's animation to finish, retains critical-hit and weapon-mode options, and
uses the usage card's consumed resources and upcast scaling. No target or unknown
hit result means no automatic dialog; use the Damage button manually.

Both settings are enabled by default and can be disabled independently. Disable
competing automatic damage dialogs in other modules while testing. Restart the
Foundry server after installing this update to load the added script.

**Adjust Attack Roll Advantage** adds the same ADV / NORMAL / DISADV hover
controls to attack results on spell, weapon, and feature cards. It is independent
of **Adjust Saving Throw Advantage**. The original d20 and bonuses are retained;
only an additional required die is rolled and animated. Result summaries refresh,
but damage already rolled or applied is not reversed. Both menus use compact
buttons at 75% of the standard button height.

### Effect Automation

**Effect Automation: Automatically Apply Buffs** applies the configured activity
Effects when a non-rolling Utility spell or feature is used. Self activities use
the caster; Ally activities use the recorded targets. Creature-targeted activities
apply to the caster or tokens with the caster's disposition. An active GM handles
player casts on other actors; without a GM, users can apply only to owned actors.

The effect must already be configured on the activity. This does not invent a
Rage, Shield, Mage Armor, or Light effect. Native D&D5e application handles duration,
scaling, concentration dependencies, and refreshing existing effects. Attacks,
Save activities, damage/healing rolls, and Region activities are excluded.
Light cast on a plain map object without an actor is not automated.

Retarget also supports weapon and attack cards. After applying Shield or another
AC change, keep the intended creature targeted and click **Retarget** on the
activity card. Linked attack rolls receive current AC descriptors and recalculate
hit/miss results. Original dice and damage history remain unchanged; this does
not undo damage already applied or automatically reopen a damage dialog.

### Card Presentation

Attack actions and result borders are green, damage red, and saves blue.
**Simplify Processed Attack Cards** hides the base Attack and Damage buttons as
their rolls are created, leaves Retarget on the attack result, and hides the base
attack card once the attack roll exists. A Damage button beside Retarget on the
attack result opens the native damage dialog and hides once its linked damage roll exists. With inline summaries, only the base face is
hidden. No messages, dice, or damage history are deleted. Disable the setting to
show the complete base cards again.

**Adjust Damage Normal / Critical** adds NORMAL / CRITICAL controls when hovering
on a damage result. Switching to Normal preserves base dice and bonuses; Critical
adds and animates only the extra dice required. Switching again reuses cached
results. All damage parts on the message change mode together. Damage already
applied is not undone. The first implementation supports standard, unmodified
dice terms, including powerful critical (rolled dice plus their maximized bonus). Extra critical bonus formulas, modified dice, and
complex nested expressions require manual correction.

**Spell/Feature Region Placement Controls** snaps cone tips to square-grid
intersections while casting. Scroll rotates by 15 degrees; Shift-scroll uses
5 degrees; Ctrl-scroll zooms. Square templates can rotate during placement even
when the system's grid-aligned-square setting is enabled. Outside casting
placement, normal canvas controls remain in effect. Cone grid snapping is scoped
to square grids. Disable competing placement overrides in other modules if needed.

### Module Options

Open **Configure Settings → Region Spell Automation → Open Module Options**.
Options are grouped into Regions, Targeting, Rolls & Damage, Effects, and Chat.
Changes remain drafts while switching tabs; **Save Options** applies them and
**Cancel** leaves stored values unchanged. GMs manage world options; players can
change their client options. The Regions tab also opens the spell/feature manager.
The window uses existing settings, so previous selections carry over.

### Weapon Masteries

Enable **Effect Automation: Weapon Masteries** in **Module Options → Weapon Mastery & Attack Properties**.
An active GM is required. The actor must have the weapon's mastery unlocked in
D&D5e's native Weapon Mastery configuration, and the attack must use that mastery.

- **Sap:** applied on a hit to the victim; defaults its next attack to disadvantage.
- **Vex:** applied to the attacker only after damage is dealt, and defaults its
  next attack against that exact target to advantage. Attacking other creatures leaves Vex available. The matching attack consumes it, whether it hits or misses.
- **Sap/Vex:** attack-card buttons can apply/remove them for corrections. The user
  can change the next roll's mode. These effects are consumed when the relevant
  attack is rolled, not when its dialog is merely opened. Native source-turn expiry
  also applies: Sap at the source's next turn start, Vex at its next turn end.
- **Graze:** automatically creates a flat damage card after a missed attack's
  dice finish, using the attack's ability modifier and the weapon's damage type.
  Auto Apply Damage applies it through the native damage tray when enabled.
  Undo Damage restores HP, hides that Graze card, and makes the linked attack's
  Damage and Graze actions available again for retroactive corrections. The
  canceled card is retained as history and cannot apply damage again.
- **Slow:** automatically applies after damage is dealt; its button toggles a non-stacking
  10-foot speed reduction until the source's next turn starts.
- **Topple:** hit-only action prompts the defender's owner (GM for NPCs) for a
  Constitution save against 8 + attack ability modifier + proficiency. A failed
  save applies a source-tracked Prone effect. Save corrections and Legendary
  Resistance remove that source without removing unrelated Prone effects.

Retroactive hit-to-miss corrections remove this attack's own mastery effects.
Push, Nick, and Cleave remain manual. This does not add damage or movement
workflows for those properties. Disable competing mastery automation when testing.

### Undo Damage

After applying a damage card, GMs see **Undo Damage** in its action area. It
reverses this card's recorded HP, temporary HP, and temporary maximum HP changes,
clears its undo records, and reopens Apply. Multiple applications recorded on the
same card are reversed together. Original dice and other cards remain unchanged.
A connected GM is required to record player applications. Only applications made
after this feature loads are tracked; older damage cannot be reconstructed.

### GM NPC & Damage

The **GM NPC & Damage** options tab has independent settings for:

- **Automatically Roll GM NPC Saves:** prompted saves for NPCs with no player
  owners use native fast-forward rolls. Player-owned NPCs and PCs retain manual
  save prompts. Native D&D5e/Automated Conditions advantage and disadvantage
  calculation remains in use, including on Topple saves.
- **Auto Apply Damage and Healing:** applies for all casters and attackers,
  through the native damage tray. Save-based damage waits until every eligible
  recorded target has a success/failure result; mixed NPC/PC groups wait together.
  Attack damage applies only to confirmed hit targets. Graze and other non-save,
  non-attack damage use their recorded targets. Unidentified attack links remain
  manual. Each target is applied once, including shared Region cards gaining targets.
  Healing and temporary HP rolls also apply after visible client dice animations
  finish. Healing uses native HP caps, and temporary HP uses native replacement
  rather than stacking. Healing targeting retains unconscious creatures at 0 HP.
- **Magic Resistance Saving Throws:** recognizes a Magic Resistance feature by
  its name or standard identifier, even without an Active Effect. Saves against
  spells and features marked Magical recommend advantage. Ordinary nonmagical
  saves are unaffected. Automated Conditions receives this as an advantage source
  so opposing disadvantage still cancels it normally.
- **Auto Apply Saved Effects:** waits for every required save and visible dice
  animation. Failed saves receive the activity's assigned effects; successful
  saves receive only effects marked **On Save**. With automatic damage enabled,
  effects apply after damage; with it disabled, effects resolve independently.
  Saves with effects and no damage also work.
- **Autoapply Status on Hit:** applies the attack activity's assigned effects
  only to hit targets after dice animations finish. Misses receive no effects.
  This option works independently of automatic damage.

Automatic effects use native application for duration, concentration, and scaling.
Completed trays collapse, and card refreshes do not
duplicate applications. Browsing old chat history does not apply old conditions.

Matching active effects already on a target are left unchanged by card automation.
Applicable native region effects take priority, including while their application
is pending. This prevents Spirit Guardians' region speed reduction from being
applied again by its save card. Region effects and conditions use the manager's
trigger targeting relative to the caster; Hostiles Only excludes creatures with
the caster's disposition. When multiple triggers use different filters, region
effects cover the combined eligible groups. Existing region filters refresh when
the scene loads.

The GM's **Undo Effect** button appears beside **Undo Damage** after automatic
effects apply. It removes effects created by that card or restores the previous
state of an effect that was refreshed, without undoing HP changes. Applications
superseded by a later cast are preserved. Undo clears its history and reopens the
source card's effect tray for manual use. Effects-only activities show the button
on their source card. This records new automatic applications after the update.
Healing cards show **Undo Healing** for the GM. It reverses actual HP or temporary
HP changes, hides its button, and reopens the native Apply tray. Manual reapplication
records fresh undo entries for the recipients actually applied to, including newly
selected recipients after retargeting. A completed manual Apply always restores
the Undo action, even when HP caps prevent any change. Later damage and stronger temporary HP grants are
preserved using the same delta rules as Undo Damage. Native healing dialogs share
the damage dialog's remembered position; the module does not open a duplicate.
Using Apply Effect after an undo records the new application and brings Undo
Effect back, including when a player-owned target receives the manual application.
The first manual application is also tracked, including after a retroactive save
correction makes an effect applicable for the first time.

An active GM is required for automatic application. Native save multipliers,
resistance, vulnerability, immunity, and damage Undo tracking remain available.
Clicking, changing, or right-clicking controls on the relevant chat cards stops
that activity's automatic damage workflow. Manual damage application also stops it.
Save/damage dialog submission itself does not count as manual card interaction.
After takeover, use the card normally; the workflow does not automatically resume.
Previously applied damage is not reversed by a later save correction.
