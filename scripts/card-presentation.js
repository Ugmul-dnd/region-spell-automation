const MODULE_ID="region-spell-automation";

export function attackCardProgress(message) {
    if (message?.type !== "usage" || message.getAssociatedActivity?.()?.type !== "attack") return null;
    return {
        attack: (message.getAssociatedRolls?.("attack") ?? []).length>0,
        damage: (message.getAssociatedRolls?.("damage") ?? []).length>0
    };
}

export function styleActivityCard(message,html) {
    const root=html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    root.classList.add("rsa-action-colors");
    if (["attack","save","damage"].includes(message.type)) root.classList.add(`rsa-roll-${message.type}`);
    for (const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const roll=game.messages.get(summary.dataset.messageId);
        if (["attack","save","damage"].includes(roll?.type)) summary.classList.add(`rsa-roll-${roll.type}`);
    }
    if (game.settings.get(MODULE_ID,"simplifyAttackCards") !== true) return;
    const progress=attackCardProgress(message);
    if (!progress) {
        if (message.type === "attack") addAttackDamageButton(message,root);
        return;
    }
    const baseFace=root.querySelector(".chat-card");
    for (const action of ["rollAttack","rollDamage"]) {
        if (!(action === "rollAttack" ? progress.attack : progress.damage)) continue;
        // Only the base activity's controls; inline result controls stay intact.
        for (const button of baseFace?.querySelectorAll(`[data-action="${action}"], [data-forward-action="${action}"]`) ?? []) {
            const entry=button.closest("li") ?? button;
            entry.hidden=true;entry.style.display="none";
        }
    }
    baseFace?.querySelectorAll("[data-rsa-retarget]").forEach(button=>button.remove());
    if (progress.attack) {
        // Preserve every document and its links; this is chat presentation only.
        // If Foundry is showing inline roll summaries, keep the outer message
        // visible so hiding its base face does not hide the actual results.
        const summaries=root.querySelectorAll(".card-summary[data-message-id]");
        if (summaries.length) {
            const face=root.querySelector(".chat-card");
            if (face) {face.hidden=true;face.style.display="none";}
        } else {
            root.hidden=true;root.dataset.rsaProcessedAttack="true";
            root.classList.add("rsa-processed-attack");
            root.style.display="none";
        }
    }
}

export function linkedAttackDamage(attack) {
    const origin=attack.system?.origin;
    const usage=typeof origin === "string" ? game.messages.get(origin) : origin;
    const attacks=usage?.getAssociatedRolls?.("attack") ?? [attack];
    return (usage?.getAssociatedRolls?.("damage") ?? []).filter(damage=>{
        const id=damage.getFlag?.(MODULE_ID,"damageAttackId");
        if (id) return id === attack.id;
        const preceding=[...attacks].filter(roll=>roll.timestamp <= damage.timestamp).sort((a,b)=>b.timestamp-a.timestamp)[0];
        return preceding?.id === attack.id;
    });
}

export async function rollAttackCardDamage(attack,event) {
    const origin=attack.system?.origin;
    const usage=typeof origin === "string" ? game.messages.get(origin) : origin;
    const activity=usage?.getAssociatedActivity?.();
    if (!usage || !activity || (!game.user.isGM && !usage.isOwner) || linkedAttackDamage(attack).length) return;
    const hook=Hooks.on("dnd5e.preRollDamageV2",(config,dialog,data)=>{
        if (config.subject?.uuid !== activity.uuid) return;
        data.data ??= {};data.data.system ??= {};data.data.flags ??= {};
        data.data.system.origin=usage.id;
        data.data.system.targets=attack.system.targets;
        data.data.flags[MODULE_ID]={...data.data.flags[MODULE_ID],damageAttackId:attack.id};
        if (globalThis.RegionSpellAutomationDamage) Object.assign(dialog,
            globalThis.RegionSpellAutomationDamage.configurePromptDialog("damage",dialog));
        Hooks.off("dnd5e.preRollDamageV2",hook);
    });
    try {await activity.onChatAction(event,{dataset:{action:"rollDamage"},disabled:false},usage);}
    finally {Hooks.off("dnd5e.preRollDamageV2",hook);}
}

function addAttackDamageButton(attack,root) {
    if ((!game.user.isGM && !attack.isOwner) || !attack.isContentVisible || linkedAttackDamage(attack).length ||
        root.querySelector("[data-rsa-attack-damage]")) return;
    const activity=attack.getAssociatedActivity?.();
    if (!activity?.damage?.parts?.length) return;
    const retarget=root.querySelector("[data-rsa-retarget]");
    let controls=root.querySelector(".rsa-attack-actions");
    if (!controls) {
        const face=root.querySelector(".chat-card");
        if (!face) return;
        controls=document.createElement("div");controls.className="rsa-attack-actions";
        face.append(controls);
    }
    if (!controls) return;
    const button=document.createElement("button");
    button.type="button";button.dataset.rsaAttackDamage="";
    button.dataset.tooltip="Roll damage for this attack";button.setAttribute("aria-label","Roll Damage");
    button.style.color="#ed6262";
    button.innerHTML='<i class="fa-solid fa-burst" aria-hidden="true"></i> Damage';
    button.addEventListener("click",async event=>{
        event.preventDefault();event.stopPropagation();if(button.disabled)return;
        button.disabled=true;
        try {await rollAttackCardDamage(attack,event);}
        catch(err){console.error("Region Spell Automation | Attack damage action failed:",err);ui.notifications.error("Could not open attack damage.");}
        finally {button.disabled=false;}
    });
    if (controls.tagName === "UL") {
        const item=document.createElement("li");item.append(button);
        if (retarget) retarget.closest("li").before(item);else controls.append(item);
    } else if (retarget) retarget.before(button);else controls.append(button);
}
function refreshOrigin(message) {
    if (!["attack","damage"].includes(message?.type)) return;
    const origin=message.system?.origin;
    const card=typeof origin === "string" ? game.messages.get(origin) : origin;
    if (card?.type === "usage") setTimeout(()=>{
        ui.chat?.updateMessage(card);
        if (message.type === "damage") for (const attack of card.getAssociatedRolls?.("attack") ?? []) ui.chat?.updateMessage(attack);
    },0);
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"simplifyAttackCards",{
    name:"Simplify Processed Attack Cards",
    hint:"Hide the base card once an attack roll exists. Damage and Retarget stay on the attack roll; Damage hides once linked damage exists. Roll messages and damage history are retained.",
    scope:"world",config:true,type:Boolean,default:true,onChange:()=>ui.chat?.render({force:true})
}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",styleActivityCard);
    for (const hook of ["createChatMessage","updateChatMessage","deleteChatMessage"]) Hooks.on(hook,refreshOrigin);
});

let chatTabScrollRequest=0;
export async function scrollOnChatTab(tab) {
    const request=++chatTabScrollRequest;
    if (tab !== ui.chat || game.settings.get(MODULE_ID,"scrollChatOnOpen") !== true) return;
    // Sidebar applies its active-tab class after emitting the hook. Wait for
    // layout, then include images so late image sizing cannot leave a gap.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if (request !== chatTabScrollRequest) return;
    await ui.chat.scrollBottom({waitImages:true});
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"scrollChatOnOpen",{
    name:"Scroll Chat to Bottom on Open",hint:"When switching to the Chat tab, scroll to the newest message after the log becomes visible.",
    scope:"client",config:true,type:Boolean,default:true
}));
Hooks.on("changeSidebarTab",tab=>scrollOnChatTab(tab).catch(err=>console.error("Region Spell Automation | Chat scroll failed:",err)));
