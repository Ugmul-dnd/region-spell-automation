import {createEventQueue,isRollAdjustmentLocked} from "./shared-activity-card.js";
import {failureState,inspiredRoll} from "./bardic-inspiration.js";
import {animateNewSaveDice} from "./save-roll-controls.js";
import {seekingSnapshot} from "./seeking-spell.js";
const ID="ugmuls-5-5e-automation",enqueue=createEventQueue();
const actorFor=card=>card?.getAssociatedActor?.()??(card?.speaker?ChatMessage.getSpeakerActor(card.speaker):null);
export const focusFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&item.system?.source?.rules!=="2014"&&((item.identifier??item.system?.identifier)==="fanatical-focus"||/^fanatical focus$/i.test(item.name??"")));
export function focusRage(actor){
    const item=Array.from(actor?.items??[]).find(item=>(item.identifier??item.system?.identifier)==="rage"||/^rage$/i.test(item.name??""));
    const sources=new Set(Array.from(item?.effects??[]).map(effect=>effect.uuid));
    return Array.from(actor?.effects??[]).find(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&!effect.system?.expired&&
        (/^(rage|raging)$/i.test(effect.name?.trim()??"")||sources.has(effect._stats?.duplicateSource)||sources.has(effect._stats?.compendiumSource)||!!item?.uuid&&effect.system?.origin?.item===item.uuid));
}
export const focusSession=rage=>rage?(rage.getFlag?.(ID,"focusRageSession")??rage.uuid):null;
export function rageSaveBonus(actor){
    const scale=actor?.getRollData?.()?.scale?.barbarian?.["rage-damage"],bonus=Number(scale?.value??scale);
    if(Number.isFinite(bonus)&&bonus>0)return bonus;
    const level=Number(Array.from(actor?.items??[]).find(item=>item.type==="class"&&(item.identifier??item.system?.identifier)==="barbarian")?.system?.levels??0);
    return level>=16?4:level>=9?3:level>0?2:null;
}
export function canFocus(card,user=game.user,index=0){
    const actor=actorFor(card),rage=focusRage(actor),session=focusSession(rage),recorded=card?.getFlag?.(ID,"focusSaveRage");
    return game.settings.get(ID,"fanaticalFocusAutomation")===true&&card?.type==="save"&&Number.isInteger(index)&&index>=0&&
        !!card.rolls?.[index]?.d20&&card.rolls[index]._evaluated&&!card.getFlag?.(ID,"automaticGrappleFailure")&&
        !card.getFlag?.(ID,"carefulSpell")&&!card.system?.forceSuccess&&!card.system?.concentrationBroken&&!isRollAdjustmentLocked(card)&&
        failureState(card,index)!=="ineligible"&&!!focusFeature(actor)&&!!rage&&!rage.getFlag?.(ID,"fanaticalFocusUsed")&&
        (!recorded||recorded===session)&&!!rageSaveBonus(actor)&&!!(user?.isGM||actor?.testUserPermission?.(user,"OWNER"));
}
export async function rerollFocus(original,bonus){
    const adjusted=original.constructor.fromData(foundry.utils.deepClone(original.toJSON())),mode=0;
    const die=new CONFIG.Dice.D20Die({number:1,faces:20});
    die.applyAdvantage?.(mode);die.applyFlag?.("halflingLucky",original.options?.halflingLucky===true);
    die.applyRange?.({minimum:original.options?.minimum,maximum:original.options?.maximum});await die.evaluate({allowInteractive:false});
    const results=foundry.utils.deepClone(die.results.filter(result=>!result.rerolled));
    if(results.length!==1)throw Error("Fanatical Focus did not produce the expected d20 results.");
    // Fanatical Focus uses one replacement d20, independent of the original mode.
    adjusted.options.advantageMode=0;adjusted.options.advantage=false;adjusted.options.disadvantage=false;
    adjusted.d20.applyAdvantage?.(0);adjusted.d20.number=1;
    const winner=mode===-1?Math.min(...results.map(result=>result.result)):Math.max(...results.map(result=>result.result));
    const winningIndex=results.findIndex(result=>result.result===winner);
    for(const result of adjusted.d20.results){result.active=false;result.discarded=true;result.rerolled=true;}
    adjusted.d20.results.push(...results.map((result,index)=>({...result,active:index===winningIndex,discarded:index!==winningIndex})));
    adjusted.options.rsaSaveDicePool=results;adjusted.resetFormula();adjusted._total=adjusted._evaluateTotal();
    const flat=await new CONFIG.Dice.BasicRoll(String(bonus)).evaluate();
    return {roll:await inspiredRoll(adjusted,flat),results};
}
const signature=card=>seekingSnapshot(card)+JSON.stringify(card.rolls.map(roll=>roll.options?.target));
export async function applyFocus(card,index=0,user=game.user,confirmedFailure=false){
    if(!canFocus(card,user,index))throw Error("Fanatical Focus needs a failed saving throw, active Rage and an unused reroll for this Rage. Undo applied damage/effects first.");
    if(failureState(card,index)==="unknown"&&!confirmedFailure)throw Error("Confirm that this saving throw failed first.");
    const actor=actorFor(card),rage=focusRage(actor),session=focusSession(rage),before=signature(card),bonus=rageSaveBonus(actor);
    const result=await rerollFocus(card.rolls[index],bonus);
    if(!canFocus(card,user,index)||signature(card)!==before||focusRage(actor)!==rage||focusSession(rage)!==session)throw Error("The saving throw or Rage changed. Try again.");
    const record={message:card.uuid??card.id,index,session};let consumed=false,committed=false;
    try{
        await rage.setFlag(ID,"fanaticalFocusUsed",record);consumed=true;
        await animateNewSaveDice(card,result.results,user);
        if(signature(card)!==before||isRollAdjustmentLocked(card)||focusRage(actor)!==rage||focusSession(rage)!==session||rage.getFlag(ID,"fanaticalFocusUsed")?.message!==record.message)throw Error("The save or Rage changed during the reroll. Fanatical Focus was restored.");
        const rolls=[...card.rolls];rolls[index]=result.roll;
        const used={...(card.getFlag(ID,"fanaticalFocus")??{}),[index]:{bonus,session}};
        const skip=card.getFlag("dice-so-nice","skip");
        try{await card.update({rolls,["flags."+ID+".fanaticalFocus"]:used,"flags.dice-so-nice.skip":true});committed=true;}
        finally{if(skip===undefined)await card.unsetFlag("dice-so-nice","skip");else await card.setFlag("dice-so-nice","skip",skip);}
    }catch(error){if(consumed&&!committed&&rage.getFlag(ID,"fanaticalFocusUsed")?.message===record.message)await rage.unsetFlag(ID,"fanaticalFocusUsed");throw error;}
    if(committed)restoreFocusTargets(card);
}
export function restoreFocusTargets(card){
    let origin=typeof card?.system?.origin==="string"?game.messages.get(card.system.origin):card?.system?.origin;
    if(!origin)return;
    const seen=new Set();while(origin?.system?.origin&&!seen.has(origin.id)){
        seen.add(origin.id);const next=typeof origin.system.origin==="string"?game.messages.get(origin.system.origin):origin.system.origin;if(!next)break;origin=next;
    }
    const cards=new Set([origin,...(origin.getAssociatedRolls?.("damage")??[]),...(origin.getAssociatedRolls?.("healing")??[])]);
    const apply=()=>{
        const host=globalThis.foundry?.applications?.detached??globalThis.document;
        for(const message of cards){
            if(!message.system?.targets?.length)continue;
            if(message._targetState)message._targetState.mode="targeted";
            for(const targets of host?.querySelectorAll?.('[data-message-id="'+message.id+'"] recorded-targets')??[]){
                if(targets.hasRecordedTargets!==false)targets.targetingMode="targeted";
            }
        }
    };
    apply();
    if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>requestAnimationFrame(apply));
}
function report(error){console.error("Ugmuls 5.5e Automation | Fanatical Focus",error);ui.notifications.error(error.message);}
export function renderFocus(message,html){
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=[{card:message,root}];for(const summary of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(summary.dataset.messageId);if(card&&!summary.hidden)entries.push({card,root:summary});}
    for(const entry of entries){
        entry.root.querySelectorAll(':scope > .rsa-focus-actions').forEach(node=>node.remove());if(entry.card.isContentVisible===false)continue;
        const controls=document.createElement("div");controls.className="rsa-attack-actions rsa-focus-actions";
        for(const[index,roll]of (entry.card.rolls??[]).entries()){
            if(!canFocus(entry.card,game.user,index))continue;
            const actor=actorFor(entry.card),button=document.createElement("button"),img=document.createElement("img");button.type="button";img.src=focusFeature(actor).img??"icons/svg/d20.svg";img.alt="";
            button.append(img,document.createTextNode("Fanatical Focus (+"+rageSaveBonus(actor)+")"+(entry.card.rolls.length>1?" — Roll "+(index+1):"")));
            button.dataset.tooltip="Once per Rage: roll one new d20 without advantage/disadvantage and add your Rage Damage bonus. Keep the new result, even if lower.";
            button.addEventListener("click",async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{
                let confirmed=false;
                if(failureState(entry.card,index)==="unknown"){confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:"Fanatical Focus"},content:"<p>Confirm that this saving throw failed. Reroll it with your Rage Damage bonus? You must use the new result.</p>",rejectClose:false});if(!confirmed)return;}
                const gm=game.users.activeGM;
                if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"fanaticalFocus",messageId:entry.card.id,index,confirmedFailure:confirmed,userId:game.user.id,gmId:gm.id});
                else await enqueue(()=>applyFocus(entry.card,index,game.user,confirmed));
            }catch(error){report(error);}finally{button.disabled=!canFocus(entry.card,game.user,index);}});controls.append(button);
        }
        for(const record of Object.values(entry.card.getFlag?.(ID,"fanaticalFocus")??{})){const label=document.createElement("span");label.textContent="Fanatical Focus: rerolled +"+record.bonus;controls.append(label);}
        if(controls.childNodes.length)entry.root.append(controls);
    }
}
function refresh(){for(const card of Array.from(game.messages??[]).slice(-100))if(card.type==="save")ui.chat?.updateMessage?.(card);}
Hooks.once("init",()=>game.settings.register(ID,"fanaticalFocusAutomation",{name:"Fanatical Focus Assistance",hint:"Once per active Rage, offer a failed-save reroll with the current Rage Damage bonus. Preserve other bonuses, reroll exactly one d20 without advantage/disadvantage, and require the new result. Extending the same Rage does not refresh this use.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    Hooks.on("preCreateChatMessage",card=>{if(card.type!=="save")return;const rage=focusRage(actorFor(card));if(rage)card.updateSource({["flags."+ID+".focusSaveRage"]:focusSession(rage)});});
    Hooks.on("preUpdateActiveEffect",(effect,changes)=>{
        if(changes.disabled!==false||!effect.disabled||!effect.getFlag?.(ID,"fanaticalFocusUsed"))return;
        changes["flags."+ID+".-=fanaticalFocusUsed"]=null;
        changes["flags."+ID+".focusRageSession"]=foundry.utils.randomID();
    });
    Hooks.on("dnd5e.renderChatMessage",renderFocus);
    Hooks.on("updateChatMessage",(card,changes)=>{if(card.type==="save"&&(changes.flags?.[ID]?.fanaticalFocus||changes["flags."+ID+".fanaticalFocus"]))restoreFocusTargets(card);});
    for(const event of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(event,refresh);
    game.socket.on("module."+ID,packet=>{
        if(packet?.action==="fanaticalFocusError"&&packet.userId===game.user.id){ui.notifications.error(packet.error);refresh();return;}
        if(packet?.action!=="fanaticalFocus"||!game.user.isGM||game.users.activeGM?.id!==game.user.id||packet.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId),card=game.messages.get(packet.messageId);if(!user?.active||!card)return;
        enqueue(()=>applyFocus(card,packet.index,user,packet.confirmedFailure===true)).catch(error=>{report(error);game.socket.emit("module."+ID,{action:"fanaticalFocusError",userId:user.id,error:error.message});});
    });
});
