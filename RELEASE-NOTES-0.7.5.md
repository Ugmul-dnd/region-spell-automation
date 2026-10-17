# Ugmuls 5.5e Automation v0.7.5 — Pending Cards, Concentration & Targeting

See what players are preparing, keep the action visible while dice roll, and handle concentration checks through the existing card workflow.

## Pending casts and continuous card visibility

- Spell and feature casts publish a native Pending card before configuration, targeting, Metamagic, and template placement. The same card continues through the first roll.
- Canceling before a roll removes the pending card and refunds native cast consumption, cast-time Metamagic, and cast-owned temporary action markers. Previous concentration is preserved until the new cast commits. Completed rolls prevent later refunds.
- Initial attack cards stay visible until their result appears, including Dice So Nice delays, so the GM can follow the action without a blank interval. Duplicate attack clicks are blocked during that handoff.

## Concentration checks

- Native damage-triggered concentration challenges prompt a connected owning player, falling back to the GM. GM-run monsters follow Automatically Roll GM NPC Saves.
- Pending cards allow retry after cancellation and GM takeover. Disconnected owners fall back to the GM.
- Prompt Concentration Checks and End Concentration on Failed Checks are independent settings under Rolls & Damage / Healing.
- After visible dice animations finish, failed checks end the concentration effects recorded for that check using native cleanup. Newer concentration effects are preserved.

## Targeting and upcasting

- Direct attacks and targeted spells/features require a selected target, including healing and mark effects. Missing targets show “This requires a target before use”.
- Single-target uses reject multiple selected targets with “This requires a single target before use”. This check runs after native upcast scaling and before resources are spent.
- Spells allowing several targets accept smaller groups. Self-targeted abilities and area/template spells retain their normal targeting flow.
- Automatic buffs recognize Willing Creature targets, so upcast Fly and similar effects reach each recorded willing recipient. Caster-token lookup also falls back to usage and recorded targets.

## Dice So Nice integration

Switching tabs, minimizing, or losing focus during an animation no longer leaves this module’s evaluated roll workflow waiting for that client to reactivate. Inactive-client waits release even when focus changes mid-animation; active clients still wait for their animations normally.

This integration fix ships with **Ugmuls 5.5e Automation** and runs on connected GM and player clients. It does not modify Dice So Nice itself or change numerical dice results.

- Grouped saving-throw cards refresh when animations finish, clearing stale Pending rows even when saves have no standalone chat element.

## Shared spell Region fixes

- An initially empty shared area, such as Spirit Guardians, waits for its first recorded target before prompting the caster for damage, with GM fallback. Later targets reuse the existing roll.
- The regular Damage action reuses an unresolved Pending damage card instead of leaving a separate placeholder behind. Older dialogs cannot submit after takeover.
- Targets added while the damage dialog is open remain recorded when the result is published.

## Required modules

**Automated Conditions 5e and Dice So Nice! are now required.** Install and enable both before enabling Ugmuls 5.5e Automation. The module manifest declares these dependencies and provides their installation URLs. A test world without Dice So Nice exposed a damage-card update failure; that configuration is not supported in this release.

## Updating and verification

- Tested with Foundry VTT 14 and D&D5e 6.0.6; the manifest retains D&D5e 6.0.5 as its minimum.
- All 63 local regression test files and JavaScript syntax checks pass.
- Live follow-up testing confirmed concentration timing, target guards, grouped saves, upcast Fly, and the initially empty Spirit Guardians workflow. Background-window handling has automated regression coverage.
- **Hard-refresh all connected GM and player browsers after updating.**
