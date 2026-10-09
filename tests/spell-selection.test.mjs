import assert from "node:assert/strict";
class BaseApplication { _onRender() {} render() { this.renderCount = (this.renderCount ?? 0) + 1; } close() { this.closed = true; } }
const nodes = new Map();
const makeNode = spell => ({ dataset: {spell:encodeURIComponent(spell)}, checked:false, disabled:false,
    events:{}, addEventListener(name, fn) { this.events[name]=fn; } });
for (const id of ["rsa-select-all","rsa-deselect-all","rsa-delete-selected","rsa-selected-count","rsa-enable-selected","rsa-disable-selected"]) nodes.set(`#${id}`,makeNode(""));
const boxes = [makeNode("Spirit Guardians"),makeNode("Spike Growth")];
const toggles = boxes.map(box=>makeNode(decodeURIComponent(box.dataset.spell)));
const hideBoxes = boxes.map(box=>makeNode(decodeURIComponent(box.dataset.spell)));
const root = { querySelector: selector=>nodes.get(selector) ?? null,
    querySelectorAll: selector=>selector===".rsa-select-spell"?boxes:selector===".rsa-toggle-enabled"?toggles:selector===".rsa-hide-region"?hideBoxes:[] };
let table = {"Spirit Guardians":{enabled:true,triggers:[],regionEffects:[]},"Spike Growth":{enabled:false,triggers:[],regionEffects:[]}};
let writes=0, confirm=false, prompt;
globalThis.foundry = { applications:{api:{ApplicationV2:BaseApplication,DialogV2:{async confirm(options){prompt=options;return confirm;}}}},
    utils:{deepClone:structuredClone,escapeHTML:String,randomID:()=>"random"} };
globalThis.game = {user:{isGM:true},settings:{get:()=>table,async set(id,key,value){writes++;table=value;}}};
globalThis.CONFIG = {statusEffects:{blinded:{id:"blinded",name:"Blinded"}}};
game.i18n = {localize: value => value};
globalThis.ui = {notifications:{info(){},error(message){throw new Error(message);}}};
globalThis.Hooks = {once(){},on(){}};
const source = Buffer.from(process.env.RSA_MANAGER_SOURCE,"base64").toString()
    .replace('"./starter-spells.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_STARTER_SOURCE}`))
    + "\nglobalThis.RSA_TEST_MANAGER = RegionSpellManager; globalThis.RSA_TEST_EDITOR = RegionSpellConfigEditor; globalThis.RSA_TEST_PICKER = RegionConditionPicker;";
await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const manager = new globalThis.RSA_TEST_MANAGER();
const editor = new globalThis.RSA_TEST_EDITOR(manager, "Spirit Guardians");
manager.element=root;
manager._onRender({},{});
hideBoxes[0].checked=true;
await hideBoxes[0].events.change();
assert.equal(table["Spirit Guardians"].hideRegionFromPlayers,true);
assert.equal(table["Spirit Guardians"].enabled,true);
assert.equal(table["Spike Growth"].hideRegionFromPlayers,undefined);
assert.match(await editor._renderHTML({},{}),/class="rsa-hide-region" data-spell="Spirit%20Guardians"\s+checked/);
foundry.applications.api.DialogV2.input = async () => ({triggerName:"Entry",activity:"Damage",tokenEnter:true,targeting:"everyone"});
const configuredItem = {name:"Spirit Guardians",uuid:"Actor.caster.Item.spell",
    system:{activities:[{id:"damage",name:"Damage",type:"damage"}]}};
await manager._configureTrigger(configuredItem,null);
assert.equal(table["Spirit Guardians"].hideRegionFromPlayers,true,"Saving a trigger preserves spell visibility setting");
assert.match(await editor._renderHTML({},{}),/class="rsa-hide-region" data-spell="Spirit%20Guardians"\s+checked/);
hideBoxes[0].checked=false;
await hideBoxes[0].events.change();
assert.equal(table["Spirit Guardians"].hideRegionFromPlayers,false);
writes=0;
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

// State filters combine with search and survive rendering; scroll is restored
// after the HTML replacement used by individual and bulk state changes.
for (const id of ["rsa-show-disabled","rsa-show-enabled","rsa-search","rsa-spell-count","rsa-no-results"]) {
    const node = makeNode("");
    node.style = {};
    node.attributes = {};
    node.setAttribute = (key,value) => { node.attributes[key]=value; };
    node.classList = {toggle(){}};
    nodes.set(`#${id}`,node);
}
const scroller = makeNode(""); scroller.scrollTop=0;
nodes.set("[data-rsa-manager-scroll]",scroller);
const cards = [
    {dataset:{searchName:"spirit guardians",enabled:"true"},style:{}},
    {dataset:{searchName:"spike growth",enabled:"false"},style:{}}
];
const originalQueryAll = root.querySelectorAll;
root.querySelectorAll = selector => selector === ".rsa-spell-card" ? cards : originalQueryAll(selector);
manager._onRender({},{});
await click("#rsa-show-disabled");
assert.equal(cards[0].style.display,"none");assert.equal(cards[1].style.display,"flex");
nodes.get("#rsa-search").value="guardians";
nodes.get("#rsa-search").events.input();
assert.equal(cards[1].style.display,"none");
await click("#rsa-show-enabled");
assert.equal(cards[0].style.display,"flex");
assert.equal(nodes.get("#rsa-show-enabled").attributes["aria-pressed"],"true");
scroller.scrollTop=850; scroller.events.scroll();
manager._replaceHTML("new content",{querySelector:()=>scroller},{});
scroller.scrollTop=0;
manager._onRender({},{});
assert.equal(scroller.scrollTop,850);
assert.equal(nodes.get("#rsa-search").value,"guardians");
assert.equal(manager.spellStateFilter,"enabled");
await click("#rsa-show-enabled");
assert.equal(manager.spellStateFilter,"all");
console.log("Filter/scroll checks passed: enabled/disabled filters, combined search, toggle to all, persistent search/filter and restored scroll.");

const compact = await manager._renderHTML({},{});
assert.match(compact, /rsa-edit-spell/);
assert.doesNotMatch(compact, /rsa-hide-region|rsa-add-trigger|rsa-add-effect/);
const detail = new globalThis.RSA_TEST_EDITOR(manager, "Spike Growth");
const detailHtml = await detail._renderHTML({},{});
assert.match(detailHtml, /Hide Region from Players/);
assert.match(detailHtml, /Activity Triggers/);
assert.match(detailHtml, /Region Effects/);
assert.doesNotMatch(detailHtml, /rsa-select-spell|rsa-add-starters|rsa-search|Spirit Guardians/);
const before = manager.renderCount ?? 0;
detail.render({force:true});
assert.equal(manager.renderCount, before + 1, "Editor changes refresh the manager");
const editButton = makeNode("Spike Growth");
root.querySelectorAll = selector => selector === ".rsa-edit-spell" ? [editButton] : originalQueryAll(selector);
manager._onRender({},{});
editButton.events.click();
const opened = manager.spellEditors.get("Spike Growth");
assert.ok(opened);
editButton.events.click();
assert.equal(manager.spellEditors.get("Spike Growth"), opened, "Reuse the spell editor");
delete table["Spike Growth"];
await manager._renderHTML({},{});
assert.equal(opened.closed, true, "Deleting a spell closes its editor");
console.log("Compact list/editor checks passed: separate details, manager refresh, editor reuse and deletion cleanup.");
CONFIG.statusEffects={z:{id:"z",name:"Zzz"},a:{id:"a",name:"Alpha"}};
table["Spike Growth"]={enabled:true,regionConditions:["z"],triggers:[],regionEffects:[]};
const picker=new RSA_TEST_PICKER(detail,"Spike Growth");
const pickerHtml=await picker._renderHTML();
assert.ok(pickerHtml.indexOf("Alpha") < pickerHtml.indexOf("Zzz"));
const conditionButtons=[{dataset:{rsaCondition:"a"},checked:true},{dataset:{rsaCondition:"z"},checked:false}];
const saveCondition=makeNode("");
picker.element={querySelector:()=>saveCondition,querySelectorAll:()=>conditionButtons};
picker._onRender({},{});
assert.deepEqual(table["Spike Growth"].regionConditions,["z"],"Draft selection does not save before confirmation");
await saveCondition.events.click();
assert.deepEqual(table["Spike Growth"].regionConditions,["a"]);
assert.equal(picker.closed,true);
assert.match(await detail._renderHTML(), /<li>Alpha<\/li>/);
assert.doesNotMatch(await detail._renderHTML(), /data-rsa-condition=/);
console.log("Condition picker checks passed: alphabetical choices, draft isolation, explicit save and selected-only summary.");