import assert from "node:assert/strict";
class BaseApplication { _onRender() {} render() {} }
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
globalThis.ui = {notifications:{info(){},error(message){throw new Error(message);}}};
globalThis.Hooks = {once(){},on(){}};
const source = Buffer.from(process.env.RSA_MANAGER_SOURCE,"base64").toString()
    .replace('"./starter-spells.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_STARTER_SOURCE}`))
    + "\nglobalThis.RSA_TEST_MANAGER = RegionSpellManager;";
await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const manager = new globalThis.RSA_TEST_MANAGER();
manager.element=root;
manager._onRender({},{});
hideBoxes[0].checked=true;
await hideBoxes[0].events.change();
assert.equal(table["Spirit Guardians"].hideRegionFromPlayers,true);
assert.equal(table["Spirit Guardians"].enabled,true);
assert.equal(table["Spike Growth"].hideRegionFromPlayers,undefined);
assert.match(await manager._renderHTML({},{}),/class="rsa-hide-region" data-spell="Spirit%20Guardians"\s+checked/);
foundry.applications.api.DialogV2.input = async () => ({triggerName:"Entry",activity:"Damage",tokenEnter:true,targeting:"everyone"});
const configuredItem = {name:"Spirit Guardians",uuid:"Actor.caster.Item.spell",
    system:{activities:[{id:"damage",name:"Damage",type:"damage"}]}};
await manager._configureTrigger(configuredItem,null);
assert.equal(table["Spirit Guardians"].hideRegionFromPlayers,true,"Saving a trigger preserves spell visibility setting");
assert.match(await manager._renderHTML({},{}),/class="rsa-hide-region" data-spell="Spirit%20Guardians"\s+checked/);
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
assert.equal(cards[0].style.display,"none");assert.equal(cards[1].style.display,"");
nodes.get("#rsa-search").value="guardians";
nodes.get("#rsa-search").events.input();
assert.equal(cards[1].style.display,"none");
await click("#rsa-show-enabled");
assert.equal(cards[0].style.display,"");
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
