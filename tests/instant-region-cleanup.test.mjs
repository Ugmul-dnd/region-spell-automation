import assert from "node:assert/strict";
globalThis.Hooks={once(){},on(){}};
const {shouldCleanInstantRegion,trackInstantRegion,cleanupInstantRegions}=
    await import(`data:text/javascript;base64,${process.env.RSA_INSTANT_CLEANUP_SOURCE}`);
const item={uuid:"Actor.caster.Item.fireball",type:"spell",name:"Fireball",system:{duration:{units:"inst"},properties:new Set()}};
let config;
const caster={uuid:"Scene.scene.Token.caster"},other={uuid:"Scene.scene.Token.other"};
const combatants=new Map([["caster",{token:caster}],["other",{token:other}]]);
combatants.some=fn=>[...combatants.values()].some(fn);
const combat={id:"combat",started:true,combatants,previous:{round:1,turn:0,combatantId:"caster"},
    current:{round:1,turn:1,combatantId:"other"}};
const region={id:"area",flags:{dnd5e:{item:item.uuid,origin:caster.uuid}},async update(data){
    this.flags["region-spell-automation"]={instantTurnCleanup:data["flags.region-spell-automation.instantTurnCleanup"]};
}};
const unmarked={id:"old",flags:{dnd5e:{item:item.uuid,origin:caster.uuid}}};
const removed=[];
const scene={regions:[region,unmarked],async deleteEmbeddedDocuments(type,ids){assert.equal(type,"Region");removed.push(...ids);}};
globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},combat,combats:[combat],scenes:[scene],
    settings:{get:()=>config?{Fireball:config}:{}}};
globalThis.fromUuid=async uuid=>uuid===item.uuid?item:null;
assert.equal(shouldCleanInstantRegion(item),true);
assert.equal(shouldCleanInstantRegion(item,{triggers:[{}]}),false);
assert.equal(shouldCleanInstantRegion(item,{regionEffects:[{}]}),false);
assert.equal(shouldCleanInstantRegion({...item,system:{duration:{units:"minute"}}}),false);
await trackInstantRegion(region);
assert.equal(region.flags["region-spell-automation"].instantTurnCleanup.combatId,combat.id);
await cleanupInstantRegions(combat,{turn:1});
assert.deepEqual(removed,["area"],"Only new marked instantaneous areas are deleted");
removed.length=0;
combat.previous.combatantId="other";
await cleanupInstantRegions(combat,{turn:1});assert.equal(removed.length,0);
combat.previous.combatantId="caster";combat.current.turn=0;
await cleanupInstantRegions(combat,{turn:0});assert.equal(removed.length,0);
combat.current.turn=1;config={triggers:[{}]};
await cleanupInstantRegions(combat,{turn:1});assert.equal(removed.length,0);
config=null;
await cleanupInstantRegions(combat,{turn:1},{turnEvents:false});assert.equal(removed.length,0);
game.user.isGM=false;
await cleanupInstantRegions(combat,{turn:1});assert.equal(removed.length,0);
console.log("Instant Region cleanup checks passed: caster end only, managed/duration exclusions, no retroactive removal, rewinds and player authority.");
