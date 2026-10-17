// Only presentation is delayed; resource consumption and effect expiry remain synchronous workflows.
const ID="ugmuls-5-5e-automation",pending=new Map(),direct=new Map();let timer=null,running=false;
const rules={
 bardic:{setting:"bardicInspirationAutomation",types:["attack","save","check"],own:true,effect:/^inspired$/i},
 cutting:{setting:"cuttingWordsAutomation",types:["attack","damage"],feature:"cutting-words",all:true},
 valor:{setting:"combatInspirationAutomation",types:["attack","damage"],effect:/^inspired$/i,incoming:true},
 focus:{setting:"fanaticalFocusAutomation",types:["save"],feature:"fanatical-focus",own:true},
 peerless:{setting:"peerlessSkillAutomation",types:["attack","check"],feature:"peerless-skill",own:true},
 parry:{setting:"parryAutomation",types:["damage"],feature:"parry",incoming:true},
 shield:{setting:"showShieldReaction",types:["attack"],feature:"shield",incoming:true}
};
function owner(actor){return !!actor&&(game.user?.isGM||actor.isOwner);}
function actorOf(doc){if(doc?.documentName==="Actor")return doc;return doc?.actor??(doc?.parent?.documentName==="Actor"?doc.parent:null);}
function relevant(actor,rule,doc){
 if(!owner(actor))return false;
 const items=[...Array.from(actor.items??[]),...(doc?.documentName==="Item"?[doc]:[])];
 if(rule.feature&&!items.some(item=>(item.identifier??item.system?.identifier)===rule.feature||item.name?.trim().toLowerCase()===rule.feature.replaceAll("-"," ")))return false;
 if(rule.effect&&!Array.from(actor.effects??[]).concat(doc?.documentName==="ActiveEffect"?[doc]:[]).some(effect=>rule.effect.test(effect.name??"")))return false;
 return true;
}
function schedule(){if(timer===null&&!running)timer=setTimeout(()=>{timer=null;flushChatRefresh().catch(error=>console.error("Chat refresh",error));},32);}
export function requestFeatureRefresh(key,doc){
 const rule=rules[key];if(!rule||game.settings.get(ID,rule.setting)!==true)return;
 const actor=actorOf(doc),actors=actor?[actor]:doc?Array.from(doc.combatants??[],c=>c.actor).filter(Boolean):[...Array.from(game.actors??[]),...Array.from(globalThis.canvas?.scene?.tokens??[],token=>token.actor)].filter(Boolean);
 // Token movement can change Cutting Words range, including movement of an enemy.
 if(key==="cutting"&&doc?.documentName==="Token")actors.push(...Array.from(globalThis.canvas?.scene?.tokens??[],token=>token.actor).filter(Boolean));
 for(const actor of actors)if(relevant(actor,rule,doc))pending.set(key+":"+actor.uuid,{rule,actor});
 if(pending.size)schedule();
}
export function requestCardRefresh(card){if(card?.id){direct.set(card.id,card);schedule();}}
function associatedActor(card){return card.getAssociatedActor?.()??card.getAssociatedActivity?.()?.actor;}
function targetsActor(card,actor){return (card.system?.targets??[]).some(target=>target.actor===actor.uuid||(target.token&&globalThis.fromUuidSync?.(target.token,{strict:false})?.actor?.uuid===actor.uuid));}
export async function flushChatRefresh(){
 if(running)return;if(timer!==null){clearTimeout(timer);timer=null;}running=true;
 try{
  while(pending.size||direct.size){
   const requests=Array.from(pending.values()),cards=new Map(direct);pending.clear();direct.clear();
   if(requests.length)for(const card of Array.from(game.messages??[]).slice(-100)){
    if(requests.some(({rule,actor})=>rule.types.includes(card.type)&&(rule.all||(rule.own&&associatedActor(card)?.uuid===actor.uuid)||(rule.incoming&&targetsActor(card,actor)))))cards.set(card.id,card);
   }
   const list=Array.from(cards.values());for(let index=0;index<list.length;index+=8){
    await Promise.allSettled(list.slice(index,index+8).map(card=>Promise.resolve().then(()=>ui.chat?.updateMessage?.(game.messages?.get?.(card.id)??card))));
    if(index+8<list.length)await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
 }finally{running=false;if(pending.size||direct.size)schedule();}
}
Hooks.once("ready",()=>{globalThis.Ugmuls55eAutomationChatRefresh={request:requestFeatureRefresh,card:requestCardRefresh};});
