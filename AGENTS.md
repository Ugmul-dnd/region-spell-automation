# Project instructions for future updates

## Purpose

Ugmuls 5.5e Automation extends native Foundry VTT / D&D5e activities and chat cards. Preserve the v0.7.4 performance improvements while adding features. Keep combat responsive and existing card grouping, targeting, corrections, and Undo reliable.

Follow the user's authorized scope. Proceed with routine reversible implementation and verification; do not introduce additional approval gates. A request to prepare a release package does not by itself require publishing or modifying unrelated modules.

## Start with the existing workflow

- Read the relevant feature and shared helpers before adding another implementation. Prefer the existing reaction, resource, effect-application, pending-damage, and adjustment workflows.
- Use official source-item activities, configured effects, scale values, and current resource pools. Do not substitute hard-coded die sizes when native scaling is available.
- Preserve normal advantage/disadvantage cancellation, including AC5E integration. Do not force a roll mode over another source unless the feature's rules or explicit user instructions require it.
- Keep scope within this module unless the user explicitly requests work on the website, another module, or world content.

## Chat refresh performance: required

The pre-v0.7.4 regression came from multiple feature hooks independently scanning recent messages and rebuilding overlapping cards. Do not reintroduce that pattern.

- Route resource/effect/turn-driven feature presentation refreshes through scripts/chat-refresh.js. Add a targeted rule there for new features rather than creating another recent-message refresh loop.
- Use globalThis.Ugmuls55eAutomationChatRefresh.request(featureKey, changedDocument) for supported feature refreshes and .card(card) for a specific deferred card refresh.
- Pass the changed Actor, Item, ActiveEffect, Token, or Combat document. Omit it only for deliberate broader recovery, not as the default response to every event.
- Filter by enabled setting, relevant feature/grant, ownership, card type, and affected actor or defender before requesting rendering. Handle removal of a feature or grant so obsolete buttons disappear.
- Deduplicate overlapping requests. Keep bounded batches and yield between them; do not turn the queue back into one large synchronous rendering burst. The current baseline is a 32 ms coalescing window and batches of eight cards.
- A targeted immediate render is allowed when required for a specific workflow. Explain the reason in a nearby comment. Do not globally wrap or monkey-patch ui.chat.updateMessage to enforce batching.
- Render hooks must be idempotent. Do not write actor/item/effect/chat flags or enqueue another render on every render. Any application invoked from render needs authority, pending-state checks, idempotency, and an in-flight guard.
- Keep resource validation/spending, reaction reservation, effect expiry, and roll evaluation in their authoritative workflows. Only presentation may be deferred; the queue must not permit double spending or change turn-rule timing.

## Card grouping and roll integrity: required

- Enhance native usage, attack, save, damage, and healing cards. Do not add a separate result card for a feature that fits the existing roll configuration or grouped card controls.
- Preserve system.origin, explicit damageAttackId links, recorded targets, and pending-damage session identity. Do not infer a source attack from matching totals alone or silently replace recorded targets with the current token selection.
- Render controls correctly on both standalone cards and inline .card-summary[data-message-id] groups. Avoid duplicate buttons and preserve content visibility / user permission checks.
- Damage riders belong in the initial damage configuration and dice roll when applicable, with native damage types, scaling, critical policy, and Dice So Nice sequencing.
- Post-roll adjustments preserve existing dice and cached roll modes. Do not reroll the original attack/save/damage when adding a bonus or reduction unless the feature explicitly calls for a reroll.
- A defender-specific reduction must not alter damage for unrelated targets. Retain existing single-target restrictions until a tested per-target design is implemented.
- Applied HP/effect state must respect adjustment locks. Undo must restore the appropriate correction and Apply controls. Preserve newer effect applications from other cards.

## Shared lookups and document updates

- Use linkedHpCards / isRollAdjustmentLocked in scripts/shared-activity-card.js. Do not add independent full-chat scans to each eligibility or render handler.
- Keep the linked HP-card index invalidation on message create, update, and delete. Invalidate any added cache when its dependencies change; never cache HP/Undo lock decisions as permanent values.
- Batch compatible updates to documents of the same parent when useful. Do not write unchanged flags or repeatedly update each combatant for unrelated events.
- Use the existing active-GM authority and socket validation for mutations affecting other actors. Revalidate permissions, source card, resources, and reaction availability on the authority side.
- Refund resources and reaction markers if a roll adjustment fails before committing. Canceling/previewing a dialog must not spend a use.
- Reuse native effects/statuses where provided. Preserve source actor and source message identities, non-stacking behavior, and source-turn expiry. Do not delete an entire ongoing effect merely to consume one component of its benefit.

## Verification

- For shared rendering, targeting, resource, or combat changes, run the relevant regression tests and then all available tests/*.test.mjs. Run JavaScript syntax checks and validate manifest entries for new modules.
- Tests must check behavior and work counts: one refresh per card per batch, no scan for unrelated actors, correct own/defender filtering, removed-grant cleanup, failed-render isolation, and linked-card invalidation.
- Cover original-dice preservation, cancellation, resource rollback, reaction gating, critical handling, GM/player authority, and Undo where affected. Avoid brittle wall-clock performance thresholds.
- Local tests/ and tools/ are intentionally Git-ignored and excluded from the module ZIP. Do not force-add them without a user request. If local tooling is unavailable, report the verification limit rather than claiming it passed.
- For a significant shared-performance change, compare the same large-battle scenario before/after. Use short captures, normalize different recording lengths, and distinguish sampled inclusive time from exclusive CPU cost. A browser trace does not establish server timing.
- Check Bardic Inspiration, Shield, Battle Master/Parry, reaction resets, save-mode cancellation, damage riders, and Undo in Foundry when available. Report user-confirmed checks separately from automated tests.

## Release preparation

- Keep unreleased work in CHANGELOG.md and use the user-selected development version. Do not update the website or publish merely because code changed.
- When preparing a stable release, align module.json version and pinned download URL, release notes, changelog, RELEASING.md, and the local build script.
- Run required checks before packaging. Verify the archived files match source, all manifest scripts/styles exist, release notes are included, and tests/tools/Git data are excluded.
- An AGENTS.md update is repository guidance; it does not need to ship in the Foundry runtime ZIP. Do not rebuild a verified package for documentation outside its contents.
- State whether a release is packaged locally or published. Do not claim deployment, performance gains, or in-game verification that has not occurred.
