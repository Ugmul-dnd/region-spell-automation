import { describeTarget } from "./shared-activity-card.js";
const pendingCards = new WeakSet();

export async function retargetSpellCard(message, targets = game.user.targets) {
    if (message.type !== "usage" || (!game.user.isGM && !message.isOwner) || pendingCards.has(message)) return;
    if (message.getAssociatedItem?.()?.type !== "spell") return;
    const descriptors = [...new Map(Array.from(targets, target => {
        const token = target.document ?? target;
        return [token.uuid, describeTarget(token)];
    })).values()];
    pendingCards.add(message);
    try {
        const cards = [message, ...(message.getAssociatedRolls?.("damage") ?? [])];
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
        if (skipped) ui.notifications.warn("Spell card retargeted. A damage card belongs to another user; ask the GM to retarget it too.");
    } finally { pendingCards.delete(message); }
}

export function addRetargetButton(message, html) {
    hideRemovedTargetSummaries(message, html);
    if (message.type !== "usage" || (!game.user.isGM && !message.isOwner) ||
        message.getAssociatedItem?.()?.type !== "spell") return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root || root.querySelector("[data-rsa-retarget]")) return;
    const controls = root.querySelector(".chat-card > .icon-row:last-child ul") ??
        root.querySelector(".card-buttons") ?? root.querySelector(".chat-card");
    if (!controls) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rsaRetarget = "";
    button.dataset.tooltip = "Replace this card's targets with your currently targeted tokens";
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
Hooks.once("ready", () => Hooks.on("dnd5e.renderChatMessage", addRetargetButton));
