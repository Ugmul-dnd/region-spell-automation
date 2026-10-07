// ============================================================
// Region Spell Automation
// v0.5.5
// Foundry VTT v14 / D&D5e 6.0.5
//
// Features:
// - Multiple activity triggers per spell
// - Multiple events per trigger
// - Per-trigger targeting
// - Optional Once Per Turn limiter
// - Native D&D5e Region Active Effects
// - tokenEnter delayed-attachment workaround
// - Skip End Turn triggers for dead/defeated/0 HP tokens
// ============================================================

const MODULE_ID = "region-spell-automation";
const SETTING_KEY = "spellTable";

import { appendSharedTarget, createEventQueue, describeTarget, getSharedCardKey, mergeTargets }
    from "./shared-activity-card.js";
import { MOVEMENT_EVENTS, recordMovementDamage, registerMovementDamageHooks } from "./movement-damage.js";

const sharedCardHistory = new Map();
const enqueueRegionEvent = createEventQueue();


// ============================================================
// ONCE-PER-TURN HISTORY
// ============================================================

const oncePerTurnHistory =
    new Set();


console.log(
    "Region Spell Automation | v0.5.5 JS loaded"
);


// ============================================================
// INIT
// ============================================================

Hooks.once("init", () => {

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
// DEAD / DEFEATED CHECK
// ============================================================

function isDefeatedOrDead(
    targetDoc
) {

    const actor =
        targetDoc?.actor;


    // --------------------------------------------------------
    // HP CHECK
    // --------------------------------------------------------

    const hp =
        actor?.system
            ?.attributes
            ?.hp
            ?.value;


    if (
        typeof hp === "number" &&
        hp <= 0
    ) {

        return true;
    }


    // --------------------------------------------------------
    // DEAD STATUS
    // --------------------------------------------------------

    if (
        actor?.statuses
            ?.has?.("dead")
    ) {

        return true;
    }


    // --------------------------------------------------------
    // COMBATANT DEFEATED FLAG
    // --------------------------------------------------------

    const combat =
        game.combat;


    if (combat) {

        const combatant =
            combat.combatants.find(
                entry =>
                    entry.tokenId ===
                    targetDoc.id
            );


        if (
            combatant?.defeated
        ) {

            return true;
        }
    }


    return false;
}


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
    // SKIP END TURN FOR DEAD / DEFEATED
    // ========================================================

    if (
        event.name ===
            "tokenTurnEnd" &&
        isDefeatedOrDead(
            targetDoc
        )
    ) {

        console.log(
            `Region Spell Automation | Skipping End Turn trigger for dead/defeated token "${targetToken.name}".`
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
            await recordMovementDamage({ trigger, spell, region, event, activity });
        } catch (err) {
            console.error("Region Spell Automation | Movement damage tracking failed:", err);
            ui.notifications.error(`${spell.name}: ${err.message}`);
        }
        return;
    }

    const sharedKey = getSharedCardKey(trigger, spell, region, event, game.combat);
    const sharedMessage = sharedKey
        ? game.messages.get(sharedCardHistory.get(sharedKey))
        : null;

    if (sharedMessage) {
        try {
            await appendSharedTarget(sharedMessage, describeTarget(targetDoc));
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
            sharedKey ? {
                data: {
                    system: { targets: [describeTarget(targetDoc)] },
                    flags: { [MODULE_ID]: { sharedCardPerTurn: true } }
                }
            } : {}
        );

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

    console.log(
        "Region Spell Automation | Installing v0.5.5 Region hook"
    );


    // ========================================================
    // COMBAT CLEANUP
    // ========================================================

    Hooks.on(
        "deleteCombat",

        () => {

            oncePerTurnHistory.clear();
            sharedCardHistory.clear();


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

    Hooks.on(
        "dnd5e.postCreateMeasuredTemplate",

        async (
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
                        !regionEffect?.effectUuid
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
                            await fromUuid(
                                regionEffect.effectUuid
                            );

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
                                            regionEffect.effectUuid
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
        }
    );


    console.log(
        "Region Spell Automation | v0.5.5 Ready"
    );
});
