import { describeTarget, isEligibleTarget } from "./shared-activity-card.js";
const MODULE_ID = "region-spell-automation";
const DIAGNOSTIC_REVISION = "2026-10-08-confirmation-3";
const handled = new Set();
const pendingCards = new Set();

export function automaticTargetMode(activity, config) {
    const type = activity.target?.affects?.type;
    if (type === "enemy") return "hostilesOnly";
    if (type === "ally") return "friendliesOnly";
    if (type === "self") return "self";
    const modes = new Set((config?.enabled === false ? [] : config?.triggers ?? [])
        .filter(trigger => trigger.activity === activity.name).map(trigger => trigger.targeting));
    return modes.size === 1 ? [...modes][0] : "everyone";
}

export function allowsAutomaticTarget(token, caster, mode) {
    if (mode === "everyone" || !mode) return true;
    if (!caster) return false;
    if (mode === "self") return token.uuid === caster.uuid;
    const friendly = CONST.TOKEN_DISPOSITIONS.FRIENDLY, hostile = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    if (mode === "hostilesOnly") return token.uuid !== caster.uuid &&
        token.disposition === (caster.disposition === hostile ? friendly : hostile);
    if (mode === "excludeFriendlies") return token.uuid !== caster.uuid && token.disposition !== caster.disposition;
    if (mode === "friendliesOnly") return token.disposition === caster.disposition;
    return true;
}

export function collectAreaTargets(tokens, regions, caster, mode) {
    return Array.from(tokens).filter(token => isEligibleTarget(token) && token.object?.isVisible !== false &&
        allowsAutomaticTarget(token, caster, mode) && regions.some(region => token.testInsideRegion(region)));
}

export class TargetConfirmation extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        window: { title: "Confirm Targets" }, position: { width: 420, height: "auto" }
    };
    constructor(message) {
        super({ id: `rsa-confirm-targets-${message.id}` });
        this.message = message;
        this.confirmAfter = Date.now() + 300;
    }
    async _renderHTML() {
        const escape = foundry.utils.escapeHTML;
        const targets = this.eligibleTargets();
        return `<div style="padding:8px;">
            <p>Target tokens on the map to add them. Click a listed name to remove it.</p>
            <div style="max-height:40vh;overflow-y:auto;">
                ${targets.length ? targets.map(token => `<button type="button" data-rsa-remove-target="${escape(token.id)}"
                    style="display:block;width:100%;margin-bottom:4px;">${escape(token.name)} <i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`).join("") : "<p>No targets. You can add targets on the map.</p>"}
            </div>
            <button type="button" data-rsa-confirm-targets>Confirm Targets (${targets.length})</button>
            <button type="button" data-rsa-cancel-targets>Close — Resolve Manually</button>
        </div>`;
    }
    _replaceHTML(result, content) { content.innerHTML = result; }
    _onRender(context, options) {
        super._onRender(context, options);
        for (const button of this.element.querySelectorAll("[data-rsa-remove-target]")) {
            button.addEventListener("click", () => {
                const token = Array.from(game.user.targets).find(target => target.id === button.dataset.rsaRemoveTarget);
                token?.setTarget(false, { user: game.user, releaseOthers: false });
            });
        }
        const confirmButton = this.element.querySelector("[data-rsa-confirm-targets]");
        const delay = Math.max(0, this.confirmAfter - Date.now());
        confirmButton.disabled = delay > 0;
        if (delay) setTimeout(() => { if (this.rendered) confirmButton.disabled = false; }, delay);
        confirmButton.addEventListener("click", async event => {
            if (Date.now() < this.confirmAfter) return;
            event?.preventDefault?.(); event?.stopPropagation?.();
            this.confirmed = true;
            console.log("Region Spell Automation | Targets confirmed", { user: game.user.id, card: this.message.id });
            this.finish(this.eligibleTargets().map(token => describeTarget(token.document ?? token)));
            await this.close();
        });
        this.element.querySelector("[data-rsa-cancel-targets]").addEventListener("click", () => this.close());
    }
    async close(options) {
        if (this.targetHook) Hooks.off("targetToken", this.targetHook);
        for (const [name, id] of this.statusHooks ?? []) Hooks.off(name, id);
        if (!this.confirmed) this.finish?.(null);
        console.log("Region Spell Automation | Target confirmation closed", { user: game.user.id, card: this.message.id, confirmed: Boolean(this.confirmed) });
        return super.close(options);
    }
    async choose() {
        return new Promise((resolve, reject) => {
            this.finish = resolve;
            this.targetHook = Hooks.on("targetToken", (user) => {
                if (user.id === game.user.id && this.rendered) this.render({ force: true });
            });
            this.statusHooks = ["updateActor", "updateToken", "updateCombatant", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]
                .map(name => [name, Hooks.on(name, () => { if (this.rendered) this.render({ force: true }); })]);
            Promise.resolve(this.render({ force: true })).then(() => {
                this.bringToFront?.();
                const bounds = this.element?.getBoundingClientRect?.();
                console.log("Region Spell Automation | Target confirmation rendered", {
                    user: game.user.id, card: this.message.id,
                    connected: this.element?.isConnected,
                    bounds: bounds ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } : null
                });
            }).catch(err => {
                if (this.targetHook) Hooks.off("targetToken", this.targetHook);
                for (const [name, id] of this.statusHooks ?? []) Hooks.off(name, id);
                reject(err);
            });
        });
    }
    eligibleTargets() {
        const targets = [];
        for (const token of Array.from(game.user.targets)) {
            if (isEligibleTarget(token)) targets.push(token);
            else token.setTarget(false, { user: game.user, releaseOthers: false });
        }
        return targets;
    }
}

export function prepareAreaConfirmation(activity, usage, dialog, message) {
    if (["spell", "feat"].includes(activity.item?.type)) {
        console.info("Region Spell Automation | Area targeting pre-use", JSON.stringify({
            revision: DIAGNOSTIC_REVISION, user: game.user.id, activity: activity.name,
            enabled: game.settings.get(MODULE_ID, "confirmAreaTargets"), shape: activity.target?.template?.type ?? null,
            createRegion: usage.create?.measuredTemplate ?? null,
            regionFollowUp: Boolean(message.data?.flags?.[MODULE_ID]?.regionTriggered)
        }));
    }
    if (!game.settings.get(MODULE_ID, "confirmAreaTargets") || !["spell", "feat"].includes(activity.item?.type) ||
        !activity.target?.template?.type ||
        message.data?.flags?.[MODULE_ID]?.regionTriggered) return;
    message.data ??= {};
    message.data.flags ??= {};
    message.data.flags[MODULE_ID] = { ...message.data.flags[MODULE_ID], targetsConfirmationPending: true,
        resumeAreaDamage: usage.subsequentActions !== false };
    usage.subsequentActions = false; // Damage waits for the confirmed target list.
}

export async function confirmCastTargets(activity, usage, results) {
    const message = results?.message;
    console.info("Region Spell Automation | Area targeting post-use", JSON.stringify({
        revision: DIAGNOSTIC_REVISION, user: game.user.id, activity: activity.name,
        card: message?.id ?? null, author: message?.author?.id ?? null,
        regions: results?.templates?.length ?? 0,
        pending: Boolean(message?.getFlag?.(MODULE_ID, "targetsConfirmationPending")),
        regionFollowUp: Boolean(message?.getFlag?.(MODULE_ID, "regionTriggered"))
    }));
    if (!message?.id || message.author?.id !== game.user.id || handled.has(message.id) || message.getFlag?.(MODULE_ID, "regionTriggered")) return;
    if (!message.getFlag?.(MODULE_ID, "targetsConfirmationPending")) {
        // Other casting flows may not preserve the pre-use marker. Actual
        // newly created Regions are authoritative for opening confirmation.
        if (!game.settings.get(MODULE_ID, "confirmAreaTargets") || !["spell", "feat"].includes(activity.item?.type) || !results.templates?.length) return;
        pendingCards.add(message.id); // Block local damage before the server acknowledges flags.
        await message.update({ [`flags.${MODULE_ID}.targetsConfirmationPending`]: true });
    }
    pendingCards.add(message.id);
    handled.add(message.id);
    if (!results.templates?.length) {
        await finishConfirmedCast(activity, message, Array.from(game.user.targets, token => describeTarget(token.document ?? token)));
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 0)); // Let Region geometry finish preparation.
    const origin = results.templates[0].flags?.dnd5e?.origin;
    const caster = origin ? await fromUuid(origin) : activity.getUsageToken?.();
    const config = game.settings.get(MODULE_ID, "spellTable")?.[activity.item.name];
    const mode = automaticTargetMode(activity, config);
    const targets = collectAreaTargets(canvas.tokens.placeables.map(token => token.document), results.templates, caster?.document ?? caster, mode);
    console.log("Region Spell Automation | Opening target confirmation", {
        user: game.user.name ?? game.user.id, activity: activity.name, targets: targets.length
    });
    canvas.tokens.setTargets(targets.map(token => token.id));
    let confirmed;
    try { confirmed = await new TargetConfirmation(message).choose(); }
    catch (err) {
        await message.update({ [`flags.${MODULE_ID}.targetsConfirmationPending`]: false,
            [`flags.${MODULE_ID}.targetsConfirmationCanceled`]: true });
        pendingCards.delete(message.id);
        throw err;
    }
    if (confirmed === null) {
        await message.update({ [`flags.${MODULE_ID}.targetsConfirmationPending`]: false,
            [`flags.${MODULE_ID}.targetsConfirmationCanceled`]: true });
        pendingCards.delete(message.id);
        return;
    }
    await finishConfirmedCast(activity, message, confirmed);
}

export async function finishConfirmedCast(activity, message, targets) {
    const eligible = [];
    for (const descriptor of targets) {
        const token = await fromUuid(descriptor.token);
        if (token && isEligibleTarget(token)) eligible.push(descriptor);
    }
    targets = eligible;
    if (message._targetState) { message._targetState.mode = "targeted"; message._targetState.checked?.clear?.(); }
    await message.update({ "system.targets": targets,
        [`flags.${MODULE_ID}.targetsConfirmationPending`]: false,
        [`flags.${MODULE_ID}.targetsConfirmationCanceled`]: false });
    pendingCards.delete(message.id);
    Hooks.callAll("regionSpellAutomation.targetsConfirmed", message);
    if (message.getFlag?.(MODULE_ID, "resumeAreaDamage") !== false && targets.length && activity.damage?.parts?.length && typeof activity.rollDamage === "function") {
        await activity.rollDamage({}, { configure: true }, { data: { system: { origin: message.id, targets } } });
    }
}

Hooks.once("init", () => game.settings.register(MODULE_ID, "confirmAreaTargets", {
    name: "Auto Target and Confirm Spell/Feature Regions",
    hint: "After placing an area, select its eligible tokens and confirm the target list before prompting damage. Disable other modules' live template targeting to avoid competing target updates.",
    scope: "world", config: true, type: Boolean, default: true
}));

Hooks.once("ready", () => {
    console.info("Region Spell Automation | Area targeting ready", JSON.stringify({
        revision: DIAGNOSTIC_REVISION, user: game.user.id, world: game.world?.id ?? null,
        version: game.modules?.get?.(MODULE_ID)?.version ?? null,
        enabled: game.settings.get(MODULE_ID, "confirmAreaTargets"),
        source: import.meta.url.startsWith("data:") ? "test" : import.meta.url
    }));
    Hooks.on("dnd5e.preUseActivity", prepareAreaConfirmation);
    Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
        const origin = message.data?.system?.origin;
        const card = typeof origin === "string" ? game.messages.get(origin) : origin;
        const id = typeof origin === "string" ? origin : origin?.id;
        if (pendingCards.has(id) || card?.getFlag?.(MODULE_ID, "targetsConfirmationPending")) return false;
    });
    Hooks.on("dnd5e.postUseActivity", (activity, usage, results) => {
        confirmCastTargets(activity, usage, results).catch(err => {
            pendingCards.delete(results?.message?.id);
            console.error("Region Spell Automation | Target confirmation failed:", err);
            ui.notifications.error("Could not confirm area targets. Use Retarget and the card's Save/Damage buttons.");
        });
    });
});
