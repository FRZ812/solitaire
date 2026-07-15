# Browser runtime architecture

Status: **canonical technical direction**

Migration note: this document defines the target boundary. Card-combat v1 has a
serializable seeded pile shuffle, but its inherited hit, critical, morale,
escape, intent tie-breaking, and loot rolls are not yet replay-stable. The app
must not advertise full deterministic replay until those paths use named streams.

## Decision

The production client is a tailored React/Vite web application. It uses browser
APIs directly and does not ship Godot, an embedded iframe game, or a generic
engine runtime. Presentation may use DOM/CSS, Canvas 2D, and narrowly selected
WebGL effects behind small adapters.

## Authority boundary

Canonical state changes follow one path:

```text
input or AI intent
      -> command validation
      -> deterministic rules + named RNG stream
      -> canonical events
      -> event application
      -> new state + replay hash
```

React renders a projection of state and dispatches commands. It must not repair,
infer, or directly mutate mechanical state. Animation consumes events after they
exist; it never becomes the event source.

## Layers

### Mechanics

Pure or explicitly stateful modules under `src/engine/` own combat, campaign
time, travel, inventory, conditions, relationships, and persistence migrations.
Rules receive serializable data and return serializable events or validation
errors.

### Content

`src/data/` owns versioned cards, enemies, items, regions, encounters, and text
keys. Content is data, not executable model output. Generated proposals enter the
repository only after schema validation and human review.

### Presentation

React components under `src/components/` own layout, accessibility, input, and
event-driven animation. High-definition 2.5D scenes are composed from layered
raster art, depth metadata, lighting, parallax, and optional canvas effects.

### Services

Supabase provides authentication, campaign persistence, and server-side service
boundaries. The complete mechanical loop remains runnable offline. Network
failures may delay sync or narration; they cannot block a legal local command.

## Commands and events

A command identifies its type, actor, payload, expected state revision, and
client-generated id. Validation checks phase, ownership, targets, costs, and
prerequisites before any random draw.

An event identifies its type, sequence, command id, rules version, payload, and
optional RNG evidence. Events are the audit log. State is a versioned snapshot
obtained by applying them in order.

Duplicate command ids are idempotent. Invalid commands return structured errors
and emit no partial mechanical events.

## Determinism and saves

- Randomness is accessed only through named streams such as `combat`, `loot`,
  `travel`, and `world`.
- A replay stores the initial snapshot, content/rules versions, seed manifest,
  commands, and resulting state hashes.
- Save snapshots carry schema and rules versions and migrate forward through
  tested, explicit functions.
- Autosave occurs at command boundaries, never halfway through event application.

## Bounded narration

The language model receives a projection of approved facts and recent canonical
events. It may return prose, dialogue options, or a proposal that references
known ids. It may not submit health totals, loot, movement, card effects, quest
completion, relationship changes, or other state mutations.

Narration is asynchronous, optional, cacheable, and replaceable with authored
fallback text. Provider keys remain server-side.

## Testing and delivery

- Unit-test rules, card/status timing, validation, migrations, and data schemas.
- Golden replay tests assert event sequences and final hashes.
- Component tests verify that previews and controls match legal commands.
- `npm test` is the local and CI mechanical gate.
- `npm run build` creates the Vite artifact deployed from `main` to GitHub Pages.

Legacy modules may remain while the rebuild proceeds, but new work must follow
this boundary. A legacy subsystem becomes guidance once its replacement passes
parity and replay tests; it does not define the new architecture.
