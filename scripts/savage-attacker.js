const ID="region-spell-automation";
const selected=new WeakSet(),pending=new WeakMap(),reserved=new Set();
const enabled=()=>game.settings.get(ID,"savageAttackerAutomation")===true;
export const savageFeature=actor=>Array.from(actor?.items??[]).find(item=>item.type==="feat"&&
    (item.system?.identifier==="savage-attacker"||item.identifier==="savage-attacker"||/^savage attacker$/i.test(item.name?.trim()??"")));
export const savageUsed=actor=>reserved.has(actor?.uuid)||Array.from(actor?.effects??[]).some(effect=>
    !effect.disabled&&effect.active!==false&&!effect.duration?.expired&&effect.getFlag?.(ID,"savageUsed"));
function actorFor(app){return (app.message?.data?.speaker?ChatMessage.getSpeakerActor(app.message.data.speaker):null)??app.config.subject?.actor;}
function eligible(app){return enabled()&&app.config.subject?.type==="attack"&&app.config.subject.item?.type==="weapon"&&actorFor(app)?.isOwner&&savageFeature(actorFor(app));}
export function savageRoll(roll) {
    // Native base damage starts with the weapon dice. Keep modifiers, bonus
    // damage and critical static bonuses outside the two-set keep-highest pool.
    const die=roll.terms[0];
    if(!(die instanceof foundry.dice.terms.DiceTerm)||die.isDeterministic)return null;
    const formula=`{${die.formula},${die.formula}}kh + ${roll.terms.slice(1).map(term=>term.formula).join(" ").replace(/^\s*\+\s*/,"")||"0"}`;
    return new roll.constructor(formula,roll.data,{...foundry.utils.deepClone(roll.options),preprocessed:true,configured:true,rsaSavageAttacker:true});
}
export function addSavageToggle(app) {
    if(!eligible(app)||app.element.querySelector("[data-rsa-savage]"))return;
    const buttons=app.element.querySelector(".dialog-buttons");if(!buttons)return;
    const label=document.createElement("label");label.dataset.rsaSavage="";label.className="rsa-savage-toggle";
    const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=selected.has(app);
    checkbox.disabled=savageUsed(actorFor(app));
    label.classList.toggle("rsa-savage-used",checkbox.disabled);
    if(checkbox.disabled){selected.delete(app);checkbox.checked=false;}
    checkbox.addEventListener("change",()=>checkbox.checked?selected.add(app):selected.delete(app));
    label.append(checkbox,document.createTextNode(checkbox.disabled?"Savage Attacker - Already Used":"Use Savage Attacker"));buttons.before(label);
}
export function finalizeSavage(app,rolls) {
    if(!selected.has(app)||!eligible(app)||savageUsed(actorFor(app)))return rolls;
    const index=app.config.rolls?.findIndex(roll=>roll.base===true)??-1;
    if(index<0||!rolls[index])return rolls;
    const replacement=savageRoll(rolls[index]);if(!replacement)return rolls;
    const actor=actorFor(app);reserved.add(actor.uuid);pending.set(app,actor);
    const result=[...rolls];result[index]=replacement;return result;
}
export async function commitSavage(app,options) {
    const actor=pending.get(app);if(!actor)return;
    try {
        if(options?.dnd5e?.submitted)await actor.createEmbeddedDocuments("ActiveEffect",[{
            name:"Savage Used",img:savageFeature(actor)?.img,disabled:false,transfer:false,
            duration:{rounds:1,expiry:"sourceStart"},start:CONFIG.ActiveEffect.documentClass.getEffectStart(),
            system:{changes:[],origin:{actor:actor.uuid,item:savageFeature(actor)?.uuid}},flags:{[ID]:{savageUsed:true}}
        }]);
    } finally {pending.delete(app);reserved.delete(actor.uuid);selected.delete(app);}
}
Hooks.once("init",()=>game.settings.register(ID,"savageAttackerAutomation",{name:"Savage Attacker Assistance",
    hint:"Offer Savage Attacker on weapon damage rolls. Keep the higher weapon dice set and mark it used until next turn start.",
    scope:"world",config:true,type:Boolean,default:true}));
Hooks.once("ready",()=>{
    globalThis.RegionSpellAutomationSavage={addSavageToggle,finalizeSavage,commitSavage};
    Hooks.on("dnd5e.preRollDamageV2",(config,dialog)=>{
        if(!enabled()||config.subject?.type!=="attack"||config.subject.item?.type!=="weapon")return;
        const configure=dialog.configure;
        Object.assign(dialog,globalThis.RegionSpellAutomationDamage.configurePromptDialog("damage",dialog));
        if(configure===false)dialog.configure=false;
    });
});
