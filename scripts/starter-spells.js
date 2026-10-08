// Configuration recipes only: no PHB spell text, activities, or effect data.
export const STARTER_SOURCE = "Based on Ugmul's Foundry Player's Handbook spell setup. Review against your installed spell version.";
export const STARTER_SPELLS = {
    "Hunger of Hadar": {
        triggers: [
            { name: "Start-turn damage", activity: "Start of Turn Damage", events: ["tokenTurnStart"], targeting: "everyone" },
            { name: "End-turn save", activity: "End of Turn Save", events: ["tokenTurnEnd"], targeting: "everyone" }
        ], regionEffects: [{ name: "Hunger of Hadar", effectName: "Hunger of Hadar" }]
    },
    "Spirit Guardians": {
        triggers: [{ name: "Entry and end-turn save", activity: "Cast and Save", events: ["tokenEnter", "tokenTurnEnd"],
            targeting: "hostilesOnly", oncePerTurn: true, shareCardPerTurn: true }], regionEffects: []
    },
    "Grease": {
        triggers: [{ name: "Entry and end-turn save", activity: "Save", events: ["tokenEnter", "tokenTurnEnd"], targeting: "everyone" }],
        regionEffects: []
    },
    "Spike Growth": {
        triggers: [{ name: "Movement damage", activity: "Damage", events: ["tokenMoveIn", "tokenMoveWithin", "tokenMoveOut"],
            targeting: "everyone", oncePerTurn: true, shareCardPerTurn: false, movementDamage: true, movementIncrement: 5 }], regionEffects: []
    },
    "Fog Cloud": {
        triggers: [{ name: "Entry activity", activity: "Use", events: ["tokenEnter"], targeting: "everyone", oncePerTurn: false }],
        regionEffects: [{ name: "Fog Cloud", effectName: "Fog Cloud" }]
    },
    "Conjure Animals": {
        triggers: [{ name: "Entry and end-turn save", activity: "Save", events: ["tokenEnter", "tokenTurnEnd"],
            targeting: "hostilesOnly", oncePerTurn: true }], regionEffects: []
    }
};

export function addStartingSpells(table, randomID) {
    const result = structuredClone(table ?? {});
    const added = [];
    for (const [name, recipe] of Object.entries(STARTER_SPELLS)) {
        if (Object.hasOwn(result, name)) continue;
        result[name] = {
            enabled: false, hideRegionFromPlayers: false, starterSource: STARTER_SOURCE,
            triggers: recipe.triggers.map(trigger => ({ ...structuredClone(trigger), id: randomID(),
                oncePerTurn: trigger.oncePerTurn ?? false, shareCardPerTurn: trigger.shareCardPerTurn ?? false })),
            regionEffects: recipe.regionEffects.map(effect => ({ ...effect, id: randomID() }))
        };
        added.push(name);
    }
    return { table: result, added };
}

export async function resolveRegionEffect(config, item, fromUuid) {
    // Starter recipes resolve against the actual caster's spell, never against
    // another world's actor or paid-compendium UUID.
    if (config.effectName) return item.effects?.find(effect => effect.name === config.effectName) ?? null;
    return config.effectUuid ? await fromUuid(config.effectUuid) : null;
}
