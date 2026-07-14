# Generated Raster Asset Provenance

This directory preserves source masters, accepted prompt intent, reference lineage, atlas maps, and file-integrity records for the clean-room Godot game under `game/`. The production artwork is generated raster art; it is not an SVG or a derivative of the legacy game's UI.

## Approved combat UI set

The approved combat UI family is `ui-*-whitemarch-v1.png`. Its surfaces, icons, and portraits share one quiet field-folio language: deep slate and civic blue, warm ivory vellum, pale limewash, river-blue information accents, and restrained muted brass. The rendering remains high-definition oil-brush painterly 2D anime.

| Source master | Built-in output | Runtime destination | Runtime treatment |
|---|---|---|---|
| `source/ui-command-surfaces-whitemarch-v1.png` | `exec-c17c5af2-03d7-46de-8a45-c651bb9d898d.png` | `res://assets/ui/surfaces/ui-command-surfaces-whitemarch-v1.png` | Opaque 1254×1254 copy; four 627×627 scalable surface cells |
| `source/ui-action-icons-whitemarch-v1.png` | `exec-c515fff0-af4b-4073-893a-b62f23d9c014.png` | `res://assets/ui/icons/ui-action-icons-whitemarch-v1.png` | Chroma field removed to RGBA; four transparent 627×627 icon cells |
| `source/ui-combat-portraits-whitemarch-v1.png` | `exec-60cb8a2f-d1a0-4acc-b728-2d4ce3fd149a.png` | `res://assets/ui/portraits/ui-combat-portraits-whitemarch-v1.png` | Opaque 1254×1254 copy; four dedicated 627×627 portrait cells |

The icon alpha derivation sampled key `#fb02fa`. Of 1,572,516 pixels, 1,229,568 became fully transparent and 10,532 received partial edge alpha. Exact byte sizes and SHA-256 hashes for every source and runtime file are in `provenance.json`.

## Atlas maps

All three production UI masters are 2×2 atlases with equal 627×627 quadrants.

| Quadrant | Command surfaces | Action icons | Combat portraits |
|---|---|---|---|
| Top left | Deep slate-blue command dock | Turnshoe and step trail — Move | Erran Holt — company warden |
| Top right | Ivory vellum forecast field | Functional arming sword — Attack | Maud Reed — Whitewend scout |
| Bottom left | Pale limewash action/favorable field | Worn river-blue painted shield — Guard | Road brigand spearman |
| Bottom right | Slate-blue, brass-ruled commit field | Wood-and-brass sandglass — Wait/End Turn | Crossbow skirmisher |

Surface cells must be sliced independently. Choose nine-slice margins for the target control so painted corners remain intact and the quiet center stretches without placing texture behind live data.

## Reference lineage

`docs/rebuild/reference/mobile-combat-ui-generated-v1.png` is the 941×1672 generated design reference (`exec-fd0fcbca-44ab-45c6-90dc-28dbfade5409.png`). It defines composition, hierarchy, palette, painted material language, and overall cohesion. It is not a runtime asset and must not be imported, cropped, or shipped as a game texture.

- The command surfaces used that mobile composition as Image 1 for style, palette, material, and field-folio language only.
- The action icons used it as Image 1 for brushwork, palette, common lighting, and visual weight only.
- The combat portraits used `actors-whitemarch-oil-anime-v2.png` as Image 1 for identity, clothing, equipment, and quadrant order. They used the mobile composition as Image 2 for UI color, limewash fields, and brush treatment.

Every asset was produced with the built-in `image_gen.imagegen` tool. The provider/model identifier was managed by the tool and not exposed. `provenance.json` records canonical production prompts preserving the exact final accepted intent.

## Historical and style contract

- Whitemarch equipment and clothing use a Central and Northwestern European 1400–1475 material horizon: plausible iron, wood, wool, linen, leather, fastenings, wear, repair, and load-bearing construction.
- The tone is light, humane, and hopeful high fantasy rather than grimdark. Magic is authored and rule-bound; ordinary UI chrome does not glow.
- Rendering is oil-brush painterly 2D anime with visible layered brushwork, natural adult proportions, selective edges, and restrained line accents.
- No pixel art, 8-bit styling, SVG or flat-vector finish, photorealism, glossy 3D rendering, neon chrome, arbitrary crystals, generated text, logos, signatures, or watermarks.
- Runtime text, numerals, focus states, and accessibility descriptions remain native Godot content layered over quiet raster centers.

## Superseded and retained assets

`hud-panel-oil-anime-v2.png` and `action-icons-oil-anime-v2.png` are superseded for combat-UI use by the new field-folio surfaces and transparent action icons. Their source masters remain here for provenance, but their unused runtime copies were removed and must not be referenced by the redesigned combat HUD.

`actors-whitemarch-oil-anime-v2.png` and `items-whitemarch-oil-anime-v2.png` remain approved production assets for world billboards and grounded equipment imagery. The actor sheet is also the identity source for the dedicated portrait atlas.

Files matching `source/*-grounded-v1.png` remain excluded drafts and must not ship or seed future derivatives.

## Runtime rules

- Use lossless raster import, sRGB color, linear-with-mipmaps filtering for the heavily minified mobile UI, and repeat off.
- Start every atlas crop inside its exact 627×627 cell and enable filter clipping. Runtime surface crops may trim the generated presentation surround to expose a thinner role-appropriate painted rule; no crop may bleed into a neighboring cell.
- Do not bake words, numbers, status data, focus rings, or accessibility meaning into generated art.
- Do not convert any approved asset to SVG or introduce an SVG substitute.
