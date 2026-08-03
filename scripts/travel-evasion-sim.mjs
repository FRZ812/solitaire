// Travel evasion sweep. Picks the constants behind `encounterHalts` and asserts
// the properties they have to have, rather than trusting a guessed number.
//
// The question it answers: what share of marches reach their own boundary
// without a hostile stopping them? A settled road march has to get through
// nearly always — being halted on the Crown Road is the tedium WS7 exists to
// remove — while the far reaches have to stop the party most of the time, or
// difficulty means nothing.
//
// Everything here drives the real `evasionChance`/`encounterHalts` over real
// continent coordinates. Re-deriving the formula in the harness would only test
// the harness, so the bands are found by scanning the map for a hex in each.
//
// Throws (non-zero exit) on any failed invariant; otherwise prints the table.
// Pure Node — no React in the import chain.
//
// Run: node scripts/travel-evasion-sim.mjs [runsPerCell]

import { EVADE_CEIL, EVADE_FLOOR, NIGHT_ENCOUNTER_MULT, encounterHalts, evasionChance } from "../src/engine/encounters.js";
import { DIFFICULTY_BANDS } from "../src/data/balance.js";
import { regionDifficulty } from "../src/data/regions.js";
import { SPAWN_TABLES } from "../src/data/spawn-tables.js";
import { TRAVEL_PACES } from "../src/engine/expedition.js";
import { makeInitialState } from "../src/data/initial-state.js";

const RUNS = Math.max(500, Number(process.argv[2]) || 6000);

let failures = 0;
function ok(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label}`); failures++; }
}

const base = makeInitialState();
const SEED = base.world.seed;

// One real hex per difficulty band. `regionDifficulty` is a pure function of the
// coordinate, so the sweep walks outward until it has found all six.
const hexByBand = new Map();
for (let ring = 0; ring <= 900 && hexByBand.size < 6; ring += 15) {
  for (const [x, y] of [[ring, 0], [-ring, 0], [0, ring], [0, -ring], [ring, ring], [-ring, -ring]]) {
    const level = regionDifficulty(x, y, SEED).level;
    if (!hexByBand.has(level)) hexByBand.set(level, { x, y });
  }
}
const BANDS = [...hexByBand.keys()].sort((a, b) => a - b);
ok(BANDS.length >= 4, `found real ground in ${BANDS.length} of the six bands to sweep`);

// The party, as the roll sees it. Light, load and weariness are read off the
// state by `isHidden`/`isBeacon` and the condition list, so the sweep varies the
// state rather than the arithmetic.
function party({ lit = false, night = false, overburdened = false, weary = null } = {}) {
  const state = structuredClone(base);
  state.time = { ...state.time, hour: night ? 1 : 12, minute: 0 };
  // Open ground, so the light rules fall through to the clock rather than a
  // settlement's own lamps.
  state.world.currentTile = { x: 0, y: -40 };
  state.character.light = lit ? { minutes: 60, source: "torch" } : null;
  state.character.darkvision = false;
  state.character.overburdened = overburdened;
  state.character.conditions = weary ? [{ name: weary }] : [];
  return state;
}

const chanceAt = (level, options = {}, party_ = party(options)) =>
  evasionChance(party_, hexByBand.get(level), { pace: options.pace || "steady" });

const day = party();
console.log("\n=== EVASION CHANCE BY BAND (steady, unlit day, on foot) ===");
console.log("  band  label         hex              chance");
const byBand = [];
for (const level of BANDS) {
  const hex = hexByBand.get(level);
  const chance = evasionChance(day, hex, { pace: "steady" });
  byBand.push(chance);
  console.log(`  ${level}     ${DIFFICULTY_BANDS[level].label.padEnd(12)}  ${`${hex.x},${hex.y}`.padEnd(15)}  ${String(chance).padStart(3)}%`);
}

// How much of a terrain's spawn table is hostile, by weight rather than by
// headcount — a bear at weight 7 is not a wolf pack at weight 22.
function hostileShare(terrain) {
  const entries = SPAWN_TABLES[terrain]?.entries || [];
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (!total) return 0;
  return entries.filter((e) => e.posture === "hostile").reduce((sum, e) => sum + e.weight, 0) / total;
}

// The number that actually matters: the chance a leg of `hexes` over this ground
// is cut short. Per hex the party has to roll an encounter at all, have it be
// hostile, and then fail to get clear of it.
function cutRate(terrain, hexes, level, { pace = "steady", night = false, ...options } = {}) {
  const base = SPAWN_TABLES[terrain]?.chance || 0;
  const perHex = Math.min(1, base * TRAVEL_PACES[pace].riskMult * (night ? NIGHT_ENCOUNTER_MULT : 1));
  const blocked = 1 - chanceAt(level, { pace, night, ...options }) / 100;
  return 1 - (1 - perHex * hostileShare(terrain) * blocked) ** hexes;
}

console.log("\n=== WHAT A REAL LEG ACTUALLY MEETS ===");
console.log("  Chance a leg is cut short, over the real spawn tables at a steady pace by day.");
console.log("  Legs are 4 hexes (an errand), 16 (a day's march), 48 (WORLD_MARCH_LIMIT).");
for (const terrain of ["plains", "forest", "hills", "mountains"]) {
  const share = Math.round(hostileShare(terrain) * 100);
  const row = [4, 16, 48].map((hexes) => `${Math.round(cutRate(terrain, hexes, 2) * 100)}%`.padStart(6)).join("");
  console.log(`  ${terrain.padEnd(10)} ${String(Math.round((SPAWN_TABLES[terrain]?.chance || 0) * 100)).padStart(2)}% encounter, ${String(share).padStart(2)}% of it hostile  →${row}`);
}

console.log("\n=== THE TEDIUM TARGET ===");
// Whitemarch and its frontier are band 2, so this is the ground a new party does
// nearly all of its travelling on. If a day's march from the capital is still
// being cut, travel is still the thing the player complained about.
const homeDayMarch = cutRate("plains", 16, 2);
ok(homeDayMarch <= 0.15, `a day's march over settled plains is cut ${Math.round(homeDayMarch * 100)}% of the time (want ≤15%)`);
const homeFullLeg = cutRate("forest", 48, 2);
ok(homeFullLeg <= 0.40, `a full 48-hex leg through frontier forest is cut ${Math.round(homeFullLeg * 100)}% (want ≤40%)`);

// And the far side: difficulty has to mean something. The same forest march in
// the far reaches should usually not be finished in one go.
const farFullLeg = cutRate("forest", 48, 5);
ok(farFullLeg >= 0.55, `the same leg in the Far Reaches is cut ${Math.round(farFullLeg * 100)}% (want ≥55%)`);
ok(farFullLeg > homeFullLeg * 1.3, "the far reaches stop a march markedly more often than home ground does");

console.log("\n=== THE SAME LEG, BY BAND ===");
console.log("  48 hexes of forest, steady, by day.  " + BANDS.map((l) => `band${l}`.padStart(7)).join(""));
console.log("  cut short                            " + BANDS.map((l) => `${Math.round(cutRate("forest", 48, l) * 100)}%`.padStart(7)).join(""));

console.log("\n=== MONOTONICITY ===");
ok(byBand.every((chance, i) => i === 0 || chance < byBand[i - 1]), "escape gets harder every band out from the Vale");
ok(chanceAt(3, { pace: "careful" }) > chanceAt(3, { pace: "steady" })
  && chanceAt(3, { pace: "steady" }) > chanceAt(3, { pace: "forced" }), "careful > steady > forced");
ok(chanceAt(3, { night: true }) > chanceAt(3) && chanceAt(3) > chanceAt(3, { night: true, lit: true }),
  "hidden in the dark > seen by day > carrying a flame in the dark");
ok(chanceAt(3, { overburdened: true }) < chanceAt(3), "an overladen party cannot run");
ok(chanceAt(3, { weary: "Exhausted" }) < chanceAt(3, { weary: "Tired" }) && chanceAt(3, { weary: "Tired" }) < chanceAt(3),
  "weariness costs, and exhaustion costs more");
ok(cutRate("forest", 48, 3) > cutRate("forest", 16, 3) && cutRate("forest", 16, 3) > cutRate("forest", 4, 3),
  "a longer leg is cut short more often than a shorter one over the same ground");
// Night raises the encounter rate 1.4×, but an unlit party is hidden. The two
// do not cancel: marching dark is a real way through dangerous country, paid for
// elsewhere (a 1.3× slower leg in App.handleTravel, and blind if caught).
// Carrying a flame gets the worse rate with none of the cover.
ok(cutRate("forest", 48, 3, { night: true }) < cutRate("forest", 48, 3),
  `marching unlit through the night is cover worth having (${Math.round(cutRate("forest", 48, 3, { night: true }) * 100)}% cut vs ${Math.round(cutRate("forest", 48, 3) * 100)}% by day)`);
ok(cutRate("forest", 48, 3, { night: true, lit: true }) > cutRate("forest", 48, 3),
  `a torch at night is the worst of both — more out there, and it can see you (${Math.round(cutRate("forest", 48, 3, { night: true, lit: true }) * 100)}% cut)`);

console.log("\n=== BOUNDS ===");
const worst = chanceAt(6, { pace: "forced", night: true, lit: true, overburdened: true, weary: "Exhausted" });
const best = chanceAt(1, { pace: "careful", night: true });
ok(worst === EVADE_FLOOR, `the worst case floors at ${EVADE_FLOOR}% rather than becoming impossible (${worst}%)`);
ok(best === EVADE_CEIL, `the best case caps at ${EVADE_CEIL}% — nothing is a guaranteed escape (${best}%)`);

console.log("\n=== THE ROLL ITSELF ===");
{
  const at = hexByBand.get(3);
  const doe = { kind: "deer", posture: "neutral" };
  const outcomes = new Set();
  for (let i = 0; i < 500; i++) outcomes.add(encounterHalts(day, doe, at).outcome);
  ok(outcomes.size === 1 && outcomes.has("passed"), "friendly and neutral never roll and never halt");
  ok(encounterHalts(day, doe, at).halts === false, "a doe frozen mid-graze no longer ends a fortnight's march");

  const wolves = { kind: "wolves", posture: "hostile" };
  const stated = evasionChance(day, at);
  let evaded = 0, mismatched = 0;
  for (let i = 0; i < RUNS; i++) {
    const verdict = encounterHalts(day, wolves, at);
    if (verdict.outcome === "evaded") evaded++;
    if (verdict.halts !== (verdict.outcome === "blocked")) mismatched++;
  }
  const observed = (evaded / RUNS) * 100;
  ok(Math.abs(observed - stated) < 3, `the roll lands on its stated chance (${observed.toFixed(1)}% observed vs ${stated}% over ${RUNS} runs)`);
  ok(mismatched === 0, "blocked is the only outcome that halts a march");
}

console.log("\n=== PACE STEERS TWO THINGS ===");
// Pace already trades ground for risk through `riskMult`; this asserts it now
// also trades for quiet, in the same direction, so the choice stays coherent.
for (const [id, pace] of Object.entries(TRAVEL_PACES)) {
  console.log(`  ${pace.label.padEnd(8)} meets ×${pace.riskMult}   escapes ${chanceAt(3, { pace: id })}%`);
}
ok(chanceAt(3, { pace: "forced" }) < chanceAt(3, { pace: "careful" })
  && TRAVEL_PACES.forced.riskMult > TRAVEL_PACES.careful.riskMult,
"forced both meets more and escapes less — the two costs point the same way");

console.log(failures ? `\n${failures} FAILED\n` : "\nAll invariants hold.\n");
if (failures) process.exit(1);
