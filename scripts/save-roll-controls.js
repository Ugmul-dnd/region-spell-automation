import { createEventQueue } from "./shared-activity-card.js";
const MODULE_ID = "region-spell-automation";
const channel = `module.${MODULE_ID}`;
const enqueue = createEventQueue();

export function canAdjustSave(message, user) {
    return message?.type === "save" && Boolean(user?.isGM || message.author?.id === user?.id ||
        message.getAssociatedActor?.()?.testUserPermission?.(user, "OWNER"));
}

export async function changeSaveMode(roll, mode) {
    if (![1, 0, -1].includes(mode)) throw new Error("Invalid saving throw roll mode.");
    if (!(roll instanceof CONFIG.Dice.D20Roll) || !roll.d20 || !roll._evaluated) throw new Error("Expected a completed native d20 saving throw.");
    if ((roll.options.advantageMode ?? 0) === mode) return roll;
    // Deserialize to preserve every evaluated bonus die and avoid modifying the
    // original roll object before the message update succeeds.
    const adjusted = roll.constructor.fromData(foundry.utils.deepClone(roll.toJSON()));
    const pool = foundry.utils.deepClone(roll.options.rsaSaveDicePool ??
        roll.d20.results.filter(result => !result.rerolled && Number.isFinite(result.result)));
    if (!pool.length) throw new Error("No original d20 result is available.");
    const count = mode === 0 ? 1 : mode === 1 && roll.options.elvenAccuracy ? 3 : 2;
    if (pool.length < count) {
        const extra = new CONFIG.Dice.D20Die({ number: count - pool.length, faces: 20 });
        extra.applyFlag("halflingLucky", roll.options.halflingLucky === true);
        extra.applyRange({ minimum: roll.options.reliableTalent ? Math.max(10, roll.options.minimum ?? 10) : roll.options.minimum,
            maximum: roll.options.maximum });
        await extra.evaluate({ allowInteractive: false });
        const newResults = extra.results.filter(result => !result.rerolled && Number.isFinite(result.result));
        pool.push(...newResults);
        adjusted._rsaNewD20Results = foundry.utils.deepClone(newResults);
    }
    const candidates = pool.slice(0, count);
    const winningValue = mode === -1 ? Math.min(...candidates.map(result => result.result)) : Math.max(...candidates.map(result => result.result));
    const winner = mode === 0 ? 0 : candidates.findIndex(result => result.result === winningValue);
    adjusted.options.advantageMode = mode;
    adjusted.options.advantage = mode === 1;
    adjusted.options.disadvantage = mode === -1;
    adjusted.options.rsaSaveDicePool = pool;
    adjusted.d20.applyAdvantage(mode);
    adjusted.d20.number = count;
    adjusted.d20.results = candidates.map((result, index) => ({ ...result, active: index === winner, discarded: index !== winner }));
    adjusted.resetFormula();
    adjusted._total = adjusted._evaluateTotal();
    return adjusted;
}

export async function updateSaveMode(message, mode, index, user = game.user) {
    if (!canAdjustSave(message, user)) throw new Error("You cannot adjust this saving throw.");
    const roll = message.rolls?.[index];
    const adjusted = await changeSaveMode(roll, mode);
    if (adjusted === roll) return;
    const rolls = [...message.rolls];
    rolls[index] = adjusted;
    let flavor = message.flavor ?? "";
    const labels = ["Advantage", "Disadvantage", game.i18n.localize("DND5E.Advantage"), game.i18n.localize("DND5E.Disadvantage")];
    for (const label of labels) flavor = flavor.replaceAll(` (${label})`, "");
    if (mode !== 0) flavor += ` (${game.i18n.localize(mode === 1 ? "DND5E.Advantage" : "DND5E.Disadvantage")})`;
    await message.update({ rolls, flavor });
    await animateNewSaveDice(message, adjusted._rsaNewD20Results, user);
}

export async function animateNewSaveDice(message, results, user = game.user) {
    if (!results?.length || !game.dice3d?.showForRoll) return;
    try {
        const Die = CONFIG.Dice.terms?.d ?? foundry.dice.terms.Die;
        const die = new Die({ faces: 20, number: results.length,
            results: results.map(result => ({ result: result.result, active: true })) });
        die._evaluated = true;
        const visualRoll = Roll.fromTerms([die]);
        const roller = game.users?.get(message.author?.id) ?? message.author ?? user;
        await game.dice3d.showForRoll(visualRoll, roller, true,
            message.whisper?.length ? message.whisper : null, message.blind ?? false, message.id, message.speaker);
    } catch (err) {
        // The actual save is already updated; optional animation failure must
        // not retry the adjustment or generate another die.
        console.warn("Region Spell Automation | Save adjusted, but dice animation failed:", err);
    }
}

function requestChange(message, mode, index) {
    if (!game.settings.get(MODULE_ID, "adjustSavingThrowAdvantage")) return;
    if (!canAdjustSave(message, game.user)) return;
    const gm = game.users.activeGM;
    if (gm && gm.id !== game.user.id) {
        game.socket.emit(channel, { action: "adjustSaveMode", messageId: message.id, mode, index, userId: game.user.id, gmId: gm.id });
    } else enqueue(() => updateSaveMode(message, mode, index)).catch(reportError);
}

function reportError(err) {
    console.error("Region Spell Automation | Save advantage adjustment failed:", err);
    ui.notifications.error("Could not adjust the saving throw. Check F12 console.");
}

export async function refreshSaveSummary(message, changes) {
    if (message.type !== "save" || !Object.hasOwn(changes, "rolls") || Object.hasOwn(changes, "system")) return;
    const origin = message.system?.origin;
    if (!origin) return;
    // D&D5e refreshes inline summaries for system changes, but a rolls-only
    // update also needs to invalidate its cached save outcomes on every client.
    await origin.system?.onDescendentRefresh?.(message);
    await ui.chat?.updateMessage(origin);
}

export function addSaveControls(message, html) {
    if (!game.settings.get(MODULE_ID, "adjustSavingThrowAdvantage")) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const entries = [];
    if (message.type === "save") entries.push({ message, root });
    for (const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const save = game.messages.get(summary.dataset.messageId);
        if (save?.type === "save" && !summary.hidden) entries.push({ message: save, root: summary });
    }
    for (const entry of entries) {
        if (!canAdjustSave(entry.message, game.user) || !entry.message.isContentVisible) continue;
        const index = entry.message.rolls?.findIndex(roll => roll instanceof CONFIG.Dice.D20Roll) ?? -1;
        if (index < 0 || entry.root.querySelector("[data-rsa-save-modes]")) continue;
        const rollElement = entry.root.querySelector(".dice-roll");
        if (!rollElement) continue;
        // Do not duplicate controls if Tweaks already supplies them for this save.
        if (entry.root.querySelector(".nd5t-retro-advantage")) continue;
        const host = entry.root === root ? rollElement.parentElement : entry.root;
        host.classList.add("rsa-save-mode-host");
        const menu = document.createElement("div");
        menu.className = "rsa-save-mode-menu";
        menu.dataset.rsaSaveModes = "";
        for (const [label, mode] of [["ADV", 1], ["NORMAL", 0], ["DISADV", -1]]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            const active = (entry.message.rolls[index].options.advantageMode ?? 0) === mode;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
            button.disabled = active;
            button.addEventListener("click", event => {
                event.preventDefault(); event.stopPropagation();
                for (const control of menu.querySelectorAll("button")) control.disabled = true;
                requestChange(entry.message, mode, index);
            });
            menu.append(button);
        }
        host.append(menu);
    }
}

Hooks.once("init", () => game.settings.register(MODULE_ID, "adjustSavingThrowAdvantage", {
    name: "Adjust Saving Throw Advantage",
    hint: "Expand saving throw cards on hover to show ADV / NORMAL / DISADV controls. Reuses existing dice; does not undo applied damage.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => ui.chat?.render({ force: true })
}));

Hooks.once("ready", () => {
    Hooks.on("dnd5e.renderChatMessage", addSaveControls);
    Hooks.on("updateChatMessage", (message, changes) => refreshSaveSummary(message, changes).catch(reportError));
    game.socket.on(channel, packet => {
        if (!game.settings.get(MODULE_ID, "adjustSavingThrowAdvantage")) return;
        if (packet?.action !== "adjustSaveMode" || packet.gmId !== game.user.id || !game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
        const message = game.messages.get(packet.messageId), user = game.users.get(packet.userId);
        if (!user?.active || !canAdjustSave(message, user) || ![1, 0, -1].includes(packet.mode) || !Number.isInteger(packet.index) || packet.index < 0) return;
        enqueue(() => updateSaveMode(message, packet.mode, packet.index, user)).catch(reportError);
    });
});
