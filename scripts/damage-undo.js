import {createEventQueue,isDamageOrHealingCard,isHealingCard} from "./shared-activity-card.js";
const MODULE_ID="ugmuls-5-5e-automation";
const enqueue=createEventQueue();
const hpKeys=["value","temp","tempmax"];
const history=message=>message.getFlag(MODULE_ID,"damageUndoHistory")??[];
const effectHistory=message=>message?.getFlag?.(MODULE_ID,"effectUndoHistory")??[];
const originOf=message=>typeof message?.system?.origin==="string"?game.messages.get(message.system.origin):message?.system?.origin;
const hpApplicationSessions=new Map();
const applyingHpTrays=new WeakSet();
function hpApplicationMessage(options) {
    for(const reference of [options.origin,options.originatingMessage]) {
        const message=typeof reference==="string"?game.messages.get(reference.replace(/^ChatMessage\./,"")):reference;
        if(isDamageOrHealingCard(message))return message;
    }
}
async function refreshHpUndoCard(message) {
    const current=game.messages?.get?.(message.id)??message;
    await ui.chat?.updateMessage?.(current);
    const origin=originOf(current);
    if(origin&&origin!==current)await ui.chat?.updateMessage?.(origin);
}

export async function applyEffectWithUndo(card,usage,effect,actor,tray) {
    return enqueue(async()=>{
        const existing=Array.from(actor.effects??[]).find(entry=>entry._stats?.duplicateSource===effect.uuid||entry._stats?.compendiumSource===effect.uuid);
        const before=existing?existing.toObject():null;
        const applied=await tray._applyEffectToActor(effect,actor);
        if(!applied?.uuid)return applied;
        const record={id:foundry.utils.randomID(),effectUuid:applied.uuid,sourceMessage:usage.uuid,before};
        await card.setFlag(MODULE_ID,"effectUndoHistory",[...effectHistory(card),record]);
        return applied;
    });
}
export async function applyConditionWithUndo(card,actor,statusId,updates={}){
    return enqueue(async()=>{
        if(actor.statuses?.has?.(statusId))return;
        const nativeId=CONFIG.statusEffects?.[statusId]?._id;
        const snapshots=new Map(Array.from(actor.effects??[]).map(effect=>[effect.id,effect.toObject()]));
        const result=await actor.toggleStatusEffect(statusId,{active:true});
        const applied=result?.uuid?result:(nativeId?actor.effects.get?.(nativeId):null)??Array.from(actor.effects??[]).find(effect=>effect.statuses?.has?.(statusId)&&!effect.disabled);
        if(!applied?.uuid)return;
        await applied.update({...updates,"system.origin.message":card.uuid});
        await card.setFlag(MODULE_ID,"effectUndoHistory",[...effectHistory(card),{id:foundry.utils.randomID(),effectUuid:applied.uuid,sourceMessage:card.uuid,before:snapshots.get(applied.id)??null}]);
        return applied;
    });
}
export function effectUndoSources(message) {
    if(!isDamageOrHealingCard(message))return [message].filter(Boolean);
    const usage=originOf(message);
    const explicit=message.getFlag(MODULE_ID,"damageAttackId");
    const attack=explicit?game.messages.get(explicit):[...(usage?.getAssociatedRolls?.("attack")??[])]
        .filter(roll=>roll.timestamp<=message.timestamp).sort((a,b)=>b.timestamp-a.timestamp)[0];
    return [message,usage,attack].filter((card,index,list)=>card&&list.indexOf(card)===index);
}
export async function undoCardEffects(message) {
    if(!game.user.isGM)return;
    const usage=originOf(message)??message;
    // An explicit undo hands this activity back to manual controls.
    await usage.setFlag(MODULE_ID,"manualDamageWorkflow",true);
    for(const card of effectUndoSources(message)) {
        const records=[...effectHistory(card)];
        for(const record of [...records].reverse()) {
            const effect=await fromUuid(record.effectUuid);
            if(effect) {
                if(effect.system?.origin?.message!==record.sourceMessage) {
                    ui.notifications.warn("An effect was refreshed by another card; its newer application was kept.");
                } else if(record.before) {
                    const restored={...record.before};delete restored._stats;
                    await effect.update(restored,{diff:false,recursive:false,rsaUndoEffect:true});
                } else await effect.delete({rsaUndoEffect:true});
            }
            records.splice(records.findIndex(entry=>entry.id===record.id),1);
            await card.setFlag(MODULE_ID,"effectUndoHistory",[...records]);
        }
    }
    await usage.setFlag(MODULE_ID,"outcomeEffectsApplied",false);
    await usage.setFlag(MODULE_ID,"buffAutoApplied",false);
    await usage.setFlag(MODULE_ID,"effectApplyReopened",Date.now());
}

export function addEffectUndoButton(message,html) {
    const root=html instanceof HTMLElement?html:html?.[0];
    if(!root||!game.user.isGM)return;
    const entries=[{message,root}];
    for(const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const card=game.messages.get(summary.dataset.messageId);if(card)entries.push({message:card,root:summary});
    }
    for(const entry of entries) {
        if(!entry.message.isContentVisible||entry.root.querySelector("[data-rsa-undo-effect]"))continue;
        if(!["usage","attack","damage","healing"].includes(entry.message.type))continue;
        // Place the action with damage when available; otherwise keep it on
        // the save/attack card so effects-only activities can still be undone.
        if(!isDamageOrHealingCard(entry.message)&&["damage","healing"].some(type=>(entry.message.getAssociatedRolls?.(type)??[]).length))continue;
        if(entry.message.type==="attack"&&(originOf(entry.message)?.getAssociatedRolls?.("damage")??[])
            .some(damage=>effectUndoSources(damage).includes(entry.message)))continue;
        if(!effectUndoSources(entry.message).some(card=>effectHistory(card).length))continue;
        const face=entry.root.querySelector(".chat-card")??entry.root;
        let controls=face.querySelector(".rsa-damage-actions");
        if(!controls){controls=document.createElement("div");controls.className="rsa-attack-actions rsa-damage-actions";face.append(controls);}
        const button=document.createElement("button");button.type="button";button.dataset.rsaUndoEffect="";
        button.innerHTML='<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo Effect';
        button.addEventListener("click",event=>{
            event.preventDefault();event.stopPropagation();if(button.disabled)return;button.disabled=true;
            const finishScroll=globalThis.Ugmuls55eAutomationFollowChatChanges?.(button)??(()=>{});
            const gm=game.users.activeGM;
            if(gm&&gm.id!==game.user.id)game.socket.emit(`module.${MODULE_ID}`,{action:"undoCardEffects",messageId:entry.message.id,userId:game.user.id,gmId:gm.id});
            else enqueue(()=>undoCardEffects(entry.message)).catch(report).finally(finishScroll);
        });controls.append(button);
    }
}
function refreshEffectActions(message,changes) {
    if(!Object.hasOwn(changes,`flags.${MODULE_ID}.effectUndoHistory`)&&!Object.hasOwn(changes.flags?.[MODULE_ID]??{},"effectUndoHistory"))return;
    const usage=originOf(message)??message;
    for(const type of ["damage","healing"])for(const result of usage.getAssociatedRolls?.(type)??[])ui.chat?.updateMessage(result);
}

export async function storeReappliedEffectUndo(message,records,user=game.user) {
    if(!message||!user?.active||!Array.isArray(records))return;
    const accepted=[];
    for(const record of records) {
        const effect=await fromUuid(record.effectUuid);
        if(!effect||effect.system?.origin?.message!==message.uuid||record.sourceMessage!==message.uuid)continue;
        if(!user.isGM&&!effect.parent?.testUserPermission(user,"OWNER"))continue;
        if(record.before&&record.before._id!==effect.id)continue;
        if(!effectHistory(message).some(entry=>entry.id===record.id))accepted.push(record);
    }
    if(!accepted.length)return;
    await message.setFlag(MODULE_ID,"effectUndoHistory",[...effectHistory(message),...accepted]);
    await message.setFlag(MODULE_ID,"outcomeEffectsApplied",true);
    await message.setFlag(MODULE_ID,"effectApplyReopened",null);
}
export async function manualSaveEffectAllowed(message,effect,actor){
    const activity=message.getAssociatedActivity?.({scaled:true});
    if(activity?.type!=="save")return {allowed:true};
    const profile=activity.effects?.find(profile=>profile.uuid===effect.uuid||profile._id===effect.id);
    // Restrict save effects to recorded recipients and completed save outcomes.
    // Multiple linked tokens share an Actor: one qualifying outcome is sufficient.
    const outcomes=[];
    for(const target of message.system?.targets??[]){
        const token=target.token?await fromUuid(target.token):null;
        if(token?.actor?.uuid===actor.uuid||target.actor===actor.uuid)outcomes.push(message.system.outcomes?.get(target.token));
    }
    if(outcomes.some(outcome=>outcome==="failure"||outcome==="success"&&profile?.onSave===true))return {allowed:true};
    if(outcomes.some(outcome=>!["success","failure"].includes(outcome)))return {allowed:false,reason:"Saving throw is still pending. Complete the save before applying this effect."};
    return {allowed:false,reason:outcomes.length?"Saving throw succeeded; this effect only applies on a failed save.":"This creature is not a recorded target of this save. Use Retarget before applying its effect."};
}
export async function applyManualEffectsWithUndo(tray,apply) {
    const message=tray.chatMessage;
    // Track the first manual application too: a retroactive save correction
    // may make an effect applicable even though this card has never been undone.
    if(!message?.uuid||typeof tray._prepareEffectData!=="function")return apply.call(tray);
    const prepare=tray._prepareEffectData;
    const operations=[];
    tray._prepareEffectData=async function(effect,actor) {
        const eligibility=await manualSaveEffectAllowed(message,effect,actor);
        if(!eligibility.allowed)throw Error(eligibility.reason);
        const operation=await prepare.call(this,effect,actor);
        const before=operation.action==="update"?actor.effects.get(operation.data._id)?.toObject():null;
        operations.push({effect,actor,operation,before});
        return operation;
    };
    try {
        const result=await apply.call(tray);
        const records=[];
        for(const {effect,actor,operation,before} of operations) {
            const applied=operation.action==="update"?actor.effects.get(operation.data._id):Array.from(actor.effects).reverse()
                .find(entry=>entry.system?.origin?.message===message.uuid&&
                    (entry._stats?.duplicateSource===effect.uuid||entry._stats?.compendiumSource===effect.uuid));
            if(applied?.uuid)records.push({id:foundry.utils.randomID(),effectUuid:applied.uuid,sourceMessage:message.uuid,before:before??null});
        }
        if(records.length) {
            const gm=game.users.activeGM;
            if(gm&&gm.id!==game.user.id)game.socket.emit(`module.${MODULE_ID}`,{action:"recordReappliedEffectUndo",messageId:message.id,records,userId:game.user.id,gmId:gm.id});
            else if(game.user.isGM)await enqueue(()=>storeReappliedEffectUndo(message,records));
        }
        return result;
    } finally {tray._prepareEffectData=prepare;}
}

export function captureDamageUndo(actor,damages,updates,options) {
    const message=hpApplicationMessage(options);
    if(!isDamageOrHealingCard(message))return;
    options.rsaUndoBefore=Object.fromEntries(hpKeys.map(key=>[key,Number(actor.system.attributes.hp[key]??0)]));
}
export function damageUndoRecord(actor,options) {
    if(!options.rsaUndoBefore)return null;
    const changes=hpKeys.map(key=>({key,before:options.rsaUndoBefore[key],after:Number(actor.system.attributes.hp[key]??0)}))
        .filter(change=>Number.isFinite(change.before)&&Number.isFinite(change.after)&&change.before!==change.after);
    return changes.length?{id:foundry.utils.randomID(),actorUuid:actor.uuid,changes}:null;
}
export function captureAppliedHpUndo(actor,options) {
    const record=damageUndoRecord(actor,options);
    const session=hpApplicationSessions.get(options.rsaManualHpSession);
    if(session) {if(record)session.records.push(record);return null;}
    return record;
}
export async function storeManualHpApplication(message,records,actorUuids,user=game.user) {
    if(!isDamageOrHealingCard(message)||!user?.active||!Array.isArray(records)||!Array.isArray(actorUuids))return;
    const allowed=new Set();
    for(const uuid of actorUuids) {
        const actor=await fromUuid(uuid);
        if(actor?.system?.attributes?.hp&&(user.isGM||actor.testUserPermission(user,"OWNER")))allowed.add(uuid);
    }
    if(!allowed.size)return;
    for(const record of records)if(allowed.has(record.actorUuid))await storeRecord(message,record,user);
    // Even an application capped at full HP can be undone to reopen targeting.
    await message.setFlag(MODULE_ID,"hpApplicationRecorded",true);
    await message.setFlag(MODULE_ID,"damageApplyReopened",null);
    await refreshHpUndoCard(message);
}
export async function applyManualHpWithUndo(tray,apply,event) {
    const message=tray.chatMessage;
    if(!isDamageOrHealingCard(message)||typeof tray.getMergedOptions!=="function")return apply.call(tray,event);
    if(applyingHpTrays.has(tray))return;
    applyingHpTrays.add(tray);
    const id=foundry.utils.randomID(),session={records:[],actors:new Map()};
    hpApplicationSessions.set(id,session);
    const getOptions=tray.getMergedOptions;
    tray.getMergedOptions=function(uuid) {
        const options=getOptions.call(this,uuid);
        if(options.rsaAutomaticDamage)return options;
        const actor=fromUuidSync(uuid,{strict:false})?.actor;
        if(actor?.isOwner&&actor.system.attributes?.hp&&!session.actors.has(actor.uuid))session.actors.set(actor.uuid,{actor,before:Object.fromEntries(hpKeys.map(key=>[key,Number(actor.system.attributes.hp[key]??0)]))});
        return {...options,rsaManualHpSession:id};
    };
    let result,error;
    try {result=await apply.call(tray,event);}catch(err){error=err;}
    finally {tray.getMergedOptions=getOptions;hpApplicationSessions.delete(id);applyingHpTrays.delete(tray);}
    if(session.actors.size) {
        const recorded=new Set(session.records.map(record=>record.actorUuid));
        for(const {actor,before} of session.actors.values())if(!recorded.has(actor.uuid)) {
            const record=damageUndoRecord(actor,{rsaUndoBefore:before});if(record)session.records.push(record);
        }
        const gm=game.users.activeGM;
        if(gm&&gm.id!==game.user.id)game.socket.emit(`module.${MODULE_ID}`,{action:"recordManualHpApplication",messageId:message.id,records:session.records,actorUuids:[...session.actors.keys()],userId:game.user.id,gmId:gm.id});
        else if(game.user.isGM)await enqueue(()=>storeManualHpApplication(message,session.records,[...session.actors.keys()]));
    }
    if(error)throw error;
    return result;
}
async function storeRecord(message,record,user) {
    if(!isDamageOrHealingCard(message)||!record||!user?.active)return;
    const actor=await fromUuid(record.actorUuid);
    if(!actor?.system?.attributes?.hp||(!user.isGM&&!actor.testUserPermission(user,"OWNER")))return;
    if(!Array.isArray(record.changes)||record.changes.some(change=>!hpKeys.includes(change.key)||!Number.isFinite(change.before)||!Number.isFinite(change.after)))return;
    const records=history(message);
    if(records.some(entry=>entry.id===record.id))return;
    await message.setFlag(MODULE_ID,"damageUndoHistory",[...records,record]);
    await message.setFlag(MODULE_ID,"hpApplicationRecorded",true);
    await message.setFlag(MODULE_ID,"damageApplyReopened",null);
    await refreshHpUndoCard(message);
}
export async function undoCardDamage(message) {
    if(!game.user.isGM)return;
    if(message.getFlag(MODULE_ID,"masteryGrazeUndone"))return;
    await message.setFlag(MODULE_ID,"hpApplicationRecorded",false);
    const records=[...history(message)];
    for(const record of [...records].reverse()) {
        const actor=await fromUuid(record.actorUuid);
        if(!actor){ui.notifications.warn("Cannot undo damage for an unavailable actor.");continue;}
        const updates={};
        for(const change of record.changes) {
            const current=Number(actor.system.attributes.hp[change.key]??0);
            let restored=Math.max(0,current+change.before-change.after);
            if(change.key === "temp" && current>change.after)restored=Math.max(current,change.before);
            const maximum=actor.system.attributes.hp.effectiveMax??actor.system.attributes.hp.max;
            if(change.key === "value" && Number.isFinite(maximum))restored=Math.min(maximum,restored);
            updates[`system.attributes.hp.${change.key}`]=restored;
        }
        await actor.update(updates,{rsaUndoDamage:true});
        const index=records.findIndex(entry=>entry.id===record.id);records.splice(index,1);
        await message.setFlag(MODULE_ID,"damageUndoHistory",[...records]);
    }
    if(message.getFlag(MODULE_ID,"masteryGraze")&&!history(message).length) {
        await message.setFlag(MODULE_ID,"masteryGrazeUndone",true);
        const attack=game.messages.get(message.getFlag(MODULE_ID,"damageAttackId"));
        if(attack) {
            const target=message.getFlag(MODULE_ID,"masteryGrazeTarget")??message.system.targets?.[0]?.token;
            await attack.setFlag(MODULE_ID,"masteryActions",(attack.getFlag(MODULE_ID,"masteryActions")??[]).filter(uuid=>uuid!==target));
            await ui.chat?.updateMessage(attack);
        }
    } else await message.setFlag(MODULE_ID,"damageApplyReopened",Date.now());
}
export function addDamageUndoButton(message,html) {
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=isDamageOrHealingCard(message)?[{message,root}]:[];
    for(const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const card=game.messages.get(summary.dataset.messageId);if(isDamageOrHealingCard(card))entries.push({message:card,root:summary});
    }
    for(const entry of entries) {
        if(!game.user.isGM||!entry.message.isContentVisible)continue;
        const records=history(entry.message);
        const applied=entry.message.getFlag(MODULE_ID,"hpApplicationRecorded");
        const appliedGraze=entry.message.getFlag(MODULE_ID,"masteryGraze")&&
            !entry.message.getFlag(MODULE_ID,"masteryGrazeUndone")&&(entry.message.getFlag(MODULE_ID,"automaticDamageTargets")??[]).length>0;
        if(records.length && game.settings.get("dnd5e","autoCollapseChatTrays") !== "manual")
            for(const tray of entry.root.querySelectorAll("damage-application"))tray.open=false;
        if(!records.length&&!appliedGraze&&!applied) {
            entry.root.querySelector("[data-rsa-undo-damage]")?.remove();
            if(entry.message.getFlag(MODULE_ID,"damageApplyReopened"))for(const tray of entry.root.querySelectorAll("damage-application"))tray.open=true;
            continue;
        }
        const existing=entry.root.querySelector("[data-rsa-undo-damage]");
        if(existing){existing.disabled=false;existing.hidden=false;continue;}
        const face=entry.root.querySelector(".chat-card")??entry.root;
        let controls=face.querySelector(".rsa-damage-actions");
        if(!controls){controls=document.createElement("div");controls.className="rsa-attack-actions rsa-damage-actions";face.append(controls);}
        const button=document.createElement("button");button.type="button";button.dataset.rsaUndoDamage="";
        button.innerHTML=`<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> ${isHealingCard(entry.message)?"Undo Healing":"Undo Damage"}`;
        button.addEventListener("click",event=>{
            event.preventDefault();event.stopPropagation();if(button.disabled)return;button.disabled=true;
            const finishScroll=globalThis.Ugmuls55eAutomationFollowChatChanges?.(button)??(()=>{});
            const gm=game.users.activeGM;
            if(gm&&gm.id!==game.user.id)game.socket.emit(`module.${MODULE_ID}`,{action:"undoCardDamage",messageId:entry.message.id,userId:game.user.id,gmId:gm.id});
            else enqueue(()=>undoCardDamage(entry.message)).catch(report).finally(finishScroll);
        });controls.append(button);
    }
}
function report(err){console.error("Ugmuls 5.5e Automation | Damage undo failed:",err);ui.notifications.error("Could not undo damage. Check the console.");}
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationEffectUndo={apply:applyEffectWithUndo};
    const prototype=customElements.get("effect-application")?.prototype;
    if(prototype&&typeof prototype._onApplyEffects==="function"&&!prototype.rsaUndoReapplication) {
        const original=prototype._onApplyEffects;
        prototype._onApplyEffects=function(){return applyManualEffectsWithUndo(this,original);};
        prototype.rsaUndoReapplication=true;
    }
    const hpPrototype=customElements.get("damage-application")?.prototype;
    if(hpPrototype&&typeof hpPrototype._onApplyDamage==="function"&&!hpPrototype.rsaHpUndoApplications) {
        const original=hpPrototype._onApplyDamage;
        hpPrototype._onApplyDamage=function(event){return applyManualHpWithUndo(this,original,event);};
        hpPrototype.rsaHpUndoApplications=true;
    }
    Hooks.on("dnd5e.preApplyDamage",captureDamageUndo);
    Hooks.on("dnd5e.applyDamage",(actor,amount,options)=>{
        const message=hpApplicationMessage(options);
        const record=captureAppliedHpUndo(actor,options);if(!record||!isDamageOrHealingCard(message))return;
        const gm=game.users.activeGM;
        if(gm&&gm.id!==game.user.id)game.socket.emit(`module.${MODULE_ID}`,{action:"recordDamageUndo",messageId:message.id,record,userId:game.user.id,gmId:gm.id});
        else if(game.user.isGM)enqueue(()=>storeRecord(message,record,game.user)).catch(report);
    });
    Hooks.on("dnd5e.renderChatMessage",addDamageUndoButton);
    Hooks.on("dnd5e.renderChatMessage",addEffectUndoButton);
    Hooks.on("updateChatMessage",refreshEffectActions);
    game.socket.on(`module.${MODULE_ID}`,packet=>{
        if(!game.user.isGM||packet?.gmId!==game.user.id||game.users.activeGM?.id!==game.user.id)return;
        const user=game.users.get(packet.userId),message=game.messages.get(packet.messageId);
        if(!user?.active||!message)return;
        if(packet.action==="recordReappliedEffectUndo") {
            enqueue(()=>storeReappliedEffectUndo(message,packet.records,user)).catch(report);return;
        }
        if(packet.action==="undoCardEffects"&&user.isGM&&["usage","attack","damage","healing"].includes(message.type)) {
            enqueue(()=>undoCardEffects(message)).catch(report);return;
        }
        if(!isDamageOrHealingCard(message))return;
        if(packet.action==="recordManualHpApplication") {
            enqueue(()=>storeManualHpApplication(message,packet.records,packet.actorUuids,user)).catch(report);return;
        }
        if(packet.action==="recordDamageUndo")enqueue(()=>storeRecord(message,packet.record,user)).catch(report);
        else if(packet.action==="undoCardDamage"&&user.isGM)enqueue(()=>undoCardDamage(message)).catch(report);
    });
});
