import assert from "node:assert/strict";
const { STARTER_SPELLS, addStartingSpells, resolveRegionEffect } =
    await import(`data:text/javascript;base64,${process.env.RSA_STARTER_SOURCE}`);
let next = 0;
const randomID = () => `generated${++next}`;
const original = { "Spirit Guardians": { enabled: true, triggers: [{id:"custom",activity:"My Activity"}] } };
const { table, added } = addStartingSpells(original, randomID);
assert.equal(Object.keys(STARTER_SPELLS).length, 6);
assert.equal(added.length, 5);
assert.deepEqual(table["Spirit Guardians"], original["Spirit Guardians"]);
assert.equal(Object.keys(original).length, 1);
assert.ok(added.every(name => table[name].enabled === false));
const ids = added.flatMap(name => [...table[name].triggers, ...table[name].regionEffects].map(entry => entry.id));
assert.equal(new Set(ids).size, ids.length);
assert.equal(addStartingSpells(table, randomID).added.length, 0);
for (const name of added) {
    assert.equal(table[name].sourceUuid, undefined);
    assert.ok(table[name].regionEffects.every(effect => !effect.effectUuid));
}
const ownEffect = {name:"Fog Cloud",uuid:"Actor.caster.Item.spell.ActiveEffect.cloud"};
const item = { effects: [ownEffect] };
const rejectUUID = async () => { throw new Error("Starter should not resolve another world's UUID"); };
assert.equal(await resolveRegionEffect({effectName:"Fog Cloud"},item,rejectUUID), ownEffect);
assert.equal(await resolveRegionEffect({effectName:"Missing"},item,rejectUUID), null);
assert.equal(await resolveRegionEffect({effectUuid:"existing"},item,async uuid => uuid), "existing");
console.log("Starter spell checks passed: six recipes, preserving existing settings, disabled imports, fresh IDs, idempotence, portable effect resolution.");
