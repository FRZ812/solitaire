// Combat simulation harness. Drives the real engine (engine/combat.js) with the
// shared AI (engine/combat-ai.js) on BOTH sides — including the player — and runs
// thousands of fights per scenario to surface win rates, fight length, yield
// rates, and companion losses, so the AI + difficulty + yield tuning can be
// checked at scale. Run: node scripts/combat-sim.mjs [runsPerScenario]
//
// Pure Node — no React in the import chain.

import { initCombat, playerAct, endTurn, abilityUsable, rollLoot, canStandDown, playerStandDown, applyCombatResult } from "../src/engine/combat.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";
import { generateEnemy, generateEnemyGroup, allyFromCompanion } from "../src/data/bestiary.js";
import { COMPANIONS } from "../src/data/companions.js";
import { aggregateCombatPassives, applyFusion, FUSIONS, PASSIVE_CAPS, RUNES } from "../src/data/passives.js";
import { fusionOptionsForRune, applyFusionToItem } from "../src/engine/fusion.js";
import { recomputeVitalityMax, recomputeResolveMax } from "../src/engine/attributes.js";

// Build a sim fighter on the live derived pools: HP from Vigor, the Mind-scaled
// resolve pool (no per-turn regen now), started full.
function makeFighter(c) {
  recomputeVitalityMax(c);
  recomputeResolveMax(c);
  c.resolve = c.resolveMax;
  return c;
}

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

function runFight(makeEnemies, allyKeys, tierId, protag = midPlayer) {
  const allies = allyKeys.length ? buildAllies(allyKeys, tierId) : [];
  let cs = initCombat(protag(), codex, makeEnemies(), { allies });
  let guard = 0;
  while (!TERMINAL.has(cs.phase) && guard++ < 300) {
    if (cs.phase !== "player") break;
    // No foe still fighting (the rest yielded or fled) → stand down (spare them).
    if (canStandDown(cs)) { cs = playerStandDown(cs); break; }
    const act = choosePlayerAction(cs);
    if (act && abilityUsable(cs, act.abilityId)) {
      cs = playerAct(cs, act.abilityId, act.targetIndex);
      if (TERMINAL.has(cs.phase)) break;
    }
    cs = endTurn(cs);
  }
  return cs;
}

function scenario(label, makeEnemies, allyKeys = [], tierId = "common", protag = midPlayer) {
  let wins = 0, losses = 0, resolved = 0, fled = 0;
  let turns = 0, hpSum = 0, yields = 0, foeCount = 0, allyDeaths = 0, allyCount = 0;
  for (let i = 0; i < RUNS; i++) {
    const cs = runFight(makeEnemies, allyKeys, tierId, protag);
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
  let cs = initCombat(player, codex, makeEnemies());
  let guard = 0, acts = 0;
  while (!TERMINAL.has(cs.phase) && guard++ < 400) {
    if (cs.phase !== "player") break;
    if (canStandDown(cs)) { cs = playerStandDown(cs); break; }
    let acted = true;
    while (acted && !TERMINAL.has(cs.phase)) {
      const a = choosePlayerAction(cs);
      if (a && abilityUsable(cs, a.abilityId)) { cs = playerAct(cs, a.abilityId, a.targetIndex); acts++; }
      else acted = false;
    }
    if (TERMINAL.has(cs.phase)) break;
    cs = endTurn(cs);
  }
  return { cs, acts };
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

console.log("ToW SYSTEMS — action economy (acts/turn should be ~1 baseline, >1 swift)");
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
