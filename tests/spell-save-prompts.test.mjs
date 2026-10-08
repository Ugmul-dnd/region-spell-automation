import assert from "node:assert/strict";
const routingURL=`data:text/javascript;base64,${process.env.RSA_SAVE_PROMPT_SOURCE}`;
const {receiveSavePrompt}=await import(routingURL);
const hooks=new Map();
globalThis.Hooks={once:(name,fn)=>hooks.set(name,fn),on:(name,fn)=>hooks.set(name,fn)};
const castSource=Buffer.from(process.env.RSA_CAST_SAVE_SOURCE,"base64").toString()
    .replace('"./save-prompts.js"',JSON.stringify(routingURL));
const {promptCastSaves}=await import(`data:text/javascript;base64,${Buffer.from(castSource).toString("base64")}`);
const caster={id:"caster",active:true,isGM:false},p1={id:"p1",active:true,isGM:false},
    p2={id:"p2",active:true,isGM:false},gm={id:"gm",active:true,isGM:true};
const users=[caster,p1,p2,gm];users.get=id=>users.find(user=>user.id===id);users.activeGM=gm;
let enabled=true,regionEnabled=false,packets=[],rolls=[];
const tokens=new Map();
for (const [id,owner] of [["one",p1],["two",p2],["three",gm],["four",gm]]) {
    const actor={id,testUserPermission:user=>user.id===owner.id,
        get isOwner(){return game.user.isGM||game.user.id===owner.id;},
        async rollSavingThrow(config,dialog,message){rolls.push({id,user:game.user.id,config,dialog,message});}};
    tokens.set(id,{id,uuid:`Scene.scene.Token.${id}`,actor,parent:{id:"scene"}});
}
const activity={type:"save",item:{type:"spell"},save:{ability:new Set(["dex"]),dc:{value:18},bonus:""},
    getRollData:()=>({}),messageSources:{activity:{uuid:"Actor.caster.Item.fireball.Activity.save"}}};
let regionTriggered=false;
const card={id:"fireball",author:caster,system:{targets:[...tokens.values(),tokens.get("one")].map(token=>({token:token.uuid}))},
    getAssociatedActivity:()=>activity,getFlag:(id,key)=>key==="regionTriggered"&&regionTriggered};
const messages=new Map([[card.id,card]]);
let registration;
globalThis.game={user:caster,users,messages,settings:{get:(id,key)=>key==="promptForSaveOnSpellCasts"?enabled:regionEnabled,
    register:(id,key,options)=>registration={key,options}},socket:{emit:(channel,packet)=>packets.push(packet)}};
globalThis.fromUuid=async uuid=>[...tokens.values()].find(token=>token.uuid===uuid);
globalThis.CONFIG={Dice:{BasicRoll:{replaceFormulaData:formula=>formula,constructParts:()=>({parts:[],data:{}})}}};
globalThis.ChatMessage={getSpeaker:({token})=>({token:token.id})};
globalThis.ui={notifications:{warn(){},error(message){throw new Error(message);}}};
hooks.get("init")();
assert.equal(registration.key,"promptForSaveOnSpellCasts");assert.equal(registration.options.default,true);
assert.equal(registration.options.scope,"world");
await promptCastSaves(activity,{message:card});
assert.equal(packets.length,4);
assert.deepEqual(packets.map(packet=>packet.userId),["p1","p2","gm","gm"]);
for(const packet of packets){game.user=users.get(packet.userId);await receiveSavePrompt(packet);await receiveSavePrompt(packet);}
assert.equal(rolls.length,4);
assert.ok(rolls.every(roll=>roll.config.ability==="dex"&&roll.config.target===18&&roll.dialog.configure&&roll.message.data.system.origin===card.id));
assert.equal(new Set(rolls.map(roll=>roll.dialog.options.id)).size,4);
game.user=caster;
enabled=false;await promptCastSaves(activity,{message:card});assert.equal(packets.length,4);
enabled=true;regionTriggered=true;await promptCastSaves(activity,{message:card});assert.equal(packets.length,4);
regionTriggered=false;activity.item.type="feat";await promptCastSaves(activity,{message:card});assert.equal(packets.length,4);
activity.item.type="spell";activity.type="damage";await promptCastSaves(activity,{message:card});assert.equal(packets.length,4);
console.log("Spell-cast save checks passed: four distinct targets, player/GM routing, native saves, duplicate suppression, independent setting, Region/feature/non-Save exclusion.");

// GM casts: NPC saves remain on that GM even if another GM is designated.
// A synthetic NPC actor-only descriptor must resolve back to its token.
const otherGM={id:"other-gm",active:true,isGM:true};
users.push(otherGM);users.activeGM=otherGM;
activity.type="save";activity.save.dc.value="18";
card.id="gm-fireball";card.author=gm;messages.set(card.id,card);
for(const token of tokens.values()){token.actor.uuid=`Actor.${token.id}`;token.actor.token=token;}
tokens.get("three").actor.type="npc";tokens.get("four").actor.type="npc";
card.system.targets=[{token:tokens.get("one").uuid},{token:tokens.get("two").uuid},
    {actor:tokens.get("three").actor.uuid},{token:tokens.get("four").uuid}];
globalThis.fromUuid=async uuid=>[...tokens.values()].find(token=>token.uuid===uuid) ??
    [...tokens.values()].find(token=>token.actor.uuid===uuid)?.actor;
game.user=gm;
const beforeGM=rolls.length;
await promptCastSaves(activity,{message:card});
await Promise.resolve();
assert.equal(rolls.length,beforeGM+2,"GM-cast NPC saves must open locally");
assert.ok(rolls.slice(beforeGM).every(roll=>roll.user===gm.id&&roll.config.target===18));
assert.equal(packets.length,6,"Only the two PC targets require remote requests");
console.log("GM-cast NPC checks passed: local GM prompts, actor-only targets, other-GM isolation, numeric-string DC.");

// Tweaks can replace stale pre-cast targets after the cast hook has returned.
// Debounce that update and prompt the finalized NPC-only list, not the old PC.
const originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
const timers=new Map();let timerId=0;
globalThis.setTimeout=fn=>{const id=++timerId;timers.set(id,fn);return id;};
globalThis.clearTimeout=id=>timers.delete(id);
hooks.get("ready")();
card.id="delayed-aoe";messages.set(card.id,card);
card.system.targets=[{token:tokens.get("one").uuid}];
const beforeDelayedRolls=rolls.length,beforeDelayedPackets=packets.length;
hooks.get("dnd5e.postUseActivity")(activity,{}, {message:card});
assert.equal(rolls.length,beforeDelayedRolls);
card.system.targets=[{token:tokens.get("three").uuid},{token:tokens.get("four").uuid}];
hooks.get("updateChatMessage")(card,{"system.targets":card.system.targets});
assert.equal(timers.size,1);
const flushTimer=async()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();await new Promise(resolve=>setImmediate(resolve));};
await flushTimer();
assert.equal(rolls.length,beforeDelayedRolls+2);
assert.equal(packets.length,beforeDelayedPackets,"Stale PC pre-target must not be prompted");
card.system.targets.push({token:tokens.get("one").uuid});
hooks.get("updateChatMessage")(card,{system:{targets:card.system.targets}});
await flushTimer();
assert.equal(rolls.length,beforeDelayedRolls+2,"Earlier NPCs must not get another prompt");
assert.equal(packets.length,beforeDelayedPackets+1,"Newly recorded PC gets one request");
hooks.get("deleteChatMessage")(card);
globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;
console.log("AOE timing checks passed: delayed targets, stale PC removal, NPC-only cast, later PC addition without duplicate NPC saves.");
