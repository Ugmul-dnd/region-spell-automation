import assert from "node:assert/strict";
class BaseApplication { _onRender() {} render() {} }
const nodes = new Map();
const makeNode = spell => ({ dataset: {spell:encodeURIComponent(spell)}, checked:false, disabled:false,
    events:{}, addEventListener(name, fn) { this.events[name]=fn; } });
for (const id of ["rsa-select-all","rsa-deselect-all","rsa-delete-selected","rsa-selected-count","rsa-enable-selected","rsa-disable-selected"]) nodes.set(`#${id}`,makeNode(""));
const boxes = [makeNode("Spirit Guardians"),makeNode("Spike Growth")];
const toggles = boxes.map(box=>makeNode(decodeURIComponent(box.dataset.spell)));
const root = { querySelector: selector=>nodes.get(selector) ?? null,
    querySelectorAll: selector=>selector===".rsa-select-spell"?boxes:selector===".rsa-toggle-enabled"?toggles:[] };
let table = {"Spirit Guardians":{enabled:true,triggers:[],regionEffects:[]},"Spike Growth":{enabled:false,triggers:[],regionEffects:[]}};
let writes=0, confirm=false, prompt;
globalThis.foundry = { applications:{api:{ApplicationV2:BaseApplication,DialogV2:{async confirm(options){prompt=options;return confirm;}}}},
    utils:{deepClone:structuredClone,escapeHTML:String,randomID:()=>"random"} };
globalThis.game = {user:{isGM:true},settings:{get:()=>table,async set(id,key,value){writes++;table=value;}}};
globalThis.ui = {notifications:{info(){},error(message){throw new Error(message);}}};
globalThis.Hooks = {once(){},on(){}};
const source = Buffer.from(process.env.RSA_MANAGER_SOURCE,"base64").toString()
    .replace('"./starter-spells.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_STARTER_SOURCE}`))
    + "\nglobalThis.RSA_TEST_MANAGER = RegionSpellManager;";
await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const manager = new globalThis.RSA_TEST_MANAGER();
manager.element=root;
manager._onRender({},{});
const click = id=>nodes.get(id).events.click({currentTarget:nodes.get(id)});
await click("#rsa-select-all");
assert.equal(manager.selectedSpells.size,2);
assert.equal(writes,0);
assert.equal(table["Spike Growth"].enabled,false);
await click("#rsa-enable-selected");
assert.equal(table["Spike Growth"].enabled,true);
assert.equal(table["Spirit Guardians"].enabled,true);
assert.equal(manager.selectedSpells.size,2);
await click("#rsa-disable-selected");
assert.equal(table["Spike Growth"].enabled,false);
assert.equal(table["Spirit Guardians"].enabled,false);
assert.match(await manager._renderHTML({},{}), /Spirit Guardians \(Disabled\)/);
await click("#rsa-enable-selected");
assert.doesNotMatch(await manager._renderHTML({},{}), /Spirit Guardians \(Disabled\)/);
await click("#rsa-deselect-all");
assert.equal(manager.selectedSpells.size,0);
assert.equal(nodes.get("#rsa-delete-selected").disabled,true);
assert.equal(nodes.get("#rsa-enable-selected").disabled,true);
assert.equal(nodes.get("#rsa-disable-selected").disabled,true);
boxes[0].checked=true;boxes[0].events.change();
await click("#rsa-disable-selected");
assert.equal(table["Spirit Guardians"].enabled,false);
assert.equal(table["Spike Growth"].enabled,true,"Bulk state change preserves unselected spells");
await click("#rsa-enable-selected");
await toggles[0].events.click();
assert.equal(table["Spirit Guardians"].enabled,false);
assert.equal(manager.selectedSpells.size,1);
await click("#rsa-delete-selected");
assert.ok(table["Spirit Guardians"]);
assert.match(prompt.content,/cannot be undone/);
assert.equal(prompt.yes.label,"Yes");assert.equal(prompt.no.label,"No");
confirm=true;
await click("#rsa-delete-selected");
assert.equal(table["Spirit Guardians"],undefined);
assert.ok(table["Spike Growth"]);
assert.equal(manager.selectedSpells.size,0);
const html = await manager._renderHTML({},{});
assert.match(html,/rsa-toggle-enabled/);
assert.match(html,/Select all/);
console.log("Spell selection checks passed: independent selection/state, select/deselect all, cancel/confirm deletion, unselected preservation.");
