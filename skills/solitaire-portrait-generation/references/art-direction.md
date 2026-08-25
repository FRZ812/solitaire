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
- Raw ImageGen source uses one perfectly uniform opaque high-chroma matte selected
  opposite the character palette. Never ask ImageGen for alpha, a checkerboard, or
  a white/off-white background. The normalized runtime asset is true RGBA.
- Portrait orientation, head-to-mid-thigh three-quarter stance, face unobscured.
- Final normalized canvas: 960 x 1280 RGBA.
- Preserve the accepted source silhouette's aspect ratio. Normalize height first to
  about 92% of the canvas and cap width at 94%; never force width and height to fixed
  values independently. A narrow Sorcerer and a broad armored Artificer must not be
  stretched into the same box.
- Subject alpha bounds after the clean lower-HUD fade: 68-94% canvas width and
  87-94% canvas height. Width varies naturally with the authored silhouette.
- Safe margins: 5-7% clear top space, approximately 3-16% each side according to
  the preserved aspect ratio, and 5-7% bottom after the HUD fade. Raw sources must
  contain uninterrupted matte above and along both sides. The complete
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
  inside the canvas. No hair, cloth, anatomy, weapon, or prop may exit a top or side
  edge; only lower clothing or a long downward prop may continue through the horizontal
  bottom crop. Character pigment must meet the chroma matte directly with no generated
  paper-white underpainting, pale erosion, dry-brush cutoff, rim light, glow, or halo.
  The extraction step supplies alpha and decontaminates both pale and keyed fringe.
- An edit preserves the accepted face size and subject scale unless the request
  explicitly changes framing. Never zoom out merely to contain a new prop.
- Validate at full size and at the 120 x 145 combat-cell size on black, warm
  brown, and saturated violet backgrounds.
- Match the legacy cutout edge: partial-alpha pixels should be a narrow antialias
  band rather than a broad watercolor haze. Semi-transparent pixels must remain at
  or below 3% of visible pixels, with no more than 64 pale low-alpha fringe pixels
  and no more than 64 residual keyed-hue fringe pixels.

## Mandatory ImageGen usage

Every initial portrait call must include all five files as style references.
The prompt must name their role as `style and medium references only`,
explicitly forbid literal character/costume/background copying, and repeat the
runtime portrait contract above. It must request an opaque uniform chroma matte,
not transparency, and must reserve visible matte above and down both sides. Generate
one archetype per call; never use a grid. For an edit, ImageGen's five-image input cap means the edit target plus
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
  equipment; deliberate continuation of a long scabbard through the bottom is permitted;
- text, watermark, border, checkerboard, white/off-white background, nonuniform
  matte, missing top/side matte clearance, or matte-colored spill on the subject.
