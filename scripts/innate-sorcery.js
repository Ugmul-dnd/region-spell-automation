const ID="ugmuls-5-5e-automation";
let bridge=false;
const enabled=()=>game.settings.get(ID,"innateSorceryAutomation")===true;
export function innateSorceryActive(actor) {
    const feature=Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
        ((item.identifier??item.system?.identifier)==="innate-sorcery"||/^innate sorcery$/i.test(item.name??"")));
    const sources=new Set(Array.from(feature?.effects??[]).map(effect=>effect.uuid).filter(Boolean));
    return Array.from(actor?.effects??[]).some(effect=>!effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.system?.expired!==true&&
        (/^innate sorcery(?:\s*\([^)]*\))?$/i.test(effect.name?.trim()??"")||sources.has(effect._stats?.duplicateSource)||sources.has(effect._stats?.compendiumSource)||
            (!!feature?.uuid&&effect.system?.origin?.item===feature.uuid)));
}
export function isSorcererSpell(item) {
    return item?.type==="spell"&&(item.system?.classIdentifier==="sorcerer"||(!item.system?.classIdentifier&&item.system?.sourceItem==="class:sorcerer"));
}
export function innateDefaults(config,dialog,message) {
    if(!enabled()||config.subject?.type!=="attack"||!isSorcererSpell(config.subject.item)||
        (bridge&&game.modules?.get("automated-conditions-5e")?.active))return;
    const actor=(message?.data?.speaker?ChatMessage.getSpeakerActor(message.data.speaker):null)??config.subject.actor??config.subject.item.actor;
    if(!innateSorceryActive(actor))return;
    config.advantage=true;
    for(const roll of config.rolls??[]) {
        roll.options??={};
        const state=roll.options["automated-conditions-5e"]??config.options?.["automated-conditions-5e"]??config["automated-conditions-5e"];
        const counts=state?.modeCounts;
        const disadvantage=counts?!!(counts.disadvantages?.present||counts.noAdvantages?.present||state.explicitModeOverride?.action==="disadvantage"):
            !!(config.disadvantage||roll.options.disadvantage||roll.options.advantageMode===-1);
        roll.options.advantage=true;roll.options.disadvantage=disadvantage;roll.options.advantageMode=disadvantage?0:1;
    }
    dialog.options??={};dialog.options.defaultButton=config.rolls?.[0]?.options?.disadvantage?"normal":"advantage";
    return dialog.options.defaultButton;
}
export function prepareInnateButtons(app,context) {
    const choice=innateDefaults({...app.config,rolls:app.rolls??app.config.rolls},{options:{}},app.message);
    if(choice)for(const [key,button] of Object.entries(context.buttons??{}))button.default=key===choice;
}
export function registerInnateConditions(api=globalThis.ac5e?.usageRules) {
    if(!game.modules?.get("automated-conditions-5e")?.active||typeof api?.register!=="function")return false;
    try {
        bridge=!!api.register({key:"rsaInnateSorcery",scope:"universal",hook:"attack",target:"subject",mode:"advantage",name:"Innate Sorcery",persistent:false,
            evaluate:sandbox=>enabled()&&sandbox.itemType==="spell"&&
                (sandbox.item?.classIdentifier==="sorcerer"||(!sandbox.item?.classIdentifier&&sandbox.item?.sourceItem==="class:sorcerer"))&&
                innateSorceryActive(fromUuidSync(sandbox.actorUuid,{strict:false}))});
    } catch(error){bridge=false;console.warn("Ugmuls 5.5e Automation | Innate Sorcery condition integration failed:",error);}
    return bridge;
}
Hooks.once("init",()=>game.settings.register(ID,"innateSorceryAutomation",{name:"Innate Sorcery Attack Advantage",hint:"Default Sorcerer spell attacks to Advantage while Innate Sorcery's Active Effect is active. Respects spell source class and other advantage/disadvantage sources, with Automated Conditions integration.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.on("ac5e.usageRulesReady",({usageRules}={})=>registerInnateConditions(usageRules));
Hooks.once("ready",()=>{
    registerInnateConditions();globalThis.Ugmuls55eAutomationInnateSorcery={prepareInnateButtons};
    Hooks.on("dnd5e.preRollAttackV2",innateDefaults);
});
