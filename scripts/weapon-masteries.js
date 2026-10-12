import {createEventQueue,describeTarget} from "./shared-activity-card.js";
const MODULE_ID="region-spell-automation";
const enqueue=createEventQueue();
const supported=new Set(["graze","sap","slow","topple","vex"]);
const authoritative=()=>game.user.isGM&&game.users.activeGM?.id===game.user.id;
const enabled=()=>game.settings.get(MODULE_ID,"weaponMasteryAutomation")===true;
const flag=(effect,key)=>effect.getFlag(MODULE_ID,key);
export function masteryEnabled(mastery) {
    return enabled() && supported.has(mastery) && game.settings.get(MODULE_ID,`mastery${mastery[0].toUpperCase()+mastery.slice(1)}`) === true;
}

export function masteryForAttack(message) {
    if(message?.type!=="attack")return null;
    const item=message.getAssociatedItem?.();
    if(item?.type!=="weapon")return null;
    const mastery=message.system.mastery??message.rolls?.[0]?.options.mastery;
    return masteryEnabled(mastery)&&item.system.masteryOptions?.some(option=>option.value===mastery)?mastery:null;
}
function effectsFor(actor,mastery,targetActor=null) {
    return Array.from(actor?.effects??[]).filter(effect=>!effect.disabled&&!effect.duration?.expired&&flag(effect,"mastery")===mastery&&
        (!targetActor||flag(effect,"targetActor")===targetActor.uuid));
}
function abilityModifier(attack) {
    const actor=attack.getAssociatedActor();const ability=attack.system.ability??attack.rolls?.[0]?.options.ability;
    const mod=actor.system.abilities?.[ability]?.mod;
    if(!Number.isFinite(mod))throw Error("The attack's ability modifier is unavailable.");
    return mod;
}
async function masteryEffect(attack,token,mastery,remove=false) {
    const source=attack.getAssociatedActor();
    const actor=mastery==="vex"?source:token.actor;
    const existing=effectsFor(actor,mastery,mastery==="vex"?token.actor:null);
    if(remove){if(existing.length)await actor.deleteEmbeddedDocuments("ActiveEffect",existing.map(effect=>effect.id));return;}
    const sourceKey=`${attack.id}:${token.uuid}`;
    const changes=[];
    if(mastery==="slow"&&!existing.length)for(const key of ["walk","burrow","climb","fly","swim"]) {
        const value=actor.system.attributes?.movement?.[key];
        if(typeof value==="number"&&value>0)changes.push({key:`system.attributes.movement.${key}`,type:"add",value:String(-Math.min(dnd5e.utils.convertLength(10,"ft",actor.system.attributes.movement.units??"ft",{strict:false}),value))});
    }
    const data={name:`${mastery[0].toUpperCase()+mastery.slice(1)}${mastery==="vex"?` — ${token.name}`:""}`,
        img:mastery==="vex"?"icons/svg/target.svg":mastery==="sap"?"icons/svg/daze.svg":"icons/svg/downgrade.svg",
        disabled:false,transfer:false,
        duration:{expiry:mastery==="vex"?"sourceEnd":"sourceStart"},
        start:CONFIG.ActiveEffect.documentClass.getEffectStart(),
        system:{changes,origin:{actor:source.uuid,message:attack.uuid}},
        flags:{[MODULE_ID]:{mastery,targetActor:token.actor.uuid,targetToken:token.uuid,masterySource:sourceKey,masteryAttack:attack.id}}};
    if(existing.length){delete data.system.changes;await existing[0].update(data);}
    else await actor.createEmbeddedDocuments("ActiveEffect",[data]);
}
export function matchingVexEffects(actor,tokenUuids) {
    const targets=new Set(tokenUuids);
    return effectsFor(actor,"vex").filter(effect=>{
        const token=flag(effect,"targetToken");
        if(token)return targets.has(token);
        return [...targets].some(uuid=>fromUuidSync(uuid,{strict:false})?.actor?.uuid===flag(effect,"targetActor"));
    });
}
let ac5eBridge=false;
function usingConditionBridge(){return ac5eBridge&&game.modules?.get("automated-conditions-5e")?.active;}
export function registerConditionBridge(api=globalThis.ac5e?.usageRules) {
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try {
        const register=(mastery,mode)=>api.register({key:`rsaMastery${mastery}`,scope:"universal",hook:"attack",target:"subject",
            mode,name:mastery==="vex"?"Vex":"Sap",persistent:false,
            evaluate:(sandbox,context={})=>{
                const uuid=sandbox.actorUuid;
                const actor=context.subjectToken?.actor??(uuid?fromUuidSync(uuid,{strict:false}):null);
                if(!masteryEnabled(mastery))return false;
                if(mastery === "sap")return effectsFor(actor,"sap").length>0;
                const opponent=context.opponentToken?.document??context.opponentToken;
                const target=opponent?.uuid??sandbox.opponentUuid;
                return !!target&&matchingVexEffects(actor,[target]).length>0;
            }});
        const vex=register("vex","advantage"),sap=register("sap","disadvantage");
        ac5eBridge=Boolean(vex&&sap);
    } catch(err){ac5eBridge=false;console.warn("Region Spell Automation | Automated Conditions mastery integration unavailable:",err);}
    return ac5eBridge;
}
export function masteryRollDefaults(activity,config,dialog,targets=game.user.targets,recordedTargets=null) {
    if(!enabled()||usingConditionBridge()||activity?.type!=="attack")return;
    const actor=activity.actor;if(!actor)return;
    const sap=masteryEnabled("sap")&&effectsFor(actor,"sap").length>0;
    const targetTokens=[...new Set((Array.isArray(recordedTargets)?recordedTargets.map(target=>target.token):
        Array.from(targets??[],target=>(target.document??target).uuid)).filter(Boolean))];
    const vex=masteryEnabled("vex")&&targetTokens.length===1&&matchingVexEffects(actor,targetTokens).length>0;
    if(!sap&&!vex)return;
    config.advantage ||= vex;config.disadvantage ||= sap;
    for(const roll of config.rolls??[]) {
        roll.options??={};
        const adv=!!(roll.options.advantage||roll.options.advantageMode===1||config.advantage);
        const dis=!!(roll.options.disadvantage||roll.options.advantageMode===-1||config.disadvantage);
        roll.options.advantage=adv;roll.options.disadvantage=dis;roll.options.advantageMode=adv===dis?0:adv?1:-1;
    }
    const first=config.rolls?.[0]?.options;
    const mode=first?.advantageMode??(config.advantage===config.disadvantage?0:config.advantage?1:-1);
    dialog.options??={};dialog.options.defaultButton=mode===1?"advantage":mode===-1?"disadvantage":"normal";
}
export function prepareAttackButtons(app,context) {
    if(!enabled()||usingConditionBridge()||app.config?.subject?.type!=="attack")return;
    const speaker=app.message?.data?.speaker;
    const actor=(speaker?ChatMessage.getSpeakerActor(speaker):null)??app.config.subject.actor;
    if(!actor||(!effectsFor(actor,"vex").length&&!effectsFor(actor,"sap").length))return;
    const draftDialog={options:{}};
    masteryRollDefaults({type:"attack",actor},app.config,draftDialog,game.user.targets,app.message?.data?.system?.targets);
    const selected=draftDialog.options.defaultButton;if(!selected)return;
    for(const key of ["advantage","normal","disadvantage"])if(context.buttons?.[key])context.buttons[key].default=key===selected;
    return selected;
}
export function focusMasteryAttackButtons(app) {
    const context={buttons:{advantage:{},normal:{},disadvantage:{}}};
    const selected=prepareAttackButtons(app,context);if(!selected)return;
    const buttons=app.element?.querySelectorAll(".dialog-buttons button[data-action]")??[];
    for(const button of buttons)button.toggleAttribute("autofocus",button.dataset.action===selected);
    const button=Array.from(buttons).find(button=>button.dataset.action===selected);
    if(button)requestAnimationFrame(()=>{if(app.rendered&&button.isConnected)button.focus({preventScroll:true});});
}
export async function consumeNextAttack(attack) {
    const actor=attack.getAssociatedActor?.();if(!actor)return;

    const targets=(attack.system.targets??[]).map(target=>target.token).filter(Boolean);
    const remove=[...(masteryEnabled("sap")?effectsFor(actor,"sap"):[]),
        ...(masteryEnabled("vex")?matchingVexEffects(actor,targets):[])];
    if(remove.length)await actor.deleteEmbeddedDocuments("ActiveEffect",remove.map(effect=>effect.id));
}
export async function syncSap(attack) {
    const mastery=masteryForAttack(attack);
    if(!enabled()||!["sap","vex","slow","topple"].includes(mastery))return;
    const handled=new Set(attack.getFlag(MODULE_ID,"sapHandled")??[]);
    for(const target of attack.system.evaluatedTargets??[]) {
        const token=await fromUuid(target.token);if(!token?.actor)continue;
        if(target.isMiss) {
            const source=`${attack.id}:${token.uuid}`;
            const actor=mastery==="vex"?attack.getAssociatedActor():token.actor;
            const effects=effectsFor(actor,mastery).filter(effect=>flag(effect,"masterySource")===source);
            if(effects.length)await actor.deleteEmbeddedDocuments("ActiveEffect",effects.map(effect=>effect.id));
        } else if(mastery==="sap"&&!handled.has(token.uuid)) {await masteryEffect(attack,token,"sap");handled.add(token.uuid);}
    }
    if(mastery==="sap")await attack.setFlag(MODULE_ID,"sapHandled",[...handled]);
}
function attackForDamage(damage) {
    const direct=damage?.getFlag?.(MODULE_ID,"damageAttackId");if(direct)return game.messages.get(direct);
    const origin=damage?.system?.origin;const usage=typeof origin==="string"?game.messages.get(origin):origin;
    return [...(usage?.getAssociatedRolls?.("attack")??[])].filter(attack=>attack.timestamp<=damage.timestamp).sort((a,b)=>b.timestamp-a.timestamp)[0];
}
export async function recordDamage(actor,amount,options) {
    if(!enabled()||!(amount>0))return;
    const damage=options.origin??options.originatingMessage;
    const attack=attackForDamage(damage);const mastery=masteryForAttack(attack);
    if(!["vex","slow"].includes(mastery))return;
    const target=(attack.system.evaluatedTargets??[]).find(target=>target.actor===actor.uuid&&!target.isMiss);
    if(!target)return;
    const token=await fromUuid(target.token);if(!token?.actor)return;
    const dealt=new Set(attack.getFlag(MODULE_ID,"masteryDamageTargets")??[]);
    if(dealt.has(token.uuid))return;
    await masteryEffect(attack,token,mastery);
    dealt.add(token.uuid);await attack.setFlag(MODULE_ID,"masteryDamageTargets",[...dealt]);
}
export async function performMastery(attack,tokenUuid,requestUser=game.user) {
    if(!enabled()||!masteryForAttack(attack)||(!requestUser.isGM&&attack.author?.id!==requestUser.id&&
        !attack.getAssociatedActor()?.testUserPermission(requestUser,"OWNER")))return;
    const mastery=masteryForAttack(attack),target=attack.system.evaluatedTargets?.find(target=>target.token===tokenUuid);
    if(!target||((mastery==="graze")!==target.isMiss))return;
    const token=await fromUuid(tokenUuid);if(!token?.actor)return;
    const appliedDamage=(attack.getFlag(MODULE_ID,"masteryDamageTargets")??[]).includes(tokenUuid);
    if(["slow","vex"].includes(mastery)&&!appliedDamage)return;
    if(["sap","slow","vex"].includes(mastery)) {
        const actor=mastery==="vex"?attack.getAssociatedActor():token.actor;
        await masteryEffect(attack,token,mastery,effectsFor(actor,mastery,mastery==="vex"?token.actor:null).length>0);
        await attack.setFlag(MODULE_ID,"masteryUiRevision",Date.now());return;
    }
    if((attack.getFlag(MODULE_ID,"masteryActions")??[]).includes(tokenUuid))return;
    if(mastery==="graze") {
        const activity=attack.getAssociatedActivity(),item=attack.getAssociatedItem();
        const type=Array.from(item.system.damage?.base?.types??[])[0];
        const roll=new CONFIG.Dice.DamageRoll(String(Math.max(0,abilityModifier(attack))),{}, {type,isCritical:false});
        await roll.evaluate();
        const origin=attack.system.origin;
        await roll.toMessage({type:"damage",speaker:attack.speaker,flavor:`${item.name} — Graze Damage`,
            system:{...activity.messageSources,activity:{...activity.messageSources.activity,name:"Graze"},
                targets:[describeTarget(token)],origin:origin?.id??origin},
            flags:{[MODULE_ID]:{damageAttackId:attack.id,masteryGraze:true}}});
    } else if(mastery==="topple") {
        const dc=8+abilityModifier(attack)+attack.getAssociatedActor().system.attributes.prof;
        const owners=Array.from(game.users).filter(user=>user.active&&!user.isGM&&token.actor.testUserPermission(user,"OWNER"));
        const recipient=token.actor.type==="npc"?game.users.activeGM:owners.find(user=>user.character?.id===token.actor.id)??owners[0]??game.users.activeGM;
        if(!recipient)return;
        const request=await ChatMessage.create({type:"request",speaker:attack.speaker,
            content:"<h3>Topple — Constitution Save</h3>",
            system:{handler:"save",button:{icon:"fa-solid fa-shield",label:"Roll Constitution Save"},
                data:{ability:"con",target:dc},targets:[{actor:token.actor.uuid,user:recipient.id}]},
            flags:{[MODULE_ID]:{toppleAttack:attack.id,toppleToken:tokenUuid,toppleRequest:true}}});
        const packet={action:"masteryToppleSave",attackId:attack.id,tokenUuid,userId:recipient.id,sourceId:game.user.id,dc,requestId:request.id};
        if(recipient.id===game.user.id)receiveTopple(packet).catch(report);else game.socket.emit(`module.${MODULE_ID}`,packet);
    }
    await attack.setFlag(MODULE_ID,"masteryActions",[...(attack.getFlag(MODULE_ID,"masteryActions")??[]),tokenUuid]);
}
export async function receiveTopple(packet) {
    if(!enabled()||packet.userId!==game.user.id||!game.users.get(packet.sourceId)?.isGM)return;
    const attack=game.messages.get(packet.attackId),token=await fromUuid(packet.tokenUuid);
    if(!token?.actor?.isOwner||masteryForAttack(attack)!=="topple"||!attack.system.evaluatedTargets.some(target=>target.token===token.uuid&&!target.isMiss))return;
    const dc=8+abilityModifier(attack)+attack.getAssociatedActor().system.attributes.prof;
    const dialog={configure:true,options:{id:`rsa-topple-${attack.id}-${token.id??token.uuid}`}};
    const auto=globalThis.RegionSpellAutomationNpcDamage?.shouldAutoRollNpc(token.actor)===true;
    if(auto)dialog.configure=false;
    const positioned=auto?dialog:(globalThis.RegionSpellAutomationDamage?.configurePromptDialog("save",dialog)??dialog);
    await token.actor.rollSavingThrow({ability:"con",target:dc,...(auto?{rsaAutoNpcSave:true}:{})},positioned, {data:{flavor:"Topple — Constitution Save",speaker:ChatMessage.getSpeaker({actor:token.actor,token,scene:token.parent}),
        flags:{[MODULE_ID]:{toppleAttack:attack.id,toppleToken:token.uuid},
            ...(packet.requestId?{dnd5e:{requestResult:{actorUuid:token.actor.uuid,requestId:packet.requestId}}}: {})},system:{origin:null}}});
}
function toppleSaveContext(save) {
    const requestId=save.getFlag?.("dnd5e","requestResult")?.requestId;
    const request=requestId?game.messages.get(requestId):null;
    return {request,attackId:save.getFlag?.(MODULE_ID,"toppleAttack")??request?.getFlag(MODULE_ID,"toppleAttack"),
        tokenUuid:save.getFlag?.(MODULE_ID,"toppleToken")??request?.getFlag(MODULE_ID,"toppleToken")};
}
export async function resolveTopple(save) {
    const {request,attackId:id,tokenUuid}=toppleSaveContext(save);if(!id)return;
    const attack=game.messages.get(id),token=await fromUuid(tokenUuid);
    if(!token?.actor||masteryForAttack(attack)!=="topple"||save.getAssociatedActor()?.uuid!==token.actor.uuid||
        !attack.system.evaluatedTargets.some(target=>target.token===token.uuid&&!target.isMiss))return;
    const user=game.users.get(save.author?.id);
    if(!user?.isGM&&!token.actor.testUserPermission(user,"OWNER"))return;
    if(request)await request.setFlag(MODULE_ID,"toppleResultRevision",Date.now());
    const applied=Array.from(token.actor.effects).filter(effect=>flag(effect,"toppleSave")===save.id);
    if(!save.rolls?.[0]?.isFailure||save.system?.resisted) {
        if(applied.length)await token.actor.deleteEmbeddedDocuments("ActiveEffect",applied.map(effect=>effect.id));
        return;
    }
    if(applied.length)return;
    const effect=await foundry.documents.ActiveEffect.fromStatusEffect("prone",{parent:token.actor});
    const data=effect.toObject();delete data._id;
    data.flags??={};data.flags[MODULE_ID]={...data.flags[MODULE_ID],mastery:"topple",toppleSave:save.id,masteryAttack:attack.id,masterySource:`${attack.id}:${token.uuid}`};
    data.system??={};data.system.origin={...data.system.origin,actor:attack.getAssociatedActor().uuid,message:save.uuid};
    await token.actor.createEmbeddedDocuments("ActiveEffect",[data]);
}
export function labelGrazeDamage(message,html) {
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=message.type==="damage"?[{message,root}]:[];
    for(const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const card=game.messages.get(summary.dataset.messageId);if(card?.type==="damage")entries.push({message:card,root:summary});
    }
    for(const entry of entries) {
        if(!entry.message.isContentVisible||!entry.message.getFlag(MODULE_ID,"masteryGraze"))continue;
        const subtitle=entry.root.querySelector(".card-header .subtitle");
        if(subtitle)subtitle.textContent="Graze — Damage Roll";
    }
}
export function addMasteryButtons(message,html) {
    labelGrazeDamage(message,html);
    if(message.type === "request" && message.getFlag?.(MODULE_ID,"toppleRequest")) {
        const root=html instanceof HTMLElement?html:html?.[0];
        if(root) {
            const heading=root.querySelector(".targets > strong");if(heading)heading.textContent="Defender";
            for(const status of root.querySelectorAll(".targets .status")) {
                if(!status.querySelector("button")&&!status.textContent.trim()&&!status.dataset.messageId)status.textContent="Waiting for save…";
            }
        }
        return;
    }
    if(!enabled())return;
    const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
    const entries=message.type==="attack"?[{message,root}]:[];
    for(const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const card=game.messages.get(summary.dataset.messageId);if(card?.type==="attack"&&!summary.hidden)entries.push({message:card,root:summary});
    }
    for(const entry of entries) {
        const mastery=masteryForAttack(entry.message);if(!mastery||!entry.message.isContentVisible||(!game.user.isGM&&!entry.message.isOwner))continue;
        for(const pill of entry.root.querySelectorAll("target-pill")) {
            const uuid=pill.querySelector("datalist option")?.value;
            const target=entry.message.system.evaluatedTargets?.find(target=>target.token===uuid);
            if(!target||((mastery==="graze")!==target.isMiss)||entry.root.querySelector(`[data-rsa-mastery-target="${encodeURIComponent(uuid)}"]`))continue;
            let controls=entry.root.querySelector(".rsa-attack-actions");
            if(!controls) {
                const face=entry.root.querySelector(".chat-card");if(!face)continue;
                controls=document.createElement("div");controls.className="rsa-attack-actions";face.append(controls);
            }
            const button=document.createElement("button");button.type="button";button.dataset.rsaMastery=mastery;
            button.dataset.rsaMasteryTarget=encodeURIComponent(uuid);
            const token=fromUuidSync(uuid,{strict:false}),actor=mastery==="vex"?entry.message.getAssociatedActor():token?.actor;
            const applied=effectsFor(actor,mastery,mastery==="vex"?token?.actor:null).length>0;
            button.textContent=`${applied?"Remove ":""}${game.i18n.localize(CONFIG.DND5E.weaponMasteries[mastery].label)}`;
            button.dataset.tooltip=`${game.i18n.localize(CONFIG.DND5E.weaponMasteries[mastery].label)} — ${token?.name??target.name}`;
            if((entry.message.system.evaluatedTargets??[]).length>1)button.textContent+=` — ${token?.name??target.name}`;
            const dealt=(entry.message.getFlag(MODULE_ID,"masteryDamageTargets")??[]).includes(uuid);
            button.disabled=["vex","slow"].includes(mastery)?!dealt:(entry.message.getFlag(MODULE_ID,"masteryActions")??[]).includes(uuid);
            button.addEventListener("click",event=>{
                event.preventDefault();event.stopPropagation();button.disabled=true;
                const packet={action:"masteryAction",attackId:entry.message.id,tokenUuid:uuid,userId:game.user.id,gmId:game.users.activeGM?.id};
                if(authoritative())enqueue(()=>performMastery(entry.message,uuid)).catch(report);
                else if(packet.gmId)game.socket.emit(`module.${MODULE_ID}`,packet);
                else ui.notifications.warn("An active GM is required for mastery automation.");
            });controls.append(button);
        }
    }
}
function report(err){console.error("Region Spell Automation | Mastery automation failed:",err);ui.notifications.error("Could not apply mastery. Check the console.");}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"weaponMasteryAutomation",{
    name:"Effect Automation: Weapon Masteries",hint:"Graze miss damage, Sap/Vex automatic effects, and manual Slow/Topple actions for unlocked weapon masteries. Push, Nick and Cleave are excluded. Requires an active GM.",
    scope:"world",config:true,type:Boolean,default:true,onChange:()=>ui.chat?.render({force:true})
}));
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerConditionBridge(usageRules));
Hooks.once("init",()=>{
    for(const mastery of supported) {
        const title=mastery[0].toUpperCase()+mastery.slice(1);
        game.settings.register(MODULE_ID,`mastery${title}`,{
            name:title,hint:`Enable ${title} attack-card actions and automation. Requires Weapon Mastery automation enabled.`,
            scope:"world",config:true,type:Boolean,default:true,onChange:()=>ui.chat?.render({force:true})
        });
    }
});
Hooks.once("ready",()=>{
    registerConditionBridge();
    globalThis.RegionSpellAutomationMasteries={prepareAttackButtons,focusMasteryAttackButtons};
    Hooks.on("dnd5e.renderChatMessage",addMasteryButtons);
    Hooks.on("dnd5e.preRollAttackV2",(config,dialog,message)=>
        masteryRollDefaults(config.subject,config,dialog,game.user.targets,message?.data?.system?.targets));
    Hooks.on("dnd5e.postBuildAttackRollConfig",(process,roll,index,{app,formData}={})=>{
        if(!app||formData)return;
        // The native dialog rebuilds its roll options during construction.
        // Set the default on that final configuration too, before it renders.
        masteryRollDefaults(process.subject,{rolls:[roll]}, {options:{}},game.user.targets,app.message?.data?.system?.targets);
    });
    Hooks.on("createChatMessage",message=>{
        if(!authoritative()||!enabled())return;
        enqueue(async()=>{if(message.type==="attack"){await consumeNextAttack(message);await syncSap(message);}else if(message.type==="save")await resolveTopple(message);}).catch(report);
    });
    Hooks.on("updateChatMessage",(message,changes)=>{
        if(authoritative()&&enabled()&&message.type==="save"&&toppleSaveContext(message).attackId)enqueue(()=>resolveTopple(message)).catch(report);
        if(authoritative()&&enabled()&&message.type==="attack"&&(changes.rolls||changes["system.targets"]||changes.system?.targets))enqueue(()=>syncSap(message)).catch(report);
    });
    Hooks.on("dnd5e.applyDamage",(actor,amount,options)=>{
        const origin=options.origin??options.originatingMessage;
        if(authoritative())enqueue(()=>recordDamage(actor,amount,options)).catch(report);
        else if(origin?.id&&game.users.activeGM)game.socket.emit(`module.${MODULE_ID}`,{action:"masteryDamageApplied",damageId:origin.id,actorUuid:actor.uuid,amount,userId:game.user.id,gmId:game.users.activeGM.id});
    });
    game.socket.on(`module.${MODULE_ID}`,packet=>{
        if(packet?.action==="masteryToppleSave"){receiveTopple(packet).catch(report);return;}
        if(!authoritative()||!enabled()||packet?.gmId!==game.user.id)return;
        const user=game.users.get(packet.userId);if(!user?.active)return;
        if(packet.action==="masteryAction")enqueue(()=>performMastery(game.messages.get(packet.attackId),packet.tokenUuid,user)).catch(report);
        else if(packet.action==="masteryDamageApplied")enqueue(async()=>{
            const actor=await fromUuid(packet.actorUuid),damage=game.messages.get(packet.damageId);
            if(!actor||!damage||!Number.isFinite(packet.amount)||(!user.isGM&&!actor.testUserPermission(user,"OWNER"))||
                !damage.system.targets?.some(target=>target.actor===actor.uuid))return;
            await recordDamage(actor,packet.amount,{origin:damage});
        }).catch(report);
    });
});
