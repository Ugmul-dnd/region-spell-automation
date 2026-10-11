import assert from "node:assert/strict";
globalThis.Hooks={once(){}};
const source=Buffer.from(process.env.RSA_SHIELD_SOURCE,"base64").toString().replace('"./shared-activity-card.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_SHARED_SOURCE}`));
const {shieldActivity,refreshShieldAttack,damageMissedAfterShield,addShieldButtons}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const activity={type:"utility",activation:{type:"reaction"}};
const item={name:"Shield",type:"spell",system:{identifier:"shield",canPrepare:true,prepared:1,activities:[activity]}};
const actor={items:[item],uuid:"Actor.defender",system:{spells:{spell1:{value:1}},attributes:{ac:{value:20}}},statuses:new Set()};
assert.equal(shieldActivity(actor),activity);
actor.system.spells.spell1.value=0;assert.equal(shieldActivity(actor),null);
item.system.method="atwill";assert.equal(shieldActivity(actor),activity);
item.system.prepared=0;assert.equal(shieldActivity(actor),null);item.system.prepared=1;
activity.activation.type="action";assert.equal(shieldActivity(actor),null);activity.activation.type="reaction";
const token={uuid:"Scene.scene.Token.defender",name:"Defender",actor,texture:{src:"token.png"}};
globalThis.fromUuid=async()=>token;
globalThis.game={user:{isGM:true}};
const attack={type:"attack",system:{targets:[{token:token.uuid,ac:15}]},rolls:[{total:18}],async update(data){this.system.targets=data["system.targets"];}};
await refreshShieldAttack(attack);assert.equal(attack.system.targets[0].ac,20);assert.equal(attack.rolls[0].total,18);
game.user.isGM=false;actor.system.attributes.ac.value=25;await refreshShieldAttack(attack);assert.equal(attack.system.targets[0].ac,20,"Non-owner cannot update another user's attack");
console.log("Shield reaction checks passed: preparation, resources, reaction-only detection, current AC refresh and permission guards.");

const markedAttack={id:"shielded",type:"attack",timestamp:10,getFlag:()=>true,system:{evaluatedTargets:[{isMiss:true}]}};
const usage={getAssociatedRolls:()=>[markedAttack]};
const damage={type:"damage",timestamp:20,system:{origin:usage}};
assert.equal(damageMissedAfterShield(damage),true,"All Shield-refreshed misses hide damage");
markedAttack.system.evaluatedTargets.push({isMiss:false});
assert.equal(damageMissedAfterShield(damage),false,"Keep damage when any target remains hit");
markedAttack.system.evaluatedTargets=[];assert.equal(damageMissedAfterShield(damage),false,"Unknown outcomes do not hide damage");
markedAttack.system.evaluatedTargets=[{isMiss:true}];markedAttack.getFlag=()=>false;
assert.equal(damageMissedAfterShield(damage),false,"An ordinary miss alone does not hide historical damage");
markedAttack.getFlag=()=>true;
usage.getAssociatedRolls=()=>[markedAttack,{timestamp:15,getFlag:()=>false,system:{evaluatedTargets:[{isMiss:false}]}}];
assert.equal(damageMissedAfterShield(damage),false,"Do not hide another attack's damage on the same activity card");
console.log("Shield damage visibility checks passed: all misses, mixed targets, restoration and separate attacks.");
class Element {
    constructor(){this.dataset={};this.children=[];this.style={};}
    querySelector(selector){if(selector==="[data-rsa-shield]")return this.children.find(child=>"rsaShield" in child.dataset);return null;}
    querySelectorAll(){return [];}
    append(child){this.children.push(child);}
    addEventListener(){}setAttribute(){}hasAttribute(){return false;}
}
globalThis.HTMLElement=Element;globalThis.document={createElement:()=>new Element()};
globalThis.fromUuidSync=()=>token;
game.settings={get:()=>true};actor.isOwner=true;
const row=new Element();const pill=new Element();pill.parentElement=row;
pill.querySelector=()=>({value:token.uuid});
const playerRoot=new Element();playerRoot.querySelectorAll=selector=>selector==="target-pill"?[pill]:[];
const visibleAttack={type:"attack",isContentVisible:true};
addShieldButtons(visibleAttack,playerRoot);
assert.equal(row.children.length,1,"Player-owned Shield icon exists synchronously before inline serialization");
addShieldButtons(visibleAttack,playerRoot);assert.equal(row.children.length,1);
actor.isOwner=false;const otherRow=new Element();pill.parentElement=otherRow;
addShieldButtons(visibleAttack,playerRoot);assert.equal(otherRow.children.length,0,"Players cannot cast another actor's Shield");
console.log("Player Shield rendering checks passed: synchronous insertion, ownership and duplicate guard.");
actor.isOwner=true;const missRow=new Element();pill.parentElement=missRow;
pill.hasAttribute=name=>name==="data-miss";
addShieldButtons(visibleAttack,playerRoot);assert.equal(missRow.children.length,0,"Visible misses do not show Shield");
console.log("Shield visibility checks passed: availability cue on hidden-result owned targets without exposing hit/miss, visible misses excluded.");