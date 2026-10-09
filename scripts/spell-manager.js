// ============================================================
// Region Spell Automation
// Spell Manager
// v0.5.7
//
// Supports:
// - Multiple activity triggers
// - Simplified useful Region event list
// - Optional Once Per Turn limiter
// - Existing Active Effects assigned as Region Effects
// - Live spell search/filter
// ============================================================

const MODULE_ID = "region-spell-automation";
const SETTING_KEY = "spellTable";
import { addStartingSpells } from "./starter-spells.js";


// ============================================================
// DISPLAY LABELS
// ============================================================

const EVENT_LABELS = {

    tokenEnter:
        "Token Enters",

    tokenExit:
        "Token Exits",

    tokenMoveWithin:
        "Token Moves Within",

    tokenTurnStart:
        "Token Starts Turn",

    tokenTurnEnd:
        "Token Ends Turn"
};


const TARGET_LABELS = {

    everyone:
        "Everyone",

    excludeFriendlies:
        "Exclude Friendlies",

    hostilesOnly:
        "Hostiles Only",

    friendliesOnly:
        "Friendlies Only"
};


// ============================================================
// MANAGER APPLICATION
// ============================================================

class RegionSpellManager
    extends foundry.applications.api.ApplicationV2 {

    selectedSpells = new Set();
    editingSpell = null;
    spellEditors = new Map();
    spellStateFilter = "all";
    searchQuery = "";
    managerScrollTop = 0;

    static DEFAULT_OPTIONS = {

        id:
            "region-spell-manager",

        window: {
            title:
                "Spell and Region Management"
        },

        position: {
            width:
                760,

            height:
                720
        }
    };


    // ========================================================
    // RENDER
    // ========================================================

    async _renderHTML(
        context,
        options
    ) {

        const spellTable =
            game.settings.get(
                MODULE_ID,
                SETTING_KEY
            ) ?? {};


        const configuredSpells =
            Object.entries(
                spellTable
            )
                .filter(([name]) => !this.editingSpell || name === this.editingSpell)
                .sort(
                    ([a], [b]) =>
                        a.localeCompare(b)
                );


        let spellRows =
            "";

        for (const name of this.selectedSpells) {
            if (!Object.hasOwn(spellTable, name)) this.selectedSpells.delete(name);
        }
        for (const [name, editor] of this.spellEditors) {
            if (!Object.hasOwn(spellTable, name)) { editor.close(); this.spellEditors.delete(name); }
        }


        // ====================================================
        // EMPTY TABLE
        // ====================================================

        if (
            !configuredSpells.length
        ) {

            spellRows = `
                <div
                    style="
                        padding:20px;
                        text-align:center;
                        opacity:0.7;
                    "
                >
                    No configured spells or features yet.
                </div>
            `;
        }


        // ====================================================
        // SPELL CARDS
        // ====================================================

        else {

            for (
                const [
                    spellName,
                    config
                ]
                of configuredSpells
            ) {

                const safeName =
                    foundry.utils.escapeHTML(
                        spellName
                    );


                const encodedName =
                    encodeURIComponent(
                        spellName
                    );


                const searchName =
                    foundry.utils.escapeHTML(
                        spellName.toLowerCase()
                    );


                if (!this.editingSpell) {
                    spellRows += `<div class="rsa-spell-card" data-search-name="${searchName}" data-enabled="${config.enabled !== false}"
                        style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--color-border-light-2);">
                        <input type="checkbox" class="rsa-select-spell" data-spell="${encodedName}" aria-label="Select ${safeName}"
                            ${this.selectedSpells.has(spellName) ? "checked" : ""}>
                        <strong style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${safeName}">
                            ${safeName}${config.enabled === false ? " (Disabled)" : ""}
                        </strong>
                        <button type="button" class="rsa-toggle-enabled" data-spell="${encodedName}" style="flex:0 0 auto;width:auto;">
                            ${config.enabled !== false ? "Disable" : "Enable"}
                        </button>
                        <button type="button" class="rsa-edit-spell" data-spell="${encodedName}" style="flex:0 0 auto;width:auto;">Edit</button>
                        <button type="button" class="rsa-delete-spell" data-spell="${encodedName}" style="flex:0 0 auto;width:auto;">Delete</button>
                    </div>`;
                    continue;
                }
                const triggers =
                    Array.isArray(
                        config.triggers
                    )
                        ? config.triggers
                        : [];


                const regionEffects =
                    Array.isArray(
                        config.regionEffects
                    )
                        ? config.regionEffects
                        : [];


                // ============================================
                // ACTIVITY TRIGGERS
                // ============================================

                let triggerRows =
                    "";


                if (
                    !triggers.length
                ) {

                    triggerRows = `
                        <div
                            style="
                                padding:8px;
                                opacity:0.6;
                                font-style:italic;
                            "
                        >
                            No activity triggers configured.
                        </div>
                    `;
                }


                else {

                    for (
                        const trigger
                        of triggers
                    ) {

                        const safeTriggerName =
                            foundry.utils.escapeHTML(
                                trigger.name ??
                                "Unnamed Trigger"
                            );


                        const safeActivity =
                            foundry.utils.escapeHTML(
                                trigger.activity ??
                                "Unknown"
                            );


                        const eventText =
                            (
                                trigger.events ??
                                []
                            )
                                .map(
                                    eventName =>
                                        EVENT_LABELS[
                                            eventName
                                        ] ??
                                        eventName
                                )
                                .join(
                                    ", "
                                );


                        const safeEvents =
                            foundry.utils.escapeHTML(
                                eventText
                            );


                        const safeTargeting =
                            foundry.utils.escapeHTML(
                                TARGET_LABELS[
                                    trigger.targeting
                                ] ??
                                trigger.targeting ??
                                "Unknown"
                            );


                        const limitText =
                            trigger.movementDamage ? "Movement Damage" : trigger.shareCardPerTurn
                                ? "Shared Card Per Turn"
                                : trigger.oncePerTurn
                                ? "Once Per Turn"
                                : "Unlimited";


                        triggerRows += `
                            <div
                                style="
                                    display:grid;
                                    grid-template-columns:
                                        1fr auto auto;

                                    gap:8px;
                                    align-items:center;

                                    margin-top:6px;
                                    padding:8px;

                                    border:
                                        1px solid
                                        var(--color-border-light-2);

                                    border-radius:5px;
                                "
                            >

                                <div>

                                    <strong>
                                        ${safeTriggerName}
                                    </strong>

                                    <div
                                        style="
                                            font-size:0.85em;
                                            opacity:0.75;
                                            margin-top:3px;
                                        "
                                    >
                                        Activity:
                                        ${safeActivity}
                                        <br>

                                        Events:
                                        ${safeEvents}
                                        <br>

                                        Targeting:
                                        ${safeTargeting}
                                        <br>

                                        Limit:
                                        ${limitText}
                                    </div>

                                </div>


                                <button
                                    type="button"

                                    class="rsa-edit-trigger"

                                    data-spell="${encodedName}"

                                    data-trigger="${trigger.id}"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                    Edit
                                </button>


                                <button
                                    type="button"

                                    class="rsa-delete-trigger"

                                    data-spell="${encodedName}"

                                    data-trigger="${trigger.id}"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>

                            </div>
                        `;
                    }
                }


                // ============================================
                // REGION EFFECTS
                // ============================================

                let effectRows =
                    "";


                if (
                    !regionEffects.length
                ) {

                    effectRows = `
                        <div
                            style="
                                padding:8px;
                                opacity:0.6;
                                font-style:italic;
                            "
                        >
                            No Region Effects configured.
                        </div>
                    `;
                }


                else {

                    for (
                        const regionEffect
                        of regionEffects
                    ) {

                        const safeEffectName =
                            foundry.utils.escapeHTML(
                                regionEffect.name ??
                                "Unknown Effect"
                            );


                        effectRows += `
                            <div
                                style="
                                    display:grid;
                                    grid-template-columns:
                                        1fr auto auto;

                                    gap:8px;
                                    align-items:center;

                                    margin-top:6px;
                                    padding:8px;

                                    border:
                                        1px solid
                                        var(--color-border-light-2);

                                    border-radius:5px;
                                "
                            >

                                <div>

                                    <strong>
                                        ${safeEffectName}
                                    </strong>

                                    <div
                                        style="
                                            font-size:0.85em;
                                            opacity:0.75;
                                            margin-top:3px;
                                        "
                                    >
                                        Active while token
                                        is inside the Region
                                    </div>

                                </div>


                                <button
                                    type="button"

                                    class="rsa-change-effect"

                                    data-spell="${encodedName}"

                                    data-effect="${regionEffect.id}"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                    Change
                                </button>


                                <button
                                    type="button"

                                    class="rsa-delete-effect"

                                    data-spell="${encodedName}"

                                    data-effect="${regionEffect.id}"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>

                            </div>
                        `;
                    }
                }


                // ============================================
                // SPELL CARD
                // ============================================

                spellRows += `
                    <div
                        class="rsa-spell-card"
                        data-enabled="${config.enabled !== false}"

                        data-search-name="${searchName}"

                        style="
                            padding:12px;

                            border-bottom:
                                1px solid
                                var(--color-border-light-2);
                        "
                    >

                        <h3>${safeName}${config.enabled === false ? " (Disabled)" : ""}</h3>
                        <!-- ACTIVITY TRIGGERS -->
                        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;margin-left:26px;">
                            <input type="checkbox" class="rsa-hide-region" data-spell="${encodedName}"
                                ${config.hideRegionFromPlayers === true ? "checked" : ""}>
                            Hide Region from Players
                        </label>

                        <div
                            style="
                                margin-top:12px;
                                margin-left:26px;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    align-items:center;
                                    justify-content:
                                        space-between;
                                "
                            >

                                <strong>
                                    Activity Triggers
                                </strong>


                                <button
                                    type="button"

                                    class="rsa-add-trigger"

                                    data-spell="${encodedName}"
                                >
                                    <i class="fa-solid fa-plus"></i>
                                    Add Trigger
                                </button>

                            </div>


                            ${triggerRows}

                        </div>


                        <fieldset style="margin-top:16px;">
                            <legend>Region Conditions</legend>
                            <ul style="margin:8px 0;">
                                ${(config.regionConditions ?? []).length ? (config.regionConditions ?? []).map(id =>
                                    game.i18n.localize(CONFIG.statusEffects[id]?.name ?? id)).sort((a,b)=>a.localeCompare(b))
                                    .map(name => `<li>${foundry.utils.escapeHTML(name)}</li>`).join("") : "<li>No conditions selected.</li>"}
                            </ul>
                            <button type="button" class="rsa-edit-conditions" data-spell="${encodedName}">Add / Edit Conditions</button>
                        </fieldset>
                        <!-- REGION EFFECTS -->

                        <div
                            style="
                                margin-top:16px;
                                margin-left:26px;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    align-items:center;
                                    justify-content:
                                        space-between;
                                "
                            >

                                <strong>
                                    Region Effects
                                </strong>


                                <button
                                    type="button"

                                    class="rsa-add-effect"

                                    data-spell="${encodedName}"
                                >
                                    <i class="fa-solid fa-plus"></i>
                                    Add Effect to Region
                                </button>

                            </div>


                            ${effectRows}

                        </div>

                    </div>
                `;
            }
        }


        // ====================================================
        // APPLICATION HTML
        // ====================================================

        if (this.editingSpell) {
            return `<div data-rsa-manager-scroll style="padding:8px;height:100%;overflow:auto;">${spellRows}
                <button type="button" data-rsa-save-region-config style="margin-top:16px;width:100%;">Confirm / Save</button>
            </div>`;
        }

        return `
            <div
                data-rsa-manager-scroll
                style="
                    padding:12px;
                    height:100%;
                    overflow:auto;
                "
            >

                <!-- ======================================== -->
                <!-- DROP ZONE                                -->
                <!-- ======================================== -->

                <div style="margin-bottom:12px;">
                    <div style="display:flex;gap:6px;">
                    <button type="button" id="rsa-add-starters">
                        <i class="fa-solid fa-book-open"></i> Add Starting Spell List
                    </button>
                    <span tabindex="0" role="img" style="align-self:center;cursor:help;flex:0 0 auto;"
                        aria-label="These spells are based on the Official Foundry 5.5e Player Handbook. Adds missing configurations only, disabled for review. Matching activities are required. No Region Effects or spell content are included."
                        data-tooltip="These spells are based on the Official Foundry 5.5e Player Handbook. Adds missing configurations only, disabled for review. Matching activities are required. No Region Effects or spell content are included.">
                        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                    </span>
                    <button type="button" id="rsa-add-new-spell">
                        <i class="fa-solid fa-plus"></i> Add New Spell / Feature Region
                    </button>
                    </div>
                </div>

                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
                    <button type="button" id="rsa-select-all" title="Select all configured spells and features, including filtered entries">Select all</button>
                    <button type="button" id="rsa-deselect-all">Deselect all</button>
                    <button type="button" id="rsa-delete-selected" ${this.selectedSpells.size ? "" : "disabled"}>Delete Selected</button>
                    <span id="rsa-selected-count">${this.selectedSpells.size} selected</span>
                </div>
                <div style="display:flex;gap:6px;margin-bottom:12px;">
                    <button type="button" id="rsa-enable-selected" ${this.selectedSpells.size ? "" : "disabled"}>Enable Selected</button>
                    <button type="button" id="rsa-disable-selected" ${this.selectedSpells.size ? "" : "disabled"}>Disable Selected</button>
                </div>

                <!-- SEARCH                                   -->
                <!-- ======================================== -->

                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                        margin-bottom:12px;
                    "
                >

                    <i
                        class="fa-solid fa-magnifying-glass"
                        style="
                            opacity:0.7;
                        "
                    ></i>


                    <input
                        id="rsa-search"

                        type="search"

                        placeholder="Search configured spells and features..."

                        autocomplete="off"

                        style="
                            width:100%;
                        "
                    >

                </div>


                <!-- ======================================== -->
                <div style="display:flex;gap:6px;margin-bottom:12px;">
                    <button type="button" id="rsa-show-disabled" aria-pressed="false">Show Disabled</button>
                    <button type="button" id="rsa-show-enabled" aria-pressed="false">Show Enabled</button>
                </div>
                <!-- HEADER                                   -->
                <!-- ======================================== -->

                <div
                    style="
                        display:flex;
                        justify-content:
                            space-between;
                        align-items:center;
                        margin-bottom:8px;
                    "
                >

                    <strong>
                        Configured Spells
                    </strong>


                    <span
                        id="rsa-spell-count"

                        style="
                            opacity:0.7;
                        "
                    >
                        ${configuredSpells.length}
                    </span>

                </div>


                <!-- ======================================== -->
                <!-- NO SEARCH RESULTS                        -->
                <!-- ======================================== -->

                <div
                    id="rsa-no-results"

                    style="
                        display:none;
                        padding:16px;
                        text-align:center;
                        opacity:0.7;
                        font-style:italic;
                    "
                >
                    No matching spells.
                </div>


                <!-- ======================================== -->
                <!-- SPELL LIST                               -->
                <!-- ======================================== -->

                <div
                    id="rsa-spell-list"

                    style="
                        border:
                            1px solid
                            var(--color-border-light-2);

                        border-radius:6px;

                        overflow:hidden;
                    "
                >
                    ${spellRows}
                </div>

            </div>
        `;
    }


    // ========================================================
    // REPLACE HTML
    // ========================================================

    _replaceHTML(
        result,
        content,
        options
    ) {

        const previousScroll = content.querySelector?.("[data-rsa-manager-scroll]");
        if (previousScroll) this.managerScrollTop = previousScroll.scrollTop;
        content.innerHTML =
            result;
    }


    // ========================================================
    // AFTER RENDER
    // ========================================================

    _onRender(
        context,
        options
    ) {

        super._onRender(
            context,
            options
        );


        const root =
            this.element;

        for (const button of root.querySelectorAll(".rsa-edit-conditions")) {
            button.addEventListener("click", () => {
                if (!game.user.isGM) return;
                const name = decodeURIComponent(button.dataset.spell);
                this.conditionPicker ??= new RegionConditionPicker(this, name);
                this.conditionPicker.render({force:true});
            });
        }
        for (const checkbox of root.querySelectorAll(".rsa-hide-region")) {
            checkbox.addEventListener("change", async () => {
                if (!game.user.isGM) return;
                checkbox.disabled = true;
                const name = decodeURIComponent(checkbox.dataset.spell);
                try {
                    const table = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING_KEY) ?? {});
                    if (!Object.hasOwn(table, name)) return;
                    table[name].hideRegionFromPlayers = checkbox.checked;
                    await game.settings.set(MODULE_ID, SETTING_KEY, table);
                } catch (err) {
                    checkbox.checked = game.settings.get(MODULE_ID, SETTING_KEY)?.[name]?.hideRegionFromPlayers === true;
                    console.error("Region Spell Automation | Could not save Region visibility:", err);
                    ui.notifications.error("Could not save Region visibility. Check F12 console.");
                } finally { checkbox.disabled = false; }
            });
        }

        if (this.editingSpell) {
            root.querySelector("[data-rsa-save-region-config]")?.addEventListener("click", async () => {
                await this.close();
                this.manager.render({force:true});
                this.manager.bringToFront?.();
            });
            this._activateSpellHandlers(root);
            const scroller = root.querySelector("[data-rsa-manager-scroll]");
            if (scroller) {
                scroller.scrollTop = this.managerScrollTop;
                scroller.addEventListener("scroll", () => { this.managerScrollTop = scroller.scrollTop; });
            }
            return;
        }
        for (const button of root.querySelectorAll(".rsa-edit-spell")) {
            button.addEventListener("click", () => {
                const name = decodeURIComponent(button.dataset.spell);
                let editor = this.spellEditors.get(name);
                if (!editor) { editor = new RegionSpellConfigEditor(this, name); this.spellEditors.set(name, editor); }
                editor.render({ force: true });
            });
        }

        root.querySelector("#rsa-add-new-spell")?.addEventListener("click", () => {
            if (!game.user.isGM) return;
            this.spellDropDialog ??= new RegionSpellDropDialog(this);
            this.spellDropDialog.render({ force: true });
        });

        const selectionBoxes = Array.from(root.querySelectorAll(".rsa-select-spell"));
        const refreshSelection = () => {
            for (const checkbox of selectionBoxes) {
                checkbox.checked = this.selectedSpells.has(decodeURIComponent(checkbox.dataset.spell));
            }
            root.querySelector("#rsa-selected-count").textContent = `${this.selectedSpells.size} selected`;
            for (const id of ["#rsa-delete-selected", "#rsa-enable-selected", "#rsa-disable-selected"]) {
                root.querySelector(id).disabled = this.selectedSpells.size === 0;
            }
        };
        for (const [selector, enabled] of [["#rsa-enable-selected", true], ["#rsa-disable-selected", false]]) {
            root.querySelector(selector)?.addEventListener("click", async event => {
                if (!this.selectedSpells.size || !game.user.isGM) return;
                event.currentTarget.disabled = true;
                try {
                    const table = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING_KEY) ?? {});
                    for (const name of this.selectedSpells) {
                        if (Object.hasOwn(table, name)) table[name].enabled = enabled;
                    }
                    await game.settings.set(MODULE_ID, SETTING_KEY, table);
                    this.render({ force: true });
                } catch (err) {
                    console.error("Region Spell Automation | Bulk enable/disable failed:", err);
                    ui.notifications.error("Could not update selected spells. Check F12 console.");
                } finally { refreshSelection(); }
            });
        }
        for (const checkbox of selectionBoxes) {
            checkbox.addEventListener("change", () => {
                const name = decodeURIComponent(checkbox.dataset.spell);
                if (checkbox.checked) this.selectedSpells.add(name);
                else this.selectedSpells.delete(name);
                refreshSelection();
            });
        }
        root.querySelector("#rsa-select-all")?.addEventListener("click", () => {
            for (const checkbox of selectionBoxes) this.selectedSpells.add(decodeURIComponent(checkbox.dataset.spell));
            refreshSelection();
        });
        root.querySelector("#rsa-deselect-all")?.addEventListener("click", () => {
            this.selectedSpells.clear();
            refreshSelection();
        });
        root.querySelector("#rsa-delete-selected")?.addEventListener("click", async event => {
            const button = event.currentTarget;
            const names = [...this.selectedSpells];
            if (!names.length || !game.user.isGM) return;
            button.disabled = true;
            try {
                const confirmed = await foundry.applications.api.DialogV2.confirm({
                    window: { title: "Delete Selected Spells" },
                    content: `<p>Delete these ${names.length} saved spell configuration(s) and all their triggers and Region Effect settings?</p>
                        <p>${names.map(name => foundry.utils.escapeHTML(name)).join(", ")}</p>
                        <p><strong>This cannot be undone. Are you sure?</strong></p>`,
                    yes: { label: "Yes" }, no: { label: "No" }, rejectClose: false
                });
                if (!confirmed) return;
                const table = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING_KEY) ?? {});
                for (const name of names) delete table[name];
                await game.settings.set(MODULE_ID, SETTING_KEY, table);
                for (const name of names) this.selectedSpells.delete(name);
                this.render({ force: true });
            } catch (err) {
                console.error("Region Spell Automation | Could not delete selected spells:", err);
                ui.notifications.error("Could not delete selected spells. Check F12 console.");
            } finally { refreshSelection(); }
        });

        root.querySelector("#rsa-add-starters")?.addEventListener("click", async event => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
                if (!game.user.isGM) return;
                const { table, added } = addStartingSpells(game.settings.get(MODULE_ID, SETTING_KEY), foundry.utils.randomID);
                if (!added.length) { ui.notifications.info("All starting spells are already configured. Existing settings were preserved."); return; }
                await game.settings.set(MODULE_ID, SETTING_KEY, table);
                ui.notifications.info(`Added ${added.length} starting spell(s), disabled for review. Match activities/effects, then enable them.`);
                this.render({ force: true });
            } catch (err) {
                console.error("Region Spell Automation | Could not add starting spells:", err);
                ui.notifications.error("Could not add starting spells. Check F12 console.");
            } finally { button.disabled = false; }
        });


        // ====================================================
        // LIVE SEARCH
        // ====================================================

        const searchInput = root.querySelector("#rsa-search");
        const spellCards = Array.from(root.querySelectorAll(".rsa-spell-card"));
        const countDisplay = root.querySelector("#rsa-spell-count");
        const noResults = root.querySelector("#rsa-no-results");
        const scroller = root.querySelector("[data-rsa-manager-scroll]");
        const applyFilters = () => {
            const query = this.searchQuery.trim().toLowerCase();
            let count = 0;
            for (const card of spellCards) {
                const matchesName = !query || (card.dataset.searchName ?? "").includes(query);
                const enabled = card.dataset.enabled !== "false";
                const matchesState = this.spellStateFilter === "all" ||
                    (this.spellStateFilter === "enabled" ? enabled : !enabled);
                card.style.display = matchesName && matchesState ? "flex" : "none";
                if (matchesName && matchesState) count++;
            }
            if (countDisplay) countDisplay.textContent = query || this.spellStateFilter !== "all"
                ? `${count} / ${spellCards.length}` : String(spellCards.length);
            if (noResults) noResults.style.display = count === 0 && spellCards.length ? "" : "none";
            for (const [id, state] of [["#rsa-show-disabled", "disabled"], ["#rsa-show-enabled", "enabled"]]) {
                const button = root.querySelector(id);
                button?.setAttribute("aria-pressed", String(this.spellStateFilter === state));
                button?.classList.toggle("active", this.spellStateFilter === state);
            }
        };
        if (searchInput) {
            searchInput.value = this.searchQuery;
            searchInput.addEventListener("input", () => {
                this.searchQuery = searchInput.value;
                applyFilters();
            });
        }
        for (const [id, state] of [["#rsa-show-disabled", "disabled"], ["#rsa-show-enabled", "enabled"]]) {
            root.querySelector(id)?.addEventListener("click", () => {
                this.spellStateFilter = this.spellStateFilter === state ? "all" : state;
                applyFilters();
                this.managerScrollTop = 0;
                if (scroller) scroller.scrollTop = 0;
            });
        }
        applyFilters();
        if (scroller) {
            scroller.scrollTop = this.managerScrollTop;
            scroller.addEventListener("scroll", () => { this.managerScrollTop = scroller.scrollTop; });
        }
        // DROP SPELL
        // ====================================================

        this._activateSpellHandlers(root);
    }

    _activateSpellHandlers(root) {
        // ENABLE / DISABLE
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-toggle-enabled"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {
                    button.disabled = true;
                    try {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const table =
                        foundry.utils.deepClone(
                            game.settings.get(
                                MODULE_ID,
                                SETTING_KEY
                            ) ?? {}
                        );


                    if (!table[spellName]) {
                        return;
                    }


                    table[spellName].enabled =
                        table[spellName].enabled === false;


                    await game.settings.set(
                        MODULE_ID,
                        SETTING_KEY,
                        table
                    );
                    this.render({ force: true });
                    } catch (err) {
                        console.error('Region Spell Automation | Enable/disable failed:', err);
                        ui.notifications.error('Could not update spell state. Check F12 console.');
                    } finally { button.disabled = false; }
                }
            );
        }


        // ====================================================
        // ADD ACTIVITY TRIGGER
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-add-trigger"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const item =
                        await this._findSpellItem(
                            spellName
                        );


                    if (!item) {

                        ui.notifications.warn(
                            `Could not locate "${spellName}". Drag the spell into the manager again.`
                        );

                        return;
                    }


                    await this._configureTrigger(
                        item,
                        null
                    );
                }
            );
        }


        // ====================================================
        // EDIT ACTIVITY TRIGGER
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-edit-trigger"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const triggerId =
                        button.dataset.trigger;


                    const table =
                        game.settings.get(
                            MODULE_ID,
                            SETTING_KEY
                        ) ?? {};


                    const trigger =
                        (
                            table[
                                spellName
                            ]?.triggers ??
                            []
                        )
                            .find(
                                entry =>
                                    entry.id ===
                                    triggerId
                            );


                    if (!trigger) {
                        return;
                    }


                    const item =
                        await this._findSpellItem(
                            spellName
                        );


                    if (!item) {

                        ui.notifications.warn(
                            `Could not locate "${spellName}".`
                        );

                        return;
                    }


                    await this._configureTrigger(
                        item,
                        trigger
                    );
                }
            );
        }


        // ====================================================
        // DELETE ACTIVITY TRIGGER
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-delete-trigger"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const triggerId =
                        button.dataset.trigger;


                    const table =
                        foundry.utils.deepClone(
                            game.settings.get(
                                MODULE_ID,
                                SETTING_KEY
                            ) ?? {}
                        );


                    const config =
                        table[
                            spellName
                        ];


                    if (!config) {
                        return;
                    }


                    config.triggers =
                        (
                            config.triggers ??
                            []
                        )
                            .filter(
                                entry =>
                                    entry.id !==
                                    triggerId
                            );


                    await game.settings.set(
                        MODULE_ID,
                        SETTING_KEY,
                        table
                    );


                    this.render({
                        force:
                            true
                    });
                }
            );
        }


        // ====================================================
        // ADD REGION EFFECT
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-add-effect"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const item =
                        await this._findSpellItem(
                            spellName
                        );


                    if (!item) {

                        ui.notifications.warn(
                            `Could not locate "${spellName}".`
                        );

                        return;
                    }


                    await this._configureRegionEffect(
                        item,
                        null
                    );
                }
            );
        }


        // ====================================================
        // CHANGE REGION EFFECT
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-change-effect"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const regionEffectId =
                        button.dataset.effect;


                    const table =
                        game.settings.get(
                            MODULE_ID,
                            SETTING_KEY
                        ) ?? {};


                    const regionEffect =
                        (
                            table[
                                spellName
                            ]?.regionEffects ??
                            []
                        )
                            .find(
                                entry =>
                                    entry.id ===
                                    regionEffectId
                            );


                    if (!regionEffect) {
                        return;
                    }


                    const item =
                        await this._findSpellItem(
                            spellName
                        );


                    if (!item) {

                        ui.notifications.warn(
                            `Could not locate "${spellName}".`
                        );

                        return;
                    }


                    await this._configureRegionEffect(
                        item,
                        regionEffect
                    );
                }
            );
        }


        // ====================================================
        // DELETE REGION EFFECT
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-delete-effect"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const regionEffectId =
                        button.dataset.effect;


                    const table =
                        foundry.utils.deepClone(
                            game.settings.get(
                                MODULE_ID,
                                SETTING_KEY
                            ) ?? {}
                        );


                    const config =
                        table[
                            spellName
                        ];


                    if (!config) {
                        return;
                    }


                    config.regionEffects =
                        (
                            config.regionEffects ??
                            []
                        )
                            .filter(
                                entry =>
                                    entry.id !==
                                    regionEffectId
                            );


                    await game.settings.set(
                        MODULE_ID,
                        SETTING_KEY,
                        table
                    );


                    this.render({
                        force:
                            true
                    });
                }
            );
        }


        // ====================================================
        // DELETE SPELL
        // ====================================================

        for (
            const button
            of root.querySelectorAll(
                ".rsa-delete-spell"
            )
        ) {

            button.addEventListener(
                "click",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            button.dataset.spell
                        );


                    const confirmed =
                        await foundry
                            .applications
                            .api
                            .DialogV2
                            .confirm(
                                {
                                    window: {
                                        title:
                                            "Delete Region Configuration"
                                    },

                                    content: `
                                        <p>
                                            Remove
                                            <strong>
                                                ${foundry.utils.escapeHTML(spellName)}
                                            </strong>
                                            and all of its
                                            Region automation?
                                        </p>
                                    `,

                                    rejectClose:
                                        false
                                }
                            );


                    if (!confirmed) {
                        return;
                    }


                    const table =
                        foundry.utils.deepClone(
                            game.settings.get(
                                MODULE_ID,
                                SETTING_KEY
                            ) ?? {}
                        );


                    delete table[
                        spellName
                    ];


                    await game.settings.set(
                        MODULE_ID,
                        SETTING_KEY,
                        table
                    );


                    this.render({
                        force:
                            true
                    });
                }
            );
        }
    }

    // FIND SPELL ITEM
    // ========================================================

    async _findSpellItem(
        spellName
    ) {

        const table =
            game.settings.get(
                MODULE_ID,
                SETTING_KEY
            ) ?? {};


        const config =
            table[
                spellName
            ];


        // ----------------------------------------------------
        // STORED UUID
        // ----------------------------------------------------

        if (
            config?.sourceUuid
        ) {

            try {

                const storedItem =
                    await fromUuid(
                        config.sourceUuid
                    );


                if (
                    storedItem &&
                    storedItem.documentName ===
                        "Item"
                ) {

                    return storedItem;
                }

            }

            catch (_) {}
        }


        // ----------------------------------------------------
        // SEARCH ACTORS
        // ----------------------------------------------------

        for (
            const actor
            of game.actors
        ) {

            const item =
                actor.items.find(
                    entry =>
                        ["spell", "feat"].includes(entry.type) &&

                        entry.name ===
                            spellName
                );


            if (item) {
                return item;
            }
        }


        return null;
    }


    // ========================================================
    // CONFIGURE ACTIVITY TRIGGER
    // ========================================================

    async _configureTrigger(
        item,
        existingTrigger =
            null
    ) {

        const activities =
            Array.from(
                item.system.activities ??
                []
            );


        if (!activities.length) {

            ui.notifications.warn(
                `${item.name} has no Activities.`
            );

            return;
        }


        let activityOptions =
            "";


        for (
            const activity
            of activities
        ) {

            const selected =
                existingTrigger?.activity ===
                    activity.name
                    ? "selected"
                    : "";


            activityOptions += `
                <option
                    value="${foundry.utils.escapeHTML(activity.name)}"
                    ${selected}
                >
                    ${foundry.utils.escapeHTML(activity.name)}
                    (${foundry.utils.escapeHTML(activity.type)})
                </option>
            `;
        }


        const checked =
            eventName =>
                existingTrigger
                    ?.events
                    ?.includes(
                        eventName
                    )
                    ? "checked"
                    : "";


        const triggerName =
            existingTrigger?.name ??
            "Trigger";


        const targeting =
            existingTrigger?.targeting ??
            "everyone";


        const oncePerTurn =
            existingTrigger?.oncePerTurn ===
            true;

        const shareCardPerTurn = existingTrigger?.shareCardPerTurn === true;
        const movementDamage = existingTrigger?.movementDamage === true;
        const movementIncrement = Number(existingTrigger?.movementIncrement ?? 5);

        const help = text => {
            const safe = foundry.utils.escapeHTML(text);
            return `<span tabindex="0" role="img" aria-label="${safe}"
                data-tooltip="${safe}" style="cursor:help;margin-left:4px;">
                <i class="fa-solid fa-circle-info" aria-hidden="true"></i></span>`;
        };


        // ====================================================
        // DIALOG
        // ====================================================

        const result =
            await foundry
                .applications
                .api
                .DialogV2
                .input(
                    {
                        window: {
                            title:
                                existingTrigger
                                    ? `Edit ${item.name} Trigger`
                                    : `Add ${item.name} Trigger`
                        },

                        position: { width: 560 },


                        content: `
                            <div
                                style="
                                    display:flex;
                                    flex-direction:column;
                                    gap:12px;
                                    max-height:65vh;
                                    overflow-y:auto;
                                    padding-right:8px;
                                "
                            >

                                <div class="form-group">

                                    <label>
                                        Trigger Name
                                    </label>

                                    <div class="form-fields">

                                        <input
                                            type="text"

                                            name="triggerName"

                                            value="${foundry.utils.escapeHTML(triggerName)}"
                                        >

                                    </div>

                                </div>


                                <div class="form-group">

                                    <label>
                                        Activity
                                    </label>

                                    <div class="form-fields">

                                        <select
                                            name="activity"
                                        >
                                            ${activityOptions}
                                        </select>

                                    </div>

                                </div>


                                <!-- REGION EVENTS -->

                                <fieldset>

                                    <legend>
                                        Region Events
                                    </legend>


                                    <div class="form-group">

                                        <label>
                                            Token Enters
                                        </label>

                                        <div class="form-fields">

                                            <input
                                                type="checkbox"

                                                name="tokenEnter"

                                                ${checked("tokenEnter")}
                                            >

                                        </div>

                                    </div>


                                    <div class="form-group">

                                        <label>
                                            Token Exits
                                        </label>

                                        <div class="form-fields">

                                            <input
                                                type="checkbox"

                                                name="tokenExit"

                                                ${checked("tokenExit")}
                                            >

                                        </div>

                                    </div>


                                    <div class="form-group">

                                        <label>
                                            Token Moves Within
                                        </label>

                                        <div class="form-fields">

                                            <input
                                                type="checkbox"

                                                name="tokenMoveWithin"

                                                ${checked("tokenMoveWithin")}
                                            >

                                        </div>

                                    </div>

                                </fieldset>


                                <!-- COMBAT EVENTS -->

                                <fieldset>

                                    <legend>
                                        Combat Events
                                    </legend>


                                    <div class="form-group">

                                        <label>
                                            Token Starts Turn
                                        </label>

                                        <div class="form-fields">

                                            <input
                                                type="checkbox"

                                                name="tokenTurnStart"

                                                ${checked("tokenTurnStart")}
                                            >

                                        </div>

                                    </div>


                                    <div class="form-group">

                                        <label>
                                            Token Ends Turn
                                        </label>

                                        <div class="form-fields">

                                            <input
                                                type="checkbox"

                                                name="tokenTurnEnd"

                                                ${checked("tokenTurnEnd")}
                                            >

                                        </div>

                                    </div>

                                </fieldset>


                                <!-- TRIGGER LIMIT -->

                                <fieldset>

                                    <legend>
                                        Trigger Limit
                                    </legend>


                                    <div class="form-group">

                                        <label>
                                            Once Per Turn
                                            ${help("Each token can trigger this activity only once during the current combat turn. Different tokens have separate allowances.")}
                                        </label>

                                        <div class="form-fields">

                                            <input
                                                type="checkbox"

                                                name="oncePerTurn"

                                                ${
                                                    oncePerTurn
                                                        ? "checked"
                                                        : ""
                                                }
                                            >

                                        </div>

                                    </div>


                                </fieldset>


                                <fieldset>
                                    <legend>Shared Activity Card</legend>
                                    <div class="form-group">
                                        <label>Share Activity Card Per Turn ${help("Add new targets to the same activity and damage cards during one combat turn instead of using the activity again. Saves and damage application remain manual. Enable Once Per Turn to also limit each creature. Outside combat, activities run normally.")}</label>
                                        <div class="form-fields">
                                            <input type="checkbox" name="shareCardPerTurn"
                                                ${shareCardPerTurn ? "checked" : ""}>
                                        </div>
                                    </div>
                                </fieldset>


                                <fieldset>
                                    <legend>Movement Damage</legend>
                                    <div class="form-group">
                                        <label>Accumulate Movement Damage ${help("Requires a Damage activity. Tracks distance inside the Region on a per-creature pending damage card. Three increments of 2d4 roll 6d4. Uses movement-in/within/out events, skips teleportation, and overrides selected events, Once Per Turn, and Shared Activity Card. Recast after changing this mode. Damage application remains manual.")}</label>
                                        <div class="form-fields">
                                            <input type="checkbox" name="movementDamage" ${movementDamage ? "checked" : ""}>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label>Distance Per Damage Increment ${help("Distance in scene units for each damage increment. Use 5 on a feet-based scene for Spike Growth; convert appropriately on metric scenes. Each movement counts whole increments. Partial boundary steps round up to one increment; a 15-foot move counts as three 5-foot steps.")}</label>
                                        <div class="form-fields">
                                            <input type="number" name="movementIncrement" min="0.01" step="any"
                                                value="${Number.isFinite(movementIncrement) ? movementIncrement : 5}">
                                        </div>
                                    </div>
                                </fieldset>

                                <!-- TARGETING -->

                                <div class="form-group">

                                    <label>
                                        Targeting
                                    </label>

                                    <div class="form-fields">

                                        <select
                                            name="targeting"
                                        >

                                            <option
                                                value="everyone"

                                                ${
                                                    targeting ===
                                                    "everyone"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                Everyone
                                            </option>


                                            <option
                                                value="excludeFriendlies"

                                                ${
                                                    targeting ===
                                                    "excludeFriendlies"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                Exclude Friendlies
                                            </option>


                                            <option
                                                value="hostilesOnly"

                                                ${
                                                    targeting ===
                                                    "hostilesOnly"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                Hostiles Only
                                            </option>


                                            <option
                                                value="friendliesOnly"

                                                ${
                                                    targeting ===
                                                    "friendliesOnly"
                                                        ? "selected"
                                                        : ""
                                                }
                                            >
                                                Friendlies Only
                                            </option>

                                        </select>

                                    </div>

                                </div>

                            </div>
                        `,


                        ok: {
                            label:
                                "Save Trigger",

                            icon:
                                "fa-solid fa-floppy-disk"
                        },


                        rejectClose:
                            false
                    }
                );


        if (!result) {
            return;
        }


        const name =
            String(
                result.triggerName ??
                ""
            ).trim();


        if (!name) {

            ui.notifications.warn(
                "Enter a Trigger name."
            );

            return;
        }


        // ====================================================
        // BUILD EVENTS
        // ====================================================

        const events =
            [];

        if (result.movementDamage) events.push("tokenMoveIn", "tokenMoveWithin", "tokenMoveOut");
        if (result.movementDamage && (!Number.isFinite(Number(result.movementIncrement)) || Number(result.movementIncrement) <= 0)) {
            ui.notifications.warn("Enter a positive movement damage distance increment.");
            return;
        }


        const supportedEvents = [

            "tokenEnter",
            "tokenExit",
            "tokenMoveWithin",
            "tokenTurnStart",
            "tokenTurnEnd"
        ];


        for (
            const eventName
            of supportedEvents
        ) {

            if (
                result[
                    eventName
                ]
            ) {

                events.push(
                    eventName
                );
            }
        }


        if (
            !events.length
        ) {

            ui.notifications.warn(
                "Select at least one Region event."
            );

            return;
        }


        // ====================================================
        // SAVE TRIGGER
        // ====================================================

        const table =
            foundry.utils.deepClone(
                game.settings.get(
                    MODULE_ID,
                    SETTING_KEY
                ) ?? {}
            );


        if (
            !table[item.name]
        ) {

            table[item.name] = {

                enabled:
                    true,
                hideRegionFromPlayers: false,

                sourceUuid:
                    item.uuid,

                triggers:
                    [],

                regionEffects:
                    []
            };
        }


        table[item.name].sourceUuid =
            item.uuid;


        table[item.name].triggers ??=
            [];


        table[item.name].regionEffects ??=
            [];


        const trigger = {

            id:
                existingTrigger?.id ??
                foundry.utils.randomID(),

            name,

            activity:
                result.activity,

            events,

            targeting:
                result.targeting,

            oncePerTurn:
                result.oncePerTurn ===
                true,

            shareCardPerTurn: result.shareCardPerTurn === true,
            movementDamage: result.movementDamage === true,
            movementIncrement: Number(result.movementIncrement ?? 5)
        };


        const existingIndex =
            table[item.name]
                .triggers
                .findIndex(
                    entry =>
                        entry.id ===
                        trigger.id
                );


        if (
            existingIndex >=
            0
        ) {

            table[item.name]
                .triggers[
                    existingIndex
                ] =
                    trigger;
        }


        else {

            table[item.name]
                .triggers
                .push(
                    trigger
                );
        }


        await game.settings.set(
            MODULE_ID,
            SETTING_KEY,
            table
        );


        ui.notifications.info(
            `${item.name}: "${name}" saved.`
        );


        this.render({
            force:
                true
        });
    }


    // ========================================================
    // CONFIGURE REGION EFFECT
    // ========================================================

    async _configureRegionEffect(
        item,
        existingRegionEffect =
            null
    ) {

        const effects =
            Array.from(
                item.effects ??
                []
            );


        if (!effects.length) {

            ui.notifications.warn(
                `${item.name} has no Active Effects. Add the effect through the normal D&D5e Effects interface first.`
            );

            return;
        }


        let effectOptions =
            "";


        for (
            const effect
            of effects
        ) {

            const selected =
                existingRegionEffect
                    ?.effectUuid ===
                    effect.uuid
                    ? "selected"
                    : "";


            effectOptions += `
                <option
                    value="${foundry.utils.escapeHTML(effect.uuid)}"
                    ${selected}
                >
                    ${foundry.utils.escapeHTML(effect.name)}
                </option>
            `;
        }


        const result =
            await foundry
                .applications
                .api
                .DialogV2
                .input(
                    {
                        window: {
                            title:
                                `Add Region Effect - ${item.name}`
                        },


                        content: `
                            <div
                                style="
                                    display:flex;
                                    flex-direction:column;
                                    gap:12px;
                                "
                            >

                                <p>
                                    Select an Active Effect
                                    already defined on
                                    <strong>
                                        ${foundry.utils.escapeHTML(item.name)}
                                    </strong>.
                                </p>


                                <div class="form-group">

                                    <label>
                                        Active Effect
                                    </label>


                                    <div class="form-fields">

                                        <select
                                            name="effectUuid"
                                        >
                                            ${effectOptions}
                                        </select>

                                    </div>

                                </div>


                                <p
                                    style="
                                        opacity:0.7;
                                        font-size:0.9em;
                                    "
                                >
                                    D&D5e applies this effect
                                    while a token is inside the
                                    Region and removes the
                                    Region-created copy when
                                    the token exits.
                                </p>

                            </div>
                        `,


                        ok: {
                            label:
                                "Add Effect to Region",

                            icon:
                                "fa-solid fa-plus"
                        },


                        rejectClose:
                            false
                    }
                );


        if (!result) {
            return;
        }


        const effect =
            effects.find(
                entry =>
                    entry.uuid ===
                    result.effectUuid
            );


        if (!effect) {

            ui.notifications.warn(
                "Could not resolve the selected Active Effect."
            );

            return;
        }


        const table =
            foundry.utils.deepClone(
                game.settings.get(
                    MODULE_ID,
                    SETTING_KEY
                ) ?? {}
            );


        if (
            !table[item.name]
        ) {

            table[item.name] = {

                enabled:
                    true,
                hideRegionFromPlayers: false,

                sourceUuid:
                    item.uuid,

                triggers:
                    [],

                regionEffects:
                    []
            };
        }


        table[item.name].sourceUuid =
            item.uuid;


        table[item.name].triggers ??=
            [];


        table[item.name].regionEffects ??=
            [];


        const regionEffect = {

            id:
                existingRegionEffect?.id ??
                foundry.utils.randomID(),

            name:
                effect.name,

            effectUuid:
                effect.uuid
        };


        const existingIndex =
            table[item.name]
                .regionEffects
                .findIndex(
                    entry =>
                        entry.id ===
                        regionEffect.id
                );


        if (
            existingIndex >=
            0
        ) {

            table[item.name]
                .regionEffects[
                    existingIndex
                ] =
                    regionEffect;
        }


        else {

            table[item.name]
                .regionEffects
                .push(
                    regionEffect
                );
        }


        await game.settings.set(
            MODULE_ID,
            SETTING_KEY,
            table
        );


        ui.notifications.info(
            `${effect.name} added as a Region Effect for ${item.name}.`
        );


        this.render({
            force:
                true
        });
    }
}


// ============================================================
// REGISTER SETTINGS MENU
// ============================================================

class RegionConditionPicker extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {window:{title:"Choose Region Conditions"},position:{width:420,height:"auto"}};
    constructor(editor, name) {
        super({id:`rsa-conditions-${encodeURIComponent(name)}`});
        this.editor = editor;
        this.spellName = name;
    }
    async _renderHTML() {
        const selected = game.settings.get(MODULE_ID, SETTING_KEY)?.[this.spellName]?.regionConditions ?? [];
        const choices = Object.values(CONFIG.statusEffects).filter(status => status.id)
            .map(status => ({id:status.id,name:game.i18n.localize(status.name)}))
            .sort((a,b)=>a.name.localeCompare(b.name));
        return `<div style="padding:12px;">
            <div style="max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
                ${choices.map(status => `<label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" data-rsa-condition="${foundry.utils.escapeHTML(status.id)}" ${selected.includes(status.id)?"checked":""}>
                    ${foundry.utils.escapeHTML(status.name)}</label>`).join("")}
            </div>
            <button type="button" data-rsa-save-conditions style="margin-top:16px;width:100%;">Confirm Conditions</button>
        </div>`;
    }
    _replaceHTML(result, content) {content.innerHTML=result;}
    _onRender(context, options) {
        super._onRender(context, options);
        const button=this.element.querySelector("[data-rsa-save-conditions]");
        button.addEventListener("click", async () => {
            if (!game.user.isGM || button.disabled) return;
            button.disabled=true;
            try {
                const table=foundry.utils.deepClone(game.settings.get(MODULE_ID,SETTING_KEY) ?? {});
                if (!table[this.spellName]) {await this.close();return;}
                // Preserve saved IDs unavailable in the current system's list.
                const boxes=Array.from(this.element.querySelectorAll("[data-rsa-condition]"));
                const shown=new Set(boxes.map(box=>box.dataset.rsaCondition));
                table[this.spellName].regionConditions=[
                    ...(table[this.spellName].regionConditions ?? []).filter(id=>!shown.has(id)),
                    ...boxes.filter(box=>box.checked).map(box=>box.dataset.rsaCondition)
                ];
                await game.settings.set(MODULE_ID,SETTING_KEY,table);
                await this.close();
                this.editor.render({force:true});
                this.editor.bringToFront?.();
            } catch(err) {
                console.error("Region Spell Automation | Could not save Region conditions:",err);
                ui.notifications.error("Could not save Region conditions.");
            } finally {button.disabled=false;}
        });
    }
}
class RegionSpellConfigEditor extends RegionSpellManager {
    static DEFAULT_OPTIONS = { position: { width: 720, height: 650 } };
    constructor(manager, spellName) {
        super({ id: `rsa-edit-spell-${encodeURIComponent(spellName)}`, window: { title: `Edit ${spellName} Region Configuration` } });
        this.manager = manager;
        this.editingSpell = spellName;
    }
    render(options, legacy) {
        this.manager.render({ force: true });
        return super.render(options, legacy);
    }
}

class RegionSpellDropDialog extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "rsa-add-spell-region",
        window: { title: "Add New Spell / Feature Region" },
        position: { width: 440 }
    };

    constructor(manager) {
        super();
        this.manager = manager;
        this.busy = false;
    }

    async _renderHTML() {
        return `<div id="rsa-drop-zone" style="border:2px dashed var(--color-border-light-2);border-radius:6px;padding:28px;text-align:center;">
            <strong>Drag / Drop Spell or Feature Here</strong>
            <p>Drop a spell, player feature, or monster ability from an actor sheet, Items, or a compendium to save its Region configuration and open the editor.</p>
        </div>`;
    }

    _replaceHTML(result, content) { content.innerHTML = result; }

    _onRender(context, options) {
        super._onRender(context, options);
        const dropZone = this.element.querySelector("#rsa-drop-zone");
        dropZone.addEventListener("dragover", event => event.preventDefault());
        dropZone.addEventListener("drop", async event => {
            event.preventDefault();
            event.stopPropagation();
            if (this.busy || !game.user.isGM) return;
            this.busy = true;
            try {
                const data = foundry.applications.ux.TextEditor.getDragEventData(event);
                const item = data?.uuid ? await fromUuid(data.uuid) : null;
                if (item?.documentName !== "Item" || !["spell", "feat"].includes(item.type)) {
                    ui.notifications.warn("Please drop a spell or feature Item.");
                    return;
                }
                const table = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING_KEY) ?? {});
                table[item.name] ??= {
                    enabled:true, hideRegionFromPlayers:false,
                    triggers:[], regionEffects:[], regionConditions:[]
                };
                table[item.name].sourceUuid = item.uuid;
                await game.settings.set(MODULE_ID, SETTING_KEY, table);
                await this.close();
                let editor = this.manager.spellEditors.get(item.name);
                if (!editor) {
                    editor = new RegionSpellConfigEditor(this.manager, item.name);
                    this.manager.spellEditors.set(item.name, editor);
                }
                editor.render({force:true});
            } catch (err) {
                console.error("Region Spell Automation | Could not add dropped spell:", err);
                ui.notifications.error("Could not add the spell or feature. Check F12 console.");
            } finally { this.busy = false; }
        });
    }
}

let shortcutManager;

Hooks.on("renderCompendiumDirectory", (app, html) => {
    if (!game.user.isGM) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root || root.querySelector(".rsa-open-spell-manager")) return;
    const browser = root.querySelector(".open-compendium-browser");
    const actions = root.querySelector(".header-actions");
    if (!browser && !actions) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rsa-open-spell-manager";
    button.style.cssText = "flex:0 0 100%;width:100%;";
    button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Open Spell and Region Manager';
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (!game.user.isGM) return;
        shortcutManager ??= new RegionSpellManager();
        shortcutManager.render({ force: true });
    });
    if (browser) browser.insertAdjacentElement("afterend", button);
    else actions.append(button);
});

Hooks.once("init", () => {

    game.settings.registerMenu(
        MODULE_ID,
        "spellManager",
        {
            name:
                "Spell and Region Management",

            label:
                "Manage Spells and Regions",

            hint:
                "Configure spell, player feature, and monster ability Regions, triggers, conditions, and effects.",

            icon:
                "fa-solid fa-wand-magic-sparkles",

            type:
                RegionSpellManager,

            restricted:
                true
        }
    );


    console.log(
        "Region Spell Automation | v0.5.7 Spell Manager registered"
    );
});
