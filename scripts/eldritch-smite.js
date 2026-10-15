const ID="ugmuls-5-5e-automation",selected=new WeakMap(),pending=new WeakMap(),reserved=new Map();
const enabled=()=>game.settings.get(ID,"eldritchSmiteAutomation")===true;
export const eldritchFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    ((item.identifier??item.system?.identifier)==="eldritch-smite"||/^eldritch smite$/i.test(item.name?.trim()??"")));
export function pactWeapon(item) {
    return Array.from(item?.effects??[]).some(effect=>{
        if(effect.disabled||effect.active===false||effect.duration?.expired)return false;
        const ref=effect.system?.origin?.item??effect.origin;
        const source=ref?fromUuidSync(ref,{strict:false}):null;
        return /\bpact (weapon|of the blade)\b/i.test(effect.name?.trim()??"")||
            (source?.identifier??source?.system?.identifier)==="pact-of-the-blade";
    });
}
const pactSlot=actor=>actor?.system?.spells?.pact;
export const combatTurn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
export function eldritchUsed(actor) {
    const turn=combatTurn();if(!turn)return false;
    return reserved.get(actor?.uuid)===turn||Array.from(actor?.effects??[]).some(effect=>!effect.disabled&&effect.active!==false&&
        effect.getFlag?.(ID,"eldritchTurn")===turn);
}
function actorFor(app){return (app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;}
function eligible(app){return enabled()&&app.config.subject?.type==="attack"&&app.config.subject.item?.type==="weapon"&&
    !app.message?.data?.flags?.[ID]?.masteryGraze&&pactWeapon(app.config.subject.item)&&actorFor(app)?.isOwner&&eldritchFeature(actorFor(app));}
export function eldritchTarget(app) {
    const data=app.message?.data?.system,origin=data?.origin;
    const usage=typeof origin==="string"?game.messages.get(origin):origin;
    const targets=data?.targets?.length?data.targets:usage?.system?.targets??[];
    if(targets.length!==1)return null;
    const explicit=app.message?.data?.flags?.[ID]?.damageAttackId;
    const attack=explicit?game.messages.get(explicit):Array.from(usage?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    if(attack?.system?.evaluatedTargets?.some(target=>target.token===targets[0].token&&target.isMiss===true))return null;
    return fromUuidSync(targets[0].token,{strict:false})?.actor??null;
}
export function addEldritchChoice(app) {
    if(!eligible(app)||app.element.querySelector("[data-rsa-eldritch]"))return;
    const used=eldritchUsed(actorFor(app)),slot=pactSlot(actorFor(app));
    if(!selected.has(app))selected.set(app,false);
    
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{
        key:"eldritch",label:"Eldritch Smite",used,
        value:selected.get(app),disabled:used||!(slot?.value>0&&slot.level>=1)||!eldritchTarget(app),change:yes=>selected.set(app,yes)
    });
    if(group)group.dataset.rsaEldritch="";
}
export function finalizeEldritch(app,rolls,{preview=false}={}) {
    if(preview&&!selected.has(app))selected.set(app,false);
    if(!eligible(app)||!eldritchTarget(app)||!(pactSlot(actorFor(app))?.value>0)||selected.get(app)!==true||eldritchUsed(actorFor(app))||rolls.some(roll=>roll.options?.rsaEldritchSmite))return rolls;
    const actor=actorFor(app);
    const level=Number(pactSlot(actor).level);if(!(level>=1))return rolls;
    const source={parts:[String(level+1)+"d8"],options:{}};
    const base=rolls[0]?.options??{},policy={...base.critical,bonusDice:0,bonusDamage:""};
    const config={...source,options:{...source.options,type:"force",types:["force"],flavor:"Eldritch Smite",isCritical:base.isCritical===true,
        critical:policy,rsaEldritchSmite:true}};
    const extra=CONFIG.Dice.DamageRoll.fromConfig(config,{critical:policy});
    const turn=combatTurn();if(turn&&!preview){reserved.set(actor.uuid,turn);pending.set(app,{actor,turn});}
    return [...rolls,extra];
}
export async function commitEldritch(app,options) {
    const entry=pending.get(app);if(!entry)return;
    const {actor,turn}=entry;
    let restore;
    try {
        if(!options?.dnd5e?.submitted)return;
        const slot=pactSlot(actor),needed=1+(globalThis.Ugmuls55eAutomationSmite?.pendingPactCost?.(app)??0);
        if(!(slot?.value>=needed))throw Error("Not enough Pact Magic slots for the selected smites.");
        const value=Number(slot.value);
        await actor.update({"system.spells.pact.value":value-1});restore=()=>actor.update({"system.spells.pact.value":value});
        if(turn)await saveUsedMarker(actor,{
            name:"Eldritch Smite - used",img:eldritchFeature(actor)?.img,disabled:false,transfer:false,
            system:{changes:[]},flags:{[ID]:{eldritchTurn:turn,eldritchCombat:game.combat?.id}}
        });
    } catch(error) {
        if(restore)await restore();
        const rolls=app.rolls;for(let i=rolls.length-1;i>=0;i--)if(rolls[i].options?.rsaEldritchSmite)rolls.splice(i,1);
        ui.notifications.error(error.message);throw error;
    } finally {if(reserved.get(actor.uuid)===turn)reserved.delete(actor.uuid);pending.delete(app);}
}
export async function resetEldritchTurn(combat,changes) {
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||!("turn" in changes||"round" in changes||changes.started===false))return;
    const turn=combat.started?`${combat.id}:${combat.round}:${combat.turn}`:null;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()) {
        const ids=Array.from(actor.effects??[]).filter(effect=>effect.getFlag?.(ID,"eldritchCombat")===combat.id&&effect.getFlag(ID,"eldritchTurn")!==turn).map(effect=>effect.id);
        if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
    }
}
Hooks.once("init",()=>game.settings.register(ID,"eldritchSmiteAutomation",{name:"Eldritch Smite Assistance",hint:"Offer Eldritch Smite on weapon damage dialogs. Requires a weapon enchanted by Pact of the Blade and an available Pact Magic slot. Starts at No, adds 1d8 plus 1d8 per pact slot level Force damage, consumes one pact slot, and resets after each combat turn.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationEldritch={addEldritchChoice,finalizeEldritch,commitEldritch};
    Hooks.on("updateCombat",(combat,changes)=>resetEldritchTurn(combat,changes).catch(err=>console.error("Ugmuls 5.5e Automation | Eldritch Smite reset failed:",err)));
});

function saveUsedMarker(actor,data) {
    return globalThis.Ugmuls55eAutomationResources?.reuseMarker?globalThis.Ugmuls55eAutomationResources.reuseMarker(actor,data,"eldritchTurn"):
        actor.createEmbeddedDocuments("ActiveEffect",[data]);
}
