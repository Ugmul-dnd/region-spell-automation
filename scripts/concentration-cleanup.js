// ============================================================
// Region Spell Automation
// Concentration Cleanup
// ============================================================
console.log("RSA | CONCENTRATION FILE LOADED");

Hooks.once("ready", () => {
    const moduleId="region-spell-automation";
    const hasRegions=effect=>{
        const item=effect?.getFlag("dnd5e","item")?.uuid;
        return item&&Array.from(game.scenes).some(scene=>scene.regions.some(region=>region.flags?.dnd5e?.item===item));
    };
    Hooks.on("dnd5e.preEndConcentration",(actor,effect)=>{
        if(game.user.isGM||!hasRegions(effect))return;
        const gm=game.users.activeGM;
        if(!gm){ui.notifications.warn("A connected GM is required to end this Region aura.");return false;}
        game.socket.emit(`module.${moduleId}`,{action:"endRegionConcentration",actorUuid:actor.uuid,effectId:effect.id,userId:game.user.id,gmId:gm.id});
        return false;
    });
    game.socket.on(`module.${moduleId}`,async packet=>{
        if(packet?.action!=="endRegionConcentration"||!game.user.isGM||packet.gmId!==game.user.id||game.users.activeGM?.id!==game.user.id)return;
        const user=game.users.get(packet.userId),actor=await fromUuid(packet.actorUuid);
        const effect=actor?.effects.get(packet.effectId);
        if(!user?.active||!actor?.testUserPermission(user,"OWNER")||!actor.concentration.effects.has(effect)||!hasRegions(effect))return;
        try {await actor.endConcentration(effect);}catch(err){console.error("Region Spell Automation | GM aura cleanup failed:",err);}
    });

    Hooks.on(
        "dnd5e.endConcentration",

        async (actor, effect) => {
            if(!game.user.isGM||(game.users.activeGM&&game.users.activeGM.id!==game.user.id))return;

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
