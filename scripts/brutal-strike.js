import {recklessFeature,recklessEffects,canActivateReckless,activateReckless,syncRecklessConditionChoice} from "./reckless-attack.js";
import {combatTurn} from "./frenzy.js";
const ID="ugmuls-5-5e-automation",choices=new WeakMap(),reservations=new Map(),effectChoices=new WeakMap();
export const brutalFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&item.system?.source?.rules!=="2014"&&((item.identifier??item.system?.identifier)==="brutal-strike"||/^brutal strike$/i.test(item.name??"")));
function actorFor(app){return (app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config?.subject?.actor??app.config?.subject?.item?.actor;}
export function brutalDisadvantage(config,rolls=config.rolls??[]){
    return rolls.some(roll=>{
        const state=roll.options?.["automated-conditions-5e"]??config.options?.["automated-conditions-5e"]??config["automated-conditions-5e"];
        if(state?.modeCounts)return !!(state.modeCounts.disadvantages?.present||state.explicitModeOverride?.action==="disadvantage");
        return !!(config.disadvantage||roll.options?.disadvantage||roll.options?.advantageMode===-1);
    });
}
export function brutalAvailable(app){
    const actor=actorFor(app),turn=combatTurn(),rolls=app.rolls??app.config?.rolls??[],config=app.config??{};
    const ability=rolls[0]?.options?.ability??config.ability??config.subject?.attack?.ability;
    const item=config.subject?.item,unarmed=config.subject?.attack?.type?.classification==="unarmed"||item?.system?.type?.value==="unarmed"||/^(unarmed|empowered|elemental) strikes?$/i.test(item?.name??"");
    return game.settings.get(ID,"brutalStrikeAutomation")===true&&!!turn&&game.combat.combatant?.actor?.uuid===actor?.uuid&&
        config.subject?.type==="attack"&&(item?.type==="weapon"||unarmed)&&actor?.isOwner&&!!brutalFeature(actor)&&!!recklessFeature(actor)&&ability==="str"&&
        actor.getFlag?.(ID,"brutalStrikeTurn")!==turn&&(!reservations.has(actor.uuid)||reservations.get(actor.uuid).turn!==turn||reservations.get(actor.uuid).app===app)&&
        !brutalDisadvantage(config,rolls)&&
        (recklessEffects(actor).length>0||game.settings.get(ID,"recklessAttackAutomation")===true&&canActivateReckless(actor));
}
export async function selectBrutal(app){
    if(!brutalAvailable(app))throw Error("Brutal Strike needs a Strength attack on your turn, no disadvantage, and Reckless Attack active or available on your first attack.");
    const actor=actorFor(app),turn=combatTurn();
    if(!recklessEffects(actor).length)await activateReckless(actor);
    if(!brutalAvailable(app)||combatTurn()!==turn)throw Error("This attack or combat turn changed before Brutal Strike.");
    choices.set(app,{actor,turn});reservations.set(actor.uuid,{app,turn});
    syncRecklessConditionChoice(app.config,0);
}
export function finalizeBrutalAttack(app,rolls){
    const entry=choices.get(app);if(!entry)return rolls;
    if(entry.turn!==combatTurn()||!brutalAvailable(app)){releaseBrutal(app);throw Error("Brutal Strike is no longer available for this attack.");}
    for(const roll of rolls){
        syncRecklessConditionChoice({rolls:[roll]},0);
        roll.options.rsaBrutalStrike={turn:entry.turn,actor:entry.actor.uuid};
        roll.options.advantage=false;roll.options.disadvantage=false;roll.options.advantageMode=0;
        roll.configureModifiers();
    }
    return rolls;
}
export function completeBrutalConfiguration(rolls){
    for(const roll of rolls??[]){if(!roll.options?.rsaBrutalStrike||roll.evaluated)continue;syncRecklessConditionChoice({rolls:[roll]},0);roll.configureModifiers();}
}
export function releaseBrutal(app){const entry=choices.get(app);if(entry&&reservations.get(entry.actor.uuid)?.app===app)reservations.delete(entry.actor.uuid);choices.delete(app);}
export async function recordBrutalAttack(rolls,{subject}={}){
    const actor=subject?.actor??subject?.item?.actor,record=rolls?.find(roll=>roll.options?.rsaBrutalStrike)?.options.rsaBrutalStrike;
    if(!record||!actor?.isOwner)return;
    try{await actor.setFlag(ID,"brutalStrikeTurn",record.turn);}finally{const pending=reservations.get(actor.uuid);if(pending?.turn===record.turn)reservations.delete(actor.uuid);}
}
export function addBrutalButton(app){
    if(app.config?.subject?.type!=="attack"||!brutalFeature(actorFor(app))||game.settings.get(ID,"brutalStrikeAutomation")!==true)return;
    const root=app.element,normal=root?.querySelector('.dialog-buttons button[data-action="normal"]');if(!normal||root.querySelector('[data-rsa-brutal]'))return;
    const wrapper=document.createElement("div");wrapper.className="rsa-brutal-roll-buttons";normal.before(wrapper);wrapper.append(normal);
    const button=document.createElement("button");button.type="button";button.dataset.rsaBrutal="";button.textContent="Brutal";button.disabled=!brutalAvailable(app);
    button.dataset.tooltip="Once per turn: use Reckless Attack, forgo all advantage on this Strength attack, and add Brutal Strike damage on a hit. No disadvantage allowed. Reckless must be activated on your first attack.";
    button.addEventListener("click",async event=>{event.preventDefault();event.stopImmediatePropagation();button.disabled=true;try{await selectBrutal(app);if(!app.rendered){releaseBrutal(app);return;}normal.click();}catch(error){releaseBrutal(app);console.error("Brutal Strike",error);ui.notifications.error(error.message);button.disabled=!brutalAvailable(app);}});wrapper.prepend(button);
}
function damageContext(app){const data=app.message?.data??{},origin=typeof data.system?.origin==="string"?game.messages.get(data.system.origin):data.system?.origin,id=data.flags?.[ID]?.damageAttackId;const attack=id?game.messages.get(id):origin?.type==="attack"?origin:[...(origin?.getAssociatedRolls?.("attack")??[])].sort((a,b)=>b.timestamp-a.timestamp)[0];return{attack,actor:attack?.getAssociatedActor?.()??app.config?.subject?.actor};}
export function finalizeBrutalDamage(app,rolls){
    const {attack,actor}=damageContext(app),record=attack?.getFlag?.(ID,"brutalStrike")??attack?.rolls?.find(roll=>roll.options?.rsaBrutalStrike)?.options.rsaBrutalStrike;
    if(!record||app.config?.subject?.type!=="attack"||app.message?.data?.flags?.[ID]?.masteryGraze||!(attack.system?.evaluatedTargets??[]).some(target=>target.isMiss===false)||rolls.some(roll=>roll.options?.rsaBrutalDamage))return rolls;
    const feature=brutalFeature(actor);if(!feature)return rolls;
    const activity=Array.from(feature.system?.activities?.values?.()??feature.system?.activities??[]).find(activity=>activity.damage?.parts?.length);
    const source=activity?.getDamageConfig?.()?.rolls?.[0];
    const base=rolls[0]?.options??{},critical={...base.critical,bonusDice:0,bonusDamage:""},options={...source?.options,type:base.type,types:base.type?[base.type]:[],isCritical:base.isCritical===true,critical,flavor:"Brutal Strike",rsaBrutalDamage:true};
    let extra;
    if(source?.parts?.length)extra=CONFIG.Dice.DamageRoll.fromConfig({...source,options},{critical});
    else{const level=Number(Array.from(actor.items??[]).find(item=>item.type==="class"&&(item.identifier??item.system?.identifier)==="barbarian")?.system?.levels??0);extra=new CONFIG.Dice.DamageRoll((level>=17?"2d10":"1d10")+"[Brutal Strike]",actor.getRollData?.()??{},options);}
    return [...rolls,extra];
}
export function brutalEffectOptions(actor){
    const features=Array.from(actor?.items??[]).filter(item=>item.type==="feat"&&item.system?.source?.rules!=="2014");
    const has=id=>features.some(item=>(item.identifier??item.system?.identifier)===id||item.name?.toLowerCase()===id.replaceAll("-"," "));
    const improved=has("improved-brutal-strike"),double=has("improved-brutal-strike-2")||features.some(item=>/^improved brutal strike \(2\)$/i.test(item.name??""));
    return {options:["Forceful Blow","Hamstring Blow",...(improved||double?["Staggering Blow","Sundering Blow"]:[])],count:double?2:1};
}
export function selectBrutalEffects(app,values){
    const {actor}=damageContext(app),{options,count}=brutalEffectOptions(actor);
    if(values.length>count||new Set(values).size!==values.length||values.some(value=>!options.includes(value)))throw Error("Choose different available Brutal Strike effects.");
    effectChoices.set(app,values);
}
export function addBrutalDamageChoice(app){
    const rolls=finalizeBrutalDamage(app,app.rolls??[]);if(!rolls.some(roll=>roll.options?.rsaBrutalDamage))return;
    const group=globalThis.Ugmuls55eAutomationDamage?.addDamageChoice(app,{key:"brutal-strike",label:"Brutal Strike",value:true,locked:true});
    const configuration=group?.parentElement;if(!configuration)return;
    const {actor}=damageContext(app),{options,count}=brutalEffectOptions(actor);
    const selected=effectChoices.get(app)??[options[0]];
    for(let index=0;index<count;index++){
        if(configuration.querySelector('[data-brutal-effect="'+index+'"]'))continue;
        const row=document.createElement("div");row.className="form-group";row.dataset.brutalEffect=String(index);
        const label=document.createElement("label");label.textContent=count===1?"Brutal effect":"Brutal effect "+(index+1);
        const fields=document.createElement("div");fields.className="form-fields";
        const select=document.createElement("select");select.setAttribute("aria-label",label.textContent);
        for(const value of [...(index?[""]:[]),...options.filter(value=>value!==selected[1-index])]){
            const option=document.createElement("option");option.value=value;option.textContent=value||"None";select.append(option);
        }
        select.value=selected[index]??"";
        select.addEventListener("change",event=>{event.stopPropagation();const values=[...selected];values[index]=select.value;selectBrutalEffects(app,values.filter(Boolean));app.rebuild();});
        fields.append(select);row.append(label,fields);configuration.append(row);
    }
}
export async function commitBrutalEffects(app,options){
    if(!options?.dnd5e?.submitted){effectChoices.delete(app);return;}
    if(!(app.rolls??[]).some(roll=>roll.options?.rsaBrutalDamage))return;
    const {actor}=damageContext(app),values=effectChoices.get(app)??["Forceful Blow"];
    selectBrutalEffects(app,values);
    app.message.data.flags??={};app.message.data.flags[ID]??={};
    app.message.data.flags[ID].brutalEffects={values,actor:actor.uuid};
    effectChoices.delete(app);
}
export function renderBrutalEffects(card,html){
    const record=card.getFlag?.(ID,"brutalEffects");if(!record)return;
    const root=html?.querySelector?html:html?.[0];if(!root||root.querySelector(".rsa-brutal-effects"))return;
    const notes={"Forceful Blow":"Push 15 ft straight away; you may move up to half your Speed straight toward the target without Opportunity Attacks.","Hamstring Blow":"Speed reduced by 15 ft until the start of your next turn. Only the newest Hamstring applies.","Staggering Blow":"Disadvantage on the next saving throw; no Opportunity Attacks until the start of your next turn.","Sundering Blow":"The next attack by another creature before the start of your next turn gains +5. Only one Sundering bonus applies."};
    const block=document.createElement("div");block.className="rsa-brutal-effects";
    for(const value of record.values){const line=document.createElement("p"),label=document.createElement("strong");label.textContent=value+": ";line.append(label,document.createTextNode(notes[value]??""));block.append(line);}
    (root.querySelector(".message-content")??root).append(block);
}
const applyingEffects=new Set();
const effectNames={"Hamstring Blow":"Hamstrung","Staggering Blow":"Staggered","Sundering Blow":"Sundered"};
export function brutalSourceEffect(actor,value){
    const identifier=value==="Hamstring Blow"?"brutal-strike":"improved-brutal-strike";
    const item=Array.from(actor?.items??[]).find(item=>item.type==="feat"&&(item.identifier??item.system?.identifier)===identifier);
    return Array.from(item?.effects??[]).find(effect=>effect.name?.toLowerCase()===effectNames[value]?.toLowerCase());
}
function brutalCardContext(card){return damageContext({message:{data:{system:card.system,flags:card.flags}}});}
export async function applyBrutalEffects(card,{manual=false}={}){
    const record=card?.getFlag?.(ID,"brutalEffects");
    if(card?.type!=="damage"||!record||card.getFlag(ID,"pendingDamage")||!game.user.isGM||(game.users?.activeGM&&game.users.activeGM.id!==game.user.id)||applyingEffects.has(card.id))return;
    const {attack}=brutalCardContext(card),usage=typeof card.system?.origin==="string"?game.messages.get(card.system.origin):card.system?.origin;
    const applied=card.getFlag(ID,"brutalEffectsApplied"),reopened=usage?.getFlag?.(ID,"effectApplyReopened");
    if(applied&&Number(applied)>=Number(reopened??0))return;
    if(!manual&&(game.settings.get(ID,"autoApplyHitEffects")!==true||usage?.getFlag?.(ID,"manualDamageWorkflow")||attack?.getFlag?.(ID,"manualDamageWorkflow")||card.getFlag(ID,"manualDamageWorkflow")))return;
    const targets=(attack?.system?.evaluatedTargets??[]).filter(target=>target.isMiss===false);
    if(!targets.length)return;
    const caster=await fromUuid(record.actor);if(!caster)return;
    const effects=record.values.filter(value=>effectNames[value]).map(value=>({value,effect:brutalSourceEffect(caster,value)}));
    if(!effects.length)return;
    if(effects.some(entry=>!entry.effect)){if(manual)ui.notifications.warn("A selected Brutal Strike effect is missing from its feature item.");return;}
    if(applyingEffects.has(card.id))return;
    applyingEffects.add(card.id);
    try{
        await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(card);
        for(const target of targets){
            const actor=(await fromUuid(target.token))?.actor;if(!actor)continue;
            for(const {effect}of effects){
                // Native source identity refreshes an existing application and lets Undo restore it.
                const tray=document.createElement("effect-application");tray.chatMessage=card;
                const prepare=tray._prepareEffectData;
                tray._prepareEffectData=async function(source,targetActor){
                    const operation=await prepare.call(this,source,targetActor);
                    operation.data.duration={rounds:null,turns:null,seconds:null,value:null,expired:false,expiry:"sourceStart"};
                    operation.data.start=CONFIG.ActiveEffect.documentClass.getEffectStart();
                    operation.data.system??={};operation.data.system.origin={...operation.data.system.origin,actor:caster.uuid,message:card.uuid};
                    operation.data.flags??={};operation.data.flags.dnd5e={...operation.data.flags.dnd5e,isTemporary:false};
                    if(/^staggered$/i.test(source.name??""))operation.data.flags[ID]={...operation.data.flags[ID],staggeredSaveSpent:false};
                    return operation;
                };
                const undo=globalThis.Ugmuls55eAutomationEffectUndo;
                if(!undo)throw Error("Effect undo support is unavailable.");
                await undo.apply(card,card,effect,actor,tray);
            }
        }
        await card.setFlag(ID,"brutalEffectsApplied",Date.now());
    }finally{applyingEffects.delete(card.id);}
}
export function renderBrutalApply(message,html){
    const root=html?.querySelector?html:html?.[0];if(!root||!game.user.isGM)return;
    const entries=[{card:message,root}];
    for(const node of root.querySelectorAll('.card-summary[data-message-id]'))entries.push({card:game.messages.get(node.dataset.messageId),root:node});
    for(const {card,root:node}of entries){
        const record=card?.getFlag?.(ID,"brutalEffects");if(card?.type!=="damage"||!record?.values.some(value=>effectNames[value])||card.getFlag(ID,"pendingDamage"))continue;
        const usage=typeof card.system?.origin==="string"?game.messages.get(card.system.origin):card.system?.origin;
        const applied=card.getFlag(ID,"brutalEffectsApplied"),old=node.querySelector('[data-brutal-apply]');
        if(applied&&Number(applied)>=Number(usage?.getFlag?.(ID,"effectApplyReopened")??0)){old?.remove();continue;}
        if(old)continue;
        const button=document.createElement("button");button.type="button";button.dataset.brutalApply="";button.textContent="Apply Brutal Strike Effects";
        button.addEventListener("click",async()=>{button.disabled=true;try{await applyBrutalEffects(card,{manual:true});}catch(error){console.error("Brutal Strike effects",error);ui.notifications.error(error.message);}finally{button.disabled=false;}});
        (node.querySelector(".message-content")??node).append(button);
    }
}
export function sunderingEffects(target,attacker){
    return Array.from(target?.effects??[]).filter(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&!effect.system?.expired&&
        /^sundered$/i.test(effect.name?.trim()??"")&&effect.system?.origin?.actor&&effect.system.origin.actor!==attacker?.uuid);
}
export function sunderingAttackBonus(config,dialog,message){
    if(config.subject?.type!=="attack"||game.settings.get(ID,"brutalStrikeAutomation")!==true)return;
    const attacker=config.subject.actor??config.subject.item?.actor;
    const targets=message?.data?.system?.targets??Array.from(game.user.targets??[],token=>({token:(token.document??token).uuid}));
    // One shared attack total cannot safely receive a target-specific bonus against several creatures.
    if(!attacker||targets.length!==1)return;
    const target=fromUuidSync(targets[0].token,{strict:false})?.actor;
    const effects=sunderingEffects(target,attacker);if(!effects.length)return;
    for(const roll of config.rolls??[]){
        roll.options??={};if(roll.options.rsaSundering)continue;
        roll.parts??=[];roll.parts.push("5[Sundering Blow]");
        roll.options.rsaSundering={target:targets[0].token,attacker:attacker.uuid,effects:effects.map(effect=>effect.uuid)};
    }
}
// The attack dialog rebuilds parts from native attack data on submission.
// Its options survive that rebuild, so restore the rider after the native builder.
export function completeSunderingConfiguration(process,roll,index,{app}={}){
    if(process.subject?.type!=="attack")return;
    if(!roll.options?.rsaSundering)sunderingAttackBonus({...process,rolls:[roll]}, {}, app?.message);
    if(!roll.options?.rsaSundering)return;
    roll.parts??=[];
    if(!roll.parts.some(part=>String(part).includes("[Sundering Blow]")))roll.parts.push("5[Sundering Blow]");
}
export function hasSunderingBonus(roll){
    return /(?:^|[+\s])5\[Sundering Blow\]/.test(roll.formula??"")||
        (roll.terms??[]).some(term=>term.number===5&&term.options?.flavor==="Sundering Blow");
}
const consumingSundering=new Set();
export async function consumeSundering(card){
    if(card?.type!=="attack"||!game.user.isGM||(game.users?.activeGM&&game.users.activeGM.id!==game.user.id)||consumingSundering.has(card.id))return;
    const records=(card.rolls??[]).filter(roll=>roll.evaluated!==false&&hasSunderingBonus(roll)).map(roll=>roll.options?.rsaSundering).filter(Boolean);
    if(!records.length)return;
    consumingSundering.add(card.id);
    try{
        for(const record of records){
            const attacker=card.getAssociatedActor?.();if(attacker?.uuid!==record.attacker)continue;
            for(const uuid of new Set(record.effects)){
                const effect=await fromUuid(uuid);
                if(effect&&sunderingEffects(effect.parent,attacker).some(entry=>entry.uuid===uuid))await effect.delete();
            }
        }
    }finally{consumingSundering.delete(card.id);}
}
let staggeredBridge=false;
export function staggeredEffects(actor){
    return Array.from(actor?.appliedEffects??actor?.effects??[]).filter(effect=>/^staggered$/i.test(effect.name?.trim()??"")&&
        !effect.disabled&&effect.active!==false&&!effect.duration?.expired&&!effect.system?.expired&&!effect.getFlag?.(ID,"staggeredSaveSpent"));
}
function staggeredActor(config,message){return (message?.data?.speaker?ChatMessage.getSpeakerActor(message.data.speaker):null)??config.subject?.actor??config.subject?.item?.actor??config.subject;}
export function registerStaggeredConditions(api=globalThis.ac5e?.usageRules){
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try{staggeredBridge=!!api.register({key:"rsaStaggeringBlow",scope:"universal",hook:"save",target:"subject",mode:"disadvantage",name:"Staggering Blow",persistent:false,
        evaluate:sandbox=>game.settings.get(ID,"brutalStrikeAutomation")===true&&staggeredEffects(fromUuidSync(sandbox.actorUuid,{strict:false})).length>0});}
    catch(error){staggeredBridge=false;console.warn("Staggering Blow condition integration failed",error);}return staggeredBridge;
}
export function staggeredSaveDefaults(config,dialog,message){
    if(game.settings.get(ID,"brutalStrikeAutomation")!==true)return;
    const actor=staggeredActor(config,message),effects=staggeredEffects(actor);if(!effects.length)return;
    const bridge=staggeredBridge&&game.modules?.get("automated-conditions-5e")?.active;
    for(const roll of config.rolls??[]){
        roll.options??={};roll.options.rsaStaggered={actor:actor.uuid,effects:effects.map(effect=>({uuid:effect.uuid,origin:effect.system?.origin?.message}))};
        if(bridge)continue;
        const state=roll.options["automated-conditions-5e"]??config.options?.["automated-conditions-5e"]??config["automated-conditions-5e"],counts=state?.modeCounts;
        const advantage=counts?!!counts.advantages?.present:!!(config.advantage||roll.options.advantage||roll.options.advantageMode===1);
        roll.options.advantage=advantage;roll.options.disadvantage=true;roll.options.advantageMode=advantage?0:-1;
    }
    if(!bridge){config.disadvantage=true;dialog.options??={};dialog.options.defaultButton=config.rolls?.[0]?.options.advantage?"normal":"disadvantage";}
}
const consumingStaggered=new Set();
export async function consumeStaggered(card){
    if(card?.type!=="save"||!game.user.isGM||(game.users?.activeGM&&game.users.activeGM.id!==game.user.id)||consumingStaggered.has(card.id))return;
    const records=(card.rolls??[]).filter(roll=>roll.evaluated!==false&&roll.dice?.some(die=>die.faces===20)).map(roll=>roll.options?.rsaStaggered).filter(Boolean);if(!records.length)return;
    consumingStaggered.add(card.id);
    try{for(const record of records){
        if(card.getAssociatedActor?.()?.uuid!==record.actor)continue;
        for(const snapshot of record.effects){const effect=await fromUuid(snapshot.uuid);
            if(effect&&effect.system?.origin?.message===snapshot.origin&&staggeredEffects(effect.parent).some(entry=>entry.uuid===effect.uuid))await effect.setFlag(ID,"staggeredSaveSpent",true);
        }
    }}finally{consumingStaggered.delete(card.id);}
}
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerStaggeredConditions(usageRules));
Hooks.once("init",()=>game.settings.register(ID,"brutalStrikeAutomation",{name:"Brutal Strike Assistance",hint:"Offer Brutal above Normal for Strength attacks on your combat turn. Activate Reckless on the first attack or reuse active Reckless, forgo advantage, require no disadvantage, and add scaled hit damage once per turn. Choose Brutal Strike effects in the damage configuration, including improved options and two different effects with Improved Brutal Strike (2). Apply selected native Hamstrung, Staggered, and Sundered effects to hit targets. Movement remains manual.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    registerStaggeredConditions();
    Hooks.on("dnd5e.preRollSavingThrowV2",staggeredSaveDefaults);
    Hooks.on("createChatMessage",card=>consumeStaggered(card).catch(error=>console.error("Staggering Blow",error)));
    globalThis.Ugmuls55eAutomationBrutal={addBrutalButton,finalizeBrutalAttack,finalizeBrutalDamage,addBrutalDamageChoice,commitBrutalEffects,releaseBrutal};
    Hooks.on("dnd5e.preRollAttackV2",sunderingAttackBonus);
    Hooks.on("dnd5e.postBuildAttackRollConfig",completeSunderingConfiguration);
    Hooks.on("createChatMessage",card=>consumeSundering(card).catch(error=>console.error("Sundering Blow",error)));
    Hooks.on("dnd5e.renderChatMessage",renderBrutalEffects);
    Hooks.on("dnd5e.renderChatMessage",renderBrutalApply);
    for(const event of ["createChatMessage","updateChatMessage","renderChatMessageHTML"])Hooks.on(event,card=>{if(card.type==="damage")applyBrutalEffects(card).catch(error=>console.error("Brutal Strike effects",error));});
    Hooks.on("dnd5e.postRollConfiguration",completeBrutalConfiguration);
    Hooks.on("dnd5e.rollAttackV2",(rolls,config)=>recordBrutalAttack(rolls,config).catch(console.error));
    Hooks.on("preCreateChatMessage",card=>{if(card.type!=="attack")return;const record=card.rolls?.find(roll=>roll.options?.rsaBrutalStrike)?.options.rsaBrutalStrike;if(record)card.updateSource({["flags."+ID+".brutalStrike"]:record});});
});
