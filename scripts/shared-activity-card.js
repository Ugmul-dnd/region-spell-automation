// Shared cards retain D&D5e's native save and damage workflow.
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
        const targets = mergeTargets(card.system.targets, descriptor);
        if (targets.length !== card.system.targets.length) {
            await card.update({ "system.targets": targets });
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
