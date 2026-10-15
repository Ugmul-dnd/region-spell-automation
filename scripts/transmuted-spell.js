import {sorceryResource} from "./empowered-spell.js";
const ID="ugmuls-5-5e-automation",states=new WeakMap(),pending=new WeakMap();
export const transmutedTypes=["acid","cold","fire","lightning","poison","thunder"];
export const transmutedFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    (/^(?:metamagic-)?transmuted-spell$/.test(item.identifier??item.system?.identifier??"")||/^(?:metamagic:\s*)?transmuted spell$/i.test(item.name??"")));
const actorFor=app=>(app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor??app.config.subject?.item?.actor;
const originFor=app=>typeof app.message?.data?.system?.origin==="string"?game.messages.get(app.message.data.system.origin):app.message?.data?.system?.origin;
function stateFor(app,rolls) {
    let state=states.get(app);
    if(!state){const inherited=originFor(app)?.getFlag?.(ID,"transmutedSpell");state={yes:!!inherited,inherited,original:rolls.slice(0,app.config.rolls?.length??rolls.length).map(roll=>({type:roll.options.type??roll.options.types?.[0],types:roll.options.types?.length?[...roll.options.types]:[roll.options.type]}))};states.set(app,state);}
    return state;
}
function eligible(app) {const actor=actorFor(app);return game.settings.get(ID,"transmutedSpellAutomation")===true&&app.config.subject?.item?.type==="spell"&&actor?.isOwner&&!!transmutedFeature(actor);}
export function addTransmutedChoice(app) {
    if(!eligible(app)||app.element.querySelector('[data-rsa-transmuted]'))return;
    const state=stateFor(app,app.rolls??[]);if(!state.original.some(part=>part.types.some(type=>transmutedTypes.includes(type))))return;
    const actor=actorFor(app),group=globalThis.Ugmuls55eAutomationDamage.addDamageChoice(app,{
        key:"transmuted",label:"Transmuted Spell",value:state.yes,locked:!!state.inherited,
        disabled:!state.inherited&&!sorceryResource(actor,transmutedFeature(actor)),change:yes=>{state.yes=yes;}
    });if(group)group.dataset.rsaTransmuted="";
}
export function finalizeTransmuted(app,rolls,{preview=false}={}) {
    if(!eligible(app))return rolls;
    const state=stateFor(app,rolls),active=state.yes&&(!!state.inherited||!!sorceryResource(actorFor(app),transmutedFeature(actorFor(app))));
    const mapping={},result=rolls.map((roll,index)=>{
        const original=state.original[index];if(!original)return roll;
        const selected=roll.options.type??original.type;
        let type=selected,types=original.types;
        if(state.inherited&&transmutedTypes.includes(original.type)){type=state.inherited[original.type]??selected;types=[type];}
        else if(active&&transmutedTypes.includes(original.type)){type=transmutedTypes.includes(selected)?selected:original.type;types=preview?transmutedTypes:[type];mapping[original.type]=type;}
        else if(!original.types.includes(type))type=original.type;
        if(!active&&type===roll.options.type&&JSON.stringify(types)===JSON.stringify(roll.options.types))return roll;
        const copy=roll.constructor.fromData(foundry.utils.deepClone(roll.toJSON()));copy.options.type=type;copy.options.types=[...types];
        const rewrite=terms=>{for(const term of terms??[]) {
            if(String(term.options?.flavor??"").toLowerCase()===original.type)term.options.flavor=type;
            for(const child of term.rolls??[])rewrite(child.terms);if(term.roll?.terms)rewrite(term.roll.terms);
        }};
        rewrite(copy.terms);if(copy.data?.roll)copy.data.roll.damageType=type;copy.resetFormula?.();
        if(active)copy.options.rsaTransmutedSpell=true;return copy;
    });
    if(!preview&&active&&!state.inherited&&Object.keys(mapping).length)pending.set(app,{actor:actorFor(app),mapping});
    return result;
}
export async function commitTransmuted(app,options) {
    const entry=pending.get(app);if(!entry)return;pending.delete(app);
    if(!options?.dnd5e?.submitted)return;
    const origin=originFor(app),previous=origin?.getFlag?.(ID,"transmutedSpell");
    if(previous){if(JSON.stringify(previous)!==JSON.stringify(entry.mapping))throw Error("This casting already has a different Transmuted damage type. Reopen the damage roll.");return;}
    const resource=sorceryResource(entry.actor,transmutedFeature(entry.actor));if(!resource)throw Error("No Sorcery Points remain for Transmuted Spell.");
    const spent=Number(resource.system.uses.spent??0);await resource.update({"system.uses.spent":spent+1});
    try {if(origin)await origin.setFlag(ID,"transmutedSpell",entry.mapping);}
    catch(error){await resource.update({"system.uses.spent":spent});throw error;}
}
Hooks.once("init",()=>game.settings.register(ID,"transmutedSpellAutomation",{name:"Transmuted Spell Damage Type",hint:"Add Transmuted Spell to spell damage Configuration. Yes opens eligible elemental damage choices above. Spend 1 Sorcery Point on submission; repeated rolls from that casting retain its conversion.",scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.Ugmuls55eAutomationTransmuted={addTransmutedChoice,finalizeTransmuted,commitTransmuted};
    Hooks.on("dnd5e.preRollDamageV2",(config,dialog)=>{if(config.subject?.item?.type!=="spell")return;const configure=dialog.configure;Object.assign(dialog,globalThis.Ugmuls55eAutomationDamage.configurePromptDialog("damage",dialog));if(configure===false)dialog.configure=false;});
});
