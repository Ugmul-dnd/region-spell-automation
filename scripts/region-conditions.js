const MODULE_ID = "region-spell-automation";
const TYPE = `${MODULE_ID}.conditions`;
const queues = new Map();
const isAuthority = () => game.user.isGM && (!game.users.activeGM || game.users.activeGM.id === game.user.id);

// Effects are separate per Region, including when an actor is already conditioned.
// Only effects carrying our source flag are ever removed.
export async function syncRegionConditions(region, conditions = [], removed = false) {
    if (!isAuthority()) return;
    const prior = queues.get(region.uuid) ?? Promise.resolve();
    const task = prior.catch(() => {}).then(async () => {
        const actors = new Map();
        for (const actor of game.actors) actors.set(actor.uuid, actor);
        for (const token of region.parent.tokens) if (token.actor) actors.set(token.actor.uuid, token.actor);
        const inside = new Set(removed ? [] : Array.from(region.tokens).map(token => token.actor?.uuid));
        for (const actor of actors.values()) {
            const owned = Array.from(actor.effects).filter(effect => effect.getFlag(MODULE_ID, "conditionRegion") === region.uuid);
            const wanted = inside.has(actor.uuid) ? conditions : [];
            const obsolete = owned.filter(effect => !wanted.includes(effect.getFlag(MODULE_ID, "conditionId")));
            if (obsolete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", obsolete.map(effect => effect.id));
            for (const id of wanted) {
                if (owned.some(effect => effect.getFlag(MODULE_ID, "conditionId") === id)) continue;
                const effect = await foundry.documents.ActiveEffect.fromStatusEffect(id, {parent: actor});
                const data = effect.toObject();
                delete data._id; // Do not reuse the standard condition's fixed ID.
                data.origin = region.uuid;
                data.flags ??= {};
                data.flags[MODULE_ID] = {...data.flags[MODULE_ID], conditionRegion: region.uuid, conditionId: id};
                await actor.createEmbeddedDocuments("ActiveEffect", [data]);
            }
        }
    });
    queues.set(region.uuid, task);
    try { await task; } finally { if (queues.get(region.uuid) === task) queues.delete(region.uuid); }
}

function report(err) {
    console.error("Region Spell Automation | Region conditions failed:", err);
    ui.notifications.error("Could not update Region conditions. Check the console.");
}

Hooks.once("init", () => {
    const fields = foundry.data.fields;
    class RegionConditions extends foundry.data.regionBehaviors.RegionBehaviorType {
        static defineSchema() {
            return {conditions: new fields.SetField(new fields.StringField({required:true, blank:false}))};
        }
        static events = Object.fromEntries([
            CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT,
            CONST.REGION_EVENTS.BEHAVIOR_ACTIVATED, CONST.REGION_EVENTS.BEHAVIOR_DEACTIVATED
        ].map(name => [name, async function () {
            const disabled = this.parent.disabled;
            await syncRegionConditions(this.region, Array.from(this.conditions), disabled);
        }]));
    }
    CONFIG.RegionBehavior.dataModels[TYPE] = RegionConditions;
    CONFIG.RegionBehavior.typeLabels[TYPE] = "Region Conditions";
});

Hooks.once("ready", () => {
    Hooks.on("createRegion", async region => {
        if (!isAuthority() || !region.flags?.dnd5e?.item) return;
        try {
            const item = await fromUuid(region.flags.dnd5e.item);
            const config = game.settings.get(MODULE_ID, "spellTable")?.[item?.name];
            if (!config || config.enabled === false || !config.regionConditions?.length) return;
            await region.createEmbeddedDocuments("RegionBehavior", [{name:"Region Conditions", type:TYPE,
                system:{conditions:config.regionConditions}}]);
            await syncRegionConditions(region, config.regionConditions);
        } catch (err) { report(err); }
    });
    Hooks.on("canvasReady", () => {
        if (!isAuthority()) return;
        for (const region of canvas.scene?.regions ?? []) {
            const behavior = Array.from(region.behaviors).find(behavior => behavior.type === TYPE);
            if (behavior) syncRegionConditions(region, Array.from(behavior.system.conditions), behavior.disabled).catch(report);
        }
    });
    Hooks.on("deleteRegion", region => syncRegionConditions(region, [], true).catch(report));
    Hooks.on("deleteRegionBehavior", behavior => {
        if (behavior.type === TYPE) syncRegionConditions(behavior.parent, [], true).catch(report);
    });
});
