---
name: worldbuilding
description: Design and extend Solitaire's light high-fantasy regions, cultures, factions, characters, material culture, magic, encounters, and lore while preserving historical grounding and deterministic mechanical authority.
---

# Worldbuilding

Read `docs/product/vision.md` and `docs/WORLDBUILDING.md` first. Read
`docs/MAP_REBUILD_V3.md` when placing content and `docs/design/combat-deck.md`
when content affects encounters, cards, equipment, wounds, or rewards.

## Non-negotiable direction

- Light high fantasy, not grimdark.
- Serious danger is balanced by wonder, fellowship, craft, humor, and recovery.
- Cultures are internally varied and historically informed, not species-wide
  stereotypes or aesthetic collages.
- Characters and objects have plausible regions, materials, occupations,
  construction, upkeep, and access.
- Magic declares source, preparation, cost, scope, duration, tell, resistance,
  and aftermath.
- Generated narration may phrase established facts; it cannot create canon or
  mechanical outcomes.

## Workflow

1. State the content's campaign purpose and player-facing choice.
2. Choose historical/material references and document deliberate changes.
3. Place it in an existing region and community before adding new geography.
4. Define concrete people, work, resources, trade, institutions, and conflicts.
5. Connect mechanical effects only through reviewed ids and schemas.
6. Check tone, agency, cultural specificity, magic rules, and content boundaries.
7. Update the canonical world document only when a setting-wide ruling changes.
8. Run relevant data tests and `npm run build`.

Do not restore retired grimdark rulings, universal racial hostility, slavery as a
setting pillar, or the old tier ladder merely because they remain in legacy code
or Git history.

## References

- `reference/canon.md` — current high-level setting authority.
- `reference/data-model.md` — content ownership and validation boundaries.
- `../map-creation/` — canonical region and place authoring guidance.
