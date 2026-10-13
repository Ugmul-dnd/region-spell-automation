import {describeTarget} from "./shared-activity-card.js";
import {selectSaveUser} from "./save-prompts.js";
const MODULE_ID = "region-spell-automation";
const opened = new Set();
const queued = new Set();

const dialogClasses = new Map();
let positionWrites = Promise.resolve();

export function configurePromptDialog(kind, dialog = {}) {
    const base = dialog.applicationClass ?? globalThis.CONFIG?.Dice?.[kind === "damage" ? "DamageRoll" : "D20Roll"]?.DefaultConfigurationDialog;
    if (!base) return dialog;
    let PositionedDialog = dialogClasses.get(kind);
    if (!PositionedDialog) {
        PositionedDialog = class extends base {
            _finalizeRolls(action) {
                const rolls=super._finalizeRolls(action);
                if(kind === "damage") {
                    const weaponRolls=globalThis.RegionSpellAutomationSavage?.finalizeSavage(this,rolls)??rolls;
                    const riders=globalThis.RegionSpellAutomationRiders?.finalizeRiders(this,weaponRolls)??weaponRolls;
                    return globalThis.RegionSpellAutomationSneak?.finalizeSneak(this,riders)??riders;
                }
                return kind === "attack" ? globalThis.RegionSpellAutomationReckless?.finalizeRecklessRolls(this,rolls) ?? rolls : rolls;
            }
            async _prepareButtonsContext(context, options) {
                const prepared=await super._prepareButtonsContext(context,options);
                if(kind === "attack") globalThis.RegionSpellAutomationMasteries?.prepareAttackButtons(this,prepared);
                if(kind === "attack") globalThis.RegionSpellAutomationReckless?.prepareRecklessButtons(this,prepared);
                return prepared;
            }
            _onRender(context,options) {
                super._onRender(context,options);
                if(kind === "attack") globalThis.RegionSpellAutomationMasteries?.focusMasteryAttackButtons(this);
                if(kind === "attack") globalThis.RegionSpellAutomationReckless?.addRecklessButton(this);
                if(kind === "damage") globalThis.RegionSpellAutomationSavage?.addSavageToggle(this);
                if(kind === "damage") globalThis.RegionSpellAutomationRiders?.addRiderChoices(this);
                if(kind === "damage") globalThis.RegionSpellAutomationSneak?.addSneakChoice(this);
            }
            _onPosition(position) {
                super._onPosition(position);
                if (!this.rendered) return;
                clearTimeout(this.positionTimer);
                this.positionTimer = setTimeout(() => this.rememberPosition(), 200);
            }
            rememberPosition() {
                const {left, top} = this.position;
                if (!Number.isFinite(left) || !Number.isFinite(top)) return;
                positionWrites = positionWrites.catch(() => {}).then(() => {
                    const saved = {...(game.settings.get(MODULE_ID,"promptDialogPositions") ?? {})};
                    saved[kind] = {left,top};
                    return game.settings.set(MODULE_ID,"promptDialogPositions",saved);
                }).catch(err => console.error("Region Spell Automation | Could not save prompt position:",err));
            }
            async close(options) {
                if(kind === "attack")globalThis.RegionSpellAutomationMultiShot?.settleFirstShot(this,options);
                if(kind === "damage")await globalThis.RegionSpellAutomationSavage?.commitSavage(this,options);
                if(kind === "damage")await globalThis.RegionSpellAutomationSneak?.commitSneak(this,options);
                clearTimeout(this.positionTimer);
                this.rememberPosition();
                return super.close(options);
            }
        };
        dialogClasses.set(kind, PositionedDialog);
    }
    const saved = game.settings.get(MODULE_ID,"promptDialogPositions")?.[kind];
    const position = {top:null,left:null};
    if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
        position.left = Math.max(0,Math.min(saved.left, Math.max(0,window.innerWidth - 400)));
        position.top = Math.max(0,Math.min(saved.top, Math.max(0,window.innerHeight - 150)));
    }
    return {...dialog, configure:true, sheet:null, applicationClass:PositionedDialog,
        options:{...dialog.options, position:{...dialog.options?.position,...position},
            window:{...dialog.options?.window,frame:true,positioned:true}}};
}
export function turnOnlyAura(activity) {
    const config = game.settings.get(MODULE_ID, "spellTable")?.[activity.item?.name];
    const triggers = config?.enabled === false ? [] : (config?.triggers ?? []).filter(t => t.activity === activity.name);
    return activity.item?.type === "feat" && activity.target?.template?.type && triggers.length &&
        triggers.every(t => t.events?.length && t.events.every(e => ["tokenTurnStart", "tokenTurnEnd"].includes(e)));
}

export async function waitForAttackAnimation(message) {
    if (!game.dice3d) return;
    // DSN's helper skips waiting when chat is displayed immediately. Its
    // animation flag and completion hook still cover that configuration.
    if (message._dice3danimating) {
        await new Promise(resolve => {
            const hook = Hooks.on("diceSoNiceRollComplete", id => {
                if (id !== message.id) return;
                Hooks.off("diceSoNiceRollComplete", hook);
                resolve();
            });
            if (!message._dice3danimating) { Hooks.off("diceSoNiceRollComplete", hook); resolve(); }
        });
    } else if (game.dice3d.waitFor3DAnimationByMessageID) {
        await game.dice3d.waitFor3DAnimationByMessageID(message.id);
    }
}

export async function promptDamage(activity, message, kind = "save", attack = null) {
    const setting = kind === "attack" ? "promptDamageOnHit" : "promptDamageOnSave";
    if (game.settings.get(MODULE_ID, setting) !== true || !activity?.damage?.parts?.length || !message?.id) return;
    const region=message.getFlag?.(MODULE_ID,"regionTriggered")===true;
    const recipient=region?selectSaveUser(activity.actor??activity.item?.actor,game.users,game.users.activeGM):message.author;
    if (recipient?.id !== game.user.id || !activity.item?.isOwner) return;
    if (message.getFlag?.(MODULE_ID,"targetsConfirmationPending") || message.getFlag?.(MODULE_ID,"targetsConfirmationCanceled")) return;
    if (kind === "save" && (activity.type !== "save" || (!message.getFlag?.(MODULE_ID,"regionTriggered") && turnOnlyAura(activity)))) return;
    const key = `${kind}:${attack?.id ?? message.id}`;
    if (opened.has(key) || queued.has(key)) return;
    queued.add(key);
    try {
        if (attack) {
            await waitForAttackAnimation(attack);
            if (!attack.system.evaluatedTargets?.some(target => target.isMiss === false)) return;
        }
        if (game.settings.get(MODULE_ID, setting) !== true || !game.messages.get(message.id)) return;
        // A user or another module may already have rolled damage while the
        // attack animation played. Avoid opening a redundant dialog.
        const existingDamage = message.getAssociatedRolls?.("damage") ?? [];
        if (existingDamage.some(damage => !damage.getFlag?.(MODULE_ID,"masteryGrazeUndone")&&
            (!attack || (damage.timestamp ?? Infinity) >= (attack.timestamp ?? 0)))) return;
        opened.add(key);
        const {ability, ammunitionItem: ammunition, mode: attackMode} = attack?.system ?? {};
        const isCritical = attack?.rolls?.[0]?.isCritical === true;
        // onChatAction applies the usage card's consumption and upcast scaling
        // and invokes the same native damage action as its Damage button.
        if (typeof activity.onChatAction === "function") {
            const hook = Hooks.on("dnd5e.preRollDamageV2", (config, dialog, damageMessage) => {
                if (config.subject?.uuid !== activity.uuid) return;
                Object.assign(dialog, configurePromptDialog("damage",dialog));
                if (damageMessage) {
                    damageMessage.data ??= {};damageMessage.data.system ??= {};
                    damageMessage.data.system.origin = message.id;
                    damageMessage.data.system.targets = attack?.system?.targets??message.system.targets;
                }
                if (attack && damageMessage) {
                    damageMessage.data ??= {};damageMessage.data.flags ??= {};
                    damageMessage.data.flags[MODULE_ID] = {...damageMessage.data.flags[MODULE_ID],damageAttackId:attack.id};
                }
                Hooks.off("dnd5e.preRollDamageV2",hook);
            });
            try {
                await activity.onChatAction(null, {dataset:{action:"rollDamage"},disabled:false}, message);
            } finally {Hooks.off("dnd5e.preRollDamageV2",hook);}
        } else {
            await activity.rollDamage({ability, ammunition, attackMode, isCritical},
                configurePromptDialog("damage", {configure:true, ...(isCritical ? {options:{defaultButton:"critical"}} : {})}),
                {data:{system:{origin:message.id,targets:attack?.system?.targets??message.system.targets}}});
        }
    } finally { queued.delete(key); }
}

function report(err) {
    console.error("Region Spell Automation | Automatic damage prompt failed:",err);
    ui.notifications.error("Could not open damage. Use the card's Damage button.");
}

Hooks.once("init", () => {
    game.settings.register(MODULE_ID,"promptDialogPositions",{scope:"client",config:false,type:Object,default:{}});
    for (const [key,name,hint] of [
        ["promptDamageOnSave","Damage and Healing Roll Prompts","Open save-activity damage prompts after targets are confirmed. Native healing prompts share remembered damage/healing dialog positions and recorded targets."],
        ["promptDamageOnHit","Prompt Damage after an Attack Hit","Open the attacker's native damage dialog after a hit, waiting for Dice So Nice to finish. No prompt on a miss or without confirmed target results."]
    ]) game.settings.register(MODULE_ID,key,{name,hint,scope:"world",config:true,type:Boolean,default:true});
});

Hooks.once("ready", () => {
    globalThis.RegionSpellAutomationDamage = {promptDamage,configurePromptDialog,waitForAttackAnimation};
    // Region activity execution retains its original authority. Only the
    // damage dialog is routed to a connected owner of the casting actor.
    const promptRegionDamage=message=>{
        if(message.getFlag?.(MODULE_ID,"regionTriggered")!==true)return;
        setTimeout(()=>promptDamage(message.getAssociatedActivity?.(),message).catch(report),0);
    };
    Hooks.on("createChatMessage",promptRegionDamage);
    Hooks.on("updateChatMessage",promptRegionDamage);
    // Heal activities already open their native roll after use. Reuse that
    // dialog rather than opening a second one, with recorded/self targets.
    Hooks.on("dnd5e.preRollDamageV2",(config,dialog,message)=>{
        const activity=config.subject;
        if(activity?.type!=="heal")return;
        const prompt=game.settings.get(MODULE_ID,"promptDamageOnSave")===true;
        if(!prompt&&game.settings.get(MODULE_ID,"autoApplyCardDamage")!==true)return;
        if(prompt) {
            const configure=dialog.configure;
            Object.assign(dialog,configurePromptDialog("damage",dialog));
            if(configure===false)dialog.configure=false;
        }
        message.data??={};message.data.system??={};
        const origin=message.data.system.origin;
        const usage=typeof origin==="string"?game.messages.get(origin):origin;
        if(usage?.system.targets?.length)message.data.system.targets=usage.system.targets;
        if(activity.target?.affects?.type==="self") {
            const token=activity.getUsageToken?.()??usage?.getAssociatedToken?.();
            const document=token?.document??token;
            if(document?.actor&&document.uuid)message.data.system.targets=[describeTarget(document)];
        }
    });
    Hooks.on("dnd5e.preRollAttackV2", (config, dialog) => {
        const configure = dialog.configure;
        Object.assign(dialog, configurePromptDialog("attack",dialog));
        if (configure === false) dialog.configure = false;
    });
    Hooks.on("dnd5e.postUseActivity", (activity,usage,results) => {
        // Let other post-use hooks mark pending area confirmation first.
        setTimeout(() => promptDamage(activity,results?.message).catch(report),0);
    });
    Hooks.on("dnd5e.postRollAttack", (rolls,{subject:activity}) => {
        if (!activity || !rolls?.length || game.settings.get(MODULE_ID,"promptDamageOnHit") !== true) return;
        const attack = Array.from(game.messages).reverse().find(message =>
            message.author?.id === game.user.id && message.type === "attack" &&
            message.getAssociatedActivity?.()?.uuid === activity.uuid && message.rolls?.[0]?.total === rolls[0].total);
        if (!attack?.system.evaluatedTargets?.some(target => target.isMiss === false)) return;
        const origin = attack.system.origin;
        const card = typeof origin === "string" ? game.messages.get(origin) : origin;
        if (card) promptDamage(activity,card,"attack",attack).catch(report);
    });
    Hooks.on("deleteChatMessage", message => {
        opened.delete(`save:${message.id}`);opened.delete(`attack:${message.id}`);
    });
});
