import {describeTarget} from "./shared-activity-card.js";
const MODULE_ID="region-spell-automation";
const busy=new Set();

export function shieldActivity(actor) {
    for (const item of actor?.items ?? []) {
        if (item.type !== "spell" || !["shield"].includes(item.system.identifier ?? item.name?.toLowerCase())) continue;
        if (item.system.canPrepare && !item.system.prepared) continue;
        const mode=item.system.method ?? item.system.preparation?.mode;
        const free=["atwill","innate"].includes(mode);
        const slots=Object.values(actor.system?.spells ?? {}).some(slot=>slot.value>0);
        const uses=item.system.uses;
        const availableUses=Number(uses?.value ?? (Number(uses?.max)-Number(uses?.spent ?? 0)));
        if (!free && !slots && !(availableUses>0)) continue;
        if (mode === "innate" && Number(uses?.max)>0 && !(availableUses>0)) continue;
        const activities=Array.from(item.system.activities?.values?.() ?? item.system.activities ?? []);
        const reaction=activities.find(activity=>activity.activation?.type === "reaction" && activity.type === "utility");
        if (reaction) return reaction;
    }
    return null;
}

export async function refreshShieldAttack(attack) {
    if (!attack || attack.type !== "attack" || (!game.user.isGM && !attack.isOwner)) return;
    const targets=[];
    for (const descriptor of attack.system.targets ?? []) {
        const token=descriptor.token ? await fromUuid(descriptor.token) : null;
        targets.push(token?.actor ? describeTarget(token) : descriptor);
    }
    await attack.update({"system.targets":targets, [`flags.${MODULE_ID}.shieldRechecked`]:true},{rsaRetarget:true});
}

export function damageMissedAfterShield(damage) {
    if (damage?.type !== "damage") return false;
    if(damage.getFlag?.(MODULE_ID,"masteryGraze"))return false;
    const origin=damage.system?.origin;
    const card=typeof origin === "string" ? game.messages.get(origin) : origin;
    if (!card) return false;
    const explicit=damage.getFlag?.(MODULE_ID,"damageAttackId");
    const attacks=card.type === "attack" ? [card] : card.getAssociatedRolls?.("attack") ?? [];
    const attack=explicit ? game.messages.get(explicit) : [...attacks]
        .filter(attack=>attack.timestamp <= damage.timestamp)
        .sort((a,b)=>b.timestamp-a.timestamp)[0];
    if (!attack?.getFlag?.(MODULE_ID,"shieldRechecked")) return false;
    const targets=attack.system.evaluatedTargets ?? [];
    return targets.length>0 && targets.every(target=>target.isMiss === true);
}

export function hideShieldMissDamage(message, html) {
    const root=html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    if (message.type === "damage") {
        const hide=damageMissedAfterShield(message);
        if (hide) {root.hidden=true;root.dataset.rsaShieldHidden="true";}
        else if (root.dataset.rsaShieldHidden) {root.hidden=false;delete root.dataset.rsaShieldHidden;}
    }
    for (const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const damage=game.messages.get(summary.dataset.messageId);
        if (damage?.type !== "damage") continue;
        if (damageMissedAfterShield(damage)) {
            summary.hidden=true;summary.style.display="none";summary.dataset.rsaShieldHidden="true";
        } else if (summary.dataset.rsaShieldHidden) {
            summary.hidden=false;summary.style.display="";delete summary.dataset.rsaShieldHidden;
        }
    }
}
export function addShieldButtons(message, html) {
    if (game.settings.get(MODULE_ID,"showShieldReaction") !== true) return;
    const root=html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const entries=message.type === "attack" ? [{message,root}] : [];
    for (const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const attack=game.messages.get(summary.dataset.messageId);
        if (attack?.type === "attack" && !summary.hidden) entries.push({message:attack,root:summary});
    }
    for (const entry of entries) {
        if (!entry.message.isContentVisible) continue;
        for (const pill of entry.root.querySelectorAll("target-pill")) {
            if (pill.hasAttribute("data-miss")) continue;
            const uuid=pill.querySelector("datalist option")?.value;
            if (!uuid || pill.parentElement.querySelector("[data-rsa-shield]")) continue;
            const token=fromUuidSync(uuid,{strict:false}),actor=token?.actor;
            if (!actor || (!game.user.isGM && !actor.isOwner)) continue;
            if (actor.statuses?.has("incapacitated") || actor.statuses?.has("dead") || actor.statuses?.has("unconscious")) continue;
            const activity=shieldActivity(actor);
            if (!activity) continue;
            const button=document.createElement("button");
            button.type="button";button.dataset.rsaShield="";
            button.className="unbutton";button.style.cssText="margin-left:4px;width:22px;height:22px;flex:0 0 22px;";
            button.dataset.tooltip="Cast Shield reaction, then refresh this attack";
            button.setAttribute("aria-label","Cast Shield reaction");
            button.innerHTML='<i class="fa-solid fa-shield" aria-hidden="true"></i>';
            button.addEventListener("click",async event=>{
                event.preventDefault();event.stopPropagation();
                const key=`${entry.message.id}:${uuid}`;
                if (busy.has(key)) return;
                busy.add(key);button.disabled=true;
                try {
                    const current=shieldActivity(actor);
                    if (!current) return;
                    const results=await current.use({}, {}, {data:{flags:{[MODULE_ID]:{shieldReactionAttack:entry.message.id}}}});
                    if (results?.message) await refreshShieldAttack(entry.message);
                } catch(err) {
                    console.error("Region Spell Automation | Shield reaction failed:",err);
                    ui.notifications.error("Could not cast Shield. Use the actor's spell sheet.");
                } finally {busy.delete(key);button.disabled=false;}
            });
            if (!pill.parentElement.querySelector("[data-rsa-shield]")) pill.parentElement.append(button);
        }
    }
}

Hooks.once("init",()=>game.settings.register(MODULE_ID,"showShieldReaction",{
    name:"Effect Automation: Show Shield Reaction",
    hint:"Show a manual Shield casting icon on hit results for owned actors with an available Shield reaction. Native casting handles resources; no automatic reaction is used.",
    scope:"world",config:true,type:Boolean,default:true
}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",(message,html)=>{
        hideShieldMissDamage(message,html);
        try {addShieldButtons(message,html);} catch(err) {console.error("Region Spell Automation | Shield controls failed:",err);}
    });
    Hooks.on("updateChatMessage",(message,changes)=>{
        if (message.type !== "attack" || !message.getFlag?.(MODULE_ID,"shieldRechecked")) return;
        if (!Object.hasOwn(changes,"system.targets") && !changes.system?.targets && !changes.rolls) return;
        const origin=message.system.origin;
        const card=typeof origin === "string" ? game.messages.get(origin) : origin;
        for (const damage of card?.getAssociatedRolls?.("damage") ?? []) ui.chat?.updateMessage(damage);
        if (card) ui.chat?.updateMessage(card);
    });
    Hooks.on("regionSpellAutomation.buffEffectsApplied",(cast)=>{
        const id=cast.getFlag(MODULE_ID,"shieldReactionAttack");
        if (id) refreshShieldAttack(game.messages.get(id)).catch(console.error);
    });
});
