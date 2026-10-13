const ID="region-spell-automation";
const definitions={hex:{name:"Hex",type:"necrotic",setting:"riderHex"},"hunters-mark":{name:"Hunter's Mark",type:"force",setting:"riderHuntersMark"}};
const choices=new WeakMap();
export function riderKey(item) {
    const identifier=item?.identifier??item?.system?.identifier;
    if(definitions[identifier])return identifier;
    const name=item?.name?.toLowerCase().replace(/[’']/g,"").trim();
    return name==="hex"?"hex":name==="hunters mark"?"hunters-mark":null;
}
export function riderConcentration(actor,key) {
    return Array.from(actor?.concentration?.effects??[]).find(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true&&
        riderKey(actor.items?.get(effect.getFlag?.("dnd5e","item")?.id)??fromUuidSync(effect.getFlag?.("dnd5e","item")?.uuid??"",{strict:false}))===key);
}
export async function recordRiderTarget(activity,message) {
    const key=riderKey(activity?.item),actor=activity?.actor??activity?.item?.actor;
    if(!key||!actor?.isOwner||!message)return;
    const concentration=riderConcentration(actor,key);
    if(!concentration)return;
    const targets=message.system?.targets??[];
    if(targets.length!==1||!targets[0].token)return;
    const record={concentration:concentration.uuid,token:targets[0].token};
    const prior=actor.getFlag(ID,`damageRiders.${key}`);
    if(prior?.concentration===record.concentration&&prior?.token===record.token)return;
    await actor.setFlag(ID,`damageRiders.${key}`,record);
}
export function availableRiders(app) {
    const activity=app.config?.subject;
    if(activity?.type!=="attack"||app.message?.data?.flags?.[ID]?.masteryGraze)return [];
    const actor=(app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??activity.actor??activity.item?.actor;
    const targets=app.message?.data?.system?.targets??[];
    // A shared roll cannot apply a rider to only one of several recipients.
    if(!actor?.isOwner||targets.length!==1)return [];
    return Object.entries(definitions).filter(([key,definition])=>{
        if(game.settings.get(ID,definition.setting)!==true)return false;
        const concentration=riderConcentration(actor,key),mark=actor.getFlag(ID,`damageRiders.${key}`);
        return !!concentration&&mark?.concentration===concentration.uuid&&mark.token===targets[0].token;
    }).map(([key,definition])=>({key,...definition}));
}
export function addRiderChoices(app) {
    const available=availableRiders(app),buttons=app.element.querySelector(".dialog-buttons");
    if(!buttons)return;
    const state=choices.get(app)??new Map();choices.set(app,state);
    for(const rider of available) {
        if(app.element.querySelector(`[data-rsa-rider="${rider.key}"]`))continue;
        if(!state.has(rider.key))state.set(rider.key,true);
        const label=document.createElement("label");label.dataset.rsaRider=rider.key;label.className="rsa-savage-toggle";
        const input=document.createElement("input");input.type="checkbox";input.checked=state.get(rider.key);
        input.addEventListener("change",()=>state.set(rider.key,input.checked));
        label.append(input,document.createTextNode(`${rider.name} (+1d6 ${rider.type})`));buttons.before(label);
    }
}
export function finalizeRiders(app,rolls) {
    const result=[...rolls];
    for(const rider of availableRiders(app)) {
        if(choices.get(app)?.get(rider.key)===false||result.some(roll=>roll.options?.rsaBonusRider===rider.key))continue;
        const critical=rolls[0]?.options?.isCritical===true;
        const policy={...rolls[0]?.options?.critical,bonusDice:0,bonusDamage:""};
        result.push(new CONFIG.Dice.DamageRoll(`1d6[${rider.name}]`,{},
            {type:rider.type,isCritical:critical,critical:policy,rsaBonusRider:rider.key}));
    }
    return result;
}
Hooks.once("init",()=>{
    for(const definition of Object.values(definitions))game.settings.register(ID,definition.setting,{name:`${definition.name} Bonus Damage`,
        hint:`Add the spell's 1d6 to attack damage against this caster's marked target while concentrating. Single-target damage cards only.`,scope:"world",config:true,type:Boolean,default:true});
});
Hooks.once("ready",()=>{
    globalThis.RegionSpellAutomationRiders={addRiderChoices,finalizeRiders};
    const report=err=>console.error("Region Spell Automation | Bonus damage rider:",err);
    Hooks.on("dnd5e.postUseActivity",(activity,usage,results)=>recordRiderTarget(activity,results?.message).catch(report));
    Hooks.on("updateChatMessage",(message,changes)=>{
        if(changes.system?.targets&&message.type==="usage"&&message.author?.id===game.user.id)
            recordRiderTarget(message.getAssociatedActivity?.(),message).catch(report);
    });
    Hooks.on("dnd5e.preRollDamageV2",(config,dialog)=>{
        if(config.subject?.type!=="attack")return;
        const configure=dialog.configure;
        Object.assign(dialog,globalThis.RegionSpellAutomationDamage.configurePromptDialog("damage",dialog));
        if(configure===false)dialog.configure=false;
    });
    Hooks.on("dnd5e.postDamageRollConfiguration",(rolls,config,dialog,message)=>{
        if(dialog.configure===false) {
            const adjusted=finalizeRiders({config,message},rolls);
            rolls.splice(0,rolls.length,...adjusted);
        }
    });
});
