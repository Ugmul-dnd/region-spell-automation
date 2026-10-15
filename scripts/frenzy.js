import {recklessEffects} from "./reckless-attack.js";
const ID="ugmuls-5-5e-automation",pending=new WeakMap(),reserved=new Map();
const enabled=()=>game.settings.get(ID,"frenzyAutomation")===true;
export const frenzyFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    (item.identifier==="frenzy"||item.system?.identifier==="frenzy"||/^frenzy$/i.test(item.name?.trim()??"")));
export const combatTurn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
export function frenzyUsed(actor) {
    const turn=combatTurn();if(!turn)return false;
    return reserved.get(actor?.uuid)===turn||Array.from(actor?.effects??[]).some(effect=>!effect.disabled&&effect.active!==false&&
        effect.getFlag?.(ID,"frenzyTurn")===turn);
}
function actorFor(app){return (app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;}
function eligible(app){return enabled()&&app.config.subject?.type==="attack"&&app.config.subject.item?.type==="weapon"&&
    !app.message?.data?.flags?.[ID]?.masteryGraze&&actorFor(app)?.isOwner&&frenzyFeature(actorFor(app));}
function attackContext(app) {
    const data=app.message?.data?.system,origin=data?.origin;
    const usage=typeof origin==="string"?game.messages.get(origin):origin;
    const explicit=app.message?.data?.flags?.[ID]?.damageAttackId;
    const attack=explicit?game.messages.get(explicit):Array.from(usage?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    const targets=data?.targets?.length?data.targets:usage?.system?.targets??[];
    return {attack,targets};
}
export function rageActive(actor) {
    const rage=Array.from(actor?.items??[]).find(item=>(item.identifier??item.system?.identifier)==="rage"||/^rage$/i.test(item.name??""));
    const sources=new Set(Array.from(rage?.effects??[]).map(effect=>effect.uuid));
    return Array.from(actor?.effects??[]).some(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&
        (/^(rage|raging)$/i.test(effect.name?.trim()??"")||sources.has(effect._stats?.duplicateSource)||sources.has(effect._stats?.compendiumSource)||
        (!!rage?.uuid&&effect.system?.origin?.item===rage.uuid)));
}
export function frenzyReady(app) {
    const actor=actorFor(app),{attack,targets}=attackContext(app);
    const ability=attack?.rolls?.[0]?.options?.ability??attack?.system?.ability??app.config.ability??app.config.subject?.ability;
    const ownTurn=!game.combat?.started||game.combat.combatant?.actor?.uuid===actor?.uuid;
    const hit=targets.length===1&&!attack?.system?.evaluatedTargets?.some(target=>target.token===targets[0].token&&target.isMiss===true);
    return ownTurn&&hit&&ability==="str"&&rageActive(actor)&&recklessEffects(actor).length>0;
}
function rageDice(actor) {
    const scale=actor.getRollData?.()?.scale?.barbarian?.["rage-damage"];
    const amount=Number(scale?.value??scale);
    if(Number.isFinite(amount)&&amount>0)return amount;
    const level=Number(Array.from(actor.items??[]).find(item=>item.type==="class"&&(item.identifier??item.system?.identifier)==="barbarian")?.system?.levels??0);
    return level>=16?4:level>=9?3:2;
}
export function addFrenzyChoice(app) {
    if(!eligible(app)||app.element.querySelector("[data-rsa-frenzy]"))return;
    const used=frenzyUsed(actorFor(app));
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{
        key:"frenzy",label:"Frenzy",used,locked:true,
        value:!used&&frenzyReady(app),disabled:!frenzyReady(app)
    });
    if(group)group.dataset.rsaFrenzy="";
}
export function finalizeFrenzy(app,rolls,{preview=false}={}) {
    if(!eligible(app)||!frenzyReady(app)||frenzyUsed(actorFor(app))||rolls.some(roll=>roll.options?.rsaFrenzy))return rolls;
    const actor=actorFor(app),feature=frenzyFeature(actor);
    const activity=Array.from(feature.system?.activities??[]).find(activity=>activity.damage?.parts?.length);
    const source=activity?.getDamageConfig?.()?.rolls?.[0]??{parts:[String(rageDice(actor))+"d6"],options:{}};
    if(!source?.parts?.length){if(!preview)ui.notifications.warn("Frenzy needs a configured damage activity on its feature.");return rolls;}
    const base=rolls[0]?.options??{},policy={...base.critical,bonusDice:0,bonusDamage:""};
    const config={...source,options:{...source.options,type:base.type,types:base.type?[base.type]:[],flavor:"Frenzy",isCritical:base.isCritical===true,
        critical:policy,rsaFrenzy:true}};
    const extra=CONFIG.Dice.DamageRoll.fromConfig(config,{critical:policy});
    const turn=combatTurn();if(turn&&!preview){reserved.set(actor.uuid,turn);pending.set(app,{actor,turn});}
    return [...rolls,extra];
}
export async function commitFrenzy(app,options) {
    const entry=pending.get(app);if(!entry)return;
    const {actor,turn}=entry;
    try {if(options?.dnd5e?.submitted)await saveUsedMarker(actor,{
        name:"Frenzy - used",img:frenzyFeature(actor)?.img,disabled:false,transfer:false,
        system:{changes:[]},flags:{[ID]:{frenzyTurn:turn,frenzyCombat:game.combat?.id}}
    });}finally {if(reserved.get(actor.uuid)===turn)reserved.delete(actor.uuid);pending.delete(app);}
}
export async function resetFrenzyTurn(combat,changes) {
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||!("turn" in changes||"round" in changes||changes.started===false))return;
    const turn=combat.started?`${combat.id}:${combat.round}:${combat.turn}`:null;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()) {
        const ids=Array.from(actor.effects??[]).filter(effect=>effect.getFlag?.(ID,"frenzyCombat")===combat.id&&effect.getFlag(ID,"frenzyTurn")!==turn).map(effect=>effect.id);
        if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
    }
}
Hooks.once("init",()=>game.settings.register(ID,"frenzyAutomation",{name:"Frenzy Assistance",hint:"Offer Frenzy on weapon damage dialogs. Automatically adds damage for a Strength-based weapon hit on your turn while Rage and Reckless Attack are active. Adds the feature damage using the weapon damage type, once per combat turn.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationFrenzy={addFrenzyChoice,finalizeFrenzy,commitFrenzy};
    Hooks.on("updateCombat",(combat,changes)=>resetFrenzyTurn(combat,changes).catch(err=>console.error("Ugmuls 5.5e Automation | Frenzy reset failed:",err)));
});

function saveUsedMarker(actor,data) {
    return globalThis.Ugmuls55eAutomationResources?.reuseMarker?globalThis.Ugmuls55eAutomationResources.reuseMarker(actor,data,"frenzyTurn"):
        actor.createEmbeddedDocuments("ActiveEffect",[data]);
}
