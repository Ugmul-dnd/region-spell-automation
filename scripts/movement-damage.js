import { describeTarget } from "./shared-activity-card.js";
const MODULE_ID = "region-spell-automation";
const SOCKET = `module.${MODULE_ID}`;
const pendingRequests = new Map();

export function canRollMovementDamage(data, user, actor) {
    return Boolean(user?.isGM || (data?.casterUserId === user?.id && actor?.testUserPermission?.(user, "OWNER")));
}

function requestGM(action, cardId, reservationId, canceled = false) {
    const gm = game.users?.activeGM;
    if (!gm) return Promise.reject(new Error("An active GM must be connected to roll pending damage."));
    const requestId = foundry.utils.randomID();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error("GM response timed out. Check the pending card before retrying."));
        }, 15000);
        pendingRequests.set(requestId, { resolve, reject, timer, gmId: gm.id });
        game.socket.emit(SOCKET, { action, requestId, cardId, reservationId, canceled, userId: game.user.id, gmId: gm.id });
    });
}

export async function processMovementRollRequest(packet) {
    if (!game.user.isGM || game.users?.activeGM?.id !== game.user.id) return;
    const user = game.users.get(packet.userId);
    const card = game.messages.get(packet.cardId);
    const data = foundry.utils.deepClone(card?.getFlag(MODULE_ID, "movementDamage"));
    const spell = data ? await fromUuid(data.spellUuid) : null;
    if (!user?.active || !data || !canRollMovementDamage(data, user, spell?.actor)) {
        throw new Error("This user cannot roll this spell's pending damage.");
    }
    data.rollReservations ??= {};
    if (packet.action === "reserveMovementRoll") {
        const existing = data.rollReservations[packet.requestId];
        if (existing) {
            if (existing.userId !== user.id) throw new Error("Invalid movement roll reservation owner.");
            return { data, steps: existing.steps, reservationId: packet.requestId };
        }
        const steps = pendingSteps(data);
        if (!steps) return { steps: 0 };
        data.rolledSteps += steps;
        data.rollReservations[packet.requestId] = { userId: user.id, steps };
        await card.update({ content: cardContent(data), [`flags.${MODULE_ID}.movementDamage`]: data });
        return { data, steps, reservationId: packet.requestId };
    }
    if (packet.action === "finishMovementRoll") {
        const reservation = data.rollReservations[packet.reservationId];
        if (!reservation || reservation.userId !== user.id) throw new Error("Invalid movement roll reservation.");
        if (packet.canceled) data.rolledSteps -= reservation.steps;
        delete data.rollReservations[packet.reservationId];
        await card.update({ content: cardContent(data), [`flags.${MODULE_ID}.movementDamage`]: data });
        return { finished: true };
    }
    throw new Error("Unknown movement roll request.");
}
export const MOVEMENT_EVENTS = ["tokenMoveIn", "tokenMoveWithin", "tokenMoveOut"];

export function pendingSteps(data) {
    return Math.max(0, Math.floor((data.distance + 1e-7) / data.increment) - data.rolledSteps);
}

export function repeatDamageFormula(formula, steps) {
    if (!Number.isSafeInteger(steps) || steps < 1) throw new Error("Invalid movement damage increment count.");
    const dice = /^\s*(\d+)d(\d+)\s*$/i.exec(formula);
    return dice ? `${Number(dice[1]) * steps}d${dice[2]}`
        : Array.from({ length: steps }, () => `(${formula})`).join(" + ");
}

export function measureInsideMovement(token, region, movement, actions, moveType) {
    if (!movement?.origin || !movement.passed?.waypoints?.length) return 0;
    const segments = token.segmentizeRegionMovementPath(region,
        [movement.origin, ...movement.passed.waypoints]);
    let distance = 0;
    for (const segment of segments) {
        if (segment.type !== moveType || actions[segment.action]?.teleport) continue;
        const result = token.measureMovementPath([
            { ...segment.from, action: segment.action }, { ...segment.to, action: segment.action }
        ]);
        if (!Number.isFinite(result.distance) || result.distance < 0) throw new Error("Invalid measured movement distance.");
        distance += result.distance; // Distance traveled, not terrain/speed cost.
    }
    return distance;
}

function movementSignature(movement) {
    return JSON.stringify([movement.id, ...[movement.origin, ...movement.passed.waypoints]
        .map(p => [p.x, p.y, p.elevation, p.action, p.index])]);
}

function cardContent(data) {
    const escape = foundry.utils.escapeHTML;
    const steps = pendingSteps(data);
    return `<div class="rsa-movement-damage"><h3>${escape(data.spellName)} — Movement Damage</h3>
        <p>${escape(data.target.name)}: ${Math.round(data.distance / data.increment)} counted movement step(s).</p>
        <p><strong>${steps}</strong> pending ${data.increment}-${escape(data.units)} increment(s).
        ${data.rolledSteps} increment(s) rolled or reserved.</p>
        <div style="display:flex;gap:6px;margin-bottom:6px;">
            <button type="button" data-rsa-adjust-movement="-1" aria-label="Remove one pending damage increment"
                title="Remove one pending damage increment" ${steps ? "" : "disabled"}>−</button>
            <button type="button" data-rsa-adjust-movement="1" aria-label="Add one pending damage increment"
                title="Add one pending damage increment">+</button>
        </div>
        <button type="button" data-rsa-roll-movement ${steps ? "" : "disabled"}>Roll Pending Damage</button>
        <p>Independent damage dice for each increment. Apply damage using the resulting damage card.</p></div>`;
}

export async function recordMovementDamage({ trigger, spell, region, event, activity }) {
    if (activity.type !== "damage" || typeof activity.rollDamage !== "function") {
        throw new Error("Movement damage requires a Damage activity, without a save or attack.");
    }
    const token = event.data.token;
    const movement = event.data.movement;
    const waypoints = movement?.passed?.waypoints;
    if (!movement?.origin || !waypoints?.length) return;
    const entersByWalking = event.name === "tokenMoveIn" &&
        waypoints.some(point => !CONFIG.Token.movement.actions[point.action]?.teleport);
    let distance = measureInsideMovement(token, region, movement,
        CONFIG.Token.movement.actions, CONST.REGION_MOVEMENT_SEGMENTS.MOVE);
    if (distance <= 0 && !entersByWalking) return;
    const increment = Number(trigger.movementIncrement ?? 5);
    if (!Number.isFinite(increment) || increment <= 0) throw new Error("Invalid movement distance increment.");
    const key = JSON.stringify([region.uuid, spell.uuid, trigger.id, token.uuid,
        event.data.combat?.id, event.data.round, event.data.turn]);
    const card = Array.from(game.messages).reverse().find(message =>
        message.getFlag(MODULE_ID, "movementDamage")?.key === key && message.isOwner);
    const signature = movementSignature(movement);
    const prior = card?.getFlag(MODULE_ID, "movementDamage");
    if (prior?.movements.includes(signature)) return;
    // Foundry can split one drag into entry and continued movement operations.
    // Round the combined distance once for that entire movement chain, so the
    // entry seed and the remainder of its first square are not charged twice.
    const movementKey = movement.chain?.[0] ?? movement.id ?? signature;
    const movementTotals = { ...(prior?.movementTotals ?? {}) };
    const previous = movementTotals[movementKey] ?? { distance: 0, steps: 0 };
    const measuredDistance = previous.distance + distance;
    const segments = token.segmentizeRegionMovementPath(region, [movement.origin, ...waypoints]);
    const exitsArea = event.name === "tokenMoveOut" || segments.at(-1)?.type === -1;
    // The final outward step is exempt. Earlier steps within this same drag
    // still count, and an exit never removes increments already recorded.
    const roundedSteps = Math.max(1, Math.ceil((measuredDistance - 1e-7) / increment));
    const steps = Math.max(previous.steps, roundedSteps - (exitsArea ? 1 : 0));
    movementTotals[movementKey] = { distance: measuredDistance, steps };
    distance = Math.max(0, steps - previous.steps) * increment;
    if (!prior && distance === 0) return;
    const data = {
        ...(prior ?? { key, distance: 0, rolledSteps: 0, movements: [], increment }),
        spellUuid: spell.uuid, spellName: spell.name, activityId: activity.id,
        castLevel: region.flags?.dnd5e?.spellLevel ?? spell.system.level,
        casterUserId: region.flags?.[MODULE_ID]?.casterUserId ?? prior?.casterUserId,
        target: describeTarget(token), units: token.parent.grid.units || "ft", movementTotals
    };
    data.distance += distance;
    data.movements = [...data.movements, signature];
    if (card) await card.update({ content: cardContent(data), [`flags.${MODULE_ID}.movementDamage`]: data });
    else await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: spell.actor }), content: cardContent(data),
        flags: { [MODULE_ID]: { movementDamage: data } }
    });
}

export async function adjustPendingMovementDamage(card, change) {
    if (!game.user.isGM || !card.isOwner) return;
    if (change !== 1 && change !== -1) throw new Error("Adjustment must be +1 or -1.");
    const data = foundry.utils.deepClone(card.getFlag(MODULE_ID, "movementDamage"));
    if (!data || (change < 0 && !pendingSteps(data))) return;
    // Adjust the pending counter without rewriting movement history or rolls.
    data.distance = Math.max(data.rolledSteps * data.increment, data.distance + change * data.increment);
    await card.update({ content: cardContent(data), [`flags.${MODULE_ID}.movementDamage`]: data });
}

export async function rollPendingMovementDamage(card) {
    if (!game.user.isGM) {
        const cardData = card.getFlag(MODULE_ID, "movementDamage");
        const spell = cardData ? await fromUuid(cardData.spellUuid) : null;
        if (!canRollMovementDamage(cardData, game.user, spell?.actor)) return;
        const activity = spell?.system.activities.get(cardData.activityId);
        if (activity?.type !== "damage" || !activity.rollDamage) throw new Error("The configured Damage activity is unavailable.");
        const reservation = await requestGM("reserveMovementRoll", card.id);
        if (!reservation.steps) return;
        let rolls;
        try {
            rolls = await activity.rollDamage({
                isCritical: false, scaling: Math.max(0, reservation.data.castLevel - spell.system.level),
                movementDamageSteps: reservation.steps
            }, { configure: false }, { data: {
                flavor: `${reservation.data.spellName}: ${reservation.steps} movement damage increment(s)`,
                system: { targets: [reservation.data.target] }
            } });
        } catch (err) {
            ui.notifications.warn("Movement roll interrupted. Check chat; the GM has reserved these increments to prevent duplicate damage.");
            throw err;
        }
        await requestGM("finishMovementRoll", card.id, reservation.reservationId, !rolls?.length);
        return;
    }
    if (!card.isOwner) return;
    const data = foundry.utils.deepClone(card.getFlag(MODULE_ID, "movementDamage"));
    if (!data) return;
    const steps = pendingSteps(data);
    if (!steps) return;
    const spell = await fromUuid(data.spellUuid);
    const activity = spell?.system.activities.get(data.activityId);
    if (activity?.type !== "damage" || !activity.rollDamage) throw new Error("The configured Damage activity is unavailable.");
    // Reserve increments before rolling. A failed final card update must not
    // allow a successful roll to be repeated by clicking again.
    data.rolledSteps += steps;
    await card.update({ content: cardContent(data), [`flags.${MODULE_ID}.movementDamage`]: data });
    let rolls;
    try {
        rolls = await activity.rollDamage({
            isCritical: false, scaling: Math.max(0, data.castLevel - spell.system.level), movementDamageSteps: steps
        }, { configure: false }, { data: {
            flavor: `${data.spellName}: ${steps} movement damage increment(s)`, system: { targets: [data.target] }
        } });
    } catch (err) {
        // An exception may occur after a damage message was created. Preserve
        // the reservation rather than risking a second roll of that damage.
        ui.notifications.warn("Movement damage roll interrupted. Check chat before retrying; these increments are reserved.");
        throw err;
    }
    if (!rolls?.length) {
        data.rolledSteps -= steps;
        await card.update({ content: cardContent(data), [`flags.${MODULE_ID}.movementDamage`]: data });
    }
}

export function registerMovementDamageHooks(enqueue) {
    game.socket?.on(SOCKET, packet => {
        if (!packet || typeof packet !== "object") return;
        if (packet.action === "movementRollReply") {
            if (packet.userId !== game.user.id) return;
            const request = pendingRequests.get(packet.requestId);
            if (!request || packet.gmId !== request.gmId) return;
            clearTimeout(request.timer);
            pendingRequests.delete(packet.requestId);
            if (packet.error) request.reject(new Error(packet.error));
            else request.resolve(packet.result);
            return;
        }
        if (!["reserveMovementRoll", "finishMovementRoll"].includes(packet.action) ||
            packet.gmId !== game.user.id || !game.user.isGM || game.users?.activeGM?.id !== game.user.id) return;
        enqueue(() => processMovementRollRequest(packet)).then(result => {
            game.socket.emit(SOCKET, { action: "movementRollReply", userId: packet.userId,
                requestId: packet.requestId, gmId: game.user.id, result });
        }).catch(err => {
            game.socket.emit(SOCKET, { action: "movementRollReply", userId: packet.userId,
                requestId: packet.requestId, gmId: game.user.id, error: err.message });
        });
    });
    Hooks.on("dnd5e.postBuildDamageRollConfig", (process, roll) => {
        const steps = process.movementDamageSteps;
        if (!steps || roll.rsaMovementScaled) return;
        roll.parts = roll.parts.map(part => repeatDamageFormula(part, steps));
        roll.rsaMovementScaled = true;
    });
    Hooks.on("renderChatMessageHTML", (message, html) => {
        if (!message.getFlag(MODULE_ID, "movementDamage")) return;
        const adjustments = html.querySelectorAll("[data-rsa-adjust-movement]");
        for (const adjustment of adjustments) {
            if (!game.user.isGM || !message.isOwner) { adjustment.hidden = true; continue; }
            adjustment.addEventListener("click", () => {
                adjustment.disabled = true;
                enqueue(() => adjustPendingMovementDamage(message, Number(adjustment.dataset.rsaAdjustMovement)))
                    .catch(err => {
                        console.error("Region Spell Automation | Movement damage adjustment failed:", err);
                        ui.notifications.error("Could not adjust movement damage. Check F12 console.");
                    }).finally(() => {
                        adjustment.disabled = adjustment.dataset.rsaAdjustMovement === "-1" &&
                            pendingSteps(message.getFlag(MODULE_ID, "movementDamage")) === 0;
                    });
            });
        }
        const button = html.querySelector("[data-rsa-roll-movement]");
        if (!button) return;
        const data = message.getFlag(MODULE_ID, "movementDamage");
        const actor = game.user.isGM ? null : fromUuidSync(data.spellUuid)?.actor;
        if (!canRollMovementDamage(data, game.user, actor)) { button.hidden = true; return; }
        button.addEventListener("click", () => {
            button.disabled = true;
            enqueue(() => rollPendingMovementDamage(message)).catch(err => {
                console.error("Region Spell Automation | Movement damage roll failed:", err);
                ui.notifications.error("Movement damage roll failed. Check F12 console.");
            }).finally(() => {
                button.disabled = pendingSteps(message.getFlag(MODULE_ID, "movementDamage")) === 0;
            });
        });
    });
}
