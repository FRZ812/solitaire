import {
  BASIC_ATTACK,
  DEFEND,
  TALK,
  abilityReqLine,
  abilityStatLine,
  clampAbilityTier,
  getAbilityDef,
} from "./abilities.js";
import { abilityTaxonomy } from "./ability-taxonomy.js";

const CORE_ABILITY_IDS = new Set([BASIC_ATTACK.id, DEFEND.id, TALK.id]);

const CORE_OVERRIDES = {
  [BASIC_ATTACK.id]: {
    name: "Strike",
    type: "attack",
    art: "weapon",
  },
  [DEFEND.id]: {
    name: "Guard",
    type: "skill",
    art: "guard",
  },
};

// Card-only tempo rules live beside the deck adapter, not inside the reusable
// ability resolver. They let a learned technique keep its world/combat meaning
// while gaining the draw/retain vocabulary expected from a real deck battler.
const CARD_BEHAVIOR = Object.freeze({
  "battle-focus": { draw: 2 },
  shadowstep: { draw: 1, retain: true },
  wraithstep: { draw: 1, retain: true },
  haste: { draw: 2, exhaust: true },
  dispel: { draw: 1 },
});

function cardType(def) {
  if (def?.dmg || def?.damageType === "weapon") return "attack";
  if (def?.target === "self" && ["rally", "focus", "unstoppable"].includes(def.effect?.type)) return "power";
  return "skill";
}

function liveCardStatLine(def, tier) {
  return abilityStatLine(def, tier)
    .split(" · ")
    .filter((part) => !/^cd \d+$/i.test(part))
    .map((part) => part.replace(/^(\d+) AP$/i, "$1 energy"))
    .join(" · ");
}

// Abilities remain the single mechanical source of truth. Card metadata only
// describes how an ability enters and leaves the hand.
export function cardDefinition(abilityId, tier = "common") {
  const def = getAbilityDef(abilityId);
  if (!def || def.noncombat) return null;
  const override = CORE_OVERRIDES[abilityId] || {};
  const behavior = { ...(def.card || {}), ...(CARD_BEHAVIOR[abilityId] || {}) };
  const resolvedTier = clampAbilityTier(abilityId, tier);
  const taxonomy = abilityTaxonomy(def, resolvedTier);
  const exhaust = abilityId !== BASIC_ATTACK.id && abilityId !== DEFEND.id && (
    behavior.exhaust === true ||
    def.card?.exhaust === true ||
    (def.cooldown || 0) >= 4 ||
    ["invuln", "unstoppable", "dominated", "charmed"].includes(def.effect?.type)
  );
  return {
    id: abilityId,
    abilityId,
    name: override.name || def.name,
    description: def.desc || "",
    statLine: liveCardStatLine(def, resolvedTier),
    requirementLine: abilityReqLine(def),
    type: override.type || cardType(def),
    art: override.art || taxonomy.iconKey,
    category: taxonomy.categoryId,
    categoryLabel: taxonomy.category.label,
    magicSchool: taxonomy.magicSchoolId,
    magicSchoolLabel: taxonomy.magicSchool?.label || null,
    iconKey: taxonomy.iconKey,
    tradition: def.school || null,
    target: def.target || "enemy",
    energyCost: Math.max(0, Math.min(3, def.actionCost || 1)),
    resolveCost: Math.max(0, def.resolveCost || 0),
    exhaust,
    retain: !!behavior.retain,
    ethereal: !!behavior.ethereal,
    draw: Math.max(0, behavior.draw || 0),
    block: def.effect?.type === "block" ? Math.max(0, def.effect.value || 0) : 0,
    tier: resolvedTier,
  };
}

// Existing campaigns need no destructive migration: the deck is derived from
// the learned kit unless/until a future loadout editor persists combatDeck.
export function defaultCombatDeck(character) {
  const specs = [
    ...Array.from({ length: 4 }, () => ({ abilityId: BASIC_ATTACK.id, tier: "common" })),
    ...Array.from({ length: 4 }, () => ({ abilityId: DEFEND.id, tier: "common" })),
  ];
  const learned = Array.isArray(character?.abilities) ? character.abilities : [];
  const byId = new Map();
  for (const entry of learned) {
    const normalized = typeof entry === "string" ? { id: entry, tier: "common" } : entry;
    if (!normalized?.id || CORE_ABILITY_IDS.has(normalized.id) || byId.has(normalized.id)) continue;
    if (!cardDefinition(normalized.id, normalized.tier || "common")) continue;
    byId.set(normalized.id, { abilityId: normalized.id, tier: normalized.tier || "common" });
  }
  specs.push(...byId.values());
  return specs;
}
