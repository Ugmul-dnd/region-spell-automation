import { describeTarget, isEligibleTarget, isEligibleHealingTarget } from "./shared-activity-card.js";
const MODULE_ID = "ugmuls-5-5e-automation";
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

export function collectAreaTargets(tokens, regions, caster, mode, healing=false) {
    return Array.from(tokens).filter(token => (healing?isEligibleHealingTarget(token):isEligibleTarget(token)) && token.object?.isVisible !== false &&
        allowsAutomaticTarget(token, caster, mode) && regions.some(region => token.testInsideRegion(region)));
}

export class TargetConfirmation extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        window: { title: "Confirm Targets" }, position: { width: 420, height: "auto" }
    };
    constructor(message) {
        super({ id: `rsa-confirm-targets-${message.id}` });
        this.message = message;
        this.castTargets=Array.from(game.user.targets);
        this.metamagicSelection={transmuted:"",heightened:"",careful:[]};
        this.confirmAfter = Date.now() + 300;
    }
    get canChooseTargets(){return this.message.getAssociatedActivity?.()?.target?.affects?.choice===true;}
    async _renderHTML() {
        const escape = foundry.utils.escapeHTML;
        const targets = this.eligibleTargets(),editable=this.canChooseTargets,rowTag=editable?"button":"div";
        return `<div style="padding:8px;">
            <p>${editable?"Target tokens on the map to add them. Click a listed name to remove it.":"This spell affects the listed creatures. Choose Metamagic options below."}</p>
            <div class="rsa-confirm-target-list ${targets.length>4?"rsa-two-columns":""}">
                ${targets.length ? targets.map(token => `<${rowTag} ${editable?'type="button"':""} data-rsa-target="${escape(token.id)}" ${editable?'data-rsa-remove-target="'+escape(token.id)+'"':""}
                    class="rsa-confirm-target-row">
                    <img src="${escape(token.document?.texture?.src ?? token.texture?.src ?? "icons/svg/mystery-man.svg")}" alt=""
                        style="width:24px;height:24px;flex:0 0 24px;object-fit:contain;border:0;border-radius:3px;">
                    <span style="flex:1;min-width:0;overflow-wrap:anywhere;">${escape(token.name)}</span> ${editable?'<i class="fa-solid fa-xmark" aria-hidden="true"></i>':""}</${rowTag}>`).join("") : (editable?"<p>No targets. You can add targets on the map.</p>":"<p>No affected creatures.</p>")}
            </div>
            ${globalThis.Ugmuls55eAutomationMetamagic?.metamagicMarkup(this.message.getAssociatedActivity?.(),this.metamagicSelection,targets.map(token=>describeTarget(token.document??token)))??""}
            <button type="button" data-rsa-confirm-targets>${editable?"Confirm Targets":"Confirm Metamagic"} (${targets.length})</button>
            <button type="button" data-rsa-cancel-targets style="margin-top:8px;">Cancel Cast</button>
        </div>`;
    }
    _replaceHTML(result, content) { this.clearTokenHighlight(); content.innerHTML = result; }
    clearTokenHighlight(event = {}) {
        this.highlightedToken?._onHoverOut?.(event);
        this.highlightedToken = null;
    }
    _onRender(context, options) {
        super._onRender(context, options);
        for (const button of this.element.querySelectorAll("[data-rsa-target]")) {
            button.addEventListener("mouseenter", event => {
                this.clearTokenHighlight(event);
                const token = this.eligibleTargets().find(target => target.id === button.dataset.rsaTarget);
                if (!token || token.isVisible === false || token.hover) return;
                token._onHoverIn?.(event, {hoverOutOthers: true});
                this.highlightedToken = token;
            });
            button.addEventListener("mouseleave", event => this.clearTokenHighlight(event));
            button.addEventListener("click", () => {
                if(this.committing||!this.canChooseTargets)return;
                this.clearTokenHighlight();
                const token = Array.from(game.user.targets).find(target => target.id === button.dataset.rsaRemoveTarget);
                token?.setTarget(false, { user: game.user, releaseOthers: false });
            });
        }
        for(const select of this.element.querySelectorAll('[data-rsa-meta]'))select.addEventListener('change',()=>{
            this.metamagicSelection[select.dataset.rsaMeta]=select.value;this.render({force:true});
        });
        for(const checkbox of this.element.querySelectorAll('[data-rsa-careful]'))checkbox.addEventListener('change',()=>{
            const selected=new Set(this.metamagicSelection.careful);if(checkbox.checked)selected.add(checkbox.dataset.rsaCareful);else selected.delete(checkbox.dataset.rsaCareful);
            this.metamagicSelection.careful=[...selected];this.render({force:true});
        });
        const metamagic=globalThis.Ugmuls55eAutomationMetamagic,activity=this.message.getAssociatedActivity?.();
        const descriptors=this.eligibleTargets().map(token=>describeTarget(token.document??token));
        const valid=selection=>{try{metamagic?.validateSelection(activity,selection,descriptors);return true;}catch{return false;}};
        for(const select of this.element.querySelectorAll('[data-rsa-meta]'))for(const option of select.options){
            if(!option.value)continue;option.disabled=!valid({...this.metamagicSelection,[select.dataset.rsaMeta]:option.value});
        }
        for(const checkbox of this.element.querySelectorAll('[data-rsa-careful]'))if(!checkbox.checked)
            checkbox.disabled=!valid({...this.metamagicSelection,careful:[...this.metamagicSelection.careful,checkbox.dataset.rsaCareful]});
        const confirmButton = this.element.querySelector("[data-rsa-confirm-targets]");
        const delay = Math.max(0, this.confirmAfter - Date.now());
        confirmButton.disabled = delay > 0||!valid(this.metamagicSelection);
        if (delay) setTimeout(() => { if (this.rendered) confirmButton.disabled = !valid(this.metamagicSelection); }, delay);
        confirmButton.addEventListener("click", async event => {
            if (Date.now() < this.confirmAfter) return;
            event?.preventDefault?.(); event?.stopPropagation?.();
            if(this.committing)return;this.committing=true;confirmButton.disabled=true;
            try {
                await globalThis.Ugmuls55eAutomationMetamagic?.commitCastMetamagic(this.message.getAssociatedActivity?.(),this.message,this.metamagicSelection,
                    this.eligibleTargets().map(token=>describeTarget(token.document??token)),this.castRegions??[]);
            }catch(error){this.committing=false;confirmButton.disabled=false;ui.notifications.warn(error.message);return;}
            this.confirmed = true;
            console.log("Ugmuls 5.5e Automation | Targets confirmed", { user: game.user.id, card: this.message.id });
            this.finish(this.eligibleTargets().map(token => describeTarget(token.document ?? token)));
            await this.close();
        });
        this.element.querySelector("[data-rsa-cancel-targets]").addEventListener("click", () => this.close());
    }
    async close(options) {
        if(this.committing&&!this.confirmed)return this;
        this.clearTokenHighlight();
        if (this.targetHook) Hooks.off("targetToken", this.targetHook);
        for (const [name, id] of this.statusHooks ?? []) Hooks.off(name, id);
        if (!this.confirmed) this.finish?.(null);
        console.log("Ugmuls 5.5e Automation | Target confirmation closed", { user: game.user.id, card: this.message.id, confirmed: Boolean(this.confirmed) });
        return super.close(options);
    }
    async choose() {
        return new Promise((resolve, reject) => {
            this.finish = resolve;
            if(this.canChooseTargets)this.targetHook = Hooks.on("targetToken", (user) => {
                if (user.id === game.user.id && this.rendered) this.render({ force: true });
            });
            this.statusHooks = ["updateActor", "updateToken", "updateCombatant", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]
                .map(name => [name, Hooks.on(name, () => { if (this.rendered) this.render({ force: true }); })]);
            Promise.resolve(this.render({ force: true })).then(() => {
                this.bringToFront?.();
                const bounds = this.element?.getBoundingClientRect?.();
                console.log("Ugmuls 5.5e Automation | Target confirmation rendered", {
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
        for (const token of (this.canChooseTargets?Array.from(game.user.targets):this.castTargets)) {
            if ((this.message.getAssociatedActivity?.()?.type==="heal"?isEligibleHealingTarget(token):isEligibleTarget(token))) targets.push(token);
            else if(this.canChooseTargets)token.setTarget(false, { user: game.user, releaseOthers: false });
        }
        return targets;
    }
}

export function requiresTargetConfirmation(activity) {
    return ["spell","feat"].includes(activity.item?.type)&&
        (activity.target?.affects?.choice===true||globalThis.Ugmuls55eAutomationMetamagic?.needsMetamagic(activity)===true);
}

function isCastFollowup(message){const flags=message?.data?.flags?.[MODULE_ID]??{};return flags.regionTriggered||flags.riderTriggered||flags.recurringTrigger||message?.getFlag?.(MODULE_ID,"regionTriggered")||message?.getFlag?.(MODULE_ID,"riderTriggered")||message?.getFlag?.(MODULE_ID,"recurringTrigger");}
export function prepareAreaConfirmation(activity, usage, dialog, message) {
    if(isCastFollowup(message))return;
    if (["spell", "feat"].includes(activity.item?.type)) {
        console.info("Ugmuls 5.5e Automation | Area targeting pre-use", JSON.stringify({
            revision: DIAGNOSTIC_REVISION, user: game.user.id, activity: activity.name,
            enabled: game.settings.get(MODULE_ID, "confirmAreaTargets"), shape: activity.target?.template?.type ?? null,
            createRegion: usage.create?.measuredTemplate ?? null,
            regionFollowUp: Boolean(message.data?.flags?.[MODULE_ID]?.regionTriggered)
        }));
    }
    if ((!requiresTargetConfirmation(activity)&&(!game.settings.get(MODULE_ID,"confirmAreaTargets")||!["spell","feat"].includes(activity.item?.type)||!activity.target?.template?.type))||
        message.data?.flags?.[MODULE_ID]?.regionTriggered) return;
    message.data ??= {};
    message.data.flags ??= {};
    message.data.flags[MODULE_ID] = { ...message.data.flags[MODULE_ID], targetsConfirmationPending: true,
        resumeAreaDamage: usage.subsequentActions !== false };
    usage.subsequentActions = false; // Damage waits for the confirmed target list.
}

export async function confirmCastTargets(activity, usage, results) {
    const message = results?.message;
    if(isCastFollowup(message))return;
    console.info("Ugmuls 5.5e Automation | Area targeting post-use", JSON.stringify({
        revision: DIAGNOSTIC_REVISION, user: game.user.id, activity: activity.name,
        card: message?.id ?? null, author: message?.author?.id ?? null,
        regions: results?.templates?.length ?? 0,
        pending: Boolean(message?.getFlag?.(MODULE_ID, "targetsConfirmationPending")),
        regionFollowUp: Boolean(message?.getFlag?.(MODULE_ID, "regionTriggered"))
    }));
    if (!message?.id || message.author?.id !== game.user.id || handled.has(message.id) || message.getFlag?.(MODULE_ID, "regionTriggered")) return;
    if (!message.getFlag?.(MODULE_ID, "targetsConfirmationPending")) {
        // Other casting flows may not preserve the pre-use marker. Actual
        // newly created Regions still require target collection before rolling.
        if (!requiresTargetConfirmation(activity)&&(!game.settings.get(MODULE_ID,"confirmAreaTargets")||!["spell","feat"].includes(activity.item?.type)||!results.templates?.length))return;
        pendingCards.add(message.id); // Block local damage before the server acknowledges flags.
        await message.update({ [`flags.${MODULE_ID}.targetsConfirmationPending`]: true });
    }
    pendingCards.add(message.id);
    handled.add(message.id);
    if (!results.templates?.length && !requiresTargetConfirmation(activity)) {
        await finishConfirmedCast(activity, message, Array.from(game.user.targets, token => describeTarget(token.document ?? token)));
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 0)); // Let Region geometry finish preparation.
    const origin = results.templates?.[0]?.flags?.dnd5e?.origin;
    const caster = origin ? await fromUuid(origin) : activity.getUsageToken?.();
    const config = game.settings.get(MODULE_ID, "spellTable")?.[activity.item.name];
    const mode = automaticTargetMode(activity, config);
    const targets = results.templates?.length?collectAreaTargets(canvas.tokens.placeables.map(token => token.document), results.templates, caster?.document ?? caster, mode,activity.type==="heal"):Array.from(game.user.targets,token=>token.document??token);
    if(!requiresTargetConfirmation(activity)) {
        canvas.tokens.setTargets(targets.map(token=>token.id));
        await finishConfirmedCast(activity,message,targets.map(describeTarget));
        return;
    }
    console.log("Ugmuls 5.5e Automation | Opening target confirmation", {
        user: game.user.name ?? game.user.id, activity: activity.name, targets: targets.length
    });
    canvas.tokens.setTargets(targets.map(token => token.id));
    let confirmed;
    try { const chooser=new TargetConfirmation(message);chooser.castRegions=results.templates??[];confirmed = await chooser.choose(); }
    catch (err) {
        if(await globalThis.Ugmuls55eAutomationPendingCast?.cancel(message)){pendingCards.delete(message.id);throw err;}
        await message.update({ [`flags.${MODULE_ID}.targetsConfirmationPending`]: false,
            [`flags.${MODULE_ID}.targetsConfirmationCanceled`]: true });
        pendingCards.delete(message.id);
        throw err;
    }
    if (confirmed === null) {
        if(await globalThis.Ugmuls55eAutomationPendingCast?.cancel(message)){pendingCards.delete(message.id);return;}
        await message.update({ [`flags.${MODULE_ID}.targetsConfirmationPending`]: false,
            [`flags.${MODULE_ID}.targetsConfirmationCanceled`]: true });
        pendingCards.delete(message.id);
        return;
    }
    await finishConfirmedCast(activity, message, confirmed);
}

export async function finishConfirmedCast(activity, message, targets) {
    const eligible = [],tokens=[];
    for (const descriptor of targets) {
        const token = await fromUuid(descriptor.token);
        if (token && (activity.type==="heal"?isEligibleHealingTarget(token):isEligibleTarget(token))){eligible.push(descriptor);tokens.push(token);}
    }
    targets = eligible;
    if(activity.target?.affects?.choice!==true)globalThis.canvas?.tokens?.setTargets?.(tokens.map(token=>token.id));
    if (message._targetState) { message._targetState.mode = "targeted"; message._targetState.checked?.clear?.(); }
    await message.update({ "system.targets": targets });
    for(const target of targets){const token=await fromUuid(target.token);if(token)await globalThis.Ugmuls55eAutomationMetamagic?.carefulSave(message,token);}
    await message.update({ [`flags.${MODULE_ID}.targetsConfirmationPending`]: false,
        [`flags.${MODULE_ID}.targetsConfirmationCanceled`]: false });
    pendingCards.delete(message.id);
    Hooks.callAll("ugmuls55eAutomation.targetsConfirmed", message);
    if(activity.type==="attack"&&message.getFlag?.(MODULE_ID,"resumeAreaDamage")!==false&&targets.length){
        const scaled=message.getAssociatedActivity?.({scaled:true})??activity;
        // Notify the existing multi-shot helper before the first attack opens.
        Hooks.callAll("ugmuls55eAutomation.castReady",scaled,message);
        await scaled.rollAttack({}, {}, {data:{system:{origin:message.id}}});return;
    }
    const hasRoll=activity.type==="heal"?!!activity.healing?.formula:!!activity.damage?.parts?.length;
    if (message.getFlag?.(MODULE_ID, "resumeAreaDamage") !== false && targets.length && hasRoll && typeof activity.rollDamage === "function") {
        if (activity.type === "save" && globalThis.Ugmuls55eAutomationDamage) {
            await globalThis.Ugmuls55eAutomationDamage.promptDamage(activity, message);
        } else {
            await activity.rollDamage({}, globalThis.Ugmuls55eAutomationDamage?.configurePromptDialog("damage",{configure:true})??{configure:true}, { data: { system: { origin: message.id, targets } } });
        }
    }
}

Hooks.once("init", () => game.settings.register(MODULE_ID, "confirmAreaTargets", {
    name: "Auto Target Spell/Feature Regions",
    hint: "Automatically collect eligible targets after placing an area. Confirmation opens only for Choose Targets activities or applicable cast-time Metamagic. Disable other modules' live template targeting to avoid competing target updates.",
    scope: "world", config: true, type: Boolean, default: true
}));

Hooks.once("ready", () => {
    console.info("Ugmuls 5.5e Automation | Area targeting ready", JSON.stringify({
        revision: DIAGNOSTIC_REVISION, user: game.user.id, world: game.world?.id ?? null,
        version: game.modules?.get?.(MODULE_ID)?.version ?? null,
        enabled: game.settings.get(MODULE_ID, "confirmAreaTargets"),
        source: import.meta.url.startsWith("data:") ? "test" : import.meta.url
    }));
    Hooks.on("dnd5e.preUseActivity", prepareAreaConfirmation);
    for(const kind of ["Damage","Attack","SavingThrow"])Hooks.on(`dnd5e.preRoll${kind}V2`, (config, dialog, message) => {
        const origin = message.data?.system?.origin;
        const card = typeof origin === "string" ? game.messages.get(origin) : origin;
        const id = typeof origin === "string" ? origin : origin?.id;
        if (pendingCards.has(id) || card?.getFlag?.(MODULE_ID, "targetsConfirmationPending")) return false;
    });
    Hooks.on("dnd5e.postUseActivity", (activity, usage, results) => {
        confirmCastTargets(activity, usage, results).catch(err => {
            pendingCards.delete(results?.message?.id);
            console.error("Ugmuls 5.5e Automation | Target confirmation failed:", err);
            ui.notifications.error("Could not confirm area targets. Use Retarget and the card's Save/Damage buttons.");
        });
    });
});
