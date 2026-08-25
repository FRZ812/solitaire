# Workflow and QA

## Input policy

For a fresh archetype, pass these five files to built-in ImageGen:

1. `assets/golden-portrait-references/golden-01-noble-knight.jpg`
2. `assets/golden-portrait-references/golden-02-gothic-scholar.jpg`
3. `assets/golden-portrait-references/golden-03-luminous-fae.jpg`
4. `assets/golden-portrait-references/golden-04-aquatic-mage.jpg`
5. `assets/golden-portrait-references/golden-05-weathered-warden.jpg`

For an edit, use the target plus the four references most relevant to the requested
change. Label every input role in the prompt. Never let a style reference silently
become an identity, costume, pose, anatomy, or scenery reference.

The accepted Knight calibration is inspected for decision-making; do not include it
in every new portrait call because it can contaminate identities and costumes.

## Prompt construction

Start from `portrait-prompt-template.md`, then make the following concrete:

- age read, gender presentation, face structure, hair, and expression;
- one off-camera attention point or practical interrupted gesture;
- generalized archetype clothing and credible equipment;
- one memorable silhouette motif;
- one bright pigment family with lower-chroma supporting materials;
- exact framing, top/side matte clearance, and opaque chroma-matte requirement;
- anatomy, equipment, crop, and avoid constraints.

Do not add lore, a name, a companion, a second pose, or unnecessary props. Broad
shapes and facial presence matter more than filigree.

## Iteration discipline

1. Identify whether the failure is identity, pose, palette, equipment, crop, matte
   uniformity, or key separation.
2. Change only that failure class when possible.
3. Repeat locked invariants explicitly, including face size and crop.
4. Inspect the result before another edit. Reject a pass that fixes one issue by
   introducing a new structural defect.
5. Return to the last accepted source when an edit begins to drift.

Coordinate language is useful for stubborn prop placement: name screen-left versus
screen-right, overlap order, the direction from pommel to guard to scabbard, and the
intended canvas exit. Physical relationships are more reliable than vague requests
such as "move the sword."

## Visual rejection gates

Reject an output for any of the following:

- direct eye contact, presentation smile, squared roster pose, or mannequin stance;
- generic same-face beauty or an incorrect age/personality read;
- two competing bright color families or a generic red-blue game-skin palette;
- zoom drift, tiny face, unintended full-body framing, or a prop driving scale;
- malformed hands, joints, armor, weapon construction, suspension, or overlap;
- floating straps, fused objects, contradictory wind, or accidental truncation;
- glossy pseudo-3D, photoreal skin, excessive micro-detail, or crushed dark values;
- copied reference identity, costume, anatomy, prop, or scene;
- magical professions communicated mainly through ornate fantasy robes, armor-like
  filigree, ceremonial collars, or gemstone decoration instead of scholarly workwear,
  handled tools, and observed behavior;
- scenery, floor, cast shadow, halo, particles, text, UI, watermark, checkerboard,
  white background, textured/gradient matte, or matte spill on the character.

An intentional editorial crop is valid only when the object visibly continues in a
consistent direction and scale. Never crop a head, hand, joint, grip, guard, pommel,
or attachment point to conceal broken construction. Require clear key matte above and
down both sides of the full silhouette: no hair, garment, hand, weapon, or prop may
touch the top or either side. Every body part stays inside the canvas. Only a lower
garment or long downward prop may exit the horizontal bottom. Paper-white crop paint,
pale eroded hems, white dry-brush cutoffs, rim lights, and light underpainting between
character and matte are defects, not authored watercolor treatment.

## Technical matte, alpha, and geometry gates

Inspect the raw keyed source before extraction:

- source must be opaque RGB/RGBA on a uniform high-chroma matte selected opposite
  the costume palette;
- top and both side borders must contain continuous matte; only the bottom may crop;
- matte must fill gaps between hair, fingers, straps, and equipment without a white
  separation layer, spill, gradient, texture, halo, floor, or shadow;
- run `scripts/normalize-archetype-portrait.py INPUT OUTPUT --recover-chroma-matte`;
- if matte inference, source-clearance validation, or key recovery fails, regenerate
  the source rather than deleting a guessed color range.

Inspect the normalized runtime file:

- final mode must be RGBA, not RGB;
- alpha must contain both 0 and 255 rather than 255 everywhere;
- all four corners must have alpha 0;
- transparent pixels must have zero hidden RGB;
- the cutout must have a crisp legacy-style antialias band without pale fringe;
- partial-alpha pixels must inherit adjacent material color, not white or key color;
- opaque or semi-opaque pale crop paint must be rejected on black, warm brown, and
  saturated violet backgrounds, even when it resembles watercolor paper at full size;
- normalization must preserve the source alpha-bounds aspect ratio rather than
  forcing a common width and height; allow no more than 1% aspect-ratio drift;
- normalize height first to about 92%, cap width at 94%, and accept the final clean
  painted bounds only within 68-94% width and 87-94% height;
- the normalizer must report `semiTransparentVisibleRatio <= 0.03`, no more than
  64 `paleLowAlphaFringePixels`, and no more than 64 `chromaFringePixels`; raw
  light-pixel counts alone are not a rejection gate because legitimate ivory cloth
  and pale armor can occupy the crop zone;
- subject bounds and face scale must satisfy `art-direction.md`;
- the thumbnail must remain readable at 120 x 145 on black, warm brown, and
  saturated violet.

If ImageGen returns transparency, a checkerboard, white/off-white backing, or a
nonuniform backdrop, keep it only as a direction preview and regenerate with the
opaque chroma-matte contract. Do not attempt white/checker deletion; it can destroy
pale armor, hair, highlights, and clothing.

## Integration gates

Before changing imports or portrait maps:

- confirm the user accepted the exact visual version;
- confirm the final file passes alpha and geometry checks;
- use a new versioned filename;
- inspect the asset in the actual roster card, combat cell, and dossier crop;
- run focused portrait mapping/component tests and a production build when code
  references change;
- preserve unrelated worktree changes and stage only the portrait slice.
