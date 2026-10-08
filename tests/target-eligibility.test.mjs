import assert from "node:assert/strict";
const {isEligibleTarget}=await import(`data:text/javascript;base64,${process.env.RSA_SHARED_SOURCE}`);
globalThis.game={combats:[]};
const token=()=>({id:"target",uuid:"Scene.scene.Token.target",parent:{id:"scene"},hidden:false,
    actor:{statuses:new Set(),system:{attributes:{hp:{value:10}}}},object:{isVisible:true}});
let target=token();assert.equal(isEligibleTarget(target),true);
target.hidden=true;assert.equal(isEligibleTarget(target),false,"Hidden token excluded even when visible to GM");
for(const hp of [0,-1]){target=token();target.actor.system.attributes.hp.value=hp;assert.equal(isEligibleTarget(target),false);}
for(const status of ["dead","defeated"]){target=token();target.actor.statuses.add(status);assert.equal(isEligibleTarget(target),false);}
target=token();target.combatant={defeated:true};assert.equal(isEligibleTarget(target),false);
target=token();
game.combats=[{scene:{id:"scene"},combatants:new Map([["combatant",{tokenId:"target",defeated:true}]])}];
assert.equal(isEligibleTarget(target),false);
game.combats[0].scene.id="other";assert.equal(isEligibleTarget(target),true,"Same token ID in another scene is not this target");
game.combats=[];target=token();delete target.actor.system.attributes.hp;
assert.equal(isEligibleTarget(target),true,"Unknown HP does not imply zero HP");
assert.equal(isEligibleTarget({}),false);
console.log("Target eligibility checks passed: GM-visible hidden tokens, zero/negative HP, dead/defeated status, combat defeat, scene isolation, unknown HP.");
