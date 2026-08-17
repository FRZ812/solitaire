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
import { coinsToCopper, copperToCoins } from "./economy.js";

const randInt = (min, max, random) => min + Math.floor(random() * (max - min + 1));

// A short readable suffix, drawn from the caller's generator rather than from
// Math.random, so two runs of the same settlement mint the same instance ids.
function idSuffix(random) {
  return Math.floor(random() * 0x10000).toString(36).padStart(4, "0").slice(-4);
}

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

function generateLootItem(tierId, random) {
  const t = LOOT_TYPES[Math.floor(random() * LOOT_TYPES.length)];
  const noun = t.nouns[Math.floor(random() * t.nouns.length)];
  const name = `${TIER_ADJ[tierId] || "Plain"} ${noun}`;
  const id = `${tierId}-${noun.toLowerCase()}-${idSuffix(random)}`;
  return {
    id,
    entry: {
      id, name, kind: t.kind, slot: t.slot, tier: tierId,
      appearance: `${tierLabel(tierId)}-grade ${noun.toLowerCase()}, taken in battle.`,
      description: `A ${tierLabel(tierId).toLowerCase()} ${noun.toLowerCase()} recovered from a foe.`,
      combat: t.combat(tierMult(tierId)),
      passives: rollItemPassives(tierId, { luck: 0.1, random }),
    },
  };
}

export function rollLoot(sources, opts = {}) {
  // `random` is injectable so a settlement can spend a named, recorded stream instead of a
  // global generator. Defaulting to Math.random keeps every caller that has not been taught
  // about streams behaving exactly as it did.
  const { maxLootTier = null, region = 1, owned = new Set(), coinBonus = 0, random = Math.random } = opts;
  let copper = 0;
  let maxTier = "common";
  for (const e of sources) {
    const ord = tierInfo(e.tier).order;
    copper += randInt(2, 8, random) * (1 + ord);
    if (tierInfo(e.tier).order > tierInfo(maxTier).order) maxTier = e.tier;
    if (tierInfo(e.maxLootTier).order > tierInfo(maxTier).order) maxTier = e.maxLootTier;
  }
  // Region ceiling caps the loot tier — a Settled-region foe never drops epic.
  if (maxLootTier && tierInfo(maxTier).order > tierInfo(maxLootTier).order) maxTier = maxLootTier;

  const items = [];
  if (sources.length > 0 && random() < ITEM_DROP_CHANCE) {
    const li = generateLootItem(rollTier(maxTier, 0.1, random), random);
    items.push({ itemId: li.id, entry: li.entry, quantity: 1 });
  }
  let ability = null;
  if (sources.length > 0 && random() < ABILITY_DROP_CHANCE) {
    const id = randomAbilityId(null, random);
    const def = getAbilityDef(id);
    // Floor-gated apex abilities only drop where the loot ceiling can support
    // their minimum grade — never as a weak low-tier copy; otherwise clamp up.
    const minOrd = def?.minTier ? tierInfo(def.minTier).order : 0;
    if (tierInfo(maxTier).order >= minOrd) {
      let tier = rollTier(maxTier, 0.2, random);
      if (tierInfo(tier).order < minOrd) tier = def.minTier;
      ability = { id, tier, name: def?.name || id };
    }
  }

  // Named/unique drops from specific foe kinds + deep regions (never the random
  // pool). A unique ability supersedes the random one; a unique item is extra.
  if (sources.length > 0) {
    const uniq = rollUniques({ kinds: sources.map((e) => e.kind), region, owned, mult: UNIQUE_DROP_CHANCE, random });
    if (uniq.item) items.push(uniq.item);
    if (uniq.ability) ability = uniq.ability;
  }

  // Forge-runes (affix-Fusion catalyst) — rare trophies of the mighty: deep
  // regions, epic+ loot ceiling, low chance. Never bought; only earned.
  if (sources.length > 0 && region >= RUNE_DROP_MIN_REGION && tierInfo(maxTier).order >= tierInfo("epic").order && random() < RUNE_DROP_CHANCE) {
    const runeIds = Object.keys(RUNES).filter((id) => id !== "greater-rune-of-ascension");
    const rune = RUNES[runeIds[Math.floor(random() * runeIds.length)]];
    items.push({ itemId: rune.id, entry: rune, quantity: 1 });
  }
  // The god-forged apex rune (divine-tier fusion catalyst) — only off divine-grade
  // kills, vanishingly rare. The reward for slaying the fabled.
  if (sources.length > 0 && tierInfo(maxTier).order >= tierInfo("divine").order && random() < RUNE_DROP_CHANCE * 0.4) {
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
      const uid = `${g.id}-${idSuffix(random)}`;
      items.push({ itemId: uid, entry: { ...baseItem, id: uid, tier: g.tier || baseItem.tier || "common" }, quantity: 1 });
    }
  }

  // Coins are accumulated in copper and re-expressed canonically (1sp=10cp,
  // 1gp=100cp) via economy.copperToCoins, so the purse never carries >9 of a
  // lower denomination and the narrator context reads true wealth.
  copper = Math.round(copper * (1 + coinBonus));
  return { coins: copperToCoins(copper), items, ability };
}

// Relocated from combat-result.js when the deck engine retired. Applying a spoils
// manifest never depended on the resolver — only on state, economy and the catalogues —
// so the search-the-fallen flow outlives the engine that used to generate the manifest.
const clone = (x) => JSON.parse(JSON.stringify(x));

export function applyLoot(state, manifest) {
  const next = clone(state);
  next.pendingLoot = null;
  const beats = [];
  const now = Date.now();
  if (!manifest) return { state: { ...next, beats: [...next.beats] }, taken: "" };

  next.world.codex.items = { ...next.world.codex.items };
  const invLines = [];
  const takenParts = [];
  for (const it of (manifest.items || [])) {
    if (it.entry) next.world.codex.items[it.itemId] = it.entry;
    const existing = next.character.inventory.carried.find((c) => c.itemId === it.itemId);
    if (existing) existing.quantity += it.quantity || 1;
    else next.character.inventory.carried.push({ itemId: it.itemId, quantity: it.quantity || 1 });
    invLines.push(`+${it.quantity || 1}× ${it.entry?.name || it.itemId}`);
    takenParts.push(it.entry?.name || it.itemId);
  }
  // Add the spoils' coin to the purse in copper, then re-express canonically so
  // the purse never accumulates >9 of a lower denomination (the manifest's coins
  // are already canonical, coming from rollLoot → copperToCoins).
  const coins = manifest.coins || {};
  next.character.inventory.coins = copperToCoins(coinsToCopper(next.character.inventory.coins) + coinsToCopper(coins));
  const coinParts = [];
  if (coins.gold) coinParts.push(`+${coins.gold}gp`);
  if (coins.silver) coinParts.push(`+${coins.silver}sp`);
  if (coins.copper) coinParts.push(`+${coins.copper}cp`);
  if (coinParts.length) { invLines.push(coinParts.join(", ")); takenParts.push(coinParts.join(", ")); }
  if (invLines.length) beats.push({ id: `lt${now}`, type: "inventory_delta", lines: invLines });

  // rollLoot has already spent its deterministic stream to author this
  // manifest. Tower characters still take every material reward, but do not
  // project its retired combat-technique entry into either player or Codex.
  if (manifest.ability && next.character.progressionModel !== "tow-archetype") {
    next.character.abilities = Array.isArray(next.character.abilities) ? [...next.character.abilities] : [];
    next.character.abilities.push({ id: manifest.ability.id, tier: manifest.ability.tier });
    const def = getAbilityDef(manifest.ability.id);
    next.world.codex.skills = { ...next.world.codex.skills };
    next.world.codex.skills[manifest.ability.id] = {
      id: manifest.ability.id, name: `${manifest.ability.name} (${tierLabel(manifest.ability.tier)})`,
      description: def?.desc || "A combat ability.", rating: tierInfo(manifest.ability.tier).order + 1,
      combatAbility: true, tier: manifest.ability.tier,
    };
    beats.push({ id: `la${now}`, type: "discovery", items: [{ kind: "ability", name: `${manifest.ability.name} · ${tierLabel(manifest.ability.tier)}` }] });
    takenParts.push(`the technique ${manifest.ability.name}`);
  }

  next.beats = [...next.beats, ...beats];
  return { state: next, taken: takenParts.join(", ") };
}
