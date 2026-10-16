import {spellProfile,preloadClassSpells} from "./pc-spells.js";
const MODULE_ID="ugmuls-5-5e-automation";
const createSelector='.item-create,.tidy-table-header-row .tidy-table-button:has(.fa-plus),[data-action="addDocument"],[data-action="create"],[data-action="createItem"],[data-action="addItem"],[data-action="createDocument"][data-document-class="Item"]';

export function sheetBrowserOptions(actor,tab,spellLists=globalThis.dnd5e?.registry?.spellLists) {
    const spells=["spells","spellbook"].includes(tab);
    const initial={documentClass:"Item",types:new Set([spells?"spell":"physical"])};
    if(spells) {
        const classes=new Set(Object.keys(actor.classes??{}));
        for(const item of actor.itemTypes?.class??[]) {
            const id=item.identifier??item.system?.identifier;if(id)classes.add(id);
        }
        const available=new Set((spellLists?.options??[]).map(option=>option.value));
        const lists=Object.fromEntries([...classes].map(id=>`class:${id}`).filter(id=>available.has(id)).map(id=>[id,1]));
        if(Object.keys(lists).length)initial.additional={spelllist:lists};
    }
    return {tab:spells?"spells":"physical",filters:{initial}};
}

const loading=new Map();
export function preparationClasses(actor){return Array.from(actor.itemTypes?.class??[]).filter(cls=>(cls.identifier??cls.system?.identifier)!=="paladin"&&spellProfile(actor,cls)?.policy==="library");}
export function configuredClassSpellLevel(actor,cls){
    const casting=cls.spellcasting??cls.system.spellcasting,method=casting?.type??(casting?.progression==="pact"?"pact":"spell"),model=CONFIG.DND5E.spellcasting[method];
    const slots=actor.system.spells??{},configured=Object.entries(slots).filter(([key,slot])=>/^spell[1-9]$/.test(key)&&Number(slot.max)>0).map(([key])=>Number(key.slice(5)));
    if(!configured.length||!model?.calculateSlots)return 0;
    const progression={[method]:0};
    if(typeof actor.constructor.computeClassProgression==="function")actor.constructor.computeClassProgression(progression,cls,{actor,spellcasting:casting,count:1});
    else model.computeProgression(progression,actor,cls,{...casting,levels:casting.levels??cls.system.levels},1);
    const available=model.calculateSlots(progression[method]);return Math.max(0,...configured.filter(level=>Number(available[level])>0));
}
export async function loadUnpreparedSheetSpells(actor,classId){
    if(actor?.type!=="character"||!actor.isOwner)throw Error("Choose a character you own.");
    const cls=preparationClasses(actor).find(item=>item.id===classId);if(!cls)throw Error("Choose a class with access to its full preparation list.");
    const maxLevel=configuredClassSpellLevel(actor,cls);if(!maxLevel)throw Error("Set up this class’s spell slots before loading spells.");
    if(loading.has(actor.uuid))return loading.get(actor.uuid);
    const task=preloadClassSpells(actor,{cls,maxLevel});loading.set(actor.uuid,task);
    try{return await task;}finally{if(loading.get(actor.uuid)===task)loading.delete(actor.uuid);}
}
export async function chooseSheetSpellAction(actor,Browser){
    const classes=preparationClasses(actor),e=foundry.utils.escapeHTML,available=classes.map(cls=>({cls,level:configuredClassSpellLevel(actor,cls)}));
    const first=available.find(entry=>entry.level>0);
    const content='<p>Browse for individual spells, or load missing spells from your class list at currently configured spell-slot levels. Loaded spells start unprepared; existing spells are unchanged.</p><label>Class<select name="class">'+available.map(({cls,level})=>'<option value="'+e(cls.id)+'" '+(!level?'disabled':cls.id===first?.cls.id?'selected':'')+'>'+e(cls.name)+(level?' — spell levels 1–'+level:' — no configured slots')+'</option>').join('')+'</select></label>';
    const result=await foundry.applications.api.DialogV2.wait({classes:["rsa-add-spells"],position:{width:360},window:{title:"Add Spells"},content,rejectClose:false,buttons:[{action:"browse",label:"Browse Compendium",default:true,callback:()=>({action:"browse"})},{action:"load",label:"Load Unprepared Spells",disabled:!first,callback:(event,button,dialog)=>({action:"load",classId:dialog.element.querySelector('[name="class"]').value})}]});
    if(result?.action==="browse")return new Browser(sheetBrowserOptions(actor,"spells")).render({force:true});
    if(result?.action==="load"){const count=await loadUnpreparedSheetSpells(actor,result.classId);ui.notifications.info(count?"Added "+count+" missing class spell"+(count===1?"":"s")+", unprepared.":"Your available class spells are already loaded.");}
}

function sheetForElement(root) {
    const matches=app=>(app.element instanceof HTMLElement?app.element:app.element?.[0])===root;
    return [...(foundry.applications.instances?.values?.()??[]),...Object.values(globalThis.ui?.windows??{})].find(matches);
}
export function handleSheetAdd(event) {
    if(game.settings.get(MODULE_ID,"sheetAddCompendiumBrowser")!==true)return;
    const button=event.target.closest?.(createSelector);if(!button||button.disabled||button.classList.contains("disabled"))return;
    const root=button.closest(".application,.app");if(!root)return;
    const sheet=sheetForElement(root),actor=sheet?.actor??sheet?.document;
    if(actor?.type!=="character"||!actor.isOwner||sheet.isEditable===false)return;
    const panel=button.closest('[data-tab-contents-for],[data-tab-id],.tab[data-tab],[data-application-part="inventory"],[data-application-part="spells"]');
    const tab=panel?.dataset.tabContentsFor??panel?.dataset.tabId??panel?.dataset.tab??panel?.dataset.applicationPart??sheet.tabGroups?.primary??sheet._tabs?.[0]?.active;
    if(!["inventory","spells","spellbook"].includes(tab))return;
    const Browser=globalThis.dnd5e?.applications?.CompendiumBrowser;
    if(typeof Browser!=="function")return;
    event.preventDefault();event.stopImmediatePropagation();
    if(["spells","spellbook"].includes(tab)&&game.settings.get(MODULE_ID,"sheetLoadUnpreparedSpells")===true&&preparationClasses(actor).length)return chooseSheetSpellAction(actor,Browser);
    return new Browser(sheetBrowserOptions(actor,tab)).render({force:true});
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"sheetAddCompendiumBrowser",{
    name:"Open Compendium Browser from Add Item",
    hint:"Character Inventory and Spells Add Item buttons open the matching compendium browser tab. Spells preselect the character's class spell lists; filters remain editable.",
    scope:"world",config:true,type:Boolean,default:true
}));
Hooks.once("init",()=>game.settings.register(MODULE_ID,"sheetLoadUnpreparedSpells",{name:"Offer Load Unprepared Class Spells",hint:"Spell Add/New buttons offer Browse Compendium or loading missing spells for full-list preparation classes. Requires configured spell slots and enabled Add Item compendium navigation.",scope:"world",config:true,type:Boolean,default:true}));
function reportSheetBrowserError(error){console.error("Ugmuls 5.5e Automation | Sheet compendium browser failed:",error);ui.notifications.error(error.message??"Could not open spell options.");}
Hooks.once("ready",()=>document.addEventListener("click",event=>{
    try {Promise.resolve(handleSheetAdd(event)).catch(reportSheetBrowserError);}
    catch(err){reportSheetBrowserError(err);}
},{capture:true}));
