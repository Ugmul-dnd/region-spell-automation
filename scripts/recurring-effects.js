import {triggerEntry,triggerKeyForSpell} from "./trigger-library.js";
import {selectSaveUser,sendSavePrompt} from "./save-prompts.js";
const ID="ugmuls-5-5e-automation",running=new Set(),opened=new Set();
const authority=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
const active=effect=>effect&&!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true;
const originOf=card=>typeof card?.system?.origin==="string"?game.messages.get(card.system.origin):card?.system?.origin;
const report=error=>{console.error("Ugmuls 5.5e Automation | Recurring effect",error);ui.notifications.error("Recurring effect could not finish: "+error.message);};
export function hasExternalTurnAutomation(effect){return Array.from(effect?.changes??effect?.system?.changes??[]).some(change=>/OverTime|macro\.(execute|itemMacro)|onTurn/i.test(change.key??""));}
export async function registerRecurringEffect(effect,{spell,level,sourceCard}={}){
 if(!authority()||!effect||hasExternalTurnAutomation(effect))return;
 const previous=effect.getFlag?.(ID,"recurringEffect");if(previous&&(!sourceCard||previous.sourceCard===sourceCard.uuid))return;
 const key=triggerKeyForSpell(spell,effect),entry=triggerEntry(key);
 if(!entry?.enabled||effect.name!==entry.effectName)return;
 const save=Array.from(spell.system.activities??[]).find(a=>a.type==="save"&&(a.id===entry.saveActivityId||a.name===entry.saveActivity));
 const dc=entry.saveActivity?Number(save?.save?.dc?.value):null;if(entry.saveActivity&&(!Number.isFinite(dc)||dc<=0))throw Error(entry.name+" needs a configured save DC.");
 await effect.setFlag(ID,"recurringEffect",{instance:foundry.utils.randomID(),key,spell:spell.uuid,caster:spell.actor?.uuid??spell.parent?.uuid,level:Number(level??spell.system.level),dc,sourceCard:sourceCard?.uuid??effect.system?.origin?.message});
}
async function registerNativeEffect(effect){
 if(!authority()||effect.getFlag?.(ID,"recurringEffect"))return;
 const activity=effect.system?.origin?.activity?await fromUuid(effect.system.origin.activity):null;
 const source=effect._stats?.duplicateSource?await fromUuid(effect._stats.duplicateSource):null;
 const spell=activity?.item??source?.parent;if(spell?.type!=="spell")return;
 await registerRecurringEffect(effect,{spell,level:effect.getFlag?.("dnd5e","spellLevel")});
}
export function buildRecurringItem(spell,entry,record,phase){
 const source=Array.from(spell.system.activities??[]).find(a=>a.type===(phase==="damage"?"damage":"save")&&(a.id===(phase==="damage"?entry.damageActivityId:entry.saveActivityId)||a.name===(phase==="damage"?entry.damageActivity:entry.saveActivity)));
 if(!source)throw Error("Missing "+phase+" activity for "+entry.name+". Check the Trigger Automation Library.");
 const data=spell.toObject(),id=source.id;data._id=foundry.utils.randomID();data.name=entry.name+" — "+(phase==="damage"?"Recurring damage":"End effect save");
 const selected=data.system.activities[id];data.system.activities={[id]:selected};selected.effects=[];
 selected.activation={type:"special",override:true};selected.duration={units:"inst",concentration:false,override:true};selected.target={override:true,prompt:false,affects:{type:"creature",count:"1",choice:false},template:{type:""}};selected.range={override:true,units:"any"};
 if(phase!=="damage"){
  selected.damage.parts=[];selected.save.dc={calculation:"",formula:String(record.dc)};
  // AA recognizes the spell name on postUseActivity, including save-only
  // helpers. Disable animation recognition only on these disposable clones.
  const quietAnimation=flags=>({version:Math.max(5,Number(flags?.version)||0),isEnabled:false,isCustomized:false,killAnim:true});
  data.flags??={};data.flags.autoanimations=quietAnimation(data.flags.autoanimations);
  selected.flags??={};selected.flags.autoanimations=quietAnimation(selected.flags.autoanimations);
 }
 else if(entry.damageFormula){selected.damage.parts=[{custom:{enabled:true,formula:entry.damageFormula},types:selected.damage.parts[0]?.types??["fire"],scaling:{mode:""}}];}
 return {data,id};
}
async function createRecurringCard(effect,token,record,stamp,phase){
 const entry=triggerEntry(record.key);if(!entry?.enabled||!active(effect))return;
 const spell=await fromUuid(record.spell);if(!spell?.actor)throw Error("The recurring effect’s source spell is unavailable.");
 const {data,id}=buildRecurringItem(spell,entry,record,phase),item=new CONFIG.Item.documentClass(data,{parent:spell.actor});
 const descriptor={token:token.uuid,actor:token.actor.uuid,name:token.name,img:token.texture?.src??token.actor.img};
 const link={effect:effect.uuid,instance:record.instance,stamp,phase,key:record.key};
 const sourceRef=record.sourceCard??effect.system?.origin?.message;
 const source=sourceRef?await fromUuid(sourceRef):null;
 const originalMeta=source?.getFlag?.(ID,"metamagic"),conversion=source?.getFlag?.(ID,"transmutedSpell");
 // Reuse persistent casting choices. Careful Spell's initial-save protection
 // must not turn into automatic success on later repeat saves.
 const inherited={...(originalMeta?{metamagic:{...originalMeta,careful:[]}}:{}),...(conversion?{transmutedSpell:conversion}:{})};
 const result=await item.system.activities.get(id).use({consume:false,scaling:Math.max(0,record.level-Number(spell.system.level)),concentration:{begin:false},create:{measuredTemplate:false},subsequentActions:false},{configure:false},{data:{system:{targets:[descriptor]},flags:{dnd5e:{item:{data}},[ID]:{...inherited,riderTriggered:true,recurringTrigger:link}}}});
 if(!result?.message)throw Error("Recurring "+phase+" card was not created.");
 return result.message;
}
export async function processRecurringTurn(combat,changes){
 if(!authority()||!combat.started||!combat.combatant||!("turn" in changes||"round" in changes||changes.started===true))return;
 const incoming=combat.combatant,prior=combat.previous;
 const subjects=[{combatant:incoming,event:"turnStart",round:combat.round,turn:combat.turn}];
 if(changes.started!==true&&prior?.combatantId&&(prior.combatantId!==incoming.id||prior.round!==combat.round)){const outgoing=combat.combatants.get(prior.combatantId);if(outgoing)subjects.unshift({combatant:outgoing,event:"turnEnd",round:prior.round,turn:prior.turn});}
 for(const subject of subjects){const actor=subject.combatant.actor,token=subject.combatant.token;if(!actor||!token)continue;
 for(const effect of actor.effects??[]){const record=effect.getFlag?.(ID,"recurringEffect"),entry=record&&triggerEntry(record.key);if(!entry?.enabled||entry.event!==subject.event||!active(effect)||hasExternalTurnAutomation(effect))continue;
 const stamp=combat.id+":"+subject.round+":"+subject.turn+":"+subject.event;
 if(effect.getFlag(ID,"recurringLastTrigger")===stamp||running.has(effect.uuid))continue;
 running.add(effect.uuid);try{await effect.setFlag(ID,"recurringLastTrigger",stamp);const card=await createRecurringCard(effect,token,record,stamp,entry.damageActivity?"damage":entry.saveCondition==="gmNoLineOfSight"?"condition":"save");if(!card)await effect.unsetFlag(ID,"recurringLastTrigger");}catch(error){await effect.unsetFlag(ID,"recurringLastTrigger");report(error);}finally{running.delete(effect.uuid);}
 }}
}
export async function promptRecurringDamage(card){
 const link=card?.getFlag?.(ID,"recurringTrigger");if(card?.type!=="usage"||link?.phase!=="damage"||opened.has(card.id))return;
 const activity=card.getAssociatedActivity?.({scaled:true});if(!activity)return;
 const recipient=selectSaveUser(activity.actor??activity.item?.actor,game.users,game.users.activeGM);if(recipient?.id!==game.user.id)return;
 const effect=await fromUuid(link.effect);if(!active(effect)||!triggerEntry(link.key)?.enabled)return;
 opened.add(card.id);
 // Native damage-only chat actions omit system.origin. Keep the usage link
 // explicit so pending-card completion can advance to the saving throw.
 const dialog=globalThis.Ugmuls55eAutomationDamage?.configurePromptDialog?.("damage",{configure:true})??{configure:true};
 try{await activity.rollDamage({isCritical:false},dialog,{data:{system:{origin:card.id,targets:card.system.targets},flags:{[ID]:{riderTriggered:true,recurringTrigger:link}}}});}catch(error){opened.delete(card.id);throw error;}
}
export async function advanceRecurringCard(card){
 if(!authority())return;
 const usage=card?.type==="usage"?card:originOf(card),link=usage?.getFlag?.(ID,"recurringTrigger");
 if(!link||running.has(usage.id))return;
 const effect=await fromUuid(link.effect);if(!active(effect)||!triggerEntry(link.key)?.enabled)return;
 const record=effect.getFlag(ID,"recurringEffect");if(!record||record.instance!==link.instance)return;
 if(link.phase==="damage"){
  if(card.type!=="damage"||!card.rolls?.length||card.getFlag(ID,"pendingDamage")||usage.getFlag(ID,"recurringSaveCard"))return;
  running.add(usage.id);try{
   await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(card);
   if(!active(effect)||effect.getFlag(ID,"recurringEffect")?.instance!==link.instance)return;
   if(!triggerEntry(record.key)?.saveActivity){await usage.setFlag(ID,"recurringSaveCard","none");return;}
   const token=await fromUuid(usage.system.targets?.[0]?.token);if(!token?.actor)return;
   const save=await createRecurringCard(effect,token,record,link.stamp,triggerEntry(record.key)?.saveCondition==="gmNoLineOfSight"?"condition":"save");if(save)await usage.setFlag(ID,"recurringSaveCard",save.id);
  }finally{running.delete(usage.id);}
 }else if(link.phase==="save"&&usage.system.outcomes?.get(usage.system.targets?.[0]?.token)==="success"&&triggerEntry(record.key)?.endOnSuccess){
  running.add(usage.id);try{await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(usage);if(active(effect)&&effect.getFlag(ID,"recurringEffect")?.instance===link.instance)await effect.delete();}finally{running.delete(usage.id);}
 }
}
export async function resolveRecurringCondition(card,eligible){
 if(!authority()||running.has(card?.id))return;
 const link=card?.getFlag?.(ID,"recurringTrigger");if(link?.phase!=="condition")return;
 running.add(card.id);try{
  const effect=await fromUuid(link.effect);if(!active(effect)||effect.getFlag(ID,"recurringEffect")?.instance!==link.instance)return;
  await card.setFlag(ID,"recurringTrigger",{...link,phase:eligible?"save":"skipped"});
  await ui.chat?.updateMessage?.(card);
  if(eligible){const token=await fromUuid(card.system.targets?.[0]?.token);if(token?.actor)await sendSavePrompt(card,token,"spell");}
 }finally{running.delete(card.id);}
}
export function renderRecurringCondition(message,html){
 const root=html?.[0]??html;if(!root?.querySelectorAll)return;
 const entries=[{card:message,root}];
 for(const summary of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(summary.dataset.messageId);if(card)entries.push({card,root:summary});}
 for(const entry of entries){
  entry.root.querySelectorAll('[data-rsa-recurring-condition]').forEach(node=>node.remove());
  const link=entry.card.getFlag?.(ID,"recurringTrigger");if(!["condition","skipped"].includes(link?.phase)||entry.card.isContentVisible===false)continue;
  const box=document.createElement("div");box.dataset.rsaRecurringCondition="";box.style.cssText="padding:8px;display:grid;gap:6px;";
  const text=document.createElement("p");text.textContent=link.phase==="skipped"?"Repeat save skipped: creature can still see the caster.":"Repeat save pending: the GM must confirm that this creature no longer has line of sight to the caster.";box.append(text);
  if(link.phase==="condition"&&authority())for(const [label,eligible]of [["No line of sight — Roll save",true],["Can see caster — Skip save",false]]){
   const button=document.createElement("button");button.type="button";button.textContent=label;button.addEventListener("click",async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{await resolveRecurringCondition(entry.card,eligible);}catch(error){report(error);}finally{button.disabled=false;}});box.append(button);
  }
  (entry.root.querySelector('.chat-card')??entry.root).append(box);
 }
}
Hooks.once("ready",()=>{
 globalThis.Ugmuls55eAutomationRecurring={registerRecurringEffect};
 Hooks.on("dnd5e.renderChatMessage",renderRecurringCondition);
 Hooks.on("createActiveEffect",effect=>registerNativeEffect(effect).catch(report));
 Hooks.on("updateCombat",(combat,changes)=>{processRecurringTurn(combat,changes).catch(report);});
 for(const event of ["createChatMessage","updateChatMessage"])Hooks.on(event,card=>{if(card.type==="usage"&&card.getFlag?.(ID,"recurringTrigger")?.phase==="damage")setTimeout(()=>promptRecurringDamage(card).catch(report),0);advanceRecurringCard(card).catch(report);});
});
