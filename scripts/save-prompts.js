const MODULE_ID = "ugmuls-5-5e-automation";
import { isEligibleTarget, createEventQueue } from "./shared-activity-card.js";
export { isEligibleTarget };
const prompted = new Map();
const recordPendingSave=createEventQueue();
let magicResistanceBridge=false;
export function hasMagicResistance(actor) {
    return Array.from(actor?.items??[]).some(item=>item.type==="feat"&&
        (item.system?.identifier==="magic-resistance"||item.identifier==="magic-resistance"||/^magic\s+resistance(?:\s*\([^)]*\))?$/i.test(item.name?.trim()??"")));
}
export function magicalSaveSource(activity) {
    return activity?.isSpell===true||activity?.item?.type==="spell"||activity?.item?.system?.properties?.has?.("mgc")===true;
}
export function registerMagicResistanceBridge(api=globalThis.ac5e?.usageRules) {
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try {
        magicResistanceBridge=Boolean(api.register({key:"rsaMagicResistance",scope:"universal",hook:"save",target:"subject",
            mode:"advantage",name:"Magic Resistance",persistent:false,
            evaluate:sandbox=>game.settings.get(MODULE_ID,"magicResistanceSaves")===true&&
                (sandbox.isSpell===true||sandbox.isMagical===true)&&
                hasMagicResistance(fromUuidSync(sandbox.actorUuid,{strict:false}))}));
    } catch(err){magicResistanceBridge=false;console.warn("Ugmuls 5.5e Automation | Magic Resistance integration unavailable:",err);}
    return magicResistanceBridge;
}
export function magicResistanceSaveDefaults(config,dialog,message) {
    if(game.settings.get(MODULE_ID,"magicResistanceSaves")!==true||
        (magicResistanceBridge&&game.modules?.get("automated-conditions-5e")?.active)||!hasMagicResistance(config.subject))return;
    const system=message?.data?.system;
    const origin=typeof system?.origin==="string"?game.messages.get(system.origin):system?.origin;
    const activity=origin?.getAssociatedActivity?.()??(system?.activity?.uuid?fromUuidSync(system.activity.uuid,{strict:false}):null);
    if(!magicalSaveSource(activity))return;
    config.advantage=true;
    for(const roll of config.rolls??[]) {
        roll.options??={};
        const disadvantage=!!(config.disadvantage||roll.options.disadvantage||roll.options.advantageMode===-1);
        roll.options.advantage=true;roll.options.disadvantage=disadvantage;
        roll.options.advantageMode=disadvantage?0:1;
    }
    dialog.options??={};
    dialog.options.defaultButton=(config.disadvantage||config.rolls?.[0]?.options?.disadvantage)?"normal":"advantage";
}

export function selectSaveUser(actor, users, activeGM, castingGM = null) {
    const gm = castingGM?.active && castingGM.isGM ? castingGM : activeGM;
    const owners = Array.from(users).filter(user => user.active && !user.isGM && actor.testUserPermission(user, "OWNER"));
    owners.sort((a, b) => Number(b.character?.id === actor.id) - Number(a.character?.id === actor.id) || a.id.localeCompare(b.id));
    return owners[0] ?? gm ?? null;
}

export async function receiveSavePrompt(packet) {
    const setting = packet.action === "promptSpellSave" ? "promptForSaveOnSpellCasts" : "promptForSaveOnRegionTriggers";
    if (game.settings.get(MODULE_ID, setting) !== true) return;
    if (packet.userId !== game.user.id) return;
    const message = game.messages.get(packet.messageId);
    const source = game.users.get(packet.sourceId);
    if (!message || !source?.active) return;
    const token = await fromUuid(packet.tokenUuid);
    const actor = token?.actor;
    const retryAllowed=packet.retry===true&&actor?.testUserPermission(source,"OWNER")&&
        message.getFlag?.(MODULE_ID,"requestedSaveTargets")?.includes(packet.tokenUuid);
    if(!source.isGM&&message.author?.id!==source.id&&!retryAllowed)return;
    if(message.system.outcomes?.has(packet.tokenUuid))return;
    if (!isEligibleTarget(token)) return;
    if (!message.system.targets?.some(target => target.token === packet.tokenUuid ||
        (actor?.uuid && target.actor === actor.uuid))) {
        console.warn("Ugmuls 5.5e Automation | Save prompt skipped: token is not recorded on the cast card.", packet.tokenUuid);
        return;
    }
    if (!actor?.isOwner || typeof actor.rollSavingThrow !== "function") {
        console.warn("Ugmuls 5.5e Automation | Save prompt skipped: target actor is unavailable or not owned.", packet.tokenUuid);
        return;
    }
    const takeover=packet.retry===true&&packet.userId===packet.sourceId&&
        (source.isGM||actor.testUserPermission(source,"OWNER"));
    const user = takeover?source:selectSaveUser(actor, game.users, game.users.activeGM, source.isGM ? source : null);
    if (user?.id !== game.user.id) return;
    if(globalThis.Ugmuls55eAutomationGrapple?.deferGrappleSave(message))return;
    const activity = message.getAssociatedActivity?.();
    if (activity?.type !== "save") return;
    if (packet.action === "promptSpellSave" && (!["spell", "feat"].includes(activity.item?.type) || message.getFlag?.(MODULE_ID, "regionTriggered"))) return;
    const ability = Array.from(activity.save.ability ?? [])[0];
    const rawDC = activity.save.dc.value;
    const dc = rawDC == null || rawDC === "" ? NaN : Number(rawDC);
    if (!ability || !Number.isFinite(dc)) {
        console.warn("Ugmuls 5.5e Automation | Save prompt skipped: missing save ability or DC.", message.id);
        return;
    }
    const key = JSON.stringify([message.id, token.uuid]);
    if (prompted.has(key)) return;
    const session=Symbol(key);prompted.set(key,session);
    // Mirror D&D5e's card Save action, including activity bonus and origin.
    const bonus = CONFIG.Dice.BasicRoll.replaceFormulaData(activity.save.bonus ?? "", activity.getRollData(), { missing: 0 });
    const bonusData = CONFIG.Dice.BasicRoll.constructParts({ activityBonus: bonus });
    const config = { ability, target: dc };
    if (bonusData.parts.length) config.rolls = [bonusData];
    try {
        const auto=!takeover&&globalThis.Ugmuls55eAutomationNpcDamage?.shouldAutoRollNpc(actor)===true;
        if(auto)config.rsaAutoNpcSave=true;
        const dialog = { configure: !auto, options: { id: `rsa-save-${message.id}-${token.id ?? token.uuid}` } };
        const positioned = auto?dialog:(globalThis.Ugmuls55eAutomationDamage?.configurePromptDialog("save",dialog) ?? dialog);
        const rolls=await actor.rollSavingThrow(config, positioned, { data: {
            speaker: ChatMessage.getSpeaker({ actor, scene: token.parent, token }),
            system: { ...activity.messageSources, origin: message.id }
        } });
        // Canceling a native dialog returns no rolls. Release the duplicate
        // guard so an explicit pending-button retry can reopen it.
        if(!rolls?.length&&prompted.get(key)===session)prompted.delete(key);
    } catch (err) {
        if(prompted.get(key)===session)prompted.delete(key);
        throw err;
    }
}

export async function cancelPendingSavePrompt(packet) {
    const message=game.messages.get(packet.messageId),source=game.users.get(packet.sourceId);
    if(!message||!source?.active||!message.getFlag?.(MODULE_ID,"requestedSaveTargets")?.includes(packet.tokenUuid)||message.system.outcomes?.has(packet.tokenUuid))return;
    const token=await fromUuid(packet.tokenUuid);
    if(!token?.actor||(!source.isGM&&!token.actor.testUserPermission(source,"OWNER")))return;
    const key=JSON.stringify([message.id,token.uuid]);
    const id=`rsa-save-${message.id}-${token.id??token.uuid}`;
    const instances=globalThis.foundry?.applications?.instances;
    const apps=instances?Array.from(instances.values()):Object.values(ui.windows??{});
    for(const app of apps)if(app.options?.id===id||app.id===id)await app.close();
    prompted.delete(key);
}

export async function repromptTargetSave(message,tokenUuid) {
    const token=await fromUuid(tokenUuid);
    if(!isEligibleTarget(token)||message.system.outcomes?.has(tokenUuid)||
        !message.getFlag?.(MODULE_ID,"requestedSaveTargets")?.includes(tokenUuid))return;
    if(!game.user.isGM&&!token.actor.testUserPermission(game.user,"OWNER"))return;
    const user=game.user;
    const packet={action:message.getFlag(MODULE_ID,"regionTriggered")?"promptRegionSave":"promptSpellSave",
        messageId:message.id,tokenUuid,sourceId:game.user.id,userId:user.id,retry:true};
    await cancelPendingSavePrompt(packet);
    game.socket.emit(`module.${MODULE_ID}`,{...packet,action:"cancelPendingSavePrompt"});
    await receiveSavePrompt(packet);
}

export async function promptTargetSave(message, token, trigger) {
    if (message.getFlag?.(MODULE_ID, "targetsConfirmationPending")) return;
    if (game.settings.get(MODULE_ID, "promptForSaveOnRegionTriggers") !== true ||
        trigger.movementDamage || message.getAssociatedActivity?.()?.type !== "save") return;
    await sendSavePrompt(message, token, "region");
}

export async function sendSavePrompt(message, token, kind) {
    if (!isEligibleTarget(token)) return;
    if(globalThis.Ugmuls55eAutomationGrapple?.deferGrappleSave(message))return;
    if(await globalThis.Ugmuls55eAutomationMetamagic?.carefulSave(message,token))return;
    const setting = kind === "spell" ? "promptForSaveOnSpellCasts" : "promptForSaveOnRegionTriggers";
    if (game.settings.get(MODULE_ID, setting) !== true) return;
    const user = selectSaveUser(token.actor, game.users, game.users.activeGM, game.user.isGM ? game.user : null);
    if (!user) { ui.notifications.warn("No connected player or GM can receive this saving throw prompt."); return; }
    // Record requests before rolling so every client can show the empty slot.
    await recordPendingSave(async()=>{
        const requested=message.getFlag(MODULE_ID,"requestedSaveTargets")??[];
        if(!requested.includes(token.uuid))await message.setFlag(MODULE_ID,"requestedSaveTargets",[...requested,token.uuid]);
    });
    const packet = { action: kind === "spell" ? "promptSpellSave" : "promptRegionSave", messageId: message.id, tokenUuid: token.uuid,
        sourceId: game.user.id, userId: user.id };
    console.log("Ugmuls 5.5e Automation | Routing save prompt", {
        target: token.name ?? token.actor.name ?? token.uuid, recipient: user.name ?? user.id, gm: user.isGM
    });
    if (user.id === game.user.id) {
        // Do not block other Region events while the user decides how to roll.
        receiveSavePrompt(packet).catch(reportError);
    } else game.socket.emit(`module.${MODULE_ID}`, packet);
}

function reportError(err) {
    console.error("Ugmuls 5.5e Automation | Saving throw prompt failed:", err);
    ui.notifications.error("Could not prompt the affected token's saving throw. Use its chat-card Save button.");
}

export function registerSavePromptHooks() {
    globalThis.Ugmuls55eAutomationRepromptSave=repromptTargetSave;
    registerMagicResistanceBridge();
    Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerMagicResistanceBridge(usageRules));
    Hooks.on("dnd5e.preRollSavingThrowV2",magicResistanceSaveDefaults);
    game.socket?.on(`module.${MODULE_ID}`, packet => {
        if(packet?.action==="cancelPendingSavePrompt"&&packet.sourceId!==game.user.id)cancelPendingSavePrompt(packet).catch(reportError);
        if (["promptRegionSave", "promptSpellSave"].includes(packet?.action)) receiveSavePrompt(packet).catch(reportError);
    });
}
