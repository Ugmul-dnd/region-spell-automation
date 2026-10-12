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
const {attackCardProgress,styleActivityCard,linkedAttackDamage,rollAttackCardDamage,scrollOnChatTab,followRollMenuExpansion}=await import(`data:text/javascript;base64,${process.env.RSA_CARD_PRESENTATION_SOURCE}`);
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
let resizeCallback,observations=0,height=0;
globalThis.ResizeObserver=class{constructor(callback){resizeCallback=callback;}observe(){observations++;}disconnect(){}};
globalThis.getComputedStyle=()=>({marginTop:"0"});
const scroller={scrollHeight:1000,clientHeight:300,scrollTop:700,addEventListener(){},removeEventListener(){}};
const events={};const host={closest:()=>scroller,addEventListener:(name,fn)=>events[name]=fn};
const menu={isConnected:true,getBoundingClientRect:()=>({height})};
followRollMenuExpansion(host,menu);events.mouseenter();
height=12;resizeCallback();assert.equal(scroller.scrollTop,712);
height=28;resizeCallback();assert.equal(scroller.scrollTop,728,"Scroll follows exactly the expansion amount");
scroller.scrollTop=200;events.mouseenter();assert.equal(observations,1,"Reading older messages does not start bottom tracking");
console.log("Roll hover scrolling checks passed: incremental expansion following and older-message preservation.");
const {showPendingSaves}=await import(`data:text/javascript;base64,${process.env.RSA_CARD_PRESENTATION_SOURCE}`);
const pendingRows=[];
const makePendingElement=()=>({dataset:{},children:[],setAttribute(){},addEventListener(){},append(...children){this.children.push(...children);},after(row){pendingRows.push(row);},remove(){pendingRows.splice(pendingRows.indexOf(this),1);}});
globalThis.document={createElement:makePendingElement};
const pendingFace=makePendingElement();
const pendingRoot={querySelector:()=>pendingFace,querySelectorAll:selector=>selector===".rsa-save-pending"?[...pendingRows]:[]};
const pendingOutcomes=new Map();
const pendingUsage={type:"usage",getAssociatedActivity:()=>({type:"save"}),getFlag:()=>["first","second"],system:{outcomes:pendingOutcomes,targets:[{token:"first",name:"First"},{token:"second",name:"Second"}]}};
showPendingSaves(pendingUsage,pendingRoot);
assert.equal(pendingRows.length,2);
assert.equal(pendingRows[0].children[0].children[2].textContent,"---pending---");
pendingOutcomes.set("first","success");showPendingSaves(pendingUsage,pendingRoot);
assert.equal(pendingRows.length,1);assert.equal(pendingRows[0].dataset.targetUuid,"second");
pendingOutcomes.set("second","failure");showPendingSaves(pendingUsage,pendingRoot);
assert.equal(pendingRows.length,0,"Native outcomes replace all pending slots without stale duplicates");
const animatedSave={_dice3danimating:true,getAssociatedToken:()=>({uuid:"second"})};
pendingUsage.getAssociatedRolls=()=>[animatedSave];
showPendingSaves(pendingUsage,pendingRoot);
assert.equal(pendingRows.length,1,"Known save outcomes remain pending during the local dice animation");
assert.equal(pendingRows[0].dataset.targetUuid,"second");
animatedSave._dice3danimating=false;showPendingSaves(pendingUsage,pendingRoot);
assert.equal(pendingRows.length,0,"Placeholder disappears only when the animation finishes");
console.log("Pending saves checks passed: named slots and replacement as individual outcomes resolve.");
