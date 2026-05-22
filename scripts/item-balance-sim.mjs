// Item balance sweep. Equips REAL catalog items (so the engine's name+tier+heft
// inference in combat-stats.js is exercised) on a standard mid-game player and
// runs thousands of fights vs fixed benchmarks, to check:
//   1) the TIER curve ramps smoothly (each grade is a clear step up),
//   2) weapon FAMILIES are balanced at a tier (trade-offs, no single dominant),
//   3) armour CLASSES ramp sensibly on survival.
// Run: node scripts/item-balance-sim.mjs [runs]
//
// Pure Node — no React in the import chain.

import { initCombat, playerAct, endTurn, abilityUsable } from "../src/engine/combat.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";
import { generateEnemyGroup } from "../src/data/bestiary.js";
import { ALL_ITEMS } from "../src/data/catalog.js";
import { itemCombatStats } from "../src/engine/combat-stats.js";

const RUNS = Number(process.argv[2] || 1500);

function codexWith(ids) {
  const items = {};
  for (const id of ids) {
    const def = ALL_ITEMS[id];
    if (!def) throw new Error(`unknown item ${id}`);
    items[id] = def;
  }
  return { characters: { wanderer: { id: "wanderer", worn: ids } }, items };
}

function midPlayer() {
  return {
    name: "Player", vitality: 28, vitalityMax: 28, resolve: 5, resolveMax: 5,
    attributes: { body: 5, reflex: 4, vigor: 4, mind: 2, wit: 3, presence: 2 },
    abilities: [
      { id: "power-strike", tier: "common" }, { id: "rend", tier: "common" },
      { id: "second-wind", tier: "common" },
    ],
    proficiencies: {},
  };
}

// A harmless, high-HP training dummy: never hits back (accuracy 0), never yields
// or flees (mindless, no morale), so the only thing that ends the fight is the
// player killing it — making cs.turn a clean time-to-kill (DPS) readout. `armor`
// lets us isolate the value of penetration (mace/hammer/pick) vs raw damage.
function makeDummy(hp, armor = 0) {
  return [{
    id: "dummy", kind: "dummy", name: "Dummy", race: null, tier: "common",
    demeanor: "mindless", morale: 9999, moraleMax: 9999, canTalk: false,
    controlPressure: 0, provoked: false, resolved: null, lastFlavorTurn: 0, noFleeUntil: 99999,
    maxHealth: hp, health: hp, armor, ward: 0, dodge: 0, accuracy: 0, critChance: 0, critMult: 1,
    speed: 1, weapon: { min: 0, max: 0, type: "physical", pen: 0 }, abilities: [],
    maxLootTier: "common", statuses: [], cooldowns: {},
  }];
}

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);

function choosePlayerAction(cs) {
  const candidates = cs.player.abilities
    .map((a) => ({ id: a.id, tier: a.tier || "common", def: getAbilityDef(a.id) }))
    .filter((c) => c.def && c.id !== "talk" && abilityUsable(cs, c.id));
  const opp = cs.enemies.filter((e) => e.health > 0 && !e.resolved);
  if (opp.length === 0) return null;
  const choice = chooseAction(cs.player, opp, candidates);
  if (!choice) return { abilityId: BASIC_ATTACK.id, targetIndex: cs.enemies.indexOf(opp[0]) };
  const targetIndex = choice.target ? cs.enemies.indexOf(choice.target) : cs.enemies.indexOf(opp[0]);
  return { abilityId: choice.ability.id, targetIndex };
}

function runFight(codex, makeEnemies) {
  let cs = initCombat(midPlayer(), codex, makeEnemies());
  let guard = 0;
  while (!TERMINAL.has(cs.phase) && guard++ < 300) {
    if (cs.phase !== "player") break;
    const act = choosePlayerAction(cs);
    if (act && abilityUsable(cs, act.abilityId)) {
      cs = playerAct(cs, act.abilityId, act.targetIndex);
      if (TERMINAL.has(cs.phase)) break;
    }
    cs = endTurn(cs);
  }
  return cs;
}

function measure(codex, makeEnemies) {
  let wins = 0, turns = 0, hp = 0;
  for (let i = 0; i < RUNS; i++) {
    const cs = runFight(codex, makeEnemies);
    if (cs.phase === "victory" || cs.phase === "resolved") wins++;
    turns += cs.turn;
    hp += cs.player.health / cs.player.maxHealth;
  }
  return { win: wins / RUNS, turns: turns / RUNS, endHP: hp / RUNS };
}

// Time-to-kill (in turns) of an unarmoured / armoured dummy — the DPS readout.
function ttk(codex, hp, armor) {
  let sum = 0;
  for (let i = 0; i < RUNS; i++) sum += runFight(codex, () => makeDummy(hp, armor)).turn;
  return sum / RUNS;
}

function dmgLabel(id) {
  const d = itemCombatStats(ALL_ITEMS[id]).damage;
  return d ? `${d.min}-${d.max}${d.pen ? `/p${d.pen}` : ""}` : "—";
}

function row(label, r, extra = "") {
  console.log(
    label.padEnd(26),
    `win ${(r.win * 100).toFixed(0).padStart(3)}%`,
    `· kill-turns ${r.turns.toFixed(1).padStart(4)}`,
    `· endHP ${(r.endHP * 100).toFixed(0).padStart(3)}%`,
    extra,
  );
}

const FIX_ARMOR = "leather-jerkin";

console.log(`\n=== ITEM BALANCE SWEEP — ${RUNS} runs/cell ===`);

function offenseRow(id) {
  const c = codexWith([id, FIX_ARMOR]);
  const soft = ttk(c, 90, 1);   // lightly-armoured target — rewards raw damage
  const hard = ttk(c, 90, 8);   // heavily-armoured target — rewards penetration
  console.log(
    `  ${ALL_ITEMS[id].name}`.padEnd(28),
    `dmg ${dmgLabel(id).padEnd(8)}`,
    `· TTK soft ${soft.toFixed(1).padStart(4)}`,
    `· TTK armoured ${hard.toFixed(1).padStart(4)}`,
  );
}

// 1) WEAPON FAMILIES at common — TTK should be close (trade-offs: pen weapons
//    lag on soft targets but win on armoured ones; daggers/bows trade power for
//    speed/range elsewhere).
console.log("\nWEAPON FAMILIES @ common (time-to-kill a 90-HP dummy)");
for (const id of ["iron-dagger", "arming-sword", "iron-shortsword", "iron-longsword", "hand-axe", "battle-axe", "iron-mace", "war-hammer", "iron-spear", "hunting-bow", "short-bow", "light-crossbow", "club", "quarterstaff"]) offenseRow(id);

// 2) TIER ramp on one family — TTK should drop each grade.
console.log("\nTIER RAMP — sword line (TTK should fall each grade)");
for (const id of ["iron-longsword", "steel-longsword", "knights-longsword"]) offenseRow(id);
console.log("\nTIER RAMP — two-handers (heft) vs one-handers");
for (const id of ["arming-sword", "greatsword", "executioners-blade", "steel-greataxe", "maul"]) offenseRow(id);

// 3) ARMOUR classes — survival vs a harder benchmark (4 bandits), fixed weapon.
console.log("\nARMOUR CLASSES @ their tier (defense: solo vs 4 bandits, iron-longsword)");
const ABENCH = () => generateEnemyGroup("bandits", { count: 4, maxTier: "common" });
for (const id of ["padded-gambeson", "leather-jerkin", "studded-leather", "brigandine", "chain-shirt", "chain-hauberk", "banded-mail", "half-plate", "full-plate"]) {
  const cs = itemCombatStats(ALL_ITEMS[id]);
  row(`  ${ALL_ITEMS[id].name}`, measure(codexWith(["iron-longsword", id]), ABENCH), `${ALL_ITEMS[id].tier} armor ${cs.armor}`);
}
console.log("");
