import {createEventQueue,isEligibleTarget,hasEquivalentActiveEffect,regionOwnsEffect} from "./shared-activity-card.js";
const MODULE_ID="region-spell-automation";
const enqueue=createEventQueue();
const queued=new Set();
const running=new Set();
const runningEffects=new Set();
const queuedEffects=new Set();
const liveEffectUsages=new Set();
const appliedNow=new Map();
const cancelled=new Set();
const waitingReasons=new Map();
const animationRequests=new Map();
let animationRequestId=0;
function waiting(message,reason) {
    if(waitingReasons.get(message.id)!==reason) {
        waitingReasons.set(message.id,reason);
        console.log("Region Spell Automation | Automatic damage waiting",{card:message.id,reason});
    }
    return null;
}
const originOf=message=>typeof message?.system?.origin==="string"?game.messages.get(message.system.origin):message?.system?.origin;
const authority=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
const automationEnabled=()=>["autoApplyCardDamage","autoApplySavedEffects","autoApplyHitEffects"].some(key=>game.settings.get(MODULE_ID,key)===true);
export function shouldAutoRollNpc(actor) {
    return game.settings.get(MODULE_ID,"autoRollNpcSaves")===true&&game.user.isGM&&actor?.type==="npc"&&
        !Array.from(game.users).some(user=>!user.isGM&&actor.testUserPermission(user,"OWNER"));
}
function manualKey(message){return originOf(message)??message;}
function isManual(message) {
    const origin=manualKey(message);
    return cancelled.has(origin?.id)||origin?.getFlag?.(MODULE_ID,"manualDamageWorkflow")||message.getFlag?.(MODULE_ID,"manualDamageWorkflow");
}
function attackForDamage(message) {
    const explicit=message.getFlag(MODULE_ID,"damageAttackId");if(explicit)return game.messages.get(explicit);
    const origin=originOf(message);
    return [...(origin?.getAssociatedRolls?.("attack")??[])].filter(roll=>roll.timestamp<=message.timestamp).sort((a,b)=>b.timestamp-a.timestamp)[0];
}
export async function readyDamageTargets(message) {
    if(message?.type!=="damage")return null;
    if(isManual(message))return waiting(message,"Manual card interaction stopped this workflow.");
    if(message.getFlag(MODULE_ID,"damageUndoHistory")?.length&&!message.getFlag(MODULE_ID,"automaticDamageDone"))return waiting(message,"Damage was already applied manually.");
    const origin=originOf(message);
    if(origin?.getFlag?.(MODULE_ID,"targetsConfirmationPending")||origin?.getFlag?.(MODULE_ID,"targetsConfirmationCanceled"))return null;
    const targets=[];
    for(const descriptor of message.system.targets??[]) {
        const token=descriptor.token?await fromUuid(descriptor.token):null;
        if(!token?.actor||!isEligibleTarget(token))continue;
        targets.push(descriptor);
    }
    if(!targets.length)return null;
    const applied=new Set(message.getFlag(MODULE_ID,"automaticDamageTargets")??[]);
    const remaining=selected=>{const result=selected.filter(target=>!applied.has(target.token));return result.length?result:null;};
    const activity=message.getAssociatedActivity?.();
    if(activity?.type==="save"||message.system.onSave) {
        // An unknown save outcome is pending, never assumed to be a failure.
        if(!origin?.system?.outcomes)return waiting(message,"No originating save card is available.");
        const pending=targets.filter(target=>!["success","failure"].includes(origin.system.outcomes.get(target.token)));
        if(pending.length)return waiting(message,`Waiting for ${pending.length} saving throw outcome(s).`);
        waitingReasons.delete(message.id);
        return remaining(targets);
    }
    if(activity?.type==="attack"&&!message.getFlag(MODULE_ID,"masteryGraze")) {
        const attack=attackForDamage(message);if(!attack)return null;
        const hits=new Set((attack.system.evaluatedTargets??[]).filter(target=>target.isMiss===false).map(target=>target.token));
        return remaining(targets.filter(target=>hits.has(target.token)));
    }
    return remaining(targets);
}
export async function applyAutomaticDamage(message) {
    if(!authority()||game.settings.get(MODULE_ID,"autoApplyCardDamage")!==true||running.has(message.id))return;
    const targets=await readyDamageTargets(message);if(!targets)return;
    running.add(message.id);appliedNow.set(message.id,new Set());
    let holder;
    try {
        await waitForWorkflowAnimations(message);
        if(isManual(message)||game.settings.get(MODULE_ID,"autoApplyCardDamage")!==true)return;
        const latest=await readyDamageTargets(message);
        if(!latest||latest.map(t=>t.token).join()!==targets.map(t=>t.token).join())return;
        // Use a native tray so saves, damage types, resistance, vulnerability,
        // immunity, evasion and other system/module calculations remain native.
        holder=document.createElement("div");holder.dataset.messageId=message.id;holder.style.display="none";
        const tray=document.createElement("damage-application");holder.append(tray);document.body.append(holder);
        if(!tray.targetList||typeof tray._onApplyDamage!=="function")throw Error("Native damage application tray is unavailable.");
        message._targetState.mode="targeted";
        message._targetState.checked??=new Map();
        const selected=new Set(targets.map(target=>target.token));
        for(const target of message.system.targets??[])message._targetState.checked.set(target.token,selected.has(target.token));
        const buildEntry=tray.targetList.onBuildTargetListEntry;
        if(typeof buildEntry!=="function")throw Error("Native target filtering is unavailable.");
        tray.targetList.onBuildTargetListEntry=(list,target)=>selected.has(target.uuid)?buildEntry(list,target):null;
        tray.open=true;
        tray.targetList.targetingMode="targeted";
        // Native recorded-targets skips building while invisible or suspended.
        // These attributes activate its logic; the holder stays hidden on screen.
        tray.visible=true;
        tray.targetList.suspended=false;
        tray.targetList.visible=true;
        tray.targetList.buildTargetsList();
        const options=tray.getMergedOptions.bind(tray);
        tray.getMergedOptions=uuid=>({...options(uuid),rsaAutomaticDamage:true,rsaAutoDamageToken:uuid});
        // Claim before applying so rerenders/save updates cannot apply twice.
        await message.setFlag(MODULE_ID,"automaticDamageDone",true);
        if(isManual(message))return;
        console.log("Region Spell Automation | Applying automatic damage",{card:message.id,targets:targets.length});
        await tray._onApplyDamage({preventDefault(){}});
        const completed=appliedNow.get(message.id);
        await message.setFlag(MODULE_ID,"automaticDamageTargets",[...new Set([...(message.getFlag(MODULE_ID,"automaticDamageTargets")??[]),...completed])]);
        if(completed.size<targets.length && !isManual(message)) {
            console.warn("Region Spell Automation | Automatic damage stopped before all targets were applied",{card:message.id,expected:targets.length,applied:completed.size});
            await stopAutomaticDamage(message);
        }
    } catch(err) {
        cancelled.add(manualKey(message).id);
        await message.setFlag(MODULE_ID,"manualDamageWorkflow",true);
        console.error("Region Spell Automation | Automatic damage application failed:",err);
        ui.notifications.error("Automatic damage stopped. Check the card and apply any remaining damage manually.");
    } finally {holder?.remove();running.delete(message.id);appliedNow.delete(message.id);}
}
export async function waitForDamageAnimation(message,extraAnimation) {
    // Background clients can pause DSN rendering. Damage resolution must not
    // depend on a GM watching the animation on their own screen.
    if(document.hidden)return;
    let onVisibility;
    const hidden=new Promise(resolve=>{
        onVisibility=()=>{if(document.hidden)resolve();};
        document.addEventListener("visibilitychange",onVisibility);
        onVisibility();
    });
    try {
        const animation=(async()=>{
            await Promise.all([extraAnimation,globalThis.RegionSpellAutomationRollVisualWait?.(message)]);
            await globalThis.RegionSpellAutomationDamage?.waitForAttackAnimation?.(message);
        })();
        await Promise.race([hidden,animation]);
    } finally {document.removeEventListener("visibilitychange",onVisibility);}
}
export async function waitForWorkflowAnimations(message) {
    const origin=originOf(message);
    const usage=origin??message;
    const rolls=[...(message.type==="usage"?(message.getAssociatedRolls?.("damage")??[]):[message]),...(usage.getAssociatedRolls?.("save")??[])];
    const rollIds=[...new Set(rolls.map(roll=>roll.id))];
    const others=Array.from(game.users).filter(user=>user.active&&user.id!==game.user.id);
    let requestId;
    const remote=others.length?new Promise((resolve,reject)=>{
        requestId=`${game.user.id}-${message.id}-${++animationRequestId}`;
        const pending=new Set(others.map(user=>user.id));
        const cleanup=()=>{clearTimeout(timeout);clearInterval(disconnects);animationRequests.delete(requestId);};
        const finish=()=>{if(!pending.size){cleanup();resolve();}};
        // A disconnected client cannot finish an animation. A connected but
        // unresponsive client leaves the card manual rather than applying early.
        const disconnects=setInterval(()=>{for(const id of pending)if(!game.users.get(id)?.active)pending.delete(id);finish();},500);
        const timeout=setTimeout(()=>{cleanup();reject(Error("A connected client did not confirm dice animation completion. Refresh clients and apply this card manually."));},30000);
        animationRequests.set(requestId,{pending,finish});
        game.socket.emit(`module.${MODULE_ID}`,{action:"waitDamageAnimations",requestId,gmId:game.user.id,rollIds});
    }):Promise.resolve();
    await Promise.all([remote,...rolls.map(roll=>waitForDamageAnimation(roll))]);
}
export async function applyOutcomeEffects(card) {
    if(!authority()||runningEffects.has(card.id)||isManual(card))return;
    const usage=card.type==="usage"?card:originOf(card);
    if(!usage||usage.getFlag?.(MODULE_ID,"targetsConfirmationPending")||usage.getFlag?.(MODULE_ID,"targetsConfirmationCanceled"))return;
    const activity=usage.getAssociatedActivity?.({scaled:true});
    const saving=activity?.type==="save";
    const setting=saving?"autoApplySavedEffects":"autoApplyHitEffects";
    if((!saving&&card.type!=="attack")||game.settings.get(MODULE_ID,setting)!==true)return;
    const effects=await activity?.getApplicableEffects?.()??[];
    if(!effects.length)return;
    const prior=new Set(card.getFlag(MODULE_ID,"automaticEffectApplications")??[]);
    const targets=[];
    for(const descriptor of (saving?usage:card).system.targets??[]) {
        const token=descriptor.token?await fromUuid(descriptor.token):null;
        if(token?.actor&&isEligibleTarget(token))targets.push({descriptor,actor:token.actor});
    }
    if(!targets.length)return;
    if(targets.every(({descriptor})=>effects.every(effect=>prior.has(JSON.stringify([descriptor.token,effect.uuid])))))return;
    if(saving&&targets.some(({descriptor})=>!["success","failure"].includes(usage.system.outcomes?.get(descriptor.token))))return;
    // Save effects share the damage handoff when automatic damage is enabled.
    // Effects-only saves, and saves with manual damage, resolve independently.
    if(saving&&game.settings.get(MODULE_ID,"autoApplyCardDamage")===true&&activity.damage?.parts?.length) {
        const damages=usage.getAssociatedRolls?.("damage")??[];
        if(!damages.length||damages.some(damage=>targets.some(({descriptor})=>
            damage.system.targets?.some(target=>target.token===descriptor.token)&&
            !(damage.getFlag(MODULE_ID,"automaticDamageTargets")??[]).includes(descriptor.token))))return;
    }
    if(runningEffects.has(card.id))return;
    runningEffects.add(card.id);
    try {
        await waitForWorkflowAnimations(card);
        if(isManual(card)||game.settings.get(MODULE_ID,setting)!==true)return;
        const currentTargets=(saving?usage:card).system.targets??[];
        if(targets.some(({descriptor})=>!currentTargets.some(target=>target.token===descriptor.token)))return;
        if(saving&&currentTargets.some(target=>!["success","failure"].includes(usage.system.outcomes?.get(target.token))))return;
        const hits=new Set((card.system.evaluatedTargets??[]).filter(target=>target.isMiss===false).map(target=>target.token));
        const ledger=new Set(card.getFlag(MODULE_ID,"automaticEffectApplications")??[]);
        const tray=document.createElement("effect-application");tray.chatMessage=usage;
        if(typeof tray._applyEffectToActor!=="function")throw Error("Native effect application is unavailable.");
        for(const {descriptor,actor} of targets) {
            if(!saving&&!hits.has(descriptor.token))continue;
            for(const effect of effects) {
                const profile=activity.effects?.find(profile=>profile.uuid===effect.uuid||profile._id===effect.id);
                if(saving&&usage.system.outcomes.get(descriptor.token)==="success"&&profile?.onSave!==true)continue;
                const key=JSON.stringify([descriptor.token,effect.uuid]);
                if(ledger.has(key))continue;
                if(isManual(card)||game.settings.get(MODULE_ID,setting)!==true)return;
                // Persist after each effect so partial progress cannot duplicate
                // successful applications on the next card refresh.
                const token=await fromUuid(descriptor.token);
                const existing=hasEquivalentActiveEffect(actor,effect)||regionOwnsEffect(token,effect);
                if(!existing) {
                    const undo=globalThis.RegionSpellAutomationEffectUndo;
                    if(undo)await undo.apply(card,usage,effect,actor,tray);
                    else await tray._applyEffectToActor(effect,actor);
                }
                ledger.add(key);await card.setFlag(MODULE_ID,"automaticEffectApplications",[...ledger]);
            }
        }
        if(ledger.size&&!usage.getFlag(MODULE_ID,"outcomeEffectsApplied"))await usage.setFlag(MODULE_ID,"outcomeEffectsApplied",true);
    } catch(err) {
        await stopAutomaticDamage(card);
        console.error("Region Spell Automation | Automatic outcome effects failed:",err);
        ui.notifications.error("Automatic effects stopped. Use the card's Apply Effect control for any remaining effects.");
    } finally {runningEffects.delete(card.id);}
}
function scheduleEffects(message) {
    if(!authority()||!automationEnabled())return;
    const usage=message.type==="usage"?message:originOf(message);
    if(!usage)return;
    const cards=usage.getAssociatedActivity?.()?.type==="save"?[usage]:usage.getAssociatedRolls?.("attack")??[];
    for(const card of cards) {
        if(queuedEffects.has(card.id))continue;
        queuedEffects.add(card.id);
        setTimeout(()=>{queuedEffects.delete(card.id);enqueue(()=>applyOutcomeEffects(card)).catch(console.error);},100);
    }
}
async function receiveAnimationRequest(packet) {
    if(packet.gmId!==game.users.activeGM?.id||typeof packet.requestId!=="string"||!Array.isArray(packet.rollIds))return;
    // Let DSN's create-message hook establish its animation state first.
    await new Promise(resolve=>setTimeout(resolve,100));
    const rolls=packet.rollIds.map(id=>game.messages.get(id)).filter(message=>message&&message.visible!==false&&message.isContentVisible!==false);
    await Promise.all(rolls.map(roll=>waitForDamageAnimation(roll)));
    game.socket.emit(`module.${MODULE_ID}`,{action:"damageAnimationsComplete",requestId:packet.requestId,gmId:packet.gmId,userId:game.user.id});
}
function schedule(message) {
    if(!authority()||game.settings.get(MODULE_ID,"autoApplyCardDamage")!==true||message?.type!=="damage"||queued.has(message.id))return;
    queued.add(message.id);
    setTimeout(()=>{
        queued.delete(message.id);
        enqueue(()=>applyAutomaticDamage(message)).catch(console.error);
    },100);
}
export async function stopAutomaticDamage(clicked,user=game.user) {
    if(!clicked||!automationEnabled())return;
    const origin=manualKey(clicked);cancelled.add(origin.id);
    if(authority())await origin.setFlag(MODULE_ID,"manualDamageWorkflow",true);
    else if(game.users.activeGM)game.socket.emit(`module.${MODULE_ID}`,{action:"stopAutomaticDamage",clickedId:clicked.id,userId:user.id,gmId:game.users.activeGM.id});
}
Hooks.once("init",()=>{
    for(const [key,name,hint]of [
        ["autoRollNpcSaves","Automatically Roll GM NPC Saves","Resolve prompted saves for GM-run NPCs with native recommended advantage/disadvantage. Player-owned NPCs remain manual."],
        ["magicResistanceSaves","Magic Resistance Saving Throws","Recognize the Magic Resistance feature and recommend advantage against spells or features marked Magical. Combines with other advantage/disadvantage sources, including Automated Conditions."],
        ["autoApplyCardDamage","Auto Apply Damage","Apply damage for all casters/attackers after all recorded saves resolve. Non-save attacks apply to hit targets only. Manual card interaction stops automation."],
        ["autoApplySavedEffects","Auto Apply Saved Effects","After every required save and dice animation finishes, apply assigned activity effects on failed saves, and effects marked On Save on successful saves. Runs with automatic damage when enabled, or independently when damage is manual."],
        ["autoApplyHitEffects","Autoapply Status on Hit","Apply configured attack activity effects to hit targets after the attack dice finish. Misses remain unaffected. Uses native effect durations and concentration."]
    ])game.settings.register(MODULE_ID,key,{name,hint,scope:"world",config:true,type:Boolean,default:true});
});
Hooks.once("ready",()=>{
    globalThis.RegionSpellAutomationNpcDamage={shouldAutoRollNpc,waitForWorkflowAnimations,waitForDamageAnimation};

    Hooks.on("dnd5e.preRollD20TestV2",(config,dialog)=>{if(config.rsaAutoNpcSave)dialog.configure=false;});
    for(const event of ["createChatMessage","updateChatMessage"])Hooks.on(event,(message)=>{
        if(message.type==="damage")schedule(message);
        const origin=originOf(message);
        for(const damage of origin?.getAssociatedRolls?.("damage")??message.getAssociatedRolls?.("damage")??[])schedule(damage);
        const usage=message.type==="usage"?message:originOf(message);
        // Rendering chat history alone must not apply old spell conditions.
        if(event==="createChatMessage"&&usage)liveEffectUsages.add(usage.id);
        if(usage&&liveEffectUsages.has(usage.id))scheduleEffects(message);
    });
    // Save completion refreshes native damage HTML without updating the document.
    Hooks.on("renderChatMessageHTML",message=>{
        if(message.type==="damage")schedule(message);
        const usage=message.type==="usage"?message:originOf(message);
        if(usage&&liveEffectUsages.has(usage.id))scheduleEffects(message);
    });
    Hooks.on("dnd5e.applyDamage",(actor,amount,options)=>{
        const message=options.origin??options.originatingMessage;
        if(options.rsaAutomaticDamage&&options.rsaAutoDamageToken)appliedNow.get(message?.id)?.add(options.rsaAutoDamageToken);
    });
    Hooks.on("dnd5e.preApplyDamage",(actor,amount,updates,options)=>{
        const message=options.origin??options.originatingMessage;
        if(message?.type!=="damage")return;
        if(options.rsaAutomaticDamage) {if(isManual(message)||game.settings.get(MODULE_ID,"autoApplyCardDamage")!==true)return false;}
        else stopAutomaticDamage(message).catch(console.error);
    });
    const manualInteraction=event=>{
        if(event.isTrusted===false)return;
        const interactive=event.target.closest?.("button,a,input,select,label,target-pill,[data-action]");if(!interactive)return;
        // Retrying an unanswered save continues the automatic workflow.
        if(interactive.closest("[data-rsa-reprompt-save]"))return;
        const id=interactive.closest("[data-message-id]")?.dataset.messageId;
        const message=game.messages.get(id);if(message)stopAutomaticDamage(message).catch(console.error);
    };
    for(const event of ["click","contextmenu","change"])document.addEventListener(event,manualInteraction,{capture:true});
    game.socket.on(`module.${MODULE_ID}`,packet=>{
        if(packet?.action==="waitDamageAnimations") {
            receiveAnimationRequest(packet).catch(console.error);return;
        }
        if(packet?.action==="damageAnimationsComplete") {
            if(!authority()||packet.gmId!==game.user.id||!game.users.get(packet.userId)?.active)return;
            const request=animationRequests.get(packet.requestId);
            request?.pending.delete(packet.userId);request?.finish();return;
        }
        if(packet?.action!=="stopAutomaticDamage"||!authority()||packet.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId),message=game.messages.get(packet.clickedId);
        if(!user?.active||!message)return;
        const origin=manualKey(message);
        const allowed=user.isGM||message.author?.id===user.id||message.getAssociatedActor?.()?.testUserPermission(user,"OWNER")||
            (origin.system.targets??[]).some(target=>fromUuidSync(target.actor,{strict:false})?.testUserPermission(user,"OWNER"));
        if(allowed)stopAutomaticDamage(message,user).catch(console.error);
    });
});
