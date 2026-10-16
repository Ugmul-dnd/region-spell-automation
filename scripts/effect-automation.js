import {hasEquivalentActiveEffect,regionOwnsEffect} from "./shared-activity-card.js";
const MODULE_ID="ugmuls-5-5e-automation";
const completed=new Set();
const pending=new Set();
export function isHuntersMarkActivity(activity) {
    const item=activity?.item;
    return item?.type==="spell"&&(item.identifier==="hunters-mark"||item.system?.identifier==="hunters-mark"||
        /^hunter['’]?s mark$/i.test(item.name?.trim()??""));
}

export function isBardicInspireActivity(activity) {
    const item=activity?.item;
    return activity?.type==="utility"&&item?.type==="feat"&&
        ((item.identifier??item.system?.identifier)==="bardic-inspiration"||/^bardic inspiration$/i.test(item.name?.trim()??""))&&
        activity.roll?.prompt!==true&&(!activity.roll?.formula||/^@scale\.bard\.inspiration(?:\.die)?$/.test(activity.roll.formula.trim()));
}

export function eligibleBuffActivity(activity) {
    // Utility activities have no attack/save or damage/healing roll to resolve.
    return activity?.type === "utility" && ["spell","feat"].includes(activity.item?.type) &&
        !activity.damage?.parts?.length && (!activity.roll?.formula || isBardicInspireActivity(activity)) && !activity.target?.template?.type;
}

export async function applyBuffEffects(message) {
    if (game.settings.get(MODULE_ID,"autoApplyBuffEffects") !== true || !message?.id || completed.has(message.id) || pending.has(message.id)) return;
    if(message.getFlag?.(MODULE_ID,"manualDamageWorkflow"))return;
    if (message.getFlag?.(MODULE_ID,"targetsConfirmationPending") || message.getFlag?.(MODULE_ID,"targetsConfirmationCanceled")) return;
    const activity=message.getAssociatedActivity?.({scaled:true});
    if (!eligibleBuffActivity(activity)) return;
    const effects=await activity.getApplicableEffects?.() ?? [];
    if (!effects.length) return;
    const caster=message.getAssociatedActor?.();
    const mark=isHuntersMarkActivity(activity),inspire=isBardicInspireActivity(activity);
    if((mark||inspire)&&message.system.targets?.length!==1)return;
    const actors=new Map();
    const type=activity.target?.affects?.type;
    if (type === "self") {
        if (caster) actors.set(caster.uuid,caster);
    } else {
        const casterToken=message.speaker?.scene && message.speaker?.token
            ? await fromUuid(`Scene.${message.speaker.scene}.Token.${message.speaker.token}`)
            : activity.getUsageToken?.();
        const casterDoc=casterToken?.document ?? casterToken;
        for (const target of message.system.targets ?? []) {
            const token=target.token ? await fromUuid(target.token) : null;
            const actor=token?.actor ?? (target.actor ? await fromUuid(target.actor) : null);
            if (!actor) continue;
            // Do not infer a no-save offensive effect as a buff. Self, explicit
            // allies, and friendly-disposition recipients are eligible.
            if(inspire&&actor.uuid===caster?.uuid)continue;
            if (mark || inspire || actor.uuid === caster?.uuid || type === "ally" ||
                (type === "creature" && casterDoc && token && token.disposition === casterDoc.disposition)) actors.set(actor.uuid,actor);
        }
    }
    if (!actors.size) return;
    if (!game.user.isGM && [...actors.values()].some(actor=>!actor.isOwner)) {
        ui.notifications.warn("A connected GM is required to automatically apply buffs to unowned targets.");return;
    }
    if (completed.has(message.id) || pending.has(message.id)) return;
    pending.add(message.id);
    try {
        // Reuse D&D5e's effect tray preparation: concentration dependencies,
        // activity overrides, scaling, duration, and refreshing existing buffs.
        const tray=document.createElement("effect-application");
        tray.chatMessage=message;
        if (typeof tray._applyEffectToActor !== "function") throw Error("D&D5e effect application API is unavailable.");
        for (const actor of actors.values()) for (const effect of effects) {
            // A prior partial attempt may already have applied this source.
            if(hasEquivalentActiveEffect(actor,effect))continue;
            const tokens=await Promise.all((message.system.targets??[]).filter(target=>target.actor===actor.uuid||actors.size===1)
                .map(target=>target.token?fromUuid(target.token):null));
            if(tokens.some(token=>token?.actor?.uuid===actor.uuid&&regionOwnsEffect(token,effect)))continue;
            const undo=globalThis.Ugmuls55eAutomationEffectUndo;
            if(undo)await undo.apply(message,message,effect,actor,tray);
            else await tray._applyEffectToActor(effect,actor);
        }
        completed.add(message.id);
        await message.update({[`flags.${MODULE_ID}.buffAutoApplied`]:true});
        Hooks.callAll("ugmuls55eAutomation.buffEffectsApplied",message);
    } finally {pending.delete(message.id);}
}

export function collapseAppliedBuffTray(message, html) {
    if(message.getFlag?.(MODULE_ID,"effectApplyReopened")&&!message.getFlag?.(MODULE_ID,"outcomeEffectsApplied")&&!message.getFlag?.(MODULE_ID,"buffAutoApplied")) {
        const root=html instanceof HTMLElement?html:html?.[0];
        for(const tray of root?.querySelectorAll("effect-application")??[])tray.open=true;
        return;
    }
    if (!message.getFlag?.(MODULE_ID,"buffAutoApplied")&&!message.getFlag?.(MODULE_ID,"outcomeEffectsApplied")) return;
    const root=html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    for (const tray of root.querySelectorAll("effect-application")) tray.open=false;
}
function report(err) {
    console.error("Ugmuls 5.5e Automation | Buff automation failed:",err);
    ui.notifications.error("Could not automatically apply buffs. Use the card's Apply Effect control.");
}

async function requestBuffs(message) {
    if (game.settings.get(MODULE_ID,"autoApplyBuffEffects") !== true || message?.author?.id !== game.user.id) return;
    const gm=game.users.activeGM;
    if (gm && gm.id !== game.user.id) {
        game.socket.emit(`module.${MODULE_ID}`,{action:"applyBuffEffects",messageId:message.id,userId:game.user.id,gmId:gm.id});
    } else await applyBuffEffects(message);
}

Hooks.once("init",()=>game.settings.register(MODULE_ID,"autoApplyBuffEffects",{
    name:"Effect Automation: Automatically Apply Buffs",
    hint:"Apply configured effects from non-rolling Utility spells/features to Self, Allies, or friendly targeted creatures. Hunter's Mark also applies to its single marked target. Save and attack effects use their separate GM NPC & Damage options.",
    scope:"world",config:true,type:Boolean,default:true
}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",collapseAppliedBuffTray);
    Hooks.on("dnd5e.postUseActivity",(activity,usage,results)=>{
        if (eligibleBuffActivity(activity)) setTimeout(()=>requestBuffs(results?.message).catch(report),0);
    });
    Hooks.on("ugmuls55eAutomation.targetsConfirmed",message=>requestBuffs(message).catch(report));
    Hooks.on("deleteChatMessage",message=>completed.delete(message.id));
    game.socket.on(`module.${MODULE_ID}`,packet=>{
        if (packet?.action !== "applyBuffEffects" || !game.user.isGM || packet.gmId !== game.user.id || game.users.activeGM?.id !== game.user.id) return;
        const message=game.messages.get(packet.messageId),user=game.users.get(packet.userId);
        if (!user?.active || message?.author?.id !== user.id ||
            (!user.isGM && !message.getAssociatedActor?.()?.testUserPermission(user,"OWNER"))) return;
        applyBuffEffects(message).catch(report);
    });
});
