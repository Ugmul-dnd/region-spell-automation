const MODULE_ID="ugmuls-5-5e-automation";
export const CLASS_AUTOMATIONS=[
    {name:"Barbarian",keys:["recklessAttackAutomation","frenzyAutomation"]},
    {name:"Bard",keys:[]},
    {name:"Cleric",keys:[]},
    {name:"Druid",keys:[]},
    {name:"Fighter",keys:[]},
    {name:"Monk",keys:["stunningStrikeAutomation"]},
    {name:"Paladin",keys:["divineSmiteAutomation"]},
    {name:"Ranger",keys:["huntersPreyAutomation"]},
    {name:"Rogue",keys:["sneakAttackAutomation"]},
    {name:"Sorcerer",keys:["innateSorceryAutomation","empoweredSpellAutomation","seekingSpellAutomation","transmutedSpellAutomation","heightenedSpellAutomation","carefulSpellAutomation"]},
    {name:"Warlock",keys:["eldritchSmiteAutomation"]},
    {name:"Wizard",keys:[]}
];
export const AUTOMATION_GROUPS=[
    {id:"classes",name:"Unique Classes",icon:"fa-hat-wizard",sections:CLASS_AUTOMATIONS,keys:CLASS_AUTOMATIONS.flatMap(section=>section.keys)},
    {id:"masteries",name:"Weapon Masteries",icon:"fa-sword",parent:"weaponMasteryAutomation",keys:["weaponMasteryAutomation","masteryGraze","masterySap","masterySlow","masteryTopple","masteryVex"]},
    {id:"feats",name:"Feats",icon:"fa-star",keys:["savageAttackerAutomation","grapplerAutomation"]},
    {id:"common",name:"Common",icon:"fa-gears",keys:["reactionTracker","bonusActionTracker","spellSlotTurnTracker","grappleAutomation","magicResistanceSaves","showConcentrationHud"]},
    {id:"spells",name:"Spells",icon:"fa-book-open",keys:["showShieldReaction","riderHex","riderHuntersMark","riderMinorElementals","multiShotAttacks","autoApplyBuffEffects"]}
];
export const SETTINGS_GROUPS=[
    {id:"automations",name:"Automations",icon:"fa-wand-magic-sparkles",children:AUTOMATION_GROUPS},
    {id:"regions",name:"Regions",icon:"fa-draw-polygon",keys:["promptForSaveOnRegionTriggers","regionPlacementControls","autoAttachSelfEmanations","cleanupTargetingRegions"]},
    {id:"targeting",name:"Targeting",icon:"fa-bullseye",keys:["confirmAreaTargets","retargetActivityCards"]},
    {id:"rolls",name:"Rolls & Damage / Healing",icon:"fa-dice",keys:["promptForSaveOnSpellCasts","promptDamageOnSave","promptDamageOnHit","adjustSavingThrowAdvantage","adjustAttackRollAdvantage","adjustDamageCritical"]},
    {id:"npcdamage",name:"GM NPC & Damage / Healing",icon:"fa-skull",keys:["autoRollNpcSaves","autoApplyCardDamage","autoApplySavedEffects","autoApplyHitEffects"]},
    {id:"chat",name:"Chat & Sheets",icon:"fa-comments",keys:["simplifyAttackCards","scrollChatOnOpen","sheetAddCompendiumBrowser"]}
];
const settingPages=()=>SETTINGS_GROUPS.flatMap(group=>group.children??[group]);
export class ModuleSettingsApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS={id:"rsa-module-options",window:{title:"Ugmuls 5.5e Automation — Options",resizable:true},position:{width:780,height:650}};
    activeTab="automations";
    activeAutomationTab="classes";
    activeClass="all";
    draft=new Map();
    initialValues=new Map();
    saving=false;
    ensureDraft(){
        for(const group of settingPages())for(const key of group.keys){
            if(game.settings.settings.has(`${MODULE_ID}.${key}`)&&!this.draft.has(key)) {
                const value=game.settings.get(MODULE_ID,key);this.draft.set(key,value);this.initialValues.set(key,value);
            }
        }
    }
    async _renderHTML(){
        this.ensureDraft();
        const escape=foundry.utils.escapeHTML;
        const group=SETTINGS_GROUPS.find(group=>group.id===this.activeTab)??SETTINGS_GROUPS[0];
        const page=group.children?.find(page=>page.id===this.activeAutomationTab)??group.children?.[0]??group;
        const renderRows=keys=>keys.map(key=>{
            const setting=game.settings.settings.get(`${MODULE_ID}.${key}`);if(!setting)return "";
            const client=setting.scope==="client",editable=client||game.user.isGM;
            const parentDisabled=!!page.parent&&key!==page.parent&&this.draft.get(page.parent)!==true;
            return `<label class="rsa-option-row${parentDisabled?" rsa-option-disabled":""}" ${parentDisabled?'aria-disabled="true"':""}>
                <div><strong>${escape(game.i18n.localize(setting.name))}</strong>
                    <span class="rsa-option-scope">${client?"This browser":"World"}</span>
                    <p>${escape(game.i18n.localize(setting.hint??""))}</p>
                </div>
                <input type="checkbox" data-rsa-setting="${key}" ${this.draft.get(key)?"checked":""} ${editable&&!parentDisabled?"":"disabled"}
                    aria-label="${escape(game.i18n.localize(setting.name))}">
            </label>`;
        }).join("");
        const sections=page.sections?.filter(section=>this.activeClass==="all"?section.keys.length>0:section.name===this.activeClass);
        const rows=sections?sections.map(section=>`<section class="rsa-class-options"><h3>${escape(section.name)}</h3>${section.keys.length?renderRows(section.keys):"<p>No class-specific automations are available for this class yet.</p>"}</section>`).join(""):renderRows(page.keys);
        return `<div class="rsa-options">
            <nav class="rsa-options-tabs" role="tablist" aria-label="Module options">
                ${SETTINGS_GROUPS.map(tab=>`<button type="button" role="tab" data-rsa-tab="${tab.id}" aria-selected="${tab.id===group.id}" aria-controls="rsa-options-panel">
                    <i class="fa-solid ${tab.icon}" aria-hidden="true"></i> ${tab.name}</button>`).join("")}
            </nav>
            <section id="rsa-options-panel" class="rsa-options-panel${group.children?" rsa-has-submenus":""}" role="tabpanel">
                <h2>${group.name}</h2>
                ${group.children?`<nav class="rsa-automation-tabs" role="tablist" aria-label="Automation categories">${group.children.map(tab=>`<button type="button" role="tab" data-rsa-automation-tab="${tab.id}" aria-selected="${tab.id===page.id}" aria-controls="rsa-automation-panel"><i class="fa-solid ${tab.icon}" aria-hidden="true"></i> ${tab.name}</button>`).join("")}</nav>${page.id==="classes"?`<div class="rsa-class-filter"><label for="rsa-class-filter">Class</label><select id="rsa-class-filter" data-rsa-class-filter aria-controls="rsa-automation-panel"><option value="all" ${this.activeClass==="all"?"selected":""}>All</option>${CLASS_AUTOMATIONS.map(section=>`<option value="${escape(section.name)}" ${this.activeClass===section.name?"selected":""}>${escape(section.name)}</option>`).join("")}</select></div>`:""}<section id="rsa-automation-panel" role="tabpanel"><h3 class="rsa-automation-heading">${page.name}</h3>`:""}
                ${page.hint?`<p>${escape(page.hint)}</p>`:""}
                ${group.id==="regions"?'<p>Configure individual spell and feature Regions in the manager.</p><button type="button" data-rsa-manager '+(game.user.isGM?'':'disabled')+'>Open Spell and Region Manager</button>':""}
                ${!game.user.isGM?'<p>World options are managed by the GM. Client options apply to this browser.</p>':""}
                ${rows}
                ${group.children?"</section>":""}
            </section>
            <footer class="rsa-options-footer">
                <button type="button" data-rsa-cancel>Cancel</button>
                <button type="button" data-rsa-save><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Options</button>
            </footer>
        </div>`;
    }
    _replaceHTML(result,content){content.innerHTML=result;}
    _onRender(context,options){
        super._onRender(context,options);
        this.element.querySelector("[data-rsa-class-filter]")?.addEventListener("change",event=>{this.activeClass=event.currentTarget.value;this.render({force:true});});
        for(const input of this.element.querySelectorAll("[data-rsa-setting]"))input.addEventListener("change",()=>{
            this.draft.set(input.dataset.rsaSetting,input.checked);
            if(settingPages().some(page=>page.parent===input.dataset.rsaSetting))this.render({force:true});
        });
        for(const tab of this.element.querySelectorAll("[data-rsa-automation-tab]"))tab.addEventListener("click",()=>{this.activeAutomationTab=tab.dataset.rsaAutomationTab;this.render({force:true});});
        for(const tab of this.element.querySelectorAll("[data-rsa-tab]"))tab.addEventListener("click",()=>{this.activeTab=tab.dataset.rsaTab;this.render({force:true});});
        this.element.querySelector("[data-rsa-cancel]").addEventListener("click",()=>this.close());
        this.element.querySelector("[data-rsa-manager]")?.addEventListener("click",()=>{
            if(!game.user.isGM)return;
            const Manager=game.settings.menus.get(`${MODULE_ID}.spellManager`)?.type;
            if(Manager)new Manager().render({force:true});
        });
        this.element.querySelector("[data-rsa-save]").addEventListener("click",async event=>{
            if(this.saving)return;event.currentTarget.disabled=true;this.saving=true;
            try{await this.saveDraft();await this.close();}
            catch(err){console.error("Ugmuls 5.5e Automation | Options save failed:",err);ui.notifications.error("Could not save all options. Check the console and retry.");}
            finally{this.saving=false;event.currentTarget.disabled=false;}
        });
    }
    async saveDraft(){
        for(const [key,value]of this.draft){
            const setting=game.settings.settings.get(`${MODULE_ID}.${key}`);
            if(!setting||(setting.scope!=="client"&&!game.user.isGM))continue;
            if(this.initialValues.get(key)===value)continue;
            if(game.settings.get(MODULE_ID,key)!==value)await game.settings.set(MODULE_ID,key,value);
            this.initialValues.set(key,value);
        }
    }
}
Hooks.once("init",()=>{
    game.settings.registerMenu(MODULE_ID,"moduleOptions",{
        name:"Module Options",label:"Open Module Options",hint:"Find Automations by class, weapon mastery, feat, common tracker, or spell, alongside Regions, targeting, damage, and chat options.",
        icon:"fa-solid fa-sliders",type:ModuleSettingsApp,restricted:false
    });
});
Hooks.once("ready",()=>{
    // The window uses these same stored values and their native onChange callbacks.
    for(const group of settingPages())for(const key of group.keys){
        const setting=game.settings.settings.get(`${MODULE_ID}.${key}`);if(setting)setting.config=false;
    }
});
