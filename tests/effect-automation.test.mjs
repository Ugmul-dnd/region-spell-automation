import assert from "node:assert/strict";
const hooks=new Map();globalThis.Hooks={once:(name,fn)=>hooks.set(name,fn),on(){},callAll(){}};
let enabled=true,applications=[];
const caster={uuid:"Actor.caster",isOwner:true,effects:[]},ally={uuid:"Actor.ally",isOwner:true,effects:[]},enemy={uuid:"Actor.enemy",isOwner:true,effects:[]};
const casterToken={disposition:1,actor:caster},allyToken={uuid:"Token.ally",disposition:1,actor:ally},enemyToken={uuid:"Token.enemy",disposition:-1,actor:enemy};
globalThis.fromUuid=async uuid=>({"Token.ally":allyToken,"Token.enemy":enemyToken})[uuid];
globalThis.game={user:{id:"gm",isGM:true},settings:{get:()=>enabled}};
globalThis.ui={notifications:{warn(){},error:message=>{throw Error(message);}}};
globalThis.document={createElement:()=>({_applyEffectToActor:async function(effect,actor){applications.push({effect,actor,message:this.chatMessage});}})};
const {eligibleBuffActivity,applyBuffEffects,collapseAppliedBuffTray}=await import(`data:text/javascript;base64,${process.env.RSA_EFFECT_AUTOMATION_SOURCE}`);
const buff={type:"utility",item:{type:"spell"},target:{affects:{type:"self"}},getApplicableEffects:async()=>[{uuid:"Effect.buff"}],getUsageToken:()=>casterToken};
const card={id:"buff",uuid:"ChatMessage.buff",system:{targets:[]},getFlag:()=>false,async update(data){this.savedFlags=data;},getAssociatedActor:()=>caster,getAssociatedActivity:()=>buff};
await Promise.all([applyBuffEffects(card),applyBuffEffects(card)]);
assert.equal(applications.length,1,"Concurrent use requests apply once");assert.equal(applications[0].actor,caster);assert.equal(applications[0].message,card);
for(const type of ["attack","save","damage","heal"]){assert.equal(eligibleBuffActivity({...buff,type}),false);}
assert.equal(eligibleBuffActivity({...buff,roll:{formula:"1d6"}}),false);
assert.equal(eligibleBuffActivity({...buff,target:{template:{type:"circle"}}}),false);
buff.target.affects.type="creature";card.id="targeted";card.system.targets=[{token:"Token.ally"},{token:"Token.enemy"}];
await applyBuffEffects(card);assert.equal(applications.length,2);assert.equal(applications.at(-1).actor,ally);
buff.target.affects.type="ally";card.id="explicit-ally";card.system.targets=[{token:"Token.ally"}];await applyBuffEffects(card);assert.equal(applications.length,3);
card.id="pending";card.getFlag=(id,key)=>key==="targetsConfirmationPending";await applyBuffEffects(card);assert.equal(applications.length,3);
card.getFlag=()=>false;await applyBuffEffects(card);assert.equal(applications.length,4);
card.id="disabled";enabled=false;await applyBuffEffects(card);assert.equal(applications.length,4);enabled=true;
card.id="no-permission";game.user.isGM=false;ally.isOwner=false;await applyBuffEffects(card);assert.equal(applications.length,4);
console.log("Effect automation checks passed: native application, self/allies/friendly targeting, harmful/rolling activity exclusion, concurrency, confirmation, settings and permissions.");

class Element {querySelectorAll(){return this.trays;}}
globalThis.HTMLElement=Element;
const root=new Element();root.trays=[{open:true}];
collapseAppliedBuffTray({getFlag:()=>false},root);assert.equal(root.trays[0].open,true,"Manual cards remain unchanged");
collapseAppliedBuffTray({getFlag:()=>true},root);assert.equal(root.trays[0].open,false,"Successful auto-applied cards collapse their native tray");
root.trays[0].open=true;assert.equal(root.trays[0].open,true,"Tray remains available to expand manually");
console.log("Auto-applied buff tray checks passed: collapse only on successful automation, manual access retained.");