// Shared cards retain D&D5e's native save and damage workflow.
export function isEligibleTarget(token) {
    const document = token?.document ?? token;
    const actor = document?.actor;
    if (!actor || document.hidden === true) return false;
    const hp = actor.system?.attributes?.hp?.value;
    if (typeof hp === "number" && hp <= 0) return false;
    if (actor.statuses?.has?.("dead") || actor.statuses?.has?.("defeated")) return false;
    if (document.combatant?.defeated || document.object?.combatant?.defeated) return false;
    const combats = globalThis.game?.combats
        ? Array.from(game.combats.values?.() ?? game.combats) : [globalThis.game?.combat].filter(Boolean);
    for (const combat of combats) {
        const entries = combat.combatants ? Array.from(combat.combatants.values?.() ?? combat.combatants) : [];
        if (entries.some(entry => entry.defeated && (entry.token?.uuid && document.uuid
            ? entry.token.uuid === document.uuid
            : entry.tokenId === document.id && (!combat.scene?.id || combat.scene.id === document.parent?.id)))) return false;
    }
    return true;
}

export function getSharedCardKey(trigger, spell, region, event, combat) {
    combat = event?.data?.combat ?? combat;
    const round = event?.data?.round ?? combat?.round;
    const turn = event?.data?.turn ?? combat?.turn;
    if (!trigger.shareCardPerTurn || !combat?.id || round == null || turn == null) return null;
    return JSON.stringify([combat.id, round, turn, spell.uuid, region.uuid, trigger.id]);
}

export function describeTarget(token) {
    const actor = token.actor;
    if (!actor?.uuid || !token.uuid) throw new Error("Shared card target has no actor or token UUID.");
    return {
        actor: actor.uuid,
        token: token.uuid,
        name: token.name,
        img: token.texture?.src,
        ac: actor.statuses?.has("coverTotal") ? null : actor.system?.attributes?.ac?.value ?? null
    };
}

export function mergeTargets(targets, descriptor) {
    const merged = Array.from(targets ?? [], target => ({ ...target }));
    if (!merged.some(target => target.token === descriptor.token)) merged.push(descriptor);
    return merged;
}

export async function appendSharedTarget(message, descriptor) {
    // Do not change rolls, save outcomes, or damage-application records.
    const messages = [message, ...(message.getAssociatedRolls?.("damage") ?? [])];
    for (const card of messages) {
        const eligible = [];
        for (const target of card.system.targets ?? []) {
            const token = target.token ? await fromUuid(target.token) : null;
            if (!token || token.uuid !== target.token || isEligibleTarget(token)) eligible.push(target);
        }
        const targets = mergeTargets(eligible, descriptor);
        if (targets.length !== card.system.targets.length || targets.some((target, index) => target.token !== card.system.targets[index]?.token)) {
            const update = { "system.targets": targets };
            if (eligible.length !== card.system.targets.length) update["flags.region-spell-automation.retargeted"] = true;
            await card.update(update);
        }
    }
}

export function createEventQueue() {
    let pending = Promise.resolve();
    return task => {
        const result = pending.then(task);
        // A failed event must not prevent subsequent events from executing.
        pending = result.catch(() => {});
        return result;
    };
}
