const MODULE_ID="ugmuls-5-5e-automation";
const enabled=()=>game.settings.get(MODULE_ID,"recklessAttackAutomation")===true;
const activating=new Map();
let conditionBridge=false;
const recklessSubmissions=new WeakMap();
const attackedTurns=new Map();
const combatTurn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
export function canActivateReckless(actor) {
    const turn=combatTurn();
    if(!turn)return true;
    if(game.combat.combatant?.actor?.uuid!==actor?.uuid)return false;
    return attackedTurns.get(actor.uuid)!==turn&&actor.getFlag?.(MODULE_ID,"recklessAttackTurn")!==turn;
}
export async function recordAttackTurn(rolls,{subject}={}) {
    const actor=subject?.actor??subject?.item?.actor,turn=combatTurn();
    if(!enabled()||!turn||!actor?.isOwner||!recklessFeature(actor)||!rolls?.length||game.combat.combatant?.actor?.uuid!==actor.uuid)return;
    if(attackedTurns.get(actor.uuid)===turn)return;
    // Mark every attack, including Dexterity, ranged and spell attacks; canceling a dialog never reaches this hook.
    attackedTurns.set(actor.uuid,turn);
    await actor.setFlag(MODULE_ID,"recklessAttackTurn",turn);
}
export function syncRecklessConditionChoice(config,mode) {
    const key="automated-conditions-5e",action=mode===0?"normal":"advantage";
    const options=[config.options,...Array.from(config.rolls??[],roll=>roll.options)].filter(Boolean);
    const states=new Set([config[key],...options.map(options=>options[key])].filter(Boolean));
    for(const state of states) {
        // AC snapshots the conditions when opening the dialog. The effect was
        // activated later, so explicitly submit the user's new mode to AC too.
        state.explicitModeOverride={action,source:"dialog",family:"d20",proposedAction:state.proposedButton??state.calculatedDefaultButton??"normal",replacesCalculatedMode:true};
        state.explicitRollDialogAction=action;
        state.explicitRollDialogOverride=true;
        state.advantageMode=mode;
        state.defaultButton=action;
    }
    for(const value of options) {
        value.advantageMode=mode;
        value.advantage=mode===1;
        value.disadvantage=false;
    }
    config.advantage=mode===1;config.disadvantage=false;
}
export function finalizeRecklessRolls(app,rolls) {
    const mode=recklessSubmissions.get(app);
    recklessSubmissions.delete(app);
    if(mode===undefined)return rolls;
    // The native dialog rebuilds from its original configuration on submit.
    // Apply the explicit Reckless choice after condition hooks finish, before evaluation.
    for(const roll of rolls??[]) {
        if(roll.evaluated)continue;
        roll.options.advantage=true;
        roll.options.disadvantage=mode===0;
        roll.options.advantageMode=mode;
        roll.options.rsaRecklessSubmission=mode;
        syncRecklessConditionChoice({rolls:[roll]},mode);
        roll.configureModifiers();
    }
    return rolls;
}
export function completeRecklessConfiguration(rolls,config) {
    if(config?.subject?.type!=="attack")return;
    for(const roll of rolls??[]) {
        const mode=roll.options?.rsaRecklessSubmission;
        if(mode===undefined||roll.evaluated)continue;
        // Automated Conditions can reconcile the original, pre-Reckless state
        // after the dialog closes. Restore this submission's explicit choice
        // at the last configuration hook, immediately before evaluation.
        delete roll.options.rsaRecklessSubmission;
        roll.options.advantage=true;
        roll.options.disadvantage=mode===0;
        roll.options.advantageMode=mode;
        roll.configureModifiers();
    }
}
export function recklessFeature(actor) {
    return Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
        (item.identifier==="reckless-attack"||item.system?.identifier==="reckless-attack"||/^reckless attack$/i.test(item.name?.trim()??"")));
}
export function recklessEffects(actor) {
    const feature=recklessFeature(actor);
    const sources=new Set(Array.from(feature?.effects??[]).map(effect=>effect.uuid));
    return Array.from(actor?.effects??[]).filter(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&
        (effect.getFlag?.(MODULE_ID,"reckless")===true||sources.has(effect._stats?.duplicateSource)||sources.has(effect._stats?.compendiumSource)||
            /^reckless(?: attack)?$/i.test(effect.name?.trim()??"")));
}
export async function activateReckless(actor) {
    if(!enabled()||!actor?.isOwner)throw Error("Reckless Attack requires ownership of the attacker.");
    const feature=recklessFeature(actor);if(!feature)throw Error("Reckless Attack feature is unavailable.");
    if(recklessEffects(actor).length)return;
    if(activating.has(actor.uuid))return activating.get(actor.uuid);
    if(!canActivateReckless(actor))throw Error("Reckless Attack can only be activated on your first attack roll of your turn.");
    const task=(async()=>{
        const activity=Array.from(feature.system?.activities??[]).find(activity=>activity.effects?.length);
        const effects=activity?await activity.getApplicableEffects():Array.from(feature.effects??[]).filter(effect=>!effect.transfer);
        const data=[];
        for(const effect of effects??[]) {
            const copy=effect.toObject();delete copy._id;
            copy.disabled=false;copy.transfer=false;
            copy.duration={...copy.duration,rounds:null,turns:null,seconds:null,value:null,expired:false,expiry:"sourceStart"};
            copy.start=CONFIG.ActiveEffect.documentClass.getEffectStart();
            copy.system??={};copy.system.origin={...copy.system.origin,actor:actor.uuid,item:feature.uuid,activity:activity?.uuid};
            copy.system.changes=await CONFIG.ActiveEffect.documentClass.forApplication(copy.system.changes??[],activity??feature,actor);
            copy.flags??={};copy.flags[MODULE_ID]={...copy.flags[MODULE_ID],reckless:true};
            copy._stats={...copy._stats,[effect.inCompendium?"compendiumSource":"duplicateSource"]:effect.uuid};
            data.push(copy);
        }
        // Some imported features have text but no effect; retain the same cue,
        // source-turn expiry and rule integration with a marker effect.
        if(!data.length)data.push({name:"Reckless Attack",img:feature.img,disabled:false,transfer:false,
            duration:{rounds:null,turns:null,seconds:null,value:null,expired:false,expiry:"sourceStart"},start:CONFIG.ActiveEffect.documentClass.getEffectStart(),
            system:{changes:[],origin:{actor:actor.uuid,item:feature.uuid}},flags:{[MODULE_ID]:{reckless:true}}});
        await actor.createEmbeddedDocuments("ActiveEffect",data);
    })();
    activating.set(actor.uuid,task);
    try {await task;}finally {activating.delete(actor.uuid);}
}
function attackActor(config,message) {
    return (message?.data?.speaker?ChatMessage.getSpeakerActor(message.data.speaker):null)??config.subject?.actor;
}
function strengthAttack(config,roll=config.rolls?.[0]) {
    return (roll?.options?.ability??config.ability??config.subject?.attack?.ability)==="str";
}
export function recklessDefaults(config,dialog,message,force=false) {
    if(!enabled()||config.subject?.type!=="attack"||(!force&&conditionBridge&&game.modules?.get("automated-conditions-5e")?.active))return;
    const actor=attackActor(config,message);
    const descriptors=message?.data?.system?.targets;
    const targets=Array.isArray(descriptors)?descriptors.map(target=>fromUuidSync(target.token,{strict:false})?.actor).filter(Boolean):
        Array.from(game.user.targets??[],token=>(token.document??token).actor).filter(Boolean);
    const own=strengthAttack(config)&&recklessEffects(actor).length>0;
    const incoming=targets.length>0&&targets.every(target=>recklessEffects(target).length>0);
    if(!own&&!incoming)return;
    config.advantage=true;
    for(const roll of config.rolls??[]) {
        roll.options??={};
        const state=roll.options["automated-conditions-5e"]??config.options?.["automated-conditions-5e"]??config["automated-conditions-5e"];
        const counts=state?.modeCounts;
        // AC represents Normal with both booleans true even when there are
        // no actual disadvantage sources. Its source counts disambiguate that.
        const dis=counts?!!(counts.disadvantages?.present||counts.noAdvantages?.present||state.explicitModeOverride?.action==="disadvantage"):
            !!(config.disadvantage||roll.options.disadvantage||roll.options.advantageMode===-1);
        roll.options.advantage=true;roll.options.disadvantage=dis;roll.options.advantageMode=dis?0:1;
    }
    dialog.options??={};dialog.options.defaultButton=config.rolls?.[0]?.options?.disadvantage?"normal":"advantage";
    return dialog.options.defaultButton;
}
export function registerRecklessConditions(api=globalThis.ac5e?.usageRules) {
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try {
        const own=api.register({key:"rsaRecklessAttack",scope:"universal",hook:"attack",target:"subject",mode:"advantage",name:"Reckless Attack",persistent:false,
            evaluate:sandbox=>enabled()&&sandbox.ability?.str===true&&recklessEffects(fromUuidSync(sandbox.actorUuid,{strict:false})).length>0});
        const incoming=api.register({key:"rsaRecklessTarget",scope:"universal",hook:"attack",target:"subject",mode:"advantage",name:"Reckless target",persistent:false,
            evaluate:sandbox=>enabled()&&!!sandbox.opponentActorUuid&&recklessEffects(fromUuidSync(sandbox.opponentActorUuid,{strict:false})).length>0});
        conditionBridge=!!(own&&incoming);
    } catch(err){conditionBridge=false;console.warn("Ugmuls 5.5e Automation | Reckless condition integration failed:",err);}
    return conditionBridge;
}
export function prepareRecklessButtons(app,context) {
    const config=app.config;
    if(config?.subject?.type!=="attack")return;
    const selected=recklessDefaults({...config,rolls:app.rolls??config.rolls},{options:{}},app.message);
    if(selected)for(const [key,button]of Object.entries(context.buttons??{}))button.default=key===selected;
}
export function addRecklessButton(app) {
    if(!enabled()||app.config?.subject?.type!=="attack")return;
    const actor=attackActor(app.config,app.message);
    if(!actor?.isOwner||!recklessFeature(actor))return;
    const root=app.element,adv=root?.querySelector('.dialog-buttons button[data-action="advantage"]');
    if(!adv||root.querySelector("[data-rsa-reckless]"))return;
    const wrapper=document.createElement("div");wrapper.className="rsa-reckless-roll-buttons";
    adv.before(wrapper);wrapper.append(adv);adv.textContent=game.i18n.localize("DND5E.Advantage");adv.title=game.i18n.localize("DND5E.Advantage");
    const button=document.createElement("button");button.type="button";button.dataset.rsaReckless="";button.textContent="Reckless";
    const eligible=strengthAttack(app.config,app.rolls?.[0]??app.config.rolls?.[0]);
    button.disabled=!eligible||recklessEffects(actor).length>0||!canActivateReckless(actor);
    button.title=!eligible?"Reckless Attack requires a Strength attack":recklessEffects(actor).length?"Reckless Attack is already active":!canActivateReckless(actor)?"Reckless Attack is only available on your first attack roll of your turn":"Use Reckless Attack and roll; effect expires at your next turn start";
    button.addEventListener("click",async event=>{
        event.preventDefault();event.stopImmediatePropagation();button.disabled=true;
        try {
            await activateReckless(actor);
            if(!app.rendered)return;
            const config={...app.config,rolls:app.rolls??app.config.rolls};
            const selected=recklessDefaults(config,{options:{}},app.message,true)??"advantage";
            const mode=selected==="normal"?0:1;
            recklessSubmissions.set(app,mode);
            syncRecklessConditionChoice(app.config,mode);
            syncRecklessConditionChoice(config,mode);
            app.element.querySelector(`.dialog-buttons button[data-action="${selected}"]`)?.click();
        } catch(err){button.disabled=!canActivateReckless(actor);console.error("Ugmuls 5.5e Automation | Reckless Attack failed:",err);ui.notifications.error("Could not activate Reckless Attack.");}
    });wrapper.prepend(button);
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"recklessAttackAutomation",{
    name:"Reckless Attack Assistance",hint:"Offer Reckless beside Advantage only on the first attack of your turn, using Strength, for characters with the feature. Apply the feature's effect until next turn start and recommend advantage for attacks against Reckless creatures.",scope:"world",config:true,type:Boolean,default:true
}));
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerRecklessConditions(usageRules));
Hooks.once("ready",()=>{
    registerRecklessConditions();
    Hooks.on("dnd5e.rollAttackV2",(rolls,data)=>recordAttackTurn(rolls,data).catch(error=>console.error("Ugmuls 5.5e Automation | First attack tracking failed:",error)));
    globalThis.Ugmuls55eAutomationReckless={prepareRecklessButtons,addRecklessButton,finalizeRecklessRolls};
    Hooks.on("dnd5e.preRollAttackV2",recklessDefaults);
    Hooks.on("dnd5e.postRollConfiguration",completeRecklessConfiguration);
    Hooks.on("dnd5e.buildRollConfig",(app,config)=>{
        const mode=recklessSubmissions.get(app);
        if(mode!==undefined)syncRecklessConditionChoice(config,mode);
    });
    Hooks.on("dnd5e.postBuildAttackRollConfig",(process,roll,index,{app,formData}={})=>{
        recklessDefaults({...process,rolls:[roll]},{options:{}},app?.message);
    });
});
