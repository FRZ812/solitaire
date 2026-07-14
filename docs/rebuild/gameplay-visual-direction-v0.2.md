# Solitaire — Clean-Room Gameplay & Visual Direction v0.2

**Status:** Accepted implementation direction for the first offline tactical slice
**Date:** 2026-07-14
**Supersedes:** the tone, presentation-resolution, UI-asset, and implementation-baseline sections of `gameplay-visual-direction-draft-v0.1.md`

## 1. Product identity

Solitaire is a mobile-first, party-based mechanical RPG built as an entirely new Godot game. The previous React/PWA and cached Godot material are research references only. Their application architecture, UI, data shape, formulas, and assets are not the implementation baseline.

The game combines deliberate tactical combat, persistent expedition consequences, characterful party play, and a luminous high-fantasy world. It must remain mechanically complete with networking and generated narration disabled.

## 2. Tone: bright high fantasy under real pressure

The world is adventurous, colorful, warm, and worth protecting. Sunlit ruins, clear rivers, market awnings, orchard walls, festival banners, painted shrines, river reflections, and welcoming company halls are the visual norm. The fantastic is exceptional and follows established rules; it does not replace believable agriculture, labor, clothing, weapons, architecture, or ecology. Danger, wounds, loss, and morally difficult choices create contrast; they do not turn every screen into grimdark misery.

The emotional target is **hopeful peril**:

- danger is serious and mechanically legible;
- recovery, companionship, mercy, and return journeys matter;
- humor, hospitality, wonder, and beauty remain present;
- horror and bleakness are local accents, not the setting's default voice;
- mature themes may exist without a mud-brown, gore-led, or nihilistic presentation.

## 3. Combat reference boundary

Stoneshard is a mechanical reference, not a visual, narrative, formula, content, or interface template.

Carry forward these principles:

- same-map exploration and combat;
- step-readable cause and effect;
- consequential positioning and retreat routes;
- injuries and conditions that outlast a fight;
- weapon families with distinct spatial behavior;
- preparation, terrain, visibility, and resources that matter;
- enemies that use coherent, inspectable tactics.

Solitaire remains original through:

- direct control of a small party and formation play;
- ally reactions, rescue, morale, parley, surrender, and capture;
- elemental terrain and high-fantasy traversal;
- forecast-before-commit mobile interaction;
- a recovery-forward company campaign;
- original terminology, formulas, abilities, enemies, maps, and progression.

The first combat tracer uses a one-command tactical pulse: the acting hero commits one meaningful action, then the deterministic timeline advances to the next actor. This keeps causality readable on a phone. The domain model must remain capable of supporting different action tempo costs later.

## 4. First mechanical tracer

The first playable encounter is a 7×9 sunlit ruined toll garden at Alder Ford, with real height, blocked cells, a collapsed wall, an overgrown osier hurdle, an abandoned cart, and broken roadside markers.

It contains:

- two directly controlled heroes with complementary roles;
- two enemies with distinct approach/attack behavior;
- grid occupancy, movement, melee range, ranged line of sight, guard, and turn order;
- deterministic hit and damage resolution from named RNG streams;
- one persistent wound or condition;
- clear preview → forecast → confirm interaction;
- event log, replay hash, save/load, restart, victory, and defeat states;
- no LLM, network, account, subscription, or legacy-state dependency.

The tracer is an architecture proof, not the claimed full scope of the RPG. It becomes the foundation for the first complete expedition loop.

## 5. Hybrid 2.5D presentation

The tactical world is actual 3D:

- orthographic three-quarter camera around 40° downward;
- fixed primary rotation for readability;
- low-poly terrain with high-definition hand-painted materials;
- real elevation, bridges, walls, props, water, shadow, fog, and lighting;
- portrait framing around seven cells wide and nine cells deep;
- stable camera behavior during decisions.

Characters and creatures are high-definition 2D billboards or directional sprites placed in the 3D world. Illustrated portraits may provide expressive close-up presentation. Character, creature, and item **design** must be realistic in anatomy, construction, wear, weight, and use. Their **rendering style** is hand-painted 2D anime with visible oil-brush texture, shaped light, confident painted edges, natural adult proportions, and restrained facial simplification. Every asset belongs to a named region and period-equivalent material culture. The art must never use deliberate pixelation, nearest-neighbor enlargement, 8-bit typography, scanlines, retro sprite constraints, flat vector rendering, or photorealistic finishing.

The target is **grounded oil-brush painterly 2D anime** with clear silhouettes: historically plausible subject design rendered through expressive brushwork. It is neither photorealistic noise nor exaggerated fantasy concept art. High-resolution source masters are exported to mobile-appropriate runtime sizes with mipmaps and texture budgets.

## 6. Raster-generated UI policy

All decorative shipped UI artwork is raster-based and generated under a consistent art direction:

- panels, frames, button skins, tabs, badges, dividers, portraits, action icons, status icons, and ornamental textures use PNG or WebP;
- no SVG UI artwork is shipped in the new `game/` project;
- assets are generated offline, reviewed, versioned, and imported like authored content;
- prompts and provenance are kept beside the asset set;
- generated images never contain interface text;
- typography, numbers, dynamic bars, focus states, layout, hit targets, and accessibility remain native Godot controls;
- panels and buttons use nine-slice textures where scaling is required;
- interactive state must never be communicated by decorative color alone.

This preserves adaptive layout, localization, text scaling, safe areas, controller focus, and screen-reader semantics while fulfilling the raster-art direction.

## 7. Visual language

### Palette

- limewash, vellum, and warm ivory reading surfaces;
- river blue and slate-blue structure;
- madder red, weld yellow, and plant-dyed green secondary accents;
- muted brass for commitment, selection, and reward;
- coral only for danger and wounds;
- deep slate-blue for legible contrast rather than near-black grimness.

### Materials

Limewashed stone, black local masonry, white mortar, wrought iron, weathered oak, ash shafts, horn, bone, leather, wool, linen, vellum, glazed ceramic, leaded glass, and restrained brass. Wear, mending, sharpening, water staining, and guild proof marks are visible. Materials outside a region's supply chain require a recorded trade source.

### Shape

Readable rectangles and clipped corners, generous spacing, clean silhouettes, restrained carved-line or guild-mark ornament around section boundaries. Avoid jeweled fantasy interfaces, glowing star motifs on ordinary gear, Gothic spikes, heavy iron cages, blood-smeared frames, faux-medieval body fonts, and dense filigree around every control.

## 8. Regional and historical grounding

The first asset kit belongs to **Whitemarch and the Whitewend basin**. Its working material-culture horizon is a fictionalized Central/Northwestern European river city around 1400–1475: established guild production, mail and brigandine, partial plate for people who can afford it, kettle hats and bascinets, arming swords, spears, polearms, yew self bows, horn/sinew crossbows, mechanically spanned heavy crossbows, wool and linen clothing, leather footwear, and civic colors applied through cloth and paint rather than glowing metal.

This is a consistency horizon, not a claim that Whitemarch is a renamed real culture. The region may combine historically compatible practices where its geography, trade, institutions, and canon explain the combination.

Every character and item asset record must identify:

- region and subculture;
- social role and wealth band;
- season and weather exposure;
- locally available and imported materials;
- construction method and repair state;
- combat or practical function;
- historical reference horizon;
- magical alteration, if any, and the rule that permits it.

An item that cannot be explained through those fields is not ready for generation or implementation.

## 9. Rule-bound magic

Magic is real, rare, learned or awakened through a defined path, and mechanically bounded.

1. **Source:** leyline awakening, patron pact, grimoire study, a master's teaching, or a specific bloodline/artifact.
2. **Known effect:** every working uses an authored ability or ritual definition; prose cannot invent a new mechanical effect.
3. **Cost:** resolve, time, materials, exposure, risk, or a combination is paid through deterministic rules.
4. **Reach and environment:** range, line of sight, target, area, and environmental feasibility are explicit. A working cannot ignore walls or create an element with no permitted source.
5. **Failure and collateral:** interruption, exhaustion, backlash, witnesses, fire spread, collapse, and friendly harm are rule outcomes where applicable.
6. **Material expression:** common workings use believable interfaces—ink, chalk, wax, vellum, metal inlay, herbs, lenses, measured geometry, spoken forms, or a prepared focus. An enchanted sword remains a functional sword.
7. **Social consequence:** conspicuous casting changes witness and faction state. Ordinary equipment does not glow merely to signal rarity.

Visual effects show the rule at work: heat distorts air and chars material; force moves dust and cloth; cold produces frost and condensation; wards follow a prepared boundary; healing changes the body over time. Arbitrary colored energy is not a substitute for causality.

## 10. Mobile screen hierarchy

The field is the hero:

- top status strip: location, objective, round, weather, and menu;
- upper 58–65%: 2.5D tactical field;
- contextual forecast card: selected actor, target, path, hit/damage range, and known risk;
- lower action tray: move, attack/ability, guard, item, and end turn;
- expandable event chronicle rather than a permanent chat column.

Core flow: **select → inspect → confirm**. Typing is never required.

## 11. Clean-room boundary

New production work lives under `game/`. It may use the old material to identify design questions, but it must not import or adapt legacy components, CSS, SVGs, pixel assets, state objects, combat formulas, or narrator-owned game logic.

The first slice explicitly defers decisions that do not block it: permanent-death rules, hosted-session timing, account services, narration pricing, and the full world atlas. Those remain separate product decisions and cannot leak into the domain kernel as hard-coded assumptions.

## 12. Immediate exit criteria

The first slice is acceptable when:

- Godot 4.7 runs it from `game/` with no dependency on the old app;
- two deterministic runs of the same command sequence produce the same events and state hash;
- the scene is visibly true 2.5D and high-definition rather than a flat SVG/pixel map;
- every decorative UI visual used by the slice is a raster asset;
- the encounter is playable by touch without typing;
- the visual tone reads as luminous high fantasy despite meaningful danger;
- headless domain tests and a visual smoke test pass.
