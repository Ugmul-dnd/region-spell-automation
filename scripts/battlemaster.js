import {applyConditionWithUndo} from "./damage-undo.js";
import {createEventQueue,describeTarget,isRollAdjustmentLocked} from "./shared-activity-card.js";
import {seekingSnapshot} from "./seeking-spell.js";
const ID="ugmuls-5-5e-automation",selected=new WeakMap(),dieChoices=new WeakMap(),pending=new WeakMap(),reservations=new Map(),enqueue=createEventQueue(),applying=new Set();
const names={precision:"Precision Attack",trip:"Trip Attack",distracting:"Distracting Strike",menacing:"Menacing Attack",goading:"Goading Attack",maneuvering:"Maneuvering Attack",pushing:"Pushing Attack"};
const enabled=key=>game.settings.get(ID,`${key}AttackAutomation`)===true;
const actorFor=card=>card?.getAssociatedActor?.()??card?.getAssociatedActivity?.()?.actor;
const originOf=card=>typeof card?.system?.origin==="string"?game.messages.get(card.system.origin):card?.system?.origin;
const authority=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
export function maneuverFeature(actor,key){return Array.from(actor?.items??[]).find(item=>item.type==="feat"&&((item.identifier??item.system?.identifier)===(key==="distracting"?"distracting-strike":key+"-attack")||item.name?.trim().toLowerCase()===names[key]?.toLowerCase()));}
export function superiorityResource(actor){
    const items=Array.from(actor?.items??[]);
    return items.find(item=>(item.identifier??item.system?.identifier)==="combat-superiority"||/^combat superiority$/i.test(item.name??""))??null;
}
export function superiorityRemaining(actor){const uses=superiorityResource(actor)?.system?.uses;return Math.max(0,Number(uses?.value??(Number(uses?.max)-Number(uses?.spent??0)))||0);}
export function superiorityFormula(actor,key){
    const feature=maneuverFeature(actor,key),activities=Array.from(feature?.system?.activities??[]),data=actor?.getRollData?.()??{};
    const scale=data.scale?.["battle-master"]?.superiority??actor?.system?.scale?.["battle-master"]?.superiority;
    const native=activities.find(activity=>activity.damage?.parts?.length)?.damage.parts[0];
    const raw=key==="precision"?activities.find(activity=>activity.roll?.formula)?.roll.formula:native?.custom?.enabled?native.custom.formula:native?.denomination?`${native.number??1}d${native.denomination}`:null;
    const configured=raw??scale?.die;
    if(!configured)return null;
    const formula=CONFIG.Dice.BasicRoll.replaceFormulaData(String(configured),data,{missing:""});
    // A maneuver adds exactly one current Superiority Die, not the pool size.
    const match=/^\s*(?:1)?d(\d+)\s*$/i.exec(formula);return match&&Number(match[1])>=2?`1d${Number(match[1])}`:null;
}

const maneuverTurn=()=>game.combat?.started?game.combat.id+":"+game.combat.round+":"+game.combat.turn:null;
export const relentlessFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&item.system?.source?.rules!=="2014"&&((item.identifier??item.system?.identifier)==="relentless"||/^relentless$/i.test(item.name?.trim()??"")));
export function relentlessAvailable(actor,except=null){const turn=maneuverTurn();return !!(turn&&game.settings.get(ID,"relentlessAutomation")===true&&relentlessFeature(actor)&&actor.getFlag?.(ID,"relentlessTurn")!==turn&&!Array.from(reservations.values()).some(entry=>entry!==except&&entry.actor.uuid===actor?.uuid&&entry.mode==="relentless"&&entry.turn===turn));}
function paidAvailable(actor,except=null){return superiorityRemaining(actor)>Array.from(reservations.values()).filter(entry=>entry!==except&&entry.actor.uuid===actor?.uuid&&entry.mode!=="relentless").length;}
function paymentAvailable(actor,mode,except=null){return mode==="relentless"?relentlessAvailable(actor,except):mode==="paid"&&paidAvailable(actor,except);}
function selectedDie(app,actor){if(!dieChoices.has(app))dieChoices.set(app,paidAvailable(actor)?"paid":"relentless");return dieChoices.get(app);}
async function spendManeuver(actor,mode,turn,except){
    if(!paymentAvailable(actor,mode,except)||mode==="relentless"&&turn!==maneuverTurn())throw Error("The selected maneuver die is no longer available. Reopen the damage prompt.");
    if(mode==="relentless"){const before=actor.getFlag(ID,"relentlessTurn")??null;await actor.setFlag(ID,"relentlessTurn",turn);return async()=>{if(actor.getFlag(ID,"relentlessTurn")===turn)await actor.setFlag(ID,"relentlessTurn",before);};}
    const resource=superiorityResource(actor);await resource.update({"system.uses.spent":Number(resource.system.uses.spent??0)+1});return ()=>resource.update({"system.uses.spent":Math.max(0,Number(resource.system.uses.spent)-1)});
}
export function addRelentlessChoice(app,actor,attack,used){
    if(!relentlessFeature(actor)||game.settings.get(ID,"relentlessAutomation")!==true)return;
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{key:"superiorityDie",label:"Superiority Die",disabled:used});if(!group)return;
    const select=document.createElement("select");select.setAttribute("aria-label","Superiority Die");select.disabled=used;
    const key=selected.get(app)==="no"?"trip":selected.get(app),formula=superiorityFormula(actor,key)??superiorityFormula(actor,"precision");
    for(const [value,label,available]of [["paid",(formula??"Current die").replace(/^1d/,"d")+" — Spend a die",paidAvailable(actor)],["relentless","d8 — Free (Relentless)"+(relentlessAvailable(actor)?"":" — Already Used / Unavailable"),relentlessAvailable(actor)]]){const option=document.createElement("option");option.value=value;option.textContent=label;option.disabled=!available;select.append(option);}
    select.value=selectedDie(app,actor);select.addEventListener("change",event=>{event.stopPropagation();dieChoices.set(app,select.value);app.rebuild();});group.querySelector("select").replaceWith(select);
    group.querySelector("label").dataset.tooltip="Relentless replaces a Superiority Die with a free d8 once per combat turn, shared across all maneuvers, including Precision Attack.";
}

function context(app){
    const data=app.message?.data,origin=typeof data?.system?.origin==="string"?game.messages.get(data.system.origin):data?.system?.origin;
    const attackId=data?.flags?.[ID]?.damageAttackId;
    const attack=attackId?game.messages.get(attackId):Array.from(origin?.getAssociatedRolls?.("attack")??[]).sort((a,b)=>b.timestamp-a.timestamp)[0];
    const targets=data?.system?.targets?.length?data.system.targets:origin?.system?.targets??[];
    const target=targets.length===1?fromUuidSync(targets[0].token,{strict:false}):null;
    return {actor:actorFor(attack)??app.config.subject?.actor,attack,target,origin};
}
const cardFor=app=>globalThis.Ugmuls55eAutomationPendingDamage?.pendingCard?.(app);
const usable=(actor,attack)=>(paidAvailable(actor)||relentlessAvailable(actor))&&!attack?.getFlag?.(ID,"battleManeuver")&&!reservations.has(attack?.id);
function hitEligible(app,key){
    const {actor,attack,target}=context(app),activity=app.config.subject;
    return activity?.type==="attack"&&actor?.isOwner&&target?.actor&&attack?.system?.evaluatedTargets?.some(entry=>entry.token===target.uuid&&entry.isMiss===false)&&
        !app.message?.data?.flags?.[ID]?.masteryGraze&&enabled(key)&&maneuverFeature(actor,key)&&!!superiorityFormula(actor,key)&&
        (!["trip","pushing"].includes(key)||activity.item?.type==="weapon"||activity.attack?.type?.classification==="unarmed"||activity.item?.system?.type?.value==="unarmed"||/^(unarmed|empowered|elemental) strikes?$/i.test(activity.item?.name??""));
}
export function addManeuverChoice(app){
    if(app.element.querySelector('[data-rsa-maneuver]'))return;
    const choices=["trip","distracting","menacing","goading","maneuvering","pushing"].filter(key=>hitEligible(app,key));if(!choices.length)return;
    const {actor,attack}=context(app),used=!!attack?.getFlag(ID,"battleManeuver")||!!cardFor(app)?.getFlag(ID,"battleManeuver");
    const disabled=used||!usable(actor,attack);if(!selected.has(app))selected.set(app,"no");
    const group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{key:"maneuver",label:"Maneuver",used,disabled});if(!group)return;group.dataset.rsaManeuver="";
    const select=document.createElement("select");select.disabled=disabled;select.setAttribute("aria-label","Battle Master Maneuver");
    for(const [value,label]of [["no",used?"No - Already Used":"No"],...choices.map(key=>[key,names[key]])]){const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option);}
    select.value=disabled?"no":selected.get(app);select.addEventListener("change",event=>{event.stopPropagation();selected.set(app,select.value);app.rebuild();});group.querySelector("select").replaceWith(select);
    addRelentlessChoice(app,actor,attack,used);
    group.querySelector("label").dataset.tooltip="Spend 1 available Superiority Die. Relentless can replace it with a free d8 once per combat turn. Only one maneuver can be used per attack. Trip adds damage against any size, but only Large or smaller creatures make its save.";
}
export function finalizeManeuver(app,rolls,{preview=false}={}){
    const key=selected.get(app),entry=pending.get(app);if(entry)return rolls.some(roll=>roll.options?.rsaManeuver)?rolls:[...rolls,entry.roll];
    if(!["trip","distracting","menacing","goading","maneuvering","pushing"].includes(key)||!hitEligible(app,key)||rolls.some(roll=>roll.options?.rsaManeuver))return rolls;
    const {actor,attack,target}=context(app),mode=selectedDie(app,actor);if(!usable(actor,attack)||!paymentAvailable(actor,mode)){if(preview)return rolls;throw Error("A Superiority Die or this attack's maneuver is no longer available.");}
    const base=rolls[0]?.options??{},critical={...base.critical,bonusDice:0,bonusDamage:""};
    const extra=new CONFIG.Dice.DamageRoll(`${mode==="relentless"?"1d8":superiorityFormula(actor,key)}[${names[key]}]`,actor.getRollData?.()??{},{type:base.type,types:base.type?[base.type]:[],flavor:names[key],isCritical:base.isCritical===true,critical,rsaManeuver:key,rsaRelentless:mode==="relentless"});
    if(!preview){const entry={actor,attack,target,key,mode,turn:maneuverTurn(),roll:extra};pending.set(app,entry);reservations.set(attack.id,entry);}return [...rolls,extra];
}
export function tripApplies(target){return !["huge","grg","gargantuan"].includes(target?.actor?.system?.traits?.size);}
export function maneuverDC(actor,key="trip"){const save=Array.from(maneuverFeature(actor,key)?.system?.activities??[]).find(activity=>activity.type==="save");return Number.isFinite(save?.save?.dc?.value)?save.save.dc.value:8+Number(actor.system?.attributes?.prof??0)+Math.max(Number(actor.system?.abilities?.str?.mod??0),Number(actor.system?.abilities?.dex?.mod??0));}
export function tripItemData(actor,target,img,key="trip"){
    const menacing=key==="menacing"||key==="goading",condition=menacing?"frightened":"prone",name=names[key],id=foundry.utils.randomID(),effectId=foundry.utils.randomID(),status=foundry.utils.deepClone(CONFIG.statusEffects?.[condition]??{});delete status.id;delete status._id;
    const data={_id:foundry.utils.randomID(),name,type:"feat",img,system:{identifier:`rsa-${key}-attack`,activities:{[id]:{_id:id,type:"save",name:`${name} — ${menacing?"Wisdom":"Strength"} Save`,activation:{type:"special",override:true},duration:{units:"perm",override:true},target:{affects:{type:"creature",count:"1",choice:false}},damage:{parts:[],onSave:"none"},save:{ability:[menacing?"wis":"str"],dc:{calculation:"",formula:String(maneuverDC(actor,key))}},effects:[{_id:effectId,onSave:false}]}}},effects:[{...status,_id:effectId,name:menacing?"Frightened":"Prone",statuses:[condition],disabled:false,transfer:false,flags:{...status.flags,dnd5e:{...status.flags?.dnd5e,isTemporary:true}}}]};
    if(key==="pushing"||key==="goading"){data.effects=[];data.system.activities[id].effects=[];}return data;
}
async function createTrip(entry,damage){
    const feature=maneuverFeature(entry.actor,entry.key),data=tripItemData(entry.actor,entry.target,feature.img,entry.key),item=new CONFIG.Item.documentClass(data,{parent:entry.actor});
    const result=await Array.from(item.system.activities)[0].use({consume:false,subsequentActions:false},{configure:false},{data:{system:{targets:[describeTarget(entry.target)]},flags:{dnd5e:{item:{data}},[ID]:{riderTriggered:true,maneuverStrike:{key:entry.key,damageId:damage?.id,targetToken:entry.target.uuid,casterActor:entry.actor.uuid}}}}});
    if(!result?.message?.id)throw Error(`Could not create the ${names[entry.key]} save card.`);return result.message.id;
}
export async function commitManeuver(app,options){
    const entry=pending.get(app);if(!entry)return;let refund;
    try{
        if(!options?.dnd5e?.submitted)return;
        if(entry.attack.getFlag(ID,"battleManeuver"))throw Error("This maneuver or Superiority Die is no longer available.");
        refund=await spendManeuver(entry.actor,entry.mode,entry.turn,entry);
        const damage=cardFor(app),record={key:entry.key,relentless:entry.mode==="relentless",targetToken:entry.target.uuid,casterActor:entry.actor.uuid};
        const saveId=(["menacing","goading"].includes(entry.key)||["trip","pushing"].includes(entry.key)&&tripApplies(entry.target))?await createTrip(entry,damage):null;
        const flags={battleManeuver:record,...(saveId?{maneuverSave:saveId}:{})};
        await entry.attack.update({flags:{[ID]:{battleManeuver:record}}});
        app.message.data.flags??={};app.message.data.flags[ID]={...app.message.data.flags[ID],...flags};
        if(damage)await damage.update({flags:{[ID]:flags}});
    }catch(error){if(refund)await refund();throw error;}
    finally{pending.delete(app);if(reservations.get(entry.attack.id)===entry)reservations.delete(entry.attack.id);}
}
export function maneuverSaveReady(damage){const id=damage?.getFlag?.(ID,"maneuverSave");if(!id)return true;const save=game.messages.get(id),target=save?.getFlag?.(ID,"maneuverStrike")?.targetToken;return !!target&&["success","failure"].includes(save.system.outcomes?.get(target));}
export async function applyTripOutcome(usage,{manual=false}={}){
    const link=usage?.getFlag?.(ID,"maneuverStrike");
    if(!authority()||!link||link.key==="pushing"||applying.has(usage.id)||usage.getFlag(ID,"outcomeEffectsApplied")||usage.system.outcomes?.get(link.targetToken)!=="failure")return;
    if(!manual&&(game.settings.get(ID,"autoApplySavedEffects")!==true||usage.getFlag(ID,"manualDamageWorkflow")))return;
    const damage=game.messages.get(link.damageId);
    if(!manual&&damage&&(damage.getFlag(ID,"pendingDamage")||game.settings.get(ID,"autoApplyCardDamage")===true&&!damage.getFlag(ID,"hpApplicationRecorded")&&!(damage.getFlag(ID,"automaticDamageTargets")??[]).includes(link.targetToken)))return;
    const actor=(await fromUuid(link.targetToken))?.actor;if(!actor)return;applying.add(usage.id);
    try{await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(usage);if(link.key==="goading")await applyGoading(usage,actor,link);else await applyConditionWithUndo(usage,actor,link.key==="menacing"?"frightened":"prone",link.key==="menacing"?{"system.origin.actor":link.casterActor,start:CONFIG.ActiveEffect.documentClass.getEffectStart(),duration:{rounds:null,turns:null,seconds:null,value:null,expired:false,expiry:"sourceEnd"}}:{});await usage.setFlag(ID,"outcomeEffectsApplied",true);await usage.setFlag(ID,"effectApplyReopened",null);}
    finally{applying.delete(usage.id);}
}
export function renderTrip(message,html){
    if(!message.getFlag?.(ID,"maneuverStrike")||message.getFlag(ID,"maneuverStrike").key==="pushing")return;const root=html?.[0]??html;if(!root?.querySelectorAll)return;
    root.querySelectorAll('effect-application').forEach(tray=>tray.hidden=true);
    const old=root.querySelector('[data-rsa-trip-apply]');if(!game.user.isGM||message.getFlag(ID,"outcomeEffectsApplied")){old?.remove();return;}if(old)return;
    const button=document.createElement("button");button.type="button";button.dataset.rsaTripApply="";button.textContent=`Apply ${names[message.getFlag(ID,"maneuverStrike").key??"trip"]} Effects`;button.disabled=message.system.outcomes?.get(message.getFlag(ID,"maneuverStrike").targetToken)!=="failure";
    button.addEventListener("click",async()=>{button.disabled=true;try{await applyTripOutcome(message,{manual:true});if(message.getFlag(ID,"outcomeEffectsApplied"))button.remove();}catch(error){report(error);}finally{button.disabled=false;}});(root.querySelector('.chat-card')??root).append(button);
}
export function canPrecision(card,user=game.user,{ignoreLock=false}={}){
    const actor=actorFor(card),targets=card?.system?.evaluatedTargets??[];
    return enabled("precision")&&card?.type==="attack"&&targets.length>0&&targets.every(target=>target.isMiss===true)&&!!card.rolls?.[0]?.d20&&
        !!maneuverFeature(actor,"precision")&&!!superiorityFormula(actor,"precision")&&usable(actor,card)&&
        !!(user?.isGM||actor?.testUserPermission?.(user,"OWNER"))&&(ignoreLock||!isRollAdjustmentLocked(card));
}
export async function precisionRoll(original,bonus){
    const adjusted=original.constructor.fromData(foundry.utils.deepClone(original.toJSON()));
    const operator=new foundry.dice.terms.OperatorTerm({operator:"+"});adjusted.terms.push(operator,...bonus.terms);adjusted.resetFormula();adjusted._total=adjusted._evaluateTotal();return adjusted;
}
async function animateBonus(card,roll,user){
    if(game.dice3d?.showForRoll){const animation=game.dice3d.showForRoll(roll,user,true,card.whisper?.length?card.whisper:null,card.blind??false,card.id,card.speaker);if(document.hidden)Promise.resolve(animation).catch(report);else await animation;}
    if(authority())await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(card);
}
export async function applyPrecision(card,user=game.user,mode="paid"){
    if(!canPrecision(card,user))throw Error("Precision Attack requires a missed attack, an unused maneuver, and an available Superiority Die. Undo applied damage first.");
    const actor=actorFor(card),signature=seekingSnapshot(card),turn=maneuverTurn();let refund;
    if(!paymentAvailable(actor,mode))throw Error("The selected maneuver die is no longer available.");
    const reservation={actor,mode,turn};reservations.set(card.id,reservation);
    try{
        const bonus=await new CONFIG.Dice.BasicRoll(mode==="relentless"?"1d8":superiorityFormula(actor,"precision"),actor.getRollData?.()??{}).evaluate();
        if(card.getFlag(ID,"battleManeuver")||!paymentAvailable(actor,mode,reservation)||mode==="relentless"&&turn!==maneuverTurn()||isRollAdjustmentLocked(card)||seekingSnapshot(card)!==signature)throw Error("The attack changed. Try Precision Attack again.");
        refund=await spendManeuver(actor,mode,turn,reservation);
        const adjusted=await precisionRoll(card.rolls[0],bonus);await animateBonus(card,bonus,user);
        if(card.getFlag(ID,"battleManeuver")||mode==="relentless"&&turn!==maneuverTurn()||isRollAdjustmentLocked(card)||seekingSnapshot(card)!==signature)throw Error("The attack changed during Precision Attack. The Superiority Die was refunded.");
        const skip=card.getFlag("dice-so-nice","skip");
        try{await card.update({rolls:[adjusted,...card.rolls.slice(1)],flags:{[ID]:{battleManeuver:{key:"precision",relentless:mode==="relentless",casterActor:actor.uuid}},"dice-so-nice":{skip:true}}});}
        finally{if(skip===undefined)await card.unsetFlag("dice-so-nice","skip");else await card.setFlag("dice-so-nice","skip",skip);}
    }catch(error){if(refund)await refund();throw error;}
    finally{if(reservations.get(card.id)===reservation)reservations.delete(card.id);}
}

async function choosePrecisionDie(card){
    const actor=actorFor(card);if(!relentlessFeature(actor)||game.settings.get(ID,"relentlessAutomation")!==true)return "paid";
    const paid=paidAvailable(actor),free=relentlessAvailable(actor),formula=(superiorityFormula(actor,"precision")??"Current die").replace(/^1d/,"d");
    return foundry.applications.api.DialogV2.wait({window:{title:"Precision Attack — Superiority Die"},rejectClose:false,content:'<div class="form-group"><label>Superiority Die</label><div class="form-fields"><select name="die"><option value="paid" '+(paid?'selected':'disabled')+'>'+formula+' — Spend a die</option><option value="relentless" '+(!free?'disabled':!paid?'selected':'')+'>d8 — Free (Relentless)'+(free?'':' — Already Used / Unavailable')+'</option></select></div></div>',buttons:[{action:"confirm",label:"Confirm",default:true,callback:(event,button,dialog)=>dialog.element.querySelector('[name="die"]').value},{action:"cancel",label:"Cancel",callback:()=>null}]});
}

export function addPrecisionButton(message,html){
    const root=html?.[0]??html;if(!root?.querySelectorAll)return;
    const entries=message.type==="attack"?[{card:message,root}]:[];
    for(const node of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(node.dataset.messageId);if(card?.type==="attack")entries.push({card,root:node});}
    for(const entry of entries){const old=entry.root.querySelector('[data-rsa-precision]');if(!canPrecision(entry.card,game.user,{ignoreLock:true})||entry.card.isContentVisible===false){old?.remove();continue;}if(old)old.remove();
        const button=document.createElement("button");button.type="button";button.dataset.rsaPrecision="";button.textContent="Precision Attack";button.disabled=isRollAdjustmentLocked(entry.card);button.dataset.tooltip=button.disabled?"Undo applied damage, including Graze, before changing this attack.":"Add a Superiority Die to this missed attack. Relentless can replace it with a free d8 once per combat turn, when available.";
        button.addEventListener("click",async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{const mode=await choosePrecisionDie(entry.card);if(!mode)return;const gm=game.users.activeGM;if(gm&&gm.id!==game.user.id)game.socket.emit("module."+ID,{action:"precisionAttack",messageId:entry.card.id,userId:game.user.id,gmId:gm.id,mode});else await enqueue(()=>applyPrecision(entry.card,game.user,mode));}catch(error){report(error);}finally{button.disabled=!canPrecision(entry.card);}});
        (entry.root.querySelector('.rsa-attack-actions')??entry.root.querySelector('.chat-card')??entry.root).append(button);
    }
}
const active=effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true;

export function goadingEffects(actor,target){return target?.uuid?Array.from(actor?.effects??[]).filter(effect=>active(effect)&&effect.getFlag?.(ID,"goadingSource")&&effect.getFlag(ID,"goadingSource")!==target.uuid):[];}
async function applyGoading(usage,actor,link){
    const caster=await fromUuid(link.casterActor),feature=maneuverFeature(caster,"goading");if(!feature)throw Error("Goading Attack's source feature is unavailable.");
    const effect=new CONFIG.ActiveEffect.documentClass({_id:feature.id??foundry.utils.randomID(),name:"Goading Attack",img:feature.img,disabled:false,transfer:false,statuses:[],duration:{expiry:"sourceEnd"},flags:{dnd5e:{isTemporary:false},[ID]:{goadingSource:caster.uuid}},system:{changes:[]}},{parent:feature});
    const tray=document.createElement("effect-application");tray.chatMessage=usage;const prepare=tray._prepareEffectData;
    tray._prepareEffectData=async function(source,target){const operation=await prepare.call(this,source,target);operation.data.duration={rounds:null,turns:null,seconds:null,value:null,expired:false,expiry:"sourceEnd"};operation.data.start=CONFIG.ActiveEffect.documentClass.getEffectStart();operation.data.system??={};operation.data.system.origin={...operation.data.system.origin,actor:caster.uuid};operation.data.flags??={};operation.data.flags.dnd5e={...operation.data.flags.dnd5e,isTemporary:false};operation.data.flags[ID]={...operation.data.flags[ID],goadingSource:caster.uuid};return operation;};
    const undo=globalThis.Ugmuls55eAutomationEffectUndo;if(undo)await undo.apply(usage,usage,effect,actor,tray);else await tray._applyEffectToActor(effect,actor);
}


export async function repairGoadingExpiry(){
    if(!authority())return;
    const actors=new Set([...(game.actors??[]),...Array.from(game.scenes??[]).flatMap(scene=>Array.from(scene.tokens??[],token=>token.actor).filter(Boolean))]);
    for(const actor of actors)for(const effect of actor.effects??[]){
        if(effect.getFlag?.(ID,"goadingSource")&&effect.getFlag?.("dnd5e","isTemporary"))await effect.update({"flags.dnd5e.isTemporary":false});
    }
}

export function distractingEffects(actor,attacker){return Array.from(actor?.effects??[]).filter(effect=>active(effect)&&effect.getFlag?.(ID,"distractingSource")&&effect.getFlag(ID,"distractingSource")!==attacker?.uuid);}
export async function applyDistracting(damage,{manual=false}={}){
    const record=damage?.getFlag?.(ID,"battleManeuver"),usage=originOf(damage),attack=game.messages.get(damage?.getFlag?.(ID,"damageAttackId"));
    if(!authority()||record?.key!=="distracting"||damage.getFlag(ID,"pendingDamage")||(!manual&&damage.getFlag(ID,"distractingApplied"))||applying.has(damage.id)||!manual&&(game.settings.get(ID,"autoApplyHitEffects")!==true||damage.getFlag(ID,"manualDamageWorkflow")||usage?.getFlag?.(ID,"manualDamageWorkflow")||attack?.getFlag?.(ID,"manualDamageWorkflow")))return;
    if(!manual&&game.settings.get(ID,"autoApplyCardDamage")===true&&!damage.getFlag(ID,"hpApplicationRecorded")&&!(damage.getFlag(ID,"automaticDamageTargets")??[]).includes(record.targetToken))return;
    const token=await fromUuid(record.targetToken),caster=await fromUuid(record.casterActor);if(!token?.actor||!caster)return;
    const feature=maneuverFeature(caster,"distracting");if(!feature)return;
    applying.add(damage.id);
    try{
        await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(damage);
        const effect=new CONFIG.ActiveEffect.documentClass({_id:feature.effects?.contents?.[0]?.id??foundry.utils.randomID(),name:"Distracting Strike",img:feature.img,statuses:[],disabled:false,transfer:false,duration:{expiry:"sourceStart"},flags:{dnd5e:{isTemporary:true},[ID]:{distractingSource:caster.uuid}},system:{changes:[]}},{parent:feature});
        const tray=document.createElement("effect-application");tray.chatMessage=usage;const prepare=tray._prepareEffectData;
        tray._prepareEffectData=async function(source,target){const operation=await prepare.call(this,source,target);operation.data.duration={rounds:null,turns:null,seconds:null,value:null,expired:false,expiry:"sourceStart"};operation.data.system??={};operation.data.system.origin={...operation.data.system.origin,actor:caster.uuid};operation.data.flags??={};operation.data.flags.dnd5e={...operation.data.flags.dnd5e,isTemporary:true};operation.data.flags[ID]={...operation.data.flags[ID],distractingSource:caster.uuid};return operation;};
        const exists=distractingEffects(token.actor,{uuid:""}).some(existing=>existing.getFlag(ID,"distractingSource")===caster.uuid);
        if(!exists){const undo=globalThis.Ugmuls55eAutomationEffectUndo;if(undo)await undo.apply(damage,usage,effect,token.actor,tray);else await tray._applyEffectToActor(effect,token.actor);}
        await damage.setFlag(ID,"distractingApplied",Date.now());
    }finally{applying.delete(damage.id);}
}
export function renderDistracting(message,html){
    const root=html?.[0]??html;if(!game.user.isGM||!root?.querySelectorAll)return;
    const entries=message.type==="damage"?[{card:message,root}]:[];
    for(const node of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(node.dataset.messageId);if(card?.type==="damage")entries.push({card,root:node});}
    for(const entry of entries){
        if(entry.card.getFlag(ID,"battleManeuver")?.key!=="distracting"||entry.card.getFlag(ID,"pendingDamage"))continue;
        const old=entry.root.querySelector('[data-rsa-distracting-apply]'),applied=entry.card.getFlag(ID,"distractingApplied"),reopened=originOf(entry.card)?.getFlag(ID,"effectApplyReopened");
        if(applied&&Number(applied)>=Number(reopened??0)){old?.remove();continue;}if(old)continue;
        const button=document.createElement("button");button.type="button";button.dataset.rsaDistractingApply="";button.textContent="Apply Distracting Strike";
        button.addEventListener("click",async()=>{button.disabled=true;try{await applyDistracting(entry.card,{manual:true});button.remove();}catch(error){report(error);button.disabled=false;}});
        (entry.root.querySelector('.chat-card')??entry.root).append(button);
    }
}
let bridge=false;
export function registerManeuverConditions(api=globalThis.ac5e?.usageRules){
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try{const distracting=!!api.register({key:"rsaDistractingStrike",scope:"universal",hook:"attack",target:"subject",mode:"advantage",name:"Distracting Strike",persistent:false,evaluate:sandbox=>{const attacker=fromUuidSync(sandbox.actorUuid,{strict:false}),target=fromUuidSync(sandbox.opponentUuid,{strict:false});return distractingEffects(target?.actor,attacker).length>0;}});
        const goading=!!api.register({key:"rsaGoadingAttack",scope:"universal",hook:"attack",target:"subject",mode:"disadvantage",name:"Goading Attack",persistent:false,evaluate:sandbox=>{const attacker=fromUuidSync(sandbox.actorUuid,{strict:false}),target=fromUuidSync(sandbox.opponentActorUuid??sandbox.opponentUuid,{strict:false});return goadingEffects(attacker?.actor??attacker,target?.actor??target).length>0;}});bridge=distracting&&goading;}catch(error){bridge=false;console.warn("Ugmuls 5.5e Automation | Maneuver conditions:",error);}return bridge;
}
export function distractingDefaults(config,dialog,message){
    if(bridge&&game.modules?.get("automated-conditions-5e")?.active||config.subject?.type!=="attack")return;
    const actor=config.subject.actor??config.subject.item?.actor,targets=message?.data?.system?.targets??Array.from(game.user.targets??[],token=>({token:(token.document??token).uuid}));
    if(targets.length!==1)return;
    const target=fromUuidSync(targets[0].token,{strict:false})?.actor;
    const advantage=distractingEffects(target,actor).length>0,disadvantage=goadingEffects(actor,target).length>0;
    if(!advantage&&!disadvantage)return;
    const previousAdv=!!config.advantage,previousDis=!!config.disadvantage;
    config.advantage=previousAdv||advantage;config.disadvantage=previousDis||disadvantage;
    for(const roll of config.rolls??[]){roll.options??={};const adv=!!(config.advantage||roll.options.advantage||roll.options.advantageMode===1),dis=!!(config.disadvantage||roll.options.disadvantage||roll.options.advantageMode===-1);Object.assign(roll.options,{advantage:adv,disadvantage:dis,advantageMode:adv===dis?0:adv?1:-1});}
    dialog.options??={};const options=config.rolls?.[0]?.options??config;dialog.options.defaultButton=options.advantage&&options.disadvantage?"normal":options.disadvantage?"disadvantage":"advantage";
}
export async function consumeDistracting(card){
    if(!authority()||card?.type!=="attack"||!card.rolls?.length)return;const attacker=actorFor(card);
    for(const target of card.system.targets??[]){const actor=(await fromUuid(target.token))?.actor,ids=distractingEffects(actor,attacker).map(effect=>effect.id);if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);}
}
function report(error){console.error("Ugmuls 5.5e Automation | Battle Master:",error);ui.notifications.error(error.message??"Battle Master automation could not finish.");}
Hooks.once("init",()=>{for(const key of Object.keys(names))game.settings.register(ID,`${key}AttackAutomation`,{name:names[key]+" Assistance",hint:key==="precision"?"Offer Precision Attack on missed attacks. Spend one current Superiority Die and add its result to the existing attack. Undo applied damage first.":"Offer "+names[key]+" as a damage maneuver. Uses one current Superiority Die and enforces one maneuver per attack.",scope:"world",config:true,type:Boolean,default:true});});
Hooks.once("init",()=>game.settings.register(ID,"relentlessAutomation",{name:"Relentless Assistance",hint:"Offer a free d8 instead of spending a Superiority Die, once per active combat turn, shared with Precision Attack.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerManeuverConditions(usageRules));
Hooks.once("ready",()=>{
    repairGoadingExpiry().catch(report);
    globalThis.Ugmuls55eAutomationBattleMaster={addManeuverChoice,finalizeManeuver,commitManeuver,maneuverSaveReady,applyTripOutcome};registerManeuverConditions();
    Hooks.on("dnd5e.renderChatMessage",renderTrip);Hooks.on("dnd5e.renderChatMessage",addPrecisionButton);Hooks.on("dnd5e.renderChatMessage",renderDistracting);Hooks.on("dnd5e.preRollAttackV2",distractingDefaults);
    for(const event of ["createChatMessage","updateChatMessage","renderChatMessageHTML"])Hooks.on(event,card=>{if(card.type==="damage")setTimeout(()=>applyDistracting(card).catch(report),100);if(event==="createChatMessage")consumeDistracting(card).catch(report);});
    Hooks.on("updateChatMessage",(card,changes)=>{const record=changes.flags?.[ID]?.battleManeuver;if(record?.key!=="precision"||!card.system.evaluatedTargets?.some(target=>target.isMiss===false))return;const origin=originOf(card);if(origin)globalThis.Ugmuls55eAutomationDamage?.promptDamage(card.getAssociatedActivity(),origin,"attack",card).catch(report);});
    game.socket.on("module."+ID,packet=>{if(packet?.action==="battleManeuverError"&&packet.userId===game.user.id){ui.notifications.error(packet.error);const card=game.messages.get(packet.messageId);if(card)ui.chat?.updateMessage?.(card);return;}if(packet?.action!=="precisionAttack"||!authority()||packet.gmId!==game.user.id)return;const user=game.users.get(packet.userId),card=game.messages.get(packet.messageId);if(user?.active)enqueue(()=>applyPrecision(card,user,packet.mode??"paid")).catch(error=>{report(error);game.socket.emit("module."+ID,{action:"battleManeuverError",userId:user.id,messageId:card?.id,error:error.message});});});
});
