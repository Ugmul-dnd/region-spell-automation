import {describeTarget,isRollAdjustmentLocked} from "./shared-activity-card.js";
import {reactionUsed} from "./reaction-tracker.js";
const MODULE_ID="ugmuls-5-5e-automation";
const busy=new Set();

export function shieldReactionAvailable(actor) {
    return !!actor&&!reactionUsed(actor)&&!["incapacitated","dead","unconscious","stunned","paralyzed","petrified"].some(status=>actor.statuses?.has(status));
}

const remaining=uses=>Math.max(0,Number(uses?.value??(Number(uses?.max)-Number(uses?.spent??0)))||0);
export function shieldCastPlan(actor) {
    if(!shieldReactionAvailable(actor))return null;
    const candidates=[];
    for(const item of actor.items??[]) {
        if(item.type!=="spell"||(item.identifier??item.system?.identifier??item.name?.toLowerCase())!=="shield")continue;
        if(item.system.canPrepare&&!item.system.prepared)continue;
        const activities=Array.from(item.system.activities?.values?.()??item.system.activities??[]);
        const activity=activities.find(entry=>entry.activation?.type==="reaction"&&entry.type==="utility");
        if(!activity)continue;
        const base={item,activity};
        if(item.system.method==="atwill")return {...base,kind:"atwill"};
        // Dedicated activity uses take priority, then the spell's own limited-use pool.
        const freeActivity=activities.find(entry=>remaining(entry.uses??entry.system?.uses)>0&&
            entry.activation?.type==="reaction"&&entry.type==="utility");
        if(freeActivity)return {...base,activity:freeActivity,kind:"free",target:{type:"activityUses",target:"",value:"1"}};
        if(remaining(item.system.uses)>0)return {...base,kind:"free",target:{type:"itemUses",target:"",value:"1"}};
        if(item.system.method==="innate"&&!Number(item.system.uses?.max))return {...base,kind:"atwill"};
        candidates.push(base);
    }
    if(!candidates.length||globalThis.Ugmuls55eAutomationResources?.hasCastWithSlot(actor))return null;
    const slots=Object.entries(actor.system?.spells??{}).filter(([key,slot])=>(/^spell[1-9]$/.test(key)||key==="pact")&&Number(slot.value)>0)
        .map(([key,slot])=>({slot:key,level:key==="pact"?Number(slot.level):Number(key.slice(5))}))
        .filter(entry=>entry.level>=1).sort((a,b)=>a.level-b.level||Number(a.slot==="pact")-Number(b.slot==="pact"));
    return slots.length?{...candidates[0],kind:"slot",...slots[0]}:null;
}
export function shieldActivity(actor){return shieldCastPlan(actor)?.activity??null;}
export async function castShield(actor,attack) {
    const plan=shieldCastPlan(actor);if(!plan)return;
    // Modify only an ephemeral native Item clone: sheet configuration remains reusable.
    const item=plan.item.clone({}, {keepId:true}),activityId=plan.activity.id??plan.activity._id;
    const path="system.activities."+activityId;
    item.updateSource({
        "system.method":plan.kind==="slot"?"spell":plan.item.system.method,
        [path+".consumption.spellSlot"]:plan.kind==="slot",
        [path+".consumption.targets"]:plan.kind==="free"?[plan.target]:[]
    });
    const activity=item.system.activities.get(activityId);
    const usage={consume:{resources:plan.kind==="free"?[0]:[],spellSlot:plan.kind==="slot"},scaling:plan.kind==="slot"?Math.max(0,plan.level-Number(item.system.level??1)):0};
    if(plan.kind==="slot")usage.spell={slot:plan.slot};
    return activity.use(usage,{configure:false},{data:{flags:{[MODULE_ID]:{shieldReactionAttack:attack.id}}}});
}

export async function refreshShieldAttack(attack) {
    if (!attack || attack.type !== "attack" || (!game.user.isGM && !attack.isOwner)) return;
    const targets=[];
    for (const descriptor of attack.system.targets ?? []) {
        const token=descriptor.token ? await fromUuid(descriptor.token) : null;
        const target=token?.actor?describeTarget(token):{...descriptor};
        const valor=attack.getFlag?.(MODULE_ID,"valorDefense")?.[target.token];
        if(valor&&Number.isFinite(target.ac))target.ac+=Number(valor.bonus)||0;
        targets.push(target);
    }
    await attack.update({"system.targets":targets, [`flags.${MODULE_ID}.shieldRechecked`]:true},{rsaRetarget:true});
}

export function damageMissedAfterAttack(damage) {
    if (damage?.type !== "damage") return false;
    if(damage.getFlag?.(MODULE_ID,"masteryGraze"))return false;
    const origin=damage.system?.origin;
    const card=typeof origin === "string" ? game.messages.get(origin) : origin;
    if (!card&&!damage.getFlag?.(MODULE_ID,"damageAttackId")) return false;
    const explicit=damage.getFlag?.(MODULE_ID,"damageAttackId");
    const attacks=card?.type === "attack" ? [card] : card?.getAssociatedRolls?.("attack") ?? [];
    const attack=explicit ? game.messages.get(explicit) : [...attacks]
        .filter(attack=>attack.timestamp <= damage.timestamp)
        .sort((a,b)=>b.timestamp-a.timestamp)[0];
    if(attack?.type!=="attack")return false;
    const targets=attack.system.evaluatedTargets ?? [];
    return targets.length>0 && targets.every(target=>target.isMiss === true);
}

export const damageMissedAfterShield=damageMissedAfterAttack;

export function hideShieldMissDamage(message, html) {
    const root=html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    if (message.type === "damage") {
        const hide=damageMissedAfterAttack(message);
        if (hide) {root.hidden=true;root.classList.add("rsa-missed-attack-damage");root.dataset.rsaShieldHidden="true";}
        else if (root.dataset.rsaShieldHidden) {root.hidden=false;root.classList.remove("rsa-missed-attack-damage");delete root.dataset.rsaShieldHidden;}
    }
    for (const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const damage=game.messages.get(summary.dataset.messageId);
        if (damage?.type !== "damage") continue;
        if (damageMissedAfterAttack(damage)) {
            summary.hidden=true;summary.classList.add("rsa-missed-attack-damage");summary.dataset.rsaShieldHidden="true";
        } else if (summary.dataset.rsaShieldHidden) {
            summary.hidden=false;summary.classList.remove("rsa-missed-attack-damage");summary.style.display="";delete summary.dataset.rsaShieldHidden;
        }
    }
}
export function addShieldButtons(message, html) {
    if (game.settings.get(MODULE_ID,"showShieldReaction") !== true) return;
    const root=html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const entries=message.type === "attack" ? [{message,root}] : [];
    for (const summary of root.querySelectorAll(".card-summary[data-message-id]")) {
        const attack=game.messages.get(summary.dataset.messageId);
        if (attack?.type === "attack" && !summary.hidden) entries.push({message:attack,root:summary});
    }
    for (const entry of entries) {
        entry.root.querySelectorAll('[data-rsa-shield]').forEach(button=>button.remove());
        entry.root.querySelectorAll(':scope > .rsa-shield-actions').forEach(controls=>controls.remove());
        if (!entry.message.isContentVisible || isRollAdjustmentLocked(entry.message)) continue;
        const controls=document.createElement("div");controls.className="rsa-attack-actions rsa-shield-actions";
        const recipients=new Set();
        for (const pill of entry.root.querySelectorAll("target-pill")) {
            if (pill.hasAttribute("data-miss")) continue;
            const uuid=pill.querySelector("datalist option")?.value;
            if(!uuid||recipients.has(uuid))continue;
            const token=fromUuidSync(uuid,{strict:false}),actor=token?.actor;
            if (!actor || (!game.user.isGM && !actor.isOwner)) continue;
            const activity=shieldActivity(actor);
            if (!activity) continue;
            recipients.add(uuid);
            const button=document.createElement("button");
            button.type="button";button.dataset.rsaShield=uuid;
            button.dataset.tooltip="Cast Shield using your reaction, then refresh this attack";
            const image=document.createElement("img");image.src=activity.item?.img??"icons/svg/shield.svg";image.alt="";
            button.append(image,document.createTextNode("Shield — "+(token.name??actor.name??"Target")));
            button.addEventListener("click",async event=>{
                event.preventDefault();event.stopPropagation();
                const key=entry.message.id+":"+uuid;
                if (busy.has(key)) return;
                busy.add(key);button.disabled=true;
                try {
                    const current=shieldActivity(actor);
                    if (!current || isRollAdjustmentLocked(entry.message)) return;
                    const results=await castShield(actor,entry.message);
                    if (results?.message) await refreshShieldAttack(entry.message);
                } catch(err) {
                    console.error("Ugmuls 5.5e Automation | Shield reaction failed:",err);
                    ui.notifications.error("Could not cast Shield. Use the actor's spell sheet.");
                } finally {busy.delete(key);button.disabled=!shieldActivity(actor);}
            });
            controls.append(button);
        }
        if(recipients.size)entry.root.append(controls);
    }
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"showShieldReaction",{
    name:"Effect Automation: Show Shield Reaction",
    hint:"Show a Shield casting button on hit results for owned actors with an available reaction and spell resources. Native casting handles consumption.",
    scope:"world",config:true,type:Boolean,default:true
}));
Hooks.once("ready",()=>{
    Hooks.on("dnd5e.renderChatMessage",(message,html)=>{
        hideShieldMissDamage(message,html);
        try {addShieldButtons(message,html);} catch(err) {console.error("Ugmuls 5.5e Automation | Shield controls failed:",err);}
    });
    Hooks.on("updateChatMessage",(message,changes)=>{
        if (message.type !== "attack") return;
        if (!Object.hasOwn(changes,"system.targets") && !changes.system?.targets && !changes.rolls) return;
        const origin=message.system.origin;
        const card=typeof origin === "string" ? game.messages.get(origin) : origin;
        const damages=new Set(card?.getAssociatedRolls?.("damage")??[]);
        for(const damage of game.messages??[])if(damage.type==="damage"&&(damage.getFlag?.(MODULE_ID,"damageAttackId")===message.id||(typeof damage.system?.origin==="string"?damage.system.origin:damage.system?.origin?.id)===message.id))damages.add(damage);
        for (const damage of damages) ui.chat?.updateMessage(damage);
        if (card) ui.chat?.updateMessage(card);
    });
    const refreshReactions=()=>{for(const message of Array.from(game.messages??[]).slice(-100))if(message.type==="attack")ui.chat?.updateMessage?.(message);};
    for(const event of ["createActiveEffect","updateActiveEffect","deleteActiveEffect","updateCombat","deleteCombat","updateActor","updateItem"])Hooks.on(event,refreshReactions);
    Hooks.on("ugmuls55eAutomation.buffEffectsApplied",(cast)=>{
        const id=cast.getFlag(MODULE_ID,"shieldReactionAttack");
        if (id) refreshShieldAttack(game.messages.get(id)).catch(console.error);
    });
});
