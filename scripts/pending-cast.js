const ID="ugmuls-5-5e-automation",sessions=new Map(),wrapped=new WeakSet();
const stateFor=data=>sessions.get(data?.flags?.[ID]?.castSession);
const originOf=card=>typeof card?.system?.origin==="string"?game.messages.get(card.system.origin):card?.system?.origin;
export function castState(card){return sessions.get(card?.getFlag?.(ID,"castSession"));}
function flags(state,extra={}){return {[ID]:{castSession:state.id,pendingCast:true,targetsConfirmationPending:true,...extra}};}
export async function publishPendingCast(state,activity,message){
 const nativeSystem=await activity.item.system.getCardData({activity});
 const data={type:activity.metadata?.usage?.messageType??"usage",speaker:ChatMessage.implementation.getSpeaker({actor:activity.actor}),...message.data};
 data.system={...nativeSystem,...message.data?.system,buttons:[],targets:message.data?.system?.targets??[]};
 data.flags=foundry.utils.mergeObject(data.flags??{},flags(state),{inplace:false});
 ChatMessage.applyMode(data,message.rollMode??CONFIG.Dice.BasicRoll.getMessageMode());
 const card=await ChatMessage.create(data);if(!card)throw Error("Could not publish the pending cast.");state.card=card;return card;
}
export function preparePendingCast(activity,usage,dialog,message){
 const state=stateFor(message?.data);if(!state)return;
 state.activity=activity;state.initialEffects=new Set(Array.from(activity.actor.effects??[],effect=>effect.id));
 state.ready=publishPendingCast(state,activity,message);
 state.ready.catch(error=>console.error("Pending cast",error));
 // Await publication before opening the native usage dialog or spending resources.
 const Dialog=dialog.applicationClass;
 if(Dialog){dialog.applicationClass=class extends Dialog{static async create(...args){await state.ready;return super.create(...args);}};}
 wirePendingActivity(state,activity);
}
function wirePendingActivity(state,activity){
 state.activities??=new WeakSet();if(state.activities.has(activity))return;state.activities.add(activity);state.activity=activity;
 const scaling=activity._prepareUsageScaling;
 activity._prepareUsageScaling=async function(config,...args){await state.ready;const result=await scaling.call(this,config,...args);if(config.concentration?.end){state.previousConcentration=config.concentration.end;config.concentration.end=false;}const rebuilt=args.at(-1)?.system?.activities?.get?.(this.id);if(rebuilt&&rebuilt!==this)wirePendingActivity(state,rebuilt);return result;};
 const finalize=activity._finalizeUsage;
 activity._finalizeUsage=async function(config,results){const result=await finalize.call(this,config,results);state.results=results;if(config.create?.measuredTemplate&&!results.templates?.length){config.subsequentActions=false;await cancelPendingCast(state.card);results.message=null;}return result;};
 const consume=activity.consume;
 activity.consume=async function(...args){await state.ready;return consume.apply(this,args);};
 const create=activity._createUsageMessage;
 activity._createUsageMessage=async function(config){
  await state.ready;
  const data=await create.call(this,{...config,create:false});
  state.deltas=data.system?.deltas??state.deltas;
  delete data._id;data.flags??={};data.flags[ID]??={};data.flags[ID].pendingCast=true;data.flags[ID].targetsConfirmationPending=config.data?.flags?.[ID]?.targetsConfirmationPending===true;await state.card.update(data);
  return state.card;
 };
}
export function trackCastTask(message,task){const state=stateFor(message?.data)??castState(message);if(state)state.tasks.push(Promise.resolve(task));return task;}
export async function settlePendingCast(card){
 const state=castState(card);if(!state||state.committed)return;state.committed=true;
 if(state.previousConcentration)await state.activity.actor.endConcentration(state.previousConcentration);
 await card.update({["flags."+ID+".pendingCast"]:false});sessions.delete(state.id);
}
export async function cancelPendingCast(card){
 const state=castState(card);if(!state||state.committed)return false;if(state.canceling)return state.canceling;
 state.canceling=(async()=>{
  await state.ready;
  // Never refund a cast after an actual attack/save/damage result exists.
  if(["attack","save","damage","healing","check"].some(type=>Array.from(card.getAssociatedRolls?.(type)??[]).some(roll=>roll.rolls?.length))){await settlePendingCast(card);return false;}
  await Promise.allSettled(state.tasks);
  for(const refund of state.refunds??[])await refund();state.refunds=[];
  if(state.deltas){await state.activity.refund(state.deltas);state.deltas=null;}
  const actor=state.activity.actor;
  const markers=Array.from(actor.effects??[]).filter(effect=>effect.getFlag?.(ID,"resourceUsage")===state.id||effect.getFlag?.(ID,"reactionUsage")===card.id);
  if(markers.length)await actor.updateEmbeddedDocuments("ActiveEffect",markers.map(effect=>({_id:effect.id,disabled:true})));
  for(const region of state.results?.templates??[])if(region.isOwner)await region.delete();
  for(const effect of state.results?.effects??[])if(effect.isOwner&&effect.parent?.uuid===actor.uuid&&!state.initialEffects?.has(effect.id))await effect.delete();
  await card.delete();sessions.delete(state.id);return true;
 })();return state.canceling;
}
export function installPendingCast(Type){
 let prototype=Type?.prototype;while(prototype&&!Object.hasOwn(prototype,"_createUsageMessage"))prototype=Object.getPrototypeOf(prototype);
 if(!prototype||wrapped.has(prototype)||typeof prototype.use!=="function")return;wrapped.add(prototype);
 const original=prototype.use;
 prototype.use=async function(usage={},dialog={},message={}){
  const data=message.data??{};
  if(!this.item?.isOwner||!this.item?.isEmbedded||!["spell","feat"].includes(this.item.type)||!["attack","save","damage","heal","check","utility"].includes(this.type)||message.create===false||data.flags?.[ID]?.regionTriggered||data.flags?.[ID]?.riderTriggered)return original.call(this,usage,dialog,message);
  const state={id:foundry.utils.randomID(),tasks:[],activity:this,committed:false};sessions.set(state.id,state);
  const config={...message,data:{...data,flags:foundry.utils.mergeObject(data.flags??{},{[ID]:{castSession:state.id}},{inplace:false})}};
  try{
   const result=await original.call(this,usage,dialog,config);state.results=result;
   if(!result?.message){if(state.ready){await state.ready;await cancelPendingCast(state.card);}else sessions.delete(state.id);}
   return result;
  }catch(error){if(state.ready){await state.ready;await cancelPendingCast(state.card);}else sessions.delete(state.id);throw error;}
 };
}
export function pendingRollDialog(config,dialog,message){
 const reference=message?.data?.system?.origin,card=typeof reference==="string"?game.messages.get(reference):reference;
 const state=castState(card);if(!state)return;
 const Base=dialog.applicationClass??CONFIG.Dice[config.subject?.type==="attack"||(config.hookNames??[]).some(name=>/attack|saving|check/i.test(name))?"D20Roll":"DamageRoll"]?.DefaultConfigurationDialog;
 if(!Base)return;
 dialog.applicationClass=class extends Base{async close(options){const result=await super.close(options);if(!options?.dnd5e?.submitted&&!state.committed)await cancelPendingCast(card);return result;}};
}
export function renderPendingCast(card,html){
 if(!card.getFlag?.(ID,"pendingCast"))return;
 const root=html?.querySelector?html:html?.[0];if(!root)return;
 root.querySelectorAll('.card-buttons').forEach(node=>node.hidden=true);
 if(!root.querySelector('.rsa-pending-cast')){const label=document.createElement('p');label.className='rsa-pending-cast';label.textContent='Pending — choosing targets or preparing the roll';(root.querySelector('.chat-card')??root).append(label);}
}
Hooks.once("ready",()=>{
 globalThis.Ugmuls55eAutomationPendingCast={cancel:cancelPendingCast,track:trackCastTask,onCancel:(card,refund)=>{const state=castState(card);if(state) (state.refunds??=[]).push(refund);return !!state;}};
 for(const type of Object.values(CONFIG.DND5E.activityTypes))installPendingCast(type.documentClass);
 Hooks.on("dnd5e.preUseActivity",preparePendingCast);
 Hooks.on("dnd5e.postActivityConsumption",(activity,usage,message)=>{const state=stateFor(message.data);if(state)state.deltas=foundry.utils.deepClone(message.data?.system?.deltas);});
 Hooks.on("dnd5e.postUseActivity",(activity,usage,results)=>{const state=castState(results?.message);if(state){state.results=results;if(activity.type==="utility"&&(!activity.roll?.formula||activity.roll?.prompt===false)&&!results.message.getFlag?.(ID,"targetsConfirmationPending"))settlePendingCast(results.message).catch(console.error);}});
 for(const kind of ["Attack","Damage","SavingThrow","AbilityCheck"])Hooks.on("dnd5e.preRoll"+kind+"V2",pendingRollDialog);
 Hooks.on("createChatMessage",card=>{if(!card.rolls?.length)return;const origin=originOf(card);if(castState(origin))settlePendingCast(origin).catch(console.error);});
 Hooks.on("ugmuls55eAutomation.targetsConfirmed",card=>{const state=castState(card);if(state?.activity.type==="utility"&&(!state.activity.roll?.formula||state.activity.roll?.prompt===false))settlePendingCast(card).catch(console.error);});
 Hooks.on("dnd5e.renderChatMessage",renderPendingCast);
});
