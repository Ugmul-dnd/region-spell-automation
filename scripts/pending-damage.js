const ID="ugmuls-5-5e-automation",contexts=new WeakMap(),waiting=new Map();
let serial=Promise.resolve();
const channel="module."+ID;
const nonce=()=>foundry.utils.randomID();
const pending=card=>card?.getFlag?.(ID,"pendingDamage");
const resolveOrigin=value=>typeof value==="string"?game.messages.get(value):value;
export function damageAnimationSignature(rolls){
    const termState=term=>({number:term.number,faces:term.faces,operator:term.operator,
        results:term.results?.map(result=>[result.result,result.active!==false,!!result.discarded,!!result.rerolled]),
        rolls:term.rolls?.map(rollState),roll:term.roll?rollState(term.roll):undefined});
    const rollState=roll=>{const data=roll.toJSON?.()??roll;return {formula:data.formula??data._formula,total:data.total??data._total,terms:data.terms?.map(termState)};};
    return JSON.stringify((rolls??[]).map(rollState));
}
export function skipPendingDamageReplay(messageId,decision){
    const card=game.messages.get(messageId),handled=card?.getFlag?.(ID,"pendingDamageAnimation");
    if(handled&&handled===damageAnimationSignature(card.rolls))decision.willTrigger3DRoll=false;
}
const actorFor=card=>card?.getAssociatedActor?.()??card?.getAssociatedActivity?.()?.actor;
export function canRetryDamage(card,user=game.user){return !!pending(card)&&!!(user?.isGM||actorFor(card)?.testUserPermission?.(user,"OWNER"));}
export async function damageOperation(action,card,payload,user){
    if(!canRetryDamage(card,user))throw Error("This damage request is no longer pending or is not yours to roll.");
    const state=pending(card);
    if(action==="claim"){
        const next={...state,session:nonce(),userId:user.id};await card.setFlag(ID,"pendingDamage",next);return next;
    }
    if(action!=="finish"||state.session!==payload.session||state.userId!==user.id)throw Error("This damage prompt was replaced. Use the current pending card.");
    const data=payload.data;
    if(data.type!==card.type||data.system?.origin!==card.system?.origin?.id&&data.system?.origin!==card.system?.origin)
        throw Error("The damage request's source changed.");
    if(!Array.isArray(data.rolls)||!data.rolls.length)throw Error("No damage roll was supplied.");
    // Animation acknowledgements are GM-authorized. Player rolls hand off
    // their result first; the active GM coordinates all viewers here.
    if(game.user.isGM&&game.users.activeGM?.id===game.user.id)
        await globalThis.Ugmuls55eAutomationNpcDamage?.waitForWorkflowAnimations?.(card);
    const update={};
    for(const key of ["rolls","system","flavor","speaker","whisper","blind"])if(data[key]!==undefined)update[key]=data[key];
    update.flags=foundry.utils.mergeObject(card.flags??{},data.flags??{},{inplace:false});
    update.flags[ID]??={};update.flags[ID].pendingDamageAnimation=damageAnimationSignature(data.rolls);update.flags[ID].pendingDamage=null;delete update.flags[ID].pendingDamageCard;delete update.flags[ID].pendingDamageSession;
    // DsN detects an empty -> populated rolls array as a fresh throw on every
    // client. Suppress that document update explicitly: we already broadcast
    // and awaited these dice. Restore its normal handling immediately after.
    const skip=card.getFlag("dice-so-nice","skip");
    update.flags["dice-so-nice"]={...(update.flags["dice-so-nice"]??{}),skip:true};
    try {await card.update(update);}
    finally {
        if(skip===undefined)await card.unsetFlag("dice-so-nice","skip");
        else await card.setFlag("dice-so-nice","skip",skip);
    }
    return true;
}
async function operate(action,card,payload={}){
    const gm=game.users.activeGM;
    if(!gm||gm.id===game.user.id){
        if(!card.isOwner&&!game.user.isGM)throw Error("A connected GM is needed to take over this damage request.");
        const task=serial.then(()=>damageOperation(action,game.messages.get(card.id)??card,payload,game.user));serial=task.catch(()=>{});return task;
    }
    const requestId=nonce();return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{waiting.delete(requestId);reject(Error("The GM did not answer the damage request. Click pending to try again."));},action==="finish"?45000:10000);
        waiting.set(requestId,{resolve,reject,timer});game.socket.emit(channel,{action:"pendingDamageOperation",operation:action,cardId:card.id,payload,userId:game.user.id,gmId:gm.id,requestId});
    });
}
export function pendingDamageCurrent(context){
    const card=game.messages.get(context?.cardId),state=pending(card);
    return !!state&&state.session===context.session&&state.userId===game.user.id;
}
export function startPendingDamage(config,dialog,message){
    if(dialog.configure===false||message.create===false||config.evaluate===false||!config.subject?.item||contexts.has(message))return;
    const session=nonce(),context={session,dialogId:"rsa-pending-damage-"+session};contexts.set(message,context);
    dialog.options??={};dialog.options.id=context.dialogId;
    const configure=dialog.configure;Object.assign(dialog,globalThis.Ugmuls55eAutomationDamage.configurePromptDialog("damage",dialog));if(configure===false)dialog.configure=false;
    context.ready=Promise.resolve().then(async()=>{
        const data=foundry.utils.deepClone(message.data??{}),existing=data.flags?.[ID]?.pendingDamageCard;
        if(existing){context.cardId=existing;context.session=data.flags[ID].pendingDamageSession;if(!pendingDamageCurrent(context))throw Error("This damage prompt was replaced.");return;}
        const origin=resolveOrigin(data.system?.origin);
        const attackId=data.flags?.[ID]?.damageAttackId??Array.from(origin?.getAssociatedRolls?.("attack")??[]).filter(attack=>attack.timestamp<=Date.now()).sort((a,b)=>b.timestamp-a.timestamp)[0]?.id;
        const attack=game.messages.get(attackId),isAttack=config.subject.type==="attack";
        data.flags??={};data.flags[ID]??={};
        if(isAttack&&attackId)data.flags[ID].damageAttackId=attackId;
        data.flags[ID].pendingDamage={session,userId:game.user.id,activityUuid:config.subject.uuid,
            ability:config.ability??attack?.system?.ability,attackMode:config.attackMode??attack?.system?.mode,
            ammunitionUuid:config.ammunition?.uuid??attack?.system?.ammunitionItem?.uuid,
            isCritical:config.isCritical===true||attack?.rolls?.[0]?.isCritical===true};
        data.rolls=[];delete data._id;
        const card=await ChatMessage.create(data,{messageMode:message.rollMode??CONFIG.Dice.DamageRoll.getMessageMode?.()});
        if(!card)throw Error("Could not create the pending damage card.");context.cardId=card.id;
    });
    // Preparation failures are also awaited by the dialog and publication paths.
    context.ready.catch(report);
}
export async function prepareDamageDialog(app){await contexts.get(app.message)?.ready;}
export function canSubmitDamage(app){const context=contexts.get(app.message);return !context||pendingDamageCurrent(context);}
export async function cancelDamageDialog(cardId){
    const apps=foundry.applications.instances?Array.from(foundry.applications.instances.values()):Object.values(ui.windows??{});
    for(const app of apps){const context=contexts.get(app.message);if(context?.cardId===cardId&&!pendingDamageCurrent(context))await app.close();}
}
export async function retryPendingDamage(card){
    if(!canRetryDamage(card))return;
    const state=await operate("claim",card);
    await cancelDamageDialog(card.id);game.socket.emit(channel,{action:"cancelPendingDamage",cardId:card.id});
    const source=resolveOrigin(card.system?.origin),activity=source?.getAssociatedActivity?.({scaled:true})??await fromUuid(state.activityUuid);
    if(!activity?.item?.isOwner)throw Error("The casting actor or activity is unavailable.");
    const data={type:card.type,flavor:card.flavor,speaker:card.speaker,system:foundry.utils.deepClone(card.toObject().system),
        flags:{[ID]:{pendingDamageCard:card.id,pendingDamageSession:state.session,...(card.getFlag(ID,"damageAttackId")?{damageAttackId:card.getFlag(ID,"damageAttackId")}:{} )}}};
    const ammunition=state.ammunitionUuid?await fromUuid(state.ammunitionUuid):undefined;
    await activity.rollDamage({ability:state.ability,ammunition,attackMode:state.attackMode,isCritical:state.isCritical},
        globalThis.Ugmuls55eAutomationDamage.configurePromptDialog("damage",{configure:true,...(state.isCritical?{options:{defaultButton:"critical"}}:{})}),{data});
}
export function installPendingDamagePublication(RollClass=CONFIG.Dice.DamageRoll){
    if(RollClass.rsaPendingDamagePublication)return;RollClass.rsaPendingDamagePublication=true;
    const original=RollClass.buildPost;
    RollClass.buildPost=async function(rolls,config,message){
        const context=contexts.get(message);if(!context)return original.call(this,rolls,config,message);
        await context.ready;
        if(!rolls?.length)return;
        if(!pendingDamageCurrent(context)){rolls.splice(0);return;}
        // Prepare native typed message data without creating a second chat card.
        const create=message.create;message.create=false;
        try{await original.call(this,rolls,config,message);}finally{message.create=create;}
        const card=game.messages.get(context.cardId);
        if(game.dice3d?.showForRoll)for(const roll of rolls){
            const animation=game.dice3d.showForRoll(roll,game.user,true,message.data.whisper?.length?message.data.whisper:null,message.data.blind??false,card.id,message.data.speaker);
            if(globalThis.document?.hidden)Promise.resolve(animation).catch(report);else await animation;
        }
        if(!pendingDamageCurrent(context)){rolls.splice(0);return;}
        try{await operate("finish",card,{session:context.session,data:message.data});}
        catch(error){rolls.splice(0);throw error;}
        message.document=game.messages.get(card.id);for(const roll of rolls)roll.parent=message.document;
    };
}
export function renderPendingDamage(message,html){
    const root=html?.[0]??html;if(!root?.querySelectorAll)return;
    const entries=message.type==="damage"||message.type==="healing"?[{card:message,root}]:[];
    for(const node of root.querySelectorAll('.card-summary[data-message-id]')){const card=game.messages.get(node.dataset.messageId);if(pending(card))entries.push({card,root:node});}
    for(const entry of entries){
        if(!pending(entry.card))continue;
        const face=entry.root.querySelector('.chat-card');if(!face)continue;
        // Keep native item header and properties, without a zero result or Apply tray.
        for(const sibling of Array.from(face.parentElement.children))if(sibling!==face)sibling.remove();
        face.querySelectorAll('.card-buttons,[data-rsa-undo-damage],[data-rsa-reprompt-damage]').forEach(node=>node.remove());
        const button=document.createElement('button');button.type='button';button.dataset.rsaRepromptDamage=entry.card.id;button.textContent='---pending---';
        button.dataset.tooltip='Click to roll this pending damage yourself';button.disabled=!canRetryDamage(entry.card);
        button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{await retryPendingDamage(entry.card);}catch(error){report(error);}finally{button.disabled=!canRetryDamage(entry.card);}});
        face.append(button);
    }
}
function report(error){console.error("Ugmuls 5.5e Automation | Pending damage:",error);ui.notifications.error(error.message??"Could not reopen pending damage.");}
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationPendingDamage={prepareDamageDialog,canSubmitDamage};installPendingDamagePublication();
    Hooks.on("diceSoNiceMessagePreProcess",skipPendingDamageReplay);
    Hooks.on("dnd5e.preRollDamageV2",startPendingDamage);Hooks.on("dnd5e.renderChatMessage",renderPendingDamage);
    game.socket.on(channel,packet=>{
        if(packet?.action==="pendingDamageReply"&&packet.userId===game.user.id){const request=waiting.get(packet.requestId);if(!request)return;clearTimeout(request.timer);waiting.delete(packet.requestId);packet.error?request.reject(Error(packet.error)):request.resolve(packet.result);return;}
        if(packet?.action==="cancelPendingDamage"){cancelDamageDialog(packet.cardId).catch(report);return;}
        if(packet?.action!=="pendingDamageOperation"||!game.user.isGM||game.users.activeGM?.id!==game.user.id||packet.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId);if(!user?.active)return;
        const task=serial.then(()=>damageOperation(packet.operation,game.messages.get(packet.cardId),packet.payload,user));serial=task.catch(()=>{});
        task.then(result=>game.socket.emit(channel,{action:"pendingDamageReply",requestId:packet.requestId,userId:user.id,result}),error=>game.socket.emit(channel,{action:"pendingDamageReply",requestId:packet.requestId,userId:user.id,error:error.message}));
    });
});
