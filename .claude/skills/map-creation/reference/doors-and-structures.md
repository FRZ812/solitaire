# Doors, sealed structures, and the build pipeline

Source of truth: `src/data/handcrafted-pipeline.js` (`buildHandcrafted`) and
`src/engine/world.js` (`edgeAllowed`, `findPath`). The pipeline runs on **every**
map load and after every save, so you author *inputs* and it derives the final
door graph.

## The door rule (engine side)

```js
hasDoorTo(tile, x, y) = !tile.doors  ||  tile.doors.includes({x,y})
edgeAllowed(A, B)     = hasDoorTo(A, B) && hasDoorTo(B, A)   // BOTH ends must permit
```

- **No `doors` field → default open**: all six neighbours are passable. Correct
  for wilderness and open settlement squares.
- **A `doors` array → closed except those listed.** List every neighbour the hex
  should connect to.
- Because both ends must agree, forgetting to add A to B's list reads as
  "no entry" (safe) rather than "free entry". Still, **author both sides**.
- `water` is impassable regardless of doors. Walls are passable *along their
  length* only where the door graph connects them (stairs, gatehouses).

## Two ways to author access

### A) Per-tile `doors` (direct)
Set `doors: [{x,y}, …]` on the tile yourself. Full control; you own correctness.
Best for small/irregular interiors and for gates that open to a specific exterior
hex. The auditor checks adjacency, existence, symmetry, and reachability.

### B) `sealed_structures` entry (pipeline-derived)
Describe the structure at a high level and let `buildHandcrafted` compute doors.
Three shapes — pick the one that matches your structure:

#### 1. Streets + buildings (a settlement/compound with lanes)
```js
{
  name: "The Caravanserai",
  streets:   [{x,y}, …],     // open ground that meshes with all adjacent interior
  buildings: [{x,y}, …],     // each meshes to adjacent STREETS (or set door/doors)
  gates:     [[{inside},{outside}], …],   // adjacent pair: a member hex ↔ exterior hex
}
```
- Streets mesh with every adjacent interior hex (streets ∪ buildings).
- A building defaults to doors onto its adjacent streets. Override per-building
  with `door: {x,y}` (single) or `doors: [{x,y},…]` (must be adjacent members).
- A coord can't be both a street and a building (pipeline throws).

#### 2. Interior + gates (a sealed dungeon/keep — rooms mesh together)
```js
{
  name: "Goblin Warren",
  threshold: [{x,y}, …],     // optional named entrances
  interior:  [{x,y}, …],     // every room; each meshes to adjacent threshold/interior
  gates:     [[{inside},{outside}], …],
}
```
All interior hexes door to their adjacent interior/threshold members, plus any
gate. **The gate's `inside` hex must be in `interior`/`threshold`** or the
structure seals shut (`STRUCT_NO_ENTRANCE`).

#### 3. Links + entry/outside (explicit room-to-room graph)
```js
{
  name: "Smuggler's Cut",
  links:   [[{a},{b}], …],   // each pair becomes a bidirectional door (must be adjacent)
  entry:   {x,y},            // the interior hex you come in at
  outside: {x,y},            // the exterior hex entry opens to (should be a street/road)
}
```
The pipeline verifies every member is reachable from `entry` (throws otherwise),
and warns if `outside` isn't a street/road/settlement hex.

## Gates — the pattern that actually works

A gate is a **non-wall** hex (`terrain: "settlement"` or `"indoor"`,
`poi.type: "gate"`) that is a **member** of the structure, with a door pointing
*through* the wall ring to the exterior approach. Put the pair in `gates`:
`[{inside: the gate hex}, {outside: the approach hex}]`. Do **not** try to make a
`wall` tile the opening — walls auto-seal.

## Wall auto-seal (what the pipeline does to `wall` tiles)

`runWallAutoSeal` runs last. For every `wall` tile:
- **No authored `doors`:** it computes them — opens to adjacent `wall` tiles
  (so the wall-walk is continuous), to any neighbour whose own `doors` already
  point at this wall (reciprocating gatehouse bridges), and — if the wall is a
  stair (`poi.type: "stair"`) — to every defined neighbour (so the stair descends
  onto whatever's at its foot). Procedural neighbours are never opened.
- **Authored `doors`:** kept, but entries pointing at procedural (undefined)
  neighbours are pruned — a procedural hex never opens a wall.

So: author walls with `doors: undefined` and let the seal compute them. To make a
stair down off the wall, set `poi.type: "stair"` on the wall hex. The wall
generator that used to auto-grow perimeter rings is **disabled** — paint walls by
hand.

## Worked example — a small sealed tower (5 hexes)

A hermit's tower: threshold door at the base, two interior floors, a sealed
sanctum. Using shape #2 (interior + gates):

```js
// tiles
"30,10": { terrain:"settlement", poi:{type:"gate", name:"Tower Door",
            parent:"hermit-tower", parentName:"Hermit's Tower", part:"door", partName:"Tower Door"} },
"30,9":  { terrain:"indoor", poi:{type:"hall", name:"Ground Floor",
            parent:"hermit-tower", parentName:"Hermit's Tower", part:"ground", partName:"Ground Floor"} },
"31,8":  { terrain:"indoor", poi:{type:"hall", name:"Upper Floor",
            parent:"hermit-tower", parentName:"Hermit's Tower", part:"upper", partName:"Upper Floor"} },
"31,7":  { terrain:"indoor", poi:{type:"vault", name:"Sanctum",
            parent:"hermit-tower", parentName:"Hermit's Tower", part:"sanctum", partName:"Sanctum"} },
// (30,9)-(31,8) are adjacent? check: (30,9) neighbours include (31,8). yes.

// sealed_structures entry
{
  name: "Hermit's Tower",
  interior: [ {x:30,y:10}, {x:30,y:9}, {x:31,y:8}, {x:31,y:7} ],
  gates:    [ [ {x:30,y:10}, {x:30,y:11} ] ],   // door out to the hillside at (30,11)
}
```

The pipeline meshes each interior hex to its adjacent members and opens the gate
at (30,10)→(30,11). Run `map-audit` to confirm: no `NO_DOORS`, structure
reachable, sanctum reachable, every door adjacent. **The boss/sanctum (31,7) ends
with a single door back to (31,8)** — exactly Ruling 2's "boss is never at the
threshold".

## Verify, always

After authoring, dump `{ tiles, sealed_structures }` and run:
```bash
node .claude/skills/map-audit/audit-map.mjs /tmp/dump.json --biomes
```
Fix every ERROR, then `npm run build`. The build is sensitive to data shape; a
green build + a clean audit means the door graph is internally consistent.
