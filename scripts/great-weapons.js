const ID="ugmuls-5-5e-automation",choices=new WeakMap();
const enabled=key=>game.settings.get(ID,key)===true;
export function greatWeaponFeature(actor,key){return Array.from(actor?.items??[]).find(item=>item.type==="feat"&&item.system?.source?.rules!=="2014"&&((item.identifier??item.system?.identifier)===key||item.name?.trim().toLowerCase()===key.replaceAll("-"," ")));}
function context(app){
    const activity=app.config?.subject,item=activity?.item;
    const origin=app.message?.data?.system?.origin,usage=typeof origin==="string"?game.messages.get(origin):origin;
    const attackId=app.message?.data?.flags?.[ID]?.damageAttackId;
    const attack=attackId?game.messages.get(attackId):Array.from(usage?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    // Chat activities can belong to a snapshot actor. Resolve the owned actor
    // from the attack/speaker, as the other damage riders do.
    const actor=attack?.getAssociatedActor?.()??(app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??usage?.getAssociatedActor?.()??activity?.actor??item?.actor;
    const mode=app.config?.attackMode??attack?.rolls?.[0]?.options?.attackMode??attack?.rolls?.[0]?.options?.attack?.mode??attack?.system?.mode;
    const activation=usage?.system?.activation?.type??activity?.activation?.type??item?.system?.activation?.type;
    return {activity,item,actor,attack,mode,activation};
}
function weaponEligible(app){const {activity,item,actor}=context(app);return activity?.type==="attack"&&item?.type==="weapon"&&actor?.isOwner&&!app.message?.data?.flags?.[ID]?.masteryGraze;}
export function fightingEligible(app){
    if(!weaponEligible(app)||!enabled("greatWeaponFightingAutomation"))return false;
    const {activity,item,actor,mode}=context(app),properties=new Set(item.system?.properties??[]);
    const melee=(item.system?.attackType??activity.attack?.type?.value)==="melee";
    const twoHands=properties.has("two")&&!mode?.includes("oneHanded")||properties.has("ver")&&mode==="twoHanded";
    return !!(greatWeaponFeature(actor,"great-weapon-fighting")&&melee&&twoHands&&!mode?.includes("thrown"));
}
export function masterEligible(app){
    if(!weaponEligible(app)||!enabled("greatWeaponMasterAutomation"))return false;
    const {item,actor,attack,activation}=context(app);
    const ownTurn=!game.combat?.started||game.combat.combatant?.actor?.uuid===actor.uuid;
    return !!(greatWeaponFeature(actor,"great-weapon-master")&&new Set(item.system?.properties??[]).has("hvy")&&activation==="action"&&ownTurn&&attack?.system?.evaluatedTargets?.some(target=>target.isMiss===false));
}
export function addGreatWeaponChoices(app){
    if(fightingEligible(app))globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{key:"greatWeaponFighting",label:"Great Weapon Fighting",value:true,locked:true});
    if(masterEligible(app))globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{key:"greatWeaponMaster",label:"Great Weapon Master",value:choices.get(app)!==false,change:yes=>choices.set(app,yes)});
}
export function minimumThree(roll){
    // Work on an unevaluated copy; nested Savage Attacker pools keep their own dice.
    if(roll._evaluated)return roll;
    const copy=roll.constructor.fromData(roll.toJSON());
    function visit(current){
        for(const term of current.terms??[]){
            if(term instanceof foundry.dice.terms.DiceTerm&&!term.isDeterministic){
                const minimum=Math.max(3,...(term.modifiers??[]).filter(mod=>/^min\d+$/.test(mod)).map(mod=>Number(mod.slice(3))));
                term.modifiers=[...(term.modifiers??[]).filter(mod=>!/^min\d+$/.test(mod)),"min"+minimum];
            }
            for(const nested of term.rolls??[])visit(nested);
            if(term.rolls?.length&&Array.isArray(term.terms))term.terms=term.rolls.map(nested=>nested.formula);
            // DiceTerm.roll is a method, not a nested Roll.
            if(Array.isArray(term.roll?.terms)&&typeof term.roll.resetFormula==="function"){visit(term.roll);term.term=term.roll.formula;}
        }
        current.resetFormula();
    }
    visit(copy);copy.options.rsaGreatWeaponFighting=true;return copy;
}
export function finalizeGreatWeapons(app,rolls){
    let result=rolls;
    if(masterEligible(app)&&choices.get(app)!==false&&!rolls.some(roll=>roll.options?.rsaGreatWeaponMaster)){
        const index=app.config.rolls?.findIndex(roll=>roll.base===true)??-1;
        const bonus=Number(context(app).actor.system?.attributes?.prof??0);
        if(index>=0&&rolls[index]&&bonus>0){
            const roll=rolls[index];result=[...rolls];
            result[index]=new roll.constructor(roll.formula+" + "+bonus+"[Great Weapon Master]",roll.data,{...foundry.utils.deepClone(roll.options),configured:true,preprocessed:true,rsaGreatWeaponMaster:true});
        }
    }
    if(fightingEligible(app))result=result.map(roll=>roll.options?.rsaGreatWeaponFighting?roll:minimumThree(roll));
    return result;
}
Hooks.once("init",()=>{
    for(const [key,name,hint]of [["greatWeaponFightingAutomation","Great Weapon Fighting","Treat damage dice of 1 or 2 as 3 on attacks with a melee weapon wielded in two hands (Two-Handed or Versatile)."],["greatWeaponMasterAutomation","Great Weapon Master","Offer proficiency-bonus damage on Heavy-weapon hits made with the Attack action on your turn. Hew remains manual."]])game.settings.register(ID,key,{name:name+" Assistance",hint,scope:"world",config:true,type:Boolean,default:true});
});
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationGreatWeapons={addGreatWeaponChoices,finalizeGreatWeapons};
    Hooks.on("dnd5e.preRollDamageV2",(config,dialog)=>{
        if(config.subject?.type!=="attack"||config.subject.item?.type!=="weapon"||!enabled("greatWeaponFightingAutomation")&&!enabled("greatWeaponMasterAutomation"))return;
        const configure=dialog.configure;Object.assign(dialog,globalThis.Ugmuls55eAutomationDamage.configurePromptDialog("damage",dialog));if(configure===false)dialog.configure=false;
    });
});
