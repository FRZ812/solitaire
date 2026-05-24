// Apex-boss parity harness. Builds the named bosses with the REAL enemyFromNPC
// (from the makeInitialState codex) at divine tier and pits a single FIXED
// reference player against each, thousands of times, through the real engine +
// AI. Because every boss fights as an ENEMY (isPlayer=false in all its own
// damage maths), this measures each boss's true difficulty-as-a-foe — the honest
// way to ask "is the Demon King as hard to beat as the Great Wyrm?".
//
// It reports three variants so the change is visible in one run:
//   DK (fallback)  — the demon-king with NO declared kit (generic power-strike+firebolt)
//   DK (new kit)   — the demon-king as authored in initial-state.js
//   Vyrnholt       — the great-wyrm (the tuned peer)
//
// Run: node scripts/boss-parity-sim.mjs [runs]

import { makeInitialState } from "../src/data/initial-state.js";
import { enemyFromNPC, allyFromCompanion } from "../src/data/bestiary.js";
import { initCombat, playerAct, endTurn, abilityUsable } from "../src/engine/combat.js";
import { deriveCombatStats } from "../src/engine/combat-stats.js";
import { recomputeVitalityMax, recomputeResolveMax } from "../src/engine/attributes.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";

const RUNS = Number(process.argv[2] || 4000);
const TIER = "divine";
const codex = makeInitialState().world.codex;

const npcOf = (id) => {
  const n = codex.characters[id];
  if (!n) throw new Error(`npc ${id} not in codex`);
  return n;
};

// Build a boss combatant from a codex NPC. `stripKit` simulates the OLD generic
// fallback (no declared abilities). `kit` overrides the declared abilities (to
// trial candidate kits). `forceDemeanor` neutralises morale (fight to the death)
// so we measure raw combat power, not yield/flee personality.
function buildBoss(npcId, { stripKit = false, kit = null, forceDemeanor = null } = {}) {
  let npc = npcOf(npcId);
  if (stripKit) { npc = { ...npc }; delete npc.abilities; }
  else if (kit) { npc = { ...npc, abilities: kit }; }
  const e = enemyFromNPC(npc, codex, { tierId: TIER });
  if (forceDemeanor) { e.demeanor = forceDemeanor; e.canTalk = false; }
  return e;
}

const mid = (w) => Math.round((w.min + w.max) / 2);

function statLine(label, e) {
  const kit = (e.abilities || []).map((a) => a.id).join(", ") || "(none)";
  return [
    label.padEnd(15),
    `HP ${String(e.maxHealth).padStart(4)}`,
    `wpn ${String(e.weapon.min).padStart(3)}-${String(e.weapon.max).padStart(3)} (mid ${String(mid(e.weapon)).padStart(3)})`,
    `pen ${String(e.weapon.pen).padStart(2)}`,
    `arm ${String(e.armor).padStart(2)}`,
    `wd ${String(e.ward).padStart(2)}`,
    `dr ${(e.dr || 0).toFixed(2)}`,
    `crit ${String(e.critChance).padStart(2)}%x${(e.critMult || 1.5).toFixed(2)}`,
    `spd ${String(e.speed).padStart(2)}`,
    `| ${kit}`,
  ].join("  ");
}

// --- the fixed reference player: a strong divine-geared hero (identical across
//     every matchup, so only the BOSS varies). Tuned to land in a sensitive
//     win-rate band against both apex foes.
// NOTE: itemCombatStats only tier-scales NAME-INFERRED gear (items with an
// explicit `combat` block are taken raw). So the reference gear is name-inferred
// (a divine "Greatsword" / "Plate" / "Helm") to get divine-scale numbers, exactly
// like the bosses' own gear. Two archetypes — a HEAVY tank (high armour, so a
// boss's plain physical swing is mostly soaked) and a LIGHT dodger (low armour,
// so basic attacks land) — bracket how a boss's kit reads across end-game builds.
function refCodex(arch = "heavy") {
  if (arch === "light") {
    return {
      characters: { wanderer: { id: "wanderer", worn: ["w", "a", "h"] } },
      items: {
        w: { id: "w", name: "Sword", kind: "weapon", tier: "divine",
             passives: [{ id: "worldbreaker", tier: "divine" }, { id: "savage", tier: "divine" }, { id: "keen-edge", tier: "divine" }, { id: "sunder", tier: "divine" }] },
        a: { id: "a", name: "Leather Jerkin", kind: "armor", tier: "divine", armorClass: "light",
             passives: [{ id: "phantom", tier: "divine" }, { id: "godward", tier: "divine" }, { id: "stalwart", tier: "divine" }, { id: "colossus", tier: "divine" }] },
        h: { id: "h", name: "Hood", kind: "clothing", tier: "divine",
             passives: [{ id: "evasion", tier: "divine" }, { id: "stalwart", tier: "divine" }] },
      },
    };
  }
  return {
    characters: { wanderer: { id: "wanderer", worn: ["w", "a", "h"] } },
    items: {
      w: { id: "w", name: "Greatsword", kind: "weapon", tier: "divine", hands: 2,
           passives: [{ id: "worldbreaker", tier: "divine" }, { id: "savage", tier: "divine" }, { id: "sunder", tier: "divine" }, { id: "keen-edge", tier: "divine" }] },
      a: { id: "a", name: "Plate", kind: "armor", tier: "divine", armorClass: "heavy",
           passives: [{ id: "godward", tier: "divine" }, { id: "colossus", tier: "divine" }, { id: "juggernaut", tier: "divine" }, { id: "bulwark", tier: "divine" }] },
      h: { id: "h", name: "Helm", kind: "clothing", tier: "divine",
           passives: [{ id: "stalwart", tier: "divine" }, { id: "stoneskin", tier: "divine" }] },
    },
  };
}
function refPlayer(arch = "heavy") {
  const base = {
    name: "Champion",
    abilities: [
      { id: "power-strike", tier: "divine" }, { id: "execute", tier: "divine" },
      { id: "rend", tier: "divine" }, { id: "rallying-shout", tier: "divine" },
      { id: "second-wind", tier: "divine" }, { id: "curse", tier: "divine" },
    ],
    proficiencies: {},
  };
  // Live derived pools: HP from Vigor + the Mind-scaled resolve pool, started full.
  const build = (c) => { recomputeVitalityMax(c); recomputeResolveMax(c); c.resolve = c.resolveMax; return c; };
  if (arch === "light") {
    return build({ ...base,
      attributes: { body: 20, reflex: 24, vigor: 18, mind: 16, wit: 20, presence: 14 } });
  }
  return build({ ...base,
    attributes: { body: 26, reflex: 18, vigor: 24, mind: 16, wit: 18, presence: 16 } });
}

// A PROPER raid party of divine, role-built characters — their "class gear" is
// modeled as innatePassives (a sim ally's worn items don't resolve), and a base
// `health` pool stands in for a tank's life-stacked kit. Roles: TANK (HP+DR),
// HEALER (party heal/shield + the costly invuln), DPS (worldbreaker burst). This
// is what an apex raid boss is meant to be fought BY.
const RAID_ROLES = {
  tank: {
    id: "ally-tank", name: "Bulwark", race: "human",
    attributes: { body: 24, reflex: 12, vigor: 30, mind: 14, wit: 12, presence: 16 },
    health: 220, // a tank stacks life — base pool ×tier
    innatePassives: [
      { id: "colossus", tier: "divine" }, { id: "juggernaut", tier: "divine" },
      { id: "godward", tier: "divine" }, { id: "bulwark", tier: "divine" },
      { id: "stoneskin", tier: "divine" }, { id: "stalwart", tier: "divine" },
    ],
    abilities: ["power-strike", "bulwark-stance", "rallying-shout", "second-wind"], worn: [],
  },
  healer: {
    id: "ally-healer", name: "Lightbearer", race: "human",
    attributes: { body: 12, reflex: 14, vigor: 22, mind: 22, wit: 16, presence: 26 },
    health: 150,
    innatePassives: [
      { id: "aegis", tier: "divine" }, { id: "barrier", tier: "divine" },
      { id: "wardstone", tier: "divine" }, { id: "godward", tier: "divine" },
      { id: "stalwart", tier: "divine" }, { id: "colossus", tier: "mythical" },
    ],
    abilities: ["sanctify", "guardian-aegis", "last-sanctuary", "battle-hymn", "heal"], worn: [],
  },
  dps: {
    id: "ally-dps", name: "Reaver", race: "human",
    attributes: { body: 26, reflex: 20, vigor: 18, mind: 14, wit: 18, presence: 12 },
    health: 130,
    innatePassives: [
      { id: "worldbreaker", tier: "divine" }, { id: "savage", tier: "divine" },
      { id: "sunder", tier: "divine" }, { id: "keen-edge", tier: "divine" },
      { id: "brutal", tier: "divine" }, { id: "stalwart", tier: "mythical" },
    ],
    abilities: ["power-strike", "execute", "rend", "wrath", "second-wind"], worn: [],
  },
};
// allyCount picks how many of the role line-up to field (tank, healer, then dps).
function buildAllies(n) {
  const order = ["tank", "healer", "dps", "dps"];
  const out = [];
  for (let i = 0; i < n; i++) {
    const tmpl = RAID_ROLES[order[i] || "dps"];
    out.push(allyFromCompanion({ ...tmpl, id: `${tmpl.id}-${i}` }, codex, { tierId: TIER }));
  }
  return out;
}

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);

// AI drives the reference player too (focus-fire + best move), exactly like the
// stock combat-sim harness.
function choosePlayerAction(cs) {
  const candidates = cs.player.abilities
    .map((a) => ({ id: a.id, tier: a.tier || "common", def: getAbilityDef(a.id) }))
    .filter((c) => c.def && c.id !== "talk" && abilityUsable(cs, c.id));
  const opp = cs.enemies.filter((e) => e.health > 0 && !e.resolved);
  if (opp.length === 0) return null;
  const party = [cs.player, ...(cs.allies || [])].filter((a) => a.health > 0 && !a._dead && !a.resolved);
  const choice = chooseAction(cs.player, opp, candidates, { allies: party });
  if (!choice) return { abilityId: BASIC_ATTACK.id, targetIndex: cs.enemies.indexOf(opp[0]) };
  const targetIndex = choice.target ? cs.enemies.indexOf(choice.target) : cs.enemies.indexOf(opp[0]);
  return { abilityId: choice.ability.id, targetIndex };
}

function runFight(makeBoss, allyCount, arch) {
  const allies = allyCount ? buildAllies(allyCount) : [];
  let cs = initCombat(refPlayer(arch), refCodex(arch), [makeBoss()], { allies });
  let guard = 0;
  while (!TERMINAL.has(cs.phase) && guard++ < 600) {
    if (cs.phase !== "player") break;
    // spend every action point each turn
    let acted = true;
    while (acted && !TERMINAL.has(cs.phase)) {
      const a = choosePlayerAction(cs);
      if (a && abilityUsable(cs, a.abilityId)) cs = playerAct(cs, a.abilityId, a.targetIndex);
      else acted = false;
    }
    if (TERMINAL.has(cs.phase)) break;
    cs = endTurn(cs);
  }
  return cs;
}

function scenario(label, makeBoss, allyCount = 0, arch = "heavy") {
  let pWin = 0, turns = 0, hp = 0, bossYield = 0;
  for (let i = 0; i < RUNS; i++) {
    const cs = runFight(makeBoss, allyCount, arch);
    // The PLAYER prevailing (boss dead, fled, or yielded) counts as a player win.
    if (cs.phase === "victory" || cs.phase === "resolved") pWin++;
    if (cs.enemies.some((e) => e.resolved === "yielded" || e.resolved === "fled")) bossYield++;
    turns += cs.turn;
    hp += cs.player.health / cs.player.maxHealth;
  }
  const pct = (n) => `${((n / RUNS) * 100).toFixed(0)}%`.padStart(4);
  console.log(
    "  " + label.padEnd(26),
    `playerWin ${pct(pWin)}`,
    `· bossHardness ${pct(RUNS - pWin)}`,
    `· turns ${(turns / RUNS).toFixed(1).padStart(4)}`,
    `· playerEndHP ${((hp / RUNS) * 100).toFixed(0).padStart(3)}%`,
    `· bossBroke ${pct(bossYield)}`,
  );
}

console.log(`\n=== Apex-boss parity — ${RUNS} runs/scenario, tier=${TIER} ===\n`);

// Reference champion derived stats (so we can see the fight is competitive).
for (const arch of ["heavy", "light"]) {
  const c = deriveCombatStats(refPlayer(arch), refCodex(arch));
  console.log(`REFERENCE CHAMPION (${arch}):`,
    `HP ${c.maxHealth}`, `wpn ${c.weapon.min}-${c.weapon.max} (mid ${mid(c.weapon)})`,
    `pen ${c.weapon.pen}`, `arm ${c.armor}`, `wd ${c.ward}`, `dodge ${c.dodge}`, `dr ${c.dr.toFixed(2)}`,
    `crit ${c.critChance}%x${c.critMult.toFixed(2)}`);
}

console.log("\nSTAT BLOCKS (built via enemyFromNPC):");
console.log(statLine("DK (fallback)", buildBoss("demon-king", { stripKit: true })));
console.log(statLine("DK (authored)", buildBoss("demon-king")));
console.log(statLine("Vyrnholt", buildBoss("great-wyrm")));

// The Demon King AS AUTHORED (reads the abilities array straight from
// initial-state.js) against its old generic fallback and the Vyrnholt benchmark.
// Lower playerWin / higher bossHardness = a tougher boss. Parity = the authored
// DK lands NEAR Vyrnholt; the guardrail is it must NOT be clearly tougher.
const KITS = [
  ["DK fallback (no kit)", { stripKit: true }],
  ["DK authored", {}],
  [">> Vyrnholt benchmark <<", {}, "great-wyrm"],
];

function block(allyCount, arch, forceDemeanor = "fanatic") {
  for (const [l, o, npc] of KITS)
    scenario(l, () => buildBoss(npc || "demon-king", { ...o, forceDemeanor }), allyCount, arch);
}

console.log("\nSOLO vs HEAVY champion (forced to the death — raw combat power):");
block(0, "heavy");
console.log("\nSOLO vs LIGHT champion (low armour — basic attacks land):");
block(0, "light");
console.log("\nPARTY (heavy champ + 3 divine allies — exercises the AoE):");
block(3, "heavy");
console.log("\nSOLO vs HEAVY, NATURAL demeanor (DK 'honorable' may yield; wyrm 'fierce'):");
block(0, "heavy", null);

console.log("");
