const ID="ugmuls-5-5e-automation",selected=new WeakMap(),pending=new WeakMap(),reserved=new Map();
const enabled=()=>game.settings.get(ID,"huntersPreyAutomation")===true;
export const preyFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    (["hunters-prey","colossus-slayer"].includes(item.identifier??item.system?.identifier)||/^(hunter[’']?s prey|colossus slayer)$/i.test(item.name?.trim()??"")));
export const combatTurn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
export function preyUsed(actor) {
    const turn=combatTurn();if(!turn)return false;
    return reserved.get(actor?.uuid)===turn||Array.from(actor?.effects??[]).some(effect=>!effect.disabled&&effect.active!==false&&
        effect.getFlag?.(ID,"preyTurn")===turn);
}
function actorFor(app){return (app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;}
function eligible(app){return enabled()&&app.config.subject?.type==="attack"&&app.config.subject.item?.type==="weapon"&&
    !app.message?.data?.flags?.[ID]?.masteryGraze&&actorFor(app)?.isOwner&&preyFeature(actorFor(app));}
export function preyDefault(app) {return actorFor(app)?.getFlag?.(ID,"huntersPreyChoice")===true;}
export function preyTarget(app) {
    const data=app.message?.data?.system,origin=data?.origin;
    const usage=typeof origin==="string"?game.messages.get(origin):origin;
    const targets=data?.targets?.length?data.targets:usage?.system?.targets??[];
    if(targets.length!==1)return null;
    const explicit=app.message?.data?.flags?.[ID]?.damageAttackId;
    const attack=explicit?game.messages.get(explicit):Array.from(usage?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    if(attack?.system?.evaluatedTargets?.some(target=>target.token===targets[0].token&&target.isMiss===true))return null;
    return fromUuidSync(targets[0].token,{strict:false})?.actor??null;
}
export function preyInjured(app) {
    const hp=preyTarget(app)?.system?.attributes?.hp;
    return Number.isFinite(hp?.value)&&Number.isFinite(hp?.max)&&hp.max>0&&hp.value<hp.max;
}
const rule="When you hit a creature with a weapon, the weapon deals an extra 1d8 damage to the target if it’s missing any of its Hit Points. You can deal this extra damage only once per turn.";
export function addPreyChoice(app) {
    if(!eligible(app)||app.element.querySelector("[data-rsa-prey]"))return;
    const used=preyUsed(actorFor(app)),injured=preyInjured(app);
    if(!selected.has(app))selected.set(app,preyDefault(app));
    
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{
        key:"prey",label:"Hunter's Prey",used,
        value:selected.get(app),disabled:used||!injured,change:yes=>{
            selected.set(app,yes);
            actorFor(app).setFlag(ID,"huntersPreyChoice",yes).catch(error=>console.warn("Ugmuls 5.5e Automation | Could not remember Hunter's Prey choice:",error));
        }
    });
    if(group) {
        group.dataset.rsaPrey="";
        const info=document.createElement("i");info.className="fa-solid fa-circle-info rsa-rider-info";
        info.tabIndex=0;info.setAttribute("role","img");info.setAttribute("aria-label",rule);
        info.setAttribute("data-tooltip",rule);info.title=rule;group.querySelector("label").append(info);
    }
}
export function finalizePrey(app,rolls,{preview=false}={}) {
    if(preview&&!selected.has(app))selected.set(app,preyDefault(app));
    if(!eligible(app)||!preyInjured(app)||selected.get(app)!==true||preyUsed(actorFor(app))||rolls.some(roll=>roll.options?.rsaHuntersPrey))return rolls;
    const actor=actorFor(app),feature=preyFeature(actor);
    const activities=Array.from(feature.system?.activities??[]);
    const activity=activities.find(activity=>/colossus slayer/i.test(activity.name??"")&&activity.damage?.parts?.length)??activities.find(activity=>activity.damage?.parts?.length);
    const source=activity?.getDamageConfig?.()?.rolls?.[0]??{parts:["1d8"],options:{}};
    if(!source?.parts?.length){if(!preview)ui.notifications.warn("Hunter's Prey needs a configured damage activity on its feature.");return rolls;}
    const base=rolls[0]?.options??{},policy={...base.critical,bonusDice:0,bonusDamage:""};
    const config={...source,options:{...source.options,type:base.type,types:base.type?[base.type]:[],flavor:"Hunter's Prey",isCritical:base.isCritical===true,
        critical:policy,rsaHuntersPrey:true}};
    const extra=CONFIG.Dice.DamageRoll.fromConfig(config,{critical:policy});
    const turn=combatTurn();if(turn&&!preview){reserved.set(actor.uuid,turn);pending.set(app,{actor,turn});}
    return [...rolls,extra];
}
export async function commitPrey(app,options) {
    const entry=pending.get(app);if(!entry)return;
    const {actor,turn}=entry;
    try {if(options?.dnd5e?.submitted)await saveUsedMarker(actor,{
        name:"Hunter's Prey - used",img:preyFeature(actor)?.img,disabled:false,transfer:false,
        system:{changes:[]},flags:{[ID]:{preyTurn:turn,preyCombat:game.combat?.id}}
    });}finally {if(reserved.get(actor.uuid)===turn)reserved.delete(actor.uuid);pending.delete(app);}
}
export async function resetPreyTurn(combat,changes) {
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||!("turn" in changes||"round" in changes||changes.started===false))return;
    const turn=combat.started?`${combat.id}:${combat.round}:${combat.turn}`:null;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()) {
        const ids=Array.from(actor.effects??[]).filter(effect=>effect.getFlag?.(ID,"preyCombat")===combat.id&&effect.getFlag(ID,"preyTurn")!==turn).map(effect=>effect.id);
        if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
    }
}
Hooks.once("init",()=>game.settings.register(ID,"huntersPreyAutomation",{name:"Hunter's Prey Assistance",hint:"Offer Hunter's Prey on weapon damage dialogs. Adds Colossus Slayer damage against an injured single target. Remembers your Yes/No choice, starts at No, and resets use after each combat turn.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationPrey={addPreyChoice,finalizePrey,commitPrey};
    Hooks.on("updateCombat",(combat,changes)=>resetPreyTurn(combat,changes).catch(err=>console.error("Ugmuls 5.5e Automation | Hunter's Prey reset failed:",err)));
});

function saveUsedMarker(actor,data) {
    return globalThis.Ugmuls55eAutomationResources?.reuseMarker?globalThis.Ugmuls55eAutomationResources.reuseMarker(actor,data,"preyTurn"):
        actor.createEmbeddedDocuments("ActiveEffect",[data]);
}
