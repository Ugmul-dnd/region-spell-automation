// ============================================================
// Region Spell Automation
// Concentration Cleanup
// ============================================================
console.log("RSA | CONCENTRATION FILE LOADED");

Hooks.once("ready", () => {

    Hooks.on(
        "dnd5e.endConcentration",

        async (actor, effect) => {

            const itemUUID =
                effect.getFlag("dnd5e", "item")?.uuid;

            if (!itemUUID) return;

            for (const scene of game.scenes) {

                const matchingRegions =
                    scene.regions.filter(
                        region =>
                            region.flags?.dnd5e?.item === itemUUID
                    );

                if (!matchingRegions.length) continue;

                const regionIds =
                    matchingRegions.map(
                        region => region.id
                    );

                try {

                    await scene.deleteEmbeddedDocuments(
                        "Region",
                        regionIds
                    );

                    console.log(
                        `Region Spell Automation | Deleted ${regionIds.length} Region(s) from "${scene.name}" after concentration ended.`
                    );

                }
                catch (err) {

                    console.error(
                        `Region Spell Automation | Failed deleting Regions from "${scene.name}":`,
                        err
                    );
                }
            }
        }
    );

    console.log(
        "Region Spell Automation | Concentration cleanup ready"
    );
});