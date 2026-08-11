// The Tower of Winter skill catalogue and its use/cooldown state machine, transcribed
// from docs/design/TOW_EVIDENCE.md.
//
// Two details separate this from the placeholder it replaces. Uses are bounded **per act**,
// not per encounter — they refill at the start of an act and from events, items and
// meditation, and every refill method tops up all skills equally. And a skill can *replace*
// the basic attack or defence rather than taking a slot, which is what makes Strike and
// Block slots rather than cards.
//
// Rank values are quoted verbatim from the wiki rather than interpolated: unlike traits,
// every skill lists its per-rank magnitudes outright.

export const SKILL_SLOTS = 5;
export const RARITIES = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
]);

export const UNLIMITED_USES = null;

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

function skill(id, name, {
  rarity,
  effects,
  replaces = null,
  consumesTurn = true,
  cooldown = 0,
  usesPerAct = UNLIMITED_USES,
  usesPerActByRank = null,
  exclusiveTo = null,
  note = null,
}) {
  const rankCount = usesPerActByRank?.length
    ?? effects.reduce((most, effect) => Math.max(most, (effect.percentByRank || effect.countByRank || []).length), 1);
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
    exclusiveTo,
    note,
    rankCount,
  });
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

const SKILLS = Object.freeze(Object.fromEntries([
  // --- Arctic Knight basics -------------------------------------------------
  skill("strike", "Strike", {
    rarity: "common",
    effects: [damage("attack", [100, 115, 130, 145, 160, 175])],
  }),
  skill("shield-bash", "Shield Bash", {
    rarity: "uncommon",
    replaces: "strike",
    effects: [damage("defense", [105, 120, 135, 150, 165])],
  }),
  skill("slaughter", "Slaughter", {
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

  // --- Arctic Knight exclusives --------------------------------------------
  skill("threatening-cry", "Threatening Cry", {
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
  skill("giants-smash", "Giant's Smash", {
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
  skill("warcry", "Warcry", {
    rarity: "rare",
    consumesTurn: false,
    usesPerActByRank: [4, 5, 6, 7],
    exclusiveTo: "arctic-knight",
    effects: [status("solidity", "self", [3, 3, 3, 3])],
  }),
  skill("fist-of-justice", "Fist of Justice", {
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
    effects: [shield("defense", [160, 240])],
    note: "counterattack",
  }),
  skill("incineration", "Incineration", {
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
  }),
  skill("elixir-of-wrath", "Elixir of Wrath", {
    rarity: "uncommon",
    consumesTurn: false,
    usesPerAct: 3,
    effects: [status("strength", "self", [6])],
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
  }),
  skill("penetration", "Penetration", {
    rarity: "uncommon",
    usesPerAct: 7,
    effects: [scaledStatus("doom", "enemy", "attack", [180])],
  }),
  skill("rapid-cooling", "Rapid Cooling", {
    rarity: "uncommon",
    cooldown: 3,
    usesPerAct: 5,
    effects: [
      status("paralyze", "enemy", [2]),
      status("solidity", "self", [1]),
    ],
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
  skill("sleep-grenade", "Sleep Grenade", {
    rarity: "rare",
    cooldown: 6,
    usesPerAct: 4,
    effects: [status("sleep", "enemy", [3])],
  }),
  skill("sudden-blow", "Sudden Blow", {
    rarity: "rare",
    consumesTurn: false,
    usesPerAct: 6,
    effects: [damage("attack", [80])],
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
  }),
  skill("unbendable-will", "Unbendable Will", {
    rarity: "rare",
    consumesTurn: false,
    usesPerAct: 4,
    effects: [status("unstoppable", "self", [4])],
  }),
  skill("urgent-guard", "Urgent Guard", {
    rarity: "uncommon",
    consumesTurn: false,
    usesPerAct: 9,
    effects: [shield("defense", [100])],
  }),
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
  if (Object.hasOwn(SKILLS, skillId)) return SKILLS[skillId];
  return Object.hasOwn(PASSIVES, skillId) ? PASSIVES[skillId] : null;
}

export function skillIds() {
  return Object.keys(SKILLS);
}

export function passiveSkillIds() {
  return Object.keys(PASSIVES);
}

export function maxRankOf(skillId) {
  const definition = getSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  return definition.rankCount;
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
  if (definition.usesPerActByRank) return definition.usesPerActByRank[index];
  return definition.usesPerAct;
}

/** The magnitude of one of a skill's effects at a rank. */
export function effectMagnitude(skillId, effectIndex, rank = 1) {
  const definition = getSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  const effect = definition.effects[effectIndex];
  if (!effect) throw new TypeError("unknown-skill-effect");
  const index = rankIndex(definition, rank);
  const table = effect.percentByRank || effect.countByRank;
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
  const usesValid = limit === UNLIMITED_USES
    ? value.usesRemaining === UNLIMITED_USES
    : Number.isSafeInteger(value.usesRemaining)
      && value.usesRemaining >= 0
      && value.usesRemaining <= limit;
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
export function skillLegality(state, { turnAvailable = true } = {}) {
  if (!isSkillState(state)) return { ok: false, reason: "invalid-skill-state" };
  const definition = getSkill(state.id);
  if (state.cooldownRemaining > 0) return { ok: false, reason: "on-cooldown" };
  if (state.usesRemaining !== UNLIMITED_USES && state.usesRemaining <= 0) {
    return { ok: false, reason: "no-uses-remaining" };
  }
  if (definition.consumesTurn && !turnAvailable) return { ok: false, reason: "turn-already-spent" };
  return { ok: true, reason: null };
}

/** Spend one use and start the cooldown. Pure. */
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

  if (loadout.length < SKILL_SLOTS) {
    return { ok: true, reason: null, upgraded: false, loadout: [...loadout, createSkillState(skillId)] };
  }

  if (replacingId === null) return { ok: false, reason: "loadout-full", loadout: null };
  const replaceAt = loadout.findIndex((entry) => entry.id === replacingId);
  if (replaceAt < 0) return { ok: false, reason: "unknown-replacement", loadout: null };
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
