const MODULE_ID="ugmuls-5-5e-automation";

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
    hideUndoneGraze(message,root);
    addMetamagicTags(message,root);
    root.classList.add("rsa-action-colors");
    showPendingSaves(message,root);
    if (["attack","save","damage","healing"].includes(message.type)) root.classList.add(`rsa-roll-${message.type}`);
    for (const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const roll=game.messages.get(summary.dataset.messageId);
        if (["attack","save","damage","healing"].includes(roll?.type)) summary.classList.add(`rsa-roll-${roll.type}`);
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
// Cast-time choices belong to every damage roll; result-time choices belong to the specific roll.
export function metamagicDamageTags(message) {
    if(message?.type!=="damage")return [];
    const chain=[message],seen=new Set([message.id]);let card=message;
    while(card?.system?.origin){const origin=card.system.origin;card=typeof origin==="string"?game.messages.get(origin):origin;if(!card||seen.has(card.id))break;seen.add(card.id);chain.push(card);}
    const flag=key=>chain.map(card=>card.getFlag?.(MODULE_ID,key)).find(Boolean);
    const meta=flag("metamagic")??{},tags=[];
    const targets=chain.find(card=>card.type==="usage")?.system?.targets??[];
    const targetName=id=>targets.find(target=>target.token===id)?.name??"selected target";
    const conversion=flag("transmutedSpell"),element=meta.transmuted??Object.values(conversion??{})[0];
    if(element)tags.push({key:"transmuted",label:"Transmuted",hint:"Damage changed to "+element+"."});
    if(meta.heightened)tags.push({key:"heightened",label:"Heightened",hint:"Disadvantage on saves against this casting: "+targetName(meta.heightened)+"."});
    if(meta.careful?.length)tags.push({key:"careful",label:"Careful",hint:"Protected by Careful Spell: "+meta.careful.map(targetName).join(", ")+"."});
    if(message.getFlag?.(MODULE_ID,"empoweredSpellUsed"))tags.push({key:"empowered",label:"Empowered",hint:"Selected damage dice were rerolled with Empowered Spell."});
    const attackId=message.getFlag?.(MODULE_ID,"damageAttackId");
    const usage=chain.find(card=>card.type==="usage");
    const attack=attackId?game.messages.get(attackId):[...(usage?.getAssociatedRolls?.("attack")??[])].filter(roll=>roll.timestamp<=message.timestamp).sort((a,b)=>b.timestamp-a.timestamp)[0];
    if(attack?.getFlag?.(MODULE_ID,"seekingSpellUsed"))tags.push({key:"seeking",label:"Seeking",hint:"This attack was rerolled with Seeking Spell."});
    const maneuver=message.getFlag?.(MODULE_ID,"battleManeuver")??attack?.getFlag?.(MODULE_ID,"battleManeuver");
    if(maneuver?.relentless)tags.push({key:"relentless",label:"Relentless",hint:"Free d8 used; no Superiority Die was expended."});
    const maneuvers={goading:["Goading Attack","Wisdom save: on failure, disadvantage on attacks against creatures other than the Fighter until the end of the Fighter's next turn."],maneuvering:["Maneuvering Attack","Choose an ally who can see or hear you. They can use their Reaction to move up to half their Speed without provoking Opportunity Attacks from this attack's target."],pushing:["Pushing Attack","Large or smaller target: Strength save. On failure, the GM moves it up to 15 feet directly away. Movement is manual."]};
    if(maneuvers[maneuver?.key]){const [label,hint]=maneuvers[maneuver.key];tags.push({key:"maneuver-"+maneuver.key,label,hint});}
    return tags;
}
export function addMetamagicTags(message,root) {
    const entries=message.type==="damage"?[{message,root}]:[];
    for(const summary of root.querySelectorAll('.card-summary[data-message-id]')){
        const card=game.messages.get(summary.dataset.messageId);if(card?.type==="damage")entries.push({message:card,root:summary});
    }
    for(const entry of entries){
        entry.root.querySelectorAll('[data-rsa-metamagic-tag]').forEach(tag=>tag.remove());
        if(entry.message.isContentVisible===false)continue;
        const face=entry.root.querySelector('.chat-card');
        const properties=face?.querySelector('.icon-row .fa-tag')?.closest('.icon-row')?.querySelector('ul.pills');
        if(!properties)continue;
        for(const tag of metamagicDamageTags(entry.message)){
            const pill=document.createElement('li');pill.className='pill transparent';pill.dataset.rsaMetamagicTag=tag.key;
            pill.dataset.tooltip=tag.hint;
            const label=document.createElement('span');label.className='label';label.textContent=tag.label;pill.append(label);properties.append(pill);
        }
    }
}

export function hideUndoneGraze(message,root) {
    const entries=message.type==="damage"?[{message,root}]:[];
    for(const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const card=game.messages.get(summary.dataset.messageId);if(card)entries.push({message:card,root:summary});
    }
    for(const entry of entries)if(entry.message.getFlag?.(MODULE_ID,"masteryGrazeUndone")) {
        entry.root.hidden=true;entry.root.style.display="none";entry.root.classList.add("rsa-graze-undone");
    }
}

export function showPendingSaves(message,root) {
    if(message.type!=="usage"||message.getAssociatedActivity?.()?.type!=="save")return;
    root.querySelectorAll(".rsa-save-pending").forEach(row=>row.remove());
    const requested=new Set(message.getFlag?.(MODULE_ID,"requestedSaveTargets")??[]);
    if(!requested.size)return;
    const summaries=[...root.querySelectorAll(".card-summary[data-target-uuid]")];
    const outcomes=message.system.outcomes;
    const saves=message.getAssociatedRolls?.("save")??[];
    const targets=message.system.targets??[];
    let previous=root.querySelector(".chat-card");
    if(!previous)return;
    for(const target of targets) {
        const actual=summaries.find(row=>row.dataset.targetUuid===target.token);
        const save=[...saves].reverse().find(roll=>roll.getAssociatedToken?.()?.uuid===target.token);
        const animating=save?._dice3danimating===true;
        if(actual&&!animating){previous=actual;continue;}
        if(!requested.has(target.token)||(outcomes?.has(target.token)&&!animating))continue;
        // Outcomes are known before DSN finishes. Keep the placeholder until
        // this viewer's animation completes, even if native HTML is available.
        if(actual)actual.remove();
        const row=document.createElement("div");
        row.className="card-summary rsa-roll-save rsa-save-pending";
        row.dataset.targetUuid=target.token;
        const section=document.createElement("section");
        section.className="icon-row save-summary";
        const icon=document.createElement("i");icon.className="fa-fw fa-solid fa-dice";icon.setAttribute("aria-hidden","true");
        const list=document.createElement("ul");list.className="pills unlist";
        const name=document.createElement("li");name.className="pill target transparent";name.textContent=target.name??"Target";list.append(name);
        const status=document.createElement("button");status.type="button";status.className="rsa-save-pending-label";status.textContent="---pending---";
        status.dataset.rsaRepromptSave=target.token;
        const token=globalThis.fromUuidSync?.(target.token,{strict:false});
        status.disabled=animating||!(game.user?.isGM||message.author?.id===game.user?.id||token?.actor?.isOwner);
        status.title=animating?"Saving throw dice are still rolling":"Click to reopen this target's saving throw prompt";
        status.addEventListener("click",async event=>{
            event.preventDefault();event.stopPropagation();status.disabled=true;
            try {await globalThis.Ugmuls55eAutomationRepromptSave?.(message,target.token);}
            catch(err){console.error("Ugmuls 5.5e Automation | Save retry failed:",err);ui.notifications.error("Could not reopen the saving throw prompt.");}
            finally {status.disabled=animating;}
        });
        section.append(icon,list,status);row.append(section);previous.after(row);previous=row;
    }
}

export function linkedAttackDamage(attack) {
    const origin=attack.system?.origin;
    const usage=typeof origin === "string" ? game.messages.get(origin) : origin;
    const attacks=usage?.getAssociatedRolls?.("attack") ?? [attack];
    return (usage?.getAssociatedRolls?.("damage") ?? []).filter(damage=>{
        if(damage.getFlag?.(MODULE_ID,"masteryGrazeUndone"))return false;
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
        if (globalThis.Ugmuls55eAutomationDamage) Object.assign(dialog,
            globalThis.Ugmuls55eAutomationDamage.configurePromptDialog("damage",dialog));
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
        catch(err){console.error("Ugmuls 5.5e Automation | Attack damage action failed:",err);ui.notifications.error("Could not open attack damage.");}
        finally {button.disabled=false;}
    });
    if (controls.tagName === "UL") {
        const item=document.createElement("li");item.append(button);
        if (retarget) retarget.closest("li").before(item);else controls.append(item);
    } else if (retarget) retarget.before(button);else controls.append(button);
}
export function followRollMenuExpansion(host,menu) {
    if (typeof ResizeObserver === "undefined") return;
    let observer,timer,scroller;
    const stop=()=>{observer?.disconnect();observer=null;clearTimeout(timer);scroller?.removeEventListener("wheel",stop);};
    const start=()=>{
        stop();
        scroller=host.closest(".chat-scroll") ?? host.closest(".chat-log");
        if (!scroller || scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop>40) return;
        const height=()=>menu.getBoundingClientRect().height+(parseFloat(getComputedStyle(menu).marginTop)||0);
        let previous=height();
        observer=new ResizeObserver(()=>{
            if (!menu.isConnected) {stop();return;}
            const next=height(),growth=next-previous;previous=next;
            if (growth>0) scroller.scrollTop+=growth;
        });
        observer.observe(menu);
        scroller.addEventListener("wheel",stop,{passive:true});
        timer=setTimeout(stop,700);
    };
    host.addEventListener("mouseenter",start);
    host.addEventListener("focusin",start);
}
const chatChangeFollowers=new WeakMap();
export function followChatCardChanges(host) {
    const scroller=host.closest(".chat-scroll")??host.closest(".chat-log");
    if(!scroller||scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop>40)return ()=>{};
    chatChangeFollowers.get(scroller)?.();
    let stopped=false,frame,timer;
    const stop=()=>{
        if(stopped)return;stopped=true;cancelAnimationFrame(frame);clearTimeout(timer);
        for(const event of ["wheel","pointerdown","keydown"])scroller.removeEventListener(event,stop);
        if(chatChangeFollowers.get(scroller)===stop)chatChangeFollowers.delete(scroller);
    };
    const follow=()=>{
        if(stopped)return;
        if(scroller.isConnected===false){stop();return;}
        // Follow the current log, not the old card element: Foundry replaces
        // that element while undo flags and application trays rerender.
        if(scroller.clientHeight>0)scroller.scrollTop=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
        frame=requestAnimationFrame(follow);
    };
    chatChangeFollowers.set(scroller,stop);
    for(const event of ["wheel","pointerdown","keydown"])scroller.addEventListener(event,stop,{passive:true});
    timer=setTimeout(stop,10000);frame=requestAnimationFrame(follow);
    return ()=>{
        if(stopped)return;
        clearTimeout(timer);timer=setTimeout(stop,800); // Include the tray's CSS expansion.
    };
}
function refreshOrigin(message) {
    if (!["attack","save","damage","healing"].includes(message?.type)) return;
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
    globalThis.Ugmuls55eAutomationFollowRollMenu=followRollMenuExpansion;
    globalThis.Ugmuls55eAutomationFollowChatChanges=followChatCardChanges;
    Hooks.on("dnd5e.renderChatMessage",styleActivityCard);
    Hooks.on("updateChatMessage",(card,changes)=>{
        if(card.type==="attack"&&changes.flags?.[MODULE_ID]?.seekingSpellUsed)
            for(const damage of linkedAttackDamage(card))ui.chat?.updateMessage?.(damage);
    });
    Hooks.on("diceSoNiceRollComplete",id=>{
        // DSN clears its animating flag after notifying listeners.
        setTimeout(()=>refreshOrigin(game.messages.get(id)),0);
    });
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
Hooks.on("changeSidebarTab",tab=>scrollOnChatTab(tab).catch(err=>console.error("Ugmuls 5.5e Automation | Chat scroll failed:",err)));
