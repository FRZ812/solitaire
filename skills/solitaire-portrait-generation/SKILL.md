---
name: solitaire-portrait-generation
description: Create, edit, or review modular archetype portraits for the Solitaire game using its golden watercolor-gouache anime references, candid lived-in posing, single-accent palettes, credible equipment, intentional crop rules, and combat-cell alpha QA. Use for Solitaire character portraits and portrait cutouts, not combat VFX, ability art, icons, backgrounds, or general UI.
---

# Solitaire Portrait Generation

Create portraits that feel like illustrated people caught during their lives, not
generic roster skins. This skill supplies Solitaire-specific art direction and QA;
use the installed `imagegen` skill for the actual raster generation or edit.

## Required resources

Before generating or editing, read completely:

- [references/art-direction.md](references/art-direction.md)
- [references/portrait-prompt-template.md](references/portrait-prompt-template.md)
- [references/workflow-and-qa.md](references/workflow-and-qa.md)

For composition calibration, inspect
[references/accepted-knight-calibration.md](references/accepted-knight-calibration.md)
and its linked image. The calibration image is reference-only and has fake alpha;
never ship or normalize it as a runtime asset.

The five source images in `assets/golden-portrait-references/` are the mandatory
style references. They establish medium, tone, facial treatment, and natural
presence. Never copy their identities, costumes, poses, anatomy, or scenery.

## Choose the operation

### New portrait

- Use all five golden references in one built-in ImageGen call.
- Generate one archetype per call. Never use a grid, contact sheet, or multi-subject
  composition.
- Author a distinct generalized archetype identity and one practical observed
  moment. Do not depict a named lore character.
- Ask for genuine transparent alpha, close head-to-mid-thigh framing, and the
  runtime geometry in the art-direction reference.

### Edit an accepted direction

- Inspect the local target first.
- Use the target plus no more than four relevant golden references.
- State every invariant that must remain unchanged. Make one coherent correction
  per pass.
- Preserve accepted face size, crop, pose, identity, and palette unless the user
  explicitly changes them. Never zoom out merely to contain a prop.
- If iterative edits drift, restart from the last user-approved source rather than
  editing the drifted result again.

### Review only

- Do not generate or modify an image.
- Apply the hard rejection and technical QA gates in the workflow reference.
- Separate art-direction approval from runtime readiness.

## Non-negotiable portrait grammar

- The subject is observed mid-life: off-camera attention, an interrupted practical
  gesture, uneven weight, and natural asymmetry. Avoid camera-facing presentation
  smiles and squared character-select posture.
- Give the portrait one bright primary pigment family. Supporting armor, leather,
  cloth, and hardware stay neutral or subdued; avoid equal complementary colors.
- Treat anatomy, equipment construction, suspension, gravity, wind, and overlap
  order as hard correctness requirements.
- Ground magical archetypes in credible scholarly and working dress: wool gowns,
  fitted doublets, plain mantles, linen, leather book straps, ink, and practical
  pockets. Let vocation read through behavior, books, instruments, and one restrained
  magical tell, not armor-like filigree, ceremonial collars, gemstone coverage, or
  generic ornamental RPG robes.
- Long scabbards, cloaks, and lower garments may deliberately continue beyond the
  lower or outer crop when their direction and perspective make continuation clear.
  Heads, hands, joints, grips, guards, pommels, and attachment points may not be
  accidentally clipped or concealed.
- Preserve clear negative space above the complete silhouette. Hair, headwear, weapons,
  raised hands, and other hard forms may never touch or exit the top edge. Keep every
  body part inside the canvas. The lower body may pass behind the combat HUD, and soft
  cloaks or garments may continue through a side or bottom edge.
- Where soft cloth deliberately exits a side or lower crop, dissolve its pigment with a
  sparse paper-white watercolor dry-brush transition into alpha, matching the approved
  Knight calibration. This is an intentional painted edge, not a white matte around the
  whole cutout. Never use edge fading to conceal broken anatomy or equipment.
- Ability effects, particles, scenery, frames, text, and UI never belong in a
  reusable portrait cutout.

## Acceptance and integration

Do not copy or wire an output into the game until the user accepts its art direction
and it passes technical QA. A visible checkerboard in an opaque RGB file is fake
transparency and fails immediately.

For an accepted, validated asset:

- preserve the raw generated source and exact prompt;
- create a new versioned file rather than overwriting an accepted portrait;
- normalize the final to 960 x 1280 RGBA only after real alpha is confirmed;
- save under `src/assets/generated/archetypes/portraits/` using
  `<archetype>-portrait-vN.png`;
- validate at full resolution and at 120 x 145 on dark backgrounds;
- report the built-in ImageGen mode, exact prompt, raw path, final workspace path,
  and QA outcome.
