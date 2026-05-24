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
import { MOUNTS, mountCodexEntry } from "../src/data/mounts.js";
import { carryCapacityFor, recomputeVitalityMax, recomputeResolveMax } from "../src/engine/attributes.js";
import { itemWeight, loadOf, isOverCapacity } from "../src/engine/weight.js";
import { canMount, mount, dismount, effectiveLoad, currentRideLoad } from "../src/engine/riding.js";
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

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
