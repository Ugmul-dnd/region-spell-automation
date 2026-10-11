import assert from "node:assert/strict";
globalThis.Hooks={once(){},on(){}};
let enabled=true;
globalThis.game={settings:{get:()=>enabled},messages:new Map()};
class Element {
    constructor(){this.classList={add:()=>{}};this.style={};this.dataset={};this.attack={hidden:false,style:{},closest(){return this;}};this.damage={hidden:false,style:{},closest(){return this;}};this.summary=[];}
    querySelector(){return this.face;}
    querySelectorAll(selector){
        if(selector===".card-summary[data-message-id]")return this.summary;
        if(selector.includes('rollAttack'))return [this.attack];
        if(selector.includes('rollDamage'))return [this.damage];
        return [];
    }
}
globalThis.HTMLElement=Element;
const {attackCardProgress,styleActivityCard,linkedAttackDamage,rollAttackCardDamage,scrollOnChatTab}=await import(`data:text/javascript;base64,${process.env.RSA_CARD_PRESENTATION_SOURCE}`);
let attack=[],damage=[];
const card={type:"usage",getAssociatedActivity:()=>({type:"attack"}),getAssociatedRolls:type=>type==="attack"?attack:damage};
const root=new Element();root.face=new Element();
styleActivityCard(card,root);assert.equal(root.face.attack.hidden,false);assert.equal(root.hidden,undefined);
attack=[{}];styleActivityCard(card,root);assert.equal(root.face.attack.hidden,true);assert.equal(root.face.damage.hidden,false);assert.equal(root.hidden,true,"Base card hides as soon as attack exists");
damage=[{}];styleActivityCard(card,root);assert.equal(root.face.damage.hidden,true);assert.equal(root.hidden,true);assert.equal(root.style.display,"none","Completed standalone base card is explicitly hidden despite chat display styles");
const inline=new Element();inline.face=new Element();inline.summary=[{dataset:{messageId:"attack"},classList:{add(){}}}];
styleActivityCard(card,inline);assert.equal(inline.face.hidden,true);assert.equal(inline.hidden,undefined,"Inline results remain visible");
assert.equal(attackCardProgress({...card,getAssociatedActivity:()=>({type:"save"})}),null);
enabled=false;const disabled=new Element();disabled.face=new Element();styleActivityCard(card,disabled);assert.equal(disabled.hidden,undefined);assert.equal(disabled.face.attack.hidden,false);
console.log("Card presentation checks passed: unrolled/canceled actions, attack/damage progression, standalone/inline results and setting toggle.");

const linkedAttack={id:"attack-one",timestamp:10,type:"attack",isOwner:true,system:{targets:[{token:"new-target"}]}};
let linkedDamages=[];const hookCalls=new Map();let hookId=0;
Hooks.on=(name,fn)=>{hookCalls.set(++hookId,{name,fn});return hookId;};Hooks.off=(name,id)=>hookCalls.delete(id);
let nativeMessageConfig;
const nativeActivity={uuid:"weapon.activity",async onChatAction(event,button,origin){
    assert.equal(button.dataset.action,"rollDamage");assert.equal(origin,usage);
    nativeMessageConfig={data:{}};
    for(const value of [...hookCalls.values()])value.fn({subject:nativeActivity},{},nativeMessageConfig);
}};
const usage={id:"base",isOwner:true,getAssociatedActivity:()=>nativeActivity,getAssociatedRolls:type=>type==="attack"?[linkedAttack]:linkedDamages};
linkedAttack.system.origin=usage;game.user={isGM:false};
await rollAttackCardDamage(linkedAttack,{});
assert.equal(nativeMessageConfig.data.system.origin,"base");
assert.equal(nativeMessageConfig.data.flags["region-spell-automation"].damageAttackId,linkedAttack.id);
assert.deepEqual(nativeMessageConfig.data.system.targets,linkedAttack.system.targets);
linkedDamages=[{getFlag:()=>linkedAttack.id}];assert.equal(linkedAttackDamage(linkedAttack).length,1);
console.log("Attack-card damage checks passed: native Damage action, explicit attack linkage, current targets and completed-roll detection.");
let scrolls=0;globalThis.ui={chat:{async scrollBottom(options){assert.equal(options.waitImages,true);scrolls++;}}};
globalThis.requestAnimationFrame=callback=>queueMicrotask(callback);
enabled=true;await scrollOnChatTab(ui.chat);assert.equal(scrolls,1);
await scrollOnChatTab({});assert.equal(scrolls,1,"Other tabs do not scroll chat");
const opening=scrollOnChatTab(ui.chat);await scrollOnChatTab({});await opening;assert.equal(scrolls,1,"Changing away cancels the pending scroll");
enabled=false;await scrollOnChatTab(ui.chat);assert.equal(scrolls,1);
console.log("Chat tab checks passed: deferred image-aware bottom scroll, other tabs, cancellation and client toggle.");