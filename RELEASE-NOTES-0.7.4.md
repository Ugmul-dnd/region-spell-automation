# Ugmuls 5.5e Automation v0.7.4 — Performance & Parry

Smoother large-battle turn transitions, with less repeated chat-card work and Battle Master Parry on incoming damage cards.

## Performance

- Reaction and feature refreshes share a queue, combining overlapping requests so each affected card refreshes once per batch.
- Actors without the relevant feature are skipped. Own-roll and defender prompts target related cards rather than rebuilding every recent card.
- Presentation updates yield between batches of eight cards to keep the browser responsive.
- Linked damage/healing cards are indexed by their source usage for repeated roll-lock checks. Message changes invalidate the index, and HP/Undo flags remain live.
- Resource spending, effect expiry, and roll evaluation retain their existing behavior; only presentation refreshes are deferred.

A user-tested large-battle comparison showed approximately 73% less sampled time per second under this module’s functions. Long browser tasks occupied about 13% of the second recording versus 23% of the first. These are results from two separate profiled runs, not a guaranteed performance improvement for every world. Bardic Inspiration, Shield, and Battle Master workflows were confirmed working during follow-up play testing.

## Battle Master Parry

- Incoming single-target melee damage cards offer Parry when the defender has the feature, an available Reaction, and a Superiority Die.
- Roll the current Superiority Die plus the higher Strength or Dexterity modifier. Subtract the reduction from existing damage without rerolling the original dice; damage cannot fall below zero.
- One reduction is shared across damage components, rather than applied in full to each component.
- Spend one Combat Superiority use and mark the Reaction used through the existing tracker. Player requests use GM authority; failed commits restore resources.
- Already-applied damage must be undone before using Parry. Flat reaction reductions remain flat through supported critical corrections.
- Configure Parry under Automations → Unique Classes → Fighter.

## Validation and updating

- All 56 local regression test files pass; JavaScript syntax and manifest entries are checked.
- Foundry VTT 14; D&D5e minimum 6.0.5, verified 6.0.6.
- Hard-refresh GM and player browsers after updating.
