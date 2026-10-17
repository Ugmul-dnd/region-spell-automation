const ID="ugmuls-5-5e-automation";
const creating=new Map();
const definitions={bonus:{name:"Bonus Action - used",flag:"bonusActionUsed",setting:"bonusActionTracker",img:"icons/svg/upgrade.svg"},
    spell:{name:"Consumed Spell Slot",flag:"consumedSpellSlot",setting:"spellSlotTurnTracker",img:"icons/svg/book.svg"}};
const actorFor=activity=>activity?.actor??activity?.item?.actor;
const stamp=combat=>combat?.started?String(combat.id)+":"+combat.round+":"+combat.turn:null;
const enabled=kind=>game.settings.get(ID,definitions[kind].setting)===true;
const inCombat=(actor,combat=game.combat)=>!!actor&&combat?.started&&Array.from(combat.combatants??[]).some(entry=>entry.actor?.uuid===actor?.uuid);
const applies=(actor,kind,combat=game.combat)=>inCombat(actor,combat)&&(kind!=="spell"||actor.type==="character");
function manual(activity,message) {return !message?.data?.flags?.[ID]?.regionTriggered&&!message?.data?.flags?.[ID]?.riderTriggered&&["spell","weapon","feat"].includes(activity?.item?.type);}
export function resourceEffect(actor,kind) {
    const def=definitions[kind];if(!def||!applies(actor,kind))return null;
    return Array.from(actor?.effects??[]).find(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true&&
        (effect.getFlag?.(ID,def.flag)===true||effect.name===def.name)&&
        (kind!=="spell"||!effect.getFlag?.(ID,"resourceTurn")||effect.getFlag(ID,"resourceTurn")===stamp(game.combat)));
}
export function resourceUsed(actor,kind) {return !!definitions[kind]&&enabled(kind)&&!!applies(actor,kind)&&(!!resourceEffect(actor,kind)||creating.has(actor?.uuid+":"+kind));}
export async function reuseMarker(actor,data,flag) {
    // D&D5e persists expiry separately from disabled and start; every renewal must clear it.
    data={...data,duration:{...data.duration,expired:false},start:data.start??CONFIG.ActiveEffect.documentClass.getEffectStart()};
    const matches=Array.from(actor.effects??[]).filter(effect=>effect.getFlag?.(ID,flag)||effect.name===data.name);
    const existing=matches[0];
    if(!existing)return (await actor.createEmbeddedDocuments("ActiveEffect",[data]))?.[0]??null;
    await existing.update(data);
    for(const duplicate of matches.slice(1))if(!duplicate.disabled)await duplicate.update({disabled:true});
    return existing;
}
export async function markResource(actor,kind,{usage=null,combat=game.combat}={}) {
    if(!definitions[kind]||!enabled(kind)||!actor?.isOwner||!applies(actor,kind,combat))return null;
    const key=actor.uuid+":"+kind;
    if(creating.has(key))return creating.get(key);
    const existing=resourceEffect(actor,kind);if(existing)return existing;
    const def=definitions[kind];
    const task=reuseMarker(actor,{
        name:def.name,img:def.img,disabled:false,transfer:false,
        start:CONFIG.ActiveEffect.documentClass.getEffectStart(),system:{changes:[],origin:{actor:actor.uuid}},
        flags:{[ID]:{[def.flag]:true,resourceCombat:combat.id,resourceTurn:stamp(combat),resourceUsage:usage}}
    },def.flag);
    creating.set(key,task);
    try{return await task;}finally{creating.delete(key);}
}
function slotDeltas(message) {
    return (message?.data?.system?.deltas?.actor??[]).some(delta=>/^system\.spells\.(spell[1-9]|pact)\.value$/.test(delta.keyPath)&&delta.delta<0);
}
function updateEntries(object,prefix="") {
    return Object.entries(object??{}).flatMap(([key,value])=>{
        const path=prefix?prefix+"."+key:key;
        return value&&typeof value==="object"&&!Array.isArray(value)?updateEntries(value,path):[[path,value]];
    });
}
function slotUpdates(activity,updates) {
    const actor=actorFor(activity);
    return updateEntries(updates?.actor).some(([key,value])=>{
        const match=/^system\.spells\.(spell[1-9]|pact)\.value$/.exec(key);
        return !!match&&Number(value)<Number(actor?.system?.spells?.[match[1]]?.value);
    });
}
export function allowTurnResourceUse(activity,usage,message,updates) {
    const actor=actorFor(activity);if(!inCombat(actor)||!manual(activity,message))return;
    if(enabled("bonus")&&activity.activation?.type==="bonus") {
        if(game.combat.combatant?.actor?.uuid!==actor.uuid) {
            ui.notifications.warn("A bonus action cannot be used as a reaction on another creature's turn.");return false;
        }
        if(resourceUsed(actor,"bonus")) {ui.notifications.warn("Bonus action already used. Disable or delete Bonus Action - used to override.");return false;}
    }
    // Inspect actual prepared consumption, after the user chooses slots or free casting.
    if(actor.type==="character"&&enabled("spell")&&activity.item?.type==="spell"&&slotUpdates(activity,updates)&&resourceUsed(actor,"spell")) {
        ui.notifications.warn("A spell slot has already been used to cast a spell this turn. Disable or delete Consumed Spell Slot to override.");return false;
    }
}
export async function recordTurnResources(activity,usage,message) {
    const actor=actorFor(activity);if(!inCombat(actor)||!actor?.isOwner||!manual(activity,message))return;
    const tasks=[];
    if(activity.activation?.type==="bonus")tasks.push(markResource(actor,"bonus",{usage:message?.data?.flags?.[ID]?.castSession??null}));
    if(activity.item?.type==="spell"&&slotDeltas(message))tasks.push(markResource(actor,"spell",{usage:message?.data?.flags?.[ID]?.castSession??null}));
    await Promise.all(tasks);
}
export async function resetTurnResources(combat,changes={},ending=false) {
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||
        (!ending&&!("turn" in changes||"round" in changes||"started" in changes)))return;
    const current=stamp(combat),incoming=combat.combatant?.actor?.uuid;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()) {
        const ids=Array.from(actor.effects??[]).filter(effect=>{
            const get=key=>effect.getFlag?.(ID,key);
            if(effect.disabled)return false;
            if(get("resourceCombat")&&get("resourceCombat")!==combat.id)return false;
            const spell=get("consumedSpellSlot")===true||effect.name==="Consumed Spell Slot";
            const personal=get("bonusActionUsed")===true||get("reactionUsed")===true||get("savageUsed")===true||["Bonus Action - used","Reaction - used"].includes(effect.name);
            if(ending||!combat.started) {
                // D&D5e deletes expired and pseudo-expiry effects on combat exit.
                // Updating those in the deleteCombat hook races its queued deletion.
                const nativeExpiry=effect.specialDuration||["sourceStart","sourceEnd","targetStart","targetEnd"].includes(effect.duration?.expiry);
                if(effect.duration?.expired||nativeExpiry)return false;
                return spell||personal;
            }
            if(spell)return get("resourceTurn")!==current;
            return personal&&actor.uuid===incoming;
        }).map(effect=>effect.id);
        if(ids.length)await actor.updateEmbeddedDocuments("ActiveEffect",ids.map(_id=>({_id,disabled:true})));
    }
}
Hooks.once("init",()=>{
    game.settings.register(ID,"bonusActionTracker",{name:"Bonus Action Tracker",hint:"Track bonus actions for all participants during active combat, block additional bonus actions until your next turn, and reject off-turn bonus actions. Disable/delete the marker to override.",scope:"world",config:true,type:Boolean,default:true});
    game.settings.register(ID,"spellSlotTurnTracker",{name:"Spell Slot Casting Tracker",hint:"For player characters in active combat, Consumed Spell Slot tracks a slot spent casting a spell on the current combat turn and blocks another slot-funded spell that turn. Free casts and cantrips remain available. Clears when the turn changes.",scope:"world",config:true,type:Boolean,default:true});
});
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationResources={resourceUsed,resourceEffect,markResource,reuseMarker,
        bonusActionUsed:actor=>resourceUsed(actor,"bonus"),hasCastWithSlot:actor=>resourceUsed(actor,"spell"),
        markBonusAction:(actor,options)=>markResource(actor,"bonus",options),markSpellCast:(actor,options)=>markResource(actor,"spell",options)};
    Hooks.on("dnd5e.activityConsumption",allowTurnResourceUse);
    Hooks.on("dnd5e.postActivityConsumption",(activity,usage,message)=>{const task=recordTurnResources(activity,usage,message);globalThis.Ugmuls55eAutomationPendingCast?.track(message,task);task.catch(error=>console.error("Ugmuls 5.5e Automation | Turn resource tracking failed:",error));});
    Hooks.on("updateCombat",(combat,changes)=>resetTurnResources(combat,changes).catch(error=>console.error("Ugmuls 5.5e Automation | Turn resource reset failed:",error)));
    Hooks.on("deleteCombat",combat=>resetTurnResources(combat,{},true).catch(error=>console.error("Ugmuls 5.5e Automation | Combat resource cleanup failed:",error)));
});
