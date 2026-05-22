// Combat simulation harness. Drives the real engine (engine/combat.js) with the
// shared AI (engine/combat-ai.js) on BOTH sides — including the player — and runs
// thousands of fights per scenario to surface win rates, fight length, yield
// rates, and companion losses, so the AI + difficulty + yield tuning can be
// checked at scale. Run: node scripts/combat-sim.mjs [runsPerScenario]
//
// Pure Node — no React in the import chain.

import { initCombat, playerAct, endTurn, abilityUsable } from "../src/engine/combat.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";
import { generateEnemyGroup, allyFromCompanion } from "../src/data/bestiary.js";
import { COMPANIONS } from "../src/data/companions.js";

const RUNS = Number(process.argv[2] || 2000);

// --- synthetic player loadouts (attributes + a weapon/armor in the codex) ---
function makeCodex(weapon, armor) {
  return {
    characters: { wanderer: { id: "wanderer", worn: ["w", "a"] } },
    items: {
      w: { id: "w", name: weapon.name, kind: "weapon", tier: "common", combat: { damage: weapon.dmg } },
      a: { id: "a", name: "Leather Armor", kind: "armor", tier: "common", combat: { armor } },
    },
  };
}
const SWORD = { name: "Shortsword", dmg: { min: 3, max: 6, type: "physical", pen: 0 } };
const codex = makeCodex(SWORD, 2);

// A realistic early-mid wanderer: modest attributes, a plain blade, a couple of
// learned techniques (no Cleave AoE, so groups can't be wiped in one swing).
function midPlayer() {
  return {
    name: "Player", vitality: 26, vitalityMax: 26, resolve: 5, resolveMax: 5,
    attributes: { body: 4, reflex: 4, vigor: 4, mind: 2, wit: 3, presence: 2 },
    abilities: [
      { id: "power-strike", tier: "common" }, { id: "rend", tier: "common" },
      { id: "second-wind", tier: "common" },
    ],
    proficiencies: {},
  };
}

function buildAllies(keys, tierId) {
  return keys.map((k) => allyFromCompanion(COMPANIONS[k], codex, { tierId }));
}

// AI drives the player's own turn (focus the killable foe, use the best move).
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

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);

function runFight(makeEnemies, allyKeys, tierId) {
  const allies = allyKeys.length ? buildAllies(allyKeys, tierId) : [];
  let cs = initCombat(midPlayer(), codex, makeEnemies(), { allies });
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

function scenario(label, makeEnemies, allyKeys = [], tierId = "common") {
  let wins = 0, losses = 0, resolved = 0, fled = 0;
  let turns = 0, hpSum = 0, yields = 0, foeCount = 0, allyDeaths = 0, allyCount = 0;
  for (let i = 0; i < RUNS; i++) {
    const cs = runFight(makeEnemies, allyKeys, tierId);
    if (cs.phase === "victory") wins++;
    else if (cs.phase === "resolved") { resolved++; wins++; } // resolved = you stood, foes broke
    else if (cs.phase === "defeat") losses++;
    else if (cs.phase === "playerFled") fled++;
    turns += cs.turn;
    hpSum += cs.player.health / cs.player.maxHealth;
    yields += cs.enemies.filter((e) => e.resolved === "yielded").length;
    foeCount += cs.enemies.length;
    allyCount += (cs.allies || []).length;
    allyDeaths += (cs.allies || []).filter((a) => a._dead).length;
  }
  const pct = (n) => `${((n / RUNS) * 100).toFixed(0)}%`;
  console.log(
    label.padEnd(34),
    `win ${pct(wins).padStart(4)}`,
    `lose ${pct(losses).padStart(4)}`,
    `· turns ${(turns / RUNS).toFixed(1).padStart(4)}`,
    `· endHP ${((hpSum / RUNS) * 100).toFixed(0).padStart(3)}%`,
    `· yield ${foeCount ? ((yields / foeCount) * 100).toFixed(0) : 0}%`.padStart(9),
    allyCount ? `· allyDeath ${((allyDeaths / Math.max(1, allyCount)) * 100).toFixed(0)}%` : "",
  );
}

console.log(`\n=== Combat simulation — ${RUNS} runs/scenario ===\n`);
console.log("SOLO");
scenario("solo vs 2 bandits", () => generateEnemyGroup("bandits", { count: 2, maxTier: "common" }));
scenario("solo vs 3 goblins", () => generateEnemyGroup("goblins", { count: 3, maxTier: "common" }));
scenario("solo vs 4 bandits", () => generateEnemyGroup("bandits", { count: 4, maxTier: "common" }));
scenario("solo vs 1 ogre", () => generateEnemyGroup("ogre", { count: 1, maxTier: "common" }));
scenario("solo vs 2 wargs", () => generateEnemyGroup("wargs", { count: 2, maxTier: "common" }));
console.log("\nPARTY (player + Bram, Senna, Doran)");
const PARTY = ["bram", "senna", "doran"];
scenario("party vs 4 bandits", () => generateEnemyGroup("bandits", { count: 4, maxTier: "common" }), PARTY);
scenario("party vs 6 goblins", () => generateEnemyGroup("goblins", { count: 6, maxTier: "common" }), PARTY);
scenario("party vs 2 ogres", () => generateEnemyGroup("ogre", { count: 2, maxTier: "common" }), PARTY);
scenario("party vs 5 orc-raiders", () => generateEnemyGroup("orc-raiders", { count: 5, maxTier: "uncommon" }), PARTY, "uncommon");
console.log("");
