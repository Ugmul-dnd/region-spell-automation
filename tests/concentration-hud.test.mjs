import assert from "node:assert/strict";
const hooks = new Map();
globalThis.Hooks = { once: (name, fn) => hooks.set(name, fn), on: (name, fn) => hooks.set(name, fn) };
globalThis.game = { system: { id: "dnd5e" } };
globalThis.canvas = { hud: {} };
class Element {
    constructor() { this.dataset = {}; this.style = {}; this.events = {}; this.children = []; }
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    addEventListener(name, fn) { this.events[name] = fn; }
    querySelector(selector) {
        if (selector === ".col.right") return this.column;
        return this.column?.children.find(child => "rsaEndConcentration" in child.dataset);
    }
}
globalThis.HTMLElement = Element;
globalThis.document = { createElement: () => new Element() };
const source = process.env.RSA_HUD_SOURCE;
const helpers = await import(`data:text/javascript;base64,${source}`);
hooks.get("ready")();
let calls = 0, release;
const actor = { isOwner: true, concentration: { effects: new Set([{}]), items: new Set([{name:"Spirit Guardians"}]) },
    async endConcentration() { calls++; await new Promise(resolve => { release = resolve; }); this.concentration.effects.clear(); } };
const html = new Element(); html.column = new Element();
let renders = 0;
const hud = { actor, rendered: true, render: () => renders++ };
canvas.hud.token = hud;
helpers.addConcentrationControl(hud, html);
helpers.addConcentrationControl(hud, html);
assert.equal(html.column.children.length, 1);
const button = html.column.children[0];
assert.equal(button.title, "End concentration: Spirit Guardians");
const event = { preventDefault() {}, stopPropagation() {} };
const firstClick = button.events.click(event);
const duplicateClick = button.events.click(event);
assert.equal(calls, 1);
release();
await Promise.all([firstClick, duplicateClick]);
assert.ok(renders > 0);
assert.equal(actor.concentration.effects.size, 0);
const emptyHUD = new Element(); emptyHUD.column = new Element();
helpers.addConcentrationControl(hud, emptyHUD);
assert.equal(emptyHUD.column.children.length, 0);
actor.concentration.effects.add({});
actor.isOwner = false;
await helpers.endTokenConcentration(actor);
helpers.addConcentrationControl(hud, emptyHUD);
assert.equal(calls, 1);
assert.equal(emptyHUD.column.children.length, 0);
actor.isOwner = true;
hooks.get("createActiveEffect")({ parent: actor });
const beforeUnrelated = renders;
hooks.get("deleteActiveEffect")({ parent: {} });
assert.equal(renders, beforeUnrelated);
console.log("Concentration HUD checks passed: visibility, ownership, duplicate controls/clicks, system API, effect refresh.");
