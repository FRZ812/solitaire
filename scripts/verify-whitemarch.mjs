// Throwaway verifier for the Whitemarch rebuild. Exercises the REAL engine
// (findPath / edgeAllowed / getTile) against the REAL data so the wall + gate
// + high-wall + streets-vs-buildings partition is proven, not assumed.
// Run: node scripts/verify-whitemarch.mjs
import { HANDCRAFTED } from "../src/data/handcrafted-tiles.js";
import { getTile, findPath, edgeAllowed, isPassable } from "../src/engine/world.js";

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

// A state where everything in a generous box is "seen" so findPath can route
// freely — the ONLY thing that should stop it is the doors graph (the walls).
const seen = {};
for (let x = -14; x <= 14; x++) for (let y = -14; y <= 14; y++) seen[`${x},${y}`] = true;
const state = { world: { tiles: {}, currentTile: { x: 0, y: 0 }, seen } };

const k = (c) => `${c.x},${c.y}`;
const tile = (c) => getTile(state, c.x, c.y);

// Authored hex partitions. "Interior" = walkable city ground BEHIND the
// wall (streets + buildings + gate complex). "Wall-top" hexes are the
// walkway on top of the wall — passable, but isolated from city streets
// except via stairs (handled separately). Wall faces and water are
// impassable; the road approach is outside the wall.
const APPROACH_KEY = "0,-6";
// The Underworks — five sealed chambers beyond Sewer Mouth. Entry and
// return are narrator-driven (Sewer Mouth keeps `doors:[]`), so the
// Underworks are unreachable from Grain Square by findPath; their
// internal mesh connectivity and one-way gate are tested separately.
// Defined before INTERIOR so the partition can exclude them.
const UNDERWORKS_COORDS = [
  { x: 3, y: 6 }, // Brick Descent
  { x: 3, y: 7 }, // Drain Junction
  { x: 2, y: 7 }, // Old Cistern
  { x: 3, y: 8 }, // Guide Markings
  { x: 4, y: 7 }, // Smuggler Stair
];
const UNDERWORKS_KEYS = new Set(UNDERWORKS_COORDS.map(k));

const INTERIOR = Object.keys(HANDCRAFTED)
  .filter((key) => {
    const t = HANDCRAFTED[key];
    if (t.terrain === "water") return false;
    if (t.terrain === "wall") return false;
    if (t.terrain === "wall_top") return false;
    if (key === APPROACH_KEY) return false;
    if (UNDERWORKS_KEYS.has(key)) return false; // Underworks tested separately
    return true;
  })
  .map((key) => { const [x, y] = key.split(",").map(Number); return { x, y }; });

// "Streets" for the partition tests = the authored street network PLUS
// the generated perimeter ring (terrain === "street" catches both, since
// the wall generator now places perimeter tiles as street terrain).
const STREETS = INTERIOR.filter((c) => tile(c).terrain === "street");
const BUILDINGS = INTERIOR.filter((c) => tile(c).terrain !== "street");
const WALL_TOPS = Object.keys(HANDCRAFTED)
  .filter((key) => HANDCRAFTED[key].terrain === "wall_top")
  .map((key) => { const [x, y] = key.split(",").map(Number); return { x, y }; });
// Wall-stairs are wall_top tiles tagged with poi.type === "stair" — the
// six single-tile chokepoints that bridge the city to the wall-walk ring.
const STAIRS = Object.keys(HANDCRAFTED)
  .filter((key) => HANDCRAFTED[key].poi?.type === "stair")
  .map((key) => { const [x, y] = key.split(",").map(Number); return { x, y }; });

const GRAIN = { x: 0, y: 0 };
const APPROACH = { x: 0, y: -6 };  // Crown Road Approach (was 0,-7 when the gate had a 3-deep complex)
const OUTER_GATE = { x: 0, y: -5 }; // Toll Hall — the single wall-crossing gate hex
const INNER_GATE = { x: 0, y: 3 };
const COUNCIL = { x: 0, y: 4 };
const SEWER = { x: 3, y: 5 };
const OATH = { x: -1, y: 3 };
const BRICK_DESCENT = UNDERWORKS_COORDS[0];

// Buildings that are EXEMPT from the no-building-to-building rule because
// a sealed structure deliberately links them: the Citadel's internal pair
// (Inner Gate ↔ Iron Palace) and the Crown Gate's single internal edge
// (Toll Hall W ↔ E, the only remaining link after the gate was trimmed
// to a 2-hex straight-through gatehouse).
const GATE_COMPLEX_INTERNAL_LINKS = [
  [{ x: 0, y: -5 }, { x: 1, y: -5 }], // Toll Hall W ↔ E
];
// The Underworks mesh — every adjacent pair among the five interior
// hexes is an authored internal edge (see UNDERWORKS in
// data/sealed-structures.js, applied via applyMeshDoors). These are
// not city building-to-building edges and must be exempted from test
// 6a, which guards against findPath cutting diagonally through chains
// of city buildings.
const UNDERWORKS_INTERNAL_LINKS = (() => {
  const links = [];
  for (let i = 0; i < UNDERWORKS_COORDS.length; i++) {
    for (let j = i + 1; j < UNDERWORKS_COORDS.length; j++) {
      const a = UNDERWORKS_COORDS[i], b = UNDERWORKS_COORDS[j];
      const dq = a.x - b.x, dr = a.y - b.y;
      if ((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 === 1) {
        links.push([a, b]);
      }
    }
  }
  return links;
})();
const LINKED_BUILDING_PAIRS = new Set([
  `${k(INNER_GATE)}|${k(COUNCIL)}`,
  `${k(COUNCIL)}|${k(INNER_GATE)}`,
  ...GATE_COMPLEX_INTERNAL_LINKS.flatMap(([a, b]) => [
    `${k(a)}|${k(b)}`,
    `${k(b)}|${k(a)}`,
  ]),
  ...UNDERWORKS_INTERNAL_LINKS.flatMap(([a, b]) => [
    `${k(a)}|${k(b)}`,
    `${k(b)}|${k(a)}`,
  ]),
]);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("  FAIL:", msg); } };

console.log("Whitemarch rebuild — engine verification\n");
console.log(`  ${STREETS.length} streets + ${BUILDINGS.length} buildings (interior total ${INTERIOR.length})`);
console.log(`  ${WALL_TOPS.length} wall-top hexes + ${STAIRS.length} wall-stairs`);
console.log(`  Grain Square at (0,0); player starts here.\n`);

// 1) Every PUBLIC interior tile reachable from Grain Square (start inside).
console.log("1) Reachability from Grain Square (start):");
const RESTRICTED = new Set([k(COUNCIL)]); // Iron Palace sits behind the High Wall
for (const c of INTERIOR) {
  if (k(c) === k(GRAIN)) continue;
  if (k(c) === k(SEWER)) continue; // hidden descent — tested separately below
  const path = findPath(state, GRAIN, c);
  const t = tile(c);
  const name = t.poi?.name || t.poi?.partName || k(c);
  if (RESTRICTED.has(k(c))) {
    ok(!!path, `${name} (${k(c)}) reachable via its gate`);
  } else {
    ok(!!path, `${name} (${k(c)}) reachable`);
  }
}

// 2) Sewer Mouth must NOT be reachable by ordinary travel (hidden descent).
console.log("\n2) Sewer Mouth is sealed off the street:");
ok(findPath(state, GRAIN, SEWER) === null, "Sewer Mouth has no open approach");

// 3) The Great Wall: the ONLY open edge from the city system (interior +
// wall-walk + stairs) to the OUTSIDE world is the Crown Gate. Stair ↔
// wall-top edges and gatehouse ↔ wall-top edges are internal to the wall
// infrastructure — they aren't wall breaches.
console.log("\n3) Great Wall — only the Crown Gate breaches it:");
const interiorSet = new Set(INTERIOR.map(k));
const citySystem = new Set([...INTERIOR.map(k), ...WALL_TOPS.map(k)]);
const crossings = [];
for (const c of [...INTERIOR, ...WALL_TOPS]) {
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    if (citySystem.has(k(n))) continue;             // inside the wall system, not a breach
    const nt = getTile(state, n.x, n.y);
    if (!isPassable(nt)) continue;                   // water/wall/impassable: not a crossing
    if (edgeAllowed(tile(c), c.x, c.y, nt, n.x, n.y)) crossings.push(`${k(c)} -> ${k(n)}`);
  }
}
ok(crossings.length === 1, `exactly one open wall crossing (found ${crossings.length}: ${crossings.join(", ")})`);
ok(crossings[0] === `${k(OUTER_GATE)} -> ${k(APPROACH)}`, "the open crossing is Toll Hall -> Crown Road Approach");

// 4) You can actually leave the city — and only through the gate.
console.log("\n4) Leaving the city:");
const out = findPath(state, GRAIN, { x: 0, y: -9 });
ok(!!out, "a route from Grain Square out to the open country exists");
ok(out && out.some((p) => p.x === OUTER_GATE.x && p.y === OUTER_GATE.y), "the route passes through the Toll Hall (the gate)");
ok(out && out.some((p) => p.x === APPROACH.x && p.y === APPROACH.y), "the route passes through the Crown Road Approach");

// 5) The High Wall: Iron Palace reachable ONLY through the Inner Gate.
console.log("\n5) High Wall — Iron Palace only via the Inner Gate:");
const toCouncil = findPath(state, GRAIN, COUNCIL);
ok(!!toCouncil, "Iron Palace is reachable (through the Inner Gate)");
ok(toCouncil && toCouncil.some((p) => p.x === INNER_GATE.x && p.y === INNER_GATE.y), "the route to the Iron Palace passes through the Inner Gate");
// Every open edge into Iron Palace must come from the Inner Gate.
const councilOpenFrom = [];
for (const d of HEX_DIRS) {
  const n = { x: COUNCIL.x + d.x, y: COUNCIL.y + d.y };
  const nt = getTile(state, n.x, n.y);
  if (!isPassable(nt)) continue;
  if (edgeAllowed(tile(COUNCIL), COUNCIL.x, COUNCIL.y, nt, n.x, n.y)) councilOpenFrom.push(k(n));
}
ok(councilOpenFrom.length === 1 && councilOpenFrom[0] === k(INNER_GATE),
   `Iron Palace opens only to the Inner Gate (found: ${councilOpenFrom.join(", ") || "none"})`);
// And the Inner Gate's only street-side opening is the Great Oath Steps.
const gateOpenFrom = [];
for (const d of HEX_DIRS) {
  const n = { x: INNER_GATE.x + d.x, y: INNER_GATE.y + d.y };
  const nt = getTile(state, n.x, n.y);
  if (!isPassable(nt)) continue;
  if (edgeAllowed(tile(INNER_GATE), INNER_GATE.x, INNER_GATE.y, nt, n.x, n.y)) gateOpenFrom.push(k(n));
}
ok(gateOpenFrom.length === 2 && gateOpenFrom.includes(k(COUNCIL)) && gateOpenFrom.includes(k(OATH)),
   `Inner Gate opens only to Iron Palace + Great Oath Steps (found: ${gateOpenFrom.join(", ")})`);

// 6) Streets-vs-buildings invariants — the core of the rescope.
console.log("\n6) Streets vs buildings — the path graph routes over streets:");

// 6a) No building <-> building edges in the doors graph (the rule that stops
// findPath from cutting diagonally through chains of districts). The High
// Wall's internal Citadel link is the only sanctioned exception.
const illegalBuildingEdges = [];
const buildingSet = new Set(BUILDINGS.map(k));
for (const c of BUILDINGS) {
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    if (!buildingSet.has(k(n))) continue;
    if (LINKED_BUILDING_PAIRS.has(`${k(c)}|${k(n)}`)) continue;
    if (edgeAllowed(tile(c), c.x, c.y, tile(n), n.x, n.y)) {
      illegalBuildingEdges.push(`${k(c)} -> ${k(n)}`);
    }
  }
}
ok(illegalBuildingEdges.length === 0,
   `no building-to-building edges (found: ${illegalBuildingEdges.join(", ") || "none"})`);

// 6b) Every reachable-from-the-street building has at least one open edge
// to a street OR (for gate-complex member hexes) an open passable edge —
// the gate complex connects internally and to the outside road, neither
// of which is a street. Sanctioned exemptions: Iron Palace (behind the
// High Wall) and Sewer Mouth (explicitly sealed).
const streetSet = new Set(STREETS.map(k));
const GATE_COMPLEX = new Set([
  "0,-5", "1,-5",
]);
for (const c of BUILDINGS) {
  if (RESTRICTED.has(k(c))) continue; // Iron Palace is behind the High Wall
  const tt = tile(c);
  if (tt.doors && tt.doors.length === 0) continue; // explicitly sealed (Sewer Mouth)
  const streetDoors = [];
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    if (!streetSet.has(k(n))) continue;
    if (edgeAllowed(tile(c), c.x, c.y, tile(n), n.x, n.y)) streetDoors.push(k(n));
  }
  let hasDoor = streetDoors.length > 0;
  // Gate-complex hexes open to other gate-complex hexes and (for the
  // outermost layer) to the road outside. Treat any open passable edge as
  // a valid door for them.
  if (!hasDoor && GATE_COMPLEX.has(k(c))) {
    for (const d of HEX_DIRS) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      const nt = getTile(state, n.x, n.y);
      if (!isPassable(nt)) continue;
      if (edgeAllowed(tile(c), c.x, c.y, nt, n.x, n.y)) { hasDoor = true; break; }
    }
  }
  const t = tile(c);
  const name = t.poi?.name || t.poi?.partName || k(c);
  ok(hasDoor, `${name} (${k(c)}) has a street door`);
}

// 6c) Every street meshes with at least one adjacent interior hex (so it
// actually carries traffic — a street with no neighbours is just a tile).
for (const c of STREETS) {
  let degree = 0;
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    if (!interiorSet.has(k(n))) continue;
    if (edgeAllowed(tile(c), c.x, c.y, tile(n), n.x, n.y)) degree++;
  }
  const t = tile(c);
  const name = t.poi?.name || t.poi?.partName || k(c);
  ok(degree > 0, `${name} (${k(c)}) is connected to the city`);
}

// 7) Movement-cost sanity — paths should now visibly route through streets,
// so the shortest route from Grain Square to Prison Gate (far west wall)
// should step on at least one street hex past the start.
console.log("\n7) Paths route through streets:");
const PRISON = { x: -2, y: 3 };
const toPrison = findPath(state, GRAIN, PRISON);
ok(!!toPrison, "Prison Gate is reachable");
const streetStops = (toPrison || []).slice(1, -1).filter((p) => tile(p).terrain === "street").length;
ok(streetStops > 0, `the route to Prison Gate uses at least one street hex (used ${streetStops})`);

// 8) STAGE 2 — the wall-walk: stairs let you up, the wall-top meshes along
// the ring, and the walk does NOT connect to the outside.
console.log("\n8) Wall-walk — stairs + wall-top ring:");

// 8a) Every stair has an open edge BOTH to a perimeter street tile (the
// chokepoint up from ground level) and to another wall-top hex along the
// ring (the climb works in both directions). The city street is no longer
// the immediate ground-side neighbour — the player walks interior street
// → perimeter street → stair-wall_top → ring.
for (const s of STAIRS) {
  const t = tile(s);
  const name = t.poi?.name || k(s);
  if (!Array.isArray(t.doors) || t.doors.length < 2) {
    ok(false, `${name} (${k(s)}) declares fewer than 2 doors`);
    continue;
  }
  let openPerimeter = false, openTop = false;
  for (const d of t.doors) {
    const nt = getTile(state, d.x, d.y);
    if (!edgeAllowed(t, s.x, s.y, nt, d.x, d.y)) continue;
    if (HANDCRAFTED[k(d)]?.perimeter) openPerimeter = true;
    else if (nt.terrain === "wall_top") openTop = true;
  }
  ok(openPerimeter && openTop, `${name} (${k(s)}) opens to BOTH a perimeter street and another wall-top`);
}

// 8b) Every wall-top hex meshes with at least one other wall-top hex (the
// ring carries traffic — an isolated wall-top is just a tile).
const topSet = new Set(WALL_TOPS.map(k));
let ringEdges = 0;
for (const c of WALL_TOPS) {
  let topNeighbours = 0;
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    if (!topSet.has(k(n))) continue;
    if (edgeAllowed(tile(c), c.x, c.y, tile(n), n.x, n.y)) topNeighbours++;
  }
  if (topNeighbours > 0) ringEdges++;
  ok(topNeighbours > 0, `wall-top ${k(c)} meshes with at least one other wall-top hex`);
}

// 8c) From Grain Square you can reach a wall-top hex (the wall-walk is
// accessible). Test by routing to the wall-top right of the Dragon Stair.
const dragonTop = { x: 3, y: -5 };
const toTop = findPath(state, GRAIN, dragonTop);
ok(!!toTop, "Grain Square → wall-top at Dragon Stair is reachable");
const usedStair = (toTop || []).some((p) => tile(p).poi?.type === "stair");
ok(usedStair, "the route to the wall-top passes through a stair");

// 8d) The wall-walk does NOT cross the outer wall — no wall-top hex has an
// open edge to anything beyond the wall (outside the biome interior).
// Stair-tagged wall_top tiles are the single exception: each opens to the
// adjacent perimeter street tile(s) (its declared chokepoint).
const wallTopExternalCrossings = [];
for (const c of WALL_TOPS) {
  const ct = tile(c);
  const isStair = ct.poi?.type === "stair";
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    const nt = getTile(state, n.x, n.y);
    if (!isPassable(nt)) continue;
    if (nt.terrain === "wall_top") continue;
    if (HANDCRAFTED[k(n)]?.poi?.parent === "whitemarch-crown-gate") continue;
    if (isStair && HANDCRAFTED[k(n)]?.perimeter) continue; // stair's perimeter chokepoint
    if (edgeAllowed(ct, c.x, c.y, nt, n.x, n.y)) {
      wallTopExternalCrossings.push(`${k(c)} -> ${k(n)}`);
    }
  }
}
ok(wallTopExternalCrossings.length === 0,
   `no wall-top opens to anything other than wall-top / gatehouse / (stair's perimeter) (found: ${wallTopExternalCrossings.join(", ") || "none"})`);

// 9) Footprint groupings — every authored multi-hex POI reads as one
// place on the map. We check that each declared parent has the
// expected member count and that every member tile shares the same
// `parent` id.
console.log("\n9) Footprint groupings — multi-hex places:");
const FOOTPRINTS = {
  "whitemarch-grand-market":      { name: "The Grand Market",      expected: 5 },
  "whitemarch-crown-gate":        { name: "The Crown Gate",        expected: 2 },
  "whitemarch-citadel":           { name: "The Citadel",           expected: 2 },
  "whitemarch-chain-market-steps":{ name: "Chain Market Steps",    expected: 3 },
  "whitemarch-registry-hall":     { name: "Registry Hall",         expected: 2 },
  "whitemarch-prison-gate":       { name: "Prison Gate",           expected: 2 },
  "whitemarch-caravan-yard":      { name: "Caravan Yard & Stable", expected: 2 },
  "whitemarch-guild-court":       { name: "Guild Court",           expected: 2 },
  "whitemarch-underworks":        { name: "The Underworks",        expected: 5 },
};
const groups = new Map();
for (const key of Object.keys(HANDCRAFTED)) {
  const parent = HANDCRAFTED[key].poi?.parent;
  if (!parent) continue;
  if (!groups.has(parent)) groups.set(parent, []);
  groups.get(parent).push(key);
}
for (const [id, spec] of Object.entries(FOOTPRINTS)) {
  const members = groups.get(id) || [];
  ok(members.length === spec.expected,
     `${spec.name} (${id}) has ${spec.expected} member hexes (found ${members.length}: ${members.join(", ") || "none"})`);
}

// 10) The Underworks — five chambers, sealed off the surface except by
// the narrator-opened Sewer Mouth gate, internally walkable.
console.log("\n10) The Underworks — sealed descent beyond Sewer Mouth:");

// 10a) The five member hexes are all authored, with `area: "underworks"`
// (the marker the wall generator uses to skip them in the interior set).
for (const c of UNDERWORKS_COORDS) {
  const t = tile(c);
  const name = t.poi?.partName || k(c);
  ok(t.poi?.area === "underworks", `Underworks member ${name} (${k(c)}) is tagged area:"underworks"`);
}

// 10b) Sewer Mouth keeps its sealed `doors:[]` so findPath can neither
// descend nor ascend through it.
const sewerTile = tile(SEWER);
ok(Array.isArray(sewerTile.doors) && sewerTile.doors.length === 0,
   `Sewer Mouth keeps its empty doors list (found: ${JSON.stringify(sewerTile.doors)})`);

// 10c) From any Underworks hex you cannot path back up to Sewer Mouth
// (the Mouth's empty doors list blocks the return side of the gate too).
for (const c of UNDERWORKS_COORDS) {
  const t = tile(c);
  const name = t.poi?.partName || k(c);
  ok(!edgeAllowed(t, c.x, c.y, sewerTile, SEWER.x, SEWER.y),
     `${name} (${k(c)}) cannot path to Sewer Mouth (return is narrator-only)`);
}

// 10d) From the surface side, no city tile (street, building, wall-top,
// stair) has an open edge into any Underworks hex.
const underworksBreaches = [];
for (const key of Object.keys(HANDCRAFTED)) {
  if (UNDERWORKS_KEYS.has(key)) continue;
  if (key === k(SEWER)) continue; // tested above
  const [sx, sy] = key.split(",").map(Number);
  const st = HANDCRAFTED[key];
  for (const c of UNDERWORKS_COORDS) {
    const dq = sx - c.x, dr = sy - c.y;
    if ((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 !== 1) continue;
    if (edgeAllowed(st, sx, sy, tile(c), c.x, c.y)) {
      underworksBreaches.push(`${key} -> ${k(c)}`);
    }
  }
}
ok(underworksBreaches.length === 0,
   `no city tile opens into the Underworks (found: ${underworksBreaches.join(", ") || "none"})`);

// 10e) Within the Underworks, every member hex is reachable from every
// other — the mesh wires the full graph. (We pretend Brick Descent is
// the player start for this sub-test by checking each pair directly via
// edgeAllowed-aware BFS over the Underworks set.)
const reachable = new Set([k(BRICK_DESCENT)]);
const stack = [BRICK_DESCENT];
while (stack.length) {
  const c = stack.pop();
  const t = tile(c);
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    if (!UNDERWORKS_KEYS.has(k(n))) continue;
    if (reachable.has(k(n))) continue;
    if (!edgeAllowed(t, c.x, c.y, tile(n), n.x, n.y)) continue;
    reachable.add(k(n));
    stack.push(n);
  }
}
for (const c of UNDERWORKS_COORDS) {
  const t = tile(c);
  const name = t.poi?.partName || k(c);
  ok(reachable.has(k(c)), `${name} (${k(c)}) is reachable inside the Underworks mesh`);
}

// 11) Grand Market Coin Scales — the 5th part — sits adjacent to at
// least one other Grand Market hex so the outline is contiguous.
console.log("\n11) Grand Market Coin Scales — contiguous with the rest:");
const grandMarketHexes = (groups.get("whitemarch-grand-market") || []).map((key) => {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
});
const coinScales = { x: -1, y: 0 };
const coinScalesNeighbours = grandMarketHexes.filter((c) => {
  if (c.x === coinScales.x && c.y === coinScales.y) return false;
  const dq = c.x - coinScales.x, dr = c.y - coinScales.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 === 1;
});
ok(coinScalesNeighbours.length > 0,
   `Coin Scales (-1,0) is adjacent to ${coinScalesNeighbours.length} other Grand Market hex(es)`);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
