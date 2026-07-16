import { tier } from "./tiers.js";

// Ability identity has two levels. The broad category answers "what kind of
// training is this?"; magical abilities then share one of the eight classical
// schools. The historical `def.school` field (arcane/divine/shadow/etc.) stays
// intact as a casting tradition so old campaigns and loot filters keep working.
export const ABILITY_CATEGORIES = Object.freeze({
  martial: { id: "martial", label: "Martial", shortLabel: "Martial", mark: "M" },
  survival: { id: "survival", label: "Survival", shortLabel: "Survival", mark: "S" },
  social: { id: "social", label: "Social", shortLabel: "Social", mark: "P" },
  magic: { id: "magic", label: "Magic", shortLabel: "Magic", mark: "A" },
  innate: { id: "innate", label: "Innate", shortLabel: "Innate", mark: "I" },
});

export const MAGIC_SCHOOLS = Object.freeze({
  abjuration: {
    id: "abjuration", label: "Abjuration", shortLabel: "Abj.",
    description: "Wards, negation, sanctuary, and the breaking of hostile magic.",
  },
  conjuration: {
    id: "conjuration", label: "Conjuration", shortLabel: "Conj.",
    description: "Calling matter, creatures, and passages across distance.",
  },
  divination: {
    id: "divination", label: "Divination", shortLabel: "Div.",
    description: "Revelation, foresight, detection, and the reading of hidden paths.",
  },
  enchantment: {
    id: "enchantment", label: "Enchantment", shortLabel: "Ench.",
    description: "Influence over courage, desire, attention, and the will.",
  },
  evocation: {
    id: "evocation", label: "Evocation", shortLabel: "Evoc.",
    description: "Direct force, elemental power, radiance, and restorative energy.",
  },
  illusion: {
    id: "illusion", label: "Illusion", shortLabel: "Illus.",
    description: "Veils, false sensation, terror, concealment, and misdirection.",
  },
  necromancy: {
    id: "necromancy", label: "Necromancy", shortLabel: "Necro.",
    description: "Life force, death, curses, decay, and the binding of souls.",
  },
  transmutation: {
    id: "transmutation", label: "Transmutation", shortLabel: "Trans.",
    description: "Alteration of body, matter, motion, and time.",
  },
});

// A spell's school is authored by identity, never guessed from its current
// icon. That makes the school+tier visual key stable even when names, balance,
// or card copy change.
export const MAGIC_SCHOOL_BY_ABILITY_ID = Object.freeze({
  // Abjuration
  "mana-shield": "abjuration",
  sanctuary: "abjuration",
  "stone-armor": "abjuration",
  "shield-of-faith": "abjuration",
  dispel: "abjuration",
  "guardian-aegis": "abjuration",
  "last-sanctuary": "abjuration",
  "unbreakable-will": "abjuration",

  // Conjuration
  "dimension-door": "conjuration",
  gate: "conjuration",

  // Enchantment
  bless: "enchantment",
  hex: "enchantment",
  charm: "enchantment",
  dominate: "enchantment",
  "battle-hymn": "enchantment",

  // Evocation
  combust: "evocation",
  "frost-nova": "evocation",
  firebolt: "evocation",
  "frost-lance": "evocation",
  "chain-lightning": "evocation",
  smite: "evocation",
  "arcane-bolt": "evocation",
  "lightning-bolt": "evocation",
  fireball: "evocation",
  "ice-shard": "evocation",
  heal: "evocation",
  radiance: "evocation",
  electrocute: "evocation",
  "deep-freeze": "evocation",
  blizzard: "evocation",
  meteor: "evocation",
  tempest: "evocation",
  judgment: "evocation",
  dawnburst: "evocation",
  renewal: "evocation",
  sanctify: "evocation",
  "dragon-breath": "evocation",
  "hellfire-bolt": "evocation",
  dragonbreath: "evocation",

  // Illusion
  terrify: "illusion",
  "mass-terror": "illusion",
  "dread-aura": "illusion",

  // Necromancy
  curse: "necromancy",
  "shadow-bolt": "necromancy",
  enfeeble: "necromancy",
  wither: "necromancy",
  plague: "necromancy",
  doom: "necromancy",
  "life-drain": "necromancy",
  "soul-rend": "necromancy",
  "blood-siphon": "necromancy",
  wraithstep: "necromancy",

  // Transmutation
  haste: "transmutation",
  disintegrate: "transmutation",
  "time-stop": "transmutation",
  fly: "transmutation",
  "bear-strength": "transmutation",
  "beast-shift": "transmutation",
});

export function magicSchoolIdOf(defOrId) {
  const id = typeof defOrId === "string" ? defOrId : defOrId?.id;
  return (typeof defOrId === "object" && defOrId?.magicSchool)
    || MAGIC_SCHOOL_BY_ABILITY_ID[id]
    || null;
}

export function abilityCategoryIdOf(def) {
  if (!def) return "martial";
  if (def.innate) return "innate";
  if (magicSchoolIdOf(def)) return "magic";
  if (def.school === "social") return "social";
  if (def.school === "survival") return "survival";
  return "martial";
}

export function abilityTaxonomy(def, tierId = "common") {
  const categoryId = abilityCategoryIdOf(def);
  const schoolId = magicSchoolIdOf(def);
  const category = ABILITY_CATEGORIES[categoryId] || ABILITY_CATEGORIES.martial;
  const magicSchool = schoolId ? MAGIC_SCHOOLS[schoolId] : null;
  const resolvedTier = tier(tierId);
  return {
    categoryId,
    category,
    magicSchoolId: schoolId,
    magicSchool,
    tierId: resolvedTier.id,
    tier: resolvedTier,
    // The icon contract is intentionally coarser than the ability id: every
    // spell in the same school and grade resolves to exactly the same key.
    iconKey: schoolId ? `magic:${schoolId}:${resolvedTier.id}` : `category:${categoryId}`,
    label: magicSchool ? `${category.label} · ${magicSchool.label}` : category.label,
  };
}
