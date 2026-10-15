import {createEventQueue,isRollAdjustmentLocked,isHealingCard} from "./shared-activity-card.js";
const ID="ugmuls-5-5e-automation",enqueue=createEventQueue(),open=new Set();
const enabled=()=>game.settings.get(ID,"empoweredSpellAutomation")===true;
const originOf=message=>typeof message?.system?.origin==="string"?game.messages.get(message.system.origin):message?.system?.origin;
const actorFor=message=>message?.getAssociatedActor?.()??message?.getAssociatedActivity?.()?.actor;
export const empoweredFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    /^(?:metamagic-)?empowered-spell$/.test(item.identifier??item.system?.identifier??"")||item.type==="feat"&&/^(?:metamagic:\s*)?empowered spell$/i.test(item.name?.trim()??""));
const remaining=item=>Number(item?.system?.uses?.value??(Number(item?.system?.uses?.max)-Number(item?.system?.uses?.spent??0)))||0;
export function sorceryResource(actor,feature=empoweredFeature(actor)) {
    const items=Array.from(actor?.items??[]);
    for(const activity of feature?.system?.activities??[])for(const target of activity.consumption?.targets??[]) {
        if(target.type!=="itemUses")continue;
        const item=actor.items?.get?.(target.target)??items.find(item=>item.uuid===target.target||(item.identifier??item.system?.identifier)===target.target);
        if(item&&remaining(item)>0)return item;
    }
    return items.find(item=>["sorcery-points","font-of-magic"].includes(item.identifier??item.system?.identifier)&&remaining(item)>0)??
        items.find(item=>/^(sorcery points|font of magic)$/i.test(item.name?.trim()??"")&&remaining(item)>0)??null;
}
export const empowerLimit=actor=>Math.max(1,Math.trunc(Number(actor?.system?.abilities?.cha?.mod)||0));
export function spellDamage(message) {
    const item=message?.getAssociatedItem?.()??message?.getAssociatedActivity?.()?.item;
    return message?.type==="damage"&&!isHealingCard(message)&&item?.type==="spell";
}
export function damageDice(rolls) {
    const entries=[];
    const visit=(roll,path)=>{
        for(const [index,term] of (roll.terms??[]).entries()) {
            const key=path+"."+index;
            if(term instanceof foundry.dice.terms.Die&&Number.isInteger(term.faces)&&term.faces>1) {
                for(const [resultIndex,result] of term.results.entries())if(result.active!==false&&!result.discarded&&!result.rerolled)entries.push({key:key+"."+resultIndex,term,result,resultIndex,faces:term.faces,value:result.result,flavor:roll.options?.flavor??roll.options?.type??""});
            } else if(Array.isArray(term.rolls)) {
                for(const [branch,child] of term.rolls.entries())if(term.results?.[branch]?.active!==false)visit(child,key+".p"+branch);
            } else if(term.roll?.terms)visit(term.roll,key+".r");
        }
    };
    rolls.forEach((roll,index)=>visit(roll,String(index)));return entries;
}
const signature=message=>JSON.stringify(message.rolls.map(roll=>roll.toJSON()));
export function canEmpower(message,user=game.user) {
    const actor=actorFor(message),origin=originOf(message);
    return enabled()&&spellDamage(message)&&!!empoweredFeature(actor)&&!!sorceryResource(actor)&&!isRollAdjustmentLocked(message)&&
        !message.getFlag?.(ID,"empoweredSpellUsed")&&!origin?.getFlag?.(ID,"empoweredSpellUsed")&&
        !!(user?.isGM||actor?.testUserPermission?.(user,"OWNER"))&&damageDice(message.rolls??[]).length>0;
}
function refreshTotals(roll) {
    for(const term of roll.terms??[]) {
        if(Array.isArray(term.rolls))for(const [index,child] of term.rolls.entries()) {
            refreshTotals(child);if(term.results?.[index])term.results[index].result=child.total;
        }
        else if(term.roll?.terms)refreshTotals(term.roll);
    }
    roll._total=roll._evaluateTotal();
}
export async function rerollDamageDice(rolls,keys) {
    const copies=rolls.map(roll=>roll.constructor.fromData(foundry.utils.deepClone(roll.toJSON()))),entries=new Map(damageDice(copies).map(entry=>[entry.key,entry]));
    const visual=[];
    for(const key of keys) {
        const entry=entries.get(key);if(!entry)throw Error("A selected damage die is no longer available.");
        const die=new entry.term.constructor({number:1,faces:entry.faces,modifiers:(entry.term.modifiers??[]).filter(modifier=>/^(min|max)\d+$/.test(modifier)),options:foundry.utils.deepClone(entry.term.options??{})});
        await die.evaluate({allowInteractive:false});
        entry.result.active=false;entry.result.rerolled=true;
        entry.term.results[entry.resultIndex]=foundry.utils.deepClone(die.results[0]);
        entry.term.results.push(entry.result);visual.push(die);
    }
    for(const roll of copies){delete roll.options.rsaDamageModes;refreshTotals(roll);}
    return {rolls:copies,visual};
}
export async function applyEmpowered(message,keys,expected,user=game.user) {
    if(!canEmpower(message,user))throw Error("Empowered Spell is unavailable. Undo applied damage first and check your Sorcery Points.");
    const actor=actorFor(message);
    if(!Array.isArray(keys)||!keys.length||keys.length>empowerLimit(actor)||new Set(keys).size!==keys.length||keys.some(key=>typeof key!=="string"))throw Error("Choose between 1 and "+empowerLimit(actor)+" damage dice.");
    if(signature(message)!==expected)throw Error("The damage roll changed. Open Empowered Spell again.");
    const available=new Set(damageDice(message.rolls).map(entry=>entry.key));if(keys.some(key=>!available.has(key)))throw Error("Invalid damage die selection.");
    await message.setFlag(ID,"manualDamageWorkflow",true);
    const result=await rerollDamageDice(message.rolls,keys);
    if(!canEmpower(message,user)||signature(message)!==expected)throw Error("The damage card changed before the reroll could finish.");
    const resource=sorceryResource(actor),spent=Number(resource.system.uses.spent??0);let charged=false,committed=false;
    try {
        await resource.update({"system.uses.spent":spent+1});charged=true;
        if(game.dice3d?.showForRoll) {
            const terms=result.visual.flatMap((die,index)=>index?[new foundry.dice.terms.OperatorTerm({operator:"+"}),die]:[die]);
            const visual=Roll.fromTerms(terms);
            try {await game.dice3d.showForRoll(visual,game.users.get(message.author?.id)??user,true,message.whisper?.length?message.whisper:null,message.blind??false,message.id,message.speaker);}
            catch(error){console.warn("Ugmuls 5.5e Automation | Empowered dice animation failed:",error);}
        }
        if(isRollAdjustmentLocked(message)||signature(message)!==expected)throw Error("The damage card changed during the reroll. The Sorcery Point was refunded.");
        await message.update({rolls:result.rolls,["flags."+ID+".empoweredSpellUsed"]:true,["flags."+ID+".manualDamageWorkflow"]:true});committed=true;
        const origin=originOf(message);
        if(origin&&origin!==message) {
            try {await origin.setFlag(ID,"empoweredSpellUsed",true);await origin.system?.onDescendentRefresh?.(message);await ui.chat?.updateMessage?.(origin);}
            catch(error){console.error("Ugmuls 5.5e Automation | Empowered origin refresh failed:",error);}
        }
    } catch(error){if(charged&&!committed)await resource.update({"system.uses.spent":spent});throw error;}
}
async function pauseAutomation(message) {
    const gm=game.users.activeGM;
    if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"pauseEmpoweredSpell",messageId:message.id,userId:game.user.id,gmId:gm.id});
    else await message.setFlag(ID,"manualDamageWorkflow",true);
}
export async function chooseEmpoweredDice(message) {
    if(open.has(message.id)||!canEmpower(message))return;
    open.add(message.id);
    try {
        await pauseAutomation(message);
        const expected=signature(message),limit=empowerLimit(actorFor(message)),escape=foundry.utils.escapeHTML;
        const content='<p>Select up to '+limit+' dice to reroll. Costs 1 Sorcery Point; you must use the new results.</p><div class="rsa-empowered-dice">'+
            damageDice(message.rolls).map(entry=>'<label><input type="checkbox" value="'+entry.key+'"><span><strong>'+entry.value+'</strong><small>d'+entry.faces+' '+escape(String(entry.flavor))+'</small></span></label>').join('')+'</div><p data-rsa-selected>0 / '+limit+' selected</p>';
        const keys=await foundry.applications.api.DialogV2.wait({window:{title:"Empowered Spell"},position:{width:460},content,rejectClose:false,
            buttons:[{action:"confirm",label:"Confirm",default:true,disabled:true,callback:(event,button,dialog)=>Array.from(dialog.element.querySelectorAll('input:checked'),input=>input.value)},
                {action:"cancel",label:"Cancel",callback:()=>null}],
            render:(event,dialog)=>{
                const inputs=Array.from(dialog.element.querySelectorAll('input[type="checkbox"]'));
                const update=()=>{const count=inputs.filter(input=>input.checked).length;for(const input of inputs)input.disabled=!input.checked&&count>=limit;
                    dialog.element.querySelector('[data-action="confirm"]').disabled=count===0||count>limit;dialog.element.querySelector('[data-rsa-selected]').textContent=count+' / '+limit+' selected';};
                for(const input of inputs)input.addEventListener("change",update);update();
            }});
        if(!Array.isArray(keys)||!keys.length)return;
        const gm=game.users.activeGM;
        if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"applyEmpoweredSpell",messageId:message.id,keys,expected,userId:game.user.id,gmId:gm.id});
        else await enqueue(()=>applyEmpowered(message,keys,expected));
    } finally {open.delete(message.id);}
}
function report(error){console.error("Ugmuls 5.5e Automation | Empowered Spell failed:",error);ui.notifications.error(error.message);}
export function addEmpoweredButton(message,html) {
    if(!enabled())return;
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=message.type==="damage"?[{message,root}]:[];
    for(const summary of root.querySelectorAll('.card-summary[data-message-id]')) {
        const card=game.messages.get(summary.dataset.messageId);if(card?.type==="damage"&&!summary.hidden)entries.push({message:card,root:summary});
    }
    for(const entry of entries) {
        const card=entry.message,actor=actorFor(card);if(!spellDamage(card)||!empoweredFeature(actor)||!card.isContentVisible||!sorceryResource(actor)||!(game.user.isGM||actor.testUserPermission?.(game.user,"OWNER")))continue;
        const old=entry.root.querySelector('[data-rsa-empowered]');if(old){old.disabled=!canEmpower(card);continue;}
        const face=entry.root.querySelector('.chat-card')??entry.root;let controls=face.querySelector('.rsa-damage-actions');
        if(!controls){controls=document.createElement("div");controls.className="rsa-attack-actions rsa-damage-actions";face.append(controls);}
        const button=document.createElement("button");button.type="button";button.dataset.rsaEmpowered="";button.disabled=!canEmpower(card);
        const img=document.createElement("img");img.src=empoweredFeature(actor).img??"icons/svg/dice-target.svg";img.alt="";button.append(img,document.createTextNode("Empowered Spell"));
        button.setAttribute("data-tooltip",isRollAdjustmentLocked(card)?"Undo damage before using Empowered Spell":"Reroll selected damage dice for 1 Sorcery Point. Use the new results.");
        button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();chooseEmpoweredDice(card).catch(report);});controls.append(button);
    }
}
Hooks.once("init",()=>game.settings.register(ID,"empoweredSpellAutomation",{name:"Empowered Spell Dice Rerolls",hint:"Show an Empowered Spell action on spell damage cards. Select up to your Charisma modifier (minimum 1) dice, spend 1 Sorcery Point, and replace those results. Undo applied damage first. One Empowered use per casting.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",addEmpoweredButton);
    Hooks.on("updateItem",item=>{
        const actor=item.actor,feature=empoweredFeature(actor);if(!actor||!feature)return;
        const referenced=Array.from(feature.system?.activities??[]).some(activity=>Array.from(activity.consumption?.targets??[]).some(target=>
            target.type==="itemUses"&&[item.id,item.uuid,item.identifier??item.system?.identifier].includes(target.target)));
        if(!referenced&&!["sorcery-points","font-of-magic"].includes(item.identifier??item.system?.identifier)&&! /^(sorcery points|font of magic)$/i.test(item.name??""))return;
        const chat=ui.chat?.element,root=chat instanceof HTMLElement?chat:chat?.[0];
        const ids=new Set(Array.from(root?.querySelectorAll?.('[data-message-id]')??[],node=>node.dataset.messageId));
        for(const id of ids) {const card=game.messages.get(id);if(card&&actorFor(card)?.uuid===actor.uuid)ui.chat?.updateMessage?.(card);}
    });
    game.socket.on("module."+ID,packet=>{
        if(packet?.action==="empoweredSpellError"&&packet.userId===game.user.id){ui.notifications.error(packet.error);return;}
        if(!["pauseEmpoweredSpell","applyEmpoweredSpell"].includes(packet?.action)||!game.user.isGM||packet.gmId!==game.user.id||game.users.activeGM?.id!==game.user.id)return;
        const card=game.messages.get(packet.messageId),user=game.users.get(packet.userId);if(!user?.active)return;
        if(!canEmpower(card,user)) {
            if(packet.action==="applyEmpoweredSpell")game.socket.emit("module."+ID,{action:"empoweredSpellError",userId:user.id,error:"Empowered Spell is no longer available. Undo applied damage and reopen the picker."});
            return;
        }
        enqueue(()=>packet.action==="pauseEmpoweredSpell"?card.setFlag(ID,"manualDamageWorkflow",true):applyEmpowered(card,packet.keys,packet.expected,user)).catch(error=>{
            report(error);game.socket.emit("module."+ID,{action:"empoweredSpellError",userId:user.id,error:error.message});
        });
    });
});
