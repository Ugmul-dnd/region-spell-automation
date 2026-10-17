const ID="ugmuls-5-5e-automation";
// Recipes only: book items and effects remain the source of spell data.
export const TRIGGER_DEFAULTS=Object.freeze({"searing-smite":Object.freeze({name:"Searing Smite",enabled:true,attachment:"creature",effectName:"Seared",event:"turnStart",damageActivity:"Damage",saveActivity:"Start of Turn Save",damageFormula:"",sourceSpellUuid:"Compendium.dnd-players-handbook.spells.Item.phbsplSearingSmi",endOnSuccess:true}),"fear":Object.freeze({name:"Fear",enabled:true,attachment:"creature",effectName:"Fear",effectId:"ijiWLu6EJZmEJPOZ",event:"turnEnd",damageActivity:"",saveActivity:"Save",saveActivityId:"dnd5eactivity000",damageFormula:"",sourceSpellUuid:"Compendium.dnd-players-handbook.spells.Item.phbsplFear000000",saveCondition:"gmNoLineOfSight",targetingRegionCleanup:"casterTurnEnd",endOnSuccess:true})});
export function triggerKeys(){return [...new Set([...Object.keys(TRIGGER_DEFAULTS),...Object.entries(game.settings.get(ID,"triggerLibraryCustoms")??{}).filter(([,entry])=>entry?.name&&entry?.sourceSpellUuid).map(([key])=>key)])];}
export function triggerEntry(key){const custom=game.settings.get(ID,"triggerLibraryCustoms")?.[key];const base=TRIGGER_DEFAULTS[key]??custom;return base?{...base,...(TRIGGER_DEFAULTS[key]?game.settings.get(ID,"triggerLibraryOverrides")?.[key]:{}),attachment:"creature"}:null;}
export function triggerKeyForSpell(spell,effect){const identifier=spell?.identifier??spell?.system?.identifier;const keys=triggerKeys().filter(key=>{const entry=triggerEntry(key);return (!effect||entry.effectName===effect.name)&&(identifier===key||!!entry.sourceIdentifier&&identifier===entry.sourceIdentifier||!!entry.sourceSpellUuid&&spell?.uuid===entry.sourceSpellUuid);});return keys.find(key=>!TRIGGER_DEFAULTS[key]&&triggerEntry(key).sourceSpellUuid===spell?.uuid)??keys[0];}
export async function saveTriggerEntry(key,entry){validateTriggerEntry(entry);const setting=TRIGGER_DEFAULTS[key]?"triggerLibraryOverrides":"triggerLibraryCustoms";const entries=foundry.utils.deepClone(game.settings.get(ID,setting)??{});entries[key]=entry;await game.settings.set(ID,setting,entries);}
export function validateTriggerEntry(entry){
 if(!["turnStart","turnEnd"].includes(entry.event))throw Error("Choose start or end of turn.");
 if(!entry.effectName?.trim()||(!entry.damageActivity?.trim()&&!entry.saveActivity?.trim()))throw Error("Choose an applied effect and at least one damage or save activity.");
 if(entry.damageFormula&&!entry.damageActivity)throw Error("Custom damage requires a damage activity.");
 if(entry.damageFormula&&!Roll.validate(entry.damageFormula))throw Error("The damage formula is invalid.");
 return entry;
}
const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export class TriggerLibraryApp extends foundry.applications.api.ApplicationV2{
 static DEFAULT_OPTIONS={id:"rsa-trigger-library",window:{title:"Trigger Automation Library — Creature Effects",resizable:true},position:{width:830,height:400}};
 editors=new Map();
 async _renderHTML(){
  const overrides=game.settings.get(ID,"triggerLibraryOverrides")??{};
  const rows=triggerKeys().map(key=>{const entry=triggerEntry(key);return `<tr><th scope="row">${escape(entry.name)}</th><td>${escape(entry.effectName)}</td><td>${entry.event==="turnEnd"?"Turn end":"Turn start"}</td><td>${entry.enabled?"Enabled":"Disabled"}</td><td>${!TRIGGER_DEFAULTS[key]?"Custom entry":Object.keys(overrides[key]??{}).length?"Customized":"Default"}</td><td><button type="button" data-edit-entry="${escape(key)}" aria-label="View or edit ${escape(entry.name)}"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> View/Edit</button></td></tr>`;}).join("");
  return `<div style="padding:16px;display:grid;gap:12px"><div><button type="button" data-add-entry style="width:auto"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add New Effect</button></div><h2>Creature Effect Triggers</h2><p>Choose an entry to view its trigger and settings. Existing book effects and Region settings are preserved.</p><div style="overflow-x:auto"><table style="width:100%"><thead><tr><th scope="col">Spell / Feature</th><th scope="col">Effect</th><th scope="col">Trigger</th><th scope="col">Status</th><th scope="col">Settings</th><th scope="col">Action</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
 }
 _replaceHTML(result,content){content.innerHTML=result;}
 _onRender(context,options){super._onRender(context,options);this.element.querySelector("[data-add-entry]").addEventListener("click",()=>this.openCreate());for(const button of this.element.querySelectorAll('[data-edit-entry]'))button.addEventListener('click',()=>this.openEntry(button.dataset.editEntry));}
 openCreate(){new TriggerSourceApp(async item=>{const key="custom-"+foundry.utils.randomID();const draft=newTriggerFromSpell(item);const editor=new TriggerEntryApp(key,()=>{if(this.rendered)this.render({force:true});},draft);this.editors.set(key,editor);editor.render({force:true});}).render({force:true});}
 openEntry(key){
  if(!triggerEntry(key))return;
  let editor=this.editors.get(key);
  if(!editor){editor=new TriggerEntryApp(key,()=>{if(this.rendered)this.render({force:true});});this.editors.set(key,editor);}
  editor.render({force:true});editor.bringToFront?.();
 }
}
export async function resolveEntrySource(entry){
 if(entry.sourceSpellUuid){try{const item=await fromUuid(entry.sourceSpellUuid);if(item?.type==="spell")return item;}catch{}}
 const actors=[...Array.from(game.actors??[]),...Array.from(globalThis.canvas?.tokens?.placeables??[],token=>token.actor).filter(Boolean)];
 for(const actor of actors){const item=Array.from(actor.items??[]).find(item=>item.type==="spell"&&((item.identifier??item.system?.identifier)===(entry.sourceIdentifier??"searing-smite")||item.name===entry.name));if(item)return item;}
 return null;
}
export function entrySourceOptions(item,entry){
 return {effects:Array.from(item?.effects??[]).map(effect=>({id:effect.id,name:effect.name})),damage:Array.from(item?.system?.activities??[]).filter(a=>a.type==="damage").map(a=>({id:a.id,name:a.name})),save:Array.from(item?.system?.activities??[]).filter(a=>a.type==="save").map(a=>({id:a.id,name:a.name}))};
}
const HELP={
 source:["Source spell","Use Choose Source to open a separate window where you can drop a spell or paste its UUID. This loads its effects and activities without changing the spell. Save the entry to keep changes."],
 effect:["Applied effect","Choose the book effect that carries this trigger on a creature. Its existing stat changes and duration stay intact. Removing, disabling, or expiring the effect stops future triggers."],
 trigger:["Turn trigger","Run on the affected creature’s turn start or turn end. Searing Smite normally triggers at turn start. Turn progression stays unblocked while rolls resolve."],
 damage:["Damage","Choose None for save-only effects such as Fear. Use spell damage preserves the native damage type and scaling at the original cast level. Custom damage replaces that calculation with a fixed formula, such as 3d6. It does not automatically scale with the spell slot."],
 save:["Saving throw","Choose a save activity from the spell. It runs after the recurring damage and uses the caster’s save DC recorded when the effect was applied. None skips this step. Fear requires GM confirmation that the affected creature cannot see the caster before its repeat save."],
 area:["Targeting area lifetime","Use spell duration keeps the area for its normal duration. Remove at caster turn end treats the area as a targeting aid only, like Fear’s cone. It removes only the Region, preserving concentration and creature effects. Requires the Remove Instantaneous Areas at Turn End option and active combat. Regions configured with ongoing triggers or effects are preserved."],
 cleanup:["Effect removal","Remove the tracked effect after a successful save and completed dice animations. A failed save leaves it active. Disable this option if the table handles removal manually."]
};
const info=key=>`<button type="button" data-info="${key}" aria-label="Information about ${escape(HELP[key][0])}" data-tooltip="${escape(HELP[key][1])}" style="cursor:help;flex:0 0 auto;width:26px;height:26px;padding:0;border:0;background:none"><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>`;
const dropdown=(name,choices,value,id,{none=false}={})=>{
 const options=[...choices];if(value&&!options.some(option=>option.name===value))options.unshift({name:value,id:id??""});
 const matchId=id&&options.some(option=>option.id===id);
 return `<select name="${name}">${none?`<option value="" ${!value?'selected':''}>None</option>`:""}${options.map(option=>`<option value="${escape(option.name)}" data-id="${escape(option.id)}" ${(matchId?option.id===id:option.name===value)?'selected':''}>${escape(option.name||"Unnamed activity")}</option>`).join("")}</select>`;
};
export class TriggerEntryApp extends foundry.applications.api.ApplicationV2{
 static DEFAULT_OPTIONS={window:{title:"Creature Effect Trigger",resizable:true},position:{width:760,height:850}};
 constructor(key,onChange,draft=null){
  const entry=draft??triggerEntry(key);if(!entry)throw Error("Unknown trigger library entry.");
  super({id:"rsa-trigger-entry-"+key,window:{title:entry.name+" — View/Edit Trigger"}});
  this.entryKey=key;this.onChange=onChange;this.draft=draft;this.source=null;
 }
 async _renderHTML(){
  const e=this.draft??=triggerEntry(this.entryKey);this.source??=await resolveEntrySource(e);
  const choices=entrySourceOptions(this.source,e),custom=!!e.damageFormula;
  const section=(title,key,body)=>`<section style="display:grid;gap:6px"><div style="display:flex;align-items:center;gap:6px"><strong>${title}</strong>${info(key)}</div>${body}</section>`;
  return `<div style="padding:16px;display:grid;gap:15px;min-height:0;max-height:100%;overflow-y:auto"><div><button type="button" data-choose-source style="width:auto"><i class="fa-solid fa-book-open" aria-hidden="true"></i> Choose Source</button></div><h2>${escape(e.name)}</h2><label><input name="enabled" type="checkbox" ${e.enabled?'checked':''}> Enable recurring triggers</label>
  ${section('Source spell','source',`<p>${this.source?escape(this.source.name):'Saved recipe (source unavailable)'}</p>`)}
  ${section('Applied effect','effect',dropdown('effectName',choices.effects,e.effectName,e.effectId))}
  ${section('Trigger','trigger',`<select name="event"><option value="turnStart" ${e.event==='turnStart'?'selected':''}>Start of affected creature’s turn</option><option value="turnEnd" ${e.event==='turnEnd'?'selected':''}>End of affected creature’s turn</option></select>`)}
  ${section('Damage','damage',`${dropdown('damageActivity',choices.damage,e.damageActivity,e.damageActivityId,{none:true})}<select name="damageMode"><option value="native" ${!custom?'selected':''}>Use spell damage and cast-level scaling</option><option value="custom" ${custom?'selected':''}>Custom damage</option></select><label data-custom-damage ${!custom?'hidden':''}>Custom formula <input name="damageFormula" value="${escape(e.damageFormula)}" placeholder="Example: 3d6"></label>`)}
  ${section('Saving throw','save',dropdown('saveActivity',choices.save,e.saveActivity,e.saveActivityId,{none:true})+`<label>Save eligibility <select name="saveCondition"><option value="always" ${e.saveCondition!=="gmNoLineOfSight"?'selected':''}>Every matching turn</option><option value="gmNoLineOfSight" ${e.saveCondition==="gmNoLineOfSight"?'selected':''}>GM confirms no line of sight to caster</option></select></label>`)}
  ${section('Targeting area lifetime','area',`<select name="targetingRegionCleanup"><option value="native" ${e.targetingRegionCleanup!=="casterTurnEnd"?'selected':''}>Use spell duration</option><option value="casterTurnEnd" ${e.targetingRegionCleanup==="casterTurnEnd"?'selected':''}>Remove targeting area at caster turn end</option></select>`)}
  ${section('On a successful save','cleanup',`<label><input name="endOnSuccess" type="checkbox" ${e.endOnSuccess?'checked':''}> Remove the applied effect</label>`)}
  <p data-preview style="padding:10px;border-left:3px solid var(--color-border-highlight)"></p><footer style="display:flex;gap:8px"><button type="button" data-reset>${TRIGGER_DEFAULTS[this.entryKey]?"Reset to Default":"Discard Changes"}</button><button type="button" data-save>Save</button></footer></div>`;
 }
 _replaceHTML(result,content){content.style.overflowY="auto";content.style.minHeight="0";content.innerHTML=result;}
 readDraft(){
  const entry={...this.draft};
  for(const key of ["enabled","effectName","event","damageActivity","saveActivity","saveCondition","targetingRegionCleanup","endOnSuccess"]){const input=this.element.querySelector('[name="'+key+'"]');entry[key]=input.type==="checkbox"?input.checked:input.value;}
  for(const [name,key]of [["effectName","effectId"],["damageActivity","damageActivityId"],["saveActivity","saveActivityId"]])entry[key]=this.element.querySelector('[name="'+name+'"]').selectedOptions[0]?.dataset.id??"";
  entry.damageFormula=this.element.querySelector('[name="damageMode"]').value==="custom"?this.element.querySelector('[name="damageFormula"]').value.trim():"";
  return this.draft=entry;
 }
 updatePreview(){const e=this.readDraft();this.element.querySelector('[data-custom-damage]').hidden=this.element.querySelector('[name="damageMode"]').value!=="custom";this.element.querySelector('[data-preview]').textContent='At the affected creature’s '+(e.event==='turnEnd'?'turn end':'turn start')+', '+(e.damageActivity?'roll '+(e.damageFormula?'custom damage ('+e.damageFormula+')':'the spell’s damage at its original cast level')+(e.saveActivity?', then ':'. '):'')+(e.saveActivity?(e.saveCondition==='gmNoLineOfSight'?'ask the GM whether the creature has lost line of sight to the caster; if so, request its saving throw. ':'request its saving throw. '):'')+(e.saveActivity&&e.endOnSuccess?'Remove '+e.effectName+' on success.':'');}
 async loadDroppedSpell(item){
  validateSourceSpell(item);
  const choices=entrySourceOptions(item,this.draft);if((!choices.damage.length&&!choices.save.length)||!choices.effects.length)throw Error("Choose a spell with an applied effect and a damage or save activity.");
  const e={...this.draft,sourceSpellUuid:item.uuid,sourceIdentifier:item.identifier??item.system?.identifier};
  for(const [list,name,id]of [[choices.effects,'effectName','effectId'],[choices.damage,'damageActivity','damageActivityId'],[choices.save,'saveActivity','saveActivityId']]){const match=list.find(option=>option.name===e[name])??list[0];e[name]=match?.name??"";e[id]=match?.id??"";}
  this.source=item;this.draft=e;await this.render({force:true});
 }
 _onRender(context,options){
  super._onRender(context,options);this.updatePreview();
  for(const input of this.element.querySelectorAll('input,select'))input.addEventListener('change',()=>this.updatePreview());
  for(const button of this.element.querySelectorAll('[data-info]'))button.addEventListener('click',()=>{const [title,text]=HELP[button.dataset.info];foundry.applications.api.DialogV2.wait({window:{title},content:'<p>'+escape(text)+'</p>',rejectClose:false,buttons:[{action:'close',label:'Close',default:true}]});});
  this.element.querySelector('[data-choose-source]').addEventListener('click',()=>{this.readDraft();new TriggerSourceApp(item=>this.loadDroppedSpell(item)).render({force:true});});
  this.element.querySelector('[data-save]').addEventListener('click',async()=>{if(this.busy)return;this.busy=true;try{const draft=this.readDraft();if(this.element.querySelector('[name="damageMode"]').value==="custom"&&!draft.damageFormula)throw Error("Enter a custom damage formula, or choose Use spell damage.");await saveTriggerEntry(this.entryKey,draft);this.onChange?.();await this.close();}catch(error){ui.notifications.error(error.message);}finally{this.busy=false;}});
  this.element.querySelector('[data-reset]').addEventListener('click',async()=>{if(this.busy)return;this.busy=true;try{const overrides=foundry.utils.deepClone(game.settings.get(ID,"triggerLibraryOverrides")??{});if(TRIGGER_DEFAULTS[this.entryKey]){delete overrides[this.entryKey];await game.settings.set(ID,"triggerLibraryOverrides",overrides);}else if(!triggerEntry(this.entryKey)){await this.close();return;}this.draft=null;this.source=null;this.onChange?.();await this.render({force:true});}catch(error){ui.notifications.error(error.message);}finally{this.busy=false;}});
 }
 async close(options){this.draft=null;this.source=null;return super.close(options);}
}
Hooks.once("init",()=>{game.settings.register(ID,"triggerLibraryCustoms",{scope:"world",config:false,type:Object,default:{}});game.settings.register(ID,"triggerLibraryOverrides",{scope:"world",config:false,type:Object,default:{}});game.settings.registerMenu(ID,"triggerLibrary",{name:"Trigger Automation Library",label:"Creature Effect Triggers",hint:"Configure recurring triggers without replacing native book effects or Region settings.",icon:"fa-solid fa-clock",type:TriggerLibraryApp,restricted:true});});
let shortcutLibrary;
Hooks.on("renderCompendiumDirectory",(app,html)=>{
 if(!game.user.isGM)return;
 const root=html instanceof HTMLElement?html:html?.[0];
 if(!root||root.querySelector(".rsa-open-trigger-library"))return;
 const region=root.querySelector(".rsa-open-spell-manager"),browser=root.querySelector(".open-compendium-browser"),actions=root.querySelector(".header-actions");
 if(!region&&!browser&&!actions)return;
 const button=document.createElement("button");button.type="button";button.className="rsa-open-trigger-library";button.style.cssText="flex:0 0 100%;width:100%;";
 button.innerHTML='<i class="fa-solid fa-clock" aria-hidden="true"></i> Open Trigger Automation Library';
 button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();if(!game.user.isGM)return;shortcutLibrary??=new TriggerLibraryApp();shortcutLibrary.render({force:true});shortcutLibrary.bringToFront?.();});
 if(region)region.insertAdjacentElement("afterend",button);else if(browser)browser.insertAdjacentElement("afterend",button);else actions.append(button);
});
export function validateSourceSpell(item){
 if(item?.documentName!=="Item"||item.type!=="spell")throw Error("Please choose a spell from a sheet or compendium.");
 const choices=entrySourceOptions(item);if((!choices.damage.length&&!choices.save.length)||!choices.effects.length)throw Error("Choose a spell with an applied effect and a damage or save activity.");return item;
}
export function newTriggerFromSpell(item){
 validateSourceSpell(item);const choices=entrySourceOptions(item);
 const recipe=Object.values(TRIGGER_DEFAULTS).find(entry=>entry.sourceSpellUuid===item.uuid||entry.name===item.name);
 return {name:item.name,enabled:true,attachment:"creature",effectName:choices.effects[0].name,effectId:choices.effects[0].id,event:recipe?.event??"turnStart",saveCondition:recipe?.saveCondition??"always",targetingRegionCleanup:recipe?.targetingRegionCleanup??"native",damageActivity:choices.damage[0]?.name??"",damageActivityId:choices.damage[0]?.id??"",saveActivity:choices.save[0]?.name??"",saveActivityId:choices.save[0]?.id??"",damageFormula:"",sourceSpellUuid:item.uuid,sourceIdentifier:item.identifier??item.system?.identifier,endOnSuccess:!!choices.save.length};
}
export class TriggerSourceApp extends foundry.applications.api.ApplicationV2{
 static DEFAULT_OPTIONS={window:{title:"Choose Trigger Source",resizable:true},position:{width:570,height:350}};
 constructor(onChoose){super({id:"rsa-trigger-source-"+foundry.utils.randomID()});this.onChoose=onChoose;}
 async _renderHTML(){return `<div style="padding:16px;display:grid;gap:14px;overflow-y:auto"><p>Choose the spell whose effect needs recurring automation. Its existing effects and stats will be preserved.</p><div data-source-drop style="border:2px dashed var(--color-border-light-primary);border-radius:6px;padding:24px;text-align:center"><i class="fa-solid fa-book-open" aria-hidden="true"></i> Drop a spell from a sheet or compendium</div><label>Or paste the spell’s UUID <input name="sourceUuid" type="text" placeholder="Compendium.… or Actor.…Item.…"></label><footer style="display:flex;gap:8px"><button type="button" data-load-source>Load Spell</button><button type="button" data-cancel-source>Cancel</button></footer></div>`;}
 _replaceHTML(result,content){content.innerHTML=result;}
 async chooseUuid(uuid){if(this.busy)return;this.busy=true;try{if(!uuid?.trim())throw Error("Drop a spell or enter its UUID.");const item=validateSourceSpell(await fromUuid(uuid.trim()));await this.onChoose(item);await this.close();}catch(error){ui.notifications.error(error.message);}finally{this.busy=false;}}
 _onRender(context,options){super._onRender(context,options);const drop=this.element.querySelector('[data-source-drop]');drop.addEventListener('dragover',event=>event.preventDefault());drop.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();const data=foundry.applications.ux.TextEditor.getDragEventData(event);this.chooseUuid(data?.uuid);});this.element.querySelector('[data-load-source]').addEventListener('click',()=>this.chooseUuid(this.element.querySelector('[name="sourceUuid"]').value));this.element.querySelector('[data-cancel-source]').addEventListener('click',()=>this.close());this.element.querySelector('[name="sourceUuid"]').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();this.chooseUuid(event.currentTarget.value);}});}
}
