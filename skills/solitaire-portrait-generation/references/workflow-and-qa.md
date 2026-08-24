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
- exact framing, safety margins, and transparent-background requirement;
- anatomy, equipment, crop, and avoid constraints.

Do not add lore, a name, a companion, a second pose, or unnecessary props. Broad
shapes and facial presence matter more than filigree.

## Iteration discipline

1. Identify whether the failure is identity, pose, palette, equipment, crop, or
   transparency.
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
- background, floor, cast shadow, halo, particles, text, UI, or watermark.

An intentional editorial crop is valid only when the object visibly continues in a
consistent direction and scale. Never crop a head, hand, joint, grip, guard, pommel,
or attachment point to conceal broken construction. Require clear negative space above
the full silhouette: no hair, headwear, hand, weapon, or prop may touch the top edge.
Every body part stays inside the canvas. A soft cloak or garment may exit a side or the
bottom only by dissolving its own local material pigment into alpha. Paper-white crop
paint, pale eroded hems, white dry-brush cutoffs, and light underpainting at the alpha
boundary are defects, not authored watercolor treatment.

## Technical alpha and geometry gates

An apparent checkerboard is not evidence of transparency. Inspect the encoded file:

- final mode must be RGBA, not RGB;
- alpha must contain both 0 and 255 rather than 255 everywhere;
- all four corners must have alpha 0;
- transparent pixels should not retain a white or checker-colored matte;
- the cutout must have clean antialiasing without pale fringe;
- side and bottom crop dissolves must preserve adjacent material color at partial alpha;
- opaque or semi-opaque pale crop paint must be rejected on black, warm brown, and
  saturated violet backgrounds, even when it resembles watercolor paper at full size;
- the normalizer must report no more than 256 suspect paper-white crop pixels;
- subject bounds and face scale must satisfy `art-direction.md`;
- the thumbnail must remain readable at 120 x 145 on black, warm brown, and
  saturated violet.

If built-in ImageGen returns opaque checker pixels:

1. keep it only as a direction preview;
2. do not copy, normalize, or wire it into the game;
3. after the art direction is accepted, one targeted built-in background-extraction
   edit may be attempted;
4. if that also returns opaque output, stop and report the limitation;
5. do not silently use checker-color deletion or another matte-recovery process,
   because pale armor, hair, and highlights can be destroyed. Obtain user approval
   before any non-ImageGen recovery.

## Integration gates

Before changing imports or portrait maps:

- confirm the user accepted the exact visual version;
- confirm the final file passes alpha and geometry checks;
- use a new versioned filename;
- inspect the asset in the actual roster card, combat cell, and dossier crop;
- run focused portrait mapping/component tests and a production build when code
  references change;
- preserve unrelated worktree changes and stage only the portrait slice.
