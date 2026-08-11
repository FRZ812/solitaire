// Combat simulation harness. Drives the real engine (engine/combat.js) with the
// shared AI (engine/combat-ai.js) on BOTH sides — including the player — and runs
// thousands of fights per scenario to surface win rates, fight length, yield
// rates, and companion losses, so the AI + difficulty + yield tuning can be
// checked at scale. Run: node scripts/combat-sim.mjs [runsPerScenario]
//
// Pure Node — no React in the import chain.

import { initCombat, playerAct, endTurn, abilityUsable, canStandDown, playerStandDown } from "../src/engine/combat.js";
import { rollLoot } from "../src/engine/combat-loot.js";
import { applyCombatResult } from "../src/engine/combat-result.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";
import { generateEnemy, generateEnemyGroup, allyFromCompanion } from "../src/data/bestiary.js";
import { COMPANIONS } from "../src/data/companions.js";
import { aggregateCombatPassives, applyFusion, FUSIONS, PASSIVE_CAPS, RUNES } from "../src/data/passives.js";
import { fusionOptionsForRune, applyFusionToItem } from "../src/engine/fusion.js";
import { recomputeVitalityMax, recomputeResolveMax } from "../src/engine/attributes.js";
import { simulateFight, greedyPolicy, skillDelta } from "./sim-harness.mjs";

// Build a sim fighter on the live derived pools: HP from Vigor, the Mind-scaled
// resolve pool (no per-turn regen now), started full.
function makeFighter(c) {
  recomputeVitalityMax(c);
  recomputeResolveMax(c);
  c.resolve = c.resolveMax;
  return c;
}

// Args are order-independent so `--loop=round 400` and `400 --loop=round` both work.
const ARGV = process.argv.slice(2);
const RUNS = Number(ARGV.find((a) => /^\d+$/.test(a)) || 2000);
// Which combat model to measure. `deck` is what ships today; `round` is the
// Tower-of-Winter loop being built. Running both against identical scenarios is
// the only way to tell whether the new model is actually an improvement.
const LOOP = (ARGV.find((a) => a.startsWith("--loop="))?.split("=")[1]) || "deck";

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
// Everyone fights with REAL common gear now (mobs do too), so the protagonist's
// loadout is a real-grade blade + light armour — the fair baseline to calibrate against.
const SWORD = { name: "Iron Shortsword", dmg: { min: 5, max: 8, type: "physical", pen: 0 } };
const codex = makeCodex(SWORD, 3);

// A realistic early-mid wanderer: modest attributes, a plain blade, a couple of
// learned techniques (no Cleave AoE, so groups can't be wiped in one swing).
function midPlayer() {
  return makeFighter({
    name: "Player",
    attributes: { body: 4, reflex: 4, vigor: 4, mind: 2, wit: 3, presence: 2 },
    abilities: [
      { id: "power-strike", tier: "common" }, { id: "rend", tier: "common" },
      { id: "second-wind", tier: "common" },
    ],
    proficiencies: {},
  });
}

// CALIBRATION ANCHOR: an AVERAGE person ≈ Senna Rell (companions.js). The world is
// fantastical but punishing — an average person should be ~40% to win a 1-v-1 vs a
// lone bandit (bandits are slightly stronger), and ~0% against two. Everyone has to
// prepare; ganging up is expected.
//
// !! THESE TARGETS ARE NOT MET. Baseline measured 2026-08-09, 400 runs/scenario,
// after the harness was repaired (see runFight below — the previous numbers were
// an artifact of a sim that acted once per turn and aborted fights mid-way):
//
//   avg vs 1 bandit      100%  (target ~40%)     solo vs 3 goblins   93%
//   avg vs 2 bandits      10%  (target ~0%)      solo vs 4 bandits    4%
//   solo vs 2 bandits    100%                    party vs 5 orcs      0%  (1.2 turns)
//
// The defect is not that a number is off — it is that there is NO GRADIENT.
// Win rates run 100 / 100 / 93 / 4 / 0 with almost nothing in between, so an
// encounter is decided before it is played. Three related findings:
//
//   1. Fights last 2-4 rounds and are usually settled in the first exchange.
//   2. Build choice is inert: every archetype below wins 100% vs 6 epic
//      orc-raiders. The comparison currently measures nothing.
//   3. The action-economy lever is dead. `actionsPerTurn` is vestigial under the
//      deck loop — energy (3) is the real cap — so "+1 action" and "+2 actions"
//      produce 2.69 and 2.42 acts/turn against a 2.47 baseline. Extra actions
//      buy nothing, the same way rollInitiative/advanceQueue are unreachable.
//
// The redesign's replacement anchors (see the plan) are a 65-75% baseline duel,
// median 4-7 rounds, and a >=25pt skill delta between considered and random play.
function avgPerson() {
  return makeFighter({
    name: "Average (Senna)",
    attributes: { body: 1, reflex: 4, vigor: 2, mind: 2, wit: 3, presence: 1 },
    abilities: [],
    proficiencies: {},
  });
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
  const party = [cs.player, ...(cs.allies || [])].filter((a) => a.health > 0 && !a._dead && !a.resolved);
  const choice = chooseAction(cs.player, opp, candidates, { allies: party });
  if (!choice) return { abilityId: BASIC_ATTACK.id, targetIndex: cs.enemies.indexOf(opp[0]) };
  const targetIndex = choice.target ? cs.enemies.indexOf(choice.target) : cs.enemies.indexOf(opp[0]);
  return { abilityId: choice.ability.id, targetIndex };
}

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);

// Delegates to the shared harness. The previous inline loop acted ONCE per turn
// under a three-energy model and bailed out of the fight whenever the phase was
// not "player" — so most of each turn was thrown away and aborted fights were
// silently counted as neither win nor loss. That is why the calibration anchor
// below read 15% against a stated target of 40%, and why several scenarios
// reported a flat 0%.
function runFight(makeEnemies, allyKeys, tierId, protag = midPlayer) {
  const allies = allyKeys.length ? buildAllies(allyKeys, tierId) : [];
  return simulateFight({
    player: protag(), codex, enemies: makeEnemies(), allies, policy: greedyPolicy,
    opts: { loop: LOOP },
  });
}

function scenario(label, makeEnemies, allyKeys = [], tierId = "common", protag = midPlayer) {
  let wins = 0, losses = 0, resolved = 0, fled = 0, aborted = 0;
  let turns = 0, hpSum = 0, acts = 0, yields = 0, foeCount = 0, allyDeaths = 0, allyCount = 0;
  for (let i = 0; i < RUNS; i++) {
    const run = runFight(makeEnemies, allyKeys, tierId, protag);
    const cs = run.cs;
    // A fight that never reached a terminal phase is a harness/engine failure,
    // not a balance datum. Counting it as a loss is how the old numbers lied.
    if (run.aborted) { aborted++; continue; }
    if (cs.phase === "victory") wins++;
    else if (cs.phase === "resolved") { resolved++; wins++; } // resolved = you stood, foes broke
    else if (cs.phase === "defeat") losses++;
    else if (cs.phase === "playerFled") fled++;
    turns += run.rounds;
    acts += run.acts / Math.max(1, run.rounds);
    hpSum += cs.player.health / cs.player.maxHealth;
    yields += cs.enemies.filter((e) => e.resolved === "yielded").length;
    foeCount += cs.enemies.length;
    allyCount += (cs.allies || []).length;
    allyDeaths += (cs.allies || []).filter((a) => a._dead).length;
  }
  const scored = Math.max(1, RUNS - aborted);
  const pct = (n) => `${((n / scored) * 100).toFixed(0)}%`;
  console.log(
    label.padEnd(34),
    `win ${pct(wins).padStart(4)}`,
    `lose ${pct(losses).padStart(4)}`,
    `· turns ${(turns / scored).toFixed(1).padStart(4)}`,
    `· acts/rd ${(acts / scored).toFixed(2)}`,
    `· endHP ${((hpSum / scored) * 100).toFixed(0).padStart(3)}%`,
    `· yield ${foeCount ? ((yields / foeCount) * 100).toFixed(0) : 0}%`.padStart(9),
    allyCount ? `· allyDeath ${((allyDeaths / Math.max(1, allyCount)) * 100).toFixed(0)}%` : "",
    aborted ? `  !! ${aborted} ABORTED` : "",
  );
}

console.log(`\n=== Combat simulation — ${RUNS} runs/scenario · loop=${LOOP} ===\n`);
console.log("CALIBRATION — average person (Senna); target: 1 bandit ~40%, 2 bandits ~0%");
scenario("avg vs 1 bandit", () => generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), [], "common", avgPerson);
scenario("avg vs 2 bandits", () => generateEnemyGroup("bandits", { count: 2, maxTier: "common" }), [], "common", avgPerson);
scenario("avg vs 1 goblin", () => generateEnemyGroup("goblins", { count: 1, maxTier: "common" }), [], "common", avgPerson);
console.log("");
console.log("SOLO (above-average wanderer)");
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

// SKILL DELTA — the measurement this whole redesign is accountable to.
//
// Same character, same foes, considered play versus random legal play. If the
// gap is small then outcomes are decided by dice rather than by decisions, and
// no amount of tuning individual numbers fixes that. It is the direct
// mechanical answer to the "success or failure came down to luck instead of
// skill" criticism levelled at the game this design draws from.
//
// Target: >= 25 points. Measured on the deck loop it is expected to be POOR —
// that is the finding, not a bug in the sim.
console.log("SKILL DELTA — considered vs random play (target >=25pts)");
const DELTA_RUNS = Math.min(RUNS, 300);
const deltaFight = (kind, count, maxTier = "common") => () => ({
  player: midPlayer(), codex,
  enemies: generateEnemyGroup(kind, { count, maxTier }),
  opts: { loop: LOOP },
});
skillDelta("solo vs 2 bandits", deltaFight("bandits", 2), DELTA_RUNS);
skillDelta("solo vs 3 goblins", deltaFight("goblins", 3), DELTA_RUNS);
skillDelta("solo vs 1 ogre", deltaFight("ogre", 1), DELTA_RUNS);
skillDelta("solo vs 4 bandits", deltaFight("bandits", 4), DELTA_RUNS);
console.log("");

// ---------------------------------------------------------------------------
// MIND CONTROL — Charm (pacify) / Dominate (turn them on their own), will-save.
// ---------------------------------------------------------------------------
console.log("MIND CONTROL (Charm / Dominate)");
// A high-Will enchanter who ONLY controls (no real attacks) should still win by
// turning foes on each other / pacifying them — impossible without the mechanic.
function enchanter() {
  return makeFighter({
    name: "Enchanter",
    attributes: { body: 2, reflex: 3, vigor: 3, mind: 16, wit: 4, presence: 12 },
    abilities: [{ id: "dominate", tier: "mythical" }, { id: "charm", tier: "epic" }, { id: "dispel", tier: "epic" }],
    proficiencies: {},
  });
}
{
  const N = 600;
  let hasWill = true, landed = 0, converted = 0, ffTrials = 0, friendlyFire = 0;
  let charmTrials = 0, charmedStoodDown = 0;
  const findByUid = (cs, uid) => [cs.player, ...(cs.allies || []), ...cs.enemies].find((c) => c.uid === uid);
  for (let i = 0; i < N; i++) {
    // DOMINATE: a landed cast PERMANENTLY enthralls the foe — it switches to your side.
    let cs = initCombat(enchanter(), codex, generateEnemyGroup("bandits", { count: 2, maxTier: "common" }), { allies: [] });
    if (cs.phase === "player") {
      if (typeof cs.player.will !== "number" || typeof cs.enemies[0].will !== "number") hasWill = false;
      const tgt = cs.enemies.find((e) => e.health > 0);
      const idx = cs.enemies.indexOf(tgt);
      cs = playerAct(cs, "dominate", idx);
      const after = findByUid(cs, tgt.uid);
      if (after && (after.statuses || []).some((s) => s.type === "enthralled")) {
        landed++;
        if ((cs.allies || []).some((a) => a.uid === tgt.uid)) converted++; // moved to your side
        cs = endTurn(cs); // the new thrall should now strike its former ally
        ffTrials++;
        if (cs.enemies.some((e) => e.health < e.maxHealth)) friendlyFire++;
      }
    }
    // CHARM: a charmed lone bandit stands down — the player takes no damage from it.
    let c2 = initCombat(enchanter(), codex, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), { allies: [] });
    if (c2.phase === "player") {
      c2 = playerAct(c2, "charm", 0);
      if ((c2.enemies[0]?.statuses || []).some((s) => s.type === "charmed")) {
        const hp = c2.player.health;
        c2 = endTurn(c2);
        charmTrials++;
        if (c2.player.health >= hp) charmedStoodDown++;
      }
    }
  }
  const p = (n, d) => `${Math.round((n / Math.max(1, d)) * 100)}%`;
  console.log(`  will on player + foes: ${hasWill ? "OK" : "FAIL"}`);
  console.log(`  Dominate lands on a weak-willed bandit: ${p(landed, N)} — ${landed / N >= 0.7 ? "OK" : "LOW"}`);
  console.log(`  Enthralled foe switches to your side: ${p(converted, landed)} — ${converted / Math.max(1, landed) >= 0.99 ? "OK" : "LOW"}`);
  console.log(`  New thrall then strikes its former ally: ${p(friendlyFire, ffTrials)} — ${friendlyFire / Math.max(1, ffTrials) >= 0.6 ? "OK" : "LOW"}`);
  console.log(`  Charmed foe stands down (no damage to you): ${p(charmedStoodDown, charmTrials)} — ${charmedStoodDown / Math.max(1, charmTrials) >= 0.9 ? "OK" : "LOW"}`);

  // PERSISTENCE: enthralling the LAST foe ENDS combat AND files the thrall into the party.
  let ended = 0, entered = 0, T = 300;
  for (let i = 0; i < T; i++) {
    let cs = initCombat(enchanter(), codex, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), { allies: [] });
    if (cs.phase !== "player") continue;
    cs = playerAct(cs, "dominate", 0);
    if (cs.phase !== "victory" && cs.phase !== "resolved") continue; // last foe converted → combat must end
    ended++;
    const st = { character: { vitality: cs.player.health, vitalityMax: cs.player.maxHealth, proficiencies: {}, resolve: 0, resolveMax: 0, conditions: [], inventory: { carried: [], coins: { copper: 0, silver: 0, gold: 0 } } }, world: { codex: { characters: { wanderer: {} }, items: {} } }, party: [], beats: [], apiHistory: [] };
    const next = applyCombatResult(st, cs, {});
    const tid = (next.party || [])[0];
    const ch = tid && next.world.codex.characters[tid];
    if (ch && (ch.conditions || []).some((c) => c.name === "Enthralled")) entered++;
  }
  console.log(`  Enthralling the LAST foe ends combat: ${ended}/${T} fights resolved`);
  console.log(`  Thrall enters party w/ Enthralled condition: ${p(entered, ended)} — ${entered / Math.max(1, ended) >= 0.95 ? "OK" : "LOW"}`);

  // DISPEL is a contest of the dispeller's will vs the ORIGINAL binder's (stored
  // dominationWill) — not a save by the thrall. Mark a foe enthralled by a weak vs a
  // strong binder, then have the (high-will) enchanter dispel it.
  const freedVs = (binderWill) => {
    let freed = 0, A = 400;
    for (let i = 0; i < A; i++) {
      let cs = initCombat(enchanter(), codex, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), { allies: [] });
      if (cs.phase !== "player") { A--; continue; }
      const e = cs.enemies[0];
      e.enthralledBy = "x"; e.dominationWill = binderWill; e.enthralledFrom = "enemy";
      e.statuses = [...(e.statuses || []), { type: "enthralled", value: 1, duration: 99999 }];
      cs = playerAct(cs, "dispel", 0);
      const still = [cs.player, ...(cs.allies || []), ...cs.enemies].find((c) => c.enthralledBy === "x");
      if (!still) freed++;
    }
    return Math.round((freed / Math.max(1, A)) * 100);
  };
  const weak = freedVs(2), strong = freedVs(40);
  console.log(`  Dispel frees a WEAK-binder thrall: ${weak}% — ${weak >= 80 ? "OK" : "LOW"}`);
  console.log(`  Dispel fails vs a STRONG binder: ${strong}% freed — ${strong <= 20 ? "OK" : "HIGH"}`);

  // DIVINE breaks laws: a divine Dominate ignores controlResist (a god's will is pure).
  // Same foe (will 10, controlResist 0.60) the enchanter out-wills: mythical is capped
  // by the 0.60 resist, divine ignores it.
  const dominateLand = (tier) => {
    let land = 0, A = 400;
    for (let i = 0; i < A; i++) {
      let cs = initCombat(enchanter(), codex, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), { allies: [] });
      if (cs.phase !== "player") { A--; continue; }
      const e = cs.enemies[0]; e.will = 10; e.controlResist = 0.6;
      cs.player.abilities = cs.player.abilities.map((ab) => ab.id === "dominate" ? { ...ab, tier } : ab);
      cs = playerAct(cs, "dominate", 0);
      const bound = [cs.player, ...(cs.allies || []), ...cs.enemies].find((c) => c.uid === e.uid && (c.statuses || []).some((s) => s.type === "enthralled"));
      if (bound) land++;
    }
    return Math.round((land / Math.max(1, A)) * 100);
  };
  const myth = dominateLand("mythical"), div = dominateLand("divine");
  console.log(`  Mythical Dominate vs 0.6-controlResist foe: ${myth}% (capped by resist)`);
  console.log(`  DIVINE Dominate ignores resist: ${div}% — ${div >= 95 ? "OK" : "LOW"}`);

  // DIVINE Charm binds PERMANENTLY (artificial devotion): switches the foe to your side
  // in-combat AND persists into the party afterward as a Charmed devotee (high relationship).
  let charmBound = 0, charmFiled = 0, C = 300;
  for (let i = 0; i < C; i++) {
    let cs = initCombat(enchanter(), codex, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), { allies: [] });
    if (cs.phase !== "player") { C--; continue; }
    cs.player.abilities = cs.player.abilities.map((ab) => ab.id === "charm" ? { ...ab, tier: "divine" } : ab);
    cs = playerAct(cs, "charm", 0);
    if ((cs.allies || []).some((a) => a.bindKind === "charm" && (a.statuses || []).some((s) => s.type === "enthralled"))) charmBound++;
    if (cs.phase === "victory" || cs.phase === "resolved") {
      const st = { character: { vitality: cs.player.health, vitalityMax: cs.player.maxHealth, proficiencies: {}, resolve: 0, resolveMax: 0, conditions: [], inventory: { carried: [], coins: { copper: 0, silver: 0, gold: 0 } } }, world: { codex: { characters: { wanderer: {} }, items: {} } }, party: [], beats: [], apiHistory: [] };
      const next = applyCombatResult(st, cs, {});
      const tid = (next.party || [])[0];
      const ch = tid && next.world.codex.characters[tid];
      if (ch && (ch.conditions || []).some((c) => c.name === "Charmed") && (ch.relationship || 0) > 0) charmFiled++;
    }
  }
  const cb = Math.round((charmBound / Math.max(1, C)) * 100);
  const cf = Math.round((charmFiled / Math.max(1, C)) * 100);
  console.log(`  DIVINE Charm binds a devotee to your side: ${cb}% — ${cb >= 95 ? "OK" : "LOW"}`);
  console.log(`  DIVINE Charm devotee persists in party (Charmed + bond): ${cf}% — ${cf >= 90 ? "OK" : "LOW"}`);
}
console.log("");

// ===========================================================================
// ToW SYSTEMS VERIFICATION — action economy, swift, defence, DoT/crit, fusion.
// ===========================================================================

// A capable hero who meets epic/legendary item requirements (so affixes switch
// on) and the action points to act several times a turn.
function hero(extra = []) {
  return makeFighter({
    name: "Hero",
    attributes: { body: 16, reflex: 16, vigor: 16, mind: 16, wit: 12, presence: 12 },
    abilities: [{ id: "power-strike", tier: "common" }, { id: "rend", tier: "common" }, { id: "second-wind", tier: "common" }, ...extra],
    proficiencies: {},
  });
}
// Codex with a weapon + armour carrying the given affixes (epic-grade so most
// affixes can ride; req is met by the hero above).
function affixCodex(weaponPassives = [], armorPassives = []) {
  return {
    characters: { wanderer: { id: "wanderer", worn: ["w", "a"] } },
    items: {
      w: { id: "w", name: "Sword", kind: "weapon", tier: "epic", combat: { damage: { min: 4, max: 8, type: "physical", pen: 0 } }, passives: weaponPassives },
      a: { id: "a", name: "Plate", kind: "armor", tier: "epic", combat: { armor: 6 }, passives: armorPassives },
    },
  };
}

// Run a fight where the player spends ALL action points each turn (so a swift
// build actually gets to act several times). Returns the end state + action tally.
function runFull(player, codex, makeEnemies) {
  return simulateFight({ player, codex, enemies: makeEnemies(), policy: greedyPolicy, opts: { loop: LOOP } });
}

function verify(label, player, codex, makeEnemies, runs = Math.min(RUNS, 1000)) {
  let wins = 0, turns = 0, hp = 0, acts = 0;
  for (let i = 0; i < runs; i++) {
    const { cs, acts: a } = runFull(player, codex, makeEnemies);
    if (cs.phase === "victory" || cs.phase === "resolved") wins++;
    turns += cs.turn; hp += cs.player.health / cs.player.maxHealth; acts += a / Math.max(1, cs.turn);
  }
  console.log(
    label.padEnd(30),
    `win ${((wins / runs) * 100).toFixed(0).padStart(3)}%`,
    `· turns ${(turns / runs).toFixed(1).padStart(4)}`,
    `· endHP ${((hp / runs) * 100).toFixed(0).padStart(3)}%`,
    `· acts/turn ${(acts / runs).toFixed(2)}`,
  );
}

// KNOWN BROKEN: this section was written for the pre-deck 1-AP model. Under the
// deck loop energy caps the turn, so extra actions do not raise acts/turn —
// baseline 2.47, +1 action 2.69, +2 actions 2.42. Kept as a regression marker
// until the round loop makes the action economy load-bearing again.
console.log("ToW SYSTEMS — action economy (BROKEN: energy caps the turn, not actionsPerTurn)");
const FOUR_BANDITS = () => generateEnemyGroup("bandits", { count: 4, maxTier: "common" });
verify("baseline (no affixes)", hero(), affixCodex(), FOUR_BANDITS);
verify("swift (+1 action)", hero([{ id: "haste", tier: "common" }]), affixCodex([{ id: "quickened", tier: "epic" }]), FOUR_BANDITS);
verify("swift (+2, nimble@legendary)", hero(), affixCodex([{ id: "nimble", tier: "legendary" }, { id: "quickened", tier: "epic" }]), FOUR_BANDITS);

// A benchmark that actually threatens an epic-geared hero, so archetypes show
// distinct profiles (offence → faster kills, defence → higher survival).
const TOUGH = () => generateEnemyGroup("orc-raiders", { count: 6, maxTier: "epic" });
console.log("\nToW SYSTEMS — build archetypes (vs 6 epic orc-raiders)");
verify("baseline", hero(), affixCodex(), TOUGH);
verify("DoT (serrated+venom+burn)", hero([{ id: "combust", tier: "common" }]), affixCodex([{ id: "serrated", tier: "epic" }, { id: "venomous", tier: "epic" }, { id: "incendiary", tier: "epic" }]), TOUGH);
verify("crit (keen+savage+lacerate)", hero(), affixCodex([{ id: "keen-edge", tier: "epic" }, { id: "savage", tier: "epic" }, { id: "lacerate", tier: "epic" }]), TOUGH);
verify("defence (barrier+bastion)", hero([{ id: "bulwark-stance", tier: "common" }]), affixCodex([], [{ id: "barrier", tier: "epic" }, { id: "bastion", tier: "epic" }, { id: "stalwart", tier: "epic" }, { id: "stoneskin", tier: "epic" }]), TOUGH);
verify("swift vs tough", hero(), affixCodex([{ id: "nimble", tier: "legendary" }, { id: "quickened", tier: "epic" }]), TOUGH);

// Fusion: forge two components into one signature affix; assert it appears.
console.log("\nToW SYSTEMS — fusion + caps");
{
  const recipe = FUSIONS.find((f) => f.result === "rupture");
  const before = [{ id: recipe.a, tier: "epic" }, { id: recipe.b, tier: "rare" }, { id: "honed", tier: "epic" }];
  const after = applyFusion(before, recipe);
  const ok = after.some((p) => p.id === "rupture") && !after.some((p) => p.id === recipe.a) && !after.some((p) => p.id === recipe.b);
  console.log(`  fusion ${recipe.a}+${recipe.b} → rupture: ${ok ? "OK" : "FAILED"} (${after.map((p) => p.id).join(", ")})`);
}
{
  // Rune-triggered ritual: a state holding the rune + gear with both components.
  const recipe = FUSIONS.find((f) => f.result === "rupture");
  const state = {
    character: { inventory: { carried: [{ itemId: recipe.rune, quantity: 1 }] } },
    world: { codex: { items: { sword1: { id: "sword1", name: "Old Sword", kind: "weapon", tier: "epic", passives: [{ id: recipe.a, tier: "epic" }, { id: recipe.b, tier: "rare" }] } } } },
  };
  const opts = fusionOptionsForRune(state, recipe.rune);
  const r = opts.length ? applyFusionToItem(state, opts[0].itemId, opts[0].recipe.id) : { ok: false };
  const fused = r.ok && r.state.world.codex.items.sword1.passives.some((p) => p.id === "rupture");
  const runeGone = r.ok && !(r.state.character.inventory.carried.find((c) => c.itemId === recipe.rune));
  console.log(`  ritual (bind rune → fuse, consume rune): ${opts.length === 1 && fused && runeGone ? "OK" : "FAILED"}`);
}
{
  // Rare rune drops from mighty foes (deep region, epic+ ceiling).
  let drops = 0;
  for (let i = 0; i < 4000; i++) {
    const loot = rollLoot([{ kind: "ogre", tier: "epic", maxLootTier: "legendary" }], { maxLootTier: "legendary", region: 5 });
    if (loot.items.some((it) => RUNES[it.itemId])) drops++;
  }
  const pct = (drops / 4000) * 100;
  console.log(`  rune drop @ region5/epic foe: ${pct.toFixed(1)}% (expect ~5%) — ${pct > 1 && pct < 12 ? "OK" : "CHECK"}`);
}
{
  // Stack five extra-action affixes; the cap must hold at +3 (→ 4 actions total).
  const stacked = Array.from({ length: 5 }, () => ({ id: "quickened", tier: "epic" }));
  const { statMods } = aggregateCombatPassives(stacked);
  console.log(`  extraActions cap: ${statMods.extraActions} (cap ${PASSIVE_CAPS.extraActions}) — ${statMods.extraActions <= PASSIVE_CAPS.extraActions ? "OK" : "FAILED"}`);
  const ls = aggregateCombatPassives(Array.from({ length: 8 }, () => ({ id: "vampiric", tier: "epic" }))).triggers.lifesteal;
  console.log(`  lifesteal cap: ${ls} (cap ${PASSIVE_CAPS.lifesteal}) — ${ls <= PASSIVE_CAPS.lifesteal ? "OK" : "FAILED"}`);
}
console.log("");

// ===========================================================================
// DIVINE PASSIVE REBALANCE — verify the reworked apex affixes on main's structure.
// ===========================================================================

// A god-tier hero who MEETS the divine item requirement, so divine affixes switch
// on at full magnitude. HP/resolve derive from attributes via makeFighter.
function godhero(extra = []) {
  return makeFighter({
    name: "Godhero",
    attributes: { body: 26, reflex: 26, vigor: 26, mind: 26, wit: 22, presence: 18 },
    abilities: [{ id: "power-strike", tier: "common" }, { id: "rend", tier: "common" }, { id: "second-wind", tier: "common" }, ...extra],
    proficiencies: {},
  });
}
// Divine-grade gear carrying the given affixes (req met by godhero, so they fire).
function divineCodex(weaponPassives = [], armorPassives = []) {
  return {
    characters: { wanderer: { id: "wanderer", worn: ["w", "a"] } },
    items: {
      w: { id: "w", name: "Godblade", kind: "weapon", tier: "divine", combat: { damage: { min: 22, max: 36, type: "physical", pen: 0 } }, passives: weaponPassives },
      a: { id: "a", name: "Spiritsilk", kind: "armor", tier: "divine", combat: { armor: 4 }, passives: armorPassives },
    },
  };
}
// True divine foes (rollTier skews low even at max luck, so force the tier).
const divineFoes = (kind, n) => () => Array.from({ length: n }, (_, i) => generateEnemy(kind, { tierId: "divine", index: i, total: n }));

console.log("PASSIVE REBALANCE — divine stat magnitudes + caps");
{
  const one = (id) => aggregateCombatPassives([{ id, tier: "divine" }]);
  const ok = (label, got, want) => console.log(`  ${label.padEnd(30)} ${got} (want ${want}) — ${got === want ? "OK" : "FAILED"}`);
  ok("phantom → phaseChance", one("phantom").statMods.phaseChance, 0.25);
  ok("deadeye → dodgeIgnore", one("deadeye").statMods.dodgeIgnore, 1);
  ok("godward → drPct", one("godward").statMods.drPct, 0.3);
  ok("inviolate → invulnCharges", one("aegis-eternal").triggers.invulnCharges, 2);
  ok("undying → reviveOnce", one("undying").triggers.reviveOnce, 0.6);
  const cap = (label, list, get, lim) => { const v = get(aggregateCombatPassives(list)); console.log(`  ${label.padEnd(30)} ${v} (cap ${lim}) — ${v <= lim ? "OK" : "FAILED"}`); };
  cap("phaseChance cap", [{ id: "phantom", tier: "divine" }, { id: "phantom", tier: "divine" }], (a) => a.statMods.phaseChance, PASSIVE_CAPS.phaseChance);
  cap("dodgeIgnore cap", [{ id: "deadeye", tier: "divine" }, { id: "deadeye", tier: "divine" }], (a) => a.statMods.dodgeIgnore, PASSIVE_CAPS.dodgeIgnore);
  cap("invulnCharges cap", [{ id: "aegis-eternal", tier: "divine" }, { id: "aegis-eternal", tier: "divine" }], (a) => a.triggers.invulnCharges, PASSIVE_CAPS.invulnCharges);
}

console.log("\nPASSIVE REBALANCE — divine builds (vs 5 divine orc-raiders)");
const DFOES = divineFoes("orc-raiders", 5);
verify("baseline (divine gear)", godhero(), divineCodex(), DFOES);
verify("phantom (phase 25%)", godhero(), divineCodex([], [{ id: "phantom", tier: "divine" }]), DFOES);
verify("godward (30% DR)", godhero(), divineCodex([], [{ id: "godward", tier: "divine" }]), DFOES);
verify("inviolate (2 invuln)", godhero(), divineCodex([], [{ id: "aegis-eternal", tier: "divine" }]), DFOES);
verify("undying (revive)", godhero(), divineCodex([], [{ id: "undying", tier: "divine" }]), DFOES);

// Deadeye's lane is anti-evasion: vs a max-dodge foe, baseline misses a share of
// strikes; Deadeye's no-dodge hits land every time (fewer turns to kill).
console.log("\nPASSIVE REBALANCE — Deadeye vs a max-dodge divine foe");
const evasiveFoe = () => { const e = generateEnemy("bandits", { tierId: "divine", index: 0, total: 1 }); e.dodge = 70; e.maxHealth = e.health = 2500; e.weapon = { ...e.weapon, min: 4, max: 8 }; return [e]; };
verify("baseline vs evasive", godhero(), divineCodex(), evasiveFoe);
verify("deadeye vs evasive", godhero(), divineCodex([{ id: "deadeye", tier: "divine" }]), evasiveFoe);
console.log("");
