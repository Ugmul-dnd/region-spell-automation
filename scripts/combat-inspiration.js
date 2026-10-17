import {createEventQueue,isRollAdjustmentLocked,isHealingCard} from "./shared-activity-card.js";
import {availableInspiration,inspiredRoll} from "./bardic-inspiration.js";
import {recordReactionUse,reactionUsed} from "./reaction-tracker.js";
import {shieldReactionAvailable} from "./shield-reaction.js";
import {seekingSnapshot} from "./seeking-spell.js";
const ID="ugmuls-5-5e-automation",enqueue=createEventQueue(),offenseChoices=new WeakMap(),offensePending=new WeakMap(),offenseReservations=new Map();
const actorFor=card=>card?.getAssociatedActor?.()??card?.getAssociatedActivity?.()?.actor;
export function valorInspiration(actor){const entries=availableInspiration(actor);return entries.length===1&&entries[0].data.combatInspiration===true?entries[0]:null;}
function originOf(card){const origin=card?.system?.origin;return typeof origin==="string"?game.messages.get(origin):origin;}
function damageAttack(card){const id=card?.getFlag?.(ID,"damageAttackId");if(id)return game.messages.get(id);const origin=originOf(card);if(origin?.type==="attack")return origin;return [...(origin?.getAssociatedRolls?.("attack")??[])].filter(attack=>attack.timestamp<=card.timestamp).sort((a,b)=>b.timestamp-a.timestamp)[0];}
const allowed=(actor,user)=>!!(actor&&(user?.isGM||actor.testUserPermission?.(user,"OWNER")));
export function canValorOffense(card,user=game.user,index=0){
    const actor=actorFor(card),attack=damageAttack(card),hits=(attack?.system?.evaluatedTargets??[]).filter(target=>target.isMiss===false);
    return game.settings.get(ID,"combatInspirationAutomation")===true&&card?.type==="damage"&&!isHealingCard(card)&&
        Number.isInteger(index)&&index>=0&&card.rolls?.[index]?._evaluated&&!card.getFlag?.(ID,"pendingDamage")&&!card.getFlag?.(ID,"valorOffense")&&
        !card.getFlag?.(ID,"masteryGraze")&&!card.getFlag?.(ID,"grappleNoDamage")&&!isRollAdjustmentLocked(card)&&
        !!attack&&hits.length===1&&actorFor(attack)?.uuid===actor?.uuid&&allowed(actor,user)&&!!valorInspiration(actor);
}
function offenseContext(app){
    const data=app.message?.data??{},origin=typeof data.system?.origin==="string"?game.messages.get(data.system.origin):data.system?.origin;
    const attackId=data.flags?.[ID]?.damageAttackId;
    const attack=attackId?game.messages.get(attackId):origin?.type==="attack"?origin:[...(origin?.getAssociatedRolls?.("attack")??[])].sort((a,b)=>b.timestamp-a.timestamp)[0];
    const actor=actorFor(attack)??app.config?.subject?.actor;
    const card=globalThis.Ugmuls55eAutomationPendingDamage?.pendingCard?.(app);
    return {actor,attack,card};
}
export function valorOffenseEligible(app){
    const {actor,attack,card}=offenseContext(app),inspiration=valorInspiration(actor);
    return game.settings.get(ID,"combatInspirationAutomation")===true&&app.config?.subject?.type==="attack"&&actor?.isOwner&&
        (attack?.system?.evaluatedTargets??[]).filter(target=>target.isMiss===false).length===1&&!isRollAdjustmentLocked(attack)&&
        !card?.getFlag?.(ID,"valorOffense")&&!app.message?.data?.flags?.[ID]?.masteryGraze&&!!inspiration&&
        (!offenseReservations.has(inspiration.effect.uuid)||offenseReservations.get(inspiration.effect.uuid)===app);
}
export function addValorOffenseChoice(app){
    if(!valorOffenseEligible(app)||app.element.querySelector('[data-rsa-choice="valor-offense"]'))return;
    globalThis.Ugmuls55eAutomationDamage?.addDamageChoice(app,{key:"valor-offense",label:"Combat Inspiration",value:offenseChoices.get(app)===true,
        change:yes=>offenseChoices.set(app,yes)});
}
export function selectValorOffense(app,yes){offenseChoices.set(app,yes===true);}
export function finalizeValorOffense(app,rolls,{preview=false}={}){
    const entry=offensePending.get(app);
    if(entry)return rolls.some(roll=>roll.options?.rsaCombatInspiration)?rolls:[...rolls,entry.roll];
    if(offenseChoices.get(app)!==true||rolls.some(roll=>roll.options?.rsaCombatInspiration))return rolls;
    if(!valorOffenseEligible(app)){if(preview)return rolls;throw Error("Combat Inspiration is no longer available. Reopen the damage prompt.");}
    const {actor,card}=offenseContext(app),{effect,data}=valorInspiration(actor),base=rolls[0]?.options??{};
    const roll=new CONFIG.Dice.DamageRoll(data.formula+"[Combat Inspiration]",actor.getRollData?.()??{},
        {type:base.type,types:base.type?[base.type]:[],flavor:"Combat Inspiration",isCritical:base.isCritical===true,critical:{...base.critical,bonusDice:0,bonusDamage:""},rsaCombatInspiration:true});
    if(!preview){offensePending.set(app,{actor,card,effect,data,roll});offenseReservations.set(effect.uuid,app);}
    return [...rolls,roll];
}
export async function commitValorOffense(app,options){
    const entry=offensePending.get(app);if(!entry)return;
    const {actor,card,effect,data}=entry;let consumed=false;
    try{
        if(!options?.dnd5e?.submitted)return;
        if(valorInspiration(actor)?.effect!==effect||offenseReservations.get(effect.uuid)!==app)throw Error("The Inspired die was already used. Reopen the damage prompt.");
        await effect.update({disabled:true,["flags."+ID+".bardicSpent"]:{message:card?.uuid??card?.id,mode:"offense"}});consumed=true;
        const record={formula:data.formula,sourceActor:data.sourceActor,configured:true};
        if(card)await card.update({["flags."+ID+".valorOffense"]:record});
        app.message.data??={};app.message.data.flags??={};app.message.data.flags[ID]={...app.message.data.flags[ID],valorOffense:record};
    }catch(error){if(consumed){await effect.update({disabled:false});await effect.unsetFlag(ID,"bardicSpent");}throw error;}
    finally{offensePending.delete(app);if(offenseReservations.get(effect.uuid)===app)offenseReservations.delete(effect.uuid);}
}
export function valorDefenders(card,user=game.user){
    if(game.settings.get(ID,"combatInspirationAutomation")!==true||card?.type!=="attack"||isRollAdjustmentLocked(card))return [];
    const entries=[];
    for(const target of card.system?.evaluatedTargets??[]){
        if(target.isMiss!==false||!Number.isFinite(target.ac)||(card.getFlag?.(ID,"valorDefense")??{})[target.token])continue;
        let token;try{token=fromUuidSync(target.token,{strict:false});}catch{continue;}
        const actor=token?.actor;
        if(allowed(actor,user)&&shieldReactionAvailable(actor)&&valorInspiration(actor))entries.push({actor,target,token});
    }
    return entries;
}
const signature=card=>seekingSnapshot(card)+JSON.stringify((card.system?.targets??[]).map(target=>[target.token,target.ac]));
export async function applyCombatInspiration(card,{mode,index=0,targetUuid=null},user=game.user){
    if(mode!=="defense")throw Error("Choose Combat Inspiration in the damage roll configuration before rolling damage.");
    let actor,target;
    if(mode==="offense"){
        if(!canValorOffense(card,user,index))throw Error("Combat Inspiration Offense needs an unapplied single-target attack-hit damage roll and a die granted by a Valor Bard.");
        actor=actorFor(card);
    }else if(mode==="defense"){
        const entry=valorDefenders(card,user).find(entry=>entry.target.token===targetUuid);
        if(!entry)throw Error("Combat Inspiration Defense needs a hit, an available reaction and a die granted by a Valor Bard. Undo applied damage first.");
        ({actor,target}=entry);
    }else throw Error("Invalid Combat Inspiration option.");
    const {effect,data}=valorInspiration(actor),before=signature(card),original=card.rolls?.[index];
    const bonus=mode==="offense"?await new CONFIG.Dice.DamageRoll(data.formula+"[Combat Inspiration]",actor.getRollData?.()??{},
        {type:original.options?.type,types:original.options?.types,isCritical:original.options?.isCritical===true,critical:{...original.options?.critical,bonusDice:0,bonusDamage:""}}).evaluate():
        await new CONFIG.Dice.BasicRoll(data.formula,actor.getRollData?.()??{}).evaluate();
    if(signature(card)!==before||valorInspiration(actor)?.effect!==effect||
        !(mode==="offense"?canValorOffense(card,user,index):valorDefenders(card,user).some(entry=>entry.actor===actor&&entry.target.token===targetUuid)))throw Error("The roll or Inspired effect changed. Try again.");
    const adjusted=mode==="offense"?await inspiredRoll(original,bonus):null;
    if(adjusted)delete adjusted.options.rsaDamageModes;
    let consumed=false,committed=false,marker;const oldSpent=effect.getFlag?.(ID,"bardicSpent");
    try{
        await effect.update({disabled:true,["flags."+ID+".bardicSpent"]:{message:card.uuid??card.id,mode}});consumed=true;
        if(mode==="defense"){
            if(!shieldReactionAvailable(actor))throw Error("The recipient's reaction was just used.");
            const activity={actor,item:{type:"feat"},activation:{type:"reaction"}};
            await recordReactionUse(activity,{}, {message:card});marker=reactionUsed(actor);
            const tracked=game.settings.get(ID,"reactionTracker")===true&&game.combat?.started&&Array.from(game.combat.combatants??[]).some(combatant=>combatant.actor?.uuid===actor.uuid);
            if(tracked&&marker?.getFlag?.(ID,"reactionUsage")!==card.id)throw Error("Could not reserve the recipient's reaction.");
        }
        if(game.dice3d?.showForRoll){try{const animation=Promise.resolve(game.dice3d.showForRoll(bonus,user,true,card.whisper?.length?card.whisper:null,card.blind??false,card.id,card.speaker));if(globalThis.Ugmuls55eAutomationWaitForAnimation)await globalThis.Ugmuls55eAutomationWaitForAnimation(animation);else if(globalThis.document?.hidden)animation.catch(console.warn);else await animation;}catch(error){console.warn("Combat Inspiration animation failed",error);}}
        if(signature(card)!==before||isRollAdjustmentLocked(card)||!effect.disabled)throw Error("The roll changed during Combat Inspiration. Resources were restored.");
        let update;
        if(mode==="offense"){
            const rolls=[...card.rolls];rolls[index]=adjusted;
            update={rolls,["flags."+ID+".valorOffense"]:{index,formula:data.formula,total:bonus.total,sourceActor:data.sourceActor}};
        }else{
            const targets=Array.from(card.system.targets??[],entry=>({...entry,ac:entry.token===targetUuid?Number(entry.ac)+bonus.total:entry.ac}));
            const defense={...(card.getFlag(ID,"valorDefense")??{}),[targetUuid]:{bonus:bonus.total,formula:data.formula,name:actor.name}};
            update={"system.targets":targets,["flags."+ID+".valorDefense"]:defense};
        }
        const skip=card.getFlag("dice-so-nice","skip");update["flags.dice-so-nice.skip"]=true;
        try{await card.update(update,{rsaRetarget:mode==="defense"});committed=true;}
        finally{if(skip===undefined)await card.unsetFlag("dice-so-nice","skip");else await card.setFlag("dice-so-nice","skip",skip);}
    }catch(error){if(consumed&&!committed){await effect.update({disabled:false});if(oldSpent===undefined)await effect.unsetFlag(ID,"bardicSpent");else await effect.setFlag(ID,"bardicSpent",oldSpent);if(marker?.getFlag?.(ID,"reactionUsage")===card.id)await marker.update({disabled:true});}throw error;}
}
function report(error){console.error("Ugmuls 5.5e Automation | Combat Inspiration",error);ui.notifications.error(error.message);}
export function renderCombatInspiration(message,html){
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=[{card:message,root}];for(const summary of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(summary.dataset.messageId);if(card&&!summary.hidden)entries.push({card,root:summary});}
    for(const entry of entries){
        entry.root.querySelectorAll(':scope > .rsa-valor-actions').forEach(node=>node.remove());if(entry.card.isContentVisible===false)continue;
        const controls=document.createElement("div");controls.className="rsa-attack-actions rsa-valor-actions";
        const add=(actor,selection,label)=>{
            const data=valorInspiration(actor).data,button=document.createElement("button");button.type="button";
            const img=document.createElement("img");img.src=data.img??"icons/svg/d20.svg";img.alt="";
            button.append(img,document.createTextNode(label+" ("+data.formula.replace(/^1/,"")+")"));
            button.dataset.tooltip=selection.mode==="defense"?"Spend your Inspired die and reaction for AC against this attack only.":"Spend your Inspired die to add damage to this attack. No reaction required.";
            button.addEventListener("click",async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{
                const gm=game.users.activeGM;if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"combatInspiration",messageId:entry.card.id,selection,userId:game.user.id,gmId:gm.id});
                else await enqueue(()=>applyCombatInspiration(entry.card,selection));
            }catch(error){report(error);}finally{refresh();}});controls.append(button);
        };
        for(const defender of valorDefenders(entry.card))add(defender.actor,{mode:"defense",targetUuid:defender.target.token},"Combat Inspiration — Defense · "+defender.actor.name);
        const offense=entry.card.getFlag?.(ID,"valorOffense");if(offense){const label=document.createElement("span");const total=offense.total??entry.card.rolls?.find(roll=>roll.options?.rsaCombatInspiration)?.total;label.textContent=total==null?"Combat Inspiration":"Combat Inspiration: +"+total+" damage";controls.append(label);}
        for(const defense of Object.values(entry.card.getFlag?.(ID,"valorDefense")??{})){const label=document.createElement("span");label.textContent=defense.name+": +"+defense.bonus+" AC against this attack";controls.append(label);}
        if(controls.childNodes.length)entry.root.append(controls);
    }
}
function refresh(document){globalThis.Ugmuls55eAutomationChatRefresh?.request("valor",document);}
Hooks.once("init",()=>game.settings.register(ID,"combatInspirationAutomation",{name:"Combat Inspiration Assistance",hint:"Valor-granted Inspired dice can add to initial single-target attack damage configuration or use the recipient's reaction to raise AC against one incoming hit. Original rolls are preserved.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationValor={addValorOffenseChoice,finalizeValorOffense,commitValorOffense};
    Hooks.on("dnd5e.renderChatMessage",renderCombatInspiration);
    for(const event of ["createActiveEffect","updateActiveEffect","deleteActiveEffect","updateCombat"])Hooks.on(event,refresh);
    game.socket.on("module."+ID,packet=>{
        if(packet?.action==="combatInspirationError"&&packet.userId===game.user.id){ui.notifications.error(packet.error);refresh();return;}
        if(packet?.action!=="combatInspiration"||!game.user.isGM||game.users.activeGM?.id!==game.user.id||packet.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId),card=game.messages.get(packet.messageId);if(!user?.active||!card)return;
        const selection=packet.selection;if(!selection||!["offense","defense"].includes(selection.mode))return;
        enqueue(()=>applyCombatInspiration(card,selection,user)).catch(error=>{report(error);game.socket.emit("module."+ID,{action:"combatInspirationError",userId:user.id,error:error.message});});
    });
});
