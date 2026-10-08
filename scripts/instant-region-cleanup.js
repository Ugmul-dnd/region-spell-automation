const MODULE_ID = "region-spell-automation";

export function shouldCleanInstantRegion(item, config, activity = null) {
    const duration = item?.type === "feat" || activity?.duration?.override
        ? activity?.duration ?? item?.system?.duration : item?.system?.duration;
    return ["spell", "feat"].includes(item?.type) && duration?.units === "inst" && !duration.concentration &&
        !item.system?.properties?.has?.("concentration") &&
        !(config?.triggers?.length || config?.regionEffects?.length);
}

function isActiveGM() {
    return game.user.isGM && (!game.users.activeGM || game.users.activeGM.id === game.user.id);
}

export async function trackInstantRegion(region) {
    if (!game.settings.get(MODULE_ID, "cleanupTargetingRegions")) return;
    if (!isActiveGM()) return;
    const itemUUID = region.flags?.dnd5e?.item;
    const casterTokenUuid = region.flags?.dnd5e?.origin;
    if (!itemUUID || !casterTokenUuid) return;
    const item = await fromUuid(itemUUID);
    const activityUUID = region.flags?.dnd5e?.activity;
    const activity = activityUUID ? await fromUuid(activityUUID) : null;
    const config = item ? game.settings.get(MODULE_ID, "spellTable")?.[item.name] : null;
    if (!shouldCleanInstantRegion(item, config, activity)) return;
    const matchesCaster = combat => combat.started &&
        combat.combatants.some(combatant => combatant.token?.uuid === casterTokenUuid);
    const combat = game.combats?.find(matchesCaster) ?? (game.combat && matchesCaster(game.combat) ? game.combat : null);
    if (!combat) return; // Without a combat turn there is no automatic deadline.
    await region.update({ [`flags.${MODULE_ID}.instantTurnCleanup`]: {
        combatId: combat.id, casterTokenUuid, itemUUID, activityUUID
    } });
}

export async function cleanupInstantRegions(combat, changes, options = {}) {
    if (!game.settings.get(MODULE_ID, "cleanupTargetingRegions")) return;
    if (!isActiveGM() || options.turnEvents === false || (!Object.hasOwn(changes, "turn") && !Object.hasOwn(changes, "round"))) return;
    const previous = combat.previous, current = combat.current;
    if (!previous?.combatantId || !Number.isFinite(previous.round) || !Number.isFinite(previous.turn)) return;
    const advances = current?.round > previous.round ||
        (current?.round === previous.round && current?.turn > previous.turn);
    if (!advances) return; // Initiative changes, refreshes, and rewinds aren't turn ends.
    const endedToken = combat.combatants.get(previous.combatantId)?.token;
    if (!endedToken?.uuid) return;
    for (const scene of game.scenes) {
        const ids = [];
        for (const region of scene.regions) {
            const marker = region.flags?.[MODULE_ID]?.instantTurnCleanup;
            if (marker?.combatId !== combat.id || marker.casterTokenUuid !== endedToken.uuid) continue;
            if (region.flags?.dnd5e?.item !== marker.itemUUID || region.flags?.dnd5e?.origin !== marker.casterTokenUuid) continue;
            // A configuration may have been added after casting. Preserve it.
            const item = await fromUuid(marker.itemUUID);
            const activity = marker.activityUUID ? await fromUuid(marker.activityUUID) : null;
            const config = item ? game.settings.get(MODULE_ID, "spellTable")?.[item.name] : null;
            if (shouldCleanInstantRegion(item, config, activity)) ids.push(region.id);
        }
        if (ids.length) {
            await scene.deleteEmbeddedDocuments("Region", ids);
            console.log(`Region Spell Automation | Removed ${ids.length} instantaneous spell Region(s) after the caster's turn.`);
        }
    }
}

function reportError(err) {
    console.error("Region Spell Automation | Instantaneous Region cleanup failed:", err);
    ui.notifications.error("Could not clean up an instantaneous spell Region. Check F12 console.");
}

Hooks.once("init", () => game.settings.register(MODULE_ID, "cleanupTargetingRegions", {
    name: "Remove Instantaneous Areas at Turn End",
    hint: "Remove new instantaneous spell/Feature targeting Regions when their user's turn ends. Manager-configured ongoing areas are preserved. Turning this off stops automatic deletion.",
    scope: "world", config: true, type: Boolean, default: true
}));

Hooks.once("ready", () => {
    Hooks.on("createRegion", region => { trackInstantRegion(region).catch(reportError); });
    Hooks.on("updateCombat", (combat, changes, options) => {
        cleanupInstantRegions(combat, changes, options).catch(reportError);
    });
});
