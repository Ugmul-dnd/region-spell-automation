import {describeTarget} from "./shared-activity-card.js";
const ID="ugmuls-5-5e-automation",channel="module."+ID,waiting=new Map(),busy=new Set(),cards=new Map();
let operations=Promise.resolve();
const flag=(card,key)=>card?.getFlag?.(ID,key)??card?.flags?.[ID]?.[key];
const originOf=card=>typeof card?.system?.origin==="string"?game.messages.get(card.system.origin):card?.system?.origin;
const actorFor=card=>card?.getAssociatedActor?.()??card?.getAssociatedActivity?.()?.actor;
const turn=()=>game.combat?.started?[game.combat.id,game.combat.round,game.combat.turn].join(":"):null;
const enabled=()=>game.settings.get(ID,"weaponMasteryAutomation")===true&&game.settings.get(ID,"masteryCleave")===true;
const owns=(actor,user)=>!!actor&&!!user?.active&&(user.isGM||actor.testUserPermission(user,"OWNER"));
export function isCleaveAttack(card){return !!(flag(card,"cleaveSource")||flag(originOf(card),"cleaveSource"));}
export function cleaveWeapon(card){
 if(card?.type!=="attack"||isCleaveAttack(card))return false;
 const item=card.getAssociatedItem?.(),activity=card.getAssociatedActivity?.();
 const mastery=card.system?.mastery??card.rolls?.[0]?.options?.mastery;
 const mode=card.system?.mode??card.rolls?.[0]?.options?.attackMode;
 return item?.type==="weapon"&&mastery==="cleave"&&item.system?.masteryOptions?.some(option=>option.value==="cleave")&&
  !mode?.includes("thrown")&&mode!=="ranged"&&(activity?.attack?.type?.value??item.system?.attackType)==="melee";
}
export function cleaveAvailable(card,user=game.user){
 const actor=actorFor(card),stamp=turn();
 return enabled()&&!!stamp&&cleaveWeapon(card)&&flag(card,"cleaveTurn")===stamp&&owns(actor,user)&&
  card.system?.evaluatedTargets?.some(target=>target.isMiss===false)&&actor.getFlag(ID,"cleaveUsedTurn")!==stamp;
}
function refresh(card){globalThis.Ugmuls55eAutomationChatRefresh?.card(card);const origin=originOf(card);if(origin)globalThis.Ugmuls55eAutomationChatRefresh?.card(origin);}
function refreshActor(actor){for(const id of cards.get(actor?.uuid)??[]){const card=game.messages.get(id);if(card)refresh(card);}}
function track(card){if(!cleaveWeapon(card))return;const actor=actorFor(card);if(!actor)return;const ids=cards.get(actor.uuid)??new Set();ids.add(card.id);cards.set(actor.uuid,ids);}
function cleaveContext(message){
 const data=message?.data??message,reference=data?.system?.origin,usage=typeof reference==="string"?game.messages.get(reference):reference;
 return {sourceId:flag(data,"cleaveSource")??flag(usage,"cleaveSource"),session:flag(data,"cleaveSession")??flag(usage,"cleaveSession")};
}
export function guardCleaveTargets(config,dialog,message){
 const {sourceId,session}=cleaveContext(message);if(!sourceId)return;
 const source=game.messages.get(sourceId),actor=actorFor(source),reservation=actor?.getFlag(ID,"cleaveReservation");
 const targets=message?.data?.system?.targets??Array.from(game.user.targets??[],token=>({token:(token.document??token).uuid}));
 if(targets.length!==1||source?.system?.targets?.some(target=>target.token===targets[0]?.token)){
  ui.notifications.warn("Cleave requires a different target from the first hit.");return false;
 }
 if(!reservation||reservation.session!==session||reservation.sourceId!==sourceId||reservation.userId!==game.user.id||reservation.turn!==turn()||reservation.target!==targets[0].token){
  ui.notifications.warn("This Cleave request is no longer available. Use a current attack card.");return false;
 }
 message.data.flags??={};message.data.flags[ID]={...message.data.flags[ID],cleaveSource:sourceId,cleaveSession:session};
}
export function prepareLateCleaveRoll(config,dialog,message){
 if(config.hookNames?.includes("attack"))return guardCleaveTargets(config,dialog,message);
 if(config.hookNames?.includes("damage"))prepareCleaveDamage(config,dialog,message);
}
export function prepareCleaveAttack(card){
 if(card.type!=="attack")return;
 if(cleaveWeapon(card)&&turn())card.updateSource({["flags."+ID+".cleaveTurn"]:turn()});
 const context=cleaveContext(card),source=context.sourceId;if(!source)return;
 card.updateSource({["flags."+ID+".cleaveSource"]:source,["flags."+ID+".cleaveSession"]:context.session});
 if(game.messages.get(source)?.system?.targets?.some(target=>card.system?.targets?.some(entry=>entry.token===target.token))){ui.notifications.warn("Cleave requires a different target from the first hit.");return false;}
 const actor=actorFor(card),reservation=actor?.getFlag(ID,"cleaveReservation");
 if(!reservation||reservation.sourceId!==source||reservation.session!==flag(card,"cleaveSession")||reservation.userId!==game.user.id||reservation.turn!==turn()||card.system?.targets?.length!==1||card.system.targets[0].token!==reservation.target){
  ui.notifications.warn("This Cleave request is no longer available. Use a current attack card.");return false;
 }
}
export async function cleaveOperation(action,source,payload,user){
 const actor=actorFor(source);if(!owns(actor,user))throw Error("You do not own this Cleave attack.");
 const reservation=actor.getFlag(ID,"cleaveReservation");
 if(action==="claim"){
  if(!cleaveAvailable(source,user))throw Error("Cleave is no longer available for this attack or turn.");
  if(reservation?.turn===turn()&&game.users.get(reservation.userId)?.active)throw Error("A Cleave attack is already being prepared.");
  const target=await fromUuid(payload.target);
  if(!target?.actor||source.system.targets?.some(entry=>entry.token===target.uuid))throw Error("Choose one different creature for Cleave.");
  const next={sourceId:source.id,userId:user.id,turn:turn(),session:foundry.utils.randomID(),target:target.uuid};
  await actor.setFlag(ID,"cleaveReservation",next);refreshActor(actor);return next;
 }
 if(reservation?.sourceId!==source?.id||reservation.session!==payload.session||reservation.userId!==user.id)return;
 if(action==="commit"){
  const result=game.messages.get(payload.resultId),usage=originOf(result);
  if(result?.type!=="attack"||!result.rolls?.length||flag(result,"cleaveSource")!==source.id||flag(result,"cleaveSession")!==reservation.session||
   flag(usage,"cleaveSession")!==reservation.session||actorFor(result)?.uuid!==actor.uuid||result.author?.id!==user.id||result.system?.targets?.length!==1||result.system.targets[0].token!==reservation.target)throw Error("The Cleave result could not be verified.");
  await actor.setFlag(ID,"cleaveUsedTurn",reservation.turn);
  await source.setFlag(ID,"cleaveResult",result.id);
 }
 if(action==="commit"||action==="release"){await actor.unsetFlag(ID,"cleaveReservation");refreshActor(actor);}
}
function operate(action,source,payload={}){
 const gm=game.users.activeGM;if(!gm)throw Error("An active GM is required for Cleave.");
 if(gm.id===game.user.id){const result=operations.then(()=>cleaveOperation(action,source,payload,game.user));operations=result.catch(()=>{});return result;}
 const requestId=foundry.utils.randomID();return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{waiting.delete(requestId);reject(Error("The GM did not answer the Cleave request."));},10000);
  waiting.set(requestId,{resolve,reject,timer});game.socket.emit(channel,{action:"cleaveOperation",operation:action,sourceId:source.id,payload,userId:game.user.id,gmId:gm.id,requestId});
 });
}
export async function useCleave(source){
 const actor=actorFor(source);if(!cleaveAvailable(source)||busy.has(actor.uuid))return;
 const targets=Array.from(game.user.targets??[]);
 if(targets.length!==1){ui.notifications.warn("This requires a single target before use");return;}
 const target=targets[0].document??targets[0];
 if(!target.actor||source.system.targets?.some(entry=>entry.token===target.uuid)){ui.notifications.warn("Choose one different creature for Cleave.");return;}
 busy.add(actor.uuid);let claim,usage,result;
 try{
  claim=await operate("claim",source,{target:target.uuid});
  const activity=source.getAssociatedActivity?.();if(!activity?.item?.isOwner)throw Error("The Cleave weapon is unavailable.");
  const descriptor=describeTarget(target);
  const data={system:{targets:[descriptor]},flags:{[ID]:{cleaveSource:source.id,cleaveSession:claim.session}}};
  const used=await activity.use({consume:false,subsequentActions:false},{configure:false},{data});usage=used?.message;
  if(!usage)return;
  await activity.rollAttack({attackMode:source.system.mode,mastery:"cleave",target:descriptor.ac},{},{data:{system:{origin:usage.id,targets:[descriptor]},flags:{[ID]:{cleaveSource:source.id,cleaveSession:claim.session}}}});
 }finally{
  try{
   result=Array.from(usage?.getAssociatedRolls?.("attack")??[]).find(card=>card.rolls?.length);
   if(claim)await operate(result?"commit":"release",source,{session:claim.session,resultId:result?.id});
   if(usage&&!result)await usage.delete();
  }finally{busy.delete(actor.uuid);refreshActor(actor);}
 }
}
export function prepareCleaveDamage(config,dialog,message){
 const usage=typeof message?.data?.system?.origin==="string"?game.messages.get(message.data.system.origin):message?.data?.system?.origin;
 const attack=typeof message?.data?.flags?.[ID]?.damageAttackId==="string"?game.messages.get(message.data.flags[ID].damageAttackId):null;
 const source=flag(usage,"cleaveSource")??flag(attack,"cleaveSource")??flag(message?.data,"cleaveSource");
 if(!source)return;
 // Change only the base weapon's ability contribution; bonuses and new target riders remain native.
 // AC5E restores its saved formula during dialog rebuilds. Adjust the constructed roll instead.
 message.data.flags??={};message.data.flags[ID]={...message.data.flags[ID],cleaveSource:source};
}
export function finalizeCleaveDamage(app,rolls){
 const config=app.config??{},message=app.message;
 const {sourceId}=cleaveContext(message);if(!sourceId&&!flag(message?.data,"cleaveSource"))return rolls;
 const baseIndex=config.rolls?.findIndex(roll=>roll.base===true)??-1;
 const index=baseIndex>=0?baseIndex:config.subject?.type==="attack"&&config.subject.item?.type==="weapon"?0:-1,roll=rolls[index];
 if(index<0||!roll||roll.options?.rsaCleaveAbilityRemoved||roll._evaluated)return rolls;
 const modifier=Number(roll.data?.mod??config.rolls[index]?.data?.mod);
 if(!Number.isFinite(modifier)||modifier<=0)return rolls;
 const result=[...rolls];
 result[index]=new roll.constructor(roll.formula+" - "+modifier+"[Cleave ability modifier]",roll.data,
  {...foundry.utils.deepClone(roll.options??{}),configured:true,preprocessed:true,rsaCleaveAbilityRemoved:true});
 return result;
}
export function renderCleave(card,html){
 const root=html?.querySelector?html:html?.[0];if(!root||card.isContentVisible===false)return;
 root.querySelectorAll('[data-rsa-cleave]').forEach(node=>node.remove());
 if(flag(card,"cleaveSource")){
  const face=root.querySelector('.chat-card');if(face&&!face.querySelector('.rsa-cleave-label')){const label=document.createElement('p');label.className='rsa-cleave-label';label.textContent='Cleave';face.prepend(label);}
 }
 const attacks=card.type==="attack"?[card]:card.type==="usage"?card.getAssociatedRolls?.("attack")??[]:[];
 for(const attack of attacks){
  track(attack);if(!cleaveAvailable(attack))continue;
  const button=document.createElement('button');button.type='button';button.dataset.rsaCleave=attack.id;button.textContent='Cleave';
  const actor=actorFor(attack),reservation=actor.getFlag(ID,"cleaveReservation");button.disabled=busy.has(actor.uuid)||reservation?.turn===turn()&&game.users.get(reservation.userId)?.active;
  button.dataset.tooltip='Select a different creature, then make your Cleave attack. Range is checked by the table.';
  button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{await useCleave(attack);}catch(error){report(error);}finally{refresh(attack);}});
  root.append(button);
 }
}
function report(error){console.error("Cleave",error);ui.notifications.error(error.message??"Could not complete Cleave.");}
Hooks.once("init",()=>game.settings.register(ID,"masteryCleave",{name:"Cleave",hint:"Offer a chat-card Cleave attack after a hit with an unlocked Cleave mastery. One extra attack per combat turn, with manual target/range selection and no positive ability modifier to its damage. Corrections to the original attack remain manual.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
 globalThis.Ugmuls55eAutomationCleave={isCleaveAttack,finalizeCleaveDamage};
 Hooks.on("dnd5e.postDamageRollConfiguration",(rolls,config,dialog,message)=>{const adjusted=finalizeCleaveDamage({config,message},rolls);if(adjusted!==rolls)rolls.splice(0,rolls.length,...adjusted);});
 Hooks.on("dnd5e.preRollV2",prepareLateCleaveRoll);
 Hooks.on("dnd5e.postAttackRollConfiguration",(rolls,config,dialog,message)=>guardCleaveTargets(config,dialog,message));
 Hooks.on("preCreateChatMessage",prepareCleaveAttack);Hooks.on("dnd5e.preRollDamageV2",prepareCleaveDamage);Hooks.on("dnd5e.renderChatMessage",renderCleave);
 Hooks.on("createChatMessage",card=>{track(card);if(cleaveWeapon(card))refresh(card);});
 Hooks.on("updateActor",(actor,changes)=>{if(changes.flags?.[ID]||Object.keys(changes).some(key=>key.startsWith("flags."+ID)))refreshActor(actor);});
 Hooks.on("updateCombat",(combat,changes)=>{if(!["turn","round","started"].some(key=>Object.hasOwn(changes,key)))return;for(const ids of cards.values())for(const id of ids){const card=game.messages.get(id);if(card)refresh(card);}cards.clear();});
 Hooks.on("deleteChatMessage",card=>{for(const ids of cards.values())ids.delete(card.id);});
 game.socket.on(channel,packet=>{
  if(packet?.action==="cleaveReply"&&packet.userId===game.user.id){const entry=waiting.get(packet.requestId);if(!entry)return;clearTimeout(entry.timer);waiting.delete(packet.requestId);packet.error?entry.reject(Error(packet.error)):entry.resolve(packet.result);return;}
  if(packet?.action!=="cleaveOperation"||!game.user.isGM||game.users.activeGM?.id!==game.user.id||packet.gmId!==game.user.id)return;
  const user=game.users.get(packet.userId);if(!user?.active)return;
  const task=operations.then(()=>cleaveOperation(packet.operation,game.messages.get(packet.sourceId),packet.payload,user));operations=task.catch(()=>{});
  task.then(result=>game.socket.emit(channel,{action:"cleaveReply",requestId:packet.requestId,userId:user.id,result}),error=>game.socket.emit(channel,{action:"cleaveReply",requestId:packet.requestId,userId:user.id,error:error.message}));
 });
});
