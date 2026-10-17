const ID="ugmuls-5-5e-automation",creating=new Set();
const enabled=()=>game.settings.get(ID,"reactionTracker")===true;
export function reactionUsed(actor) {
    if(!actor||!game.combat?.started||!Array.from(game.combat.combatants??[]).some(entry=>entry.actor?.uuid===actor.uuid))return;
    return Array.from(actor?.effects??[]).find(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true&&
        (effect.getFlag?.(ID,"reactionUsed")===true||effect.name==="Reaction - used"));
}
export function offTurn(activity) {
    const combat=game.combat,actor=activity?.actor??activity?.item?.actor;
    if(!combat?.started||!combat.combatant||!actor)return false;
    const token=activity.getUsageToken?.();const doc=token?.document??token;
    const combatants=Array.from(combat.combatants??[]);
    const combatant=(doc?combatants.find(entry=>entry.token?.uuid===doc.uuid):null)??combatants.find(entry=>entry.actor?.uuid===actor.uuid);
    return !!combatant&&combatant.id!==combat.combatant.id;
}
function manualActivity(activity,message) {
    return ["spell","weapon","feat"].includes(activity?.item?.type)&&!message?.data?.flags?.[ID]?.regionTriggered&&!message?.data?.flags?.[ID]?.riderTriggered;
}
export function reactionActivity(activity) {
    const actor=activity?.actor??activity?.item?.actor;
    if(!actor||!game.combat?.started||!Array.from(game.combat.combatants??[]).some(entry=>entry.actor?.uuid===actor?.uuid))return false;
    return String(activity?.activation?.type??"").startsWith("reaction")||(offTurn(activity)&&activity?.activation?.type!=="bonus");
}
export function allowReactionUse(activity,usage,dialog,message) {
    if(!enabled()||!manualActivity(activity,message)||!reactionActivity(activity))return;
    const actor=activity.actor??activity.item.actor;
    if(reactionUsed(actor)||creating.has(actor.uuid)) {
        ui.notifications.warn("Reaction already used. Disable or delete Reaction - used to act again.");return false;
    }
}
export async function recordReactionUse(activity,usage,results) {
    const message=results?.message,actor=activity?.actor??activity?.item?.actor;
    if(!enabled()||!message||message.getFlag?.(ID,"regionTriggered")||message.getFlag?.(ID,"riderTriggered")||!manualActivity(activity,{})||!reactionActivity(activity)||!actor?.isOwner||reactionUsed(actor)||creating.has(actor.uuid))return;
    creating.add(actor.uuid);
    try {
        const data={name:"Reaction - used",img:"icons/svg/clockwork.svg",disabled:false,transfer:false,
            duration:{rounds:1,expiry:"sourceStart"},start:CONFIG.ActiveEffect.documentClass.getEffectStart(),
            system:{changes:[],origin:{actor:actor.uuid}},flags:{[ID]:{reactionUsed:true,reactionUsage:message.id}}};
        if(globalThis.Ugmuls55eAutomationResources?.reuseMarker)await globalThis.Ugmuls55eAutomationResources.reuseMarker(actor,data,"reactionUsed");
        else await actor.createEmbeddedDocuments("ActiveEffect",[data]);
    } finally {creating.delete(actor.uuid);}
}

export function allowReactionAttack(config,dialog,message) {
    const activity=config?.subject;
    if(!enabled()||activity?.type!=="attack"||!offTurn(activity))return;
    const used=reactionUsed(activity.actor??activity.item?.actor);if(!used)return;
    const origin=message?.data?.system?.origin;
    if((typeof origin==="string"?origin:origin?.id)===used.getFlag?.(ID,"reactionUsage"))return;
    ui.notifications.warn("Reaction already used. Disable or delete Reaction - used to attack again.");return false;
}
Hooks.once("init",()=>game.settings.register(ID,"reactionTracker",{name:"Reaction Tracker",
    hint:"For all participants in active combat: reaction activities, plus manual action spell, weapon and feature uses outside your combat turn, mark Reaction - used and block further reactions. Disable/delete to override; expires at your turn start. Saves and automated Region triggers remain available.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.preUseActivity",allowReactionUse);
    Hooks.on("dnd5e.postUseActivity",(activity,usage,results)=>{const task=recordReactionUse(activity,usage,results);globalThis.Ugmuls55eAutomationPendingCast?.track(results?.message,task);task.catch(err=>console.error("Ugmuls 5.5e Automation | Reaction tracking failed:",err));});
    Hooks.on("dnd5e.preRollAttackV2",allowReactionAttack);
});
