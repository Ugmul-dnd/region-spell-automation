import {describeTarget,hasEquivalentActiveEffect,regionOwnsEffect} from "./shared-activity-card.js";
import {stunningTarget} from "./stunning-strike.js";
import {sendSavePrompt} from "./save-prompts.js";
const ID="ugmuls-5-5e-automation",selections=new WeakMap(),pending=new WeakMap(),reserved=new Map(),applying=new Set(),scheduled=new Set();
const enabled=()=>game.settings.get(ID,"grappleAutomation")===true;
const grapplerEnabled=()=>game.settings.get(ID,"grapplerAutomation")===true;
const stamp=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
const active=effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true;
const actorFor=app=>(app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;
const cardFor=app=>globalThis.Ugmuls55eAutomationPendingDamage?.pendingCard?.(app);
const originFor=app=>{const origin=app.message?.data?.system?.origin;return typeof origin==="string"?game.messages.get(origin):origin;};
const feature=(actor,id,name)=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&((item.identifier??item.system?.identifier)===id||name.test(item.name?.trim()??"")));
export const grapplerFeature=actor=>feature(actor,"grappler",/^grappler$/i);
export function unarmedAction(app){
    const activity=app.config?.subject,item=activity?.item,actor=actorFor(app);
    if(activity?.type!=="attack"||!actor?.isOwner||app.message?.data?.flags?.[ID]?.masteryGraze)return false;
    const unarmed=activity.attack?.type?.classification==="unarmed"||item?.system?.type?.value==="unarmed"||
        ["unarmed-strike","empowered-strike","elemental-strike"].includes(item?.identifier??item?.system?.identifier)||
        /^(unarmed|empowered|elemental) strikes?$/i.test(item?.name?.trim()??"");
    const activation=originFor(app)?.system?.activation?.type??activity.activation?.type??item?.system?.activation?.type;
    if(!unarmed||activation!=="action")return false;
    if(game.combat?.started){
        const participants=Array.from(game.combat.combatants??[]).filter(entry=>entry.actor?.uuid===actor.uuid);
        if(participants.length&&!participants.some(entry=>entry.id===game.combat.combatant?.id))return false;
    }
    return true;
}
export function bestGrappleSave(actor){
    const value=key=>Number(actor?.system?.abilities?.[key]?.save?.value??actor?.system?.abilities?.[key]?.mod??0);
    return value("dex")>value("str")?"dex":"str";
}
export function grappleDC(actor){
    const abilities=actor.system?.abilities??{},str=Number(abilities.str?.mod??0),dex=Number(abilities.dex?.mod??0);
    const martial=feature(actor,"martial-arts",/^martial arts$/i);
    return 8+Number(actor.system?.attributes?.prof??0)+(martial?Math.max(str,dex):str);
}
export function grapplerUsed(actor){
    const current=stamp();return !!current&&(reserved.has(actor?.uuid)||Array.from(actor?.effects??[]).some(effect=>active(effect)&&effect.getFlag?.(ID,"grapplerTurn")===current));
}
export function keepsGrappleDamage(app){return grapplerEnabled()&&selections.get(app)==="grapple"&&!!grapplerFeature(actorFor(app))&&!grapplerUsed(actorFor(app));}
export function replacesGrappleDamage(app){
    if(pending.has(app))return pending.get(app).noDamage;
    if(cardFor(app)?.getFlag(ID,"grappleSave"))return cardFor(app).getFlag(ID,"grappleNoDamage")===true;
    return enabled()&&unarmedAction(app)&&["grapple","prone"].includes(selections.get(app))&&!keepsGrappleDamage(app);
}
export function addGrappleChoice(app){
    if(!enabled()||!unarmedAction(app)||app.element.querySelector('[data-rsa-grapple]'))return;
    const linked=cardFor(app)?.getFlag(ID,"grappleSave"),actor=actorFor(app);
    if(!selections.has(app))selections.set(app,linked?cardFor(app).getFlag(ID,"grappleMode"):"no");
    const target=stunningTarget(app),disabled=!target||!!linked;
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{key:"grapple",label:"Grapple / Prone",disabled});
    if(!group)return;group.dataset.rsaGrapple="";
    const select=document.createElement("select");select.setAttribute("aria-label","Grapple / Prone");select.disabled=disabled;
    for(const [value,text] of [["no","No"],["grapple","Grapple"],["prone","Prone"]]){const option=document.createElement("option");option.value=value;option.textContent=text;select.append(option);}
    select.value=selections.get(app);select.addEventListener("change",event=>{event.stopPropagation();selections.set(app,select.value);app.rebuild();});group.querySelector("select").replaceWith(select);
    const info=document.createElement("i");info.className="fas fa-circle-info";info.style.marginLeft="0.3em";
    info.dataset.tooltip=`The target saves with its higher Strength or Dexterity save (Strength on a tie), against DC ${grappleDC(actor)}. Failure applies Grappled or Prone. These options replace damage. ${grapplerEnabled()?"Grappler allows damage plus Grapple once on your turn; it never adds damage to Prone.":"Grappler feat automation is disabled, so Grapple replaces damage."} Grappling requires a free hand and a target no more than one size larger than you.`;
    group.querySelector("label").append(info);
    if(grapplerEnabled()&&grapplerFeature(actor)){const note=document.createElement("p");note.className="hint";note.textContent=grapplerUsed(actor)?"Grappler already used: further Grapple / Prone attempts replace damage.":"Grappler available: Grapple keeps damage once this turn.";group.append(note);}
}
export function finalizeGrapple(app,rolls,{preview=false}={}){
    if(!enabled()||!unarmedAction(app)||!["grapple","prone"].includes(selections.get(app)))return rolls;
    const existing=cardFor(app)?.getFlag(ID,"grappleSave"),entry=pending.get(app);
    const noDamage=entry?.noDamage??replacesGrappleDamage(app);
    if(!preview&&!existing&&!entry){
        const actor=actorFor(app),target=stunningTarget(app);if(!target)throw Error("Grapple / Prone requires a confirmed unarmed hit against one target.");
        const keep=!noDamage;
        if(keep&&reserved.has(actor.uuid))throw Error("Another Grappler attack is being submitted.");
        if(keep)reserved.set(actor.uuid,app);
        pending.set(app,{actor,target,mode:selections.get(app),noDamage,stamp:stamp(),combat:game.combat?.id});
    }
    if(!noDamage)return rolls;
    // A deterministic zero keeps the existing pending-card publication intact,
    // without rolling damage dice or spending any damage-rider resources.
    return [new CONFIG.Dice.DamageRoll("0",{}, {...rolls[0]?.options,isCritical:false,configured:true,rsaGrappleNoDamage:true})];
}
export function grappleItemData(actor,target,mode,img){
    const condition=mode==="prone"?"prone":"grappled",effectId=foundry.utils.randomID(),activityId=foundry.utils.randomID();
    const status=foundry.utils.deepClone(CONFIG.statusEffects?.[condition]??{});
    delete status.id;delete status._id;
    const effect={...status,_id:effectId,name:mode==="prone"?"Prone":"Grappled",img:status.img??img,disabled:false,transfer:false,statuses:[condition],
        flags:{...status.flags,...(mode==="grapple"?{dnd5e:{...status.flags?.dnd5e,isTemporary:true}}:{}),[ID]:{grappleCaster:actor.uuid,grappleMode:mode}}};
    return {_id:foundry.utils.randomID(),name:mode==="prone"?"Unarmed Strike — Prone":"Unarmed Strike — Grapple",type:"feat",img,
        system:{identifier:"rsa-unarmed-"+mode,activation:{type:"special"},activities:{[activityId]:{_id:activityId,name:mode==="prone"?"Prone Save":"Grapple Save",type:"save",
            activation:{type:"special",override:true},target:{affects:{type:"creature",count:"1",choice:false}},damage:{onSave:"none",parts:[]},
            save:{ability:[bestGrappleSave(target.actor)],dc:{calculation:"",formula:String(grappleDC(actor))},visible:true},effects:[{_id:effectId,onSave:false}]}}},effects:[effect]};
}
export async function commitGrapple(app,options){
    const entry=pending.get(app);if(!entry)return;
    try{
        if(!options?.dnd5e?.submitted)return;
        const {actor,target,mode,noDamage}=entry,damage=cardFor(app);
        const stunningId=app.message.data.flags?.[ID]?.stunningStrikeSave??damage?.getFlag(ID,"stunningStrikeSave");
        const data=grappleItemData(actor,target,mode,app.config.subject.item.img);
        const item=new CONFIG.Item.documentClass(data,{parent:actor});
        const activity=Array.from(item.system.activities)[0];
        const results=await activity.use({consume:false,subsequentActions:false},{configure:false},{data:{speaker:app.message.data.speaker,
            system:{targets:[describeTarget(target)]},flags:{dnd5e:{item:{data}},[ID]:{riderTriggered:true,grappleStrike:{damageId:damage?.id,targetToken:target.uuid,casterActor:actor.uuid,mode,noDamage,stunningId}}}}});
        if(!results?.message?.id)throw Error("Could not create the Grapple / Prone save card.");
        const flags={grappleSave:results.message.id,grappleMode:mode,grappleNoDamage:noDamage};
        app.message.data.flags??={};app.message.data.flags[ID]??={};Object.assign(app.message.data.flags[ID],flags);
        if(damage)await damage.update({flags:{[ID]:flags}});
        if(!noDamage&&entry.stamp){
            const marker={name:"Grappler - used",img:grapplerFeature(actor)?.img,disabled:false,transfer:false,system:{changes:[]},flags:{[ID]:{grapplerTurn:entry.stamp,grapplerCombat:entry.combat}}};
            if(globalThis.Ugmuls55eAutomationResources?.reuseMarker)await globalThis.Ugmuls55eAutomationResources.reuseMarker(actor,marker,"grapplerTurn");
            else await actor.createEmbeddedDocuments("ActiveEffect",[marker]);
        }
    }finally{pending.delete(app);if(reserved.get(entry.actor.uuid)===app)reserved.delete(entry.actor.uuid);}
}
const authority=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
const releasing=new Set();
export function deferGrappleSave(message){return !!message?.getFlag?.(ID,"grappleStrike")?.stunningId&&!message.getFlag(ID,"grappleSaveReleased");}
export function targetStunned(actor){return actor?.statuses?.has?.("stunned")||Array.from(actor?.effects??[]).some(effect=>active(effect)&&effect.statuses?.has?.("stunned"));}
export async function releaseGrappleSave(usage){
    const link=usage?.getFlag?.(ID,"grappleStrike");
    if(!authority()||!link?.stunningId||usage.getFlag(ID,"grappleSaveReleased")||releasing.has(usage.id)||usage.system.outcomes?.has(link.targetToken))return;
    const stunning=game.messages.get(link.stunningId),outcome=stunning?.system.outcomes?.get(link.targetToken);
    if(!["success","failure"].includes(outcome))return;
    const damage=game.messages.get(link.damageId);if(damage?.getFlag(ID,"pendingDamage"))return;
    releasing.add(usage.id);
    try{
        await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(stunning);
        if(outcome==="failure"&&game.settings.get(ID,"autoApplySavedEffects")===true&&!stunning.getFlag(ID,"manualDamageWorkflow")){
            await globalThis.Ugmuls55eAutomationStunning?.applyStunningOutcome(stunning);
            if(!stunning.getFlag(ID,"outcomeEffectsApplied"))return;
        }
        const token=await fromUuid(link.targetToken);if(!token?.actor)return;
        if(targetStunned(token.actor)){
            const activity=usage.getAssociatedActivity(),ability=Array.from(activity.save.ability)[0],dc=Number(activity.save.dc.value);
            const roll=await new CONFIG.Dice.D20Roll(String(dc-1),{},{target:dc}).evaluate();
            const result=await ChatMessage.create({type:"save",speaker:ChatMessage.getSpeaker({actor:token.actor,scene:token.parent,token}),
                flavor:"Stunned — Automatic Failure",rolls:[roll],system:{...activity.messageSources,origin:usage.id,ability},flags:{[ID]:{automaticGrappleFailure:true}}});
            await usage.system.onDescendentRefresh?.(result);
            await usage.setFlag(ID,"grappleSaveReleased",true);
        }else{
            await usage.setFlag(ID,"grappleSaveReleased",true);
            try{await sendSavePrompt(usage,token,"spell");}catch(error){await usage.setFlag(ID,"grappleSaveReleased",false);throw error;}
        }
    }finally{releasing.delete(usage.id);}
}
export function grappleSaveReady(damage){
    const id=damage?.getFlag?.(ID,"grappleSave");if(!id)return true;
    const save=game.messages.get(id),target=save?.getFlag?.(ID,"grappleStrike")?.targetToken;
    return !!target&&["success","failure"].includes(save.system.outcomes?.get(target));
}
export async function applyGrappleOutcome(usage,{manual=false}={}){
    const link=usage?.getFlag?.(ID,"grappleStrike");
    if(!authority()||!link||applying.has(usage.id)||usage.getFlag(ID,"outcomeEffectsApplied")||!manual&&(game.settings.get(ID,"autoApplySavedEffects")!==true||usage.getFlag(ID,"manualDamageWorkflow")))return;
    if(usage.system.outcomes?.get(link.targetToken)!=="failure")return;
    const damage=game.messages.get(link.damageId);
    if(!manual&&damage&&(damage.getFlag(ID,"pendingDamage")||!link.noDamage&&game.settings.get(ID,"autoApplyCardDamage")===true&&
        !(damage.getFlag(ID,"automaticDamageTargets")??[]).includes(link.targetToken)&&!damage.getFlag(ID,"hpApplicationRecorded")))return;
    const token=await fromUuid(link.targetToken),actor=token?.actor;if(!actor)return;
    applying.add(usage.id);
    try{
        await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(usage);
        const tray=document.createElement("effect-application");tray.chatMessage=usage;
        const prepare=tray._prepareEffectData;
        if(prepare)tray._prepareEffectData=async function(effect,target){
            const operation=await prepare.call(this,effect,target);
            // Grappled/Prone persist until released or removed, rather than
            // inheriting the instantaneous helper activity duration.
            operation.data.duration={rounds:null,turns:null,seconds:null,value:null,expiry:null,expired:false};
            operation.data.system??={};operation.data.system.origin={...operation.data.system.origin,actor:link.casterActor};
            if(link.mode==="grapple"){operation.data.flags??={};operation.data.flags.dnd5e={...operation.data.flags.dnd5e,isTemporary:true};}
            return operation;
        };
        const effects=Array.from(usage.getAssociatedItem()?.effects??[]);
        for(const effect of effects){
            const alreadyGrappled=link.mode==="grapple"&&Array.from(actor.effects??[]).some(existing=>active(existing)&&existing.getFlag?.(ID,"grappleCaster")===link.casterActor&&existing.getFlag?.(ID,"grappleMode")==="grapple");
            if(alreadyGrappled||link.mode!=="grapple"&&(hasEquivalentActiveEffect(actor,effect)||regionOwnsEffect(token,effect)))continue;
            const undo=globalThis.Ugmuls55eAutomationEffectUndo;
            if(undo)await undo.apply(usage,usage,effect,actor,tray);else await tray._applyEffectToActor(effect,actor);
        }
        await usage.setFlag(ID,"outcomeEffectsApplied",true);await usage.setFlag(ID,"effectApplyReopened",null);
    }finally{applying.delete(usage.id);}
}
export function renderGrapple(message,html){
    const root=html?.[0]??html;if(!root?.querySelector)return;
    const entries=[{message,root},...Array.from(root.querySelectorAll('.card-summary[data-message-id]'),node=>({message:game.messages.get(node.dataset.messageId),root:node}))];
    for(const entry of entries)if(entry.message?.getFlag?.(ID,"automaticGrappleFailure")){
        const total=entry.root.querySelector('.dice-total,.dice-roll .total');if(total)total.textContent="Stunned — Failure";
    }
    const noDamage=[...(message.getFlag?.(ID,"grappleNoDamage")?[root]:[])];
    for(const node of root.querySelectorAll('.card-summary[data-message-id]'))if(game.messages.get(node.dataset.messageId)?.getFlag?.(ID,"grappleNoDamage"))noDamage.push(node);
    for(const entry of noDamage){
        entry.querySelectorAll('damage-application,.dice-roll,[data-rsa-damage-modes]').forEach(node=>node.hidden=true);
        const rollRow=entry.querySelector('.dice-roll')?.closest('.icon-row');if(rollRow)rollRow.hidden=true;
        if(!entry.querySelector('[data-rsa-no-grapple-damage]')){const note=document.createElement("p");note.dataset.rsaNoGrappleDamage="";note.textContent="Grapple / Prone — replaces damage";(entry.querySelector('.chat-card')??entry).append(note);}
    }
    const link=message.getFlag?.(ID,"grappleStrike");if(!link)return;
    if(deferGrappleSave(message)){
        root.querySelectorAll('[data-action="rollSave"],[data-forward-action="rollSave"]').forEach(button=>button.hidden=true);
        if(!root.querySelector('[data-rsa-grapple-waiting]')){const note=document.createElement("p");note.dataset.rsaGrappleWaiting="";note.textContent="Waiting for Stunning Strike…";(root.querySelector('.chat-card')??root).append(note);}
    }
    root.querySelectorAll('effect-application').forEach(tray=>tray.hidden=true);
    if(!game.user.isGM||message.getFlag(ID,"outcomeEffectsApplied")){root.querySelector('[data-rsa-grapple-effects]')?.remove();return;}
    if(root.querySelector('[data-rsa-grapple-effects]'))return;
    const button=document.createElement("button");button.type="button";button.dataset.rsaGrappleEffects="";button.textContent=link.mode==="prone"?"Apply Prone Effects":"Apply Grapple Effects";
    button.disabled=message.system.outcomes?.get(link.targetToken)!=="failure";
    button.addEventListener("click",async()=>{button.disabled=true;try{await applyGrappleOutcome(message,{manual:true});}catch(error){report(error);}finally{if(message.getFlag(ID,"outcomeEffectsApplied"))button.remove();else button.disabled=false;}});
    (root.querySelector('.chat-card')??root).append(button);
}
function schedule(card){
    if(!authority())return;const origin=typeof card?.system?.origin==="string"?game.messages.get(card.system.origin):card?.system?.origin;
    let usage=card?.getFlag?.(ID,"grappleStrike")?card:game.messages.get(card?.getFlag?.(ID,"grappleSave"))??(origin?.getFlag?.(ID,"grappleStrike")?origin:null);
    if(!usage){const stun=card?.getFlag?.(ID,"stunningStrike")??origin?.getFlag?.(ID,"stunningStrike");const damage=game.messages.get(stun?.damageId);usage=game.messages.get(damage?.getFlag(ID,"grappleSave"));}
    if(!usage||scheduled.has(usage.id))return;scheduled.add(usage.id);
    setTimeout(()=>{scheduled.delete(usage.id);releaseGrappleSave(usage).then(()=>applyGrappleOutcome(usage)).catch(report);},100);
}
export async function resetGrappler(combat,changes={},ending=false){
    if(!authority()||!ending&&!("turn" in changes||"round" in changes||"started" in changes))return;
    const current=combat.started?`${combat.id}:${combat.round}:${combat.turn}`:null;
    for(const actor of new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor])).values()){
        const updates=Array.from(actor.effects??[]).filter(effect=>active(effect)&&effect.getFlag?.(ID,"grapplerCombat")===combat.id&&(ending||effect.getFlag(ID,"grapplerTurn")!==current)).map(effect=>({_id:effect.id,disabled:true}));
        if(updates.length)await actor.updateEmbeddedDocuments("ActiveEffect",updates);
    }
}
export function grapplerAdvantage(actor,target){
    return grapplerEnabled()&&!!grapplerFeature(actor)&&Array.from(target?.effects??[]).some(effect=>active(effect)&&effect.getFlag?.(ID,"grappleCaster")===actor.uuid&&effect.getFlag?.(ID,"grappleMode")==="grapple");
}
let conditionBridge=false;
export function registerGrapplerConditions(api=globalThis.ac5e?.usageRules){
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try{conditionBridge=!!api.register({key:"rsaGrappler",scope:"universal",hook:"attack",target:"subject",mode:"advantage",name:"Grappler",persistent:false,
        evaluate:sandbox=>grapplerAdvantage(fromUuidSync(sandbox.actorUuid,{strict:false}),fromUuidSync(sandbox.opponentUuid,{strict:false})?.actor)});}catch(error){conditionBridge=false;console.warn("Ugmuls 5.5e Automation | Grappler conditions:",error);}return conditionBridge;
}
export function grapplerAttackDefaults(config,dialog,message){
    if(conditionBridge&&game.modules?.get("automated-conditions-5e")?.active||config.subject?.type!=="attack")return;
    const actor=config.subject.actor??config.subject.item?.actor,targets=message?.data?.system?.targets??Array.from(game.user.targets??[],token=>({token:(token.document??token).uuid}));
    if(targets.length!==1||!grapplerAdvantage(actor,fromUuidSync(targets[0].token,{strict:false})?.actor))return;
    config.advantage=true;
    for(const roll of config.rolls??[]){roll.options??={};const dis=!!(config.disadvantage||roll.options.disadvantage||roll.options.advantageMode===-1);Object.assign(roll.options,{advantage:true,disadvantage:dis,advantageMode:dis?0:1});}
    dialog.options??={};dialog.options.defaultButton=(config.disadvantage||config.rolls?.[0]?.options.disadvantage)?"normal":"advantage";
}
function report(error){console.error("Ugmuls 5.5e Automation | Grapple:",error);ui.notifications.error(error.message??"Could not resolve Grapple / Prone. Use its save card.");}
Hooks.once("init",()=>{
    game.settings.register(ID,"grappleAutomation",{name:"Unarmed Grapple / Prone Prompts",hint:"Offer Grapple / Prone on action-based unarmed hit damage for any creature, using the target's better Strength/Dexterity save. Attempts replace damage unless Grappler Feat Automation is enabled and available.",scope:"world",config:true,type:Boolean,default:true});
    game.settings.register(ID,"grapplerAutomation",{name:"Grappler Feat Automation",hint:"For creatures with Grappler: keep damage plus Grapple once on your turn and recommend advantage against creatures grappled by you. The damage option uses Unarmed Grapple / Prone Prompts under Common.",scope:"world",config:true,type:Boolean,default:true});
});
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerGrapplerConditions(usageRules));
Hooks.once("ready",()=>{
    registerGrapplerConditions();Hooks.on("dnd5e.preRollAttackV2",grapplerAttackDefaults);
    globalThis.Ugmuls55eAutomationGrapple={addGrappleChoice,finalizeGrapple,replacesGrappleDamage,commitGrapple,grappleSaveReady,applyGrappleOutcome,deferGrappleSave};
    Hooks.on("dnd5e.renderChatMessage",renderGrapple);
    for(const event of ["createChatMessage","updateChatMessage","renderChatMessageHTML"])Hooks.on(event,schedule);
    Hooks.on("updateCombat",(combat,changes)=>resetGrappler(combat,changes).catch(report));Hooks.on("deleteCombat",combat=>resetGrappler(combat,{},true).catch(report));
});
