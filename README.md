# Solitaire

A solo RPG narrative engine. AI narrator powers an open-ended fantasy game; the engine handles time, needs, healing, encounters, the codex, and inventory.

## Build target

The build produces a single self-contained `dist/index.html`. Paste its contents into a Claude artifact to run with subscription auth (the artifact pane has special access to `api.anthropic.com`). Outside the artifact pane the same code will need an API key.

## Workflow

```bash
npm install      # one-time
npm run dev      # local dev with HMR
npm run build    # produces dist/index.html (single file, paste-ready)
```

After `npm run build`, copy the contents of `dist/index.html` into a Claude artifact and you are off.

## Project layout

```
src/
├── main.jsx               # React entry
├── App.jsx                # main Solitaire component, state hooks, handlers
├── config.js              # constants (storage key, attribute keys, etc.)
├── system-prompt.js       # the narrator's instructions
├── data/
│   ├── terrains.js        # terrain table
│   ├── handcrafted-tiles.js   # the starting region
│   ├── rumored.js         # distant pre-known landmarks
│   ├── spawn-tables.js    # random encounter tables per terrain
│   └── initial-state.js   # fresh game state
├── engine/
│   ├── world.js           # tiles, sight, movement
│   ├── time.js            # clock
│   ├── needs.js           # hunger/thirst/sleep + alerts
│   ├── healing.js         # passive vitality regen + blocking conditions
│   ├── encounters.js      # rollEncounter + risk hint
│   ├── storage.js         # window.storage + localStorage fallback
│   ├── discoveries.js     # codex merge logic
│   ├── inventory.js       # inventory deltas
│   ├── attributes.js      # attribute changes
│   ├── json.js            # robust JSON extraction
│   ├── api.js             # callNarrator + state context
│   └── beat.js            # applyBeat orchestrator
└── components/
    ├── Icon.jsx
    ├── primitives.jsx     # Vital, ConditionPill, NeedBar, AttrBlock, ...
    ├── CompactHeader.jsx
    ├── MenuSheet.jsx
    ├── MapView.jsx
    ├── CodexView.jsx      # includes CodexEntry
    └── beats/
        └── BeatRender.jsx
```

## Storage

`STORAGE_KEY = "solitaire-state-v10"` (bumped any time the state shape changes; old saves wipe).
