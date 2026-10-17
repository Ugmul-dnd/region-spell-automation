import {createEventQueue,isRollAdjustmentLocked} from "./shared-activity-card.js";
import {seekingSnapshot} from "./seeking-spell.js";
const ID="ugmuls-5-5e-automation",enqueue=createEventQueue();
const actorFor=card=>card?.getAssociatedActor?.()??card?.getAssociatedActivity?.()?.actor;
const enabled=()=>game.settings.get(ID,"bardicInspirationAutomation")===true;
export const valorSource=actor=>Array.from(actor?.items??[]).some(item=>item.type==="feat"&&((item.identifier??item.system?.identifier)==="combat-inspiration"||/^combat inspiration$/i.test(item.name??"")));
const featureFor=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&((item.identifier??item.system?.identifier)==="bardic-inspiration"||/^bardic inspiration$/i.test(item.name??"")));
function resolve(uuid){try{return uuid?fromUuidSync(uuid,{strict:false}):null;}catch{return null;}}
function sourceOf(effect){
    const origin=effect.system?.origin??{},doc=resolve(origin.item)??resolve(origin.activity)??resolve(effect.origin);
    const item=doc?.type==="feat"?doc:doc?.item??(doc?.parent?.type==="feat"?doc.parent:null);
    const actor=effect.getSourceActor?.()??resolve(origin.actor)??item?.actor??doc?.actor;
    const feature=item&&((item.identifier??item.system?.identifier)==="bardic-inspiration"||/^bardic inspiration$/i.test(item.name??""))?item:null;
    return {actor,feature};
}
export function bardicFormula(actor,feature=featureFor(actor)){
    if(!actor||!feature)return null;
    const data=actor.getRollData?.()??{},scales=data.scale??actor.system?.scale??{};
    const candidates=Object.values(scales).flatMap(group=>Object.entries(group??{}).filter(([key])=>/^(?:bardic-)?inspiration(?:-die)?$/.test(key)).map(([,value])=>value));
    for(const value of candidates){
        const raw=value?.die??value?.formula??value;
        const formula=CONFIG.Dice.BasicRoll.replaceFormulaData(String(raw),data,{missing:""});
        const match=/^\s*(?:1)?d(6|8|10|12)\s*$/i.exec(formula);if(match)return "1d"+match[1];
    }
    const cls=actor.itemTypes?.class?.find(item=>(item.identifier??item.system?.identifier)==="bard"),level=Number(cls?.system?.levels);
    return level>0?"1d"+(level>=15?12:level>=10?10:level>=5?8:6):null;
}
export function inspirationData(effect){
    const stored=effect.getFlag?.(ID,"bardicInspiration");
    if(stored&&/^1d(?:6|8|10|12)$/.test(stored.formula))return {...stored,combatInspiration:stored.combatInspiration??valorSource(resolve(stored.sourceActor)??sourceOf(effect).actor)};
    const {actor,feature}=sourceOf(effect);
    // A source feature is required: Heroic Inspiration and generic Inspired effects are unrelated.
    if(!feature)return null;
    const formula=bardicFormula(actor,feature);return formula?{formula,sourceActor:actor.uuid,sourceItem:feature.uuid,img:feature.img,combatInspiration:valorSource(actor)}:null;
}
export function availableInspiration(actor){return Array.from(actor?.appliedEffects??actor?.effects??[]).filter(effect=>!effect.disabled&&effect.active!==false&&!effect.system?.expired&&!effect.duration?.expired&&!effect.getFlag?.(ID,"bardicSpent")).map(effect=>({effect,data:inspirationData(effect)})).filter(entry=>entry.data);}
export function failureState(card,index=0){
    const roll=card?.rolls?.[index];if(!roll?.d20||!roll._evaluated)return "ineligible";
    if(card.type==="attack"){
        const targets=card.system?.evaluatedTargets??[];
        if(targets.length)return targets.every(target=>target.isMiss===true)?"failed":"ineligible";
    }
    if(card.system?.forceSuccess||card.system?.resisted||card.system?.concentrationBroken)return "ineligible";
    const target=roll.options?.target;
    return target!==null&&target!==undefined&&target!==""&&Number.isFinite(Number(target))?(roll.isFailure===true?"failed":"ineligible"):"unknown";
}
export function canInspire(card,user=game.user,index=0){
    const actor=actorFor(card);
    return enabled()&&["attack","save","check"].includes(card?.type)&&Number.isInteger(index)&&index>=0&&
        !(card.getFlag?.(ID,"bardicUsed")??{})[index]&&!card.getFlag?.(ID,"carefulSpell")&&!card.getFlag?.(ID,"automaticGrappleFailure")&&
        !isRollAdjustmentLocked(card)&&failureState(card,index)!=="ineligible"&&
        !!(user?.isGM||actor?.testUserPermission?.(user,"OWNER"))&&availableInspiration(actor).length===1;
}
export async function inspiredRoll(original,bonus){
    const adjusted=original.constructor.fromData(foundry.utils.deepClone(original.toJSON()));
    adjusted.terms.push(new foundry.dice.terms.OperatorTerm({operator:"+"}),...bonus.terms);
    adjusted.resetFormula();adjusted._total=adjusted._evaluateTotal();return adjusted;
}
const signature=card=>seekingSnapshot(card)+JSON.stringify(card.rolls.map(roll=>roll.options?.target));
export async function applyInspiration(card,user=game.user,index=0,confirmedFailure=false){
    if(!canInspire(card,user,index))throw Error("Bardic Inspiration requires an available Inspired effect and an unresolved failed D20 Test. Undo applied damage or effects first.");
    if(failureState(card,index)==="unknown"&&!confirmedFailure)throw Error("Confirm that this D20 Test failed before using Bardic Inspiration.");
    const actor=actorFor(card),{effect,data}=availableInspiration(actor)[0],before=signature(card);
    const bonus=await new CONFIG.Dice.BasicRoll(data.formula,actor.getRollData?.()??{}).evaluate();
    if(!canInspire(card,user,index)||signature(card)!==before||!availableInspiration(actor).some(entry=>entry.effect===effect))throw Error("The roll or Inspired effect changed. Try again.");
    const adjusted=await inspiredRoll(card.rolls[index],bonus),oldSpent=effect.getFlag?.(ID,"bardicSpent");let consumed=false,committed=false;
    try{
        await effect.update({disabled:true,["flags."+ID+".bardicSpent"]:{message:card.uuid??card.id,index}});consumed=true;
        if(game.dice3d?.showForRoll){try{const animation=Promise.resolve(game.dice3d.showForRoll(bonus,user,true,card.whisper?.length?card.whisper:null,card.blind??false,card.id,card.speaker));if(globalThis.Ugmuls55eAutomationWaitForAnimation)await globalThis.Ugmuls55eAutomationWaitForAnimation(animation);else if(globalThis.document?.hidden)animation.catch(console.warn);else await animation;}catch(error){console.warn("Bardic Inspiration animation failed",error);}}
        if(signature(card)!==before||isRollAdjustmentLocked(card)||!effect.disabled||effect.getFlag?.(ID,"bardicSpent")?.message!==(card.uuid??card.id))throw Error("The roll changed while Inspiration was applied. The die was restored.");
        const rolls=[...card.rolls];rolls[index]=adjusted;
        const used={...(card.getFlag(ID,"bardicUsed")??{}),[index]:{...data,effect:effect.uuid,total:bonus.total}},skip=card.getFlag("dice-so-nice","skip");
        try{await card.update({rolls,["flags."+ID+".bardicUsed"]:used,"flags.dice-so-nice.skip":true});committed=true;}
        finally{if(skip===undefined)await card.unsetFlag("dice-so-nice","skip");else await card.setFlag("dice-so-nice","skip",skip);}
    }catch(error){if(consumed&&!committed){await effect.update({disabled:false});if(oldSpent===undefined)await effect.unsetFlag(ID,"bardicSpent");else await effect.setFlag(ID,"bardicSpent",oldSpent);}throw error;}
}
function report(error){console.error("Ugmuls 5.5e Automation | Bardic Inspiration",error);ui.notifications.error(error.message);}
async function request(card,index,button){
    button.disabled=true;
    try{
        let confirmed=false;
        if(failureState(card,index)==="unknown"){
            confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:"Use Bardic Inspiration?"},content:"<p>This roll has no recorded DC. Confirm that it failed. Roll and spend your Bardic Inspiration die?</p>",rejectClose:false});
            if(!confirmed)return;
        }
        const gm=game.users.activeGM;
        if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"bardicInspiration",messageId:card.id,index,confirmedFailure:confirmed,userId:game.user.id,gmId:gm.id});
        else await enqueue(()=>applyInspiration(card,game.user,index,confirmed));
    }catch(error){report(error);}finally{button.disabled=!canInspire(card,game.user,index);}
}
export function renderInspiration(message,html){
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=[{card:message,root}];
    for(const summary of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(summary.dataset.messageId);if(card&&!summary.hidden)entries.push({card,root:summary});}
    for(const entry of entries){
        for(const old of entry.root.querySelectorAll(':scope > .rsa-bardic-actions'))old.remove();
        if(entry.card.isContentVisible===false)continue;
        const indices=(entry.card.rolls??[]).map((roll,index)=>index).filter(index=>canInspire(entry.card,game.user,index));if(!indices.length)continue;
        const controls=document.createElement("div");controls.className="rsa-attack-actions rsa-bardic-actions";
        const data=availableInspiration(actorFor(entry.card))[0].data;
        for(const index of indices){
            const button=document.createElement("button");button.type="button";
            const image=document.createElement("img");image.src=data.img??"icons/svg/d20.svg";image.alt="";
            button.append(image,document.createTextNode("Bardic Inspiration ("+data.formula.replace(/^1/,"")+")"+(entry.card.rolls.length>1?" — Roll "+(index+1):"")));
            button.dataset.tooltip="Add the Bardic die to this failed D20 Test. The die is spent even if the test still fails.";
            button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();request(entry.card,index,button);});controls.append(button);
        }
        entry.root.append(controls);
    }
}
const scrolledGrants=new Set();
export function scrollAppliedInspiration(card){
    if(card?.type!=="usage"||!card.getFlag?.(ID,"buffAutoApplied")||scrolledGrants.has(card.id))return;
    const item=card.getAssociatedItem?.()??card.getAssociatedActivity?.()?.item;
    if((item?.identifier??item?.system?.identifier)!=="bardic-inspiration"&&!/^bardic inspiration$/i.test(item?.name??""))return;
    scrolledGrants.add(card.id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>Promise.resolve(ui.chat?.scrollBottom?.({waitImages:true})).catch(error=>console.warn("Bardic Inspiration chat scroll failed",error))));
}
function refresh(document){globalThis.Ugmuls55eAutomationChatRefresh?.request("bardic",document);}
Hooks.once("init",()=>game.settings.register(ID,"bardicInspirationAutomation",{name:"Bardic Inspiration Assistance",hint:"Offer the source Bard's Inspiration die on failed attacks, saves and checks. Preserve the original d20 and consume Inspired when the die is rolled.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    Hooks.on("preCreateActiveEffect",effect=>{if(!enabled()&&game.settings.get(ID,"combatInspirationAutomation")!==true)return;const data=inspirationData(effect);if(data)effect.updateSource({["flags."+ID+".bardicInspiration"]:data});});
    Hooks.on("preUpdateActiveEffect",(effect,changes)=>{
        // A deliberately re-enabled/reapplied effect is a fresh grant, not a permanent spent marker.
        if((!enabled()&&game.settings.get(ID,"combatInspirationAutomation")!==true)||changes.disabled!==false||!effect.getFlag?.(ID,"bardicSpent"))return;
        changes["flags."+ID+".-=bardicSpent"]=null;
        const {actor,feature}=sourceOf(effect),formula=feature?bardicFormula(actor,feature):null;
        if(formula)changes["flags."+ID+".bardicInspiration"]={formula,sourceActor:actor.uuid,sourceItem:feature.uuid,img:feature.img,combatInspiration:valorSource(actor)};
    });
    Hooks.on("dnd5e.renderChatMessage",renderInspiration);
    Hooks.on("dnd5e.renderChatMessage",scrollAppliedInspiration);
    Hooks.on("deleteChatMessage",card=>scrolledGrants.delete(card.id));
    for(const event of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(event,refresh);
    Hooks.on("updateChatMessage",(card,changes)=>{
        if(!changes.flags?.[ID]?.bardicUsed&&!changes["flags."+ID+".bardicUsed"])return;
        if(card.type!=="attack"||card.author?.id!==game.user.id||!card.system.evaluatedTargets?.some(target=>target.isMiss===false))return;
        const origin=typeof card.system.origin==="string"?game.messages.get(card.system.origin):card.system.origin;
        if(origin)globalThis.Ugmuls55eAutomationDamage?.promptDamage(card.getAssociatedActivity(),origin,"attack",card).catch(report);
    });
    game.socket.on("module."+ID,packet=>{
        if(packet?.action==="bardicInspirationError"&&packet.userId===game.user.id){ui.notifications.error(packet.error);refresh();return;}
        if(packet?.action!=="bardicInspiration"||!game.user.isGM||game.users.activeGM?.id!==game.user.id||packet.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId),card=game.messages.get(packet.messageId);if(!user?.active||!card)return;
        enqueue(()=>applyInspiration(card,user,packet.index,packet.confirmedFailure===true)).catch(error=>{report(error);game.socket.emit("module."+ID,{action:"bardicInspirationError",userId:user.id,error:error.message});});
    });
});
