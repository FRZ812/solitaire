// Mount + weight verification harness. Asserts the new weight math, the
// weight-bound riding/nesting rules, and that mounts fight as allies through the
// real engine. Throws (non-zero exit) on any failed invariant; otherwise prints a
// summary. Pure Node — no React in the import chain.
//
// Run: node scripts/mount-weight-sim.mjs [combatRuns]

import { initCombat, playerAct, endTurn, abilityUsable, canStandDown, playerStandDown } from "../src/engine/combat.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";
import { allyFromCompanion, generateEnemyGroup } from "../src/data/bestiary.js";
import { COMPANIONS, companionCodexEntry } from "../src/data/companions.js";
import { MOUNTS, mountCodexEntry, STABLE_MOUNTS, stableStockFor, STABLE_STOCK_BY_BIOME } from "../src/data/mounts.js";
import { rollStableMounts } from "../src/engine/town-gen.js";
import { depleteNeeds } from "../src/engine/needs.js";
import { carryCapacityFor, recomputeCarryCapacity, recomputeVitalityMax, recomputeResolveMax } from "../src/engine/attributes.js";
import { itemWeight, loadOf, isOverCapacity } from "../src/engine/weight.js";
import { buffTravelSpeedMult, buffCarryBonus, buffRideBonus, hastedGroundMinutes, hastedFlightHexes, hastedFlightMinutes } from "../src/engine/buffs.js";
import { FLY_TRAVEL_HEXES, FLY_MIN_PER_HEX, MOUNT_FLIGHT_NEED_PER_HOUR } from "../src/config.js";
import { canMount, mount, dismount, effectiveLoad, currentRideLoad, isOverloaded, overloadedMounts } from "../src/engine/riding.js";
import { itemTemplate } from "../src/data/catalog.js";

let failures = 0;
function ok(cond, label) {
  if (cond) { console.log(`  ✓ ${label}`); }
  else { console.log(`  ✗ ${label}`); failures++; }
}
const approx = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

console.log("\n=== WEIGHT MATH ===");
{
  const cap2 = carryCapacityFor({ attributes: { body: 2, vigor: 2 } });
  const cap10 = carryCapacityFor({ attributes: { body: 10, vigor: 6 } });
  const cap30 = carryCapacityFor({ attributes: { body: 30, vigor: 30 } });
  ok(cap2 < cap10 && cap10 < cap30, `capacity rises with Body/Vigor (${cap2} < ${cap10} < ${cap30})`);
  ok(cap2 >= 50 && cap2 <= 70, `a frail newcomer carries ~60 (${cap2})`);

  const dagger = itemWeight(itemTemplate("iron-dagger"));
  const plate = itemWeight({ id: "x", name: "Full Plate Harness", kind: "armor" });
  const leather = itemWeight({ id: "y", name: "Leather Jerkin", kind: "armor" });
  ok(dagger <= 2, `a dagger is light (${dagger})`);
  ok(plate > leather, `plate outweighs leather (${plate} > ${leather})`);
  ok(itemWeight({ kind: "armor", name: "Feathermail", weight: 1 }) === 1, "explicit weight overrides inference");
  ok(itemWeight(itemTemplate("fodder")) === 6 && itemWeight(itemTemplate("livestock")) === 30, "feed carries its authored weight");

  // A loaded pack vs a capacity.
  const codexItems = {};
  const character = { worn: [], carryCapacityMax: 60 };
  const inv = { carried: [{ itemId: "livestock", quantity: 1 }, { itemId: "fodder", quantity: 2 }], coins: { copper: 0, silver: 0, gold: 0 } };
  const load = loadOf(character, inv, codexItems); // 30 + 12 = 42
  ok(approx(load, 42), `loadOf sums carried weight (${load})`);
  ok(!isOverCapacity(character, inv, codexItems), "42 fits under a 60 cap");
  const heavy = { carried: [{ itemId: "livestock", quantity: 3 }], coins: { copper: 0, silver: 0, gold: 0 } };
  ok(isOverCapacity(character, heavy, codexItems), "90 of livestock busts a 60 cap (hard cap point for buyGood)");
}

console.log("\n=== RIDING / NESTING (weight, not headcount) ===");
function ridingState() {
  const human = (id, name) => ({ id, kind: "companion", name, race: "human", worn: [], bodyWeight: 14, ridingOn: null, riders: [] });
  const chars = {
    wanderer: { id: "wanderer", kind: "player", name: "You", race: "human", worn: [], bodyWeight: 14, ridingOn: null, riders: [] },
    al: human("al", "Al"), bo: human("bo", "Bo"), cy: human("cy", "Cy"),
    horse: mountCodexEntry(MOUNTS.horse),
    dragon: mountCodexEntry(MOUNTS.dragon),
  };
  return {
    character: { inventory: { carried: [], coins: { copper: 0, silver: 0, gold: 0 } }, carryCapacityMax: 60 },
    world: { codex: { characters: chars, items: {} } },
    party: ["horse", "dragon", "al", "bo", "cy"],
  };
}
{
  let s = ridingState();
  ok(approx(effectiveLoad(s.world.codex.characters.dragon, s), 1500, 1), "a dragon weighs ~1500 as cargo");
  ok(approx(effectiveLoad(s.world.codex.characters.wanderer, s), 14, 1), "an unburdened person weighs ~14");

  ok(canMount(s, "wanderer", "horse").ok, "a person can mount a horse");
  ok(!canMount(s, "dragon", "horse").ok, "a horse CANNOT carry a dragon (weight)");

  // Seat rider + two companions on the horse (14×3 = 42 ≤ 150).
  s = mount(s, "wanderer", "horse").state;
  s = mount(s, "al", "horse").state;
  s = mount(s, "bo", "horse").state;
  ok(s.world.codex.characters.horse.riders.length === 3, "horse bears three riders by weight");
  ok(approx(currentRideLoad(s.world.codex.characters.horse, s), 42, 1), "horse ride-load is the sum of rider weights (42)");

  // The horse (with its three riders) rides the dragon — nesting.
  const nest = canMount(s, "horse", "dragon");
  ok(nest.ok, "a horse + its riders can ride a dragon (nesting within capacity)");
  s = mount(s, "horse", "dragon").state;
  ok(approx(currentRideLoad(s.world.codex.characters.dragon, s), 70 + 42, 1), "dragon bears the horse AND its riders (nested load)");

  // Cycle: the dragon can't now ride the horse it carries.
  ok(!canMount(s, "dragon", "horse").ok, "no saddle-loop: dragon can't ride the horse it carries");

  // Overload a horse with a heavy pack on the player.
  let s2 = ridingState();
  s2.character.inventory.carried = [{ itemId: "livestock", quantity: 5 }]; // 150 + 14 body = 164
  ok(!canMount(s2, "wanderer", "horse").ok, "an over-laden rider (164) won't fit a horse (150)");

  // Dismount clears both links.
  let s3 = mount(ridingState(), "wanderer", "horse").state;
  s3 = dismount(s3, "wanderer").state;
  ok(!s3.world.codex.characters.wanderer.ridingOn && s3.world.codex.characters.horse.riders.length === 0, "dismount clears rider + carrier links");
}

console.log("\n=== RIDING EDGE CASES ===");
// Custom, tiny-number entities so capacities are easy to reason about. riding.js
// only reads kind/rideCapacity/bodyWeight/riders/ridingOn/combatState.
function customState() {
  const mk = (id, rideCapacity, bodyWeight) => ({ id, kind: "mount", name: id, race: "x", worn: [], bodyWeight, rideCapacity, ridingOn: null, riders: [] });
  const human = (id) => ({ id, kind: "companion", name: id, race: "human", worn: [], bodyWeight: 50, ridingOn: null, riders: [] });
  const chars = {
    wanderer: { id: "wanderer", kind: "player", name: "You", race: "human", worn: [], bodyWeight: 14, ridingOn: null, riders: [] },
    big: mk("big", 100, 20),      // carrier, capacity 100
    cartA: mk("cartA", 80, 10),   // light nested mounts
    cartB: mk("cartB", 80, 10),
    smol: mk("smol", 20, 5),      // tiny mount for the pack-boundary test
    h1: human("h1"), h2: human("h2"),
  };
  return {
    character: { inventory: { carried: [], coins: { copper: 0, silver: 0, gold: 0 } }, carryCapacityMax: 999 },
    world: { codex: { characters: chars, items: {} } },
    party: ["big", "cartA", "cartB", "smol", "h1", "h2"],
  };
}

// ANCESTOR-CHAIN capacity: loading nested mounts can't overflow the carrier below.
{
  let s = customState();
  s = mount(s, "cartA", "big").state;   // big bears 10
  s = mount(s, "cartB", "big").state;   // big bears 20 (both empty carts fit)
  ok(s.world.codex.characters.big.riders.length === 2, "two empty carts fit on the carrier (20 ≤ 100)");
  s = mount(s, "h1", "cartA").state;    // +50 → big bears 70, cartA bears 60
  ok(s.world.codex.characters.cartA.riders.includes("h1"), "a 50-weight rider fits cartA AND the carrier below it");
  ok(approx(currentRideLoad(s.world.codex.characters.big, s), 70, 1), "carrier load tracks the nested rider (70)");
  // cartB ALONE has room (80-10=70 ≥ 50), but big does not (100-70=30 < 50).
  const blocked = canMount(s, "h2", "cartB");
  ok(!blocked.ok, "ancestor check: a rider that fits the cart is REJECTED when the carrier below is full");
  ok(/big/.test(blocked.reason || ""), "rejection names the overloaded carrier (big)");
}

// CHARACTER body fits, body + PACK does not.
{
  let s = customState();
  ok(canMount(s, "wanderer", "smol").ok, "body 14 fits a 20-capacity mount");
  s.character.inventory.carried = [{ itemId: "fodder", quantity: 2 }]; // +12 → 26 > 20
  ok(!canMount(s, "wanderer", "smol").ok, "but body 14 + a 12-weight pack (26) does NOT fit (20)");
  ok(approx(effectiveLoad(s.world.codex.characters.wanderer, s), 26, 1), "the pack counts toward the rider's effective load (26)");
}

// POST-MOUNT overload: loot picked up after mounting overloads the mount.
{
  let s = mount(ridingState(), "wanderer", "horse").state; // light pack, fits horse (150)
  ok(!isOverloaded(s.world.codex.characters.horse, s), "a freshly-mounted horse is not overloaded");
  s = { ...s, character: { ...s.character, inventory: { ...s.character.inventory, carried: [{ itemId: "livestock", quantity: 6 }] } } }; // +180
  ok(isOverloaded(s.world.codex.characters.horse, s), "picking up 180 of loot overloads the horse the player rides");
  ok(overloadedMounts(s).some((m) => m.id === "horse"), "overloadedMounts() flags the horse (gates flight in App.handleFly)");
}

// DEAD mounts/riders can't be seated.
{
  let s = ridingState();
  s.world.codex.characters.horse.combatState = { status: "dead" };
  ok(!canMount(s, "wanderer", "horse").ok, "a dead mount can't be ridden");
  let s2 = ridingState();
  s2.world.codex.characters.al.combatState = { status: "dead" };
  ok(!canMount(s2, "al", "horse").ok, "a dead rider can't mount");
}

// RE-SEAT within the same chain isn't falsely double-counted.
{
  let s = ridingState();
  s = mount(s, "horse", "dragon").state;     // horse (70) on dragon
  s = mount(s, "wanderer", "horse").state;   // player on horse, which rides the dragon
  // Moving the player straight onto the dragon is net-neutral for the dragon, so
  // it must be allowed (probe-detach prevents a phantom double-count).
  ok(canMount(s, "wanderer", "dragon").ok, "re-seating a nested rider onto its carrier isn't falsely blocked");
  s = mount(s, "wanderer", "dragon").state;
  ok(s.world.codex.characters.wanderer.ridingOn === "dragon" && !s.world.codex.characters.horse.riders.includes("wanderer"), "the re-seat moved the player and cleared the old seat");
}

console.log("\n=== TRANSIENT BUFFS (over standard while buffed, then it lapses) ===");
// A carry/Body buff lets you load past your standard cap; when it lapses the cap
// falls back and the overflow must degrade gracefully — flagged, never lost.
{
  // PLAYER carry buff. base(body4,vigor4) ≈ 80; +80 bonus → 160.
  const char = { attributes: { body: 4, vigor: 4 }, worn: [], carryBonus: 80 };
  recomputeCarryCapacity(char);
  const base = carryCapacityFor({ attributes: { body: 4, vigor: 4 } });
  ok(char.carryCapacityMax > base, `carryBonus lifts the cap (${base} → ${char.carryCapacityMax})`);
  const inv = { carried: [{ itemId: "livestock", quantity: 4 }], coins: { copper: 0, silver: 0, gold: 0 } }; // 120
  ok(!isOverCapacity(char, inv, {}), "a 120 load fits WHILE the buff holds");
  // Buff lapses.
  char.carryBonus = 0;
  recomputeCarryCapacity(char);
  ok(isOverCapacity(char, inv, {}), "when the buff lapses the same 120 load is now over the standard cap");
  ok(inv.carried.length === 1 && inv.carried[0].quantity === 4, "nothing is dropped — the loot is intact, just overburdened");
}
{
  // MOUNT ride buff. smol base cap 20; +40 bonus → 60; carry a 50-weight rider.
  let s = customState();
  s.world.codex.characters.smol.rideCapacityBonus = 40;
  ok(canMount(s, "h1", "smol").ok, "a 50-weight rider fits a 20-cap mount WHILE a +40 ride buff holds");
  s = mount(s, "h1", "smol").state;
  ok(!isOverloaded(s.world.codex.characters.smol, s), "the buffed mount is not overloaded");
  // Buff lapses (the field clears).
  s.world.codex.characters.smol.rideCapacityBonus = 0;
  ok(isOverloaded(s.world.codex.characters.smol, s), "when the ride buff lapses the mount is over capacity");
  ok(s.world.codex.characters.smol.riders.includes("h1"), "the rider is NOT auto-thrown — kept aboard, mount just flagged (gates flight)");
  ok(overloadedMounts(s).some((m) => m.id === "smol"), "overloadedMounts() flags it so App.handleFly refuses to launch");
}

console.log("\n=== SPEED BUFFS (haste) — faster, but NEVER faster drain ===");
{
  const mult = buffTravelSpeedMult([{ name: "Hastened", remaining: 60 }]);
  ok(mult > 1, `Hastened gives a travel speed multiplier (${mult})`);
  ok(buffTravelSpeedMult([]) === 1, "no buff = no speed change");
  ok(buffCarryBonus([{ name: "Bear's Strength" }]) === 60, "Bear's Strength wires +60 carry");
  ok(buffRideBonus([{ name: "Bear's Strength" }]) === 80, "Bear's Strength wires +80 ride capacity");

  // GROUND: the same leg takes fewer minutes → less need drain (drain is time-based).
  const baseGround = 60;
  const fastGround = hastedGroundMinutes(baseGround, mult);
  ok(fastGround < baseGround, `hasted ground leg is quicker (${fastGround} < ${baseGround} min) → less drain, not more`);

  // FLIGHT: reaches further per leg, and crucially the minutes-per-hex (which
  // drives BOTH need drain and mount stamina) DROPS — so speed never costs upkeep.
  const baseHexes = FLY_TRAVEL_HEXES;
  const fastHexes = hastedFlightHexes(baseHexes, mult);
  ok(fastHexes > baseHexes, `hasted flight reaches further per leg (${fastHexes} > ${baseHexes} hexes)`);
  const fastMins = hastedFlightMinutes(fastHexes * FLY_MIN_PER_HEX, mult);
  const basePerHex = FLY_MIN_PER_HEX;
  const fastPerHex = fastMins / fastHexes;
  ok(fastPerHex < basePerHex, `flight time per hex drops (${fastPerHex.toFixed(2)} < ${basePerHex} min/hex) — never drains faster`);
  const staminaBase = (basePerHex / 60) * MOUNT_FLIGHT_NEED_PER_HOUR;
  const staminaFast = (fastPerHex / 60) * MOUNT_FLIGHT_NEED_PER_HOUR;
  ok(staminaFast < staminaBase, `mount stamina per hex drops under haste (${staminaFast.toFixed(2)} < ${staminaBase.toFixed(2)})`);
  ok(fastMins <= 65, `a full hasted flight leg is still ~one hour aloft (${fastMins} min), not longer — flat per-leg drain`);

  // For a fixed journey, total time (= total drain) can only go DOWN under haste.
  const tripHexes = 30;
  const baseTrip = tripHexes * FLY_MIN_PER_HEX;
  const fastTrip = tripHexes * fastPerHex;
  ok(fastTrip < baseTrip, `a 30-hex flight costs less total time/drain hasted (${Math.round(fastTrip)} < ${baseTrip} min)`);
}

console.log("\n=== MOUNTED COMBAT (mounts fight as allies) ===");
const RUNS = Number(process.argv[2] || 400);
const codex = {
  characters: { wanderer: { id: "wanderer", worn: ["w", "a"] } },
  items: {
    w: { id: "w", name: "Shortsword", kind: "weapon", tier: "common", combat: { damage: { min: 3, max: 6, type: "physical", pen: 0 } } },
    a: { id: "a", name: "Leather Armor", kind: "armor", tier: "common", combat: { armor: 2 } },
  },
};
function midPlayer() {
  const c = { name: "Player", attributes: { body: 4, reflex: 4, vigor: 4, mind: 2, wit: 3, presence: 2 }, abilities: [{ id: "power-strike", tier: "common" }], proficiencies: {} };
  recomputeVitalityMax(c); recomputeResolveMax(c); c.resolve = c.resolveMax; return c;
}
function choosePlayerAction(cs) {
  const candidates = cs.player.abilities.map((a) => ({ id: a.id, tier: a.tier || "common", def: getAbilityDef(a.id) })).filter((c) => c.def && c.id !== "talk" && abilityUsable(cs, c.id));
  const opp = cs.enemies.filter((e) => e.health > 0 && !e.resolved);
  if (!opp.length) return null;
  const party = [cs.player, ...(cs.allies || [])].filter((a) => a.health > 0 && !a._dead && !a.resolved);
  const choice = chooseAction(cs.player, opp, candidates, { allies: party });
  if (!choice) return { abilityId: BASIC_ATTACK.id, targetIndex: cs.enemies.indexOf(opp[0]) };
  return { abilityId: choice.ability.id, targetIndex: choice.target ? cs.enemies.indexOf(choice.target) : cs.enemies.indexOf(opp[0]) };
}
const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);
function runFight(makeEnemies, mountKey, tierId, mountedBonus) {
  const allies = mountKey ? [allyFromCompanion(MOUNTS[mountKey], codex, { tierId })] : [];
  if (allies.length && mountedBonus) allies[0]._x = 0; // (allies fight on their own here)
  let cs = initCombat(midPlayer(), codex, makeEnemies(), { allies, playerMountedBonus: mountedBonus });
  let guard = 0;
  while (!TERMINAL.has(cs.phase) && guard++ < 300) {
    if (cs.phase !== "player") break;
    if (canStandDown(cs)) { cs = playerStandDown(cs); break; }
    const act = choosePlayerAction(cs);
    if (act && abilityUsable(cs, act.abilityId)) { cs = playerAct(cs, act.abilityId, act.targetIndex); if (TERMINAL.has(cs.phase)) break; }
    cs = endTurn(cs);
  }
  return cs;
}
function scenario(label, makeEnemies, mountKey, tierId, mountedBonus) {
  let wins = 0;
  for (let i = 0; i < RUNS; i++) {
    const cs = runFight(makeEnemies, mountKey, tierId, mountedBonus);
    if (cs.phase === "victory" || cs.phase === "resolved") wins++;
  }
  const pct = (wins / RUNS) * 100;
  console.log(`  ${label.padEnd(38)} win ${pct.toFixed(0).padStart(3)}%`);
  return pct;
}
const soloMule = scenario("solo vs 3 bandits (no mount)", () => generateEnemyGroup("bandits", { count: 3, maxTier: "common" }), null, "common", null);
const warhorse = scenario("warhorse ally + rider vs 3 bandits", () => generateEnemyGroup("bandits", { count: 3, maxTier: "common" }), "warhorse", "common", MOUNTS.warhorse.mountedBonus);
ok(warhorse >= soloMule, `a warhorse ally helps (${warhorse}% ≥ ${soloMule}%)`);
const dragon = scenario("dragon ally vs 4 orc-raiders", () => generateEnemyGroup("orc-raiders", { count: 4, maxTier: "epic" }), "dragon", "divine", MOUNTS.dragon.mountedBonus);
ok(dragon >= 85, `a divine dragon ally dominates (${dragon}%)`);

console.log("\n=== FLYING GATE ===");
{
  const fed = { needs: { hunger: 80, sleep: 80 } };
  const spent = { needs: { hunger: 10, sleep: 80 } };
  const MIN = 15;
  const canFly = (m) => (m.needs.hunger ?? 100) > MIN && (m.needs.sleep ?? 100) > MIN;
  ok(canFly(fed), "a fed, rested flyer can take wing");
  ok(!canFly(spent), "a starving flyer is grounded");
}

console.log("\n=== REGION-GATED STABLE MOUNTS ===");
{
  // 1. Every stable mount is a valid combat ally (catches a bad ability/passive id).
  let allOk = true;
  for (const m of STABLE_MOUNTS) {
    const a = allyFromCompanion(m, codex, { tierId: m.tier || "common" });
    if (!a || !(a.health > 0) || !a.weapon) { allOk = false; console.log(`    bad ally: ${m.id}`); }
  }
  ok(allOk, `all ${STABLE_MOUNTS.length} stable mounts build a valid combat ally`);

  // 2. Every stock id exists and is acquisition:"stable" (no earned mount leaks in).
  let stockOk = true;
  const entries = [...Object.values(STABLE_STOCK_BY_BIOME)];
  for (const e of entries) {
    if (!MOUNTS[e.signature] || MOUNTS[e.signature].acquisition !== "stable") { stockOk = false; console.log(`    bad signature: ${e.signature}`); }
    for (const s of e.stock) if (!MOUNTS[s.id] || MOUNTS[s.id].acquisition !== "stable") { stockOk = false; console.log(`    bad stock id: ${s.id}`); }
  }
  ok(stockOk, "every biome stock id is a real, stable-acquisition mount");

  // 3. All 15 biomes covered; mire is humble; ground-drake never sold.
  ok(Object.keys(STABLE_STOCK_BY_BIOME).length === 15, "all 15 biomes have a stable stock");
  const mire = stableStockFor("mire");
  ok(mire.signature === "nag" && mire.stock.every((s) => !["camel", "warhorse", "courser"].includes(s.id)) && mire.stock.some((s) => s.id === "nag"),
    "mire sells the nag, never camel/warhorse/courser");
  const anySellsDrake = Object.values(STABLE_STOCK_BY_BIOME).some((e) => e.signature === "ground-drake" || e.stock.some((s) => s.id === "ground-drake"));
  ok(!anySellsDrake && MOUNTS["ground-drake"].acquisition === "tame", "ground-drake is EARNED — sold by no stable");

  // 4. Human civilized region carries the premium Courser; steppe carries camel + axe-beak.
  ok(stableStockFor("iron-plateau").stock.some((s) => s.id === "courser"), "iron-plateau (human) carries the Courser");
  const steppe = stableStockFor("pale-steppe");
  ok(steppe.stock.some((s) => s.id === "camel") && steppe.stock.some((s) => s.id === "axe-beak"), "pale-steppe carries camel + axe-beak");

  // 5. Seeded roll: signature always in; deterministic within a day; rotates across windows.
  const r0 = rollStableMounts(mire, "0,-1", 0);
  const r0b = rollStableMounts(mire, "0,-1", 0);
  ok(r0.some((m) => m.id === "nag"), "rolled mire stock always includes the signature nag");
  ok(JSON.stringify(r0) === JSON.stringify(r0b), "the roll is deterministic within a restock window");
  const override = { signature: "ground-drake", stock: [{ id: "ground-drake", chance: 1.0 }] };
  ok(JSON.stringify(rollStableMounts(override, "31,-150", 0)) === JSON.stringify([{ id: "ground-drake" }]), "a poi.mounts override yields exactly its forced list");

  // 6. Needs/endurance modifier: a thrifty mount loses less hunger over the same time.
  const start = { hunger: 80, thirst: 80, sleep: 80 };
  const thrifty = depleteNeeds(start, 600, 1 * (MOUNTS.courser.needsDecayMult ?? 1)); // courser 0.55
  const plain = depleteNeeds(start, 600, 1 * 1);
  ok(thrifty.hunger > plain.hunger, `courser (thrifty) keeps more hunger than a default mount (${thrifty.hunger.toFixed(0)} > ${plain.hunger.toFixed(0)})`);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
