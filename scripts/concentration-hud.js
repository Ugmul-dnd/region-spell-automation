const pendingActors = new WeakSet();

export function canEndConcentration(actor) {
    return Boolean(actor?.isOwner && actor.concentration?.effects?.size &&
        typeof actor.endConcentration === "function");
}

export async function endTokenConcentration(actor) {
    if (!game.settings.get("region-spell-automation", "showConcentrationHud")) return;
    if (!canEndConcentration(actor) || pendingActors.has(actor)) return;
    pendingActors.add(actor);
    try {
        // Use the system workflow so dnd5e.endConcentration and Region cleanup run.
        await actor.endConcentration();
    } finally {
        pendingActors.delete(actor);
    }
}

export function addConcentrationControl(hud, html) {
    if (!game.settings.get("region-spell-automation", "showConcentrationHud")) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const actor = hud.actor ?? hud.document?.actor;
    if (!root || !canEndConcentration(actor)) return;
    if (root.querySelector("[data-rsa-end-concentration]")) return;
    const column = root.querySelector(".col.right");
    if (!column) return;
    const names = Array.from(actor.concentration.items ?? [], item => item.name).join(", ");
    const label = names ? `End concentration: ${names}` : "End concentration";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-icon";
    button.dataset.rsaEndConcentration = "";
    button.dataset.tooltip = label;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.style.position = "relative";
    const icon = document.createElement("img");
    icon.src = "systems/dnd5e/icons/svg/statuses/concentrating.svg";
    icon.alt = "";
    const cancel = document.createElement("i");
    cancel.className = "fa-solid fa-xmark";
    cancel.setAttribute("aria-hidden", "true");
    cancel.style.cssText = "position:absolute;right:2px;bottom:2px;color:#ff6666;font-size:12px;";
    button.append(icon, cancel);
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        try {
            await endTokenConcentration(actor);
            if (hud.rendered && (hud.actor ?? hud.document?.actor) === actor) hud.render({ force: true });
        } catch (err) {
            console.error("Region Spell Automation | Could not end concentration:", err);
            ui.notifications.error("Could not end concentration. Check F12 console.");
        } finally {
            button.disabled = false;
        }
    });
    column.append(button);
}

Hooks.once("init", () => game.settings.register("region-spell-automation", "showConcentrationHud", {
    name: "Show End Concentration on Token HUD",
    hint: "Show the concentration-ending control when a GM or owner right-clicks a concentrating token.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => { const hud = globalThis.canvas?.hud?.token; if (hud?.rendered) hud.render({ force: true }); }
}));

Hooks.once("ready", () => {
    if (game.system.id !== "dnd5e") return;
    Hooks.on("renderTokenHUD", addConcentrationControl);
    const refresh = effect => {
        const hud = canvas?.hud?.token;
        const actor = hud?.actor ?? hud?.document?.actor;
        if (hud?.rendered && actor && effect.parent === actor) hud.render({ force: true });
    };
    for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) Hooks.on(hook, refresh);
});
