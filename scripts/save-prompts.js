const MODULE_ID = "region-spell-automation";
const prompted = new Set();

export function selectSaveUser(actor, users, activeGM, castingGM = null) {
    const gm = castingGM?.active && castingGM.isGM ? castingGM : activeGM;
    if (actor.type === "npc") return gm ?? null;
    const owners = Array.from(users).filter(user => user.active && !user.isGM && actor.testUserPermission(user, "OWNER"));
    owners.sort((a, b) => Number(b.character?.id === actor.id) - Number(a.character?.id === actor.id) || a.id.localeCompare(b.id));
    return owners[0] ?? gm ?? null;
}

export async function receiveSavePrompt(packet) {
    const setting = packet.action === "promptSpellSave" ? "promptForSaveOnSpellCasts" : "promptForSaveOnRegionTriggers";
    if (game.settings.get(MODULE_ID, setting) !== true) return;
    if (packet.userId !== game.user.id) return;
    const message = game.messages.get(packet.messageId);
    const source = game.users.get(packet.sourceId);
    if (!message || !source?.active || (!source.isGM && message.author?.id !== source.id)) return;
    const token = await fromUuid(packet.tokenUuid);
    const actor = token?.actor;
    if (!message.system.targets?.some(target => target.token === packet.tokenUuid ||
        (actor?.uuid && target.actor === actor.uuid))) {
        console.warn("Region Spell Automation | Save prompt skipped: token is not recorded on the cast card.", packet.tokenUuid);
        return;
    }
    if (!actor?.isOwner || typeof actor.rollSavingThrow !== "function") {
        console.warn("Region Spell Automation | Save prompt skipped: target actor is unavailable or not owned.", packet.tokenUuid);
        return;
    }
    const user = selectSaveUser(actor, game.users, game.users.activeGM, source.isGM ? source : null);
    if (user?.id !== game.user.id) return;
    const activity = message.getAssociatedActivity?.();
    if (activity?.type !== "save") return;
    if (packet.action === "promptSpellSave" && (!["spell", "feat"].includes(activity.item?.type) || message.getFlag?.(MODULE_ID, "regionTriggered"))) return;
    const ability = Array.from(activity.save.ability ?? [])[0];
    const rawDC = activity.save.dc.value;
    const dc = rawDC == null || rawDC === "" ? NaN : Number(rawDC);
    if (!ability || !Number.isFinite(dc)) {
        console.warn("Region Spell Automation | Save prompt skipped: missing save ability or DC.", message.id);
        return;
    }
    const key = JSON.stringify([message.id, token.uuid]);
    if (prompted.has(key)) return;
    prompted.add(key);
    // Mirror D&D5e's card Save action, including activity bonus and origin.
    const bonus = CONFIG.Dice.BasicRoll.replaceFormulaData(activity.save.bonus ?? "", activity.getRollData(), { missing: 0 });
    const bonusData = CONFIG.Dice.BasicRoll.constructParts({ activityBonus: bonus });
    const config = { ability, target: dc };
    if (bonusData.parts.length) config.rolls = [bonusData];
    try {
        await actor.rollSavingThrow(config, { configure: true, options: { id: `rsa-save-${message.id}-${token.id ?? token.uuid}` } }, { data: {
            speaker: ChatMessage.getSpeaker({ actor, scene: token.parent, token }),
            system: { ...activity.messageSources, origin: message.id }
        } });
    } catch (err) {
        prompted.delete(key);
        throw err;
    }
}

export async function promptTargetSave(message, token, trigger) {
    if (game.settings.get(MODULE_ID, "promptForSaveOnRegionTriggers") !== true ||
        trigger.movementDamage || message.getAssociatedActivity?.()?.type !== "save") return;
    await sendSavePrompt(message, token, "region");
}

export async function sendSavePrompt(message, token, kind) {
    const setting = kind === "spell" ? "promptForSaveOnSpellCasts" : "promptForSaveOnRegionTriggers";
    if (game.settings.get(MODULE_ID, setting) !== true) return;
    const user = selectSaveUser(token.actor, game.users, game.users.activeGM, game.user.isGM ? game.user : null);
    if (!user) { ui.notifications.warn("No connected player or GM can receive this saving throw prompt."); return; }
    const packet = { action: kind === "spell" ? "promptSpellSave" : "promptRegionSave", messageId: message.id, tokenUuid: token.uuid,
        sourceId: game.user.id, userId: user.id };
    console.log("Region Spell Automation | Routing save prompt", {
        target: token.name ?? token.actor.name ?? token.uuid, recipient: user.name ?? user.id, gm: user.isGM
    });
    if (user.id === game.user.id) {
        // Do not block other Region events while the user decides how to roll.
        receiveSavePrompt(packet).catch(reportError);
    } else game.socket.emit(`module.${MODULE_ID}`, packet);
}

function reportError(err) {
    console.error("Region Spell Automation | Saving throw prompt failed:", err);
    ui.notifications.error("Could not prompt the affected token's saving throw. Use its chat-card Save button.");
}

export function registerSavePromptHooks() {
    game.socket?.on(`module.${MODULE_ID}`, packet => {
        if (["promptRegionSave", "promptSpellSave"].includes(packet?.action)) receiveSavePrompt(packet).catch(reportError);
    });
}
