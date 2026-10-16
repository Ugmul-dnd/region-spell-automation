const ID="ugmuls-5-5e-automation",bridges=new Set();
const enabled=()=>game.settings.get(ID,"zealousPresenceAutomation")===true;
export function isZealousPresence(effect){
    if(/^zealous presence(?:\s*\([^)]*\))?$/i.test(effect?.name?.trim()??""))return true;
    const uuid=effect?.system?.origin?.item;if(!uuid)return false;
    let item;try{item=fromUuidSync(uuid,{strict:false});}catch{return false;}
    return (item?.identifier??item?.system?.identifier)==="zealous-presence";
}
export function zealousPresenceActive(actor){return Array.from(actor?.appliedEffects??actor?.effects??[]).some(effect=>isZealousPresence(effect)&&!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&!effect.system?.expired);}
function actorFor(config,message){return (message?.data?.speaker?ChatMessage.getSpeakerActor(message.data.speaker):null)??config.subject?.actor??config.subject?.item?.actor??(["character","npc"].includes(config.subject?.type)?config.subject:null);}
export function zealousDefaults(config,dialog,message,kind="attack"){
    if(!enabled()||(kind==="attack"&&config.subject?.type!=="attack")||(bridges.has(kind)&&game.modules?.get("automated-conditions-5e")?.active)||!zealousPresenceActive(actorFor(config,message)))return;
    config.advantage=true;
    for(const roll of config.rolls??[]){
        roll.options??={};
        const state=roll.options["automated-conditions-5e"]??config.options?.["automated-conditions-5e"]??config["automated-conditions-5e"],counts=state?.modeCounts;
        const disadvantage=counts?!!(counts.disadvantages?.present||counts.noAdvantages?.present||state.explicitModeOverride?.action==="disadvantage"):
            !!(config.disadvantage||roll.options.disadvantage||roll.options.advantageMode===-1);
        roll.options.advantage=true;roll.options.disadvantage=disadvantage;roll.options.advantageMode=disadvantage?0:1;
    }
    dialog.options??={};dialog.options.defaultButton=config.rolls?.[0]?.options.disadvantage?"normal":"advantage";
    return dialog.options.defaultButton;
}
export function prepareZealousButtons(app,context){
    const choice=zealousDefaults({...app.config,rolls:app.rolls??app.config.rolls},{options:{}},app.message,"attack");
    if(choice)for(const[key,button]of Object.entries(context.buttons??{}))button.default=key===choice;
}
export function registerZealousConditions(api=globalThis.ac5e?.usageRules){
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    for(const kind of ["attack","save"]){
        try{if(api.register({key:"rsaZealousPresence"+kind,scope:"universal",hook:kind,target:"subject",mode:"advantage",name:"Zealous Presence",persistent:false,
            evaluate:sandbox=>{if(!enabled())return false;try{return zealousPresenceActive(fromUuidSync(sandbox.actorUuid,{strict:false}));}catch{return false;}}}))bridges.add(kind);}
        catch(error){bridges.delete(kind);console.warn("Zealous Presence condition integration failed",error);}
    }
    return bridges.size>0;
}
export function zealousExpiry(effect){
    if(!enabled()||!isZealousPresence(effect))return null;
    const source=effect.getSourceActor?.();if(!source?.uuid)return null;
    return {"duration.expiry":"sourceStart","duration.rounds":null,"duration.turns":null,"duration.seconds":null,"duration.expired":false,
        "flags.dnd5e.isTemporary":false,"system.origin.actor":source.uuid};
}
Hooks.once("init",()=>game.settings.register(ID,"zealousPresenceAutomation",{name:"Zealous Presence Assistance",hint:"While Zealous Presence is active, recommend Advantage on all attacks and saving throws with normal advantage/disadvantage cancellation. Expire the buff at the start of its source Zealot's next turn; attacks do not consume it.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerZealousConditions(usageRules));
Hooks.once("ready",async()=>{
    registerZealousConditions();globalThis.Ugmuls55eAutomationZealous={prepareZealousButtons};
    Hooks.on("dnd5e.preRollAttackV2",(config,dialog,message)=>zealousDefaults(config,dialog,message,"attack"));
    Hooks.on("dnd5e.preRollSavingThrowV2",(config,dialog,message)=>zealousDefaults(config,dialog,message,"save"));
    Hooks.on("preCreateActiveEffect",effect=>{if(effect.parent?.documentName!=="Actor")return;const updates=zealousExpiry(effect);if(updates)effect.updateSource(updates);});
    if(game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id)){
        const actors=new Map(Array.from(game.actors??[]).map(actor=>[actor.uuid,actor]));
        for(const token of canvas.scene?.tokens??[])if(token.actor)actors.set(token.actor.uuid,token.actor);
        for(const actor of actors.values())for(const effect of actor.effects??[]){
            if(effect.disabled||effect.duration?.expired||effect.system?.expired)continue;
            const updates=zealousExpiry(effect);
            if(updates&&(effect.duration?.expiry!=="sourceStart"||effect.getFlag?.("dnd5e","isTemporary")===true))await effect.update(updates);
        }
    }
});
