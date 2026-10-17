const ID="ugmuls-5-5e-automation";
const selections=new WeakMap(),pending=new WeakMap(),reserved=new Map(),queuedFollowups=new WeakMap(),queuedActors=new Map();
const turn=()=>game.combat?.started?`${game.combat.id}:${game.combat.round}:${game.combat.turn}`:null;
const items=actor=>Array.from(actor?.items??[]);
const identifier=item=>item?.identifier??item?.system?.identifier;
const actorFor=app=>(app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;
export const smiteSpell=actor=>items(actor).find(item=>item.type==="spell"&&(identifier(item)==="divine-smite"||/^divine smite$/i.test(item.name?.trim()??"")));
export function preparedSmiteSpells(actor){
    return items(actor).filter(item=>{
        if(item.type!=="spell"||item.system?.source?.rules==="2014")return false;
        if(!/(?:^|-)smite$/.test(identifier(item)??"")&&!/\bsmite$/i.test(item.name?.trim()??""))return false;
        return item.system?.prepared===undefined?item===smiteSpell(actor):Boolean(item.system.prepared);
    });
}
function smiteChoices(actor){
    return preparedSmiteSpells(actor).flatMap(spell=>smiteResources(actor,spell).map(resource=>({...resource,spell,
        selection:spell===smiteSpell(actor)?resource.value:spell.id+"|"+resource.value,
        label:(spell.name??(spell===smiteSpell(actor)?"Divine Smite":"Smite"))+" — "+resource.label})));
}
function selectedSmite(app){return smiteChoices(actorFor(app)).find(choice=>choice.selection===selections.get(app));}
export function smiteUsed(actor) {
    if(reserved.has(actor?.uuid)||queuedActors.get(actor?.uuid)?.expires>Date.now())return true;
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
        !app.message?.data?.flags?.[ID]?.masteryGraze&&bonusTurn(actorFor(app))&&actorFor(app)?.isOwner&&preparedSmiteSpells(actorFor(app)).length>0&&!!smiteTarget(app);
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
export function smiteResources(actor,spell=smiteSpell(actor)) {
    const options=[];
    const minimum=Math.max(1,Number(spell?.system?.level??1));
    const free=spell===smiteSpell(actor)?smiteFreeResource(actor,spell):null;if(free)options.push({value:"free",label:"Free use (1 available)",level:1,free});
    for(const [key,slot] of Object.entries(actor.system?.spells??{})) {
        if(!/^spell[1-9]$/.test(key)&&key!=="pact")continue;
        const level=key==="pact"?Number(slot.level):Number(key.slice(5));
        if(slot.value>0&&level>=minimum&&!globalThis.Ugmuls55eAutomationResources?.hasCastWithSlot(actor))options.push({value:key,label:`${key==="pact"?"Pact slot":"Level"} ${level} (${slot.value} available)`,level});
    }
    return options;
}
export function addSmiteChoice(app) {
    if(!smiteEligible(app)||app.element.querySelector('[data-rsa-smite]'))return;
    const actor=actorFor(app),used=smiteUsed(actor),resources=smiteChoices(actor);
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{
        key:"smite",label:"Smite",used,value:false,disabled:used||!resources.length,change(){}
    });
    if(!group)return;group.dataset.rsaSmite="";
    // Replace the shared Yes/No select with explicit resource choices.
    const old=group.querySelector('select'),select=document.createElement("select");
    select.setAttribute("aria-label","Smite spell and resource");select.disabled=used||!resources.length;
    for(const choice of [{value:"no",label:used?"No - Already Used":"No"},...resources]) {
        const option=document.createElement("option");option.value=choice.selection??choice.value;option.textContent=choice.label;select.append(option);
    }
    select.value=!used&&resources.some(resource=>resource.selection===selections.get(app))?selections.get(app):"no";
    select.addEventListener("change",event=>{event.stopPropagation();selections.set(app,select.value);app.rebuild();});old.replaceWith(select);
    const caption=group.querySelector("label");
    const name=document.createElement("span");name.textContent="Smite";
    name.className=smiteBonus(smiteTarget(app))?"rsa-smite-holy":"";
    const explanation="Choose one prepared Smite spell and its resource. Divine Smite adds an extra 1d8 against Fiends and Undead. Smite damage joins the weapon roll. Saves use a separate card; effects apply after a failed save, or directly when no save is required.";
    const info=document.createElement("i");info.className="fa-solid fa-circle-info rsa-rider-info";
    info.tabIndex=0;info.setAttribute("role","img");info.setAttribute("aria-label",explanation);
    info.setAttribute("data-tooltip",explanation);
    caption.replaceChildren(name,info);
}
export function initialSmiteActivity(spell){
    const activities=Array.from(spell.system?.activities??[]);
    // Official Smite spells keep initial damage separate from their saving throws.
    const damage=activities.filter(activity=>activity.type==="damage"&&activity.damage?.parts?.length);
    if(identifier(spell)==="divine-smite")return damage.find(activity=>/^cast$/i.test(activity.name??""))??damage[0]??activities.find(activity=>activity.damage?.parts?.length);
    return damage[0]??activities.find(activity=>activity.damage?.parts?.length)??activities[0];
}
export function initialSmiteSave(spell){
    // These saves end an existing effect on later turns, rather than preventing the initial effect.
    if(["searing-smite","blinding-smite"].includes(identifier(spell)))return null;
    return Array.from(spell.system?.activities??[]).find(activity=>activity.type==="save"&&
        !/\b(start|end) of (?:each |its |the )?turn\b|repeat/i.test(activity.name??""))??null;
}
export function finalizeSmite(app,rolls,{preview=false}={}) {
    if(!smiteEligible(app)||smiteUsed(actorFor(app))||rolls.some(roll=>roll.options?.rsaDivineSmite))return rolls;
    const actor=actorFor(app),choice=selectedSmite(app);
    if(!choice)return rolls;
    const spell=choice.spell;
    const base=rolls[0]?.options??{},critical={...base.critical,bonusDice:0,bonusDamage:""};
    const activity=initialSmiteActivity(spell);
    const source=activity?.getDamageConfig?.({scaling:Math.max(0,choice.level-Number(spell.system.level??1)),isCritical:base.isCritical===true})?.rolls?.[0];
    if(!source&&spell!==smiteSpell(actor))return rolls;
    const config=source?{...source,parts:[...source.parts]}:{parts:[`${choice.level+1}d8`],data:{}};
    if(spell===smiteSpell(actor)&&smiteBonus(smiteTarget(app)))config.parts.push("1d8");
    config.options={...config.options,...(spell===smiteSpell(actor)?{type:"radiant",types:["radiant"]}:{}),flavor:spell.name??"Divine Smite",isCritical:base.isCritical===true,critical,rsaDivineSmite:true};
    const extra=CONFIG.Dice.DamageRoll.fromConfig(config,{critical});
    if(!preview){reserved.set(actor.uuid,app);pending.set(app,{actor,choice,spell,stamp:turn()});}
    return [...rolls,extra];
}
export async function commitSmite(app,options) {
    const entry=pending.get(app);
    if(!options?.dnd5e?.submitted){const queued=queuedFollowups.get(app);if(queued){delete app.message.data.flags[ID].selectedSmiteRequest;delete app.message.data.flags[ID].selectedSmite;if(queuedActors.get(queued.actor)?.id===queued.id)queuedActors.delete(queued.actor);queuedFollowups.delete(app);}}
    if(!entry)return;
    const {actor,choice}=entry;let rollback;const markers=[];
    try {
        if(!options?.dnd5e?.submitted)return;
        if(globalThis.Ugmuls55eAutomationResources?.bonusActionUsed(actor))throw Error("Bonus action already used. Undo or disable that marker before using a Smite.");
        const combat=game.combat;
        if(combat?.started&&Array.from(combat.combatants??[]).some(entry=>entry.actor?.uuid===actor.uuid)&&combat.combatant?.actor?.uuid!==actor.uuid)throw Error("Smite requires a bonus action on your turn.");
        if(!preparedSmiteSpells(actor).some(spell=>spell.uuid===entry.spell.uuid))throw Error("The selected Smite is no longer prepared.");
        const current=smiteResources(actor,entry.spell).find(resource=>resource.value===choice.value);
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
        app.message.data.flags??={};app.message.data.flags[ID]??={};
        app.message.data.flags[ID].selectedSmite={name:entry.spell.name??"Divine Smite",spell:entry.spell.uuid,level:choice.level};
        if(entry.spell!==smiteSpell(actor)){
            const context=attackContext(app),id=foundry.utils.randomID();
            const request={id,userId:game.user.id,actor:actor.uuid,spell:entry.spell.uuid,level:choice.level,targets:foundry.utils.deepClone(context.targets)};
            app.message.data.flags??={};app.message.data.flags[ID]??={};app.message.data.flags[ID].selectedSmiteRequest=request;
            queuedActors.set(actor.uuid,{id,expires:Date.now()+120000});queuedFollowups.set(app,{actor:actor.uuid,id});
        }
    } catch(error) {
        if(rollback)await rollback();
        for(const marker of markers)await marker.update({disabled:true});
        const rolls=app.rolls;for(let i=rolls.length-1;i>=0;i--)if(rolls[i].options?.rsaDivineSmite)rolls.splice(i,1);
        ui.notifications.error(error.message);throw error;
    } finally {pending.delete(app);if(reserved.get(actor.uuid)===app)reserved.delete(actor.uuid);}
}
const processing=new Set();
const authority=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
export async function castSelectedSmite(rolls){
    const card=rolls?.find(roll=>roll.parent?.getFlag?.(ID,"selectedSmiteRequest"))?.parent;
    if(card)await resolveSelectedSmite(card);
}
export async function resolveSelectedSmite(card){
    const job=card?.getFlag?.(ID,"selectedSmiteRequest");
    if(job&&card.getFlag(ID,"selectedSmiteResolved")&&queuedActors.get(job.actor)?.id===job.id)queuedActors.delete(job.actor);
    if(!authority()||!job||card.getFlag(ID,"pendingDamage")||card.getFlag(ID,"selectedSmiteResolved")||processing.has(card.id))return;
    processing.add(card.id);
    try{
        await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(card);
        const actor=await fromUuid(job.actor),spell=await fromUuid(job.spell);
        if(!actor||!spell)throw Error("The selected Smite spell is unavailable.");
        const primary=initialSmiteActivity(spell);if(!primary)return;
        const targets=job.targets;
        if(targets?.length!==1)throw Error("Smite requires the weapon hit’s recorded target.");
        const scaling=Math.max(0,job.level-Number(spell.system.level??1));
        const save=initialSmiteSave(spell);
        if(save){
            // Keep native save DC, effect profiles and scaling, but never roll the initial damage twice.
            const data=spell.toObject();data._id=foundry.utils.randomID();data.system.activities[save.id].damage.parts=[];
            const item=new CONFIG.Item.documentClass(data,{parent:actor});
            const activity=item.system.activities.get(save.id);
            const result=await activity.use({consume:false,scaling},{configure:false},{data:{system:{targets},flags:{dnd5e:{item:{data}},[ID]:{riderTriggered:true,smiteSave:{damageId:card.id}}}}});
            if(!result?.message)throw Error("The Smite save card could not be created.");
        }else{
            const item=spell.scaledClone?.(scaling)??spell.clone({}, {keepId:true});
            if(!spell.scaledClone){item.updateSource({"flags.dnd5e.scaling":scaling});item.prepareFinalAttributes?.();}
            const activity=item.system.activities.get(primary.id);
            let concentration;
            if(activity.duration?.concentration){
                const effect=await actor.beginConcentrating(activity,{"flags.dnd5e.scaling":scaling});concentration=effect?.id;
            }
            // A native spell context on the existing damage card preserves effect origin and Undo.
            const context={uuid:card.uuid,system:{...card.system,concentration,scaling,level:job.level},getAssociatedActor:()=>actor,
                getAssociatedItem:()=>item,getAssociatedActivity:()=>activity};
            await applySmiteEffects(card,context,activity,targets);
        }
        await card.setFlag(ID,"selectedSmiteResolved",true);
    }finally{processing.delete(card.id);if(queuedActors.get(job.actor)?.id===job.id)queuedActors.delete(job.actor);}
}
async function applySmiteEffects(card,context,activity,targets){
    const tray=document.createElement("effect-application");tray.chatMessage=context;
    const effects=await activity.getApplicableEffects?.()??[];
    const ledger=new Set(card.getFlag(ID,"smiteAppliedEffects")??[]);
    for(const target of targets){
        const actor=(await fromUuid(target.token))?.actor;if(!actor)continue;
        for(const effect of effects){
            const key=target.token+"|"+effect.uuid;if(ledger.has(key))continue;
            await globalThis.Ugmuls55eAutomationEffectUndo.apply(card,context,effect,actor,tray);
            ledger.add(key);await card.setFlag(ID,"smiteAppliedEffects",[...ledger]);
        }
    }
}
export async function resolveSmiteSave(card){
    if(!authority()||!card?.getFlag?.(ID,"smiteSave")||card.getFlag(ID,"outcomeEffectsApplied")||processing.has(card.id))return;
    const targets=card.system.targets??[];
    if(!targets.length||targets.some(target=>!["success","failure"].includes(card.system.outcomes?.get(target.token))))return;
    processing.add(card.id);
    try{
        await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(card);
        const activity=card.getAssociatedActivity({scaled:true});
        await applySmiteEffects(card,card,activity,targets.filter(target=>card.system.outcomes.get(target.token)==="failure"));
        await card.setFlag(ID,"outcomeEffectsApplied",true);
    }finally{processing.delete(card.id);}
}
export async function resetSmiteTurn(combat,changes) {
    if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id)||!("turn" in changes||"round" in changes||changes.started===false))return;
    const actors=new Map(Array.from(combat.combatants??[]).filter(entry=>entry.actor).map(entry=>[entry.actor.uuid,entry.actor]));
    for(const actor of actors.values()) {
        const ids=Array.from(actor.effects??[]).filter(effect=>!effect.disabled&&(effect.getFlag?.(ID,"smiteTurn")||effect.name==="Divine Smite - used")).map(effect=>effect.id);
        if(ids.length)await actor.updateEmbeddedDocuments("ActiveEffect",ids.map(_id=>({_id,disabled:true})));
    }
}
Hooks.once("init",()=>game.settings.register(ID,"divineSmiteAutomation",{name:"Smite Spell Assistance",hint:"Choose one prepared Smite spell on single-target melee hit damage. Smite damage joins the weapon roll; only saving throws create a separate card. Uses available slots, bonus actions, and normal saves/effects.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    const resolve=card=>Promise.resolve().then(()=>resolveSelectedSmite(card)).then(()=>{const origin=card.system?.origin;return resolveSmiteSave(card.getFlag?.(ID,"smiteSave")?card:typeof origin==="string"?game.messages.get(origin):origin);}).catch(error=>{console.error("Selected Smite",error);ui.notifications.error(error.message);});
    Hooks.on("createChatMessage",resolve);
    Hooks.on("updateChatMessage",resolve);
    Hooks.on("dnd5e.rollDamage",rolls=>castSelectedSmite(rolls).catch(error=>{console.error("Selected Smite",error);ui.notifications.error(error.message);}));
    globalThis.Ugmuls55eAutomationSmite={resolveSmiteSave,addSmiteChoice,finalizeSmite,commitSmite,pendingPactCost:app=>pending.get(app)?.choice.value==="pact"?1:0};
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
