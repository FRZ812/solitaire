// Throwaway verifier for the Whitemarch rebuild. Exercises the REAL engine
// (findPath / edgeAllowed / getTile) against the REAL data so the wall + gate
// + high-wall behaviour is proven, not assumed. Run: node scripts/verify-whitemarch.mjs
import { HANDCRAFTED } from "../src/data/handcrafted-tiles.js";
import { getTile, findPath, edgeAllowed, isPassable } from "../src/engine/world.js";

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

// A state where everything in a generous box is "seen" so findPath can route
// freely — the ONLY thing that should stop it is the doors graph (the walls).
const seen = {};
for (let x = -8; x <= 8; x++) for (let y = -9; y <= 9; y++) seen[`${x},${y}`] = true;
const state = { world: { tiles: {}, currentTile: { x: 0, y: 0 }, seen } };

const k = (c) => `${c.x},${c.y}`;
const tile = (c) => getTile(state, c.x, c.y);

// The interior list mirrors sealed-structures WHITEMARCH_INTERIOR.
const INTERIOR = Object.keys(HANDCRAFTED)
  .filter((key) => {
    const t = HANDCRAFTED[key];
    return t.terrain !== "water" && key !== "0,-3"; // exclude river + outside approach
  })
  .map((key) => { const [x, y] = key.split(",").map(Number); return { x, y }; });

const GRAIN = { x: 0, y: 0 };
const APPROACH = { x: 0, y: -3 };
const TOLL = { x: 0, y: -2 };
const INNER_GATE = { x: 0, y: 3 };
const COUNCIL = { x: 0, y: 4 };
const SEWER = { x: 1, y: 2 };
const OATH = { x: -1, y: 3 };

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("  FAIL:", msg); } };

console.log("Whitemarch rebuild — engine verification\n");

// 1) Every PUBLIC interior tile reachable from Grain Square (start inside).
console.log("1) Reachability from Grain Square (start):");
const RESTRICTED = new Set(["0,4"]); // Council Hall sits behind the High Wall
for (const c of INTERIOR) {
  if (k(c) === k(GRAIN)) continue;
  if (k(c) === k(SEWER)) continue; // hidden descent — tested separately below
  const path = findPath(state, GRAIN, c);
  const name = tile(c).poi?.name || tile(c).poi?.partName || k(c);
  if (RESTRICTED.has(k(c))) {
    ok(!!path, `${name} (${k(c)}) reachable via its gate`);
  } else {
    ok(!!path, `${name} (${k(c)}) reachable`);
  }
}

// 2) Sewer Mouth must NOT be reachable by ordinary travel (hidden descent).
console.log("\n2) Sewer Mouth is sealed off the street:");
ok(findPath(state, GRAIN, SEWER) === null, "Sewer Mouth has no open approach");

// 3) The Great Wall: the ONLY open edge from interior to outside is the gate.
console.log("\n3) Great Wall — only the Crown Gate breaches it:");
const interiorSet = new Set(INTERIOR.map(k));
const crossings = [];
for (const c of INTERIOR) {
  for (const d of HEX_DIRS) {
    const n = { x: c.x + d.x, y: c.y + d.y };
    if (interiorSet.has(k(n))) continue;            // inside-inside, ignore
    const nt = getTile(state, n.x, n.y);
    if (!isPassable(nt)) continue;                   // water/impassable: not a crossing
    if (edgeAllowed(tile(c), c.x, c.y, nt, n.x, n.y)) crossings.push(`${k(c)} -> ${k(n)}`);
  }
}
ok(crossings.length === 1, `exactly one open wall crossing (found ${crossings.length}: ${crossings.join(", ")})`);
ok(crossings[0] === `${k(TOLL)} -> ${k(APPROACH)}`, "the open crossing is Toll Hall -> Crown Road Approach");

// 4) You can actually leave the city — and only through the gate.
console.log("\n4) Leaving the city:");
const out = findPath(state, GRAIN, { x: 0, y: -6 });
ok(!!out, "a route from Grain Square out to the open country exists");
ok(out && out.some((p) => p.x === TOLL.x && p.y === TOLL.y), "the route passes through Toll Hall (the gate)");
ok(out && out.some((p) => p.x === APPROACH.x && p.y === APPROACH.y), "the route passes through the Crown Road Approach");

// 5) The High Wall: Council Hall reachable ONLY through the Inner Gate.
console.log("\n5) High Wall — Council Hall only via the Inner Gate:");
const toCouncil = findPath(state, GRAIN, COUNCIL);
ok(!!toCouncil, "Council Hall is reachable (through the Inner Gate)");
ok(toCouncil && toCouncil.some((p) => p.x === INNER_GATE.x && p.y === INNER_GATE.y), "the route to the Council passes through the Inner Gate");
// Every open edge into the Council must come from the Inner Gate.
const councilOpenFrom = [];
for (const d of HEX_DIRS) {
  const n = { x: COUNCIL.x + d.x, y: COUNCIL.y + d.y };
  const nt = getTile(state, n.x, n.y);
  if (!isPassable(nt)) continue;
  if (edgeAllowed(tile(COUNCIL), COUNCIL.x, COUNCIL.y, nt, n.x, n.y)) councilOpenFrom.push(k(n));
}
ok(councilOpenFrom.length === 1 && councilOpenFrom[0] === k(INNER_GATE),
   `Council opens only to the Inner Gate (found: ${councilOpenFrom.join(", ") || "none"})`);
// And the Inner Gate's only street-side opening is the Great Oath Steps.
const gateOpenFrom = [];
for (const d of HEX_DIRS) {
  const n = { x: INNER_GATE.x + d.x, y: INNER_GATE.y + d.y };
  const nt = getTile(state, n.x, n.y);
  if (!isPassable(nt)) continue;
  if (edgeAllowed(tile(INNER_GATE), INNER_GATE.x, INNER_GATE.y, nt, n.x, n.y)) gateOpenFrom.push(k(n));
}
ok(gateOpenFrom.length === 2 && gateOpenFrom.includes(k(COUNCIL)) && gateOpenFrom.includes(k(OATH)),
   `Inner Gate opens only to Council + Great Oath Steps (found: ${gateOpenFrom.join(", ")})`);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
