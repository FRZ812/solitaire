# Solitaire — Raster Art Pipeline v0.1

**Applies to:** the clean-room Godot game under `game/`
**Runtime generation:** prohibited
**Vector UI artwork:** prohibited in shipped game assets

## Source and runtime policy

1. Generate or paint a high-resolution source master in the approved oil-brush painterly 2D anime style.
2. Review composition, silhouette, palette, edge quality, and originality.
3. Preserve the final generation prompt and asset role in `game/assets/generated/provenance.json`.
4. Export PNG for alpha-sensitive assets and WebP/PNG for opaque plates.
5. Produce runtime variants only when mobile memory or atlas packing requires them.
6. Import with filtering and mipmaps enabled for high-definition art; never use nearest-neighbor filtering.
7. Validate the result at phone scale, 100% UI scale, and at least one accessibility text scale.

## Minimal proof set

The first tactical slice uses:

| Asset | Source intent | Runtime use |
|---|---|---|
| `ui-command-surfaces-whitemarch-v1.png` | one coherent field-folio family: slate command dock, vellum forecast, limewash action surface, brass-ruled commit surface | generated nine-slice combat panels and button skins |
| `ui-action-icons-whitemarch-v1.png` | transparent late-medieval turnshoe, arming sword, painted shield, and sandglass; no baked tiles | move, attack, guard, and wait controls |
| `ui-combat-portraits-whitemarch-v1.png` | matching oil-painted head-and-shoulder portraits of the four tracer combatants | acting-unit context rail and chronicle |
| `actors-whitemarch-oil-anime-v2.png`, top left | Erran Holt, company warden in a gambeson, short mail, kettle hat, with an ash spear and painted shield | 2D billboard in 3D field |
| `actors-whitemarch-oil-anime-v2.png`, top right | Maud Reed, Whitewend river scout in wool and linen travel layers with a yew bow | 2D billboard in 3D field |
| `actors-whitemarch-oil-anime-v2.png`, bottom left | Tavin Croft, road brigand in patched wool and an aging jack with a plain spear | 2D billboard in 3D field |
| `actors-whitemarch-oil-anime-v2.png`, bottom right | Odo Pell, road crossbow skirmisher with a practical bow, bolt case, and spanning tool | 2D billboard in 3D field |

## Layout and slicing

- Surface sheet: 2×2 equal cells; preserve the outer painted edge of each cell as an unstretched nine-slice border and keep its reading center quiet.
- Icon sheet: 2×2 equal cells, centered transparent subjects, at least 18% clear padding, common lighting and visual weight, no baked button tile.
- Portrait sheet: 2×2 equal cells, common crop, eye line, scale, background, and light direction.
- Billboard character: full body, centered, feet aligned to a common baseline, generous outer padding, no cast shadow baked outside the silhouette.
- Generated text, letters, numbers, logos, watermarks, and trademarks are forbidden.

## Material-culture requirements

Before generation, every character and item prompt must state region, role, wealth, season, plausible material, construction, wear/repair, an approximate historical reference horizon, and the required **oil-brush painterly 2D anime** rendering style. Fantasy additions require an authored mechanical rule and must not erase the object's ordinary construction or use.

For the first Whitemarch kit:

- working horizon: Central/Northwestern European, approximately 1400–1475;
- clothing: layered wool and linen, leather belts and turnshoes/boots, practical hoods and caps;
- common protection: quilted jacks/gambesons, mail collars or shirts, simple helmets;
- professional protection: brigandine or partial plate over textiles, not universal full plate;
- weapons: ash-shaft spears, arming swords, knives, polearms, yew bows, composite or early steel crossbows with credible spanning equipment;
- ornament: cloth colors, painted badges, rivet patterns, maker/guild marks, restrained brass;
- forbidden defaults: glowing crystals, enormous pauldrons, implausibly thin armor, gem-encrusted field weapons, decorative blades that cannot cut or thrust, and generic fantasy leather armor.

## Rendering-style contract

- 2D anime draftsmanship with natural adult proportions and readable expressions;
- visible oil-brush texture and layered painted color, especially in cloth, skin, wood, and landscape;
- shaped values and selective edge detail rather than photographic microtexture;
- restrained line work: painted edges may carry a dark accent, but no heavy cartoon outline around every form;
- regionally plausible colors and materials remain recognizable through the stylization;
- no chibi anatomy, glossy 3D render look, airbrushed mobile-ad finish, flat vector art, photorealistic skin, or generic high-saturation fantasy costume.

## Palette anchors

- Pearl: `#FFF8E7`
- River blue: `#5E89A6`
- Slate blue: `#405A70`
- Plant green: `#70845C`
- Madder red: `#9B4F43`
- Muted brass: `#B58A44`
- Coral danger: `#E66B65`
- Deep contrast: `#25345D`

## Godot import expectations

- Filtering: linear.
- Mipmaps: enabled for 3D billboards and any texture that scales down materially.
- Repeat: disabled for icons and portraits; enabled only for intentionally tileable surfaces.
- Compression: lossless for crisp UI and alpha silhouettes; GPU/mobile compression may be evaluated after visual approval.
- Raster text: never.
- SVG import: never.

## Acceptance checks

- No shipped UI scene references `.svg`.
- No `image-rendering: pixelated` equivalent or nearest-neighbor texture filtering.
- Nine-slice corners do not distort at supported portrait widths.
- Every icon remains identifiable at its smallest runtime size with its label hidden.
- Characters remain distinct in silhouette and role at default camera zoom.
- Asset provenance matches every generated file used by the slice.

## Historical anchors for the first kit

- Metropolitan Museum of Art, “Arms and Armor in Medieval Europe”: https://www.metmuseum.org/essays/arms-and-armor-in-medieval-europe
- Metropolitan Museum of Art, Central European crossbow, ca. 1425–1475: https://www.metmuseum.org/art/collection/search/23336
- Metropolitan Museum of Art, brigandine armor, ca. 1400 and later: https://www.metmuseum.org/art/collection/search/23080
- Metropolitan Museum of Art, Central European crossbow bolt, probably 15th century: https://www.metmuseum.org/art/collection/search/33755
