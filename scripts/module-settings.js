const MODULE_ID="region-spell-automation";
export const SETTINGS_GROUPS=[
    {id:"regions",name:"Regions",icon:"fa-draw-polygon",keys:["promptForSaveOnRegionTriggers","regionPlacementControls","autoAttachSelfEmanations","cleanupTargetingRegions"]},
    {id:"targeting",name:"Targeting",icon:"fa-bullseye",keys:["confirmAreaTargets","retargetActivityCards"]},
    {id:"rolls",name:"Rolls & Damage",icon:"fa-dice",keys:["promptForSaveOnSpellCasts","promptDamageOnSave","promptDamageOnHit","adjustSavingThrowAdvantage","adjustAttackRollAdvantage","adjustDamageCritical"]},
    {id:"effects",name:"Effects",icon:"fa-wand-magic-sparkles",keys:["autoApplyBuffEffects","showShieldReaction","showConcentrationHud"]},
    {id:"masteries",name:"Weapon Mastery & Attack Properties",icon:"fa-sword",keys:["weaponMasteryAutomation","masteryGraze","masterySap","masterySlow","masteryTopple","masteryVex"]},
    {id:"npcdamage",name:"GM NPC & Damage",icon:"fa-skull",keys:["autoRollNpcSaves","magicResistanceSaves","autoApplyCardDamage","autoApplySavedEffects","autoApplyHitEffects"]},
    {id:"chat",name:"Chat",icon:"fa-comments",keys:["simplifyAttackCards","scrollChatOnOpen"]}
];
export class ModuleSettingsApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS={id:"rsa-module-options",window:{title:"Region Spell Automation — Options"},position:{width:780,height:650}};
    activeTab="regions";
    draft=new Map();
    initialValues=new Map();
    saving=false;
    ensureDraft(){
        for(const group of SETTINGS_GROUPS)for(const key of group.keys){
            if(game.settings.settings.has(`${MODULE_ID}.${key}`)&&!this.draft.has(key)) {
                const value=game.settings.get(MODULE_ID,key);this.draft.set(key,value);this.initialValues.set(key,value);
            }
        }
    }
    async _renderHTML(){
        this.ensureDraft();
        const escape=foundry.utils.escapeHTML;
        const group=SETTINGS_GROUPS.find(group=>group.id===this.activeTab)??SETTINGS_GROUPS[0];
        const rows=group.keys.map(key=>{
            const setting=game.settings.settings.get(`${MODULE_ID}.${key}`);if(!setting)return "";
            const client=setting.scope==="client",editable=client||game.user.isGM;
            return `<label class="rsa-option-row">
                <div><strong>${escape(game.i18n.localize(setting.name))}</strong>
                    <span class="rsa-option-scope">${client?"This browser":"World"}</span>
                    <p>${escape(game.i18n.localize(setting.hint??""))}</p>
                </div>
                <input type="checkbox" data-rsa-setting="${key}" ${this.draft.get(key)?"checked":""} ${editable?"":"disabled"}
                    aria-label="${escape(game.i18n.localize(setting.name))}">
            </label>`;
        }).join("");
        return `<div class="rsa-options">
            <nav class="rsa-options-tabs" role="tablist" aria-label="Module options">
                ${SETTINGS_GROUPS.map(tab=>`<button type="button" role="tab" data-rsa-tab="${tab.id}" aria-selected="${tab.id===group.id}" aria-controls="rsa-options-panel">
                    <i class="fa-solid ${tab.icon}" aria-hidden="true"></i> ${tab.name}</button>`).join("")}
            </nav>
            <section id="rsa-options-panel" class="rsa-options-panel" role="tabpanel">
                <h2>${group.name}</h2>
                ${group.id==="regions"?'<p>Configure individual spell and feature Regions in the manager.</p><button type="button" data-rsa-manager '+(game.user.isGM?'':'disabled')+'>Open Spell and Region Manager</button>':""}
                ${!game.user.isGM?'<p>World options are managed by the GM. Client options apply to this browser.</p>':""}
                ${rows}
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
        for(const input of this.element.querySelectorAll("[data-rsa-setting]"))input.addEventListener("change",()=>this.draft.set(input.dataset.rsaSetting,input.checked));
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
            catch(err){console.error("Region Spell Automation | Options save failed:",err);ui.notifications.error("Could not save all options. Check the console and retry.");}
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
        name:"Module Options",label:"Open Module Options",hint:"Configure Regions, targeting, rolls, damage, effects, and chat in one tabbed window.",
        icon:"fa-solid fa-sliders",type:ModuleSettingsApp,restricted:false
    });
});
Hooks.once("ready",()=>{
    // The window uses these same stored values and their native onChange callbacks.
    for(const group of SETTINGS_GROUPS)for(const key of group.keys){
        const setting=game.settings.settings.get(`${MODULE_ID}.${key}`);if(setting)setting.config=false;
    }
});
