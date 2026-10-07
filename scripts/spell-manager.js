// ============================================================
// Region Spell Automation
// Spell Manager
// v0.5.4
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

    static DEFAULT_OPTIONS = {

        id:
            "region-spell-manager",

        window: {
            title:
                "Region Spell Automation"
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
                .sort(
                    ([a], [b]) =>
                        a.localeCompare(b)
                );


        let spellRows =
            "";


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
                    No configured spells yet.
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
                            trigger.shareCardPerTurn
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

                        data-search-name="${searchName}"

                        style="
                            padding:12px;

                            border-bottom:
                                1px solid
                                var(--color-border-light-2);
                        "
                    >

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                justify-content:
                                    space-between;
                                gap:10px;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    align-items:center;
                                    gap:10px;
                                "
                            >

                                <input
                                    type="checkbox"

                                    class="rsa-enabled"

                                    data-spell="${encodedName}"

                                    ${
                                        config.enabled !== false
                                            ? "checked"
                                            : ""
                                    }
                                >


                                <strong
                                    style="
                                        font-size:1.08em;
                                    "
                                >
                                    ${safeName}
                                </strong>

                            </div>


                            <button
                                type="button"

                                class="rsa-delete-spell"

                                data-spell="${encodedName}"
                            >
                                <i class="fa-solid fa-trash"></i>
                                Delete Spell
                            </button>

                        </div>


                        <!-- ACTIVITY TRIGGERS -->

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

        return `
            <div
                style="
                    padding:12px;
                    height:100%;
                    overflow:auto;
                "
            >

                <!-- ======================================== -->
                <!-- DROP ZONE                                -->
                <!-- ======================================== -->

                <div
                    id="rsa-drop-zone"

                    style="
                        border:
                            2px dashed
                            var(--color-border-light-2);

                        border-radius:6px;

                        padding:28px;

                        text-align:center;

                        margin-bottom:16px;
                    "
                >

                    <strong>
                        Drag / Drop Spell Here
                    </strong>


                    <div
                        style="
                            margin-top:6px;
                            opacity:0.7;
                        "
                    >
                        Drop a spell to add an
                        Activity Trigger.
                    </div>

                </div>


                <!-- ======================================== -->
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

                        placeholder="Search configured spells..."

                        autocomplete="off"

                        style="
                            width:100%;
                        "
                    >

                </div>


                <!-- ======================================== -->
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


        // ====================================================
        // LIVE SEARCH
        // ====================================================

        const searchInput =
            root.querySelector(
                "#rsa-search"
            );


        const spellCards =
            Array.from(
                root.querySelectorAll(
                    ".rsa-spell-card"
                )
            );


        const countDisplay =
            root.querySelector(
                "#rsa-spell-count"
            );


        const noResults =
            root.querySelector(
                "#rsa-no-results"
            );


        if (
            searchInput
        ) {

            searchInput.addEventListener(
                "input",

                () => {

                    const query =
                        searchInput
                            .value
                            .trim()
                            .toLowerCase();


                    let visibleCount =
                        0;


                    for (
                        const card
                        of spellCards
                    ) {

                        const spellName =
                            card.dataset.searchName ??
                            "";


                        const matches =
                            !query ||
                            spellName.includes(
                                query
                            );


                        card.style.display =
                            matches
                                ? ""
                                : "none";


                        if (
                            matches
                        ) {

                            visibleCount++;
                        }
                    }


                    if (
                        countDisplay
                    ) {

                        if (
                            query
                        ) {

                            countDisplay.textContent =
                                `${visibleCount} / ${spellCards.length}`;
                        }

                        else {

                            countDisplay.textContent =
                                String(
                                    spellCards.length
                                );
                        }
                    }


                    if (
                        noResults
                    ) {

                        noResults.style.display =
                            (
                                query &&
                                visibleCount === 0
                            )
                                ? ""
                                : "none";
                    }
                }
            );
        }


        // ====================================================
        // DROP SPELL
        // ====================================================

        const dropZone =
            root.querySelector(
                "#rsa-drop-zone"
            );


        if (dropZone) {

            dropZone.addEventListener(
                "dragover",

                event => {

                    event.preventDefault();
                }
            );


            dropZone.addEventListener(
                "drop",

                async event => {

                    event.preventDefault();


                    const dragData =
                        foundry
                            .applications
                            .ux
                            .TextEditor
                            .getDragEventData(
                                event
                            );


                    if (!dragData?.uuid) {
                        return;
                    }


                    const item =
                        await fromUuid(
                            dragData.uuid
                        );


                    if (
                        !item ||
                        item.documentName !==
                            "Item" ||
                        item.type !==
                            "spell"
                    ) {

                        ui.notifications.warn(
                            "Please drop a spell Item."
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
        // ENABLE / DISABLE
        // ====================================================

        for (
            const checkbox
            of root.querySelectorAll(
                ".rsa-enabled"
            )
        ) {

            checkbox.addEventListener(
                "change",

                async () => {

                    const spellName =
                        decodeURIComponent(
                            checkbox.dataset.spell
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
                        checkbox.checked;


                    await game.settings.set(
                        MODULE_ID,
                        SETTING_KEY,
                        table
                    );
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
                                            "Delete Spell"
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


    // ========================================================
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
                        entry.type ===
                            "spell" &&

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


                        content: `
                            <div
                                style="
                                    display:flex;
                                    flex-direction:column;
                                    gap:12px;
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


                                    <div
                                        style="
                                            opacity:0.7;
                                            font-size:0.88em;
                                            margin-top:4px;
                                        "
                                    >
                                        When enabled, this trigger
                                        can affect each token only
                                        once during the current
                                        combat turn.
                                    </div>

                                </fieldset>


                                <fieldset>
                                    <legend>Shared Activity Card</legend>
                                    <div class="form-group">
                                        <label>Share Activity Card Per Turn</label>
                                        <div class="form-fields">
                                            <input type="checkbox" name="shareCardPerTurn"
                                                ${shareCardPerTurn ? "checked" : ""}>
                                        </div>
                                    </div>
                                    <p style="opacity:0.7;font-size:0.88em;">
                                        Add new targets to the same activity and damage cards during
                                        one combat turn instead of using the activity again.
                                        Saves and damage application remain manual. Enable Once Per
                                        Turn above to also limit each creature to one trigger.
                                        Outside combat, activities run normally.
                                    </p>
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

            shareCardPerTurn: result.shareCardPerTurn === true
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

Hooks.once("init", () => {

    game.settings.registerMenu(
        MODULE_ID,
        "spellManager",
        {
            name:
                "Region Spell Manager",

            label:
                "Manage Region Spells",

            hint:
                "Configure Region activity triggers and Active Effects.",

            icon:
                "fa-solid fa-wand-magic-sparkles",

            type:
                RegionSpellManager,

            restricted:
                true
        }
    );


    console.log(
        "Region Spell Automation | v0.5.4 Spell Manager registered"
    );
});
