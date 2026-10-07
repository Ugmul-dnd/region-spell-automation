import assert from "node:assert/strict";

const testLog = console.log.bind(console);
const reportedErrors = [];
console.log = () => {};
console.warn = () => {};
console.error = (...args) => reportedErrors.push(args);

const sourceURL = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const sharedSource = Buffer.from(process.env.RSA_SHARED_SOURCE, "base64").toString();
const helpers = await import(sourceURL(sharedSource));
const hooks = new Map();
globalThis.Hooks = {
    once(name, callback) { hooks.set(name, callback); },
    on(name, callback) { hooks.set(name, callback); }
};
const targets = new Set();
const trigger = {
    id: "entry", name: "Entry", activity: "Damage", events: ["tokenEnter"],
    targeting: "everyone", oncePerTurn: true, shareCardPerTurn: true
};
const combat = { id: "combat", round: 1, turn: 0 };
const messages = new Map();
globalThis.game = {
    combat, messages, user: { targets },
    settings: { get: () => ({ "Spirit Guardians": { triggers: [trigger] } }) }
};
globalThis.ui = { notifications: { warn() {}, error() {} } };
let uses = 0;
let canceled = false;
let throws = false;
const activity = {
    name: "Damage",
    async use(usage, dialog, messageConfig) {
        uses++;
        await Promise.resolve();
        if (throws) throw new Error("Simulated activity failure");
        if (canceled) return;
        const message = makeMessage(`card${uses}`, messageConfig.data?.system.targets ??
            [...targets].map(t => helpers.describeTarget(t.document)));
        message.flags = messageConfig.data?.flags ?? {};
        messages.set(message.id, message);
        return { message };
    }
};
const spell = { uuid: "Actor.caster.Item.spell", name: "Spirit Guardians",
    system: { level: 3, activities: [activity] } };
const region = { uuid: "Scene.scene.Region.area", flags: { dnd5e: { item: spell.uuid } } };
globalThis.fromUuid = async () => spell;
function token(id) {
    const doc = { id, uuid: `Scene.scene.Token.${id}`, name: id,
        actor: { uuid: `Actor.${id}`, statuses: new Set(), system: { attributes: { hp: { value: 10 } } } },
        texture: { src: "token.webp" } };
    doc.object = { id, name: id, document: doc, setTarget(enabled, options) {
        if (options.releaseOthers) targets.clear();
        if (enabled) targets.add(this); else targets.delete(this);
    } };
    return doc;
}
function makeMessage(id, descriptors) {
    return { id, system: { targets: descriptors }, damage: [],
        getAssociatedRolls: function() { return this.damage; },
        async update(data) { this.system.targets = data["system.targets"]; },
        getFlag(namespace, key) { return this.flags?.[namespace]?.[key]; }
    };
}
let runtimeSource = Buffer.from(process.env.RSA_RUNTIME_SOURCE, "base64").toString();
runtimeSource = runtimeSource.replace('"./shared-activity-card.js"', JSON.stringify(sourceURL(sharedSource)));
const movementSource = Buffer.from(process.env.RSA_MOVEMENT_SOURCE, "base64").toString()
    .replace('"./shared-activity-card.js"', JSON.stringify(sourceURL(sharedSource)));
runtimeSource = runtimeSource.replace('"./movement-damage.js"', JSON.stringify(sourceURL(movementSource)));
runtimeSource = runtimeSource.replace('"./starter-spells.js"', JSON.stringify(`data:text/javascript;base64,${process.env.RSA_STARTER_SOURCE}`));
await import(sourceURL(runtimeSource));
hooks.get("ready")();
const handle = globalThis.RegionSpellAutomation.handleRegionEvent;
const enter = (target, area = region) => handle({ region: area, triggerId: trigger.id,
    event: { name: "tokenEnter", data: { token: target } } });
const a = token("a"), b = token("b"), c = token("c");
const previous = token("previous").object;
targets.add(previous);

// Concurrent entries create only one activity, retain both targets, and restore targeting.
await Promise.all([enter(a), enter(b)]);
assert.equal(uses, 1);
assert.deepEqual(messages.get("card1").system.targets.map(t => t.token), [a.uuid, b.uuid]);
assert.deepEqual([...targets], [previous]);
await enter(a);
assert.equal(uses, 1);

// New entries update already-rolled damage without changing the roll or outcomes.
const damage = makeMessage("damage", [...messages.get("card1").system.targets]);
damage.rolls = [{ total: 17 }];
messages.get("card1").damage.push(damage);
await enter(c);
assert.equal(uses, 1);
assert.equal(damage.system.targets.length, 3);
assert.equal(damage.rolls[0].total, 17);

// A delayed damage dialog captures the current target list when its message is created.
const delayed = { type: "damage", system: { origin: messages.get("card1"), targets: [] },
    updateSource(data) { this.system.targets = data["system.targets"]; } };
hooks.get("preCreateChatMessage")(delayed);
assert.equal(delayed.system.targets.length, 3);

// A new turn starts a fresh card, and separate Regions do not share cards.
combat.turn++;
await enter(a);
assert.equal(uses, 2);
await enter(b, { ...region, uuid: "Scene.scene.Region.other" });
assert.equal(uses, 3);

// Disabled sharing preserves one activity per new target; no combat also falls back.
trigger.shareCardPerTurn = false;
combat.turn++;
await Promise.all([enter(a), enter(b)]);
assert.equal(uses, 5);
trigger.shareCardPerTurn = true;
game.combat = null;
await Promise.all([enter(a), enter(b)]);
assert.equal(uses, 7);

// Canceling a shared activity does not spend the target's allowance.
game.combat = combat;
combat.turn++;
canceled = true;
await enter(a);
canceled = false;
await enter(a);
assert.equal(uses, 9);
assert.ok(messages.has("card9"));

// An activity exception also releases the allowance and restores previous targets.
combat.turn++;
throws = true;
await enter(a);
assert.deepEqual([...targets], [previous]);
throws = false;
await enter(a);
assert.equal(uses, 11);

// Events queued before turn progression retain their original turn keys.
combat.turn++;
const pendingA = enter(a);
const pendingB = enter(b);
combat.turn++;
await Promise.all([pendingA, pendingB]);
assert.equal(uses, 12);
assert.equal(messages.get("card12").system.targets.length, 2);
await enter(a);
assert.equal(uses, 13);

// Failed target updates do not mark that new creature as handled, allowing retry.
const currentCard = messages.get("card13");
const originalUpdate = currentCard.update;
currentCard.update = async () => { throw new Error("Simulated update failure"); };
await enter(b);
currentCard.update = originalUpdate;
await enter(b);
assert.equal(uses, 13);
assert.equal(currentCard.system.targets.length, 2);

// A queue failure does not poison subsequent events.
const queue = helpers.createEventQueue();
await assert.rejects(queue(() => { throw new Error("expected"); }));
assert.equal(await queue(() => 42), 42);

// Turn keys distinguish spell owners and no-turn conditions.
assert.notEqual(helpers.getSharedCardKey(trigger, spell, region, {}, combat),
    helpers.getSharedCardKey(trigger, { ...spell, uuid: "Actor.other.Item.spell" }, region, {}, combat));
assert.equal(helpers.getSharedCardKey(trigger, spell, region, {}, null), null);
assert.equal(reportedErrors.length, 2, "Only the two deliberately simulated failures should be reported.");

// A normal cast's card is reused for newly encountered creatures on its first
// turn, even though its activity.use was not invoked by the Region handler.
combat.turn++;
const initialCard = makeMessage("initial-cast", [helpers.describeTarget(a)]);
initialCard.flags = {};
const updateInitial = initialCard.update;
initialCard.update = async data => {
    if (data["system.targets"]) await updateInitial.call(initialCard, data);
    if (data["flags.region-spell-automation.sharedCardPerTurn"]) {
        initialCard.flags["region-spell-automation"] = { sharedCardPerTurn: true };
    }
};
const initialDamage = makeMessage("initial-damage", [helpers.describeTarget(a)]);
initialDamage.rolls = [{ total: 19 }];
initialCard.damage = [initialDamage];
messages.set(initialCard.id, initialCard);
activity.item = spell;
const defaultFromUuid = globalThis.fromUuid;
globalThis.fromUuid = async uuid => uuid === a.uuid ? a : defaultFromUuid(uuid);
hooks.get("dnd5e.postUseActivity")(activity, {}, { message: initialCard, templates: [region] });
const usesBeforeEntry = uses;
await enter(b);
assert.equal(uses, usesBeforeEntry, "First-turn movement must reuse the initial cast card");
assert.equal(initialCard.system.targets.length, 2);
assert.equal(initialDamage.system.targets.length, 2);
assert.equal(initialDamage.rolls[0].total, 19);
await enter(a);
assert.equal(uses, usesBeforeEntry, "An initial target must not trigger another activity");
combat.turn++;
await enter(c);
assert.equal(uses, usesBeforeEntry + 1, "The next turn still creates a new card");
assert.equal(reportedErrors.length, 2);
testLog("Initial-cast checks passed: existing card/damage reuse, initial targets limited, fresh card next turn.");
testLog("Shared-card checks passed: concurrency, targets, damage preservation, turns, isolation, fallback, cancellation, failed-update retry, target restoration, queue recovery.");
