import {createEventQueue} from "./shared-activity-card.js";
const MODULE_ID="region-spell-automation";
const enqueue=createEventQueue();
export function isAttackDamage(message) {
    if (message?.type !== "damage" || message.getFlag?.("region-spell-automation","masteryGraze")) return false;
    const activity=message.getAssociatedActivity?.();
    return activity?.type === "attack";
}

export function canAdjustDamage(message,user) {
    return isAttackDamage(message) && Boolean(user?.isGM || message.author?.id === user?.id ||
        message.getAssociatedActor?.()?.testUserPermission?.(user,"OWNER"));
}
function snapshot(roll) {
    const data=foundry.utils.deepClone(roll.toJSON());
    delete data.options.rsaDamageModes;
    return data;
}
export async function changeDamageCritical(roll,critical) {
    if (!(roll instanceof CONFIG.Dice.DamageRoll) || !roll._evaluated) throw Error("Expected an evaluated native damage roll.");
    if (Boolean(roll.options.isCritical) === critical) return roll;
    const policy=roll.options.critical ?? {};
    if (policy.bonusDamage) throw Error("Custom critical bonus-damage formulas are not supported by this toggle.");
    const mode=critical?"critical":"normal",previous=roll.options.isCritical?"critical":"normal";
    const cache=foundry.utils.deepClone(roll.options.rsaDamageModes ?? {});
    cache[previous]=snapshot(roll);
    if (cache[mode]) {
        const restored=roll.constructor.fromData(foundry.utils.deepClone(cache[mode]));restored.options.rsaDamageModes=cache;return restored;
    }
    const adjusted=roll.constructor.fromData(snapshot(roll));
    const multiplier=policy.multiplier ?? 2;
    if (!(multiplier>=1)) throw Error("Invalid critical multiplier.");
    const newDice=[];
    if (policy.powerfulCritical) {
        const terms=[];
        const source=adjusted.terms;
        for (let index=0;index<source.length;index++) {
            const term=source[index];
            if (term instanceof foundry.dice.terms.OperatorTerm) {terms.push(term);continue;}
            if (term instanceof foundry.dice.terms.NumericTerm) {
                if (policy.multiplyNumeric) term.number=critical?term.number*multiplier:term.number/multiplier;
                terms.push(term);continue;
            }
            if (!(term instanceof foundry.dice.terms.Die) || term.modifiers?.length) throw Error("Complex or modified dice are not supported by this toggle.");
            const previous=source[index-1],next=source[index+1];
            if ([previous,next].some(operator=>operator instanceof foundry.dice.terms.OperatorTerm && !["+","-"].includes(operator.operator))) {
                throw Error("Nested or multiplied powerful-critical dice require manual correction.");
            }
            const maximized=term.number*term.faces*(Math.max(1,multiplier-1)+(index===0?(policy.bonusDice ?? 0):0));
            terms.push(term);
            if (critical) {
                const sign=previous instanceof foundry.dice.terms.OperatorTerm?previous.operator:"+";
                const flat=new foundry.dice.terms.NumericTerm({number:maximized,options:{flavor:term.options?.flavor ?? ""}});
                await flat.evaluate();
                terms.push(new foundry.dice.terms.OperatorTerm({operator:sign}),flat);
            } else {
                const flat=source[index+2];
                if (!(next instanceof foundry.dice.terms.OperatorTerm) || !(flat instanceof foundry.dice.terms.NumericTerm) || flat.number !== maximized) {
                    throw Error("Could not identify the maximized critical bonus safely.");
                }
                index+=2; // Remove only the native maximized bonus, preserving other modifiers.
            }
        }
        adjusted.terms=terms;
    } else    for (const [index,term] of adjusted.terms.entries()) {
        if (term instanceof foundry.dice.terms.OperatorTerm) continue;
        if (term instanceof foundry.dice.terms.NumericTerm) {
            if (policy.multiplyNumeric) term.number=critical?term.number*multiplier:term.number/multiplier;
            continue;
        }
        if (!(term instanceof foundry.dice.terms.Die) || term.modifiers?.length) throw Error("Complex or modified dice are not supported by this toggle.");
        const bonus=index===0?(policy.bonusDice ?? 0):0;
        const number=critical ? term.number*multiplier+bonus : (term.number-bonus)/multiplier;
        if (!Number.isInteger(number) || number<1) throw Error("Cannot safely determine the original damage dice count.");
        if (critical) {
            const extra=new term.constructor({number:number-term.number,faces:term.faces,options:foundry.utils.deepClone(term.options)});
            if (extra.number>0) {
                await extra.evaluate({allowInteractive:false});
                term.results.push(...foundry.utils.deepClone(extra.results));newDice.push(extra);
            }
        } else term.results=term.results.slice(0,number);
        term.number=number;
    }
    adjusted.options.isCritical=critical;
    adjusted.options.rsaDamageModes=cache;
    adjusted.resetFormula();adjusted._total=adjusted._evaluateTotal();
    adjusted._rsaExtraDamageDice=newDice;
    return adjusted;
}
export async function updateDamageCritical(message,critical,user=game.user) {
    if (game.settings.get(MODULE_ID,"adjustDamageCritical") !== true) return;
    if (!canAdjustDamage(message,user)) throw Error("You cannot adjust this damage roll.");
    const rolls=[];const dice=[];
    for (const roll of message.rolls ?? []) {
        if (!(roll instanceof CONFIG.Dice.DamageRoll)) {rolls.push(roll);continue;}
        const adjusted=await changeDamageCritical(roll,critical);rolls.push(adjusted);dice.push(...adjusted._rsaExtraDamageDice ?? []);
    }
    await message.update({rolls});
    if (dice.length && game.dice3d?.showForRoll) {
        const visual=Roll.fromTerms(dice.flatMap((die,index)=>index?[new foundry.dice.terms.OperatorTerm({operator:"+"}),die]:[die]));
        await game.dice3d.showForRoll(visual,game.users.get(message.author?.id) ?? user,true,message.whisper?.length?message.whisper:null,message.blind??false,message.id,message.speaker);
    }
    const origin=message.system?.origin;
    if (origin) {await origin.system?.onDescendentRefresh?.(message);await ui.chat?.updateMessage(origin);}
}
function report(err){console.error("Region Spell Automation | Damage mode adjustment failed:",err);ui.notifications.error(err.message);}
export function addDamageModeControls(message,html) {
    if (!game.settings.get(MODULE_ID,"adjustDamageCritical")) return;
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=message.type==="damage"?[{message,root}]:[];
    for(const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const card=game.messages.get(summary.dataset.messageId);
        if(card?.type==="damage"&&!summary.hidden)entries.push({message:card,root:summary});
    }
    for(const entry of entries) {
        if(!entry.message.isContentVisible||!canAdjustDamage(entry.message,game.user)||entry.root.querySelector("[data-rsa-damage-modes]"))continue;
        const roll=entry.message.rolls?.find(roll=>roll instanceof CONFIG.Dice.DamageRoll);
        const dice=entry.root.querySelector(".dice-roll");if(!roll||!dice)continue;
        const host=entry.root===root?dice.parentElement:entry.root;host.classList.add("rsa-save-mode-host");
        const menu=document.createElement("div");menu.className="rsa-save-mode-menu";menu.dataset.rsaDamageModes="";
        for(const [label,critical] of [["NORMAL",false],["CRITICAL",true]]) {
            const button=document.createElement("button");button.type="button";button.textContent=label;
            const active=Boolean(roll.options.isCritical)===critical;button.disabled=active;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
            button.addEventListener("click",event=>{
                event.preventDefault();event.stopPropagation();
                if (game.settings.get(MODULE_ID,"adjustDamageCritical") !== true) return;
                for(const control of menu.querySelectorAll("button"))control.disabled=true;
                const gm=game.users.activeGM;
                if(gm&&gm.id!==game.user.id)game.socket.emit(`module.${MODULE_ID}`,{action:"adjustDamageCritical",messageId:entry.message.id,critical,userId:game.user.id,gmId:gm.id});
                else enqueue(()=>updateDamageCritical(entry.message,critical)).catch(report);
            });menu.append(button);
        }host.append(menu);
        globalThis.RegionSpellAutomationFollowRollMenu?.(host,menu);
    }
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"adjustDamageCritical",{
    name:"Adjust Damage Normal / Critical",hint:"Show Normal/Critical damage controls on hover. Reuses original dice, rolls extra critical dice once, and does not undo applied damage. Attack activity damage only; standard dice and powerful criticals supported.",
    scope:"world",config:true,type:Boolean,default:true,onChange:()=>ui.chat?.render({force:true})
}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",addDamageModeControls);
    game.socket.on(`module.${MODULE_ID}`,packet=>{
        if(packet?.action!=="adjustDamageCritical"||!game.user.isGM||packet.gmId!==game.user.id||game.users.activeGM?.id!==game.user.id||typeof packet.critical!=="boolean"||!game.settings.get(MODULE_ID,"adjustDamageCritical"))return;
        const message=game.messages.get(packet.messageId),user=game.users.get(packet.userId);
        if(!user?.active||!canAdjustDamage(message,user))return;
        enqueue(()=>updateDamageCritical(message,packet.critical,user)).catch(report);
    });
});
