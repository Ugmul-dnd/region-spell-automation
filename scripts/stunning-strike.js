import {describeTarget,hasEquivalentActiveEffect,regionOwnsEffect} from "./shared-activity-card.js";
const ID="ugmuls-5-5e-automation",choices=new WeakMap(),pending=new WeakMap(),reserved=new Map(),applying=new Set(),scheduled=new Set();
const enabled=()=>game.settings.get(ID,"stunningStrikeAutomation")===true;
const turn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
const active=effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true;
export const stunningFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    ((item.identifier??item.system?.identifier)==="stunning-strike"||/^stunning strike$/i.test(item.name?.trim()??"")));
export function focusResource(actor){
    const items=Array.from(actor?.items??[]),feature=stunningFeature(actor);
    for(const activity of feature?.system?.activities??[])for(const target of activity.consumption?.targets??[]){
        if(target.type!=="itemUses"||!target.target)continue;
        const found=actor.items?.get?.(target.target)??items.find(item=>item.uuid===target.target||(item.identifier??item.system?.identifier)===target.target);
        if(found)return found;
    }
    return items.find(item=>["monks-focus","focus-points"].includes(item.identifier??item.system?.identifier)||/^monk['’]s focus$|^focus points$/i.test(item.name??""));
}
const points=actor=>{const uses=focusResource(actor)?.system?.uses;return Number(uses?.value??(Number(uses?.max??0)-Number(uses?.spent??0)))||0;};
export function stunningUsed(actor){const current=turn();return !!current&&(reserved.has(actor?.uuid)||Array.from(actor?.effects??[]).some(effect=>active(effect)&&effect.getFlag?.(ID,"stunningTurn")===current));}
export function monkAttack(activity){
    if(activity?.type!=="attack")return false;
    const item=activity.item,type=item?.system?.type?.value;
    return activity.attack?.type?.classification==="unarmed"||type==="unarmed"||
        (item?.identifier??item?.system?.identifier)==="unarmed-strike"||
        item?.type==="weapon"&&(type==="simpleM"||type==="martialM"&&item.system.properties?.has?.("lgt"));
}
const actorFor=app=>(app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;
export function stunningTarget(app){
    const data=app.message?.data,origin=data?.system?.origin,usage=typeof origin==="string"?game.messages.get(origin):origin;
    const targets=data?.system?.targets?.length?data.system.targets:usage?.system?.targets??[];
    if(targets.length!==1)return null;
    const explicit=data?.flags?.[ID]?.damageAttackId;
    const attack=explicit?game.messages.get(explicit):Array.from(usage?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    if(!attack?.system?.evaluatedTargets?.some(target=>target.token===targets[0].token&&target.isMiss===false))return null;
    return fromUuidSync(targets[0].token,{strict:false})??null;
}
function eligible(app){return enabled()&&monkAttack(app.config.subject)&&actorFor(app)?.isOwner&&stunningFeature(actorFor(app))&&!app.message?.data?.flags?.[ID]?.masteryGraze;}
const pendingCard=app=>globalThis.Ugmuls55eAutomationPendingDamage?.pendingCard?.(app);
export function addStunningChoice(app){
    if(!eligible(app)||app.element.querySelector('[data-rsa-stunning]'))return;
    const actor=actorFor(app),used=stunningUsed(actor)||!!pendingCard(app)?.getFlag(ID,"stunningStrikeSave");
    if(!choices.has(app))choices.set(app,false);
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{key:"stunning",label:"Stunning Strike",value:choices.get(app),used,
        disabled:used||points(actor)<1||!stunningTarget(app),change:yes=>choices.set(app,yes)});
    if(group){group.dataset.rsaStunning="";group.querySelector('label')?.setAttribute('data-tooltip','Spend 1 Focus Point, once per turn. The target makes a Constitution save: failure causes Stunned; success halves Speed and grants advantage on the next attack against it. Effects last until the start of your next turn.');}
}
export function finalizeStunning(app,rolls){
    if(pending.has(app))return rolls;
    if(!eligible(app)||choices.get(app)!==true)return rolls;
    const actor=actorFor(app),target=stunningTarget(app);
    if(!target||stunningUsed(actor)||points(actor)<1||pendingCard(app)?.getFlag(ID,"stunningStrikeSave"))throw Error("Stunning Strike is no longer available for this hit.");
    if(reserved.has(actor.uuid))throw Error("Another Stunning Strike is already being submitted.");
    reserved.set(actor.uuid,app);pending.set(app,{actor,target,stamp:turn(),combat:game.combat?.id});return rolls;
}
export async function commitStunning(app,options){
    const entry=pending.get(app);if(!entry)return;
    const {actor,target,stamp,combat}=entry;let charged=false,resource,spent,marker;
    try{
        if(!options?.dnd5e?.submitted)return;
        if(points(actor)<1)throw Error("No Focus Points remain for Stunning Strike.");
        const feature=stunningFeature(actor),activity=Array.from(feature.system.activities).find(activity=>activity.type==="save");
        if(!activity)throw Error("Stunning Strike needs its configured save activity.");
        resource=focusResource(actor);spent=Number(resource.system.uses.spent??0);
        await resource.update({"system.uses.spent":spent+1});charged=true;
        const damage=pendingCard(app);
        const results=await activity.use({consume:false,subsequentActions:false},{configure:false},{data:{system:{targets:[describeTarget(target)]},
            flags:{[ID]:{riderTriggered:true,stunningStrike:{damageId:damage?.id,targetToken:target.uuid,casterActor:actor.uuid}}}}});
        if(!results?.message?.id)throw Error("Could not create the Stunning Strike save card.");
        const save=results.message;
        app.message.data.flags??={};app.message.data.flags[ID]??={};app.message.data.flags[ID].stunningStrikeSave=save.id;
        if(damage)await damage.setFlag(ID,"stunningStrikeSave",save.id);
        if(stamp){
            const data={name:"Stunning Strike - used",img:feature.img,disabled:false,transfer:false,system:{changes:[]},flags:{[ID]:{stunningTurn:stamp,stunningCombat:combat}}};
            marker=await globalThis.Ugmuls55eAutomationResources?.reuseMarker?.(actor,data,"stunningTurn");
            if(!globalThis.Ugmuls55eAutomationResources?.reuseMarker)await actor.createEmbeddedDocuments("ActiveEffect",[data]);
        }
    }catch(error){if(charged)await resource.update({"system.uses.spent":Number(resource.system.uses.spent)-1});if(marker)await marker.update({disabled:true});throw error;}
    finally{pending.delete(app);if(reserved.get(actor.uuid)===app)reserved.delete(actor.uuid);}
}
const authority=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
export function stunningSaveReady(damage){
    const id=damage?.getFlag?.(ID,"stunningStrikeSave");if(!id)return true;
    const save=game.messages.get(id),target=save?.getFlag?.(ID,"stunningStrike")?.targetToken;
    return !!target&&["success","failure"].includes(save.system.outcomes?.get(target));
}
export async function applyStunningOutcome(usage,{manual=false}={}){
    const link=usage?.getFlag?.(ID,"stunningStrike");
    if(!authority()||!link||applying.has(usage.id)||!manual&&(game.settings.get(ID,"autoApplySavedEffects")!==true||usage.getFlag(ID,"manualDamageWorkflow")))return;
    if(!manual&&usage.getFlag(ID,"outcomeEffectsApplied"))return;
    const outcome=usage.system.outcomes?.get(link.targetToken);if(!["failure","success"].includes(outcome))return;
    const damage=link.damageId?game.messages.get(link.damageId):null;
    const chainedGrapple=damage?.getFlag(ID,"grappleSave")&&globalThis.Ugmuls55eAutomationGrapple?.grappleSaveReady(damage)===false;
    if(!manual&&damage&&(damage.getFlag(ID,"pendingDamage")||!chainedGrapple&&game.settings.get(ID,"autoApplyCardDamage")===true&&
        !(damage.getFlag(ID,"automaticDamageTargets")??[]).includes(link.targetToken)&&damage.getFlag(ID,"hpApplicationRecorded")!==true&&!damage.getFlag(ID,"damageUndoHistory")?.length))return;
    const token=await fromUuid(link.targetToken),actor=token?.actor;if(!actor)return;
    const feature=usage.getAssociatedItem(),templates=Array.from(feature.effects??[]);
    const source=templates.find(effect=>outcome==="failure"?effect.statuses?.has?.("stunned")||/^stunned$/i.test(effect.name):/^slow(?:ed)?$/i.test(effect.name));
    const effects=[];
    if(source)effects.push(source);
    else if(outcome==="failure")effects.push(new CONFIG.ActiveEffect.documentClass({_id:"stunningStunned1",name:"Stunned",img:feature.img,system:{changes:[]},statuses:["stunned"]},{parent:feature}));
    if(outcome==="success"){
        if(!source)effects.push(new CONFIG.ActiveEffect.documentClass({_id:"stunningSlow0001",name:"Stunning Strike — Slowed",img:feature.img,system:{changes:[{key:"system.attributes.movement.speed",type:"multiply",value:"0.5"}]}},{parent:feature}));
        effects.push(new CONFIG.ActiveEffect.documentClass({_id:"stunningOpening1",name:"Stunning Strike — Opening",img:feature.img,system:{changes:[]},flags:{[ID]:{stunningOpening:true}}},{parent:feature}));
    }
    applying.add(usage.id);
    try{
        if(!manual)await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(usage);
        const tray=document.createElement('effect-application');tray.chatMessage=usage;
        const prepare=tray._prepareEffectData;
        tray._prepareEffectData=async function(effect,target){
            const operation=await prepare.call(this,effect,target);
            operation.data.duration={rounds:null,turns:null,seconds:null,value:null,expired:false,expiry:"sourceStart"};
            operation.data.start=CONFIG.ActiveEffect.documentClass.getEffectStart();
            operation.data.system??={};operation.data.system.origin={...operation.data.system.origin,actor:link.casterActor};
            operation.data.flags??={};operation.data.flags[ID]={...operation.data.flags[ID],stunningOutcome:outcome,stunningSource:usage.id,...(effect.getFlag?.(ID,"stunningOpening")?{stunningOpening:true}:{})};
            return operation;
        };
        for(const effect of effects){
            const opening=effect.getFlag?.(ID,"stunningOpening");
            if(!opening&&(hasEquivalentActiveEffect(actor,effect)||regionOwnsEffect(token,effect)))continue;
            if(opening&&openingEffects(actor).some(existing=>existing._stats?.duplicateSource===effect.uuid))continue;
            const undo=globalThis.Ugmuls55eAutomationEffectUndo;
            if(undo)await undo.apply(usage,usage,effect,actor,tray);else await tray._applyEffectToActor(effect,actor);
        }
        await usage.setFlag(ID,"outcomeEffectsApplied",true);await usage.setFlag(ID,"effectApplyReopened",null);
    }finally{applying.delete(usage.id);}
}
function schedule(card){
    if(!authority())return;
    const origin=typeof card?.system?.origin==="string"?game.messages.get(card.system.origin):card?.system?.origin;
    const usage=card?.getFlag?.(ID,"stunningStrike")?card:game.messages.get(card?.getFlag?.(ID,"stunningStrikeSave"))??(origin?.getFlag?.(ID,"stunningStrike")?origin:null);
    if(!usage||scheduled.has(usage.id))return;scheduled.add(usage.id);
    setTimeout(()=>{scheduled.delete(usage.id);applyStunningOutcome(usage).catch(report);},100);
}
export function openingEffects(actor){return Array.from(actor?.effects??[]).filter(effect=>active(effect)&&effect.getFlag?.(ID,"stunningOpening"));}
let conditionBridge=false;
export function registerStunningConditions(api=globalThis.ac5e?.usageRules){
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try{conditionBridge=!!api.register({key:"rsaStunningOpening",scope:"universal",hook:"attack",target:"subject",mode:"advantage",name:"Stunning Strike",persistent:false,
        evaluate:sandbox=>{const target=fromUuidSync(sandbox.opponentUuid,{strict:false});return openingEffects(target?.actor).length>0;}});}catch(error){conditionBridge=false;console.warn("Ugmuls 5.5e Automation | Stunning Strike conditions:",error);}return conditionBridge;
}
export function stunningAttackDefaults(config,dialog,message){
    if(conditionBridge&&game.modules?.get("automated-conditions-5e")?.active||config.subject?.type!=="attack")return;
    const targets=message?.data?.system?.targets??Array.from(game.user.targets??[],token=>({token:(token.document??token).uuid}));
    if(targets.length!==1||!openingEffects(fromUuidSync(targets[0].token,{strict:false})?.actor).length)return;
    config.advantage=true;
    for(const roll of config.rolls??[]){roll.options??={};const dis=!!(config.disadvantage||roll.options.disadvantage||roll.options.advantageMode===-1);Object.assign(roll.options,{advantage:true,disadvantage:dis,advantageMode:dis?0:1});}
    dialog.options??={};dialog.options.defaultButton=config.rolls?.[0]?.options.disadvantage?"normal":"advantage";
}
export async function consumeOpening(card){
    if(!authority()||card?.type!=="attack"||!card.rolls?.length)return;
    for(const target of card.system.targets??[]){const actor=(await fromUuid(target.token))?.actor;if(!actor)continue;
        const ids=openingEffects(actor).map(effect=>effect.id);if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
    }
}
export async function resetStunning(combat,changes={},ending=false){
    if(!authority()||!ending&&!("turn" in changes||"round" in changes||"started" in changes))return;
    const stamp=combat.started?`${combat.id}:${combat.round}:${combat.turn}`:null;
    for(const actor of new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor])).values()){
        const updates=Array.from(actor.effects??[]).filter(effect=>active(effect)&&effect.getFlag?.(ID,"stunningCombat")===combat.id&&(ending||effect.getFlag(ID,"stunningTurn")!==stamp)).map(effect=>({_id:effect.id,disabled:true}));
        if(updates.length)await actor.updateEmbeddedDocuments("ActiveEffect",updates);
    }
}
export function renderStunning(message,html){
    if(!message.getFlag?.(ID,"stunningStrike"))return;
    const root=html?.[0]??html;if(!root?.querySelector)return;
    root.querySelectorAll('effect-application').forEach(tray=>tray.hidden=true);
    if(!game.user.isGM||message.getFlag(ID,"outcomeEffectsApplied")===true){
        root.querySelector('[data-rsa-stunning-effects]')?.remove();return;
    }
    if(root.querySelector('[data-rsa-stunning-effects]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.rsaStunningEffects='';button.textContent='Apply Stunning Strike Effects';
    const target=message.getFlag(ID,"stunningStrike").targetToken;button.disabled=!["success","failure"].includes(message.system.outcomes?.get(target));
    button.addEventListener('click',async()=>{button.disabled=true;try{await applyStunningOutcome(message,{manual:true});}catch(error){report(error);}finally{if(message.getFlag(ID,"outcomeEffectsApplied")===true)button.remove();else button.disabled=false;}});
    (root.querySelector('.chat-card')??root).append(button);
}
function report(error){console.error("Ugmuls 5.5e Automation | Stunning Strike:",error);ui.notifications.error(error.message??"Stunning Strike could not finish. Use its save card to resolve manually.");}
Hooks.once("init",()=>game.settings.register(ID,"stunningStrikeAutomation",{name:"Stunning Strike Assistance",hint:"Offer Stunning Strike on Monk weapon and Unarmed Strike hit damage. Costs 1 Focus Point, once per turn; prompts the native Constitution save and applies the appropriate outcome with damage.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerStunningConditions(usageRules));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationStunning={addStunningChoice,finalizeStunning,commitStunning,stunningSaveReady,applyStunningOutcome};registerStunningConditions();
    Hooks.on("dnd5e.preRollAttackV2",stunningAttackDefaults);
    for(const event of ["createChatMessage","updateChatMessage"])Hooks.on(event,card=>{schedule(card);if(event==="createChatMessage")consumeOpening(card).catch(report);});
    Hooks.on("renderChatMessageHTML",schedule);Hooks.on("dnd5e.renderChatMessage",renderStunning);
    Hooks.on("updateCombat",(combat,changes)=>resetStunning(combat,changes).catch(report));Hooks.on("deleteCombat",combat=>resetStunning(combat,{},true).catch(report));
});
