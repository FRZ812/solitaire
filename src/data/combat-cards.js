import {
  BASIC_ATTACK,
  DEFEND,
  TALK,
  abilityReqLine,
  abilityStatLine,
  getAbilityDef,
} from "./abilities.js";

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
  const exhaust = abilityId !== BASIC_ATTACK.id && abilityId !== DEFEND.id && (
    def.card?.exhaust === true ||
    (def.cooldown || 0) >= 4 ||
    ["invuln", "unstoppable", "dominated", "charmed"].includes(def.effect?.type)
  );
  return {
    id: abilityId,
    abilityId,
    name: override.name || def.name,
    description: def.desc || "",
    statLine: liveCardStatLine(def, tier),
    requirementLine: abilityReqLine(def),
    type: override.type || cardType(def),
    art: override.art || (def.damageType || def.dmg ? "weapon" : "guard"),
    target: def.target || "enemy",
    energyCost: Math.max(0, Math.min(3, def.actionCost || 1)),
    resolveCost: Math.max(0, def.resolveCost || 0),
    exhaust,
    retain: !!def.card?.retain,
    ethereal: !!def.card?.ethereal,
    tier,
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
