import { sendSavePrompt, isEligibleTarget } from "./save-prompts.js";
const MODULE_ID = "region-spell-automation";
const casts = new Map();
const sentTargets = new Map();

export async function promptCastSaves(activity, results) {
    if (game.settings.get(MODULE_ID, "promptForSaveOnSpellCasts") !== true) return;
    const message = results?.message;
    if (message?.getFlag?.(MODULE_ID, "targetsConfirmationPending") || message?.getFlag?.(MODULE_ID, "targetsConfirmationCanceled")) return;
    if (activity?.type !== "save" || !["spell", "feat"].includes(activity.item?.type) || !message?.id) return;
    if (message.author?.id !== game.user.id || message.getFlag?.(MODULE_ID, "regionTriggered")) return;
    // A configured turn-only feature aura is activated now, but its saves
    // belong to the Region's turn events rather than the initial use card.
    const config = game.settings.get(MODULE_ID, "spellTable")?.[activity.item.name];
    const matching = config?.enabled === false ? [] : (config?.triggers ?? []).filter(trigger => trigger.activity === activity.name);
    if (activity.item.type === "feat" && activity.target?.template?.type && matching.length &&
        matching.every(trigger => trigger.events?.length && trigger.events.every(event =>
            ["tokenTurnStart", "tokenTurnEnd"].includes(event)))) return;
    const promptedTokens = sentTargets.get(message.id) ?? new Set();
    sentTargets.set(message.id, promptedTokens);
    const excluded = new Set();
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
        if (!isEligibleTarget(token)) {
            excluded.add(descriptor.token ?? descriptor.actor);
            continue;
        }
        if (promptedTokens.has(token.uuid)) continue;
        promptedTokens.add(token.uuid);
        await sendSavePrompt(message, token, "spell");
    }
    if (excluded.size) {
        await message.update({ "system.targets": (message.system.targets ?? []).filter(target => !excluded.has(target.token ?? target.actor)),
            [`flags.${MODULE_ID}.retargeted`]: true }, { rsaPruneTargets: true });
    }
}

export function scheduleCastSaves(activity, results) {
    const message = results?.message;
    if (activity?.type !== "save" || !["spell", "feat"].includes(activity.item?.type) || !message?.id ||
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
        name: "Prompt for Save on Spells and Features",
        hint: "When a spell, player feature, or monster ability uses a Save activity, prompt each targeted token's owner to roll its save. NPCs use a GM. Uses the activity card's targets; attacks without a Save activity are excluded. Region triggers use their separate setting.",
        scope: "world", config: true, type: Boolean, default: true
    });
});

Hooks.once("ready", () => {
    Hooks.on("dnd5e.postUseActivity", (activity, usage, results) => {
        scheduleCastSaves(activity, results);
    });
    Hooks.on("regionSpellAutomation.targetsConfirmed", message => {
        // Confirmation can finish after the post-use timer has already skipped
        // the pending card. Resume explicitly, even without a cached cast.
        const activity = casts.get(message.id)?.activity ?? message.getAssociatedActivity?.();
        scheduleCastSaves(activity, { message });
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
