const MODULE_ID="ugmuls-5-5e-automation";
const createSelector='.item-create,[data-action="addDocument"],[data-action="create"],[data-action="createItem"],[data-action="addItem"],[data-action="createDocument"][data-document-class="Item"]';

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
    const browser=new Browser(sheetBrowserOptions(actor,tab));
    event.preventDefault();event.stopImmediatePropagation();
    return browser.render({force:true});
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"sheetAddCompendiumBrowser",{
    name:"Open Compendium Browser from Add Item",
    hint:"Character Inventory and Spells Add Item buttons open the matching compendium browser tab. Spells preselect the character's class spell lists; filters remain editable.",
    scope:"world",config:true,type:Boolean,default:true
}));
Hooks.once("ready",()=>document.addEventListener("click",event=>{
    try {Promise.resolve(handleSheetAdd(event)).catch(err=>console.error("Ugmuls 5.5e Automation | Sheet compendium browser failed:",err));}
    catch(err){console.error("Ugmuls 5.5e Automation | Sheet compendium browser failed:",err);}
},{capture:true}));
