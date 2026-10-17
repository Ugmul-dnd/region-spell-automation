import {createEventQueue,isRollAdjustmentLocked,isHealingCard} from "./shared-activity-card.js";
import {bardicFormula} from "./bardic-inspiration.js";
import {reactionUsed,recordReactionUse} from "./reaction-tracker.js";
import {seekingSnapshot} from "./seeking-spell.js";
const ID="ugmuls-5-5e-automation",enqueue=createEventQueue();
const actorFor=card=>card?.getAssociatedActor?.()??card?.getAssociatedActivity?.()?.actor;
const findFeature=(actor,id,name)=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&((item.identifier??item.system?.identifier)===id||item.name?.toLowerCase()===name));
export function cuttingResource(actor){return findFeature(actor,"bardic-inspiration","bardic inspiration");}
const remaining=item=>Number(item?.system?.uses?.value??(Number(item?.system?.uses?.max)-Number(item?.system?.uses?.spent??0)))||0;
export function cuttingRange(bard,enemy){
    if(!bard||!enemy||bard.parent?.id!==enemy.parent?.id||bard.actor?.uuid===enemy.actor?.uuid)return false;
    if(bard.disposition===enemy.disposition||!Number.isFinite(bard.disposition)||!Number.isFinite(enemy.disposition))return false;
    const a=bard.object,b=enemy.object;if(!a?.center||!b?.center)return false;
    const distance=canvas.grid.measurePath([a.center,b.center]).distance;
    const units=String(canvas.scene?.grid?.units??"ft").toLowerCase(),limit=/^(m|meters?|metres?)$/.test(units)?18.288:60;
    if(!Number.isFinite(distance)||distance>limit)return false;
    // Check sight walls from the Bard, never from the GM camera.
    if(a.checkCollision?.(b.center,{type:"sight",mode:"any"}))return false;
    if(enemy.hidden)return false;
    return true;
}
function enemyToken(card){return card.getAssociatedToken?.()?.document??card.getAssociatedToken?.();}
export function cuttingEligible(card,index=0){
    if(!game.settings.get(ID,"cuttingWordsAutomation")||!Number.isInteger(index)||index<0||!card?.rolls?.[index]?._evaluated||isRollAdjustmentLocked(card))return false;
    if((card.getFlag?.(ID,"cuttingWords")??{})[index])return false;
    if(card.type==="attack")return !!card.rolls[index].d20&&(card.system?.evaluatedTargets??[]).some(target=>target.isMiss===false);
    return card.type==="damage"&&!isHealingCard(card)&&Number(card.rolls[index].total)>0&&!card.getFlag?.(ID,"pendingDamage");
}
export function cuttingCandidates(card,user=game.user,index=0){
    if(!cuttingEligible(card,index))return [];
    const enemy=enemyToken(card);if(!enemy)return [];
    const seen=new Set(),entries=[];
    for(const token of canvas.scene?.tokens??[]){
        const actor=token.actor;if(!actor||seen.has(actor.uuid)||!(user?.isGM||actor.testUserPermission?.(user,"OWNER")))continue;
        if(reactionUsed(actor)||["incapacitated","unconscious","dead","stunned","paralyzed","petrified"].some(status=>actor.statuses?.has(status)))continue;
        const feature=findFeature(actor,"cutting-words","cutting words"),resource=cuttingResource(actor),formula=bardicFormula(actor,resource);
        if(!feature||!formula||remaining(resource)<1||!cuttingRange(token,enemy))continue;
        if(!Array.from(feature.system.activities?.values?.()??feature.system.activities??[]).some(activity=>activity.activation?.type==="reaction"))continue;
        seen.add(actor.uuid);entries.push({actor,token,feature,resource,formula});
    }
    return entries;
}
export async function subtractCuttingWords(original,bonus,{damage=false,flavor="Cutting Words"}={}){
    const adjusted=original.constructor.fromData(foundry.utils.deepClone(original.toJSON()));
    const {OperatorTerm,NumericTerm}=foundry.dice.terms;
    // Use a flat evaluated reduction so it never becomes critical damage dice.
    const reduction=damage?Math.min(Math.max(0,original.total),bonus.total):bonus.total;
    const term=new NumericTerm({number:reduction,options:{flavor,rsaCuttingWords:flavor==="Cutting Words",rsaParry:flavor==="Parry"}});await term.evaluate();
    adjusted.terms.push(new OperatorTerm({operator:"-"}),term);
    delete adjusted.options.rsaDamageModes;
    adjusted.resetFormula();adjusted._total=adjusted._evaluateTotal();return adjusted;
}
export async function applyCuttingWords(card,bardUuid,index=0,user=game.user){
    let entry=cuttingCandidates(card,user,index).find(candidate=>candidate.actor.uuid===bardUuid);
    if(!entry)throw Error("Cutting Words needs a visible enemy within 60 feet, an available reaction and a Bardic Inspiration use. Undo applied damage first.");
    const before=seekingSnapshot(card),spent=Number(entry.resource.system.uses.spent??0);
    const bonus=await new CONFIG.Dice.BasicRoll(entry.formula,entry.actor.getRollData?.()??{}).evaluate();
    if(seekingSnapshot(card)!==before||!cuttingCandidates(card,user,index).some(candidate=>candidate.actor.uuid===bardUuid))throw Error("The roll or Bard's resources changed. Try again.");
    const adjusted=await subtractCuttingWords(card.rolls[index],bonus,{damage:card.type==="damage"});
    let charged=false,committed=false,marker;
    try{
        await entry.resource.update({"system.uses.spent":spent+1});charged=true;
        const activity=Array.from(entry.feature.system.activities?.values?.()??entry.feature.system.activities??[]).find(activity=>activity.activation?.type==="reaction");
        if(!activity)throw Error("Cutting Words needs its configured Reaction activity.");
        if(reactionUsed(entry.actor))throw Error("The Bard’s reaction was just used. Try again after their reaction resets.");
        await recordReactionUse(activity,{}, {message:card});marker=reactionUsed(entry.actor);
        const tracked=game.settings.get(ID,"reactionTracker")===true&&game.combat?.started&&Array.from(game.combat.combatants??[]).some(combatant=>combatant.actor?.uuid===bardUuid);
        if(tracked&&marker?.getFlag?.(ID,"reactionUsage")!==card.id)throw Error("Could not reserve the Bard’s reaction.");
        if(game.dice3d?.showForRoll){try{const animation=Promise.resolve(game.dice3d.showForRoll(bonus,user,true,card.whisper?.length?card.whisper:null,card.blind??false,card.id,card.speaker));if(globalThis.document?.hidden)animation.catch(console.warn);else await animation;}catch(error){console.warn("Cutting Words animation failed",error);}}
        if(seekingSnapshot(card)!==before||isRollAdjustmentLocked(card)||!cuttingRange(entry.token,enemyToken(card)))throw Error("The roll changed during Cutting Words. Resources were restored.");
        const rolls=[...card.rolls];rolls[index]=adjusted;
        const used={...(card.getFlag(ID,"cuttingWords")??{}),[index]:{bard:bardUuid,name:entry.actor.name,die:entry.formula,total:bonus.total}};
        const skip=card.getFlag("dice-so-nice","skip");
        try{await card.update({rolls,["flags."+ID+".cuttingWords"]:used,"flags.dice-so-nice.skip":true});committed=true;}
        finally{if(skip===undefined)await card.unsetFlag("dice-so-nice","skip");else await card.setFlag("dice-so-nice","skip",skip);}
    }catch(error){if(charged&&!committed){await entry.resource.update({"system.uses.spent":spent});if(marker?.getFlag?.(ID,"reactionUsage")===card.id)await marker.update({disabled:true});}throw error;}
}
function report(error){console.error("Ugmuls 5.5e Automation | Cutting Words",error);ui.notifications.error(error.message);}
export function renderCuttingWords(message,html){
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=[{card:message,root}];for(const summary of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(summary.dataset.messageId);if(card&&!summary.hidden)entries.push({card,root:summary});}
    for(const entry of entries){
        entry.root.querySelectorAll(':scope > .rsa-cutting-actions').forEach(node=>node.remove());if(entry.card.isContentVisible===false)continue;
        const controls=document.createElement("div");controls.className="rsa-attack-actions rsa-cutting-actions";
        for(const[index,roll]of (entry.card.rolls??[]).entries()){
            for(const candidate of cuttingCandidates(entry.card,game.user,index)){
                const button=document.createElement("button");button.type="button";
                const image=document.createElement("img");image.src=candidate.feature.img??"icons/svg/d20.svg";image.alt="";
                const type=roll.options?.type??Array.from(roll.options?.types??[]).join("/");
                button.append(image,document.createTextNode("Cutting Words ("+candidate.formula.replace(/^1/,"")+") — "+candidate.actor.name+(entry.card.rolls.length>1?" · "+(type||"Roll "+(index+1)):"")));
                button.dataset.tooltip="Use your Reaction and one Bardic Inspiration use. Confirm you can see this enemy. Subtract the die from this roll; damage cannot fall below zero.";
                button.addEventListener("click",async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{
                    const gm=game.users.activeGM;
                    if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"cuttingWords",messageId:entry.card.id,bardUuid:candidate.actor.uuid,index,userId:game.user.id,gmId:gm.id});
                    else await enqueue(()=>applyCuttingWords(entry.card,candidate.actor.uuid,index));
                }catch(error){report(error);}finally{button.disabled=!cuttingCandidates(entry.card,game.user,index).some(c=>c.actor.uuid===candidate.actor.uuid);}});controls.append(button);
            }
        }
        for(const[index,record]of Object.entries(entry.card.getFlag?.(ID,"cuttingWords")??{})){const label=document.createElement("span");label.className="rsa-cutting-result";label.textContent="Cutting Words: −"+record.total+" ("+record.name+")";controls.append(label);}
        if(controls.childNodes.length)entry.root.append(controls);
    }
}
function refresh(){for(const card of Array.from(game.messages??[]).slice(-100))if(["attack","damage"].includes(card.type))ui.chat?.updateMessage?.(card);}
Hooks.once("init",()=>game.settings.register(ID,"cuttingWordsAutomation",{name:"Cutting Words Assistance",hint:"Offer eligible Lore Bards a Reaction button on enemy attack hits and damage rolls within 60 feet. Spend one current Bardic Inspiration die and subtract it from the existing roll. Visibility must be confirmed by the user.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",renderCuttingWords);
    for(const event of ["createActiveEffect","updateActiveEffect","deleteActiveEffect","updateCombat","updateItem","updateToken"])Hooks.on(event,refresh);
    game.socket.on("module."+ID,packet=>{
        if(packet?.action==="cuttingWordsError"&&packet.userId===game.user.id){ui.notifications.error(packet.error);refresh();return;}
        if(packet?.action!=="cuttingWords"||!game.user.isGM||game.users.activeGM?.id!==game.user.id||packet.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId),card=game.messages.get(packet.messageId);if(!user?.active||!card)return;
        enqueue(()=>applyCuttingWords(card,packet.bardUuid,packet.index,user)).catch(error=>{report(error);game.socket.emit("module."+ID,{action:"cuttingWordsError",userId:user.id,error:error.message});});
    });
});
