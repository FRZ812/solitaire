// Road-event sweep. Answers whether the table actually reaches the ground it was
// written for, and how often a march carries one.
//
// The risk with a `where`-predicate table is silent starvation: eight crossing
// events that no real route ever qualifies for, or a `wild` bucket that swallows
// nine legs in ten because the classifier is too strict. Neither shows up in a
// unit test, because a unit test hands the classifier the tile it wants. So this
// walks real canonical routes across the real continent and counts what the
// classifier says about ground the player will actually cross.
//
// Throws (non-zero exit) on any failed invariant; otherwise prints the tables.
//
// Run: node scripts/run-sim.mjs road-event-sim [runsPerLeg]

import { ROAD_EVENTS, ROAD_OFFERS, roadEventsWhere } from "../src/data/road-events.js";
import { ROAD_EVENT_CEIL, roadEventChance, roadEventWhere, rollRoadEvent } from "../src/engine/road-events.js";
import { findWorldRoute, getTile } from "../src/engine/world.js";
import { BORDER_CHECKPOINTS, LANDMARKS } from "../src/data/continent.js";
import { makeInitialState } from "../src/data/initial-state.js";

const RUNS = Math.max(200, Number(process.argv[2]) || 3000);

let failures = 0;
function ok(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label}`); failures++; }
}

const state = makeInitialState();
const WHERES = ["checkpoint", "crossing", "border", "settled", "road", "wild"];

console.log("\n=== THE TABLE ===");
console.log(`  ${ROAD_EVENTS.length} events across ${new Set(ROAD_EVENTS.map((e) => e.where)).size} kinds of ground.`);
for (const where of WHERES) {
  const list = roadEventsWhere(where);
  if (!list.length) continue;
  const offers = [...new Set(list.map((e) => e.offer))].join(", ");
  console.log(`  ${where.padEnd(11)} ${String(list.length).padStart(2)}  ${offers}`);
}
ok(new Set(ROAD_EVENTS.map((e) => e.id)).size === ROAD_EVENTS.length, "every event id is unique");
ok(ROAD_EVENTS.every((e) => ROAD_OFFERS[e.offer]), "every offer is one of the closed vocabulary");
ok(ROAD_EVENTS.every((e) => e.label && e.detail), "every event has something to show and something to narrate");
const stopping = ROAD_EVENTS.filter((e) => e.stops);
ok(stopping.length > 0 && stopping.length <= 4,
  `${stopping.length} of ${ROAD_EVENTS.length} events close the road (${stopping.map((e) => e.id).join(", ")})`);

// Real journeys, not synthetic paths: the classifier only means anything over
// ground the route planner would actually send a party across.
//
// Two families of them, because they cross different country. A march between
// named places rides the road almost the whole way; a march to somewhere with
// no name on it leaves the road and stays off it. Sweeping only the first would
// report the ten wilderness events as starved when they are simply not on the
// way to a city.
const START = state.world.currentTile;
const DESTINATIONS = LANDMARKS
  .filter((l) => ["city", "town", "village", "port", "fortress"].includes(l.kind))
  .slice(0, 40)
  .map((l) => ({ name: l.name, coord: l.coord }));

for (let x = 60; x < 900 && DESTINATIONS.length < 52; x += 71) {
  for (let y = 40; y < 700; y += 53) {
    const tile = getTile(state, x, y);
    if (!tile || !tile.procedural || tile.terrain === "water" || tile.route || tile.poi) continue;
    DESTINATIONS.push({ name: `open country ${x},${y}`, coord: { x, y } });
    break;
  }
}

console.log("\n=== WHAT REAL ROUTES ARE MADE OF ===");
const counts = Object.fromEntries(WHERES.map((w) => [w, 0]));
let hexes = 0;
const routes = [];
for (const landmark of DESTINATIONS) {
  const path = findWorldRoute(state, START, landmark.coord);
  if (!path || path.length < 3) continue;
  routes.push({ name: landmark.name, path });
  let previousTile = getTile(state, path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    const tile = getTile(state, path[i].x, path[i].y);
    const where = roadEventWhere(tile, previousTile, path[i].x, path[i].y);
    previousTile = tile;
    if (!where) continue;
    counts[where]++;
    hexes++;
  }
}
console.log(`  ${routes.length} routes, ${hexes} classified hexes.`);
for (const where of WHERES) {
  const share = hexes ? (counts[where] / hexes) * 100 : 0;
  console.log(`  ${where.padEnd(11)} ${String(counts[where]).padStart(6)}  ${share.toFixed(1).padStart(5)}%`);
}
ok(routes.length >= 10, `the planner produced ${routes.length} usable routes to sweep`);
// Starvation is the failure this sim exists to catch: a bucket the player never
// reaches is eight or nine authored events that will never be read.
for (const where of WHERES) {
  if (!roadEventsWhere(where).length && where !== "checkpoint") continue;
  ok(counts[where] > 0, `real routes reach ${where} ground (${counts[where]} hexes)`);
}
ok(counts.wild / hexes < 0.8, `wild does not swallow the map (${Math.round((counts.wild / hexes) * 100)}% of hexes)`);

console.log("\n=== HOW OFTEN A MARCH CARRIES ONE ===");
console.log("  leg hexes   chance");
for (const n of [2, 4, 8, 16, 24, 48]) {
  console.log(`  ${String(n).padStart(9)}   ${Math.round(roadEventChance(n) * 100)}%`);
}
ok(roadEventChance(4) < roadEventChance(16) && roadEventChance(16) < roadEventChance(48),
  "a longer march is likelier to have something happen on it");
ok(roadEventChance(4) <= 0.2, `a short errand usually has no story in it (${Math.round(roadEventChance(4) * 100)}%)`);
ok(roadEventChance(400) === ROAD_EVENT_CEIL, "the chance stops rising, so some marches are always only landscape");

console.log("\n=== THE ROLL ITSELF ===");
{
  // A route with no checkpoint on it, long enough to be interesting.
  const plain = routes.find((r) => r.path.length > 20
    && !r.path.some((p) => getTile(state, p.x, p.y).checkpoint));
  ok(!!plain, `found a clean route to roll against (${plain?.name}, ${plain?.path.length} hexes)`);

  const leg = plain.path.slice(0, 25);
  let drawn = 0, onLastHex = 0, mismatched = 0;
  const seen = new Set();
  const drawnWhere = Object.fromEntries(WHERES.map((w) => [w, 0]));
  for (let i = 0; i < RUNS; i++) {
    const hit = rollRoadEvent(state, leg);
    if (!hit) continue;
    drawn++;
    seen.add(hit.event.id);
    drawnWhere[hit.event.where]++;
    if (hit.atIndex >= leg.length - 1) onLastHex++;
    const tile = getTile(state, hit.atTile.x, hit.atTile.y);
    const previousTile = getTile(state, leg[hit.atIndex - 1].x, leg[hit.atIndex - 1].y);
    if (roadEventWhere(tile, previousTile, hit.atTile.x, hit.atTile.y) !== hit.event.where) mismatched++;
  }
  const observed = (drawn / RUNS) * 100;
  const stated = roadEventChance(leg.length - 1) * 100;
  console.log(`  ${drawn} of ${RUNS} legs carried an event, drawing ${seen.size} distinct ones.`);
  ok(Math.abs(observed - stated) < 4, `the roll lands on its stated chance (${observed.toFixed(1)}% vs ${stated.toFixed(0)}%)`);
  ok(mismatched === 0, "every event is placed on ground that qualifies for it");
  ok(onLastHex === 0, "nothing is ever placed on the hex the leg ends at");
  ok(seen.size >= 4, `the same leg does not keep producing the same event (${seen.size} distinct over ${drawn} draws)`);

  // The weighting exists to keep the remarkable ground from being buried under
  // the miles between it. This measures whether it worked on a real leg.
  console.log("\n  where the drawn events landed, against that ground's share of the leg:");
  const legWhere = Object.fromEntries(WHERES.map((w) => [w, 0]));
  for (let i = 1; i < leg.length - 1; i++) {
    const where = roadEventWhere(getTile(state, leg[i].x, leg[i].y), getTile(state, leg[i - 1].x, leg[i - 1].y), leg[i].x, leg[i].y);
    if (where) legWhere[where]++;
  }
  const legHexes = Object.values(legWhere).reduce((a, b) => a + b, 0);
  for (const where of WHERES) {
    if (!legWhere[where] && !drawnWhere[where]) continue;
    console.log(`  ${where.padEnd(11)} ${`${Math.round((legWhere[where] / legHexes) * 100)}%`.padStart(5)} of hexes  →  ${`${Math.round((drawnWhere[where] / drawn) * 100)}%`.padStart(5)} of events`);
  }

  ok(rollRoadEvent(state, []) === null && rollRoadEvent(state, [START]) === null
    && rollRoadEvent(state, [START, plain.path[1]]) === null,
  "a leg with no middle to it reports nothing rather than throwing");
}

console.log("\n=== THE CHECKPOINTS, WHICH ARE NOT ROLLED FOR ===");
// Five authored customs forts have sat in continent.js with garrisons and
// controlling factions since the map was written, and travel has never read one.
{
  let wired = 0;
  for (const post of BORDER_CHECKPOINTS) {
    // A leg that crosses the fort rather than ending at it, since the last hex
    // is where the party stops anyway.
    const approach = findWorldRoute(state, START, post.coord);
    if (!approach || approach.length < 3) continue;
    const beyond = [...approach, { x: post.coord.x + 1, y: post.coord.y }];
    const hits = new Set();
    for (let i = 0; i < 200; i++) {
      const hit = rollRoadEvent(state, beyond);
      hits.add(hit?.event.id || null);
    }
    const expected = `checkpoint:${post.id}`;
    const deterministic = hits.size === 1 && hits.has(expected);
    if (deterministic) wired++;
    console.log(`  ${post.name.padEnd(20)} ${deterministic ? "always halts the march" : `NOT REACHED (${[...hits].join(",")})`}`);
  }
  ok(wired > 0, `${wired} of ${BORDER_CHECKPOINTS.length} authored checkpoints now stop a march that crosses them`);
}

console.log(failures ? `\n${failures} FAILED\n` : "\nAll invariants hold.\n");
if (failures) process.exit(1);
