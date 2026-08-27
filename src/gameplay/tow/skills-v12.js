// Frozen verifier-only Tower v1.2 semantics from deployed commit d925c35.
// Never route playable/current combat through this module.
// The Tower of Winter skill catalogue and its cooldown/resource state machine, transcribed
// from docs/design/TOW_EVIDENCE.md.
//
// The source game's per-act use tables remain attached as evidence and as the migration
// contract for old replay snapshots. New Solitaire encounters translate that scarcity into
// Resolve: actions that were authored as unlimited remain free, while every formerly limited
// ability has a Resolve price.
// This matters because Solitaire has no act boundary and already owns one persistent mental
// resource. A skill can also *replace* the basic attack or defence rather than taking a slot,
// which is what makes Strike and Block slots rather than cards.
//
// Rank values are quoted verbatim from pinned evidence rather than interpolated. General
// abilities compile from the reviewed 69-row source fixture; no promotion is cosmetic.

import {
  FLEXIBLE_CHARACTER_ABILITY_TYPES,
  characterAbilityIds,
  describeCharacterAbilityEffect,
  getCharacterAbility,
} from "./character-abilities-v12.js";
import { canonicalTowArchetypeId } from "./archetype-identities.js";
import {
  TOW_GENERAL_ABILITY_SOURCE_ROWS,
  TOW_GENERAL_SOURCE_CAPTURE,
} from "./general-ability-source-data.js";

export const SKILL_SLOTS = 5;
export const SKILL_RARITY_PROGRESSION = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
]);
export const GENERAL_ACTIVE_SOURCE = TOW_GENERAL_SOURCE_CAPTURE.url;
export const GENERAL_ABILITY_IDS = Object.freeze(
  TOW_GENERAL_ABILITY_SOURCE_ROWS.map((row) => row.id),
);
const GENERAL_ABILITY_ID_SET = new Set(GENERAL_ABILITY_IDS);
export const RARITIES = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
]);

export const UNLIMITED_USES = null;

// Resolve prices deliberately fit the campaign's small Mind-driven pool (8 for a typical
// martial starter, 11 for a dedicated caster). The old use allowance expresses how freely
// the source expected a technique to be used, so it is the authored signal used to price it:
// common guards stay affordable while once-per-act conclusions demand most of a small pool.
// When an ability's ranks changed only that allowance, every promotion becomes a one-point
// Resolve discount instead. No rank is allowed to become an empty "+uses per act" upgrade,
// and no replacement charge counter is invented.
const RESOLVE_COST_BANDS = Object.freeze([
  Object.freeze({ minimumUses: 20, cost: 1 }),
  Object.freeze({ minimumUses: 10, cost: 2 }),
  Object.freeze({ minimumUses: 5, cost: 3 }),
  Object.freeze({ minimumUses: 3, cost: 4 }),
  Object.freeze({ minimumUses: 2, cost: 5 }),
  Object.freeze({ minimumUses: 1, cost: 6 }),
]);

function resolveBandCost(uses) {
  return RESOLVE_COST_BANDS.find((band) => uses >= band.minimumUses)?.cost ?? 6;
}

function isAllowanceOnlyProgression(definition) {
  if (!definition.usesPerActByRank || definition.rankCount <= 1) return false;
  return definition.effects.every((effect) => [
    effect.percentByRank,
    effect.countByRank,
    effect.factorByRank,
    effect.turnsByRank,
  ].filter(Boolean).every((table) => {
    const first = table[0];
    return Array.from({ length: definition.rankCount }, (_, index) => (
      table[Math.min(index, table.length - 1)]
    )).every((value) => value === first);
  }));
}

function damage(scale, percentByRank, extra = {}) {
  return Object.freeze({ type: "damage", scale, percentByRank: Object.freeze(percentByRank), target: "enemy", ...extra });
}

function shield(scale, percentByRank) {
  return Object.freeze({ type: "shield", scale, percentByRank: Object.freeze(percentByRank), target: "self" });
}

function status(statusType, target, countByRank, extra = {}) {
  return Object.freeze({ type: "status", status: statusType, target, countByRank: Object.freeze(countByRank), ...extra });
}

// Shouting inflicts "60% of ATK Lethargy" — a status whose count is scaled off a stat.
function scaledStatus(statusType, target, scale, percentByRank) {
  return Object.freeze({
    type: "scaled-status",
    status: statusType,
    target,
    scale,
    percentByRank: Object.freeze(percentByRank),
  });
}

function compileGeneralEffect(effect) {
  if (effect.type === "damage") return damage(effect.scale, effect.values);
  if (effect.type === "shield") return shield(effect.scale, effect.values);
  if (effect.type === "status") return status(effect.status, effect.target, effect.values);
  if (effect.type === "scaled-status") {
    return scaledStatus(effect.status, effect.target, effect.scale, effect.values);
  }
  if (effect.type === "heal-lost-fraction") {
    return Object.freeze({
      type: effect.type,
      target: effect.target,
      percentByRank: Object.freeze(effect.values),
    });
  }
  if (effect.type === "reduce-statuses") {
    return Object.freeze({
      type: effect.type,
      target: effect.target,
      statuses: Object.freeze(effect.statuses),
      toPercent: effect.toPercent,
    });
  }
  if (effect.type === "scaled-status-enemy-lost-hp") {
    return Object.freeze({
      type: effect.type,
      target: effect.target,
      status: effect.status,
      percentByRank: Object.freeze(effect.values),
    });
  }
  throw new TypeError(`unknown-general-source-effect:${effect.type}`);
}

function skill(id, name, {
  rarity,
  effects,
  replaces = null,
  consumesTurn = true,
  cooldown = 0,
  usesPerAct = UNLIMITED_USES,
  usesPerActByRank = null,
  resolveCostByRank = null,
  exclusiveTo = null,
  abilityType = null,
  description = null,
  source = null,
  note = null,
}) {
  const sourcedRankCount = usesPerActByRank?.length
    ?? effects.reduce((most, effect) => Math.max(most, (effect.percentByRank || effect.countByRank || []).length), 1);
  const rarityStart = SKILL_RARITY_PROGRESSION.indexOf(rarity);
  // General rewards can be promoted all the way to Mythical even when the captured
  // mechanic has only one value row. Effect and use tables deliberately hold their final
  // sourced value at those later rarities; progression must never synthesize combat math.
  const promotedRankCount = abilityType === "general" && rarityStart >= 0
    ? SKILL_RARITY_PROGRESSION.length - rarityStart
    : sourcedRankCount;
  const rankCount = Math.max(sourcedRankCount, promotedRankCount);
  return Object.freeze({
    id,
    name,
    rarity,
    slot: "slotted",
    effects: Object.freeze(effects),
    replaces,
    consumesTurn,
    cooldown,
    usesPerAct,
    usesPerActByRank: usesPerActByRank ? Object.freeze(usesPerActByRank) : null,
    resolveCostByRank: resolveCostByRank ? Object.freeze(resolveCostByRank) : null,
    exclusiveTo,
    archetypeId: canonicalTowArchetypeId(exclusiveTo),
    abilityType,
    description,
    source: source ? Object.freeze(source) : null,
    note,
    rankCount,
  });
}

function compileGeneralAbility(row) {
  const effects = row.effects.map(compileGeneralEffect);
  const description = `${effects.map((effect) => describeCharacterAbilityEffect(effect)).join("; ")}.`;
  return skill(row.id, row.name, {
    rarity: row.rarity,
    effects,
    consumesTurn: row.consumesTurn,
    cooldown: row.cooldown,
    usesPerAct: row.usesByRank[0],
    usesPerActByRank: row.usesByRank,
    resolveCostByRank: row.resolveCostByRank,
    abilityType: "general",
    description,
    source: {
      page: TOW_GENERAL_SOURCE_CAPTURE.url,
      artifact: TOW_GENERAL_SOURCE_CAPTURE.artifact,
      sourceName: row.name,
      sourceOriginalName: row.sourceName,
      sourceLine: row.sourceLine,
      rawRowsSha256: TOW_GENERAL_SOURCE_CAPTURE.rawRowsSha256,
      fidelity: "adapted",
      adaptations: Object.freeze(["per-act-uses-to-resolve"]),
      detail: "Source effect, rarity, recipient, action lane, cooldown, and per-rarity values are preserved; source per-Act uses are translated to the reviewed Resolve table.",
    },
    note: null,
  });
}

function sharedAbility(name, description, { fidelity = "direct", detail = description } = {}) {
  return {
    abilityType: "general",
    description,
    source: {
      page: GENERAL_ACTIVE_SOURCE,
      sourceName: name,
      fidelity,
      detail,
    },
    // Source fidelity is maintenance metadata, not part of the ability's combat effect.
    note: null,
  };
}

// Unslotted "skills" are immediate permanent stat increases that consume no slot.
function passive(id, name, rarity, bonuses) {
  return Object.freeze({
    id,
    name,
    rarity,
    slot: "unslotted",
    bonuses: Object.freeze(bonuses),
    consumesTurn: false,
    cooldown: 0,
    usesPerAct: UNLIMITED_USES,
    usesPerActByRank: null,
    replaces: null,
    exclusiveTo: null,
    effects: Object.freeze([]),
    rankCount: 1,
  });
}

const HAND_AUTHORED_SKILLS = Object.freeze([
  // --- Knight compatibility basics -----------------------------------------
  skill("strike", "Strike", {
    rarity: "common",
    effects: [damage("attack", [100, 115, 130, 145, 160, 175])],
  }),
  skill("shield-bash", "Shield Bash", {
    rarity: "uncommon",
    replaces: "strike",
    effects: [damage("defense", [105, 120, 135, 150, 165])],
  }),
  skill("slaughter", "Bleeding Cut", {
    rarity: "uncommon",
    replaces: "strike",
    effects: [
      damage("attack", [21, 24, 27, 30, 33]),
      scaledStatus("bleed", "enemy", "attack", [21, 24, 27, 30, 33]),
    ],
  }),
  skill("block", "Block", {
    rarity: "common",
    usesPerAct: 30,
    effects: [shield("defense", [250, 300, 350, 400, 450, 500])],
  }),
  skill("defensive-stance", "Defensive Stance", {
    rarity: "uncommon",
    replaces: "block",
    usesPerActByRank: [18, 21, 24, 27, 30],
    effects: [status("guard", "self", [3, 3, 3, 3, 3])],
  }),
  skill("parry", "Parry", {
    rarity: "uncommon",
    replaces: "block",
    usesPerAct: 25,
    effects: [shield("attack", [270, 310, 350, 390, 430])],
  }),

  // --- Knight compatibility abilities --------------------------------------
  skill("threatening-cry", "Challenge", {
    rarity: "uncommon",
    consumesTurn: false,
    usesPerAct: 7,
    exclusiveTo: "arctic-knight",
    effects: [scaledStatus("lethargy", "enemy", "attack", [60, 70, 80, 90, 100])],
  }),
  skill("mortal-blow", "Mortal Blow", {
    rarity: "uncommon",
    usesPerAct: 3,
    exclusiveTo: "arctic-knight",
    effects: [
      damage("attack", [210, 240, 270, 300, 330]),
      status("paralyze", "self", [1, 1, 1, 1, 1]),
    ],
  }),
  skill("giants-smash", "Colossus Blow", {
    rarity: "rare",
    usesPerAct: 3,
    exclusiveTo: "arctic-knight",
    effects: [
      damage("max-hp", [13, 16, 19, 22]),
      status("stun", "enemy", [1, 1, 1, 1]),
    ],
  }),
  skill("deliberate-blow", "Deliberate Blow", {
    rarity: "rare",
    usesPerAct: 10,
    exclusiveTo: "arctic-knight",
    effects: [
      damage("attack", [110, 135, 160, 185]),
      shield("defense", [110, 135, 160, 185]),
    ],
  }),
  skill("warcry", "Rally", {
    rarity: "rare",
    consumesTurn: false,
    usesPerActByRank: [4, 5, 6, 7],
    exclusiveTo: "arctic-knight",
    effects: [status("solidity", "self", [3, 3, 3, 3])],
  }),
  skill("fist-of-justice", "Shield Verdict", {
    rarity: "rare",
    usesPerAct: 5,
    exclusiveTo: "arctic-knight",
    effects: [
      damage("defense", [115, 140, 165, 190]),
      scaledStatus("lethargy", "enemy", "defense", [115, 140, 165, 190]),
    ],
  }),
  skill("retaliation", "Retaliation", {
    rarity: "legendary",
    usesPerAct: 8,
    exclusiveTo: "arctic-knight",
    effects: [
      shield("defense", [160, 240]),
      scaledStatus("counter-attack", "self", "defense", [160, 240]),
    ],
    note: "counterattack",
  }),
  skill("incineration", "Burning Reprisal", {
    rarity: "mythical",
    usesPerAct: 1,
    exclusiveTo: "arctic-knight",
    effects: [
      damage("attack", [110]),
      scaledStatus("burn", "enemy", "attack", [110]),
      status("paralyze", "self", [2]),
    ],
  }),

  // --- Common pool ----------------------------------------------------------
  skill("emergency-evasion", "Emergency Evasion", {
    rarity: "rare",
    consumesTurn: false,
    usesPerAct: 4,
    effects: [status("evade", "self", [1])],
    ...sharedAbility("Emergency Evasion", "Gain 1 Evade without spending the main action."),
  }),
  skill("elixir-of-wrath", "Elixir of Wrath", {
    rarity: "uncommon",
    consumesTurn: false,
    usesPerAct: 3,
    effects: [status("strength", "self", [6])],
    ...sharedAbility("Elixir of Wrath", "Drink the elixir without spending the main action to gain 6 Strength."),
  }),
  skill("first-aid", "First Aid", {
    rarity: "uncommon",
    usesPerAct: 5,
    effects: [
      Object.freeze({ type: "heal-lost-fraction", percentByRank: Object.freeze([24]), target: "self" }),
      Object.freeze({
        type: "reduce-statuses",
        statuses: Object.freeze(["bleed", "burn", "poison"]),
        toPercent: 60,
        target: "self",
      }),
    ],
    ...sharedAbility("First Aid", "Restore 24% of lost health and reduce Bleed, Burn, and Poison to 60%."),
  }),
  skill("impregnable", "Impregnable", {
    rarity: "legendary",
    usesPerAct: 2,
    effects: [status("guard", "self", [9])],
  }),
  skill("judge-of-fate", "Judge of Fate", {
    rarity: "legendary",
    consumesTurn: false,
    cooldown: 6,
    usesPerAct: 2,
    effects: [Object.freeze({
      type: "scaled-status-enemy-lost-hp",
      status: "misfortune",
      target: "enemy",
      percentByRank: Object.freeze([30]),
    })],
    ...sharedAbility("Judge of Fate", "Without spending the main action, inflict Misfortune equal to 30% of the enemy's missing health."),
  }),
  skill("penetration", "Penetration", {
    rarity: "uncommon",
    usesPerAct: 7,
    effects: [scaledStatus("doom", "enemy", "attack", [180])],
    ...sharedAbility("Penetration", "Bypass ordinary protection with special damage pressure equal to 180% ATK."),
  }),
  skill("rapid-cooling", "Rapid Cooling", {
    rarity: "uncommon",
    cooldown: 3,
    usesPerAct: 5,
    effects: [
      status("paralyze", "enemy", [2]),
      status("solidity", "self", [1]),
    ],
    ...sharedAbility("Rapid Cooling", "Inflict 2 Paralyze and gain 1 Solidity; cooldown 3."),
  }),
  skill("rising-power", "Rising Power", {
    rarity: "uncommon",
    usesPerAct: 7,
    effects: [
      status("charge", "self", [100]),
      status("overload", "self", [15]),
    ],
  }),
  skill("shouting", "Shouting", {
    rarity: "uncommon",
    consumesTurn: false,
    usesPerAct: 7,
    effects: [scaledStatus("lethargy", "enemy", "attack", [60])],
  }),
  skill("sleep-grenade", "Sleep Grenade Toss", {
    rarity: "rare",
    cooldown: 6,
    usesPerAct: 4,
    effects: [status("sleep", "enemy", [3])],
    ...sharedAbility("Sleep Grenade Toss", "Put the enemy to Sleep for 3 turns; taking a hit breaks the effect."),
  }),
  skill("sudden-blow", "Sudden Blow", {
    rarity: "rare",
    consumesTurn: false,
    usesPerAct: 6,
    effects: [damage("attack", [80])],
    ...sharedAbility("Sudden Blow", "Deal 80% ATK damage without spending the main action."),
  }),
  skill("thirst-for-blood", "Thirst for Blood", {
    rarity: "rare",
    consumesTurn: false,
    cooldown: 9,
    usesPerAct: 4,
    effects: [status("lifesteal", "self", [16, 20])],
  }),
  skill("transcendence", "Transcendence", {
    rarity: "legendary",
    usesPerAct: 1,
    effects: [
      status("strength", "self", [8]),
      status("tenacity", "self", [8]),
      status("focus", "self", [20]),
    ],
    ...sharedAbility("Transcendence", "Break mortal limits for 8 Strength, 8 Tenacity, and 20 Focus."),
  }),
  skill("unbendable-will", "Unbendable Will", {
    rarity: "rare",
    consumesTurn: false,
    usesPerAct: 4,
    effects: [status("unstoppable", "self", [4])],
    ...sharedAbility("Unbendable Will", "Gain 4 Unstoppable without spending the main action."),
  }),
  skill("urgent-guard", "Urgent Guard", {
    rarity: "uncommon",
    consumesTurn: false,
    usesPerAct: 9,
    effects: [shield("defense", [100])],
    ...sharedAbility("Urgent Guard", "Raise a 100% DEF ward without spending the main action."),
  }),
  skill("stone-skin-elixir", "Stone Skin Elixir", {
    rarity: "uncommon",
    consumesTurn: false,
    usesPerAct: 3,
    effects: [status("tenacity", "self", [6])],
    ...sharedAbility("Stone Skin Elixir", "Harden the body with 6 Tenacity without spending the main action.", {
      fidelity: "adapted",
      detail: "The source documents an elixir that raises DEF; the amount is normalized as Tenacity in this kernel.",
    }),
  }),
  skill("protection-scroll", "Protection Scroll", {
    rarity: "rare",
    consumesTurn: false,
    cooldown: 6,
    usesPerAct: 3,
    effects: [status("protection", "self", [9])],
    ...sharedAbility("Protection Scroll", "Unfurl a persistent 9 Protection force field without spending the main action.", {
      fidelity: "adapted",
      detail: "The source documents a free-action Force Field scroll; the field is represented by Protection stacks.",
    }),
  }),
  skill("killing-instinct", "Killing Instinct", {
    rarity: "rare",
    consumesTurn: false,
    usesPerAct: 3,
    effects: [status("focus", "self", [25])],
    ...sharedAbility("Killing Instinct", "Sharpen lethal focus by 25 without spending the main action.", {
      fidelity: "adapted",
      detail: "The source identifies Killing Instinct as a critical-focused buff; its capstone focus is normalized here.",
    }),
  }),
  skill("blade-of-curse", "Blade of Curse", {
    rarity: "rare",
    usesPerAct: 4,
    effects: [damage("attack", [140]), scaledStatus("doom", "enemy", "attack", [100])],
    ...sharedAbility("Blade of Curse", "Strike for 140% ATK and leave Doom equal to 100% ATK.", {
      fidelity: "adapted",
      detail: "The source names the cursed shared blade; damage and curse pressure are normalized for this kernel.",
    }),
  }),
  skill("beastification", "Beastification", {
    rarity: "legendary",
    consumesTurn: false,
    cooldown: 8,
    usesPerAct: 2,
    effects: [status("strength", "self", [8]), status("lifesteal", "self", [14])],
    ...sharedAbility("Beastification", "Assume a predatory form for 8 Strength and 14 Lifesteal without spending the main action.", {
      fidelity: "adapted",
      detail: "The source names a beast-form shared buff; its offensive and feeding identity is normalized here.",
    }),
  }),
  skill("super-speed", "Super Speed", {
    rarity: "legendary",
    consumesTurn: false,
    usesPerAct: 1,
    effects: [status("haste", "self", [2])],
    ...sharedAbility("Super Speed", "Gain 2 Haste without spending the main action."),
  }),
  skill("peace-declaration", "Peace Declaration", {
    rarity: "mythical",
    cooldown: 7,
    usesPerAct: 2,
    effects: [status("paralyze", "enemy", [1]), scaledStatus("lethargy", "enemy", "defense", [200])],
    ...sharedAbility("Peace Declaration", "Break the enemy's will to fight with 1 Paralyze and Lethargy equal to 200% DEF.", {
      fidelity: "adapted",
      detail: "The source describes wide-area magic that removes the will to fight; control and Lethargy recreate that effect.",
    }),
  }),
]);

const GENERAL_SKILLS = Object.freeze(TOW_GENERAL_ABILITY_SOURCE_ROWS.map(compileGeneralAbility));
const SKILLS = Object.freeze(Object.fromEntries([
  ...HAND_AUTHORED_SKILLS.filter((entry) => !GENERAL_ABILITY_ID_SET.has(entry.id)),
  ...GENERAL_SKILLS,
].map((entry) => [entry.id, entry])));

const PASSIVES = Object.freeze(Object.fromEntries([
  passive("power-of-beast", "Power of Beast", "uncommon", { attack: 3 }),
  passive("bless-of-life", "Bless of Life", "uncommon", { maxHp: 30 }),
  passive("assassins-skill", "Assassin's Skill", "uncommon", { critRate: 8 }),
  passive("power-of-giant", "Power of Giant", "rare", { attack: 5 }),
  passive("bless-of-earth", "Bless of Earth", "rare", { defense: 5 }),
  passive("swift-of-gale", "Swift of Gale", "rare", { dodgeRate: 4 }),
  passive("limit-breaker", "Limit Breaker", "rare", { critRate: 3, dodgeRate: 3 }),
  passive("bless-of-god", "Bless of God", "epic", { attack: 2, defense: 2, maxHp: 20 }),
  passive("protected-by-god", "Protected by God", "legendary", { defense: 7 }),
  passive("infinite-vitality", "Infinite Vitality", "legendary", { maxHpPercent: 70 }),
  passive("crushing-blow", "Crushing Blow", "legendary", { critRate: 12 }),
  passive("ascension", "Ascension", "mythical", { attack: 3, defense: 3, critRate: 3, dodgeRate: 3 }),
].map((entry) => [entry.id, entry])));

export function getSkill(skillId) {
  if (typeof skillId !== "string") return null;
  const characterAbility = getCharacterAbility(skillId);
  if (characterAbility) return characterAbility;
  if (Object.hasOwn(SKILLS, skillId)) return SKILLS[skillId];
  return Object.hasOwn(PASSIVES, skillId) ? PASSIVES[skillId] : null;
}

export function skillIds() {
  return [...Object.keys(SKILLS), ...characterAbilityIds()];
}

export function generalAbilityIds() {
  return [...GENERAL_ABILITY_IDS];
}

export function isFlexibleAbility(definition) {
  return Boolean(definition && FLEXIBLE_CHARACTER_ABILITY_TYPES.includes(definition.abilityType));
}

export function abilityReplacementFamily(definition) {
  if (!definition) return null;
  if (definition.abilityType === "basic-attack") return "basic-attack";
  if (definition.abilityType === "defensive") return "defensive";
  if (isFlexibleAbility(definition)) return "flexible";
  return null;
}

/** The canonical combat archetype represented by a roster loadout, if it has one. */
export function loadoutCharacterId(loadout) {
  if (!Array.isArray(loadout)) return null;
  const owners = new Set(loadout
    .map((entry) => getSkill(typeof entry === "string" ? entry : entry?.id)?.exclusiveTo)
    .filter(Boolean));
  return owners.size === 1 ? [...owners][0] : null;
}

/** Resolve the slots one incoming action is contractually allowed to replace. */
export function replacementSkillIds(loadout, incomingSkillOrId) {
  if (!Array.isArray(loadout)) return [];
  const incoming = typeof incomingSkillOrId === "string"
    ? getSkill(incomingSkillOrId)
    : incomingSkillOrId;
  const family = abilityReplacementFamily(incoming);
  if (!family) return [];
  return loadout
    .map((entry) => (typeof entry === "string" ? entry : entry?.id))
    .filter((id) => abilityReplacementFamily(getSkill(id)) === family);
}

/** Backward-compatible shorthand for the three flexible slots. */
export function replaceableSkillIds(loadout) {
  if (!Array.isArray(loadout)) return [];
  return loadout
    .map((entry) => (typeof entry === "string" ? entry : entry?.id))
    .filter((id) => abilityReplacementFamily(getSkill(id)) === "flexible");
}

export function passiveSkillIds() {
  return Object.keys(PASSIVES);
}

export function maxRankOf(skillId) {
  const definition = getSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  return definition.rankCount;
}

function skillDefinition(skillOrId) {
  const definition = typeof skillOrId === "string" ? getSkill(skillOrId) : skillOrId;
  if (!definition) throw new TypeError(`unknown-skill:${skillOrId}`);
  return definition;
}

/** Player-facing rarity states this ability can occupy. */
export function skillRarityChoices(skillOrId) {
  const definition = skillDefinition(skillOrId);
  const start = SKILL_RARITY_PROGRESSION.indexOf(definition.rarity);
  const choices = SKILL_RARITY_PROGRESSION.slice(start, start + definition.rankCount);
  if (start < 0 || choices.length !== definition.rankCount) {
    throw new TypeError(`invalid-skill-rarity-progression:${definition.id}`);
  }
  return choices;
}

/** Translate the engine's compact rank index into its promoted rarity. */
export function skillRarityAtRank(skillOrId, rank = 1) {
  const definition = skillDefinition(skillOrId);
  return skillRarityChoices(definition)[rankIndex(definition, rank)];
}

/** Translate a player-selected rarity into the compact runtime row. */
export function skillRankForRarity(skillOrId, rarity) {
  const definition = skillDefinition(skillOrId);
  const index = skillRarityChoices(definition).indexOf(rarity);
  if (index < 0) throw new TypeError("invalid-skill-rarity");
  return index + 1;
}

function rankIndex(definition, rank) {
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > definition.rankCount) {
    throw new TypeError("invalid-skill-rank");
  }
  return rank - 1;
}

/** Uses a skill starts an act with, at a given rank. */
export function usesPerAct(skillId, rank = 1) {
  const definition = getSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  const index = rankIndex(definition, rank);
  if (definition.usesPerActByRank) {
    return definition.usesPerActByRank[Math.min(index, definition.usesPerActByRank.length - 1)];
  }
  return definition.usesPerAct;
}

/**
 * Resolve spent by a current-rules encounter when this ability is committed.
 *
 * `usesPerAct` remains source/migration metadata. This is the playable scarcity contract.
 * A Resolve-restoring ability still has a price, because the current economy has no hidden
 * exception for an action that used to be limited. Its price is one below its restoration,
 * making the rare technique a one-point net recovery instead of a free three-point refill.
 */
export function resolveCost(skillId, rank = 1) {
  const definition = getSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  const index = rankIndex(definition, rank);
  if (definition.resolveCostByRank) return definition.resolveCostByRank[index];
  const restoreIndex = definition.effects.findIndex((effect) => effect.type === "restore-skill-uses");
  if (restoreIndex >= 0) {
    return Math.max(1, Math.min(6, effectMagnitude(skillId, restoreIndex, rank) - 1));
  }
  const uses = usesPerAct(skillId, rank);
  if (uses === UNLIMITED_USES) return 0;
  if (isAllowanceOnlyProgression(definition)) {
    const finalCost = resolveBandCost(usesPerAct(skillId, definition.rankCount));
    return finalCost + (definition.rankCount - rank);
  }
  return resolveBandCost(uses);
}

/** The magnitude of one of a skill's effects at a rank. */
export function effectMagnitude(skillId, effectIndex, rank = 1) {
  const definition = getSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  const effect = definition.effects[effectIndex];
  if (!effect) throw new TypeError("unknown-skill-effect");
  const index = rankIndex(definition, rank);
  const table = effect.percentByRank || effect.countByRank || effect.factorByRank;
  if (!Array.isArray(table) || table.length === 0) return null;
  // A short table means the value does not scale past its last listed rank.
  return table[Math.min(index, table.length - 1)];
}

// ---------------------------------------------------------------------------
// Per-skill runtime state
// ---------------------------------------------------------------------------

export function createSkillState(skillId, rank = 1) {
  const definition = getSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  if (definition.slot !== "slotted") throw new TypeError("unslotted-skill-has-no-state");
  rankIndex(definition, rank);
  return {
    id: skillId,
    rank,
    usesRemaining: usesPerAct(skillId, rank),
    cooldownRemaining: 0,
  };
}

export function isSkillState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== 4 || keys.join() !== "cooldownRemaining,id,rank,usesRemaining") return false;
  const definition = getSkill(value.id);
  if (!definition || definition.slot !== "slotted") return false;
  if (!Number.isSafeInteger(value.rank) || value.rank < 1 || value.rank > definition.rankCount) {
    return false;
  }
  const limit = usesPerAct(value.id, value.rank);
  // Current Resolve encounters deliberately normalize every charge counter to the shared
  // unlimited sentinel. Finite integers remain valid only for captured v1 charge replays.
  const usesValid = value.usesRemaining === UNLIMITED_USES
    || (limit !== UNLIMITED_USES && Number.isSafeInteger(value.usesRemaining)
      && value.usesRemaining >= 0
      && value.usesRemaining <= limit);
  return usesValid
    && Number.isSafeInteger(value.cooldownRemaining)
    && value.cooldownRemaining >= 0
    && value.cooldownRemaining <= definition.cooldown;
}

/**
 * Whether a skill can be used right now.
 *
 * `turnAvailable` is false once the turn-consuming action has been spent; a skill that
 * does not consume a turn stays legal.
 */
export function skillLegality(state, { turnAvailable = true, resolveAvailable = null } = {}) {
  if (!isSkillState(state)) return { ok: false, reason: "invalid-skill-state" };
  const definition = getSkill(state.id);
  if (state.cooldownRemaining > 0) return { ok: false, reason: "on-cooldown" };
  // Explicit Resolve marks the current economy. A missing value is a legacy replay/fixture
  // and continues to obey its captured finite-use state, so already-recorded fights remain
  // reproducible rather than being silently migrated mid-exchange.
  if (Number.isFinite(resolveAvailable) && resolveAvailable < resolveCost(state.id, state.rank)) {
    return { ok: false, reason: "insufficient-resolve" };
  }
  if (!Number.isFinite(resolveAvailable)
    && state.usesRemaining !== UNLIMITED_USES
    && state.usesRemaining <= 0) {
    return { ok: false, reason: "no-uses-remaining" };
  }
  if (definition.consumesTurn && !turnAvailable) return { ok: false, reason: "turn-already-spent" };
  return { ok: true, reason: null };
}

/** Start the cooldown and, for a captured legacy state, spend one recorded charge. Pure. */
export function spendSkill(state) {
  const legality = skillLegality(state);
  if (!legality.ok) return { ok: false, reason: legality.reason, state: null };
  const definition = getSkill(state.id);
  return {
    ok: true,
    reason: null,
    state: {
      ...state,
      usesRemaining: state.usesRemaining === UNLIMITED_USES
        ? UNLIMITED_USES
        : state.usesRemaining - 1,
      cooldownRemaining: definition.cooldown,
    },
  };
}

export function tickSkillCooldown(state) {
  if (state.cooldownRemaining <= 0) return state;
  return { ...state, cooldownRemaining: state.cooldownRemaining - 1 };
}

/** Uses refill fully at the start of an act. Cooldowns do not persist between acts. */
export function refillForNewAct(state) {
  return {
    ...state,
    usesRemaining: usesPerAct(state.id, state.rank),
    cooldownRemaining: 0,
  };
}

/**
 * A partial refill from an event, item or meditation. Every method tops up all skills
 * by the same amount, so this takes one amount and never exceeds the act limit.
 */
export function restoreUses(state, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError("invalid-restore-amount");
  const limit = usesPerAct(state.id, state.rank);
  if (limit === UNLIMITED_USES) return state;
  return { ...state, usesRemaining: Math.min(limit, state.usesRemaining + amount) };
}

/**
 * Acquiring a skill you already hold upgrades it a rank and refills it. Acquiring a new
 * one adds it if a slot is free, or replaces `replacingId` if the loadout is full.
 */
export function acquireSkill(loadout, skillId, { replacingId = null } = {}) {
  const definition = getSkill(skillId);
  if (!definition) return { ok: false, reason: "unknown-skill", loadout: null };
  if (definition.slot !== "slotted") return { ok: false, reason: "unslotted-skill", loadout: null };
  if (!Array.isArray(loadout)) return { ok: false, reason: "invalid-loadout", loadout: null };
  const owner = loadoutCharacterId(loadout);
  if (definition.exclusiveTo && owner && definition.exclusiveTo !== owner) {
    return { ok: false, reason: "foreign-character-ability", loadout: null };
  }

  const held = loadout.findIndex((entry) => entry.id === skillId);
  if (held >= 0) {
    const current = loadout[held];
    const nextRank = Math.min(definition.rankCount, current.rank + 1);
    return {
      ok: true,
      reason: null,
      upgraded: true,
      loadout: loadout.map((entry, at) => (at === held ? createSkillState(skillId, nextRank) : entry)),
    };
  }

  // A skill that replaces a basic action takes over that slot rather than a free one.
  if (definition.replaces) {
    const replacedAt = loadout.findIndex((entry) => {
      const heldDefinition = getSkill(entry.id);
      return entry.id === definition.replaces || heldDefinition?.replaces === definition.replaces;
    });
    if (replacedAt >= 0) {
      return {
        ok: true,
        reason: null,
        upgraded: false,
        loadout: loadout.map((entry, at) => (at === replacedAt ? createSkillState(skillId) : entry)),
      };
    }
  }

  // Character Basic Attack and Defensive alternatives replace only their own family,
  // even while the loadout has fewer than five entries. They never consume a flexible slot.
  const family = abilityReplacementFamily(definition);
  if (family === "basic-attack" || family === "defensive") {
    const compatible = replacementSkillIds(loadout, definition);
    const replacement = replacingId || compatible[0] || null;
    if (replacement) {
      if (!compatible.includes(replacement)) {
        return { ok: false, reason: "incompatible-ability-slot", loadout: null };
      }
      return {
        ok: true,
        reason: null,
        upgraded: false,
        loadout: loadout.map((entry) => (
          entry.id === replacement ? createSkillState(skillId) : entry
        )),
      };
    }
  }

  if (loadout.length < SKILL_SLOTS) {
    return { ok: true, reason: null, upgraded: false, loadout: [...loadout, createSkillState(skillId)] };
  }

  if (replacingId === null) return { ok: false, reason: "loadout-full", loadout: null };
  const replaceAt = loadout.findIndex((entry) => entry.id === replacingId);
  if (replaceAt < 0) return { ok: false, reason: "unknown-replacement", loadout: null };
  if (!replacementSkillIds(loadout, definition).includes(replacingId)) {
    const replacedFamily = abilityReplacementFamily(getSkill(loadout[replaceAt].id));
    const reason = family === "flexible" && replacedFamily !== "flexible"
      ? "protected-ability-slot"
      : "incompatible-ability-slot";
    return { ok: false, reason, loadout: null };
  }
  return {
    ok: true,
    reason: null,
    upgraded: false,
    loadout: loadout.map((entry, at) => (at === replaceAt ? createSkillState(skillId) : entry)),
  };
}

/** Stat bonuses from every unslotted skill acquired. */
export function passiveBonuses(passiveIds) {
  const total = { attack: 0, defense: 0, maxHp: 0, critRate: 0, dodgeRate: 0, maxHpPercent: 0 };
  for (const id of passiveIds || []) {
    const definition = getSkill(id);
    if (!definition || definition.slot !== "unslotted") continue;
    for (const [key, value] of Object.entries(definition.bonuses)) {
      total[key] = (total[key] || 0) + value;
    }
  }
  return total;
}
