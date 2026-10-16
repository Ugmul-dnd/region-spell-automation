import {rageActive,combatTurn} from "./frenzy.js";
import {isRollAdjustmentLocked} from "./shared-activity-card.js";
const ID="ugmuls-5-5e-automation",pending=new WeakMap(),reserved=new Map(),types=new WeakMap();
export const divineFuryFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&item.system?.source?.rules!=="2014"&&((item.identifier??item.system?.identifier)==="divine-fury"||/^divine fury$/i.test(item.name??"")));
function context(app){
    const data=app.message?.data??{},pending=globalThis.Ugmuls55eAutomationPendingDamage?.pendingCard?.(app),reference=data.system?.origin??pending?.system?.origin,origin=typeof reference==="string"?game.messages.get(reference.replace(/^ChatMessage\./,"")):reference;
    const id=data.flags?.[ID]?.damageAttackId??pending?.getFlag?.(ID,"damageAttackId");
    const attack=(id?game.messages.get(id):null)??(origin?.type==="attack"?origin:[...(origin?.getAssociatedRolls?.("attack")??[])].sort((a,b)=>b.timestamp-a.timestamp)[0]);
    const actor=attack?.getAssociatedActor?.()??app.config?.subject?.actor;
    return {actor,attack};
}
export function divineFuryUsed(actor,except=null){
    const turn=combatTurn();if(!turn)return false;
    return (reserved.get(actor?.uuid)?.turn===turn&&reserved.get(actor.uuid)?.app!==except)||Array.from(actor?.effects??[]).some(effect=>!effect.disabled&&effect.active!==false&&!effect.system?.expired&&effect.getFlag?.(ID,"divineFuryTurn")===turn);
}
export function divineFuryEligible(app){
    const {actor,attack}=context(app),activity=app.config?.subject,item=activity?.item;
    const unarmed=activity?.attack?.type?.classification==="unarmed"||item?.system?.type?.value==="unarmed"||/^(unarmed|empowered|elemental) strikes?$/i.test(item?.name??"");
    return game.settings.get(ID,"divineFuryAutomation")===true&&!!combatTurn()&&game.combat.combatant?.actor?.uuid===actor?.uuid&&
        activity?.type==="attack"&&(item?.type==="weapon"||unarmed)&&actor?.isOwner&&!!divineFuryFeature(actor)&&rageActive(actor)&&
        !app.message?.data?.flags?.[ID]?.masteryGraze&&!isRollAdjustmentLocked(attack)&&
        (attack?.system?.evaluatedTargets??[]).filter(target=>target.isMiss===false).length===1;
}
export function divineFuryFormula(actor){
    const level=Number(Array.from(actor?.items??[]).find(item=>item.type==="class"&&(item.identifier??item.system?.identifier)==="barbarian")?.system?.levels??0);
    return level>=3?"1d6 + "+Math.floor(level/2):null;
}
export function addDivineFuryChoice(app){
    const {actor}=context(app);if(!divineFuryFeature(actor))return;
    const ready=divineFuryEligible(app),used=divineFuryUsed(actor,app);
    globalThis.Ugmuls55eAutomationDamage?.addDamageChoice(app,{key:"divine-fury",label:"Divine Fury",value:ready&&!used,used,disabled:!ready,locked:true});
    const preview=finalizeDivineFury(app,app.rolls??[],{preview:true});
    for(const[index,roll]of preview.entries()){
        if(!roll.options?.rsaDivineFury)continue;
        const select=app.element.querySelector('[name="roll.'+index+'.damageType"]');if(!select||select.dataset.rsaDivineFury)continue;
        select.dataset.rsaDivineFury="true";select.value=types.get(app)??"radiant";
        select.addEventListener("change",event=>{event.stopPropagation();if(["radiant","necrotic"].includes(select.value)){types.set(app,select.value);app.rebuild();}});
    }
}
export function selectDivineFuryType(app,type){if(!["radiant","necrotic"].includes(type))throw Error("Choose Radiant or Necrotic.");types.set(app,type);}
export function finalizeDivineFury(app,rolls,{preview=false}={}){
    const entry=pending.get(app);if(entry)return rolls.some(roll=>roll.options?.rsaDivineFury)?rolls:[...rolls,entry.roll];
    if(!divineFuryEligible(app))return rolls;
    const {actor}=context(app),formula=divineFuryFormula(actor);if(!formula||divineFuryUsed(actor,app)||rolls.some(roll=>roll.options?.rsaDivineFury))return rolls;
    const base=rolls[0]?.options??{},type=types.get(app)??"radiant";
    const roll=new CONFIG.Dice.DamageRoll(formula+"[Divine Fury]",actor.getRollData?.()??{},
        {type,types:["radiant","necrotic"],flavor:"Divine Fury",isCritical:base.isCritical===true,critical:{...base.critical,bonusDice:0,bonusDamage:""},rsaDivineFury:true});
    if(!preview){pending.set(app,{actor,roll,turn:combatTurn()});reserved.set(actor.uuid,{app,turn:combatTurn()});}
    return [...rolls,roll];
}
export async function commitDivineFury(app,options){
    const entry=pending.get(app);if(!entry)return;
    try{
        if(!options?.dnd5e?.submitted)return;
        if(entry.turn!==combatTurn()||!divineFuryEligible(app)||divineFuryUsed(entry.actor,app))throw Error("Divine Fury is no longer available on this turn. Reopen the damage prompt.");
        const data={name:"Divine Fury - used",img:divineFuryFeature(entry.actor)?.img,disabled:false,transfer:false,system:{changes:[]},flags:{[ID]:{divineFuryTurn:entry.turn,divineFuryCombat:game.combat.id}}};
        const resources=globalThis.Ugmuls55eAutomationResources;
        if(resources?.reuseMarker)await resources.reuseMarker(entry.actor,data,"divineFuryTurn");else await entry.actor.createEmbeddedDocuments("ActiveEffect",[data]);
        app.message.data.flags??={};app.message.data.flags[ID]={...app.message.data.flags[ID],divineFury:{type:entry.roll.options.type,turn:entry.turn}};
    }finally{pending.delete(app);if(reserved.get(entry.actor.uuid)?.app===app)reserved.delete(entry.actor.uuid);}
}
export async function resetDivineFury(combat,changes={}){
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||!("turn"in changes||"round"in changes||changes.started===false))return;
    const turn=changes.started===false?null:combat.started?combat.id+":"+combat.round+":"+combat.turn:null;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()){
        const updates=Array.from(actor.effects??[]).filter(effect=>!effect.disabled&&effect.getFlag?.(ID,"divineFuryCombat")===combat.id&&effect.getFlag?.(ID,"divineFuryTurn")!==turn).map(effect=>({_id:effect.id,disabled:true}));
        if(updates.length)await actor.updateEmbeddedDocuments("ActiveEffect",updates);
    }
}
Hooks.once("init",()=>game.settings.register(ID,"divineFuryAutomation",{name:"Divine Fury Assistance",hint:"While raging on your combat turn, automatically add Divine Fury to the first weapon or Unarmed Strike hit. Choose Radiant or Necrotic above the damage roll. Uses Barbarian level, supports criticals, and tracks one use per turn.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationDivineFury={addDivineFuryChoice,finalizeDivineFury,commitDivineFury};
    Hooks.on("updateCombat",(combat,changes)=>resetDivineFury(combat,changes).catch(console.error));
    Hooks.on("deleteCombat",combat=>resetDivineFury(combat,{started:false}).catch(console.error));
});
