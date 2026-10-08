import assert from "node:assert/strict";
const hooks=new Map();
globalThis.Hooks={once:(name,fn)=>hooks.set(name,fn),on:(name,fn)=>hooks.set(name,fn)};
const source=Buffer.from(process.env.RSA_RETARGET_SOURCE,"base64").toString()
    .replace('"./shared-activity-card.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_SHARED_SOURCE}`));
const {retargetSpellCard,addRetargetButton,hideRemovedTargetSummaries}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
let warned=0;
globalThis.game={user:{isGM:false,targets:new Set()}};
globalThis.ui={notifications:{warn(){warned++;}}};
const token={uuid:"Scene.scene.Token.new",name:"New target",actor:{uuid:"Actor.new",statuses:new Set(),system:{}},texture:{src:"token.webp"}};
const damage={isOwner:true,system:{targets:[{token:"old"}]},rolls:[{total:23}],_targetState:{mode:"selected",checked:new Map([[token.uuid,false]])},
    async update(data,options){assert.equal(options.rsaRetarget,true);this.system.targets=data["system.targets"];}};
const card={type:"usage",isOwner:true,system:{targets:[{token:"old"}]},outcomes:{old:"success"},
    getAssociatedItem:()=>({type:"spell"}),getAssociatedRolls:()=>[damage],_targetState:{mode:"selected",checked:new Map()},
    async update(data,options){assert.equal(options.rsaRetarget,true);this.system.targets=data["system.targets"];}};
await retargetSpellCard(card,[{document:token},token]);
assert.equal(card.system.targets.length,1);
assert.equal(card.system.targets[0].token,token.uuid);
assert.deepEqual(damage.system.targets,card.system.targets);
assert.equal(damage.rolls[0].total,23);
assert.equal(card.outcomes.old,"success");
assert.equal(card._targetState.mode,"targeted");
assert.equal(damage._targetState.checked.size,0);
await retargetSpellCard(card,[]);
assert.equal(card.system.targets.length,0);
assert.equal(damage.system.targets.length,0);
card.isOwner=false;
await retargetSpellCard(card,[token]);assert.equal(card.system.targets.length,0);
card.isOwner=true;damage.isOwner=false;
await retargetSpellCard(card,[token]);assert.equal(card.system.targets.length,1);assert.equal(warned,1);
game.user.isGM=true;
await retargetSpellCard(card,[token]);assert.equal(damage.system.targets.length,1);
console.log("Retarget checks passed: replacement/clear, deduplication, targeted mode, preserved rolls/outcomes, owner/GM permissions.");

class Element {
    constructor(tag="DIV"){this.tagName=tag.toUpperCase();this.dataset={};this.children=[];this.events={};}
    append(...children){this.children.push(...children);}
    addEventListener(name,fn){this.events[name]=fn;}
    querySelector(selector){
        if(selector==="[data-rsa-retarget]")return this.controls?.children.flatMap(child=>child.children).find(child=>"rsaRetarget" in child.dataset)??null;
        return this.controls??null;
    }
}
globalThis.HTMLElement=Element;
globalThis.document={createElement:tag=>new Element(tag)};
hooks.get("ready")();
assert.ok(hooks.has("dnd5e.renderChatMessage"));
assert.equal(hooks.has("renderChatMessageHTML"),false);
const html=new Element();
addRetargetButton(card,html); // Early core render has no usage-card controls.
html.controls=new Element("UL");
hooks.get("dnd5e.renderChatMessage")(card,html);
assert.equal(html.controls.children.length,1);
assert.match(html.controls.children[0].children[0].innerHTML,/Retarget/);
hooks.get("dnd5e.renderChatMessage")(card,html);
assert.equal(html.controls.children.length,1,"Repeated render callbacks must not duplicate the button");
console.log("Retarget rendering checks passed: late system hook inserts visible action and prevents duplicates.");

const summaryA={dataset:{targetUuid:token.uuid},style:{},hidden:false};
const summaryB={dataset:{targetUuid:"Scene.scene.Token.removed"},style:{},hidden:false};
const summariesRoot=new Element();
summariesRoot.querySelectorAll=()=>[summaryA,summaryB];
card.getFlag=()=>true;
hideRemovedTargetSummaries(card,summariesRoot);
assert.equal(summaryA.hidden,false);
assert.equal(summaryB.hidden,true);
assert.equal(summaryB.style.display,"none");
card.system.targets.push({token:summaryB.dataset.targetUuid});
hideRemovedTargetSummaries(card,summariesRoot);
assert.equal(summaryB.hidden,false);
assert.equal(summaryB.style.display,"");
assert.equal(card.outcomes.old,"success");
assert.equal(damage.rolls[0].total,23);
console.log("Retarget summary checks passed: removed target hidden, retained target visible, roll history preserved.");
