# Region Spell Automation

**Version 0.5.5 · Foundry VTT v14 · D&D5e 6.0.5+**

A private-use module for connecting D&D5e spell Regions to spell activities and native Region Active Effects. Configure a spell once, then have its newly created Regions run the appropriate activity when a token enters, starts its turn, or ends its turn in the area.

The module provides the event wiring. The spell item's activities still define its saves, damage, and other activity behavior.

## Compatibility

- Developed and confirmed working in the conversation with **Foundry VTT v14 and D&D5e 6.0.5**.
- D&D5e **6.0.5+** is the intended system requirement; later releases should be checked before using them in a live game.
- Requires D&D5e's spell Region support. A drawn area without the originating spell metadata is not enough for activity automation.
- Intended for a private world. No public installation manifest or automatic update service is assumed.

## Installation and current file layout

Place the module folder in your Foundry user data directory:

```text
Data/
└── modules/
    └── region-spell-automation/
        ├── module.json
        ├── README.md
        └── scripts/
            ├── region-spell-automation.js
            ├── concentration-cleanup.js
            └── spell-manager.js
```

The manifest should use the ID `region-spell-automation`, version `0.5.5`, and load these scripts through `esmodules`:

```json
"esmodules": [
  "scripts/region-spell-automation.js",
  "scripts/concentration-cleanup.js",
  "scripts/spell-manager.js"
]
```

Restart Foundry if needed to discover the module, enable **Region Spell Automation** in the world's module management, and reload the world.

When updating from v0.5.4 to v0.5.5, replace `scripts/region-spell-automation.js` and bump the manifest version. The v0.5.4 `spell-manager.js` stays in use; this update does not require a manager change.

## Features

- Multiple activity triggers for each spell.
- Multiple Region events on a single trigger.
- A separate targeting mode for each trigger.
- Optional **Once Per Turn** limiting for each trigger.
- Native D&D5e Region Active Effects, alongside activity triggers or on their own.
- A delayed-attachment workaround for entry events during Region creation.
- Activity execution using the originating spell and its stored cast level.
- Temporary targeting of the affected token, followed by restoration of the user's previous targets.
- Follow-up activities run without consuming resources again, beginning concentration again, or creating another measured template.
- A separate concentration cleanup script.
- End-turn activity triggers automatically skip tokens at 0 HP, marked dead, or marked defeated.

## Setup and use

1. Prepare the spell on the caster's actor. Its casting activity must create the D&D5e Region used for the area.
2. Prepare any follow-up activities on that same spell item, such as a recurring save/damage activity or separate start-turn and end-turn damage activities.
3. Open the module's spell manager and add or edit the spell configuration. Use the spell's **exact item name**; the runtime looks up configurations by name.
4. Enable the spell configuration. Add each trigger with a descriptive name, the exact activity name, one or more events, a targeting mode, and the desired Once Per Turn setting.
5. Configure Region Effects separately if the spell needs an ongoing effect while creatures occupy its area.
6. Save, then cast the spell normally and place its area. The module attaches the configured behaviors to Regions produced by that cast.
7. Test entry, turn timing, leaving the area, and ending concentration before using the configuration at the table.

Use a fresh cast after changing trigger events or Region Effects. Runtime activity handling reads the current spell configuration, but the behaviors attached to an existing Region were created when that Region was made.

## Trigger events

| Event | Runtime name | Practical use |
| --- | --- | --- |
| Token enters | `tokenEnter` | Run an activity when Foundry reports a token entering the Region. Useful for entry saves or damage. |
| Start of turn | `tokenTurnStart` | Run an activity for a token whose turn starts inside the Region. Requires combat turn progression. |
| End of turn | `tokenTurnEnd` | Run an activity for a token whose turn ends inside the Region. Includes the v0.5.5 dead/defeated check. |

Events on one trigger all invoke the same activity and share that trigger's Once Per Turn allowance. Use separate triggers when the activities or timing rules differ.

Entry follows Foundry's Region event handling. Do not assume that casting an area over a stationary token, moving an area over a token, and moving a token into an area always produce identical events. Test the placement and movement patterns you actually use. The entry workaround addresses attachment timing; it is not a complete implementation of every spell's movement wording.

### Targeting

Activity targeting compares token dispositions relative to the caster:

| Mode | Behavior |
| --- | --- |
| Everyone | Allows any triggering token, including the caster. |
| Exclude Friendlies | Excludes the caster and tokens with the caster's disposition. |
| Friendlies Only | Allows tokens with the caster's disposition, including the caster. |
| Hostiles Only | Excludes the caster and allows tokens with a different disposition. |

These are disposition comparisons, not a list of creatures chosen by the caster. A different disposition can include neutral creatures. In the current runtime, Exclude Friendlies and Hostiles Only produce the same result when the caster resolves successfully.

If the caster token cannot be resolved, Everyone and Exclude Friendlies allow the event; Friendlies Only and Hostiles Only reject it. Keep the caster token and the Region's origin link intact.

## Once Per Turn

Enable this when several events on one trigger should produce only one activity use against a given token during the **current combat turn**.

For example, a token entering, leaving, and re-entering the same area during one combat turn can be limited to one use. When combat advances to the next turn, that token can qualify again—even if it is another creature's turn.

The recorded key consists of:

```text
combat ID + round + turn + target token ID + trigger ID
```

- It is **per trigger and per token**, not one shared allowance for the entire spell.
- Events on the same trigger share an allowance. Separate triggers have separate allowances.
- It means once per combat turn, not once per round or only on the affected creature's own turn.
- Without usable combat, round, and turn information, no limiter key is generated. Entry activities can therefore repeat outside combat.
- The key does not include the Region ID or caster ID. Multiple Regions using the same trigger ID share the allowance for that target and turn.
- History is held in client memory and cleared when a combat is deleted. Reloading clears that client's history; it is not persistent world state.
- The runtime records the allowance before calling the activity. A thrown error removes the entry so another attempt can run; a canceled activity that returns normally may still spend the allowance.
- Rewinding to a previously visited round and turn can encounter an already recorded allowance.

## Region Effects

Region Effects use native D&D5e Region Active Effect behavior for ongoing effects associated with occupying an area. They serve a different purpose from activity triggers: a trigger runs a spell activity at an event, while a Region Effect supplies an ongoing effect through the system's Region mechanism.

A spell configuration can contain triggers, Region Effects, or both. An effect-only configuration is useful for an area whose main purpose is a condition or movement modifier.

Prepare the desired effects on the spell and configure them through the manager. Check their application on entry and removal on exit or Region deletion. Do not assume the activity trigger's targeting or Once Per Turn setting also filters native Region Effects; verify the effect's own behavior.

Movement modifiers and conditions depend on the actual effect data and D&D5e support. Adding an effect does not automatically implement visibility, path measurement, or every rule associated with a spell.

## Concentration cleanup

`concentration-cleanup.js` is the separate cleanup component for spell areas associated with concentration. The intended workflow is that ending concentration removes the associated spell area, allowing its Region behaviors and native area effects to end with it.

Keep the system-created links between the caster, originating item, concentration, and area intact. During setup, cast a concentration spell, end concentration, and confirm that its Region disappears and affected tokens lose the corresponding area effects.

If cleanup fails, inspect those links and remove the stale area manually. Do not rely on concentration cleanup as a general duration timer for non-concentration spells.

## Dead or defeated end-turn skip

Version 0.5.5 skips an activity when the event is `tokenTurnEnd` and any of these checks succeeds:

- The token's actor has a numeric HP value of **0 or less**.
- The actor has the D&D5e **`dead`** status.
- A matching token combatant in the current combat is marked **Defeated**.

This is automatic runtime behavior, with no manager checkbox. It prevents unnecessary end-turn save or damage cards after a creature has fallen.

The check applies only to end-turn activity triggers. Entry and start-turn activities are not covered by this skip, and it does not remove the token's existing Region Effects. A token at 0 HP is skipped even if it is unconscious rather than dead.

## Example configurations

These are setup patterns, not built-in spell presets or a promise of complete rules automation. Match the activities, events, and effects to the spell version used in your world.

### Spirit Guardians

Create a recurring save/damage activity on the spell. Connect the relevant entry and turn events to that activity, and enable Once Per Turn when those events should share one use per target per combat turn.

Use **Exclude Friendlies** if token dispositions are an acceptable approximation of the creatures the caster exempts. Add a Region Effect for the intended movement reduction if your effect setup supports it.

Check the spell's wording before choosing start-turn versus end-turn timing. Test aura movement and casting over existing tokens separately. Disposition filtering does not reproduce individually chosen exemptions.

### Hunger of Hadar

Use two activities and two triggers:

| Trigger | Activity | Event | Targeting |
| --- | --- | --- | --- |
| Start-turn cold | The spell's cold-damage activity | Start of turn | Everyone |
| End-turn acid | The spell's save/acid-damage activity | End of turn | Everyone |

Separate triggers preserve the different damage and save behavior. Add appropriate native Region Effects for the conditions or movement changes you want to track, and handle any remaining darkness or visibility rules separately.

In v0.5.5, the end-turn acid activity skips creatures at 0 HP, dead, or defeated. The start-turn activity does not use that skip.

### Grease — simplified

Use an entry or turn trigger for the spell's save/prone activity, choosing timing to match your spell text. Use a Region Effect for difficult terrain if supported by your setup.

Treat any immediate save when the spell is cast over creatures as a separate case to verify. Region entry alone should not be assumed to cover it.

### Fog Cloud — simplified

An effect-only configuration can provide the condition or reminder your table uses while tokens occupy the cloud. Activity triggers are optional.

Manage obscuration and vision with your scene/system tools and table rulings. A condition icon alone does not establish correct line of sight through the cloud.

### Spike Growth — simplified

Use a Region Effect for difficult terrain or an area reminder. If desired, use an entry activity as a deliberately simplified damage approximation.

The documented trigger model does not measure distance traveled inside the area or apply damage for every movement increment. Track that damage manually when accurate distance-based resolution matters. An entry trigger with Once Per Turn is an approximation, not full Spike Growth automation.

## Limitations and notes

- Spell configuration is world-scoped and keyed by exact spell name. Same-name items share the configuration; renaming a spell can break the lookup.
- Follow-up activities are found by exact name on the originating spell. Keep names stable and unambiguous.
- The runtime needs the Region's D&D5e item link and a rendered token on the canvas. Arbitrary drawn Regions and off-canvas tokens are not covered by the shown activity handler.
- Activity use still follows the system's activity workflow. This module does not guarantee that all saves, damage application, or conditions resolve without user interaction.
- The cast level comes from the Region's stored spell level, falling back to the item's base level. The follow-up activity must itself support the intended scaling.
- The limiter is client-local. Multi-client execution and simultaneous activity behavior should be tested with your actual module stack; Once Per Turn is not a cross-client lock.
- Do not assume existing Regions automatically gain new behaviors after a configuration change. Recast for a clean test.
- Private-use compatibility claims here reflect the conversation, not a separate test of the installed module files.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Module does not appear | Confirm the folder and manifest location, valid manifest JSON, and the exact module ID. Restart Foundry. |
| No activity runs | Check that the module and spell configuration are enabled, the spell name matches, a D&D5e Region was created, and the desired events were attached. Test a fresh cast. |
| “Activity not found” warning | Match the configured activity name exactly to an activity on the originating caster's spell item. |
| Entry behaves inconsistently | Test actual token movement across the boundary, then placement over stationary tokens separately. Check that the Region behaviors were attached. |
| Start/end-turn events do not run | Use an active combat and advance the tracker. Confirm the token occupies the Region and passes targeting. |
| End-turn activity stops for a creature | Check HP, the `dead` status, and the combatant's Defeated flag. This is expected in v0.5.5. |
| A neutral token is affected | Targeting compares dispositions; a disposition different from the caster's passes Hostiles Only. |
| Repeated entry activities outside combat | Once Per Turn needs combat turn information and does not limit ordinary out-of-combat entry. |
| An expected activity is blocked | Check whether another event or Region with the same trigger ID already used the allowance this turn. Also consider turn rewinding or a canceled activity. |
| Duplicate cards appear | Inspect duplicate triggers or behaviors, other automation modules, and which connected clients execute the behavior. |
| Effect does not apply or clear | Inspect the spell's effect data and native Region effect behavior. Test entry, exit, and Region deletion. |
| Area remains after concentration ends | Check the cleanup script and concentration/origin links; remove the stale Region manually if needed. |
| Upcast damage is wrong | Check the Region's stored cast level and scaling on the follow-up activity. |

For runtime failures, open the browser developer console with **F12** and look for messages beginning with `Region Spell Automation |`. Useful messages identify missing originating items, missing activities, targeting issues, Once Per Turn blocks, and skipped end-turn events.

## Documentation basis

This README describes v0.5.5 from the available **Foundry Region Spell Effects** conversation, including the confirmed end-turn update and the shown runtime code. The referenced module layout contains the three scripts above. The full manager, cleanup script, and final Region Effect attachment code were not available in the retrieved excerpt, so their exact UI labels and cleanup implementation should be checked against the installed files.
