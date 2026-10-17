import {describeTarget} from "./shared-activity-card.js";
import {selectSaveUser} from "./save-prompts.js";
const MODULE_ID = "ugmuls-5-5e-automation";
const opened = new Set();
const queued = new Set();

const dialogClasses = new Map();
let positionWrites = Promise.resolve();

export function addDamageChoice(app, {key, label, value, disabled=false, used=false, locked=false, change=()=>{}}) {
    const configuration=app.element.querySelector('[data-application-part="configuration"] fieldset')
        ??app.element.querySelector('fieldset');
    if(!configuration)return null;
    const existing=configuration.querySelector('[data-rsa-choice="'+key+'"]');
    if(existing)return existing;
    const group=document.createElement("div");group.className="form-group rsa-damage-choice";
    group.dataset.rsaChoice=key;group.classList.toggle("rsa-savage-used",disabled||used||locked);
    const caption=document.createElement("label");caption.textContent=label;
    const fields=document.createElement("div");fields.className="form-fields";
    const select=document.createElement("select");select.disabled=disabled||used||locked;
    select.setAttribute("aria-label",label);
    for(const [value,text] of [["yes","Yes"],["no",used?"No - Already Used":"No"]]) {
        const option=document.createElement("option");option.value=value;option.textContent=text;select.append(option);
    }
    select.value=!disabled&&!used&&value?"yes":"no";
    select.addEventListener("change",event=>{
        event.stopPropagation();change(select.value==="yes");
        app.rebuild();
    });
    fields.append(select);group.append(caption,fields);configuration.append(group);return group;
}

export function configurePromptDialog(kind, dialog = {}) {
    const base = dialog.applicationClass ?? globalThis.CONFIG?.Dice?.[kind === "damage" ? "DamageRoll" : "D20Roll"]?.DefaultConfigurationDialog;
    if (!base) return dialog;
    let PositionedDialog = dialogClasses.get(kind);
    if (!PositionedDialog) {
        PositionedDialog = class extends base {
            get rolls() {
                const rolls=super.rolls;
                if(!this._rsaPreview)return rolls;
                const cleave=globalThis.Ugmuls55eAutomationCleave?.finalizeCleaveDamage(this,rolls)??rolls;
                const grapple=globalThis.Ugmuls55eAutomationGrapple?.finalizeGrapple(this,cleave,{preview:true})??cleave;
                if(globalThis.Ugmuls55eAutomationGrapple?.replacesGrappleDamage(this))return grapple;
                const savage=globalThis.Ugmuls55eAutomationSavage?.finalizeSavage(this,grapple,{preview:true})??grapple;
                const riders=globalThis.Ugmuls55eAutomationRiders?.finalizeRiders(this,savage)??savage;
                const sneak=globalThis.Ugmuls55eAutomationSneak?.finalizeSneak(this,riders,{preview:true})??riders;
                const prey=globalThis.Ugmuls55eAutomationPrey?.finalizePrey(this,sneak,{preview:true})??sneak;
                const smite=globalThis.Ugmuls55eAutomationSmite?.finalizeSmite(this,prey,{preview:true})??prey;
                const eldritch=globalThis.Ugmuls55eAutomationEldritch?.finalizeEldritch(this,smite,{preview:true})??smite;
                const brutal=globalThis.Ugmuls55eAutomationBrutal?.finalizeBrutalDamage(this,eldritch)??eldritch;
                const frenzy=globalThis.Ugmuls55eAutomationFrenzy?.finalizeFrenzy(this,brutal,{preview:true})??brutal;
                const divineFury=globalThis.Ugmuls55eAutomationDivineFury?.finalizeDivineFury(this,frenzy,{preview:true})??frenzy;
                const maneuver=globalThis.Ugmuls55eAutomationBattleMaster?.finalizeManeuver(this,divineFury,{preview:true})??divineFury;
                const valor=globalThis.Ugmuls55eAutomationValor?.finalizeValorOffense(this,maneuver,{preview:true})??maneuver;
                const transmuted=globalThis.Ugmuls55eAutomationTransmuted?.finalizeTransmuted(this,valor,{preview:true})??valor;
                return globalThis.Ugmuls55eAutomationGreatWeapons?.finalizeGreatWeapons(this,transmuted)??transmuted;
            }
            async _prepareContext(options) {
                if(kind==="damage")await globalThis.Ugmuls55eAutomationPendingDamage?.prepareDamageDialog(this);
                return super._prepareContext(options);
            }
            async _prepareFormulasContext(context,options) {
                this._rsaPreview=kind==="damage";
                try {return await super._prepareFormulasContext(context,options);}
                finally {this._rsaPreview=false;}
            }
            _finalizeRolls(action) {
                if(kind==="damage"&&globalThis.Ugmuls55eAutomationPendingDamage?.canSubmitDamage(this)===false)return [];
                const rolls=super._finalizeRolls(action);
                if(kind === "damage") {
                    const cleave=globalThis.Ugmuls55eAutomationCleave?.finalizeCleaveDamage(this,rolls)??rolls;
                    const grapple=globalThis.Ugmuls55eAutomationGrapple?.finalizeGrapple(this,cleave)??cleave;
                    if(globalThis.Ugmuls55eAutomationGrapple?.replacesGrappleDamage(this))return grapple;
                    const weaponRolls=globalThis.Ugmuls55eAutomationSavage?.finalizeSavage(this,grapple)??grapple;
                    const riders=globalThis.Ugmuls55eAutomationRiders?.finalizeRiders(this,weaponRolls)??weaponRolls;
                    const sneak=globalThis.Ugmuls55eAutomationSneak?.finalizeSneak(this,riders)??riders;
                    const prey=globalThis.Ugmuls55eAutomationPrey?.finalizePrey(this,sneak)??sneak;
                    const smite=globalThis.Ugmuls55eAutomationSmite?.finalizeSmite(this,prey)??prey;
                    const eldritch=globalThis.Ugmuls55eAutomationEldritch?.finalizeEldritch(this,smite)??smite;
                    const brutal=globalThis.Ugmuls55eAutomationBrutal?.finalizeBrutalDamage(this,eldritch)??eldritch;
                    const frenzy=globalThis.Ugmuls55eAutomationFrenzy?.finalizeFrenzy(this,brutal)??brutal;
                    const divineFury=globalThis.Ugmuls55eAutomationDivineFury?.finalizeDivineFury(this,frenzy)??frenzy;
                    const maneuver=globalThis.Ugmuls55eAutomationBattleMaster?.finalizeManeuver(this,divineFury)??divineFury;
                    const valor=globalThis.Ugmuls55eAutomationValor?.finalizeValorOffense(this,maneuver)??maneuver;
                    const stunning=globalThis.Ugmuls55eAutomationStunning?.finalizeStunning(this,valor)??valor;
                    const transmuted=globalThis.Ugmuls55eAutomationTransmuted?.finalizeTransmuted(this,stunning)??stunning;
                    return globalThis.Ugmuls55eAutomationGreatWeapons?.finalizeGreatWeapons(this,transmuted)??transmuted;
                }
                if(kind === "attack"){const reckless=globalThis.Ugmuls55eAutomationReckless?.finalizeRecklessRolls(this,rolls)??rolls;return globalThis.Ugmuls55eAutomationBrutal?.finalizeBrutalAttack(this,reckless)??reckless;}
                return rolls;
            }
            async _prepareButtonsContext(context, options) {
                const prepared=await super._prepareButtonsContext(context,options);
                if(kind === "attack") globalThis.Ugmuls55eAutomationMasteries?.prepareAttackButtons(this,prepared);
                if(kind === "attack") globalThis.Ugmuls55eAutomationReckless?.prepareRecklessButtons(this,prepared);
                if(kind === "attack") globalThis.Ugmuls55eAutomationInnateSorcery?.prepareInnateButtons(this,prepared);
                if(kind === "attack") globalThis.Ugmuls55eAutomationZealous?.prepareZealousButtons(this,prepared);
                return prepared;
            }
            _onRender(context,options) {
                super._onRender(context,options);
                if(kind === "attack") globalThis.Ugmuls55eAutomationMasteries?.focusMasteryAttackButtons(this);
                if(kind === "attack") globalThis.Ugmuls55eAutomationReckless?.addRecklessButton(this);
                if(kind === "attack") globalThis.Ugmuls55eAutomationBrutal?.addBrutalButton(this);
                if(kind === "damage") {
                    // Extra rider rows are previews, not separate native configuration entries.
                    for(const [index,row] of Array.from(this.element.querySelectorAll(".formulas > li")).entries()) {
                        if(index>=super.rolls.length){row.querySelector(".form-group")?.remove();row.classList.add("rsa-bonus-damage-row");}
                        const formula=row.querySelector(".formula");
                        if(formula)formula.textContent=formula.textContent.replace(/(\S)\[/g,"$1 [");
                    }
                }
                if(kind === "damage") globalThis.Ugmuls55eAutomationGreatWeapons?.addGreatWeaponChoices(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationSavage?.addSavageToggle(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationRiders?.addRiderChoices(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationSneak?.addSneakChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationPrey?.addPreyChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationSmite?.addSmiteChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationEldritch?.addEldritchChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationFrenzy?.addFrenzyChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationDivineFury?.addDivineFuryChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationBrutal?.addBrutalDamageChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationBattleMaster?.addManeuverChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationValor?.addValorOffenseChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationStunning?.addStunningChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationGrapple?.addGrappleChoice(this);
                if(kind === "damage") globalThis.Ugmuls55eAutomationTransmuted?.addTransmutedChoice(this);
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
                }).catch(err => console.error("Ugmuls 5.5e Automation | Could not save prompt position:",err));
            }
            async close(options) {
                if(kind === "attack"&&!options?.dnd5e?.submitted)globalThis.Ugmuls55eAutomationBrutal?.releaseBrutal(this);
                if(kind === "attack")globalThis.Ugmuls55eAutomationMultiShot?.settleFirstShot(this,options);
                if(kind === "damage") {
                    try {
                        await globalThis.Ugmuls55eAutomationTransmuted?.commitTransmuted(this,options);
                        await globalThis.Ugmuls55eAutomationEldritch?.commitEldritch(this,options);
                        await globalThis.Ugmuls55eAutomationSmite?.commitSmite(this,options);
                        await globalThis.Ugmuls55eAutomationStunning?.commitStunning(this,options);
                        await globalThis.Ugmuls55eAutomationGrapple?.commitGrapple(this,options);
                        await globalThis.Ugmuls55eAutomationBattleMaster?.commitManeuver(this,options);
                        await globalThis.Ugmuls55eAutomationValor?.commitValorOffense(this,options);
                        await globalThis.Ugmuls55eAutomationBrutal?.commitBrutalEffects(this,options);
                    }
                    catch(error) {
                        // Release pending uses if resource consumption blocks submission.
                        await globalThis.Ugmuls55eAutomationBattleMaster?.commitManeuver(this,{});
                        await globalThis.Ugmuls55eAutomationValor?.commitValorOffense(this,{});
                        await globalThis.Ugmuls55eAutomationGrapple?.commitGrapple(this,{});
                        await globalThis.Ugmuls55eAutomationStunning?.commitStunning(this,{});
                        await globalThis.Ugmuls55eAutomationTransmuted?.commitTransmuted(this,{});
                        await globalThis.Ugmuls55eAutomationSmite?.commitSmite(this,{});
                        await globalThis.Ugmuls55eAutomationEldritch?.commitEldritch(this,{});
                        await globalThis.Ugmuls55eAutomationSavage?.commitSavage(this,{});
                        await globalThis.Ugmuls55eAutomationSneak?.commitSneak(this,{});
                        await globalThis.Ugmuls55eAutomationPrey?.commitPrey(this,{});
                        await globalThis.Ugmuls55eAutomationFrenzy?.commitFrenzy(this,{});
                        await globalThis.Ugmuls55eAutomationDivineFury?.commitDivineFury(this,{});
                        throw error;
                    }
                }
                if(kind === "damage")await globalThis.Ugmuls55eAutomationSavage?.commitSavage(this,options);
                if(kind === "damage")await globalThis.Ugmuls55eAutomationSneak?.commitSneak(this,options);
                if(kind === "damage")await globalThis.Ugmuls55eAutomationPrey?.commitPrey(this,options);
                if(kind === "damage")await globalThis.Ugmuls55eAutomationFrenzy?.commitFrenzy(this,options);
                if(kind === "damage")await globalThis.Ugmuls55eAutomationDivineFury?.commitDivineFury(this,options);
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

export async function waitForAttackAnimation(message){
    if(!game.dice3d)return;
    let hook;
    try{
        let animation;
        if(message._dice3danimating){animation=new Promise(resolve=>{
            hook=Hooks.on("diceSoNiceRollComplete",id=>{if(id===message.id)resolve();});
            if(!message._dice3danimating)resolve();
        });}else animation=game.dice3d.waitFor3DAnimationByMessageID?.(message.id);
        await (globalThis.Ugmuls55eAutomationWaitForAnimation?.(animation)??animation);
    }finally{if(hook!==undefined)Hooks.off("diceSoNiceRollComplete",hook);}
}

// Resolve the published attack rather than guessing from a matching roll total.
export function recordedAttackForDamage(data,activity){
    const reference=data?.system?.origin;
    const origin=typeof reference==="string"?game.messages.get(reference.replace(/^ChatMessage\./,"")):reference;
    const explicit=data?.flags?.[MODULE_ID]?.damageAttackId;
    if(explicit)return game.messages.get(explicit);
    if(origin?.type==="attack")return origin;
    return Array.from(origin?.getAssociatedRolls?.("attack")??[])
        .filter(card=>!activity?.uuid||card.getAssociatedActivity?.()?.uuid===activity.uuid)
        .sort((a,b)=>(b.timestamp??0)-(a.timestamp??0))[0];
}
export function linkDamageAttack(config,dialog,message){
    if(config.subject?.type!=="attack"||!message)return;
    const attack=recordedAttackForDamage(message.data,config.subject);if(!attack)return;
    message.data??={};message.data.flags??={};message.data.flags[MODULE_ID]??={};
    message.data.flags[MODULE_ID].damageAttackId=attack.id;
    message.data.system??={};message.data.system.targets=attack.system.targets;
}
export function promptPublishedAttack(attack){
    if(attack?.type!=="attack"||!attack.rolls?.length||attack.author?.id!==game.user.id)return;
    const reference=attack.system?.origin;
    const usage=typeof reference==="string"?game.messages.get(reference.replace(/^ChatMessage\./,"")):reference;
    if(usage)return promptDamage(attack.getAssociatedActivity?.(),usage,"attack",attack);
}
export async function promptDamage(activity, message, kind = "save", attack = null) {
    const setting = kind === "attack" ? "promptDamageOnHit" : "promptDamageOnSave";
    if (game.settings.get(MODULE_ID, setting) !== true || !activity?.damage?.parts?.length || !message?.id) return;
    const region=message.getFlag?.(MODULE_ID,"regionTriggered")===true||message.getFlag?.(MODULE_ID,"sharedCardPerTurn")===true;
    const recipient=region?selectSaveUser(activity.actor??activity.item?.actor,game.users,game.users.activeGM):message.author;
    if (recipient?.id !== game.user.id || !activity.item?.isOwner) return;
    if (message.getFlag?.(MODULE_ID,"targetsConfirmationPending") || message.getFlag?.(MODULE_ID,"targetsConfirmationCanceled")) return;
    if (kind === "save" && (activity.type !== "save" || (!message.getFlag?.(MODULE_ID,"regionTriggered") && turnOnlyAura(activity)))) return;
    // Empty areas wait for their first recorded trigger, without consuming the prompt guard.
    if(kind === "save" && !message.system?.targets?.length)return;
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
        if (existingDamage.some(damage => damage.rolls?.length && !damage.getFlag?.(MODULE_ID,"masteryGrazeUndone")&&
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
    console.error("Ugmuls 5.5e Automation | Automatic damage prompt failed:",err);
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
    globalThis.Ugmuls55eAutomationDamage = {promptDamage,configurePromptDialog,waitForAttackAnimation,addDamageChoice};
    // Region activity execution retains its original authority. Only the
    // damage dialog is routed to a connected owner of the casting actor.
    const promptRegionDamage=message=>{
        if(message.type!=="usage"||(!message.getFlag?.(MODULE_ID,"regionTriggered")&&!message.getFlag?.(MODULE_ID,"sharedCardPerTurn")))return;
        setTimeout(()=>promptDamage(message.getAssociatedActivity?.(),message).catch(report),0);
    };
    Hooks.on("createChatMessage",promptRegionDamage);
    Hooks.on("createChatMessage",card=>{setTimeout(()=>promptPublishedAttack(card)?.catch(report),0);});
    Hooks.on("updateChatMessage",card=>{setTimeout(()=>promptPublishedAttack(card)?.catch(report),0);});
    Hooks.on("dnd5e.preRollDamageV2",linkDamageAttack);
    Hooks.on("updateChatMessage",promptRegionDamage);
    // Heal activities already open their native roll after use. Reuse that
    // dialog rather than opening a second one, with recorded/self targets.
    Hooks.on("dnd5e.preRollDamageV2",(config,dialog,message)=>{
        const activity=config.subject;
        if(activity?.type!=="heal")return;
        const prompt=game.settings.get(MODULE_ID,"promptDamageOnSave")===true;
        if(!prompt&&game.settings.get(MODULE_ID,"autoApplyCardHealing")!==true)return;
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
