# Starting Spell List

These configuration recipes are based on **Ugmul's Foundry Player's Handbook
spell setup**, exported from the working module configuration on October 7,
2026. They include activity/effect names and automation settings only. They do
not contain or grant access to Player's Handbook spell text, activities, effect
data, artwork, or compendiums. The precise handbook edition was not recorded in
the saved settings; verify timing against your installed spell version.

## Load and use

1. Open **Manage Region Spells** and click **Add Starting Spell List**.
2. Missing spells are added disabled; existing spell configurations are preserved.
3. Have the corresponding spell on an actor in your world. The casting activity
   must create its D&D5e Region.
4. Review trigger activities and effects against the spell item. Names must match
   exactly; edit triggers if your activities have different names.
5. Enable each reviewed spell and test a fresh cast.

The module does not create or modify spell items. The handbook package alone may
not reproduce Ugmul's customized activity names or effect setup. Prepare missing
activities/effects on your own items. Enable only the recipes you have checked.

| Spell | Activity triggers | Targeting | Additional setup |
| --- | --- | --- | --- |
| Hunger of Hadar | `Start of Turn Damage` on turn start; `End of Turn Save` on turn end | Everyone | Existing spell effect named `Hunger of Hadar` |
| Spirit Guardians | `Cast and Save` on entry and turn end | Hostiles Only | Once Per Turn and Shared Activity Card enabled |
| Grease | `Save` on entry and turn end | Everyone | No Region Effect in the saved configuration |
| Spike Growth | `Damage`, accumulated movement damage | Everyone | 5 scene units per increment; prepare a Damage activity with 2d4 piercing on a feet-based scene |
| Fog Cloud | `Use` on entry | Everyone | Existing spell effect named `Fog Cloud` |
| Conjure Animals | `Save` on entry and turn end | Hostiles Only | Once Per Turn enabled |

Recipes preserve the saved timing and targeting, rather than claiming complete
rules automation. Hostiles Only compares dispositions, including neutral tokens
with a different disposition. Native Region Effects do not inherit trigger
targeting. Vision and obscuration still require the appropriate scene/system
setup. Spike Growth uses the module's simplified whole-step movement model.

For portable recipes, Region Effects are resolved by exact name on the **actual
caster's originating spell item** when its Region is created. No source-world
actor/item/effect UUIDs are bundled. Manually chosen effects in existing
configurations continue to use their stored UUIDs.
