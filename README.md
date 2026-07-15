# Solitaire

Solitaire is a browser-native, mechanics-first role-playing game under active
rebuild. It combines a persistent high-fantasy campaign with mechanical
deck combat, regional exploration, survival pressures, equipment, companions,
and bounded AI narration.

This is a new game. The older narrative prototype and earlier engine spikes are
design research, not a code or product baseline.

## Direction

- Light, adventurous high fantasy rather than grimdark.
- Characters, clothing, weapons, tools, and settlements grounded in historical
  regions and believable material culture.
- Rule-bound magic with visible costs, limits, and counterplay.
- Slay-the-Spire-like deck vocabulary for combat: draw, hand, energy, discard,
  exhaust, statuses, and visible enemy intents.
- High-definition 2.5D scenes with oil-brush painterly 2D anime art.
- Generated raster UI art instead of an SVG- or pixel-art-led interface.
- A tailored React/Vite runtime; no Godot dependency or embedded game engine.

The product, combat, and runtime authorities are:

- [Product vision](docs/product/vision.md)
- [Deck-combat design](docs/design/combat-deck.md)
- [Browser runtime](docs/architecture/runtime.md)
- [Worldbuilding rules](docs/WORLDBUILDING.md)
- [World and place model](docs/MAP_REBUILD_V3.md)

## Stack

- React 18 for application and interface composition.
- Vite for development and production builds.
- Plain JavaScript mechanics under `src/engine/`.
- Version-controlled content under `src/data/`.
- Supabase for authentication, campaign persistence, and server-side narration.
- Vitest for rules, contracts, and regression tests.

## Local workflow

Node.js 20.19 or newer is required.

```bash
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`npm run build` writes the production site to `dist/`. GitHub Actions runs the
test and build gates, then deploys `dist/` from `main` to GitHub Pages.

## Configuration

The browser client expects:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

These are public client identifiers. Private provider credentials remain in
server-side environment configuration and must never be committed.

## Repository layout

```text
src/
  components/       React screens and presentation
  data/             authored and generated game content
  engine/           mechanical rules and state transitions
  assets/           raster art used by the browser runtime
supabase/functions/ server-side narration and authenticated integrations
docs/               current design and architecture authorities
public/             static web assets
scripts/            build and content tooling
```

## Mechanical authority

Consequential outcomes follow `command -> rules -> events -> state`. Rendering,
narration, and generated content may explain or propose actions, but they do not
directly mutate canonical campaign state. New mechanics require explicit rule
tests; random systems migrate to serializable seeded streams before replay is
advertised as a supported feature.
