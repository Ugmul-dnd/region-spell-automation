// ============================================================
// Region Spell Automation
// v0.5.7
// Foundry VTT v14 / D&D5e 6.0.5
//
// Features:
// - Multiple activity triggers per spell
// - Multiple events per trigger
// - Per-trigger targeting
// - Optional Once Per Turn limiter
// - Native D&D5e Region Active Effects
// - tokenEnter delayed-attachment workaround
// - Skip all activity triggers for hidden/dead/defeated/0 HP tokens
// ============================================================

const MODULE_ID = "region-spell-automation";
const SETTING_KEY = "spellTable";

import { appendSharedTarget, createEventQueue, describeTarget, getSharedCardKey, mergeTargets, isEligibleTarget }
    from "./shared-activity-card.js";
import { MOVEMENT_EVENTS, recordMovementDamage, registerMovementDamageHooks } from "./movement-damage.js";
import { resolveRegionEffect } from "./starter-spells.js";
import { promptTargetSave, registerSavePromptHooks } from "./save-prompts.js";

const sharedCardHistory = new Map();
const pendingCastAllowances = new Map();
const enqueueRegionEvent = createEventQueue();


// ============================================================
// ONCE-PER-TURN HISTORY
// ============================================================

const oncePerTurnHistory =
    new Set();


console.log(
    "Region Spell Automation | v0.5.7 JS loaded"
);


// ============================================================
// INIT
// ============================================================

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "promptForSaveOnRegionTriggers", {
        name: "Prompt for Save on Region Triggers",
        hint: "Open saving throw dialogs for affected token owners when Region Save activities trigger. NPCs use the active GM. Applies to Region triggers only.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(
        MODULE_ID,
        SETTING_KEY,
        {
            name:
                "Region Spell Automation - Spell Table",

            hint:
                "Configured spells used by Region Spell Automation.",

            scope:
                "world",

            config:
                false,

            type:
                Object,

            default:
                {}
        }
    );


    console.log(
        "Region Spell Automation | Settings registered"
    );
});


// ============================================================
// BUILD ONCE-PER-TURN KEY
// ============================================================

function getOncePerTurnKey(
    trigger,
    targetToken,
    event
) {

    const combat =
        event?.data?.combat ??
        game.combat;


    if (!combat) {
        return null;
    }


    const round =
        event?.data?.round ??
        combat.round;


    const turn =
        event?.data?.turn ??
        combat.turn;


    if (
        round == null ||
        turn == null
    ) {

        return null;
    }


    return [
        combat.id,
        round,
        turn,
        targetToken.id,
        trigger.id
    ].join("|");
}


// ============================================================
// TARGETING CHECK
// ============================================================

function passesTargeting(
    targeting,
    casterToken,
    targetToken
) {

    switch (targeting) {


        case "everyone":

            return true;


        case "excludeFriendlies":

            if (!casterToken) {
                return true;
            }


            if (
                casterToken.id ===
                targetToken.id
            ) {
                return false;
            }


            if (
                casterToken.document.disposition ===
                targetToken.document.disposition
            ) {
                return false;
            }


            return true;


        case "friendliesOnly":

            if (!casterToken) {
                return false;
            }


            return (
                casterToken.document.disposition ===
                targetToken.document.disposition
            );


        case "hostilesOnly":

            if (!casterToken) {
                return false;
            }


            if (
                casterToken.id ===
                targetToken.id
            ) {
                return false;
            }


            return (
                casterToken.document.disposition !==
                targetToken.document.disposition
            );


        default:

            console.warn(
                "Region Spell Automation | Unknown targeting mode:",
                targeting
            );

            return false;
    }
}


// ============================================================
// REGION ACTIVITY EVENT HANDLER
// ============================================================

function handleRegionEvent(context) {
    // Activity use temporarily changes user targets. Serialize events so those
    // changes and shared-card creation cannot race on this client.
    const combat = context.event?.data?.combat ?? game.combat;
    const event = {
        ...context.event,
        name: context.event?.name,
        data: {
            ...context.event?.data,
            combat,
            round: context.event?.data?.round ?? combat?.round,
            turn: context.event?.data?.turn ?? combat?.turn
        }
    };
    return enqueueRegionEvent(() => executeRegionEvent({ ...context, event }));
}

async function executeRegionEvent({
    event,
    region,
    scene,
    behavior,
    triggerId
}) {

    // --------------------------------------------------------
    // TRIGGERING TOKEN
    // --------------------------------------------------------

    const targetDoc =
        event?.data?.token;


    if (!targetDoc) {

        console.warn(
            "Region Spell Automation | Region event had no token.",
            event
        );

        return;
    }


    const targetToken =
        targetDoc.object;


    if (!targetToken) {

        console.warn(
            "Region Spell Automation | Triggering TokenDocument had no canvas Token."
        );

        return;
    }


    // ========================================================
    // SKIP ALL EVENTS FOR EXCLUDED TARGETS
    // ========================================================

    if (
        !isEligibleTarget(targetDoc)
    ) {

        console.log(
            `Region Spell Automation | Skipping ${event.name} for hidden/dead/defeated/0 HP token "${targetToken.name}".`
        );

        return;
    }


    // --------------------------------------------------------
    // ORIGINATING SPELL
    // --------------------------------------------------------

    const itemUUID =
        region.flags?.dnd5e?.item;


    if (!itemUUID) {

        console.warn(
            "Region Spell Automation | Region has no dnd5e.item UUID."
        );

        return;
    }


    const spell =
        await fromUuid(
            itemUUID
        );


    if (!spell) {

        console.warn(
            "Region Spell Automation | Could not resolve originating spell:",
            itemUUID
        );

        return;
    }


    // --------------------------------------------------------
    // CURRENT CONFIG
    // --------------------------------------------------------

    const spellTable =
        game.settings.get(
            MODULE_ID,
            SETTING_KEY
        ) ?? {};


    const config =
        spellTable[
            spell.name
        ];


    if (!config) {
        return;
    }


    if (
        config.enabled ===
        false
    ) {
        return;
    }


    // --------------------------------------------------------
    // FIND THIS TRIGGER
    // --------------------------------------------------------

    const triggers =
        Array.isArray(
            config.triggers
        )
            ? config.triggers
            : [];


    const trigger =
        triggers.find(
            entry =>
                entry.id ===
                triggerId
        );


    if (!trigger) {

        console.warn(
            `Region Spell Automation | Could not find trigger "${triggerId}" for "${spell.name}".`
        );

        return;
    }


    // --------------------------------------------------------
    // VERIFY EVENT
    // --------------------------------------------------------

    // The caster runs normal activities on their own actor. GM-only document
    // setup and movement accounting remain separate from activity execution.
    const casterUserId = region.flags?.[MODULE_ID]?.casterUserId;
    const casterUser = casterUserId ? game.users?.get?.(casterUserId) : null;
    const casterCanUse = casterUser?.active && spell.actor?.testUserPermission?.(casterUser, "OWNER");
    const executor = !trigger.movementDamage && casterCanUse ? casterUser : game.users?.activeGM;
    if (executor ? executor.id !== game.user.id : !game.user.isGM) return;

    if (
        trigger.movementDamage
            ? !MOVEMENT_EVENTS.includes(event.name)
            : !Array.isArray(trigger.events) || !trigger.events.includes(event.name)
    ) {

        return;
    }


    // --------------------------------------------------------
    // CASTER
    // --------------------------------------------------------

    const casterUUID =
        region.flags?.dnd5e?.origin;


    let casterTokenDoc =
        null;


    if (
        casterUUID
    ) {

        try {

            casterTokenDoc =
                await fromUuid(
                    casterUUID
                );

        }

        catch (err) {

            console.warn(
                "Region Spell Automation | Failed resolving caster token:",
                casterUUID,
                err
            );
        }
    }


    const casterToken =
        casterTokenDoc?.object ??
        null;


    // --------------------------------------------------------
    // TARGETING
    // --------------------------------------------------------

    if (
        !passesTargeting(
            trigger.targeting,
            casterToken,
            targetToken
        )
    ) {

        return;
    }


    // ========================================================
    // ONCE PER TURN
    // ========================================================

    let turnKey =
        null;


    if (
        !trigger.movementDamage && trigger.oncePerTurn === true
    ) {

        turnKey =
            getOncePerTurnKey(
                trigger,
                targetToken,
                event
            );


        if (
            turnKey &&
            oncePerTurnHistory.has(
                turnKey
            )
        ) {

            console.log(
                `Region Spell Automation | Once Per Turn blocked "${spell.name}" → "${trigger.name}" for ${targetToken.name}.`,
                {
                    event:
                        event.name,

                    key:
                        turnKey
                }
            );

            return;
        }
    }


    // --------------------------------------------------------
    // ACTIVITY
    // --------------------------------------------------------

    const activity =
        spell.system.activities.find(
            entry =>
                entry.name ===
                trigger.activity
        );


    if (!activity) {

        console.warn(
            `Region Spell Automation | Activity "${trigger.activity}" not found on "${spell.name}".`
        );


        ui.notifications.warn(
            `${spell.name}: Activity "${trigger.activity}" not found.`
        );

        return;
    }


    // --------------------------------------------------------
    // REUSE THIS TURN'S ACTIVITY CARD
    // --------------------------------------------------------

    if (trigger.movementDamage) {
        try {
            const activeGM = game.users?.activeGM;
            if (!game.user.isGM || (activeGM && activeGM.id !== game.user.id)) return;
            await recordMovementDamage({ trigger, spell, region, event, activity });
        } catch (err) {
            console.error("Region Spell Automation | Movement damage tracking failed:", err);
            ui.notifications.error(`${spell.name}: ${err.message}`);
        }
        return;
    }


    const sharedKey = getSharedCardKey(trigger, spell, region, event, game.combat);
    const sharedMessage = sharedKey
        ? game.messages.get(sharedCardHistory.get(sharedKey)) ??
            Array.from(game.messages.values()).reverse().find(message =>
                message.getFlag?.(MODULE_ID, "sharedCardKeys")?.includes(sharedKey))
        : null;

    if (sharedMessage) {
        try {
            const isNewTarget = !sharedMessage.system.targets?.some(target => target.token === targetDoc.uuid);
            await appendSharedTarget(sharedMessage, describeTarget(targetDoc));
            if (isNewTarget) await promptTargetSave(sharedMessage, targetDoc, trigger);
            if (turnKey) oncePerTurnHistory.add(turnKey);
            console.log(`Region Spell Automation | Added "${targetToken.name}" to this turn's shared card for "${spell.name}".`);
        } catch (err) {
            console.error("Region Spell Automation | Could not add shared-card target:", err);
            ui.notifications.error(`${spell.name}: could not add target to shared card. Check F12 console.`);
        }
        return;
    }

    // --------------------------------------------------------
    // PRESERVE TARGETS
    // --------------------------------------------------------

    const oldTargets =
        Array.from(
            game.user.targets
        );


    targetToken.setTarget(
        true,
        {
            user:
                game.user,

            releaseOthers:
                true
        }
    );


    // --------------------------------------------------------
    // MARK ONCE PER TURN BEFORE EXECUTION
    // --------------------------------------------------------

    if (
        turnKey
    ) {

        oncePerTurnHistory.add(
            turnKey
        );
    }


    try {

        // ----------------------------------------------------
        // CAST LEVEL
        // ----------------------------------------------------

        const castLevel =
            region.flags?.dnd5e?.spellLevel ??
            spell.system.level;


        console.log(
            `Region Spell Automation | Running "${trigger.activity}" for "${spell.name}" → "${trigger.name}" on ${targetToken.name}.`,
            {
                event:
                    event.name,

                round:
                    event?.data?.round ??
                    game.combat?.round,

                turn:
                    event?.data?.turn ??
                    game.combat?.turn,

                oncePerTurn:
                    trigger.oncePerTurn ===
                    true
            }
        );


        // ----------------------------------------------------
        // EXECUTE ORIGINAL ACTIVITY
        // ----------------------------------------------------

        const results = await activity.use(
            {
                consume:
                    false,

                spell: {
                    slot:
                        `spell${castLevel}`
                },

                concentration: {
                    begin:
                        false
                },

                create: {
                    measuredTemplate:
                        false
                },

                subsequentActions:
                    true
            },

            {
                configure:
                    false
            },
            {
                data: {
                    system: { targets: [describeTarget(targetDoc)] },
                    flags: { [MODULE_ID]: { regionTriggered: true,
                        ...(sharedKey ? { sharedCardPerTurn: true, sharedCardKeys: [sharedKey] } : {}) } }
                }
            }
        );

        if (results?.message?.id) await promptTargetSave(results.message, targetDoc, trigger);

        if (sharedKey) {
            if (results?.message?.id) {
                sharedCardHistory.set(sharedKey, results.message.id);
            } else {
                // Canceled or prevented usage must be allowed to retry.
                if (turnKey) oncePerTurnHistory.delete(turnKey);
                console.warn("Region Spell Automation | Shared activity use produced no chat card; no allowance recorded.");
            }
        }

    }

    catch (err) {

        if (
            turnKey
        ) {

            oncePerTurnHistory.delete(
                turnKey
            );
        }


        console.error(
            `Region Spell Automation | "${spell.name}" / "${trigger.name}" failed:`,
            err
        );


        ui.notifications.error(
            `${spell.name} Region automation failed. Check F12 console.`
        );
    }

    finally {

        // ----------------------------------------------------
        // RESTORE TARGETS
        // ----------------------------------------------------

        targetToken.setTarget(
            false,
            {
                user:
                    game.user
            }
        );


        for (
            const token
            of oldTargets
        ) {

            token.setTarget(
                true,
                {
                    user:
                        game.user,

                    releaseOthers:
                        false,

                    groupSelection:
                        true
                }
            );
        }
    }
}


// ============================================================
// EXPOSE API
// ============================================================

globalThis.RegionSpellAutomation = {
    handleRegionEvent
};


// ============================================================
// READY
// ============================================================

Hooks.once("ready", () => {
    registerMovementDamageHooks(enqueueRegionEvent);
    registerSavePromptHooks();

    // Visibility controls the overlay without disabling Region behaviors.
    // Pre-creation runs on the creating client, including a player caster.
    Hooks.on("preCreateRegion", region => {
        const itemUUID = region.flags?.dnd5e?.item;
        if (!itemUUID) return;
        const item = fromUuidSync(itemUUID, { strict: false });
        const config = item ? game.settings.get(MODULE_ID, SETTING_KEY)?.[item.name] : null;
        if (config?.hideRegionFromPlayers === true) {
            region.updateSource({ visibility: CONST.REGION_VISIBILITY.GAMEMASTER });
        }
    });

    // A normal cast creates its usage card before placing the Region. Unlike
    // activity uses initiated by our event handler, that card wasn't previously
    // registered in sharedCardHistory. Seed it once the cast exposes its Regions.
    Hooks.on("dnd5e.postUseActivity", (activity, usage, results) => {
        const spell = activity?.item;
        const message = results?.message;
        if (!spell || !message?.id || !results?.templates?.length) return;
        const config = game.settings.get(MODULE_ID, SETTING_KEY)?.[spell.name];
        if (!config || config.enabled === false) return;
        const event = { data: { combat: game.combat, round: game.combat?.round, turn: game.combat?.turn } };
        const registrations = [];
        const sharedCardKeys = [];
        for (const trigger of config.triggers ?? []) {
            if (!trigger.shareCardPerTurn || trigger.movementDamage || trigger.activity !== activity.name) continue;
            for (const region of results.templates) {
                const key = getSharedCardKey(trigger, spell, region, event, game.combat);
                if (!key) continue;
                sharedCardHistory.set(key, message.id);
                sharedCardKeys.push(key);
                registrations.push(trigger);
            }
        }
        if (!registrations.length) return;
        // The hook does not await us, so register the card synchronously above;
        // serialize its metadata and limiter updates with later Region events.
        enqueueRegionEvent(async () => {
            await message.update({
                [`flags.${MODULE_ID}.sharedCardPerTurn`]: true,
                [`flags.${MODULE_ID}.sharedCardKeys`]: sharedCardKeys
            });
            if (message.getFlag?.(MODULE_ID, "targetsConfirmationPending")) {
                pendingCastAllowances.set(message.id, { registrations, event });
                return;
            }
            for (const trigger of registrations) {
                if (!trigger.oncePerTurn) continue;
                for (const descriptor of message.system.targets ?? []) {
                    const token = descriptor.token ? await fromUuid(descriptor.token) : null;
                    if (!token?.id) continue;
                    const key = getOncePerTurnKey(trigger, token, event);
                    if (key) oncePerTurnHistory.add(key);
                }
            }
        }).catch(err => {
            console.error("Region Spell Automation | Initial shared-card registration failed:", err);
            ui.notifications.error("Could not register the initial spell card for sharing. Check F12 console.");
        });
    });

    Hooks.on("regionSpellAutomation.targetsConfirmed", message => {
        const pending = pendingCastAllowances.get(message.id);
        if (!pending) return;
        pendingCastAllowances.delete(message.id);
        enqueueRegionEvent(async () => {
            for (const trigger of pending.registrations) {
                if (!trigger.oncePerTurn) continue;
                for (const descriptor of message.system.targets ?? []) {
                    const token = descriptor.token ? await fromUuid(descriptor.token) : null;
                    if (!token?.id) continue;
                    const key = getOncePerTurnKey(trigger, token, pending.event);
                    if (key) oncePerTurnHistory.add(key);
                }
            }
        }).catch(err => console.error("Region Spell Automation | Confirmed target registration failed:", err));
    });

    console.log("Region Spell Automation | Installing v0.5.7 Region hook");


    // ========================================================
    // COMBAT CLEANUP
    // ========================================================

    Hooks.on(
        "deleteCombat",

        () => {

            oncePerTurnHistory.clear();
            sharedCardHistory.clear();
            pendingCastAllowances.clear();


            console.log(
                "Region Spell Automation | Once Per Turn history cleared."
            );
        }
    );

    // Damage may be rolled after later targets have entered, or a damage
    // dialog may still be open when they enter. Capture the current card list
    // when that damage message is created, without rerolling anything.
    Hooks.on("preCreateChatMessage", message => {
        if (message.type !== "damage") return;
        const origin = message.system?.origin;
        if (!origin?.getFlag?.(MODULE_ID, "sharedCardPerTurn")) return;
        let targets = Array.from(message.system.targets ?? []);
        for (const descriptor of origin.system.targets ?? []) {
            targets = mergeTargets(targets, descriptor);
        }
        message.updateSource({ "system.targets": targets });
    });


    // ========================================================
    // SPELL TEMPLATE / REGION CREATED
    // ========================================================

    const attachSpellRegions = async (
            activity,
            regions
        ) => {

            const item =
                activity?.item;


            if (!item) {
                return;
            }


            // ------------------------------------------------
            // CONFIG
            // ------------------------------------------------

            const spellTable =
                game.settings.get(
                    MODULE_ID,
                    SETTING_KEY
                ) ?? {};


            const config =
                spellTable[
                    item.name
                ];


            if (!config) {
                return;
            }


            if (
                config.enabled ===
                false
            ) {
                return;
            }


            const triggers =
                Array.isArray(
                    config.triggers
                )
                    ? config.triggers
                    : [];


            const regionEffects =
                Array.isArray(
                    config.regionEffects
                )
                    ? config.regionEffects
                    : [];


            if (
                !triggers.length &&
                !regionEffects.length
            ) {

                console.warn(
                    `Region Spell Automation | "${item.name}" has no triggers or Region Effects.`
                );

                return;
            }


            // ------------------------------------------------
            // VALIDATE REGIONS
            // ------------------------------------------------

            if (
                !Array.isArray(
                    regions
                ) ||
                !regions.length
            ) {

                console.warn(
                    `Region Spell Automation | "${item.name}" created no Regions.`
                );

                return;
            }


            // =================================================
            // PROCESS EACH REGION
            // =================================================

            for (
                const region
                of regions
            ) {

                if (!region) {
                    continue;
                }


                // =================================================
                // ACTIVITY TRIGGER BEHAVIORS
                // =================================================

                const behaviorData =
                    [];


                const behaviorMeta =
                    [];


                for (
                    const trigger
                    of triggers
                ) {

                    if (
                        !trigger?.id
                    ) {

                        console.warn(
                            `Region Spell Automation | "${item.name}" contains a trigger with no ID.`,
                            trigger
                        );

                        continue;
                    }


                    if (
                        !trigger?.name
                    ) {

                        console.warn(
                            `Region Spell Automation | "${item.name}" contains an unnamed trigger.`
                        );

                        continue;
                    }


                    const configuredEvents = trigger.movementDamage ? [...MOVEMENT_EVENTS] :
                        Array.isArray(
                            trigger.events
                        )
                            ? [
                                ...trigger.events
                            ]
                            : [];


                    if (
                        !configuredEvents.length
                    ) {
                        continue;
                    }


                    const behaviorName =
                        `${item.name} - ${trigger.name}`;


                    // ----------------------------------------
                    // DUPLICATE CHECK
                    // ----------------------------------------

                    const alreadyAttached =
                        Array.from(
                            region.behaviors ??
                            []
                        )
                            .some(
                                existing =>
                                    existing.type ===
                                        "executeScript" &&

                                    existing.name ===
                                        behaviorName
                            );


                    if (
                        alreadyAttached
                    ) {
                        continue;
                    }


                    // ----------------------------------------
                    // tokenEnter WORKAROUND
                    // ----------------------------------------

                    const usesTokenEnter =
                        configuredEvents.includes(
                            "tokenEnter"
                        );


                    const initialEvents =
                        configuredEvents.filter(
                            eventName =>
                                eventName !==
                                "tokenEnter"
                        );


                    // ----------------------------------------
                    // EXECUTE SCRIPT
                    // ----------------------------------------

                    const source = `
await globalThis.RegionSpellAutomation.handleRegionEvent({
    event,
    region,
    scene,
    behavior,
    triggerId: ${JSON.stringify(trigger.id)}
});
`;


                    behaviorData.push(
                        {
                            name:
                                behaviorName,

                            type:
                                "executeScript",

                            system: {
                                events:
                                    initialEvents,

                                source
                            }
                        }
                    );


                    behaviorMeta.push(
                        {
                            behaviorName,

                            configuredEvents,

                            usesTokenEnter
                        }
                    );
                }


                // =================================================
                // CREATE ACTIVITY BEHAVIORS
                // =================================================

                if (
                    behaviorData.length
                ) {

                    let createdBehaviors =
                        [];


                    try {

                        createdBehaviors =
                            await region.createEmbeddedDocuments(
                                "RegionBehavior",
                                behaviorData
                            );

                    }

                    catch (err) {

                        console.error(
                            `Region Spell Automation | Failed creating activity behaviors for "${item.name}":`,
                            err
                        );


                        ui.notifications.error(
                            `${item.name}: failed to attach Region activity automation.`
                        );
                    }


                    // ----------------------------------------
                    // ADD tokenEnter AFTER CREATION
                    // ----------------------------------------

                    if (
                        createdBehaviors?.length
                    ) {

                        const updates =
                            [];


                        for (
                            let i = 0;
                            i < createdBehaviors.length;
                            i++
                        ) {

                            const created =
                                createdBehaviors[i];


                            const meta =
                                behaviorMeta[i];


                            if (
                                !created ||
                                !meta
                            ) {
                                continue;
                            }


                            if (
                                meta.usesTokenEnter
                            ) {

                                updates.push(
                                    {
                                        _id:
                                            created.id,

                                        "system.events":
                                            meta.configuredEvents
                                    }
                                );
                            }
                        }


                        if (
                            updates.length
                        ) {

                            try {

                                await region.updateEmbeddedDocuments(
                                    "RegionBehavior",
                                    updates
                                );

                            }

                            catch (err) {

                                console.error(
                                    `Region Spell Automation | Failed applying tokenEnter updates for "${item.name}":`,
                                    err
                                );
                            }
                        }
                    }
                }


                // =================================================
                // REGION ACTIVE EFFECTS
                // =================================================

                for (
                    const regionEffect
                    of regionEffects
                ) {

                    if (
                        !regionEffect?.id ||
                        (!regionEffect?.effectUuid && !regionEffect?.effectName)
                    ) {
                        continue;
                    }


                    // ----------------------------------------
                    // VERIFY EFFECT
                    // ----------------------------------------

                    let effect =
                        null;


                    try {

                        effect =
                            await resolveRegionEffect(regionEffect, item, fromUuid);

                    }

                    catch (err) {

                        console.warn(
                            `Region Spell Automation | Failed resolving Region Effect "${regionEffect.name}".`,
                            err
                        );
                    }


                    if (
                        !effect
                    ) {

                        ui.notifications.warn(
                            `${item.name}: Region Effect "${regionEffect.name}" could not be found.`
                        );

                        continue;
                    }


                    const behaviorName =
                        `${item.name} - Effect - ${regionEffect.name}`;


                    // ----------------------------------------
                    // DUPLICATE CHECK
                    // ----------------------------------------

                    const alreadyAttached =
                        Array.from(
                            region.behaviors ??
                            []
                        )
                            .some(
                                existing =>
                                    existing.type ===
                                        "dnd5e.applyActiveEffect" &&

                                    existing.name ===
                                        behaviorName
                            );


                    if (
                        alreadyAttached
                    ) {
                        continue;
                    }


                    // ----------------------------------------
                    // NATIVE DND5E REGION EFFECT
                    // ----------------------------------------

                    try {

                        await region.createEmbeddedDocuments(
                            "RegionBehavior",
                            [
                                {
                                    name:
                                        behaviorName,

                                    type:
                                        "dnd5e.applyActiveEffect",

                                    system: {
                                        effects: [
                                            effect.uuid
                                        ],

                                        dispositions:
                                            [],

                                        sizes:
                                            [],

                                        types:
                                            []
                                    }
                                }
                            ]
                        );


                        console.log(
                            `Region Spell Automation | Attached Region Effect "${regionEffect.name}" to "${item.name}".`
                        );

                    }

                    catch (err) {

                        console.error(
                            `Region Spell Automation | Failed attaching Region Effect "${regionEffect.name}" to "${item.name}":`,
                            err
                        );


                        ui.notifications.error(
                            `${item.name}: failed to attach Region Effect "${regionEffect.name}".`
                        );
                    }
                }
            }
        };



    // Core document creation hooks reach GM clients for player-created Regions.
    // D&D5e's local post-template hook ran on the caster and cannot write
    // GM-only RegionBehavior documents when that caster is a player.
    Hooks.on("createRegion", async (region, options, userId) => {
        const activeGM = game.users?.activeGM;
        if (!game.user.isGM || (activeGM && activeGM.id !== game.user.id)) return;
        const itemUUID = region.flags?.dnd5e?.item;
        if (!itemUUID) return;
        try {
            const item = await fromUuid(itemUUID);
            if (item) {
                const update = { [`flags.${MODULE_ID}.casterUserId`]: userId ?? game.user.id };
                const config = game.settings.get(MODULE_ID, SETTING_KEY)?.[item.name];
                if (config?.hideRegionFromPlayers === true) update.visibility = CONST.REGION_VISIBILITY.GAMEMASTER;
                await region.update(update);
                await attachSpellRegions({ item }, [region]);
            }
        } catch (err) {
            console.error("Region Spell Automation | GM Region setup failed:", err);
            ui.notifications.error("Could not configure spell Region automation. Check F12 console.");
        }
    });
    console.log(
        "Region Spell Automation | v0.5.7 Ready"
    );
});
