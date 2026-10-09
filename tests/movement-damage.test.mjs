import assert from "node:assert/strict";
const sourceURL = s => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const shared = Buffer.from(process.env.RSA_SHARED_SOURCE, "base64").toString();
const source = Buffer.from(process.env.RSA_MOVEMENT_SOURCE, "base64").toString()
    .replace('"./shared-activity-card.js"', JSON.stringify(sourceURL(shared)));
const helpers = await import(sourceURL(source));
const hooks = new Map();
globalThis.Hooks = { on: (name, fn) => hooks.set(name, fn) };
globalThis.foundry = { utils: { escapeHTML: value => String(value).replaceAll("<", "&lt;"), deepClone: structuredClone } };
globalThis.CONFIG = { Token: { movement: { actions: { walk: {}, teleport: { teleport: true } } } } };
globalThis.CONST = { REGION_MOVEMENT_SEGMENTS: { MOVE: 0 } };
const messages = [];
globalThis.game = { messages, user: {id:"gm",isGM:true} };
globalThis.ChatMessage = { getSpeaker: () => ({}), async create(data) {
    const card = { ...data, isOwner: true,
        getFlag: (namespace, key) => card.flags[namespace]?.[key],
        async update(update) {
            if (update.content) card.content = update.content;
            const flag = update["flags.region-spell-automation.movementDamage"];
            if (flag) card.flags["region-spell-automation"].movementDamage = flag;
        }
    };
    messages.push(card);
    return card;
} };
let segments = [];
const token = { uuid: "Scene.scene.Token.a", name: "Creature", parent: { grid: { units: "ft" } },
    actor: { uuid: "Actor.a", statuses: new Set(), system: {} },
    segmentizeRegionMovementPath: () => segments,
    measureMovementPath: ([a,b]) => ({ distance: Math.abs(b.x - a.x), cost: Math.abs(b.x - a.x) * 2 })
};
let canceled = false, rollCount = 0, rolledFormula;
const activity = { id: "damage", type: "damage", async rollDamage(config, dialog, message) {
    if (canceled) return [];
    assert.equal(dialog.configure, false);
    assert.equal(message.data.system.targets[0].token, token.uuid);
    const roll = { parts: ["2d4"] };
    hooks.get("dnd5e.postBuildDamageRollConfig")(config, roll);
    hooks.get("dnd5e.postBuildDamageRollConfig")(config, roll);
    rolledFormula = roll.parts[0];
    rollCount++;
    return [{ total: 17 }];
} };
const spell = { uuid: "Actor.caster.Item.spell", name: "Spike Growth", system: { level: 2,
    activities: new Map([[activity.id, activity]]) } };
globalThis.fromUuid = async () => spell;
helpers.registerMovementDamageHooks(fn => fn());
const region = { uuid: "Scene.scene.Region.area", flags: {} };
const trigger = { id: "movement", movementIncrement: 5 };
const event = { data: { token, round: 1, turn: 0, combat: { id: "combat" } } };
function movement(distance, id, action="walk") {
    event.data.movement = { id, origin: { x: 0 }, passed: { waypoints: [{ x: distance, action }] } };
    segments = [{ type: 0, from: { x: 0 }, to: { x: distance }, action }];
}
const record = () => helpers.recordMovementDamage({ trigger, spell, region, event, activity });
assert.equal(helpers.repeatDamageFormula("2d4", 3), "6d4");
assert.equal(helpers.repeatDamageFormula("2d4 + 1", 3), "(2d4 + 1) + (2d4 + 1) + (2d4 + 1)");
movement(5, "one"); await record();
movement(5, "two"); await record();
movement(5, "three"); await record();
const card = messages[0];
const data = () => card.getFlag("region-spell-automation", "movementDamage");
assert.equal(messages.length, 1);
assert.equal(data().distance, 15);
assert.equal(helpers.pendingSteps(data()), 3);
await record(); // The same operation reported by movement-out/within must not double count.
assert.equal(data().distance, 15);
await helpers.rollPendingMovementDamage(card);
assert.equal(rolledFormula, "6d4");
assert.equal(data().rolledSteps, 3);
await helpers.rollPendingMovementDamage(card);
assert.equal(rollCount, 1);

// Partial boundary steps count as whole squares; only unrolled steps roll again.
movement(2, "four"); await record();
movement(3, "five"); await record();
assert.equal(helpers.pendingSteps(data()), 2);
canceled = true; await helpers.rollPendingMovementDamage(card);
assert.equal(helpers.pendingSteps(data()), 2);
canceled = false; await helpers.rollPendingMovementDamage(card);
assert.equal(rolledFormula, "4d4");
assert.equal(data().rolledSteps, 5);

// Teleports and boundary/outside segments are excluded; terrain costs are irrelevant.
movement(20, "teleport", "teleport"); await record();
assert.equal(data().distance, 25);
movement(40, "clipped");
segments = [{type: 1, from:{x:0},to:{x:10},action:"walk"},
    {type:0,from:{x:10},to:{x:20},action:"walk"},
    {type:-1,from:{x:20},to:{x:40},action:"walk"}];
await record();
assert.equal(data().distance, 30);
event.data.turn++;
movement(15, "new-turn"); await record();
assert.equal(messages.length, 2);
assert.equal(helpers.pendingSteps(messages[1].getFlag("region-spell-automation", "movementDamage")), 3);
card.isOwner = false;
await helpers.rollPendingMovementDamage(card);
assert.equal(rollCount, 2);
const runtimeLog = console.log.bind(console);
console.log = () => {};
globalThis.Hooks.once = (name, fn) => hooks.set(name, fn);
globalThis.ui = { notifications: { warn() {}, error(message) { throw new Error(message); } } };
game.combat = { id: "combat", round: 2, turn: 0 };
game.settings = { get: () => ({ "Spike Growth": { triggers: [{ ...trigger, movementDamage: true,
    name: "Movement", activity: "Damage", events: ["tokenEnter"], targeting: "everyone",
    oncePerTurn: true, shareCardPerTurn: true }] } }) };
game.user = { id: "gm", isGM: true, targets: new Set() };
game.users = { activeGM: { id: "gm" } };
activity.name = "Damage";
spell.system.activities.find = fn => [...spell.system.activities.values()].find(fn);
token.object = { name: token.name, id: "a", document: token };
region.flags.dnd5e = { item: spell.uuid };
token.segmentizeRegionMovementPath = (area, points) => [{ type: 0, from: points[0], to: points.at(-1), action: "walk" }];
let runtimeSource = Buffer.from(process.env.RSA_RUNTIME_SOURCE, "base64").toString()
    .replace('"./shared-activity-card.js"', JSON.stringify(sourceURL(shared)))
    .replace('"./movement-damage.js"', JSON.stringify(sourceURL(source)));
runtimeSource = runtimeSource.replace('"./starter-spells.js"', JSON.stringify(`data:text/javascript;base64,${process.env.RSA_STARTER_SOURCE}`));
runtimeSource = runtimeSource.replace('"./save-prompts.js"', JSON.stringify(`data:text/javascript;base64,${process.env.RSA_SAVE_PROMPT_SOURCE}`));
await import(sourceURL(runtimeSource));
hooks.get("ready")();
for (let i = 0; i < 3; i++) {
    await globalThis.RegionSpellAutomation.handleRegionEvent({ region, triggerId: trigger.id,
        event: { name: "tokenMoveWithin", data: { token, movement: { id: `runtime${i}`,
            origin: {x:0}, passed: {waypoints:[{x:5,action:"walk"}]} } } } });
}
assert.equal(messages.length, 3);
assert.equal(helpers.pendingSteps(messages[2].getFlag("region-spell-automation", "movementDamage")), 3);
const repeatedEvent = { region, triggerId: trigger.id, event: { name: "tokenMoveWithin", data: {
    token, movement: { id: "multi-client", origin: {x:0}, passed: {waypoints:[{x:5,action:"walk"}]} }
} } };
game.user.id = "player"; game.user.isGM = false;
await globalThis.RegionSpellAutomation.handleRegionEvent(repeatedEvent);
assert.equal(messages.length, 3);
assert.equal(helpers.pendingSteps(messages[2].getFlag("region-spell-automation", "movementDamage")), 3);
game.user.id = "secondary-gm"; game.user.isGM = true;
await globalThis.RegionSpellAutomation.handleRegionEvent(repeatedEvent);
assert.equal(helpers.pendingSteps(messages[2].getFlag("region-spell-automation", "movementDamage")), 3);
game.user.id = "gm";
await globalThis.RegionSpellAutomation.handleRegionEvent(repeatedEvent);
assert.equal(messages.length, 3);
assert.equal(helpers.pendingSteps(messages[2].getFlag("region-spell-automation", "movementDamage")), 4);
console.log = runtimeLog;

// Boundary-clipped entry counts as one full increment; later internal and exit
// movement counts whole squares. Teleporting into an area never earns entry damage.
const entryContext = { ...event, name: "tokenMoveIn", data: { ...event.data, turn: 9 } };
token.segmentizeRegionMovementPath = (area, points) => [{ type: 0, from: points[0], to: points.at(-1), action: points.at(-1).action }];
entryContext.data.movement = { id: "partial-entry", origin: {x:0}, passed: {waypoints:[{x:2.3,action:"walk"}]} };
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
const entryCard = messages.at(-1);
const entryData = () => entryCard.getFlag("region-spell-automation", "movementDamage");
assert.equal(entryData().distance, 5);
assert.equal(helpers.pendingSteps(entryData()), 1);
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(entryData().distance, 5, "Duplicate entry must not count twice");
entryContext.name = "tokenMoveWithin";
entryContext.data.movement = { id: "partial-within", origin: {x:0}, passed: {waypoints:[{x:2.3,action:"walk"}]} };
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(entryData().distance, 10);
entryContext.name = "tokenMoveOut";
entryContext.data.movement = { id: "partial-exit", origin: {x:0}, passed: {waypoints:[{x:2.3,action:"walk"}]} };
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(entryData().distance, 10, "Stepping out adds no damage");
entryContext.name = "tokenMoveIn";
entryContext.data.movement = { id: "walk-reentry", origin: {x:0}, passed: {waypoints:[{x:2.3,action:"walk"}]} };
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(entryData().distance, 15, "Re-entry counts one boundary square");
entryContext.name = "tokenMoveIn";
entryContext.data.movement = { id: "teleport-entry", origin: {x:0}, passed: {waypoints:[{x:20,action:"teleport"}]} };
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(entryData().distance, 15);
console.log("Movement damage checks passed: distance clipping, teleport exclusion, duplicate events, accumulation, independent dice, partial distance, cancellation, new turns, ownership, runtime limiter bypass.");

// An entry consisting only of a boundary segment must create one pending roll.
entryContext.data.turn = 10;
entryContext.data.movement = { id: "boundary-only", origin: {x:0}, passed: {waypoints:[{x:5,action:"walk"}]} };
token.segmentizeRegionMovementPath = () => [{ type: 1, from: {x:0}, to: {x:5}, action: "walk" }];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(helpers.pendingSteps(messages.at(-1).getFlag("region-spell-automation", "movementDamage")), 1);
const boundaryCardCount = messages.length;
entryContext.data.turn = 11;
entryContext.data.movement = { id: "boundary-teleport", origin: {x:0}, passed: {waypoints:[{x:5,action:"teleport"}]} };
token.segmentizeRegionMovementPath = () => [{ type: 1, from: {x:0}, to: {x:5}, action: "teleport" }];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(messages.length, boundaryCardCount);
entryContext.name = "tokenMoveWithin";
entryContext.data.movement = { id: "first-partial", origin: {x:0}, passed: {waypoints:[{x:2.3,action:"walk"}]} };
token.segmentizeRegionMovementPath = () => [{ type: 0, from: {x:0}, to: {x:2.3}, action: "walk" }];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(helpers.pendingSteps(messages.at(-1).getFlag("region-spell-automation", "movementDamage")), 1);
console.log("Initial-card checks passed: boundary-only entry, first partial movement, teleport exclusion.");

// Foundry splits an entry drag at the boundary, then continues it with a new ID.
entryContext.data.turn = 12;
entryContext.name = "tokenMoveIn";
entryContext.data.movement = { id: "split-entry", origin: {x:0}, passed: {waypoints:[{x:2.7,action:"walk"}]} };
token.segmentizeRegionMovementPath = () => [{ type: 1, from:{x:0}, to:{x:2.7}, action:"walk" }];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
const splitCard = messages.at(-1);
entryContext.name = "tokenMoveWithin";
entryContext.data.movement = { id: "split-rest", chain: ["split-entry"], origin: {x:2.7}, passed: {waypoints:[{x:5,action:"walk"}]} };
token.segmentizeRegionMovementPath = () => [{ type: 0, from:{x:2.7}, to:{x:5}, action:"walk" }];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(helpers.pendingSteps(splitCard.getFlag("region-spell-automation", "movementDamage")), 1,
    "Entry and remainder of one square must count only once");
entryContext.data.movement = { id: "independent-next-move", origin: {x:5}, passed: {waypoints:[{x:10,action:"walk"}]} };
token.segmentizeRegionMovementPath = () => [{ type: 0, from:{x:5}, to:{x:10}, action:"walk" }];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(helpers.pendingSteps(splitCard.getFlag("region-spell-automation", "movementDamage")), 2);
console.log("Movement-chain checks passed: split entry counts once; next independent move adds one.");

// Foundry may report an exit as movement-within before movement-out. Both
// reports must exempt the final step, preserving earlier internal movement.
entryContext.name = "tokenMoveWithin";
entryContext.data.movement = { id: "exit-within-event", origin:{x:10}, passed:{waypoints:[{x:15,action:"walk"}]} };
token.segmentizeRegionMovementPath = () => [
    {type:0,from:{x:10},to:{x:12.5},action:"walk"},
    {type:-1,from:{x:12.5},to:{x:15},action:"walk"}
];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(helpers.pendingSteps(splitCard.getFlag("region-spell-automation", "movementDamage")), 2);
entryContext.name = "tokenMoveOut";
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(helpers.pendingSteps(splitCard.getFlag("region-spell-automation", "movementDamage")), 2);
entryContext.data.movement = {id:"long-exit",origin:{x:0},passed:{waypoints:[{x:15,action:"walk"}]}};
token.segmentizeRegionMovementPath = () => [
    {type:0,from:{x:0},to:{x:12.5},action:"walk"},
    {type:-1,from:{x:12.5},to:{x:15},action:"walk"}
];
await helpers.recordMovementDamage({ trigger, spell, region, event: entryContext, activity });
assert.equal(helpers.pendingSteps(splitCard.getFlag("region-spell-automation", "movementDamage")), 4);
console.log("Exit checks passed: final step exempt through both event types; earlier internal steps retained.");

const manualData = () => splitCard.getFlag("region-spell-automation", "movementDamage");
const movementHistory = JSON.stringify(manualData().movementTotals);
await helpers.adjustPendingMovementDamage(splitCard, 1);
assert.equal(helpers.pendingSteps(manualData()), 5);
await helpers.adjustPendingMovementDamage(splitCard, -1);
assert.equal(helpers.pendingSteps(manualData()), 4);
await helpers.rollPendingMovementDamage(splitCard);
assert.equal(rolledFormula, "8d4");
await helpers.adjustPendingMovementDamage(splitCard, -1);
assert.equal(helpers.pendingSteps(manualData()), 0);
assert.equal(manualData().rolledSteps, 4);
await helpers.adjustPendingMovementDamage(splitCard, 1);
assert.equal(helpers.pendingSteps(manualData()), 1);
await helpers.adjustPendingMovementDamage(splitCard, -1);
await helpers.adjustPendingMovementDamage(splitCard, -1);
assert.equal(helpers.pendingSteps(manualData()), 0);
assert.equal(manualData().rolledSteps, 4);
assert.equal(JSON.stringify(manualData().movementTotals), movementHistory);
splitCard.isOwner = false;
await helpers.adjustPendingMovementDamage(splitCard, 1);
assert.equal(helpers.pendingSteps(manualData()), 0);
console.log("Manual-adjustment checks passed: plus/minus, zero floor, adjusted dice, rolled history and ownership.");

// Simulate the player/GM round trip while keeping the GM as the sole card writer.
const player = {id:"caster",isGM:false,active:true};
const gm = {id:"gm",isGM:true,active:true};
spell.actor = {testUserPermission: user => user.id === player.id};
splitCard.isOwner = true; splitCard.id = "remote-pending";
manualData().casterUserId = player.id;
game.user = gm;
await helpers.adjustPendingMovementDamage(splitCard, 1);
await helpers.adjustPendingMovementDamage(splitCard, 1);
const getMessage = id => id === splitCard.id ? splitCard : undefined;
game.messages.get = getMessage;
game.users = {activeGM:gm,get:id=>id===player.id?player:id===gm.id?gm:null};
let socketHandler, socketRequests=0, requestCounter=0;
foundry.utils.randomID = () => `request${++requestCounter}`;
game.socket = { on(channel, handler) { socketHandler=handler; }, emit(channel, packet) {
    socketRequests++;
    Promise.resolve().then(async () => {
        game.user = gm;
        let result, error;
        try { result = await helpers.processMovementRollRequest(packet); }
        catch(err) { error=err.message; }
        game.user = player;
        socketHandler({action:"movementRollReply",requestId:packet.requestId,userId:player.id,gmId:gm.id,result,error});
    });
} };
helpers.registerMovementDamageHooks(fn=>fn());
game.user = player;
const beforeAdjustment = helpers.pendingSteps(manualData());
await helpers.adjustPendingMovementDamage(splitCard, 1);
assert.equal(helpers.pendingSteps(manualData()),beforeAdjustment,"Player cannot manually adjust counter");
assert.equal(helpers.canRollMovementDamage(manualData(),player,spell.actor),true);
assert.equal(helpers.canRollMovementDamage(manualData(),{id:"other",isGM:false},spell.actor),false);
await helpers.rollPendingMovementDamage(splitCard);
assert.equal(rolledFormula,"4d4");
assert.equal(helpers.pendingSteps(manualData()),0);
assert.equal(socketRequests,2,"Reservation and completion both go through GM");
game.user = gm;
await helpers.adjustPendingMovementDamage(splitCard,1);
game.user = player;
canceled=true;
await helpers.rollPendingMovementDamage(splitCard);
assert.equal(helpers.pendingSteps(manualData()),1,"Canceled player roll restores pending increment");
canceled=false;
assert.equal(Object.keys(manualData().rollReservations).length,0);
console.log("Player movement-roll checks passed: GM-only adjustments, caster authorization, reservation/completion, cancellation refund.");

