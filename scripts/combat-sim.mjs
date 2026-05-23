// Combat simulation harness. Drives the real engine (engine/combat.js) with the
// shared AI (engine/combat-ai.js) on BOTH sides — including the player — and runs
// thousands of fights per scenario to surface win rates, fight length, yield
// rates, and companion losses, so the AI + difficulty + yield tuning can be
// checked at scale. Run: node scripts/combat-sim.mjs [runsPerScenario]
//
// Pure Node — no React in the import chain.

import { initCombat, playerAct, endTurn, abilityUsable, rollLoot, canStandDown, playerStandDown } from "../src/engine/combat.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";
import { generateEnemyGroup, allyFromCompanion } from "../src/data/bestiary.js";
import { COMPANIONS } from "../src/data/companions.js";
import { aggregateCombatPassives, applyFusion, FUSIONS, PASSIVE_CAPS, RUNES } from "../src/data/passives.js";
import { fusionOptionsForRune, applyFusionToItem } from "../src/engine/fusion.js";
import { recomputeVitalityMax } from "../src/engine/attributes.js";

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
  return recomputeVitalityMax({
    name: "Player", resolve: 5, resolveMax: 5,
    attributes: { body: 4, reflex: 4, vigor: 4, mind: 2, wit: 3, presence: 2 },
    abilities: [
      { id: "power-strike", tier: "common" }, { id: "rend", tier: "common" },
      { id: "second-wind", tier: "common" },
    ],
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

function runFight(makeEnemies, allyKeys, tierId) {
  const allies = allyKeys.length ? buildAllies(allyKeys, tierId) : [];
  let cs = initCombat(midPlayer(), codex, makeEnemies(), { allies });
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

// ===========================================================================
// ToW SYSTEMS VERIFICATION — action economy, swift, defence, DoT/crit, fusion.
// ===========================================================================

// A capable hero who meets epic/legendary item requirements (so affixes switch
// on) and the action points to act several times a turn.
function hero(extra = []) {
  return recomputeVitalityMax({
    name: "Hero", resolve: 12, resolveMax: 12,
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
