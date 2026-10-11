import { describeTarget, isEligibleTarget } from "./shared-activity-card.js";
const pendingCards = new WeakSet();

function supportsRetarget(message) {
    return ["usage","attack"].includes(message?.type) && (
        ["spell","feat","weapon"].includes(message.getAssociatedItem?.()?.type) ||
        message.getAssociatedActivity?.()?.type === "attack");
}

export async function retargetSpellCard(message, targets = game.user.targets) {
    if (!game.settings.get("region-spell-automation", "retargetActivityCards")) return;
    if (!supportsRetarget(message) || (!game.user.isGM && !message.isOwner) || pendingCards.has(message)) return;
    const descriptors = [...new Map(Array.from(targets).filter(isEligibleTarget).map(target => {
        const token = target.document ?? target;
        return [token.uuid, describeTarget(token)];
    })).values()];
    pendingCards.add(message);
    try {
        let cards;
        if (message.type === "attack") {
            const origin=message.system?.origin;
            const usage=typeof origin === "string" ? game.messages.get(origin) : origin;
            const attacks=usage?.getAssociatedRolls?.("attack") ?? [message];
            const damage=(usage?.getAssociatedRolls?.("damage") ?? message.getAssociatedRolls?.("damage") ?? []).filter(card=>{
                const source=card.getFlag?.("region-spell-automation","damageAttackId");
                if (source) return source === message.id;
                // Native/manual damage may lack our explicit attack flag.
                // Use the most recent attack preceding that damage roll.
                if (!Number.isFinite(card.timestamp) || !Number.isFinite(message.timestamp)) return attacks.length === 1;
                const preceding=[...attacks].filter(attack=>attack.timestamp <= card.timestamp)
                    .sort((a,b)=>b.timestamp-a.timestamp)[0];
                return preceding?.id === message.id;
            });
            cards=[message, ...damage];
        } else {
            cards=[message, ...(message.getAssociatedRolls?.("attack") ?? []),
                ...(message.getAssociatedRolls?.("damage") ?? [])];
        }
        cards=[...new Set(cards)];
        let skipped = false;
        for (const card of cards) {
            if (!game.user.isGM && !card.isOwner) { skipped = true; continue; }
            if (card._targetState) {
                card._targetState.mode = "targeted";
                card._targetState.checked?.clear?.();
            }
            // Only replace target descriptors. Keep rolls, save outcomes,
            // resource use, and damage-application records intact.
            await card.update({ "system.targets": descriptors,
                "flags.region-spell-automation.retargeted": true }, { rsaRetarget: true });
        }
        if (skipped) ui.notifications.warn("Card retargeted. A linked roll belongs to another user; ask the GM to refresh it too.");
    } finally { pendingCards.delete(message); }
}

export function addRetargetButton(message, html) {
    hideRemovedTargetSummaries(message, html);
    if (!game.settings.get("region-spell-automation", "retargetActivityCards")) return;
    if (!supportsRetarget(message) || (!game.user.isGM && !message.isOwner)) return;
    if (message.type === "usage" && message.getAssociatedActivity?.()?.type === "attack" &&
        game.settings.get("region-spell-automation","simplifyAttackCards") === true) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const existingButton=root.querySelector("[data-rsa-retarget]");
    if (existingButton && message.type !== "attack") return;
    let controls;
    if (message.type === "attack") {
        controls=root.querySelector(".rsa-attack-actions");
        if (!controls) {
            const face=root.querySelector(".chat-card") ?? root.querySelector(".message-content");
            if (!face) return;
            controls=document.createElement("div");
            controls.className="rsa-attack-actions";
            face.append(controls);
        }
    } else {
        controls=root.querySelector(".chat-card > .icon-row:last-child ul") ??
            root.querySelector(".card-buttons") ?? root.querySelector(".chat-card");
    }
    if (!controls) return;
    if (existingButton) {
        const oldEntry=existingButton.closest("li");
        controls.append(existingButton);
        if (oldEntry && !oldEntry.children.length) oldEntry.remove();
        return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rsaRetarget = "";
    button.dataset.tooltip = "Replace targets with your current map targets and refresh attack results using current AC";
    button.innerHTML = '<i class="fa-solid fa-bullseye" aria-hidden="true"></i> Retarget';
    button.addEventListener("click", async event => {
        event.preventDefault(); event.stopPropagation();
        button.disabled = true;
        try { await retargetSpellCard(message); }
        catch (err) {
            console.error("Region Spell Automation | Could not retarget spell card:", err);
            ui.notifications.error("Could not retarget the spell card. Check F12 console.");
        } finally { button.disabled = false; }
    });
    if (controls.tagName === "UL") {
        const entry = document.createElement("li");
        entry.append(button);
        controls.append(entry);
    } else controls.append(button);
}

export function hideRemovedTargetSummaries(message, html) {
    if (!message.getFlag?.("region-spell-automation", "retargeted")) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const targets = new Set((message.system.targets ?? []).map(target => target.token).filter(Boolean));
    for (const summary of root.querySelectorAll(".card-summary[data-target-uuid]")) {
        // Keep the save roll associated with its original card. Only its inline
        // presentation is hidden, and retargeting it back restores the summary.
        summary.hidden = !targets.has(summary.dataset.targetUuid);
        summary.style.display = summary.hidden ? "none" : "";
    }
}

// Core renderChatMessageHTML fires before D&D5e injects its usage-card template.
// Use the system's completed-card hook so the action row exists.
Hooks.once("init", () => game.settings.register("region-spell-automation", "retargetActivityCards", {
    name: "Show Retarget on Spell, Feature and Attack Cards",
    hint: "Allow GMs and card owners to replace an activity card's targets with their current map targets. Attack results refresh against current AC; previous dice rolls remain unchanged.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => ui.chat?.render({ force: true })
}));
Hooks.once("ready", () => Hooks.on("dnd5e.renderChatMessage", addRetargetButton));
