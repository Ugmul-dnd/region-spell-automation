import assert from "node:assert/strict";
const hooks=new Map();globalThis.Hooks={once:(name,fn)=>hooks.set(name,fn)};
class App{_onRender(){}render(){}async close(){}}
globalThis.foundry={applications:{api:{ApplicationV2:App}},utils:{escapeHTML:String}};
const registry=new Map(),values=new Map(),writes=[];
globalThis.game={user:{isGM:true},i18n:{localize:value=>value},settings:{settings:registry,get:(module,key)=>values.get(key),async set(module,key,value){values.set(key,value);writes.push(key);},registerMenu(){}}};
const {ModuleSettingsApp,SETTINGS_GROUPS}=await import(`data:text/javascript;base64,${process.env.RSA_MODULE_SETTINGS_SOURCE}`);
for(const group of SETTINGS_GROUPS)for(const key of group.keys){registry.set(`region-spell-automation.${key}`,{name:key,hint:"Description",scope:key==="scrollChatOnOpen"?"client":"world",config:true});values.set(key,true);}
hooks.get("init")();hooks.get("ready")();assert.ok([...registry.values()].every(setting=>setting.config===false));
const app=new ModuleSettingsApp();const html=await app._renderHTML();assert.match(html,/Regions/);assert.match(html,/Rolls &amp; Damage|Rolls & Damage/);assert.match(html,/Open Spell and Region Manager/);
app.draft.set("regionPlacementControls",false);app.activeTab="rolls";await app._renderHTML();app.activeTab="regions";
assert.match(await app._renderHTML(),/data-rsa-setting="regionPlacementControls"\s+\s/);
assert.equal(values.get("regionPlacementControls"),true,"Tab navigation does not write drafts");
await app.saveDraft();assert.deepEqual(writes,["regionPlacementControls"]);
game.user.isGM=false;const player=new ModuleSettingsApp();await player._renderHTML();player.draft.set("promptDamageOnHit",false);player.draft.set("scrollChatOnOpen",false);await player.saveDraft();
assert.equal(values.get("promptDamageOnHit"),true);assert.equal(values.get("scrollChatOnOpen"),false);
assert.match(await player._renderHTML(),/disabled/);
console.log("Settings interface checks passed: groups, draft persistence, unchanged values, standard-field hiding, client saving and GM permissions.");
