import {createEventQueue,isRollAdjustmentLocked} from "./shared-activity-card.js";
import {bardicFormula,inspiredRoll,failureState} from "./bardic-inspiration.js";
import {cuttingResource} from "./cutting-words.js";
import {seekingSnapshot} from "./seeking-spell.js";
const ID="ugmuls-5-5e-automation",enqueue=createEventQueue();
const actorFor=card=>card?.getAssociatedActor?.()??card?.getAssociatedActivity?.()?.actor;
export const peerlessFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&((item.identifier??item.system?.identifier)==="peerless-skill"||/^peerless skill$/i.test(item.name??"")));
const remaining=item=>Number(item?.system?.uses?.value??(Number(item?.system?.uses?.max)-Number(item?.system?.uses?.spent??0)))||0;
const validDC=value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))&&Number(value)>0;
export function peerlessDC(card,index=0){
    if(card.type==="attack"){
        const acs=Array.from(card.system?.evaluatedTargets??card.system?.targets??[]).map(target=>target.ac).filter(validDC).map(Number);
        if(acs.length)return Math.min(...acs);
    }
    return validDC(card.rolls?.[index]?.options?.target)?Number(card.rolls[index].options.target):null;
}
export function canPeerless(card,user=game.user,index=0){
    const actor=actorFor(card),resource=cuttingResource(actor),roll=card?.rolls?.[index];
    return game.settings.get(ID,"peerlessSkillAutomation")===true&&["attack","check"].includes(card?.type)&&
        !(card.type==="check"&&card.system?.type==="initiative")&&Number.isInteger(index)&&index>=0&&!!roll?.d20&&roll._evaluated&&
        !(card.getFlag?.(ID,"peerlessSkill")??{})[index]&&!isRollAdjustmentLocked(card)&&failureState(card,index)!=="ineligible"&&
        !!peerlessFeature(actor)&&remaining(resource)>0&&!!bardicFormula(actor,resource)&&!!(user?.isGM||actor?.testUserPermission?.(user,"OWNER"));
}
const snapshot=card=>seekingSnapshot(card)+JSON.stringify({targets:card.system?.targets,dc:card.rolls.map(roll=>roll.options?.target)});
export async function applyPeerless(card,index=0,user=game.user,providedDC=null){
    if(!canPeerless(card,user,index))throw Error("Peerless Skill needs your failed attack or ability check and an available Bardic Inspiration use. Undo applied damage first.");
    const dc=peerlessDC(card,index)??(validDC(providedDC)?Number(providedDC):null);
    if(dc===null)throw Error("Enter the GM-provided DC before rolling Peerless Skill so its resource cost can be determined.");
    const original=card.rolls[index];if(original.total>=dc&&!(card.type==="attack"&&original.isFumble))throw Error("This roll already succeeds against that DC.");
    const actor=actorFor(card),resource=cuttingResource(actor),formula=bardicFormula(actor,resource),before=snapshot(card),spent=Number(resource.system.uses.spent??0);
    const bonus=await new CONFIG.Dice.BasicRoll(formula,actor.getRollData?.()??{}).evaluate(),adjusted=await inspiredRoll(original,bonus);
    if(!canPeerless(card,user,index)||snapshot(card)!==before||Number(resource.system.uses.spent??0)!==spent)throw Error("The roll or Bardic Inspiration pool changed. Try again.");
    const success=adjusted.total>=dc&&!(card.type==="attack"&&adjusted.isFumble);
    if(card.type==="check"&&!validDC(original.options.target))adjusted.options.target=dc;
    let charged=false,committed=false;
    try{
        if(success){await resource.update({"system.uses.spent":spent+1});charged=true;}
        if(game.dice3d?.showForRoll){try{const animation=Promise.resolve(game.dice3d.showForRoll(bonus,user,true,card.whisper?.length?card.whisper:null,card.blind??false,card.id,card.speaker));if(globalThis.Ugmuls55eAutomationWaitForAnimation)await globalThis.Ugmuls55eAutomationWaitForAnimation(animation);else if(globalThis.document?.hidden)animation.catch(console.warn);else await animation;}catch(error){console.warn("Peerless Skill animation failed",error);}}
        if(snapshot(card)!==before||isRollAdjustmentLocked(card)||Number(resource.system.uses.spent??0)!==spent+(charged?1:0))throw Error("The roll changed during Peerless Skill. Any spent use was restored.");
        const rolls=[...card.rolls];rolls[index]=adjusted;
        const record={...(card.getFlag(ID,"peerlessSkill")??{}),[index]:{formula,total:bonus.total,spent:success}};
        const skip=card.getFlag("dice-so-nice","skip");
        try{await card.update({rolls,["flags."+ID+".peerlessSkill"]:record,"flags.dice-so-nice.skip":true});committed=true;}
        finally{if(skip===undefined)await card.unsetFlag("dice-so-nice","skip");else await card.setFlag("dice-so-nice","skip",skip);}
    }catch(error){if(charged&&!committed)await resource.update({"system.uses.spent":spent});throw error;}
}
function report(error){console.error("Ugmuls 5.5e Automation | Peerless Skill",error);ui.notifications.error(error.message);}
async function request(card,index,button){
    button.disabled=true;
    try{
        let dc=null;
        if(peerlessDC(card,index)===null){
            dc=await foundry.applications.api.DialogV2.wait({window:{title:"Peerless Skill — Check DC"},rejectClose:false,
                content:'<p>Enter the DC supplied by the GM before rolling. The Bardic Inspiration use is spent only if Peerless Skill turns the failure into success.</p><input name="dc" type="number" min="1" step="1" required aria-label="GM-provided DC">',
                buttons:[{action:"confirm",label:"Roll Peerless Skill",default:true,callback:(event,button,dialog)=>dialog.element.querySelector('[name="dc"]').value},{action:"cancel",label:"Cancel",callback:()=>null}]});
            if(dc===null||dc===false||dc==="")return;
        }
        const gm=game.users.activeGM;
        if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"peerlessSkill",messageId:card.id,index,dc,userId:game.user.id,gmId:gm.id});
        else await enqueue(()=>applyPeerless(card,index,game.user,dc));
    }catch(error){report(error);}finally{button.disabled=!canPeerless(card,game.user,index);}
}
export function renderPeerless(message,html){
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=[{card:message,root}];for(const summary of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(summary.dataset.messageId);if(card&&!summary.hidden)entries.push({card,root:summary});}
    for(const entry of entries){
        entry.root.querySelectorAll(':scope > .rsa-peerless-actions').forEach(node=>node.remove());if(entry.card.isContentVisible===false)continue;
        const controls=document.createElement("div");controls.className="rsa-attack-actions rsa-peerless-actions";
        for(const[index,roll]of (entry.card.rolls??[]).entries()){
            if(!canPeerless(entry.card,game.user,index))continue;
            const actor=actorFor(entry.card),feature=peerlessFeature(actor),formula=bardicFormula(actor,cuttingResource(actor));
            const button=document.createElement("button");button.type="button";
            const image=document.createElement("img");image.src=feature.img??"icons/svg/d20.svg";image.alt="";
            button.append(image,document.createTextNode("Peerless Skill ("+formula.replace(/^1/,"")+")"+(entry.card.rolls.length>1?" — Roll "+(index+1):"")));
            button.dataset.tooltip="Add your Bardic die to this failed attack or ability check. Spend the use only if it turns the failure into success. No reaction is required.";
            button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();request(entry.card,index,button);});controls.append(button);
        }
        for(const record of Object.values(entry.card.getFlag?.(ID,"peerlessSkill")??{})){const label=document.createElement("span");label.textContent="Peerless Skill: +"+record.total+" — "+(record.spent?"use spent":"use retained");controls.append(label);}
        if(controls.childNodes.length)entry.root.append(controls);
    }
}
function refresh(document){globalThis.Ugmuls55eAutomationChatRefresh?.request("peerless",document);}
Hooks.once("init",()=>game.settings.register(ID,"peerlessSkillAutomation",{name:"Peerless Skill Assistance",hint:"Offer Peerless Skill on the Bard's own failed attacks and ability checks. Preserve existing rolls and spend Bardic Inspiration only if the result becomes a success. Checks without a recorded DC request it before rolling.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",renderPeerless);Hooks.on("updateItem",refresh);
    Hooks.on("updateChatMessage",(card,changes)=>{
        if(!changes.flags?.[ID]?.peerlessSkill&&!changes["flags."+ID+".peerlessSkill"])return;
        if(card.type!=="attack"||card.author?.id!==game.user.id||!card.system.evaluatedTargets?.some(target=>target.isMiss===false))return;
        const origin=typeof card.system.origin==="string"?game.messages.get(card.system.origin):card.system.origin;
        if(origin)globalThis.Ugmuls55eAutomationDamage?.promptDamage(card.getAssociatedActivity(),origin,"attack",card).catch(report);
    });
    game.socket.on("module."+ID,packet=>{
        if(packet?.action==="peerlessSkillError"&&packet.userId===game.user.id){ui.notifications.error(packet.error);refresh();return;}
        if(packet?.action!=="peerlessSkill"||!game.user.isGM||game.users.activeGM?.id!==game.user.id||packet.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId),card=game.messages.get(packet.messageId);if(!user?.active||!card)return;
        enqueue(()=>applyPeerless(card,packet.index,user,packet.dc)).catch(error=>{report(error);game.socket.emit("module."+ID,{action:"peerlessSkillError",userId:user.id,error:error.message});});
    });
});
