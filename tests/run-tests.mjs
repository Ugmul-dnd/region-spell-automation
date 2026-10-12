import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(testDir);
const files={
    RSA_SHARED_SOURCE:"scripts/shared-activity-card.js",
    RSA_RUNTIME_SOURCE:"scripts/region-spell-automation.js",
    RSA_MOVEMENT_SOURCE:"scripts/movement-damage.js",
    RSA_STARTER_SOURCE:"scripts/starter-spells.js",
    RSA_HUD_SOURCE:"scripts/concentration-hud.js",
    RSA_MANAGER_SOURCE:"scripts/spell-manager.js",
    RSA_CAST_SAVE_SOURCE:"scripts/spell-save-prompts.js",
    RSA_INSTANT_CLEANUP_SOURCE:"scripts/instant-region-cleanup.js",
    RSA_RETARGET_SOURCE:"scripts/retarget-card.js",
    RSA_SAVE_CONTROLS_SOURCE:"scripts/save-roll-controls.js",
    RSA_AREA_CONFIRM_SOURCE:"scripts/area-target-confirmation.js",
    RSA_DAMAGE_SOURCE:"scripts/damage-prompts.js",
    RSA_EFFECT_AUTOMATION_SOURCE:"scripts/effect-automation.js",
    RSA_SHIELD_SOURCE:"scripts/shield-reaction.js",
    RSA_CARD_PRESENTATION_SOURCE:"scripts/card-presentation.js",
    RSA_DAMAGE_MODE_SOURCE:"scripts/damage-roll-controls.js",
    RSA_PLACEMENT_SOURCE:"scripts/region-placement-controls.js",
    RSA_MODULE_SETTINGS_SOURCE:"scripts/module-settings.js",
    RSA_MASTERY_SOURCE:"scripts/weapon-masteries.js",
    RSA_DAMAGE_UNDO_SOURCE:"scripts/damage-undo.js",
    RSA_NPC_DAMAGE_SOURCE:"scripts/npc-damage-automation.js",
    RSA_CONDITIONS_SOURCE:"scripts/region-conditions.js",
    RSA_CONDITIONS_MANIFEST:"module.json"
};
const sources=Object.fromEntries(Object.entries(files).map(([key,file])=>[key,fs.readFileSync(path.join(root,file)).toString("base64")]));
sources.RSA_SAVE_PROMPT_SOURCE=Buffer.from(fs.readFileSync(path.join(root,"scripts/save-prompts.js"),"utf8")
    .replace('"./shared-activity-card.js"',JSON.stringify(`data:text/javascript;base64,${sources.RSA_SHARED_SOURCE}`))).toString("base64");

// Feed sources through stdin. Large source strings exceed Windows environment
// variable limits, so each isolated test gets a plain in-process object instead.
const prefix=`process.env={...process.env,...${JSON.stringify(sources)}};\n`;
let failures=0;
const tests=fs.readdirSync(testDir).filter(file=>file.endsWith(".test.mjs")).sort();
for(const file of tests) {
    const result=spawnSync(process.execPath,["--input-type=module"],{
        cwd:root,input:prefix+fs.readFileSync(path.join(testDir,file),"utf8"),encoding:"utf8",maxBuffer:4*1024*1024
    });
    if(result.status===0&&!result.error)console.log(`PASS ${file}`);
    else {
        failures++;
        console.error(`FAIL ${file}`);
        const output=result.error?.message??result.stderr??result.stdout;
        console.error(output.split("\n").map(line=>line.length>2000?"[Long data URL omitted]":line).join("\n"));
    }
}
console.log(`${tests.length-failures}/${tests.length} test suites passed.`);
if(failures)process.exitCode=1;
