// Smithing: apprenticeship, material checks, the forge minigame's quality→tier
// mapping, and applying a forge / an apprenticeship to game state.
//
// Recipe access lives on character.crafting.blacksmith.rank (0 = untrained),
// while time at the anvil also advances the character's shared progression.
// Forged gear's POWER comes from its output TIER (combat-stats infers stats from
// name + tier), so the minigame just decides how many tiers above the recipe's
// base the piece lands — capped by the smith's rank.

import { advanceTime } from "./time.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";
import { spoilState } from "./spoilage.js";
import { ageState } from "./aging.js";
import { itemTemplate } from "../data/catalog.js";
import { TIERS, tierOrder, tierMult, tierLabel } from "../data/tiers.js";
import { advanceProgression, earnedLevelGrowthText, projectCharacterProgression } from "./progression.js";

export function blacksmithRank(state) {
  return state.character?.crafting?.blacksmith?.rank || 0;
}

// What the player can forge tops out by rank: Apprentice→rare, Journeyman→
// very-rare, Master→epic. Keeps a minigame from minting legendary gear.
export function capTierOrderForRank(rank) {
  if (rank >= 3) return 4; // epic
  if (rank >= 2) return 3; // very-rare
  return 2;                // rare
}

const tierIdByOrder = (o) => TIERS[Math.max(0, Math.min(TIERS.length - 1, o))].id;

// A single anvil strike scores by how cleanly it landed (0..1 accuracy):
// dead-on = a full point, decent = a half, a miss = nothing.
export function classifyStrike(acc) {
  return acc >= 0.85 ? 1 : acc >= 0.5 ? 0.5 : 0;
}

// Reduce the strikes of a forging attempt to a quality grade + tier bump.
export function forgeQuality(strikes) {
  const points = strikes.reduce((s, a) => s + classifyStrike(a), 0);
  const norm = points / (strikes.length || 1);
  if (points === 0) return { points, bump: 0, grade: "Flawed" };
  if (norm >= 0.83) return { points, bump: 2, grade: "Masterwork" };
  if (norm >= 0.5) return { points, bump: 1, grade: "Fine" };
  return { points, bump: 0, grade: "Standard" };
}

// Final output tier: recipe base raised by the minigame bump, clamped to rank.
export function resolveForgeTier(baseTier, bump, rank) {
  const order = Math.min(tierOrder(baseTier) + bump, capTierOrderForRank(rank));
  return tierIdByOrder(order);
}

// Do we have the materials (and coin) for this recipe? Returns the shortfalls.
export function canForge(state, schematic) {
  const carried = state.character.inventory.carried;
  const missing = [];
  for (const req of schematic.requires || []) {
    const have = carried.find((c) => c.itemId === req.id)?.quantity || 0;
    if (have < req.qty) missing.push({ id: req.id, need: req.qty, have });
  }
  const coinShort = schematic.coinCp ? !canAfford(state.character.inventory.coins, schematic.coinCp) : false;
  return { ok: missing.length === 0 && !coinShort, missing, coinShort };
}

// Forge an item at the given output tier: consume materials (+coin), produce the
// graded item into the codex + pack, and advance time. Returns { state, ok,
// item }. A piece above its recipe's base tier gets a tier-qualified id + name
// so quality is preserved distinctly in the pack.
export function applyForge(state, schematic, tier) {
  const template = itemTemplate(schematic.item);
  if (!template) return { state, ok: false, reason: "Unknown item." };
  const check = canForge(state, schematic);
  if (!check.ok) return { state, ok: false, reason: "Missing materials or coin." };

  const carried = state.character.inventory.carried.map((c) => ({ ...c }));
  for (const req of schematic.requires || []) {
    const idx = carried.findIndex((c) => c.itemId === req.id);
    carried[idx].quantity -= req.qty;
    if (carried[idx].quantity <= 0) carried.splice(idx, 1);
  }

  let coins = state.character.inventory.coins;
  if (schematic.coinCp) coins = copperToCoins(coinsToCopper(coins) - schematic.coinCp);

  const graded = tier !== template.tier;
  const itemId = graded ? `${template.id}-${tier}` : template.id;
  const itemDef = {
    ...template,
    id: itemId,
    tier,
    name: graded ? `${template.name} · ${tierLabel(tier)}` : template.name,
    value: Math.round((template.value || 0) * tierMult(tier)),
  };

  const items = { ...state.world.codex.items };
  if (!items[itemId]) items[itemId] = itemDef;

  const ex = carried.find((c) => c.itemId === itemId);
  if (ex) ex.quantity += 1;
  else carried.push({ itemId, quantity: 1 });

  const time = advanceTime(state.time, schematic.minutes || 60);

  let next = {
    ...state,
    time,
    character: { ...state.character, inventory: { ...state.character.inventory, coins, carried } },
    world: { ...state.world, codex: { ...state.world.codex, items } },
  };
  const progress = advanceProgression(next.character, Math.max(60, schematic.minutes || 60) * 2 + tierOrder(tier) * 50);
  if (progress.earnedLevels > 0) {
    next = {
      ...next,
      beats: [...(next.beats || []), {
        id: `forge-level-${Date.now()}`,
        type: "growth",
        text: earnedLevelGrowthText(progress),
      }],
    };
  }
  return { ok: true, item: itemDef, state: projectCharacterProgression(next) };
}

// Take the next apprenticeship step: pay the fee, live and labour at the forge
// (advance days, return fed and rested), and raise the smithing rank.
export function applyApprentice(state, step) {
  const coins = state.character.inventory.coins;
  if (!canAfford(coins, step.costCp)) return { state, ok: false, reason: "Not enough coin." };
  const newCoins = copperToCoins(coinsToCopper(coins) - step.costCp);
  const time = advanceTime(state.time, step.days * 24 * 60);
  const crafting = { ...(state.character.crafting || {}) };
  crafting.blacksmith = { rank: step.rank };
  const cur = state.character.needs || { hunger: 0, thirst: 0, sleep: 0 };
  const needs = {
    hunger: Math.max(cur.hunger || 0, 80),
    thirst: Math.max(cur.thirst || 0, 80),
    sleep: Math.max(cur.sleep || 0, 80),
  };
  const trained = {
    ...state,
    time,
    character: { ...state.character, crafting, needs, inventory: { ...state.character.inventory, coins: newCoins } },
  };
  // Days bound to the forge — perishable food in the pack goes off meanwhile.
  const sp = spoilState(trained);
  // Long stretches of training can roll years over — age the codex too. Any
  // characters who died of age during the apprenticeship surface as a notice.
  const ag = ageState(sp.state);
  let next = ag.state;
  const progress = advanceProgression(next.character, Math.max(1, step.days || 1) * 60);
  if (progress.earnedLevels > 0) {
    next = {
      ...next,
      beats: [...(next.beats || []), {
        id: `apprentice-level-${Date.now()}`,
        type: "growth",
        text: earnedLevelGrowthText(progress),
      }],
    };
  }
  return { ok: true, state: projectCharacterProgression(next), spoiled: sp.spoiled, aged: ag.aged, deaths: ag.deaths };
}
