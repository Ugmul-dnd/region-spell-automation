import assert from "node:assert/strict";
const hooks=new Map();let next=0;
globalThis.Hooks={once:(name,fn)=>hooks.set(name,fn),on:(name,fn)=>{const id=++next;hooks.set(id,{name,fn});return id;},off:(name,id)=>hooks.delete(id)};
const settings={promptDamageOnSave:true,promptDamageOnHit:true,spellTable:{}};
const cards=new Map();const registrations=[];
globalThis.game={user:{id:"caster"},messages:cards,settings:{get:(id,key)=>settings[key],register:(id,key,options)=>registrations.push({key,options})}};
globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
const {promptDamage,waitForAttackAnimation,configurePromptDialog}=await import(`data:text/javascript;base64,${process.env.RSA_DAMAGE_SOURCE}`);
let calls=[];
const activity={type:"save",uuid:"activity",name:"Save",item:{isOwner:true,type:"spell",name:"Fireball"},damage:{parts:[{}]},
    async onChatAction(event,button,message){calls.push({action:button.dataset.action,message});}};
const card={id:"save",author:{id:"caster"},system:{targets:[{token:"enemy"}],scaling:3},getFlag:()=>false};cards.set(card.id,card);
await Promise.all([promptDamage(activity,card),promptDamage(activity,card)]);
assert.equal(calls.length,1);assert.equal(calls[0].action,"rollDamage");assert.equal(calls[0].message,card);
card.id="pending";cards.set(card.id,card);card.getFlag=(id,key)=>key==="targetsConfirmationPending";
await promptDamage(activity,card);assert.equal(calls.length,1);
card.getFlag=()=>false;await promptDamage(activity,card);assert.equal(calls.length,2,"Confirmation resumes one save damage prompt");
settings.promptDamageOnSave=false;card.id="off";cards.set(card.id,card);
await promptDamage(activity,card);assert.equal(calls.length,2);
settings.promptDamageOnSave=true;card.author.id="other";await promptDamage(activity,card);assert.equal(calls.length,2);
card.author.id="caster";activity.item.isOwner=false;await promptDamage(activity,card);assert.equal(calls.length,2);activity.item.isOwner=true;
activity.item={isOwner:true,type:"feat",name:"Fear Aura"};activity.target={template:{type:"emanation"}};
settings.spellTable={"Fear Aura":{triggers:[{activity:"Save",events:["tokenTurnStart"]}]}};
await promptDamage(activity,card);assert.equal(calls.length,2,"Turn-only aura has no initial damage");
activity.type="attack";activity.item.type="weapon";
const attack={id:"attack",_dice3danimating:true,system:{evaluatedTargets:[{isMiss:false}]},rolls:[{isCritical:true}]};
game.dice3d={};card.id="hit";cards.set(card.id,card);
const promise=promptDamage(activity,card,"attack",attack);
await Promise.resolve();assert.equal(calls.length,2,"No popup before animation completion");
for(const {name,fn} of [...hooks.values()].filter(value=>typeof value==="object")){if(name==="diceSoNiceRollComplete")fn("unrelated");}
await Promise.resolve();assert.equal(calls.length,2);
attack._dice3danimating=false;
for(const {name,fn} of [...hooks.values()].filter(value=>typeof value==="object")){if(name==="diceSoNiceRollComplete")fn(attack.id);}
await promise;assert.equal(calls.length,3,"Hit opens damage only after DSN finishes");
await promptDamage(activity,card,"attack",attack);assert.equal(calls.length,3,"Duplicate hit ignored");
const miss={...attack,id:"miss",system:{evaluatedTargets:[{isMiss:true}]}};
await promptDamage(activity,card,"attack",miss);assert.equal(calls.length,3);
settings.promptDamageOnHit=false;await promptDamage(activity,card,"attack",{...attack,id:"disabled"});assert.equal(calls.length,3);
settings.promptDamageOnHit=true;
card.getAssociatedRolls=()=>[{}];await promptDamage(activity,card,"attack",{...attack,id:"already"});assert.equal(calls.length,3);
delete card.getAssociatedRolls;
let fallback;
delete activity.onChatAction;activity.rollDamage=async(...args)=>{fallback=args;};
await promptDamage(activity,card,"attack",{...attack,id:"crit",system:{evaluatedTargets:[{isMiss:false}],ability:"str",mode:"twoHanded"}});
assert.equal(fallback[0].isCritical,true);assert.equal(fallback[0].attackMode,"twoHanded");assert.equal(fallback[1].configure,true);
hooks.get("init")();assert.equal(registrations.length,3);assert.ok(registrations.filter(r=>r.key!=="promptDialogPositions").every(r=>r.options.scope==="world"&&r.options.default));
assert.equal(registrations.find(r=>r.key==="promptDialogPositions").options.scope,"client");
console.log("Damage prompt checks passed: native card action/scaling, saves, confirmation, permissions, settings, aura exclusion, animation wait, misses, critical modes and duplicate guards.");

class NativeDialog {
    constructor(){this.position={left:220,top:180};this.rendered=true;}
    _onPosition(){}
    async close(){this.closed=true;}
}
globalThis.CONFIG={Dice:{D20Roll:{DefaultConfigurationDialog:NativeDialog},DamageRoll:{DefaultConfigurationDialog:NativeDialog}}};
globalThis.window={innerWidth:1200,innerHeight:800};
settings.promptDialogPositions={damage:{left:9999,top:9999},save:{left:140,top:90}};
game.settings.set=async(id,key,value)=>{settings[key]=value;};
const damageOptions=configurePromptDialog("damage",{options:{defaultButton:"critical",window:{title:"Damage"},position:{top:NaN}}});
assert.deepEqual(damageOptions.options.position,{left:800,top:650});
assert.equal(damageOptions.options.defaultButton,"critical");
assert.equal(damageOptions.options.window.positioned,true);assert.equal(damageOptions.options.window.frame,true);
const saveOptions=configurePromptDialog("save",{options:{id:"save-id"}});
assert.deepEqual(saveOptions.options.position,{left:140,top:90});assert.equal(saveOptions.options.id,"save-id");
const damageDialog=new damageOptions.applicationClass();
await damageDialog.close();await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(settings.promptDialogPositions.damage,{left:220,top:180});
assert.deepEqual(settings.promptDialogPositions.save,{left:140,top:90},"Save and damage positions remain independent");
const saveDialog=new saveOptions.applicationClass();saveDialog.position={left:350,top:250};
await saveDialog.close();await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(configurePromptDialog("save").options.position,{left:350,top:250});
console.log("Prompt positioning checks passed: movable frame, finite/clamped coordinates, saved close position, independent save/damage locations and preserved native options.");
const attackOptions=configurePromptDialog("attack",{options:{defaultButton:"advantage"}});
assert.equal(attackOptions.options.defaultButton,"advantage");
const attackDialog=new attackOptions.applicationClass();attackDialog.position={left:460,top:320};
await attackDialog.close();await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(configurePromptDialog("attack").options.position,{left:460,top:320});
assert.deepEqual(settings.promptDialogPositions.save,{left:350,top:250});
assert.deepEqual(settings.promptDialogPositions.damage,{left:220,top:180});
console.log("Attack positioning checks passed: remembered position independent of saves and damage, native advantage retained.");