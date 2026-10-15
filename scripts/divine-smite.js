const ID="ugmuls-5-5e-automation";
const selections=new WeakMap(),pending=new WeakMap(),reserved=new Map();
const turn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
const items=actor=>Array.from(actor?.items??[]);
const identifier=item=>item?.identifier??item?.system?.identifier;
const actorFor=app=>(app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;
export const smiteSpell=actor=>items(actor).find(item=>item.type==="spell"&&(identifier(item)==="divine-smite"||/^divine smite$/i.test(item.name?.trim()??"")));
export function smiteUsed(actor) {
    if(reserved.has(actor?.uuid))return true;
    return globalThis.Ugmuls55eAutomationResources?.bonusActionUsed(actor)===true;
}
function attackContext(app) {
    const data=app.message?.data?.system;
    const usage=typeof data?.origin==="string"?game.messages.get(data.origin):data?.origin;
    const targets=data?.targets?.length?data.targets:usage?.system?.targets??[];

    const explicit=app.message?.data?.flags?.[ID]?.damageAttackId;
    const attack=explicit?game.messages.get(explicit):Array.from(usage?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    return {targets,attack};
}
export function smiteTarget(app) {
    const {targets,attack}=attackContext(app);
    if(targets.length!==1)return null;
    if(attack?.system?.evaluatedTargets?.some(target=>target.token===targets[0].token&&target.isMiss===true))return null;
    return fromUuidSync(targets[0].token,{strict:false})?.actor??null;
}
function bonusTurn(actor) {
    const combat=game.combat;
    return !combat?.started||!Array.from(combat.combatants??[]).some(entry=>entry.actor?.uuid===actor?.uuid)||combat.combatant?.actor?.uuid===actor?.uuid;
}
export function smiteEligible(app) {
    const activity=app.config?.subject;
    const mode=app.config?.attackMode??attackContext(app).attack?.system?.mode;
    return game.settings.get(ID,"divineSmiteAutomation")===true&&activity?.type==="attack"&&activity.item?.type==="weapon"&&
        activity.attack?.type?.value==="melee"&&activity.attack?.type?.classification!=="spell"&&
        mode!=="ranged"&&!String(mode??"").includes("thrown")&&
        !app.message?.data?.flags?.[ID]?.masteryGraze&&bonusTurn(actorFor(app))&&actorFor(app)?.isOwner&&!!smiteSpell(actorFor(app))&&!!smiteTarget(app);
}
export function smiteBonus(target) {
    const type=target?.system?.details?.type;
    return ["fiend","undead"].includes(String(typeof type==="string"?type:type?.value??"").toLowerCase());
}
function remaining(uses) {return Number(uses?.value??(Number(uses?.max)-Number(uses?.spent??0)))||0;}
export function smiteFreeResource(actor,spell=smiteSpell(actor)) {
    const related=items(actor).filter(item=>item===spell||["paladins-smite","divine-smite"].includes(identifier(item))||/^(paladin[’']s smite|divine smite)$/i.test(item.name??""));
    // A free cast can consume a different feature's tracked item uses.
    for(const item of related)for(const activity of item.system?.activities??[])for(const target of activity.consumption?.targets??[]) {
        if(target.type!=="itemUses")continue;
        const resource=!target.target?item:actor.items?.get?.(target.target)??items(actor).find(entry=>identifier(entry)===target.target||entry.uuid===target.target);
        if(resource&&remaining(resource.system?.uses)>0)return {item:resource,path:"system.uses.spent",spent:Number(resource.system.uses.spent??0)};
    }
    for(const item of related) {
        if(remaining(item.system?.uses)>0)return {item,path:"system.uses.spent",spent:Number(item.system.uses.spent??0)};
        for(const activity of item.system?.activities??[])if(remaining(activity.uses)>0)return {
            item,path:`system.activities.${activity.id}.uses.spent`,spent:Number(activity.uses.spent??0)};
    }
    return null;
}
export function smiteResources(actor) {
    const options=[];
    const free=smiteFreeResource(actor);if(free)options.push({value:"free",label:"Free use (1 available)",level:1,free});
    for(const [key,slot] of Object.entries(actor.system?.spells??{})) {
        if(!/^spell[1-9]$/.test(key)&&key!=="pact")continue;
        const level=key==="pact"?Number(slot.level):Number(key.slice(5));
        if(slot.value>0&&level>=1&&!globalThis.Ugmuls55eAutomationResources?.hasCastWithSlot(actor))options.push({value:key,label:`${key==="pact"?"Pact slot":"Level"} ${level} (${slot.value} available)`,level});
    }
    return options;
}
export function addSmiteChoice(app) {
    if(!smiteEligible(app)||app.element.querySelector('[data-rsa-smite]'))return;
    const actor=actorFor(app),used=smiteUsed(actor),resources=smiteResources(actor);
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{
        key:"smite",label:"Divine Smite",used,value:false,disabled:used||!resources.length,change(){}
    });
    if(!group)return;group.dataset.rsaSmite="";
    // Replace the shared Yes/No select with explicit resource choices.
    const old=group.querySelector('select'),select=document.createElement("select");
    select.setAttribute("aria-label","Divine Smite resource");select.disabled=used||!resources.length;
    for(const choice of [{value:"no",label:used?"No - Already Used":"No"},...resources]) {
        const option=document.createElement("option");option.value=choice.value;option.textContent=choice.label;select.append(option);
    }
    select.value=!used&&resources.some(resource=>resource.value===selections.get(app))?selections.get(app):"no";
    select.addEventListener("change",event=>{event.stopPropagation();selections.set(app,select.value);app.rebuild();});old.replaceWith(select);
    const caption=group.querySelector("label");
    const name=document.createElement("span");name.textContent="Divine Smite";
    name.className=smiteBonus(smiteTarget(app))?"rsa-smite-holy":"";
    const explanation="Divine Smite adds an extra 1d8 against Fiends and Undead. A golden glow and underline indicate this bonus applies.";
    const info=document.createElement("i");info.className="fa-solid fa-circle-info rsa-rider-info";
    info.tabIndex=0;info.setAttribute("role","img");info.setAttribute("aria-label",explanation);
    info.setAttribute("data-tooltip",explanation);
    caption.replaceChildren(name,info);
}
export function finalizeSmite(app,rolls,{preview=false}={}) {
    if(!smiteEligible(app)||smiteUsed(actorFor(app))||rolls.some(roll=>roll.options?.rsaDivineSmite))return rolls;
    const actor=actorFor(app),choice=smiteResources(actor).find(resource=>resource.value===selections.get(app));
    if(!choice)return rolls;
    const spell=smiteSpell(actor),base=rolls[0]?.options??{},critical={...base.critical,bonusDice:0,bonusDamage:""};
    const activity=Array.from(spell.system?.activities??[]).find(activity=>activity.damage?.parts?.length);
    const source=activity?.getDamageConfig?.({scaling:Math.max(0,choice.level-Number(spell.system.level??1)),isCritical:base.isCritical===true})?.rolls?.[0];
    const config=source?{...source,parts:[...source.parts]}:{parts:[`${choice.level+1}d8`],data:{}};
    if(smiteBonus(smiteTarget(app)))config.parts.push("1d8");
    config.options={...config.options,type:"radiant",types:["radiant"],flavor:"Divine Smite",isCritical:base.isCritical===true,critical,rsaDivineSmite:true};
    const extra=CONFIG.Dice.DamageRoll.fromConfig(config,{critical});
    if(!preview){reserved.set(actor.uuid,app);pending.set(app,{actor,choice,stamp:turn()});}
    return [...rolls,extra];
}
export async function commitSmite(app,options) {
    const entry=pending.get(app);if(!entry)return;
    const {actor,choice}=entry;let rollback;const markers=[];
    try {
        if(!options?.dnd5e?.submitted)return;
        if(globalThis.Ugmuls55eAutomationResources?.bonusActionUsed(actor))throw Error("Bonus action already used. Undo or disable that marker before using Divine Smite.");
        const combat=game.combat;
        if(combat?.started&&Array.from(combat.combatants??[]).some(entry=>entry.actor?.uuid===actor.uuid)&&combat.combatant?.actor?.uuid!==actor.uuid)throw Error("Divine Smite requires a bonus action on your turn.");
        const current=smiteResources(actor).find(resource=>resource.value===choice.value);
        if(!current)throw Error("The selected Divine Smite resource is no longer available. Choose another resource.");
        if(choice.value==="free") {
            const {item,path,spent}=current.free;
            await item.update({[path]:spent+1});rollback=()=>item.update({[path]:spent});
        } else {
            const path=`system.spells.${choice.value}.value`,value=Number(actor.system.spells[choice.value].value);
            await actor.update({[path]:value-1});rollback=()=>actor.update({[path]:value});
        }
        const bonus=await globalThis.Ugmuls55eAutomationResources?.markBonusAction(actor);
        if(bonus)markers.push(bonus);
        if(choice.value!=="free") {
            const spell=await globalThis.Ugmuls55eAutomationResources?.markSpellCast(actor);
            if(spell)markers.push(spell);
        }
    } catch(error) {
        if(rollback)await rollback();
        for(const marker of markers)await marker.update({disabled:true});
        const rolls=app.rolls;for(let i=rolls.length-1;i>=0;i--)if(rolls[i].options?.rsaDivineSmite)rolls.splice(i,1);
        ui.notifications.error(error.message);throw error;
    } finally {pending.delete(app);if(reserved.get(actor.uuid)===app)reserved.delete(actor.uuid);}
}
export async function resetSmiteTurn(combat,changes) {
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||!("turn" in changes||"round" in changes||changes.started===false))return;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()) {
        const ids=Array.from(actor.effects??[]).filter(effect=>!effect.disabled&&(effect.getFlag?.(ID,"smiteTurn")||effect.name==="Divine Smite - used")).map(effect=>effect.id);
        if(ids.length)await actor.updateEmbeddedDocuments("ActiveEffect",ids.map(_id=>({_id,disabled:true})));
    }
}
Hooks.once("init",()=>game.settings.register(ID,"divineSmiteAutomation",{name:"Divine Smite Assistance",hint:"Offer Divine Smite on single-target melee weapon hit damage. Choose a tracked free use or available spell slot, add Fiend/Undead damage, spend a bonus action and respect the spell-slot casting limit.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationSmite={addSmiteChoice,finalizeSmite,commitSmite,pendingPactCost:app=>pending.get(app)?.choice.value==="pact"?1:0};
    // Retire legacy per-Smite markers; bonus-action tracking now owns this limit.
    if(game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id)) {
        const actors=new Map([...Array.from(game.actors??[]),...Array.from(globalThis.canvas?.tokens?.placeables??[],token=>token.actor)].filter(Boolean).map(actor=>[actor.uuid,actor]));
        for(const actor of actors.values()) {
            const ids=Array.from(actor.effects??[]).filter(effect=>!effect.disabled&&(effect.getFlag?.(ID,"smiteTurn")||effect.name==="Divine Smite - used")).map(effect=>({_id:effect.id,disabled:true}));
            if(ids.length)actor.updateEmbeddedDocuments("ActiveEffect",ids).catch(error=>console.error("Ugmuls 5.5e Automation | Legacy Smite cleanup failed:",error));
        }
    }
    Hooks.on("updateCombat",(combat,changes)=>resetSmiteTurn(combat,changes).catch(error=>console.error("Ugmuls 5.5e Automation | Divine Smite reset failed:",error)));
    Hooks.on("dnd5e.preRollDamageV2",(config,dialog)=>{
        if(config.subject?.type!=="attack")return;
        const configure=dialog.configure;
        Object.assign(dialog,globalThis.Ugmuls55eAutomationDamage.configurePromptDialog("damage",dialog));
        if(configure===false)dialog.configure=false;
    });
});
