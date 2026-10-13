const ID="region-spell-automation",selected=new WeakMap(),pending=new WeakMap(),reserved=new Map();
const enabled=()=>game.settings.get(ID,"sneakAttackAutomation")===true;
export const sneakFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    (item.identifier==="sneak-attack"||item.system?.identifier==="sneak-attack"||/^sneak attack$/i.test(item.name?.trim()??"")));
export const combatTurn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
export function sneakUsed(actor) {
    const turn=combatTurn();if(!turn)return false;
    return reserved.get(actor?.uuid)===turn||Array.from(actor?.effects??[]).some(effect=>!effect.disabled&&effect.active!==false&&
        effect.getFlag?.(ID,"sneakTurn")===turn);
}
function actorFor(app){return (app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;}
function eligible(app){return enabled()&&app.config.subject?.type==="attack"&&app.config.subject.item?.type==="weapon"&&
    !app.message?.data?.flags?.[ID]?.masteryGraze&&actorFor(app)?.isOwner&&sneakFeature(actorFor(app));}
export function sneakDefault(app) {
    const origin=app.message?.data?.system?.origin;
    const usage=typeof origin==="string"?game.messages.get(origin):origin;
    const explicit=app.message?.data?.flags?.[ID]?.damageAttackId;
    const attack=explicit?game.messages.get(explicit):Array.from(usage?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    return attack?.rolls?.[0]?.options?.advantageMode===1;
}
export function addSneakChoice(app) {
    if(!eligible(app)||app.element.querySelector("[data-rsa-sneak]"))return;
    const buttons=app.element.querySelector(".dialog-buttons");if(!buttons)return;
    const used=sneakUsed(actorFor(app));
    if(!selected.has(app))selected.set(app,sneakDefault(app));
    const label=document.createElement("label");label.dataset.rsaSneak="";label.className=`rsa-savage-toggle${used?" rsa-savage-used":""}`;
    const input=document.createElement("input");input.type="checkbox";input.disabled=used;input.checked=!used&&selected.get(app);
    input.addEventListener("change",()=>selected.set(app,input.checked));
    label.append(input,document.createTextNode(used?"Sneak Attack - Already Used":"Use Sneak Attack"));buttons.before(label);
}
export function finalizeSneak(app,rolls) {
    if(!eligible(app)||selected.get(app)!==true||sneakUsed(actorFor(app))||rolls.some(roll=>roll.options?.rsaSneakAttack))return rolls;
    const actor=actorFor(app),feature=sneakFeature(actor);
    const activity=Array.from(feature.system?.activities??[]).find(activity=>activity.damage?.parts?.length);
    const source=activity?.getDamageConfig?.()?.rolls?.[0];
    if(!source?.parts?.length){ui.notifications.warn("Sneak Attack needs a configured damage activity on its feature.");return rolls;}
    const base=rolls[0]?.options??{},policy={...base.critical,bonusDice:0,bonusDamage:""};
    const config={...source,options:{...source.options,type:base.type,flavor:"Sneak Attack",isCritical:base.isCritical===true,
        critical:policy,rsaSneakAttack:true}};
    const extra=CONFIG.Dice.DamageRoll.fromConfig(config,{critical:policy});
    const turn=combatTurn();if(turn){reserved.set(actor.uuid,turn);pending.set(app,{actor,turn});}
    return [...rolls,extra];
}
export async function commitSneak(app,options) {
    const entry=pending.get(app);if(!entry)return;
    const {actor,turn}=entry;
    try {if(options?.dnd5e?.submitted)await actor.createEmbeddedDocuments("ActiveEffect",[{
        name:"Sneak Attack - used",img:sneakFeature(actor)?.img,disabled:false,transfer:false,
        system:{changes:[]},flags:{[ID]:{sneakTurn:turn,sneakCombat:game.combat?.id}}
    }]);}finally {if(reserved.get(actor.uuid)===turn)reserved.delete(actor.uuid);pending.delete(app);}
}
export async function resetSneakTurn(combat,changes) {
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||!("turn" in changes||"round" in changes||changes.started===false))return;
    const turn=combat.started?`${combat.id}:${combat.round}:${combat.turn}`:null;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()) {
        const ids=Array.from(actor.effects??[]).filter(effect=>effect.getFlag?.(ID,"sneakCombat")===combat.id&&effect.getFlag(ID,"sneakTurn")!==turn).map(effect=>effect.id);
        if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
    }
}
Hooks.once("init",()=>game.settings.register(ID,"sneakAttackAutomation",{name:"Sneak Attack Assistance",hint:"Offer Sneak Attack on weapon damage dialogs. Advantage checks it by default; other qualifying cases can be selected manually. Resets after each combat turn.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.RegionSpellAutomationSneak={addSneakChoice,finalizeSneak,commitSneak};
    Hooks.on("updateCombat",(combat,changes)=>resetSneakTurn(combat,changes).catch(err=>console.error("Region Spell Automation | Sneak Attack reset failed:",err)));
});
