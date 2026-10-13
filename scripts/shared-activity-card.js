// Shared cards retain D&D5e's native save and damage workflow.
function cardOrigin(card) {
    const origin=card?.system?.origin;
    return typeof origin==="string"?game.messages?.get(origin):origin;
}
export function linkedHpCards(roll) {
    if(isDamageOrHealingCard(roll))return [roll];
    const origin=cardOrigin(roll);
    if(!origin)return [];
    const cards=Array.from(game.messages??[]).filter(card=>isDamageOrHealingCard(card)&&cardOrigin(card)?.id===origin.id);
    if(roll.type!=="attack")return cards;
    const attacks=Array.from(origin.getAssociatedRolls?.("attack")??[]);
    return cards.filter(card=>{
        const explicit=card.getFlag?.("region-spell-automation","damageAttackId");
        if(explicit)return explicit===roll.id;
        const preceding=attacks.filter(attack=>attack.timestamp<=card.timestamp).sort((a,b)=>b.timestamp-a.timestamp)[0];
        return preceding?.id===roll.id;
    });
}
export function isRollAdjustmentLocked(roll) {
    return linkedHpCards(roll).some(card=>!card.getFlag?.("region-spell-automation","masteryGrazeUndone")&&
        (card.getFlag?.("region-spell-automation","hpApplicationRecorded")===true||card.getFlag?.("region-spell-automation","damageUndoHistory")?.length>0));
}
Hooks.once("ready",()=>{
    Hooks.on("updateChatMessage",(card,changes)=>{
        if(!isDamageOrHealingCard(card)||!changes.flags?.["region-spell-automation"])return;
        const origin=cardOrigin(card);
        const related=[...(origin?.getAssociatedRolls?.("attack")??[]),...(origin?.getAssociatedRolls?.("save")??[])];
        for(const roll of related)ui.chat?.updateMessage?.(roll);
        if(origin)ui.chat?.updateMessage?.(origin);
    });
});
export function isDamageOrHealingCard(message) {return ["damage","healing"].includes(message?.type);}
export function isHealingCard(message) {
    if(message?.type==="healing"||message?.system?.isHealing===true||message?.getAssociatedActivity?.()?.type==="heal")return true;
    if(message?.type!=="damage")return false;
    const types=(message.rolls??[]).flatMap(roll=>roll.options?.type?[roll.options.type]:roll.options?.types??[]);
    return types.length>0&&types.every(type=>["healing","temphp"].includes(type));
}
export function isEligibleHealingTarget(token) {
    const document=token?.document??token;
    return !!document?.actor&&document.hidden!==true;
}
function effectSources(effect) {
    return new Set([effect?.uuid,effect?._stats?.duplicateSource,effect?._stats?.compendiumSource].filter(Boolean));
}
export function equivalentEffect(left,right) {
    const sources=effectSources(left);
    if([...effectSources(right)].some(source=>sources.has(source)))return true;
    const name=effect=>effect?.name?.trim().toLocaleLowerCase();
    return !!name(left)&&name(left)===name(right)&&
        JSON.stringify(left.system?.changes??left.changes??[])===JSON.stringify(right.system?.changes??right.changes??[]);
}
export function hasEquivalentActiveEffect(actor,effect) {
    return Array.from(actor?.effects??[]).some(existing=>existing.disabled!==true&&existing.active!==false&&
        existing.system?.expired!==true&&equivalentEffect(existing,effect));
}
export function regionOwnsEffect(token,effect) {
    const document=token?.document??token;
    const regions=document?.parent?.regions??globalThis.canvas?.scene?.regions??[];
    const sources=effectSources(effect);
    for(const region of regions) {
        if(!Array.from(region.tokens??[]).some(entry=>(entry.document??entry).uuid===document?.uuid))continue;
        for(const behavior of region.behaviors??[]) {
            if(behavior.disabled===true||behavior.active===false)continue;
            if(behavior.type==="dnd5e.applyActiveEffect"&&
                (!behavior.system.dispositions?.size||behavior.system.dispositions.has(document.disposition))&&
                Array.from(behavior.system.effects??[]).some(uuid=>sources.has(uuid)))return true;
        }
    }
    return false;
}
export function regionEffectDispositions(config,caster) {
    const modes=(config?.triggers??[]).filter(trigger=>trigger.enabled!==false).map(trigger=>trigger.targeting??"everyone");
    if(!modes.length||modes.includes("everyone"))return [];
    const document=caster?.document??caster;
    if(typeof document?.disposition!=="number")return null;
    const dispositions=[CONST.TOKEN_DISPOSITIONS.HOSTILE,CONST.TOKEN_DISPOSITIONS.NEUTRAL,CONST.TOKEN_DISPOSITIONS.FRIENDLY];
    return dispositions.filter(disposition=>modes.some(mode=>mode==="friendliesOnly"?disposition===document.disposition:
        ["hostilesOnly","excludeFriendlies"].includes(mode)&&disposition!==document.disposition));
}
export async function resolveRegionCaster(region,item=null) {
    const uuid=region.flags?.dnd5e?.origin;
    const origin=uuid?await fromUuid(uuid):null;
    if(origin?.documentName==="Token"||typeof origin?.disposition==="number")return origin;
    const actor=origin?.actor??origin??item?.actor;
    const tokens=Array.from(region.parent?.tokens??[]).filter(token=>token.actor?.uuid===actor?.uuid);
    return tokens.length===1?tokens[0]:null;
}

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
