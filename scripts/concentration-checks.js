import {selectSaveUser} from "./save-prompts.js";
const ID="ugmuls-5-5e-automation",rolling=new Set(),queue=new Map();
const record=card=>card?.getFlag?.(ID,"concentrationCheck");
const currentEffects=actor=>Array.from(actor?.concentration?.effects??[]);
const coordinator=card=>game.users.activeGM??(card?.author?.active?card.author:selectSaveUser(actorFor(card),game.users,null));
const enabled=()=>game.settings.get(ID,"promptConcentrationChecks")===true;
function actorFor(card){return card?.getAssociatedActor?.()??ChatMessage.getSpeakerActor(card?.speaker);}
export function prepareConcentrationPrompt(card){
 if(card.type!=="prompt"||!enabled()&&game.settings.get(ID,"autoBreakConcentration")!==true)return;
 const button=Array.from(card.system?.buttons??[]).find(button=>button.type==="concentration");if(!button)return;
 const actor=actorFor(card),effects=currentEffects(actor);if(!actor||!effects.length)return;
 const dc=Number(button.dc);if(!Number.isFinite(dc)||dc<1)return;
 const owner=selectSaveUser(actor,game.users,game.users.activeGM);
 const state={actor:actor.uuid,dc,ability:button.ability??null,effects:effects.map(effect=>effect.id),userId:owner?.id??null,session:foundry.utils.randomID(),status:"pending"};
 const viewers=new Set(Array.from(card.whisper??[],user=>typeof user==="string"?user:user.id));
 for(const user of game.users)if(user.isGM||user.id===owner?.id)viewers.add(user.id);
 card.updateSource({["flags."+ID+".concentrationCheck"]:state,whisper:[...viewers]});
}
function serial(card,task){const next=(queue.get(card.id)??Promise.resolve()).then(task);queue.set(card.id,next);return next.finally(()=>{if(queue.get(card.id)===next)queue.delete(card.id);});}
export async function dispatchConcentration(card,user=game.user,{manual=false}={}){
 if(coordinator(card)?.id!==game.user.id)return;
 return serial(card,async()=>{
  const state=record(card),actor=actorFor(card);if(!state||state.status==="resolved"||!actor)return;
  if(!user?.active||!user.isGM&&!actor.testUserPermission(user,"OWNER"))return;
  if(state.status==="rolling"&&(!manual||state.userId===user.id))return;
  if(!currentEffects(actor).some(effect=>state.effects.includes(effect.id))){await card.setFlag(ID,"concentrationCheck",{...state,status:"obsolete"});return;}
  const recipient=manual?user:selectSaveUser(actor,game.users,game.users.activeGM);if(!recipient)return;
  const next={...state,userId:recipient.id,session:foundry.utils.randomID(),status:"rolling"};
  await card.setFlag(ID,"concentrationCheck",next);
  const packet={action:"rollConcentrationCheck",messageId:card.id,userId:recipient.id,session:next.session,sourceId:game.user.id};
  if(recipient.id===game.user.id)receiveConcentration(packet).catch(report);else game.socket.emit("module."+ID,packet);
 });
}
export async function receiveConcentration(packet){
 if(packet.userId!==game.user.id)return;
 const card=game.messages.get(packet.messageId),state=record(card),actor=actorFor(card);
 if(!state||state.session!==packet.session||state.userId!==game.user.id||coordinator(card)?.id!==packet.sourceId||!actor?.isOwner||rolling.has(card.id))return;
 if(!currentEffects(actor).some(effect=>state.effects.includes(effect.id)))return;
 rolling.add(card.id);
 try{
  const auto=!game.users.get(state.userId)?.isGM?false:globalThis.Ugmuls55eAutomationNpcDamage?.shouldAutoRollNpc(actor)===true;
  const config={target:state.dc,...(state.ability?{ability:state.ability}:{}),...(auto?{rsaAutoNpcSave:true}:{})};
  const dialog={configure:!auto,options:{id:"rsa-concentration-"+card.id}};
  const positioned=auto?dialog:globalThis.Ugmuls55eAutomationDamage?.configurePromptDialog("save",dialog)??dialog;
  const rolls=await actor.rollConcentration(config,positioned,{data:{speaker:card.speaker,whisper:card.whisper,blind:card.blind??false,system:{origin:card.id},flags:{[ID]:{concentrationRequest:{id:card.id,session:state.session,actor:actor.uuid,effects:state.effects,dc:state.dc}}}}});
  if(!rolls?.length){const packet={action:"concentrationPromptClosed",messageId:card.id,userId:game.user.id,session:state.session};if(coordinator(card)?.id===game.user.id)await releaseConcentration(card,packet);else game.socket.emit("module."+ID,packet);}
 }catch(error){
  const closed={action:"concentrationPromptClosed",messageId:card.id,userId:game.user.id,session:state.session};
  if(coordinator(card)?.id===game.user.id)await releaseConcentration(card,closed);else game.socket.emit("module."+ID,closed);
  throw error;
 }finally{rolling.delete(card.id);}
}
export async function releaseConcentration(card,packet){
 const state=record(card);if(coordinator(card)?.id!==game.user.id||!state||state.status!=="rolling"||state.session!==packet.session||state.userId!==packet.userId)return;
 await card.setFlag(ID,"concentrationCheck",{...state,status:"pending"});
}
export function validateConcentrationResult(card){
 const link=card.getFlag?.(ID,"concentrationRequest");if(!link)return;
 const state=record(game.messages.get(link.id));if(!state||state.session!==link.session||state.status!=="rolling"||state.actor!==link.actor)return false;
}
export async function resolveConcentration(card){
 const link=card?.getFlag?.(ID,"concentrationRequest");if(!link||!card.rolls?.length)return;
 const request=game.messages.get(link.id);if(!request||coordinator(request)?.id!==game.user.id)return;
 const pending=record(request);
 if(!pending||pending.session!==link.session||pending.status!=="rolling"||card.author?.id!==pending.userId)return;
 // Wait outside the request queue so a GM can still take over while dice animate.
 await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(card);
 if(game.messages.get(link.id)!==request||coordinator(request)?.id!==game.user.id)return;
 return serial(request,async()=>{
  const state=record(request),actor=await fromUuid(link.actor),roll=card.rolls[0];
  if(!state||state.session!==link.session||state.status!=="rolling"||state.actor!==actor?.uuid||card.author?.id!==state.userId)return;
  if(roll.evaluated===false||!Number.isFinite(roll.total))return;
  const failed=typeof roll.isFailure==="boolean"?roll.isFailure:Number(roll.total)<state.dc;
  await request.setFlag(ID,"concentrationCheck",{...state,status:"resolved",failed,resultId:card.id});
  if(failed&&game.settings.get(ID,"autoBreakConcentration")===true){
   for(const effect of currentEffects(actor))if(state.effects.includes(effect.id))await actor.endConcentration(effect);
  }
 });
}
export function renderConcentrationPrompt(card,html){
 const state=record(card),root=html?.querySelector?html:html?.[0];if(!state||!root||card.isContentVisible===false)return;
 root.querySelectorAll('.rsa-concentration-pending').forEach(node=>node.remove());
 root.querySelectorAll('[data-action="roll"]').forEach(button=>{button.hidden=true;});
 const actor=actorFor(card),holder=document.createElement("div");holder.className="rsa-concentration-pending";
 const button=document.createElement("button");button.type="button";
 const done=["resolved","obsolete"].includes(state.status);
 button.textContent=state.status==="resolved"?(state.failed?"Concentration failed":"Concentration maintained"):state.status==="obsolete"?"Concentration ended":"Pending concentration — "+(game.users.get(state.userId)?.name??"GM")+" · DC "+state.dc;
 button.disabled=done||!game.user.isGM&&!actor?.isOwner||state.status==="rolling"&&(!game.user.isGM||state.userId===game.user.id);
 button.dataset.tooltip="Click to roll this pending concentration check. A GM can take over.";
 button.addEventListener("click",async()=>{button.disabled=true;try{const source=coordinator(card);if(source?.id===game.user.id)await dispatchConcentration(card,game.user,{manual:true});else game.socket.emit("module."+ID,{action:"requestConcentrationCheck",messageId:card.id,userId:game.user.id});}catch(error){report(error);}});
 holder.append(button);root.append(holder);
}
function report(error){console.error("Concentration check",error);ui.notifications.error(error.message);}
Hooks.once("init",()=>{
 for(const[key,name,hint]of [["promptConcentrationChecks","Prompt Concentration Checks","Open native concentration saves for connected owners, falling back to the GM. GM-run monsters follow Automatically Roll GM NPC Saves. Pending cards allow retry or GM takeover."],["autoBreakConcentration","End Concentration on Failed Checks","End the concentration effects recorded for a requested check when it fails. Newer concentration effects are preserved."]])game.settings.register(ID,key,{name,hint,scope:"world",config:true,type:Boolean,default:true});
});
Hooks.once("ready",()=>{
 Hooks.on("preCreateChatMessage",prepareConcentrationPrompt);Hooks.on("preCreateChatMessage",validateConcentrationResult);
 Hooks.on("createChatMessage",card=>{if(record(card)&&enabled()&&coordinator(card)?.id===game.user.id)dispatchConcentration(card,game.user).catch(report);resolveConcentration(card).catch(report);});
 Hooks.on("dnd5e.renderChatMessage",renderConcentrationPrompt);
 Hooks.on("userConnected",(user,connected)=>{if(connected)return;for(const card of game.messages){const state=record(card);if(state&&!["resolved","obsolete"].includes(state.status)&&state.userId===user.id&&coordinator(card)?.id===game.user.id)dispatchConcentration(card,game.user,{manual:true}).catch(report);}});
 game.socket.on("module."+ID,packet=>{
  if(packet?.action==="rollConcentrationCheck")receiveConcentration(packet).catch(report);
  const card=game.messages.get(packet?.messageId);if(!card||coordinator(card)?.id!==game.user.id)return;
  if(packet.action==="requestConcentrationCheck"){const user=game.users.get(packet.userId);if(user?.active)dispatchConcentration(card,user,{manual:true}).catch(report);}
  if(packet.action==="concentrationPromptClosed")releaseConcentration(card,packet).catch(report);
 });
});
