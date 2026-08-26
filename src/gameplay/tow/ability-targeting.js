// Spatial targeting metadata derived from the stable Tower ability catalogue.
//
// The source rules only distinguish Enemy, Ally (the acting character), and All. The
// formation combat layer needs a richer contract, but changing the captured effects would
// invalidate old receipts. This adapter therefore leaves `effect.target` untouched and
// describes where an action may be anchored and how each effect follows that anchor.

export const ABILITY_TARGETING_VERSION = 2;

export const ABILITY_ANCHOR_SIDES = Object.freeze(["enemy", "ally", "self"]);
export const ABILITY_REACHES = Object.freeze(["self", "melee", "ranged", "global"]);
export const ABILITY_FOOTPRINTS = Object.freeze([
  "single",
  "row",
  "column",
  "cross-short",
  "cross-full",
  "all",
]);
export const ABILITY_ANCHOR_POLICIES = Object.freeze(["occupied", "cell"]);
export const ABILITY_CAST_MODES = Object.freeze(["melee", "projectile", "field", "support"]);
export const ABILITY_PRESENTATIONS = Object.freeze(["restrained", "ability"]);
export const ABILITY_PRESENTATION_TIERS = Object.freeze(["restrained", "ability", "mythical"]);
export const ABILITY_EFFECT_RECIPIENTS = Object.freeze(["anchor", "caster", "all"]);

const FIXED_ABILITY_TYPES = new Set(["basic-attack", "defensive"]);
const FLEXIBLE_ABILITY_TYPES = new Set(["archetype", "general"]);
const RARITY_ORDER = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
]);

// The old compatibility basics predate `abilityType`; keep them visually and spatially
// restrained just like the canonical fixed-slot versions.
const RESTRAINED_COMPATIBILITY_IDS = new Set([
  "strike",
  "shield-bash",
  "slaughter",
  "block",
  "defensive-stance",
  "parry",
]);

// These are positive flexible actions whose old `self` target is deliberately broadened
// to one allied anchor (including the caster). Fixed defenses, movement, transformations,
// summons, fatal bargains, and resource restoration are intentionally absent.
export const ALLY_TARGET_ABILITY_IDS = Object.freeze([
  "arctic-gather-strength",
  "arctic-battle-cry",
  "arctic-thirst-for-blood",
  "arctic-retaliation",
  "arctic-iron-wall-defense",
  "arctic-ultimate-body",
  "demon-apply-poison",
  "demon-eagle-eye",
  "demon-d-day",
  "demon-endless-grudge",
  "mage-regeneration",
  "mage-thorn-veil",
  "mage-overload",
  "mage-mana-concentration",
  "mage-invincible",
  "mage-amplification",
  "mage-regression",
  "priestess-instant-heal",
  "priestess-weapon-of-judgment",
  "priestess-hour-of-judgment",
  "priestess-divine-favor",
  "priestess-divine-barrier",
  "priestess-purification",
  "priestess-immediate-judgment",
  "priestess-oracle",
  "priestess-greater-heal",
  "priestess-power-of-god",
  "priestess-immortality",
  "assassin-double-slash",
  "assassin-boost-up",
  "assassin-total-defense",
  "assassin-life-saving-pill",
  "north-king-bears-blessing",
  "north-king-power-of-earth",
  "north-king-warriors-oath",
  "clocktower-high-voltage",
  "clocktower-ultra-barrier",
  "clocktower-improvement",
  "clocktower-preparation",
  "clocktower-tailored-drink",
  "clocktower-reinforcement",
  "clocktower-redesign",
  "sleepless-mark-of-the-wild",
  "sleepless-water-totem",
  "sleepless-cool-composure",
  "sleepless-predators-instinct",
  "sleepless-gale-totem",
  "sleepless-hardening",
  "sleepless-fire-essence",
  "blade-domain",
  "blade-steal-the-flow",
  "blade-katana-dance",
  "blade-mountain-of-blades",
  "blade-selfless-state",
  "blade-chi-liberation",
  "vampire-super-regeneration",
  "vampire-cruel-touch",
  "vampire-endless-will",
  "vampire-ancestral-blood",
  "automaton-barrel-cooling",
  "automaton-precision-analysis",
  "automaton-flash",
  "automaton-emergency-cooling",
]);

const ALLY_TARGET_IDS = new Set(ALLY_TARGET_ABILITY_IDS);

// Footprints are authored by stable ids rather than inferred from translated display text.
// An omitted ability intentionally receives the conservative single-cell default.
const FOOTPRINT_BY_ID = Object.freeze({
  // Horizontal pressure.
  "north-king-whirlwind": "row",
  "north-king-maelstrom": "row",
  "clocktower-buckshot": "row",
  "witch-all-out-attack": "row",
  "sleepless-tail-swipe": "row",
  "sleepless-fire-dragons-breath": "row",
  "blade-double-slash": "row",
  "blade-katana-dance": "row",
  "automaton-crossfire": "row",

  // Lane attacks and coherent projectiles.
  "demon-snipe": "column",
  "demon-high-speed-shooting": "column",
  "mage-destruction-ray": "column",
  "mage-god-slaying-spear": "column",
  "clocktower-missile-support": "column",
  "automaton-chain-cannon": "column",
  "vampire-blood-spear": "column",

  // Compact impacts around one selected cell.
  "arctic-cross-slash": "cross-short",
  "arctic-giants-smash": "cross-short",
  "demon-smoke-bomb": "cross-short",
  "assassin-flash-bomb": "cross-short",
  "north-king-boulder-toss": "cross-short",
  "clocktower-grenade-toss": "cross-short",
  "witch-bone-sphere": "cross-short",
  "automaton-shock-grenade": "cross-short",

  // Effects which radiate through the selected row and column.
  "clocktower-chain-explosion": "cross-full",
  "clocktower-electromagnetic-field": "cross-full",
  "clocktower-ultra-barrier": "cross-full",
  "priestess-divine-barrier": "cross-full",
  "sleepless-water-totem": "cross-full",
  "sleepless-gale-totem": "cross-full",
  "blade-domain": "cross-full",

  // Whole target-field conclusions. Mythical presentation remains a separate concern.
  "demon-arrow-rain": "all",
  "mage-flame-storm": "all",
  "assassin-storm-of-knives": "all",
  "north-king-earthquake": "all",
  "north-king-natures-intervention": "all",
  "sleepless-fire-rain": "all",
  "vampire-rain-of-death": "all",
  "automaton-scorched-earth": "all",
  "peace-declaration": "all",
});

const RANGED_ARCHETYPES = new Set([
  "ranger",
  "artificer",
  "sorcerer",
  "warlock",
  "wizard",
  "automaton",
]);

const PROJECTILE_CAST_IDS = new Set([
  "sleep-grenade",
  "demon-snipe",
  "demon-high-speed-shooting",
  "mage-destruction-ray",
  "mage-god-slaying-spear",
  "north-king-boulder-toss",
  "clocktower-grenade-toss",
  "clocktower-missile-support",
  "automaton-chain-cannon",
  "automaton-shock-grenade",
  "vampire-blood-spear",
]);

const MELEE_CAST_IDS = new Set([
  "demon-kick",
  "witch-vampiric-touch",
  "witch-touch-of-the-dead",
  "sleepless-swing",
]);

const SELF_COST_EFFECT_TYPES = new Set([
  "delayed-damage",
  "temporary-max-hp",
  "restore-skill-uses",
]);

function isDefinition(value) {
  return Boolean(
    value
    && typeof value === "object"
    && typeof value.id === "string"
    && Array.isArray(value.effects),
  );
}

function fixedAbility(definition) {
  return FIXED_ABILITY_TYPES.has(definition.abilityType)
    || RESTRAINED_COMPATIBILITY_IDS.has(definition.id);
}

function purelySelfTargeted(definition) {
  return definition.effects.length > 0
    && definition.effects.every((effect) => effect.target === "self");
}

function canUseAllyAnchor(definition) {
  if (!ALLY_TARGET_IDS.has(definition.id)) return false;
  if (fixedAbility(definition) || !purelySelfTargeted(definition)) return false;
  return !definition.effects.some((effect) => SELF_COST_EFFECT_TYPES.has(effect.type));
}

function footprintFor(definition) {
  if (fixedAbility(definition)) return "single";
  return FOOTPRINT_BY_ID[definition.id] || "single";
}

function anchorSideFor(definition) {
  if (definition.effects.some((effect) => effect.target === "all")) return "self";
  if (definition.effects.some((effect) => effect.target === "enemy")) return "enemy";
  if (canUseAllyAnchor(definition)) return "ally";
  return "self";
}

function castModeFor(definition, anchorSide, footprint) {
  if (anchorSide === "self" || anchorSide === "ally") return "support";
  if (MELEE_CAST_IDS.has(definition.id)) return "melee";
  if (PROJECTILE_CAST_IDS.has(definition.id)) return "projectile";
  if (footprint !== "single") return "field";
  if (RANGED_ARCHETYPES.has(definition.archetypeId)) return "projectile";
  return "melee";
}

function reachFor(anchorSide, castMode, footprint) {
  if (anchorSide === "self") return footprint === "all" ? "global" : "self";
  if (footprint === "all") return "global";
  if (anchorSide === "ally") return "ranged";
  return castMode === "melee" ? "melee" : "ranged";
}

function baselinePresentation(definition) {
  return fixedAbility(definition) ? "restrained" : "ability";
}

export function isAbilityTargetingMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.join() !== [
    "allowSelf",
    "anchorPolicy",
    "anchorSide",
    "castMode",
    "footprint",
    "presentation",
    "reach",
    "version",
  ].sort().join()) return false;
  return value.version === ABILITY_TARGETING_VERSION
    && typeof value.allowSelf === "boolean"
    && ABILITY_ANCHOR_SIDES.includes(value.anchorSide)
    && ABILITY_REACHES.includes(value.reach)
    && ABILITY_FOOTPRINTS.includes(value.footprint)
    && ABILITY_ANCHOR_POLICIES.includes(value.anchorPolicy)
    && ABILITY_CAST_MODES.includes(value.castMode)
    && ABILITY_PRESENTATIONS.includes(value.presentation)
    && (value.anchorSide !== "ally" || value.allowSelf);
}

export function abilityTargeting(definition) {
  if (!isDefinition(definition)) throw new TypeError("invalid-ability-definition");
  const anchorSide = anchorSideFor(definition);
  const footprint = footprintFor(definition);
  const castMode = castModeFor(definition, anchorSide, footprint);
  const metadata = Object.freeze({
    version: ABILITY_TARGETING_VERSION,
    anchorSide,
    allowSelf: anchorSide !== "enemy",
    reach: reachFor(anchorSide, castMode, footprint),
    footprint,
    anchorPolicy: footprint === "single" ? "occupied" : "cell",
    castMode,
    presentation: baselinePresentation(definition),
  });
  if (!isAbilityTargetingMetadata(metadata)) throw new TypeError("invalid-ability-targeting");
  return metadata;
}

/**
 * Resolve one captured effect against the spatial action.
 *
 * Mixed enemy+self actions keep their recoil, ward, heal, or resource change on the caster
 * exactly once. Only an explicitly curated ally action redirects its old self effects to
 * the selected allied footprint.
 */
export function effectRecipient(definition, effect, index = null) {
  if (!isDefinition(definition)) throw new TypeError("invalid-ability-definition");
  const effectIndex = index === null ? definition.effects.indexOf(effect) : index;
  if (!Number.isSafeInteger(effectIndex)
    || effectIndex < 0
    || effectIndex >= definition.effects.length
    || definition.effects[effectIndex] !== effect) {
    throw new TypeError("unknown-ability-effect");
  }
  if (effect.target === "all") return "all";
  if (effect.target === "enemy") return "anchor";
  if (effect.target === "self" && abilityTargeting(definition).anchorSide === "ally") {
    return "anchor";
  }
  return "caster";
}

function effectiveRarity(definition, rank) {
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > definition.rankCount) {
    throw new TypeError("invalid-ability-rank");
  }
  const start = RARITY_ORDER.indexOf(definition.rarity);
  if (start < 0) throw new TypeError("invalid-ability-rarity");
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, start + rank - 1)];
}

export function presentationTier(definition, rank = 1) {
  if (!isDefinition(definition)) throw new TypeError("invalid-ability-definition");
  const baseline = abilityTargeting(definition).presentation;
  const rarity = effectiveRarity(definition, rank);
  if (FLEXIBLE_ABILITY_TYPES.has(definition.abilityType)
    && rarity === "mythical") return "mythical";
  return baseline;
}
