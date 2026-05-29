// Combat loot generation — extracted from combat.js (Stage 1 of the engine
// decomposition). A genuine leaf: it rolls spoils from a list of fallen foes and
// reads loot context off the combat state, but never mutates `cs` or calls back
// into the resolver/turn loop, so it carries no dependency on combat.js (the
// core imports rollLoot/lootCtx from here, one direction).
import { tierMult, rollTier, tierLabel, tier as tierInfo } from "../data/tiers.js";
import { ITEM_DROP_CHANCE, ABILITY_DROP_CHANCE, UNIQUE_DROP_CHANCE, RUNE_DROP_CHANCE, RUNE_DROP_MIN_REGION } from "../data/balance.js";
import { rollUniques } from "../data/uniques.js";
import { getAbilityDef, randomAbilityId } from "../data/abilities.js";
import { rollItemPassives, RUNES } from "../data/passives.js";
import { itemTemplate } from "../data/catalog.js";
import { copperToCoins } from "./economy.js";

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Loot context lifted off the combat state (region ceiling, owned uniques, coin
// bonus) — passed to rollLoot so the same roll can be reproduced from a snapshot.
export function lootCtx(cs) {
  return { maxLootTier: cs.maxLootTier, region: cs.region, owned: new Set(cs.ownedUniques || []), coinBonus: cs.coinBonus || 0 };
}

const TIER_ADJ = {
  common: "Plain", uncommon: "Fine", rare: "Keen", "very-rare": "Runed",
  epic: "Storied", legendary: "Fabled", mythical: "Mythic", divine: "Hallowed",
};

// Every wearable slot is droppable at every tier, so loot can fill the whole
// paper-doll — not just weapon/armor/trinket. Each entry carries its `kind`,
// explicit `slot`, name nouns, and a tier-scaled stat block (m = tier multiplier).
const r = (v) => Math.max(1, Math.round(v));
const LOOT_TYPES = [
  { kind: "weapon",   slot: "mainhand", nouns: ["Blade", "Edge", "Fang", "Cleaver", "Spike", "Talon"], combat: (m) => ({ damage: { min: r(3 * m), max: r(6 * m), type: "physical", pen: Math.round(m) } }) },
  { kind: "shield",   slot: "offhand",  nouns: ["Buckler", "Targe", "Roundshield", "Wall"],            combat: (m) => ({ armor: r(2.4 * m) }) },
  { kind: "armor",    slot: "body",     nouns: ["Hauberk", "Cuirass", "Carapace", "Brigandine"],       combat: (m) => ({ armor: r(3 * m) }) },
  { kind: "clothing", slot: "head",     nouns: ["Helm", "Cap", "Coif", "Circlet"],                     combat: (m) => ({ armor: r(1.2 * m) }) },
  { kind: "clothing", slot: "hands",    nouns: ["Gauntlets", "Bracers", "Gloves"],                     combat: (m) => ({ armor: r(1 * m) }) },
  { kind: "clothing", slot: "legs",     nouns: ["Greaves", "Leggings", "Chausses"],                    combat: (m) => ({ armor: r(1.5 * m) }) },
  { kind: "clothing", slot: "feet",     nouns: ["Boots", "Sabatons", "Treads"],                        combat: (m) => ({ armor: r(0.8 * m), dodge: r(0.6 * m) }) },
  { kind: "clothing", slot: "back",     nouns: ["Cloak", "Cape", "Mantle"],                            combat: (m) => ({ ward: r(1 * m), dodge: r(0.8 * m) }) },
  { kind: "clothing", slot: "over",     nouns: ["Robe", "Vestment", "Surcoat"],                        combat: (m) => ({ ward: r(2 * m) }) },
  { kind: "clothing", slot: "torso",    nouns: ["Tunic", "Jerkin", "Gambeson"],                        combat: (m) => ({ armor: r(1 * m), ward: r(1 * m) }) },
  { kind: "trinket",  slot: "neck",     nouns: ["Amulet", "Pendant", "Torc", "Charm"],                 combat: (m) => ({ ward: r(2 * m) }) },
  { kind: "trinket",  slot: "ring",     nouns: ["Ring", "Band", "Signet"],                             combat: (m) => ({ ward: r(1 * m), dodge: r(0.8 * m) }) },
];

function generateLootItem(tierId) {
  const t = LOOT_TYPES[Math.floor(Math.random() * LOOT_TYPES.length)];
  const noun = t.nouns[Math.floor(Math.random() * t.nouns.length)];
  const name = `${TIER_ADJ[tierId] || "Plain"} ${noun}`;
  const id = `${tierId}-${noun.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    entry: {
      id, name, kind: t.kind, slot: t.slot, tier: tierId,
      appearance: `${tierLabel(tierId)}-grade ${noun.toLowerCase()}, taken in battle.`,
      description: `A ${tierLabel(tierId).toLowerCase()} ${noun.toLowerCase()} recovered from a foe.`,
      combat: t.combat(tierMult(tierId)),
      passives: rollItemPassives(tierId, { luck: 0.1 }),
    },
  };
}

export function rollLoot(sources, opts = {}) {
  const { maxLootTier = null, region = 1, owned = new Set(), coinBonus = 0 } = opts;
  let copper = 0;
  let maxTier = "common";
  for (const e of sources) {
    const ord = tierInfo(e.tier).order;
    copper += randInt(2, 8) * (1 + ord);
    if (tierInfo(e.tier).order > tierInfo(maxTier).order) maxTier = e.tier;
    if (tierInfo(e.maxLootTier).order > tierInfo(maxTier).order) maxTier = e.maxLootTier;
  }
  // Region ceiling caps the loot tier — a Settled-region foe never drops epic.
  if (maxLootTier && tierInfo(maxTier).order > tierInfo(maxLootTier).order) maxTier = maxLootTier;

  const items = [];
  if (sources.length > 0 && Math.random() < ITEM_DROP_CHANCE) {
    const li = generateLootItem(rollTier(maxTier, 0.1));
    items.push({ itemId: li.id, entry: li.entry, quantity: 1 });
  }
  let ability = null;
  if (sources.length > 0 && Math.random() < ABILITY_DROP_CHANCE) {
    const id = randomAbilityId();
    const def = getAbilityDef(id);
    // Floor-gated apex abilities only drop where the loot ceiling can support
    // their minimum grade — never as a weak low-tier copy; otherwise clamp up.
    const minOrd = def?.minTier ? tierInfo(def.minTier).order : 0;
    if (tierInfo(maxTier).order >= minOrd) {
      let tier = rollTier(maxTier, 0.2);
      if (tierInfo(tier).order < minOrd) tier = def.minTier;
      ability = { id, tier, name: def?.name || id };
    }
  }

  // Named/unique drops from specific foe kinds + deep regions (never the random
  // pool). A unique ability supersedes the random one; a unique item is extra.
  if (sources.length > 0) {
    const uniq = rollUniques({ kinds: sources.map((e) => e.kind), region, owned, mult: UNIQUE_DROP_CHANCE });
    if (uniq.item) items.push(uniq.item);
    if (uniq.ability) ability = uniq.ability;
  }

  // Forge-runes (affix-Fusion catalyst) — rare trophies of the mighty: deep
  // regions, epic+ loot ceiling, low chance. Never bought; only earned.
  if (sources.length > 0 && region >= RUNE_DROP_MIN_REGION && tierInfo(maxTier).order >= tierInfo("epic").order && Math.random() < RUNE_DROP_CHANCE) {
    const runeIds = Object.keys(RUNES).filter((id) => id !== "greater-rune-of-ascension");
    const rune = RUNES[runeIds[Math.floor(Math.random() * runeIds.length)]];
    items.push({ itemId: rune.id, entry: rune, quantity: 1 });
  }
  // The god-forged apex rune (divine-tier fusion catalyst) — only off divine-grade
  // kills, vanishingly rare. The reward for slaying the fabled.
  if (sources.length > 0 && tierInfo(maxTier).order >= tierInfo("divine").order && Math.random() < RUNE_DROP_CHANCE * 0.4) {
    const gr = RUNES["greater-rune-of-ascension"];
    items.push({ itemId: gr.id, entry: gr, quantity: 1 });
  }

  // A slain person drops the GEAR THEY WERE WEARING — their real kit, not a random
  // table (bestiary combatants carry `gear:[{id,tier}]`). Each piece drops as its
  // own instance at the foe's tier, so killing an armed foe arms you.
  for (const e of sources) {
    for (const g of (e.gear || [])) {
      const baseItem = itemTemplate(g.id);
      if (!baseItem) continue;
      const uid = `${g.id}-${Math.random().toString(36).slice(2, 6)}`;
      items.push({ itemId: uid, entry: { ...baseItem, id: uid, tier: g.tier || baseItem.tier || "common" }, quantity: 1 });
    }
  }

  // Coins are accumulated in copper and re-expressed canonically (1sp=10cp,
  // 1gp=100cp) via economy.copperToCoins, so the purse never carries >9 of a
  // lower denomination and the narrator context reads true wealth.
  copper = Math.round(copper * (1 + coinBonus));
  return { coins: copperToCoins(copper), items, ability };
}
