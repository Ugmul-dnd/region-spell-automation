# Ugmuls 5.5e Automation v0.7.2 — Battle Master Update

Battle Master maneuvers now join the existing attack and damage workflow, with Superiority Die consumption, saving throws, conditions, and Relentless support.

## Battle Master

- Precision Attack adds the current Superiority Die to an existing missed attack, preserving the original d20. Undo applied damage before adjusting the attack.
- Trip Attack adds damage and prompts a Strength save for Large or smaller targets. Failure uses the native Prone condition, recognized by standard condition controls and Automated Conditions 5e.
- Distracting Strike adds damage and grants advantage to the next attacker other than the Fighter, then clears its effect.
- Menacing Attack adds damage and prompts a Wisdom save. Failure applies native Frightened linked to the Fighter until the end of their next turn.
- Goading Attack adds damage and prompts a Wisdom save. Failure causes disadvantage against creatures other than the Fighter until the end of the Fighter’s next turn. Advantage and disadvantage cancel normally.
- Maneuvering Attack adds damage and a reminder tag. Ally selection, reaction use, and movement remain manual.
- Pushing Attack adds damage and prompts a Strength save for Large or smaller targets. A reminder tag leaves movement to the GM.
- Maneuvers use the configured current Superiority Die, including d10/d12 progression, support critical damage, and share a one-maneuver-per-attack limit.
- Relentless adds a Superiority Die dropdown beneath Maneuver. Spend the current die by default, or choose a free d8 once per active combat turn. An empty normal pool defaults to the free d8 when available. Precision Attack shares the same free-use limit; canceling does not consume it.
- Fighter automation settings allow individual maneuvers and Relentless to be enabled or disabled. Applicable effects retain Apply/Undo controls.

## Great Weapon feats

- Great Weapon Fighting treats damage dice of 1 or 2 as 3 on qualifying two-handed melee weapon attacks, including attached riders and Savage Attacker pools.
- Great Weapon Master offers proficiency-bonus damage on Heavy-weapon hits made with the Attack action on your turn. Bonus-action and reaction attacks are excluded; Hew remains manual.
- Both settings are under Automations → Feats.

## Fixes and presentation

- Weapon and rider damage dice animate together in one Dice So Nice throw when resolving pending damage.
- Damage cards show Goading, Maneuvering, Pushing, and Relentless tags with reminder tooltips.
- Goading effects participate in native turn-end expiry tracking; existing effects are repaired when the active GM reloads.
- Great Weapon Fighting previews handle native die methods and nested dice pools correctly, and retain their minimum through critical-hit adjustments.
- The Relentless die selector can be changed before selecting a maneuver.

Hard-refresh GM and player clients after updating.
