# Golden portrait art direction

These five user-provided images are the mandatory visual references for every
modular-archetype portrait generation. They are reference-only production
material; they are not runtime assets and their characters, costumes, poses,
or scenery must not be copied literally.

## Non-negotiable visual language

- Painterly anime illustration with watercolor/gouache character, visible
  brush decisions, softened pigment transitions, and lightly textured edges.
- Attractive, expressive faces are the focal point. Favor clear eye shapes,
  restrained blush, elegant planes, and stylized anatomy over pores or hard
  photoreal skin rendering.
- Treat every portrait as an observed moment from a life already in progress,
  not a roster pose. Use off-camera attention, a practical interrupted gesture,
  uneven weight, asymmetrical shoulders, and naturally displaced cloth or hair.
  Avoid direct eye contact and presentation smiles unless they are essential to
  the specific archetype's authored moment.
- Use large, readable costume masses with a few deliberate period-fantasy
  details. Ornament supports the silhouette instead of covering every surface.
- Give each portrait one bright dominant pigment family. Build variation inside
  that hue (for example scarlet, brick, rust, and madder), then keep armor,
  leather, secondary cloth, and hardware neutral or subdued. Do not split equal
  visual weight between complementary bright colors.
- Preserve an airy value range and colored midtones. Dark archetypes still need
  a readable face and torso; black must contain hue and brush variation.
- Keep the result recognizably illustrated. It must not resemble a glossy 3D
  render, a studio photograph, or heavily sharpened digital concept art.
- The five references define one shared medium across youthful, mature,
  masculine, feminine, martial, scholarly, and fantastical subjects.
- Magical archetypes wear believable late-medieval scholarly or working clothing:
  simple wool academic gowns, fitted doublets, plain mantles, linen collars, leather
  book straps, ink tools, and practical pockets. Distinguish Sorcerer, Warlock, and
  Wizard through observed behavior, source of magic, handled object, and expression.
  Do not substitute armor-like robe panels, dense filigree, ceremonial collars,
  repeated arcane embroidery, gemstone coverage, or generic caster regalia.

## Reference roles

- `golden-01-noble-knight.jpg`: youthful masculine face, clean armor masses,
  red accent hierarchy, airy outdoor value range.
- `golden-02-gothic-scholar.jpg`: feminine face treatment, dark fabric that
  retains painted variation, quiet magic, intimate character mood.
- `golden-03-luminous-fae.jpg`: luminous fantasy color, translucent material
  cues, watercolor blooms. Do not copy the exposed costume or fae anatomy.
- `golden-04-aquatic-mage.jpg`: pale-blue color harmony, soft facial rendering,
  graphic hat/hair silhouette, selective gold ornament.
- `golden-05-weathered-warden.jpg`: mature masculine structure, age and wear,
  economical armor rendering, grounded cloth and metal.

## Runtime portrait contract

- One generalized, unnamed archetype; no scenery, companion, lettering, frame,
  particles, floor, or cast shadow.
- True transparent background. Never paint a checkerboard or flat white matte.
- Portrait orientation, head-to-mid-thigh three-quarter stance, face unobscured.
- Final normalized canvas: 960 x 1280 RGBA.
- Subject alpha bounds: 82-88% canvas width and 89-94% canvas height.
- Safe margins: 5-7% clear top space, 6-9% each side, 1-3% bottom. The complete
  hair/headwear silhouette and every raised prop must sit below that top margin; nothing
  may touch or cross the top edge.
- Face height: 17-20% of canvas; eye line: 18-23% from the top.
- Props never determine subject scale. Keep the authored close portrait crop
  instead of shrinking the character to display every hem or weapon tip. A long
  scabbard, cloak, or lower garment may deliberately continue through the lower
  or outer frame when its direction, width, construction, and perspective clearly
  imply continuation. Heads, faces, hands, joints, grips, guards, pommels, and
  attachment points must remain visible and resolved. No object may intersect
  another impossibly or terminate accidentally inside the crop. Keep every body part
  inside the canvas. Where a soft cloak or garment intentionally exits a side or the
  bottom, dissolve the garment's own local pigment into alpha so the editorial
  continuation reads as painted and deliberate. Never introduce paper-white
  underpainting, pale erosion, or a white dry-brush cutoff; semi-transparent edge RGB
  must come from the adjacent cloth or material. Never use edge fading to hide rigid
  construction errors.
- An edit preserves the accepted face size and subject scale unless the request
  explicitly changes framing. Never zoom out merely to contain a new prop.
- Validate at full size and at the 120 x 145 combat-cell size on black, warm
  brown, and saturated violet backgrounds.

## Mandatory ImageGen usage

Every initial portrait call must include all five files as style references.
The prompt must name their role as `style and medium references only`,
explicitly forbid literal character/costume/background copying, and repeat the
runtime portrait contract above. Generate one archetype per call; never use a
grid. For an edit, ImageGen's five-image input cap means the edit target plus
the four references most relevant to that correction; the initial target must
already have been generated from the complete five-reference set.

Use `portrait-prompt-template.md` as the shared base and change only the
archetype-specific identity block. Record the final prompt and output path for
each accepted portrait.

## Rejection conditions

Reject an output when any of these are present:

- glossy pseudo-3D or photoreal finish;
- excessive micro-detail, etched texture, or over-designed armor;
- magical professions communicated primarily through ornate fantasy robes,
  armor-like filigree, ceremonial collars, or gemstone decoration rather than
  scholarly workwear, handled tools, and observed behavior;
- competing bright complementary colors or a generic two-tone game-skin palette;
- generic same-face beauty, expressionless stare, or incorrect age read;
- centered character-select posture, squared shoulders, camera-facing smile, or
  a gesture performed for the viewer rather than arising from the character;
- crushed black clothing, harsh white rim light, paper-white crop paint, pale eroded
  hems, white dry-brush cutoffs, white halos, or matte fringe;
- full-body framing, tiny face, clipped head/hand/joint, or an unrequested zoom;
- copied reference costume, pose, scenery, wings, ears, staff, or magic object;
- accidentally truncated, floating, fused, unsupported, or physically impossible
  equipment; deliberate editorial continuation of a long scabbard is permitted;
- text, watermark, border, checkerboard, opaque background, or fake alpha.
