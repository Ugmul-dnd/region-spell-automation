import assert from "node:assert/strict";
const hooks=new Map();
globalThis.Hooks={once:(name,fn)=>hooks.set(name,fn),on:(name,fn)=>{hooks.set(name,fn);return name;},off:name=>hooks.delete(name),callAll(){}};
class Application {constructor(){} _onRender(){} render(){this.rendered=true;this.renders=(this.renders??0)+1;} async close(){this.rendered=false;} }
globalThis.foundry={applications:{api:{ApplicationV2:Application}},utils:{escapeHTML:String}};
globalThis.CONST={TOKEN_DISPOSITIONS:{FRIENDLY:1,NEUTRAL:0,HOSTILE:-1}};
let enabled=true;
globalThis.game={user:{id:"caster",targets:new Set()},settings:{get:(module,key)=>key==="confirmAreaTargets"?enabled:{}},messages:new Map()};
const source=Buffer.from(process.env.RSA_AREA_CONFIRM_SOURCE,"base64").toString()
    .replace('"./shared-activity-card.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_SHARED_SOURCE}`));
const helpers=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const caster={uuid:"caster",disposition:1};
const makeToken=(id,disposition,inside)=>({id,uuid:id,disposition,actor:{uuid:`Actor.${id}`,statuses:new Set(),system:{}},
    object:{isVisible:true},testInsideRegion:()=>inside});
const enemy=makeToken("enemy",-1,true),ally=makeToken("ally",1,true),neutral=makeToken("neutral",0,true),outside=makeToken("outside",-1,false);
const tokens=[enemy,ally,neutral,outside,{...caster,actor:{},object:{isVisible:true},testInsideRegion:()=>true}];
globalThis.fromUuid=async uuid=>tokens.find(token=>token.uuid===uuid);
assert.deepEqual(helpers.collectAreaTargets(tokens,[{}],caster,"hostilesOnly").map(t=>t.id),["enemy"]);
assert.equal(helpers.collectAreaTargets(tokens,[{}],caster,"everyone").length,4);
assert.equal(helpers.allowsAutomaticTarget(ally,{uuid:"monster",disposition:-1},"hostilesOnly"),true);
const activity={name:"Fireball",type:"save",item:{name:"Fireball",type:"spell"},target:{template:{type:"sphere"},affects:{type:"enemy"}},
    damage:{parts:[{}]},async rollDamage(config,dialog,message){assert.equal(dialog.configure,true);assert.equal(message.data.system.targets.length,1);damageRolls++;}};
assert.equal(helpers.automaticTargetMode(activity,{}),"hostilesOnly");
activity.target.affects.type="creature";
assert.equal(helpers.automaticTargetMode(activity,{triggers:[{activity:"Fireball",targeting:"everyone"}]}),"everyone");
const usage={create:{measuredTemplate:true},subsequentActions:true},messageConfig={data:{flags:{}}};
helpers.prepareAreaConfirmation(activity,usage,{},messageConfig);
assert.equal(usage.subsequentActions,false);
assert.equal(messageConfig.data.flags["region-spell-automation"].targetsConfirmationPending,true);
const followup={create:{measuredTemplate:false},subsequentActions:true};
helpers.prepareAreaConfirmation(activity,followup,{},{data:{flags:{"region-spell-automation":{regionTriggered:true}}}});assert.equal(followup.subsequentActions,true);
const playerUsage={create:{measuredTemplate:false},subsequentActions:true},playerMessage={data:{flags:{}}};
helpers.prepareAreaConfirmation(activity,playerUsage,{},playerMessage);
assert.equal(playerMessage.data.flags["region-spell-automation"].targetsConfirmationPending,true,
    "A player selecting area creation later must still receive confirmation");
assert.equal(playerUsage.subsequentActions,false);
let damageRolls=0,confirmedEvents=0;
Hooks.callAll=name=>{assert.equal(name,"regionSpellAutomation.targetsConfirmed");confirmedEvents++;};
const card={id:"usage",_targetState:{mode:"selected",checked:new Map([["old",false]])},system:{targets:[]},
    flags:{"region-spell-automation":{targetsConfirmationPending:true}},getFlag(module,key){return this.flags[module]?.[key];},
    async update(data){this.system.targets=data["system.targets"];for(const key of ["targetsConfirmationPending","targetsConfirmationCanceled"])this.flags["region-spell-automation"][key]=data[`flags.region-spell-automation.${key}`];}};
await helpers.finishConfirmedCast(activity,card,[{token:enemy.uuid}]);
assert.equal(card.system.targets[0].token,enemy.uuid);assert.equal(damageRolls,1);assert.equal(confirmedEvents,1);
assert.equal(card.getFlag("region-spell-automation","targetsConfirmationPending"),false);
assert.equal(card._targetState.mode,"targeted");
hooks.get("ready")();
game.messages.set(card.id,card);
card.flags["region-spell-automation"].targetsConfirmationPending=true;
assert.equal(hooks.get("dnd5e.preRollDamageV2")({}, {}, {data:{system:{origin:card.id}}}),false);
enabled=false;
const disabled={create:{measuredTemplate:true},subsequentActions:true};
helpers.prepareAreaConfirmation(activity,disabled,{},{});assert.equal(disabled.subsequentActions,true);
console.log("Area confirmation checks passed: enemy/everyone filtering, caster-relative hostility, pre-confirm damage suppression, card update, damage prompt, setting toggle and follow-up exclusion.");

const node=()=>({events:{},addEventListener(name,fn){this.events[name]=fn;}});
const remove=node();remove.dataset={rsaRemoveTarget:"enemy"};
const confirm=node(),cancel=node();
const renderEnemy={id:"enemy",name:"Enemy",document:enemy,setTarget(flag){
    if(!flag)game.user.targets.delete(this);
    hooks.get("targetToken")?.(game.user,this,flag);
}};
const renderAlly={id:"ally",name:"Ally",document:ally};
game.user.targets=new Set([renderEnemy]);
const popup=new helpers.TargetConfirmation(card);
popup.element={querySelectorAll:()=>[remove],querySelector:selector=>selector==="[data-rsa-confirm-targets]"?confirm:cancel};
const chosen=popup.choose();
popup._onRender({},{});
let hoverIn = 0, hoverOut = 0;
renderEnemy.document.texture = {src:"tokens/enemy.webp"};
renderEnemy._onHoverIn = () => {hoverIn++;};
renderEnemy._onHoverOut = () => {hoverOut++;};
assert.match(await popup._renderHTML(), /tokens\/enemy.webp/);
assert.match(await popup._renderHTML(), /margin-bottom:16px/);
remove.events.mouseenter({buttons:0});
assert.equal(hoverIn,1);
remove.events.mouseleave({});
assert.equal(hoverOut,1);
remove.events.mouseenter({buttons:0});
popup._replaceHTML("", {});
assert.equal(hoverOut,2,"Rerender clears the map highlight");
game.user.targets.add(renderAlly);
hooks.get("targetToken")(game.user,renderAlly,true);
assert.equal(popup.renders,2,"Map targeting refreshes the popup");
remove.events.click();
assert.equal(game.user.targets.has(renderEnemy),false);
assert.match(await popup._renderHTML(),/Ally/);
await confirm.events.click();
assert.equal(popup.confirmed,undefined,"Placement click cannot immediately confirm the popup");
popup.confirmAfter=0;
await confirm.events.click();
assert.deepEqual((await chosen).map(target=>target.token),[ally.uuid]);
assert.equal(hooks.has("targetToken"),false,"Closed popup removes its live hook");
console.log("Confirmation popup checks passed: live map additions, name-click removal, confirmed snapshot, hook cleanup.");

const hidden=makeToken("hidden",-1,true);hidden.hidden=true;
const dead=makeToken("dead",-1,true);dead.actor.statuses.add("dead");
const zero=makeToken("zero",-1,true);zero.actor.system={attributes:{hp:{value:0}}};
assert.deepEqual(helpers.collectAreaTargets([enemy,hidden,dead,zero],[{}],caster,"everyone"),[enemy]);
const manualHidden={id:"hidden",name:"Hidden",document:hidden,setTarget(){game.user.targets.delete(this);}};
game.user.targets=new Set([manualHidden,renderAlly]);
assert.deepEqual(popup.eligibleTargets(),[renderAlly]);
assert.equal(game.user.targets.has(manualHidden),false);
ally.actor.system={attributes:{hp:{value:0}}};
await helpers.finishConfirmedCast(activity,card,[{token:ally.uuid}]);
assert.equal(card.system.targets.length,0,"Recheck eligibility when confirming");
assert.equal(damageRolls,1,"No damage prompt when all targets are excluded");
console.log("Initial targeting exclusion checks passed: automatic filter, manual deselection, confirm-time recheck.");

enabled=true;game.user.isGM=false;
globalThis.canvas={tokens:{placeables:[{document:enemy}],setTargets(ids){
    assert.deepEqual(ids,[enemy.id]);game.user.targets=new Set([{id:enemy.id,document:enemy}]);
}}};
globalThis.fromUuid=async uuid=>uuid==="caster"?caster:uuid===enemy.uuid?enemy:null;
let playerPopups=0;
const originalChoose=helpers.TargetConfirmation.prototype.choose;
helpers.TargetConfirmation.prototype.choose=async function(){
    assert.equal(game.user.isGM,false);playerPopups++;return [{token:enemy.uuid}];
};
const playerCard={...card,id:"player-cast",author:{id:game.user.id},flags:{"region-spell-automation":{}},system:{targets:[]}};
const beforePlayerDamage=damageRolls;
await helpers.confirmCastTargets(activity,playerUsage,{message:playerCard,templates:[{flags:{dnd5e:{origin:"caster"}}}]});
assert.equal(playerPopups,1,"Non-GM placing user gets the popup, including missing pre-use marker fallback");
assert.equal(playerCard.system.targets[0].token,enemy.uuid);
assert.equal(damageRolls,beforePlayerDamage+1);
await helpers.confirmCastTargets(activity,playerUsage,{message:playerCard,templates:[{}]});
assert.equal(playerPopups,1);
helpers.TargetConfirmation.prototype.choose=originalChoose;
console.log("Player confirmation checks passed: non-GM popup, actual Region fallback, confirmed targets, one damage prompt, duplicate prevention.");
