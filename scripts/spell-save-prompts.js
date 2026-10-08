import { sendSavePrompt } from "./save-prompts.js";
const MODULE_ID = "region-spell-automation";
const casts = new Map();
const sentTargets = new Map();

export async function promptCastSaves(activity, results) {
    if (game.settings.get(MODULE_ID, "promptForSaveOnSpellCasts") !== true) return;
    const message = results?.message;
    if (activity?.type !== "save" || activity.item?.type !== "spell" || !message?.id) return;
    if (message.author?.id !== game.user.id || message.getFlag?.(MODULE_ID, "regionTriggered")) return;
    const promptedTokens = sentTargets.get(message.id) ?? new Set();
    sentTargets.set(message.id, promptedTokens);
    for (const descriptor of message.system.targets ?? []) {
        let token = descriptor.token ? await fromUuid(descriptor.token) : null;
        if (!token?.actor && descriptor.actor) {
            const actor = await fromUuid(descriptor.actor);
            token = actor?.token?.document ?? actor?.token;
            if (!token?.actor) {
                const tokens = actor?.getActiveTokens?.(false, true) ?? [];
                if (tokens.length === 1) token = tokens[0].document ?? tokens[0];
            }
        }
        if (!token?.actor || !token.uuid) {
            console.warn("Region Spell Automation | Could not resolve spell target to a unique token.", descriptor.name ?? descriptor.actor);
            continue;
        }
        if (promptedTokens.has(token.uuid)) continue;
        promptedTokens.add(token.uuid);
        await sendSavePrompt(message, token, "spell");
    }
}

export function scheduleCastSaves(activity, results) {
    const message = results?.message;
    if (activity?.type !== "save" || activity.item?.type !== "spell" || !message?.id ||
        message.author?.id !== game.user.id || message.getFlag?.(MODULE_ID, "regionTriggered")) return;
    const prior = casts.get(message.id);
    if (prior?.timer) clearTimeout(prior.timer);
    const state = { activity, message };
    casts.set(message.id, state);
    // Other postUseActivity hooks can update targets asynchronously. Wait for
    // a quiet window and also reschedule whenever the recorded targets change.
    state.timer = setTimeout(() => {
        state.timer = null;
        const current = game.messages.get(message.id) ?? state.message;
        promptCastSaves(activity, { message: current }).catch(reportError);
    }, 300);
}

function reportError(err) {
    console.error("Region Spell Automation | Spell-cast save prompts failed:", err);
    ui.notifications.error("Could not prompt spell targets. Use the cast card's Save button.");
}

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "promptForSaveOnSpellCasts", {
        name: "Prompt for Save on Spell Casts",
        hint: "When a Save spell is cast, prompt each targeted token's connected owner to roll its save. NPCs use the active GM. Uses the cast card's target list; Region triggers use their separate setting.",
        scope: "world", config: true, type: Boolean, default: true
    });
});

Hooks.once("ready", () => {
    Hooks.on("dnd5e.postUseActivity", (activity, usage, results) => {
        scheduleCastSaves(activity, results);
    });
    Hooks.on("updateChatMessage", (message, changes, options) => {
        if (options?.rsaRetarget) {
            // Retarget edits the card, rather than requesting another save.
            const pending = casts.get(message.id);
            if (pending?.timer) clearTimeout(pending.timer);
            if (pending) pending.timer = null;
            return;
        }
        if (!Object.hasOwn(changes, "system.targets") && !Object.hasOwn(changes.system ?? {}, "targets")) return;
        const state = casts.get(message.id);
        if (state) scheduleCastSaves(state.activity, { message });
    });
    Hooks.on("deleteChatMessage", message => {
        const state = casts.get(message.id);
        if (state?.timer) clearTimeout(state.timer);
        casts.delete(message.id);
        sentTargets.delete(message.id);
    });
});
