import assert from "node:assert/strict";
const registeredHooks=new Map();
globalThis.Hooks={once:(name,fn)=>registeredHooks.set(name,fn),on(){}};
globalThis.foundry={utils:{deepClone:structuredClone}};
globalThis.game={user:{id:"gm",isGM:true},i18n:{localize:key=>key.split(".").at(-1)}};
let evaluations=0;
class D20Die {
    constructor(data={}){Object.assign(this,{number:1,faces:20,options:{},results:[]},structuredClone(data));}
    applyAdvantage(mode){this.options.advantageMode=mode;this.number=1;}
    applyFlag(name,value){this.options[name]=value;}
    applyRange(values){Object.assign(this.options,values);}
    async evaluate(){evaluations++;this.results=Array.from({length:this.number},()=>({result:17,active:true}));}
    get total(){return this.results.reduce((sum,result)=>sum+(result.active?(result.count??result.result):0),0);}
}
class D20Roll {
    constructor(values,mode=0){this.options={advantageMode:mode,target:16,configured:true};this.terms=[new D20Die({results:values.map((result,index)=>({result,active:index===0}))}),{bonusDie:[3],flat:2}];this._evaluated=true;this._total=this._evaluateTotal();}
    get d20(){return this.terms[0];}
    get total(){return this._total;}
    get isSuccess(){return this.total>=this.options.target;}
    toJSON(){return {options:structuredClone(this.options),terms:structuredClone(this.terms)};}
    static fromData(data){const roll=new this([]);roll.options=data.options;roll.terms=[new D20Die(data.terms[0]),data.terms[1]];return roll;}
    resetFormula(){}
    _evaluateTotal(){return this.d20.total+this.terms[1].bonusDie[0]+this.terms[1].flat;}
}
globalThis.CONFIG={Dice:{D20Roll,D20Die}};
const helper=Buffer.from(process.env.RSA_SAVE_CONTROLS_SOURCE,"base64").toString()
    .replace('"./shared-activity-card.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_SHARED_SOURCE}`));
const {changeSaveMode,updateSaveMode,canAdjustSave,refreshSaveSummary,addSaveControls}=await import(`data:text/javascript;base64,${Buffer.from(helper).toString("base64")}`);
const normal=new D20Roll([8]);
const advantage=await changeSaveMode(normal,1);
assert.equal(advantage.total,22);assert.equal(advantage.isSuccess,true);assert.equal(normal.total,13);
assert.equal(evaluations,1);assert.deepEqual(advantage.terms[1],normal.terms[1]);
const disadvantage=await changeSaveMode(advantage,-1);
assert.equal(disadvantage.total,13);assert.equal(disadvantage.isSuccess,false);
const back=await changeSaveMode(disadvantage,0);
assert.equal(back.total,13);
const again=await changeSaveMode(back,1);
assert.equal(again.total,22);assert.equal(evaluations,1,"Switching modes reuses the extra die");
const existingAdvantage=new D20Roll([14,6],1);
const existingDisadvantage=await changeSaveMode(existingAdvantage,-1);
assert.equal(existingDisadvantage.total,11);assert.equal(evaluations,1);
const tied=await changeSaveMode(new D20Roll([8,8],0),1);
assert.equal(tied.d20.results.filter(result=>result.active).length,1);
await assert.rejects(changeSaveMode(normal,2));
let updates=0;
const message={type:"save",author:{id:"player"},rolls:[normal],flavor:"Wisdom Save",async update(data){updates++;this.rolls=data.rolls;this.flavor=data.flavor;}};
assert.equal(canAdjustSave(message,{id:"player",isGM:false}),true);
assert.equal(canAdjustSave(message,{id:"other",isGM:false}),false);
await updateSaveMode(message,1,0);
assert.equal(updates,1);assert.equal(message.rolls[0].total,22);assert.match(message.flavor,/Advantage/);
await updateSaveMode(message,0,0);
assert.equal(message.rolls[0].total,13);assert.equal(message.flavor,"Wisdom Save");
await assert.rejects(updateSaveMode({...message,type:"attack"},1,0));
console.log("Save mode checks passed: original dice retained, one extra die cached, bonuses/DC/outcomes preserved, mode cycling, ties, existing advantage, save-only permissions.");

let refreshes=0,renders=0;
const origin={system:{async onDescendentRefresh(save){assert.equal(save,message);refreshes++;}}};
globalThis.ui={chat:{async updateMessage(parent){assert.equal(parent,origin);renders++;}}};
message.system={origin};
await refreshSaveSummary(message,{rolls:message.rolls});
assert.equal(refreshes,1);assert.equal(renders,1);
await refreshSaveSummary(message,{flavor:"changed"});assert.equal(refreshes,1);
console.log("Save summary refresh checks passed: cached outcome invalidation and parent-card rerender for roll edits.");

class Element {
    constructor(){this.dataset={};this.children=[];this.events={};this.classList={add(){},toggle(){}};}
    append(child){this.children.push(child);}
    setAttribute(){}
    addEventListener(name,fn){this.events[name]=fn;}
    querySelector(selector){
        if(selector==="[data-rsa-save-modes]")return this.children.find(child=>"rsaSaveModes" in child.dataset);
        if(selector===".dice-roll")return this.rollElement;
        return null;
    }
    querySelectorAll(selector){return selector===".card-summary[data-message-id]"?this.summaries??[]:this.children;}
}
globalThis.HTMLElement=Element;globalThis.document={createElement:()=>new Element()};
game.settings={get:()=>true};
message.id="save";message.isContentVisible=true;
game.messages=new Map([[message.id,message]]);
const root=new Element(),summary=new Element();summary.dataset.messageId=message.id;summary.rollElement=new Element();root.summaries=[summary];
addSaveControls({type:"usage"},root);
assert.equal(summary.children.length,1);
assert.deepEqual(summary.children[0].children.map(button=>button.textContent),["ADV","NORMAL","DISADV"]);
assert.equal(summary.children[0].children[1].disabled,true);
addSaveControls({type:"usage"},root);assert.equal(summary.children.length,1);
game.user={id:"other",isGM:false};
const unauthorized=new Element();unauthorized.summaries=[new Element()];unauthorized.summaries[0].dataset.messageId=message.id;
addSaveControls({type:"usage"},unauthorized);assert.equal(unauthorized.summaries[0].children.length,0);
console.log("Inline save controls checks passed: three modes, current-mode highlight, duplicate and permission guards.");

game.user={id:"gm",isGM:true};
CONFIG.Dice.terms={d:D20Die};
globalThis.Roll={fromTerms:terms=>({terms})};
const animations=[];
game.dice3d={async showForRoll(...args){animations.push(args);}};
const animationMessage={...message,id:"animated",rolls:[new D20Roll([8])],whisper:["gm","player"],blind:true,speaker:{actor:"target"}};
await updateSaveMode(animationMessage,1,0);
assert.equal(animations.length,1);
assert.equal(animations[0][0].terms[0].number,1);
assert.equal(animations[0][0].terms[0].results[0].result,17);
assert.equal(animations[0][2],true);
assert.deepEqual(animations[0][3],["gm","player"]);
assert.equal(animations[0][4],true);
assert.equal(animationMessage.rolls[0].total,22);
await updateSaveMode(animationMessage,-1,0);
await updateSaveMode(animationMessage,0,0);
await updateSaveMode(animationMessage,1,0);
assert.equal(animations.length,1,"Only newly generated dice animate; cached switches do not roll again");
delete game.dice3d;
await updateSaveMode({...message,rolls:[new D20Roll([8])]},1,0);
console.log("Save animation checks passed: new die only, cached switches skipped, whisper/blind routing, optional integration.");

let registeredSetting,chatRenders=0;
game.settings.register=(module,key,config)=>{assert.equal(key,"adjustSavingThrowAdvantage");registeredSetting=config;};
ui.chat.render=options=>{assert.equal(options.force,true);chatRenders++;};
registeredHooks.get("init")();
assert.equal(registeredSetting.scope,"world");assert.equal(registeredSetting.config,true);assert.equal(registeredSetting.default,true);
registeredSetting.onChange(false);assert.equal(chatRenders,1);
game.settings.get=()=>false;
const disabledRoot=new Element();disabledRoot.summaries=[new Element()];disabledRoot.summaries[0].dataset.messageId=message.id;
addSaveControls({type:"usage"},disabledRoot);
assert.equal(disabledRoot.summaries[0].children.length,0);
console.log("Save-control setting checks passed: visible world toggle, default on, chat refresh, no controls while disabled.");
