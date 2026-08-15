// Source-calibrated character abilities for the complete Tower of Winter roster.
//
// Stable Solitaire ids remain unchanged so saves, authored VFX, and loadouts keep working.
// Every player-facing mechanic is compiled directly from the shipped 1.4.16 table rows
// in `character-ability-source-data.js`: 12 characters x 23 abilities.

import {
  TOW_CHARACTER_ABILITY_SOURCE_ROWS,
  TOW_CHARACTER_SOURCE_PAGE,
  TOW_RELEASE_SOURCE_PAGE,
  TOW_SOURCE_BUILD,
  TOW_STATUS_SOURCE_ROWS,
} from "./character-ability-source-data.js";

export const CHARACTER_ABILITY_TYPES = Object.freeze([
  "basic-attack",
  "defensive",
  "archetype",
  "general",
]);

export const CHARACTER_ABILITY_TYPE_LABELS = Object.freeze({
  "basic-attack": "Basic attack",
  defensive: "Defensive",
  archetype: "Exclusive ability",
  general: "General ability",
});

export const FIXED_CHARACTER_ABILITY_TYPES = Object.freeze(["basic-attack", "defensive"]);
export const FLEXIBLE_CHARACTER_ABILITY_TYPES = Object.freeze(["archetype", "general"]);

const RANKS_BY_SOURCE_GRADE = Object.freeze({
  Common: 6,
  Uncommon: 5,
  Rare: 4,
  Legendary: 2,
  Mythic: 1,
});

const RARITY_BY_SOURCE_GRADE = Object.freeze({
  Common: "common",
  Uncommon: "uncommon",
  Rare: "rare",
  Legendary: "legendary",
  Mythic: "mythical",
});

// Internal status ids predate the source-table import. These aliases keep old encounter
// receipts readable while pointing every source TableId at one canonical runtime rule.
const STATUS_ID_ALIASES = Object.freeze({
  1020021: "charge",
  1020025: "counter-attack",
  1020026: "rage",
  1020027: "consecration",
  1020028: "poison-atk",
  1020029: "doom-atk",
  1020030: "bleed-atk",
  1020031: "lethargy-atk",
  1020032: "confusion",
  1020033: "composure",
  1020042: "judgment",
  1020044: "berserk",
  1020052: "bone-shield",
  1020053: "death-claw",
  1020055: "mirror-image",
  1020056: "void-monster",
  1020057: "hellfire-spirit",
  1020058: "limited-life-sentence",
  1020060: "foul-ceremony",
  1020062: "wind-blade",
  1020064: "fatal-blade",
});

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function statusLabel(value) {
  return String(value || "status")
    .split("-")
    .map((part) => (part === "atk" ? "Attack" : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

export const TOW_STATUS_ID_TO_TYPE = Object.freeze(Object.fromEntries(
  TOW_STATUS_SOURCE_ROWS.map(([sourceId, englishName, koreanName]) => [
    sourceId,
    STATUS_ID_ALIASES[sourceId] || slug(englishName) || `source-status-${sourceId}-${slug(koreanName)}`,
  ]),
));

const round = (value) => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

function rankTable(base, increment, rankCount, multiplier = 1) {
  return Object.freeze(Array.from(
    { length: rankCount },
    (_, index) => round((base + (increment * index)) * multiplier),
  ));
}

function targetOf(sourceTarget) {
  if (sourceTarget === "Ally") return "self";
  if (sourceTarget === "Enemy") return "enemy";
  if (sourceTarget === "All") return "all";
  throw new TypeError(`unknown-source-target:${sourceTarget}`);
}

function scaleOf(sourceFactor) {
  if (sourceFactor === "Attack") return "attack";
  if (sourceFactor === "Defense") return "defense";
  if (sourceFactor === "MaxHp") return "max-hp";
  if (sourceFactor === "Hp") return "current-hp";
  return null;
}

function freezeEffect(effect) {
  for (const key of ["percentByRank", "countByRank", "factorByRank", "statuses"]) {
    if (Array.isArray(effect[key]) && !Object.isFrozen(effect[key])) Object.freeze(effect[key]);
  }
  return Object.freeze(effect);
}

function sourceDamage(effect, rankCount) {
  const [, factorType, base, increment, , factorStatusId, sourceTarget] = effect;
  const target = targetOf(sourceTarget);
  const scale = scaleOf(factorType);
  if (scale) {
    return freezeEffect({
      type: "damage",
      target,
      scale,
      percentByRank: rankTable(base, increment, rankCount, 100),
    });
  }
  const factorMap = {
    LostHp: ["self", "lost-hp"],
    TargetHp: ["enemy", "current-hp"],
    TargetLostHp: ["enemy", "lost-hp"],
    TargetMaxHp: ["enemy", "max-hp"],
  };
  if (factorMap[factorType]) {
    const [factorOwner, factorScale] = factorMap[factorType];
    return freezeEffect({
      type: "damage",
      target,
      factorOwner,
      factorScale,
      percentByRank: rankTable(base, increment, rankCount, 100),
    });
  }
  if (factorType === "StatusEffectStackCount" || factorType === "TargetStatusEffectStackCount") {
    return freezeEffect({
      type: "damage",
      target,
      factorOwner: factorType === "StatusEffectStackCount" ? "self" : "enemy",
      factorStatus: TOW_STATUS_ID_TO_TYPE[factorStatusId],
      factorByRank: rankTable(base, increment, rankCount),
    });
  }
  throw new TypeError(`unknown-source-damage-factor:${factorType}`);
}

function sourceHeal(effect, rankCount) {
  const [, factorType, base, increment, , , sourceTarget] = effect;
  const target = targetOf(sourceTarget);
  const scale = scaleOf(factorType);
  if (scale) {
    return freezeEffect({
      type: "heal",
      target,
      scale,
      percentByRank: rankTable(base, increment, rankCount, 100),
    });
  }
  if (factorType === "LostHp") {
    return freezeEffect({
      type: "heal-lost-fraction",
      target,
      percentByRank: rankTable(base, increment, rankCount, 100),
    });
  }
  if (factorType === "None") {
    return freezeEffect({
      type: "heal-flat",
      target,
      countByRank: rankTable(base, increment, rankCount),
    });
  }
  throw new TypeError(`unknown-source-heal-factor:${factorType}`);
}

function sourceState(effect, rankCount) {
  const [
    , factorType, base, increment, statusId, factorStatusId, sourceTarget, stackDownDelay,
  ] = effect;
  const target = targetOf(sourceTarget);
  const status = TOW_STATUS_ID_TO_TYPE[statusId];

  // Source Shield is a transient absorb pool in the actor model, not a persistent status.
  if (statusId === 1020008) {
    return freezeEffect({
      type: "shield",
      target,
      scale: scaleOf(factorType),
      percentByRank: rankTable(base, increment, rankCount, 100),
    });
  }

  // Terminal Sentence is a countdown whose source status deals 666 when removed.
  if (statusId === 1020058) {
    return freezeEffect({
      type: "delayed-damage",
      target,
      countByRank: Object.freeze(Array(rankCount).fill(666)),
      turnsByRank: rankTable(base, increment, rankCount),
      status,
    });
  }

  // Foul Ceremony is the source's four-turn death timer used by Life Gambling and
  // Emergency Fuel. Its stack-out payload is the fixed 9999 damage stored in the status
  // table, not an invented Doom stack.
  if (statusId === 1020060) {
    return freezeEffect({
      type: "delayed-damage",
      target,
      countByRank: Object.freeze(Array(rankCount).fill(9999)),
      turnsByRank: rankTable(base, increment, rankCount),
      status,
    });
  }

  const scale = scaleOf(factorType);
  if (scale) {
    return freezeEffect({
      type: "scaled-status",
      status,
      target,
      scale,
      percentByRank: rankTable(base, increment, rankCount, 100),
      stackDownDelay,
    });
  }
  if (factorType === "TargetHp") {
    return freezeEffect({
      type: "scaled-status",
      status,
      target,
      factorOwner: "enemy",
      factorScale: "current-hp",
      percentByRank: rankTable(base, increment, rankCount, 100),
      stackDownDelay,
    });
  }
  if (factorType === "None") {
    const values = rankTable(base, increment, rankCount);
    return freezeEffect({
      type: values.some((value) => value < 0) ? "modify-status" : "status",
      status,
      target,
      countByRank: values,
      stackDownDelay,
    });
  }
  if (factorType === "StatusEffectStackCount" || factorType === "TargetStatusEffectStackCount") {
    return freezeEffect({
      type: "status-from-status",
      status,
      target,
      factorOwner: factorType === "StatusEffectStackCount" ? "self" : "enemy",
      factorStatus: TOW_STATUS_ID_TO_TYPE[factorStatusId],
      factorByRank: rankTable(base, increment, rankCount),
      stackDownDelay,
    });
  }
  throw new TypeError(`unknown-source-status-factor:${factorType}`);
}

function sourceMultiplier(effect, rankCount) {
  const [, factorType, base, increment, statusId, , sourceTarget] = effect;
  if (factorType !== "None") throw new TypeError(`unknown-source-multiplier-factor:${factorType}`);
  return freezeEffect({
    type: "scale-status",
    statuses: Object.freeze([TOW_STATUS_ID_TO_TYPE[statusId]]),
    target: targetOf(sourceTarget),
    percentByRank: rankTable(base, increment, rankCount, 100),
  });
}

function sourceCharger(effect, rankCount) {
  const [, factorType, base, increment, , , sourceTarget] = effect;
  if (factorType !== "None") throw new TypeError(`unknown-source-charger-factor:${factorType}`);
  return freezeEffect({
    type: "restore-skill-uses",
    target: targetOf(sourceTarget),
    countByRank: rankTable(base, increment, rankCount),
  });
}

function sameDamage(left, right) {
  return left?.type === "damage"
    && right?.type === "damage"
    && JSON.stringify({ ...left, hits: 1 }) === JSON.stringify({ ...right, hits: 1 });
}

function mergeSourceEffects(effects) {
  const merged = [];
  for (const effect of effects) {
    const previous = merged.at(-1);
    if (sameDamage(previous, effect)) {
      merged[merged.length - 1] = freezeEffect({ ...previous, hits: (previous.hits || 1) + 1 });
      continue;
    }
    if (
      previous?.type === "scale-status"
      && effect.type === "scale-status"
      && previous.target === effect.target
      && JSON.stringify(previous.percentByRank) === JSON.stringify(effect.percentByRank)
    ) {
      merged[merged.length - 1] = freezeEffect({
        ...previous,
        statuses: Object.freeze([...previous.statuses, ...effect.statuses]),
      });
      continue;
    }
    merged.push(effect);
  }
  return Object.freeze(merged);
}

function compileEffects(sourceId, sourceEffects, rankCount) {
  // Forbidden Ceremony grants 3333 Max HP for four turns and then deals the source status'
  // 9999 expiration damage. In this combat kernel that terminal pair is represented as one
  // scheduled, fatal temporary-Max-HP effect so it cannot silently leave the Max HP behind.
  if (sourceId === 1030820) {
    return Object.freeze([freezeEffect({
      type: "temporary-max-hp",
      target: "self",
      countByRank: Object.freeze([3333]),
      turns: 4,
      fatal: true,
      expirationDamage: 9999,
    })]);
  }

  const compiled = sourceEffects.map((effect) => {
    if (effect[0] === "Attack") return sourceDamage(effect, rankCount);
    if (effect[0] === "Heal") return sourceHeal(effect, rankCount);
    if (effect[0] === "StateEffect") return sourceState(effect, rankCount);
    if (effect[0] === "StateMultiplier") return sourceMultiplier(effect, rankCount);
    if (effect[0] === "SkillCharger") return sourceCharger(effect, rankCount);
    throw new TypeError(`unknown-source-effect:${effect[0]}`);
  });
  return mergeSourceEffects(compiled);
}

export function characterAbilityEffectMagnitude(effect, rank = 1) {
  const table = effect?.percentByRank || effect?.countByRank || effect?.factorByRank;
  if (!Array.isArray(table) || table.length === 0) return null;
  return table[Math.min(table.length - 1, Math.max(0, rank - 1))];
}

function factorLabel(effect) {
  if (effect.scale) return ({
    attack: "ATK",
    defense: "DEF",
    "max-hp": "MAX HP",
    "current-hp": "current HP",
  })[effect.scale] || effect.scale.replace(/-/g, " ").toUpperCase();
  if (effect.factorStatus) {
    const owner = effect.factorOwner === "enemy" ? "enemy " : "your ";
    return `${owner}${statusLabel(effect.factorStatus)} stacks`;
  }
  if (effect.factorScale) {
    const owner = effect.factorOwner === "enemy" ? "enemy " : "your ";
    return `${owner}${effect.factorScale.replace(/-/g, " ")}`;
  }
  return "source value";
}

export function describeCharacterAbilityEffect(effect, rank = 1) {
  const value = characterAbilityEffectMagnitude(effect, rank);
  const target = effect.target === "self" ? "yourself" : effect.target === "all" ? "all combatants" : "the enemy";
  if (effect.type === "damage") {
    const hits = effect.hits || 1;
    const unit = effect.factorByRank ? "×" : "%";
    return `Deal ${hits > 1 ? `${hits} hits of ` : ""}${value}${unit} ${factorLabel(effect)} damage`;
  }
  if (effect.type === "damage-enemy-lost-hp") return `Deal ${value}% of enemy lost health as damage`;
  if (effect.type === "damage-self-lost-hp") return `Deal ${value}% of your lost health as damage`;
  if (effect.type === "damage-enemy-max-hp") return `Deal ${value}% of enemy maximum health as damage`;
  if (effect.type === "shield") return `Gain Ward equal to ${value}% ${factorLabel(effect)}`;
  if (effect.type === "heal") return `Restore ${value}% ${factorLabel(effect)} health`;
  if (effect.type === "heal-flat") return `Restore ${value} health`;
  if (effect.type === "heal-lost-fraction") return `Restore ${value}% of lost health`;
  if (effect.type === "status") return `${effect.target === "self" ? "Gain" : "Inflict"} ${value} ${statusLabel(effect.status)}${effect.target === "all" ? " on all combatants" : ""}`;
  if (effect.type === "modify-status") return `Lose ${Math.abs(value)} ${statusLabel(effect.status)}`;
  if (effect.type === "scaled-status") return `${effect.target === "self" ? "Gain" : "Inflict"} ${statusLabel(effect.status)} equal to ${value}% ${factorLabel(effect)}`;
  if (effect.type === "status-from-status") return `${effect.target === "self" ? "Gain" : "Inflict"} ${statusLabel(effect.status)} equal to ${value}× ${factorLabel(effect)}`;
  if (effect.type === "scale-status") {
    const names = effect.statuses.map(statusLabel).join(", ");
    const verb = value === 0 ? "Remove" : value < 100 ? "Reduce" : "Amplify";
    return `${verb} ${names} on ${target}${value === 0 ? "" : ` to ${value}%`}`;
  }
  if (effect.type === "reduce-statuses") {
    const names = effect.statuses.map(statusLabel).join(", ");
    return effect.toPercent === 0
      ? `Remove ${effect.clearShield ? "Ward, " : ""}${names} from ${target}`
      : `Reduce ${names} on ${target} to ${effect.toPercent}%`;
  }
  if (effect.type === "amplify-statuses") {
    const names = effect.statuses.map(statusLabel).join(", ");
    return `Amplify ${names} on ${target} to ${value}%`;
  }
  if (effect.type === "consume-status") return `Spend ${value} ${statusLabel(effect.status)}`;
  if (effect.type === "scaled-status-enemy-lost-hp") {
    return `Inflict ${statusLabel(effect.status)} equal to ${value}% of enemy lost health`;
  }
  if (effect.type === "delayed-damage") {
    const turns = effect.turnsByRank?.[Math.min(effect.turnsByRank.length - 1, Math.max(0, rank - 1))]
      ?? effect.turns;
    return `Deal ${value} damage after ${turns} turns`;
  }
  if (effect.type === "temporary-max-hp") return `Gain ${value} maximum health for ${effect.turns} turns, then suffer ${effect.expirationDamage} damage`;
  if (effect.type === "restore-skill-uses") return `Restore ${value} uses to every other limited ability`;
  return effect.type.replace(/-/g, " ");
}

function compileAbility(row) {
  const [
    sourceId,
    id,
    characterId,
    name,
    sourceName,
    sourceGrade,
    abilityType,
    consumesTurn,
    sourceUses,
    usesIncrement,
    cooldown,
    sourceEffects,
  ] = row;
  const rankCount = RANKS_BY_SOURCE_GRADE[sourceGrade];
  const effects = compileEffects(sourceId, sourceEffects, rankCount);
  const usesPerAct = sourceUses === 0 ? null : sourceUses;
  const usesPerActByRank = sourceUses > 0 && usesIncrement !== 0
    ? rankTable(sourceUses, usesIncrement, rankCount)
    : null;
  const description = `${effects.map((effect) => describeCharacterAbilityEffect(effect)).join("; ")}.`;
  return Object.freeze({
    id,
    name: name.trim(),
    rarity: RARITY_BY_SOURCE_GRADE[sourceGrade],
    slot: "slotted",
    abilityType,
    effects,
    replaces: null,
    consumesTurn,
    cooldown,
    usesPerAct,
    usesPerActByRank,
    exclusiveTo: characterId,
    description,
    source: Object.freeze({
      page: TOW_CHARACTER_SOURCE_PAGE,
      releasePage: TOW_RELEASE_SOURCE_PAGE,
      build: TOW_SOURCE_BUILD,
      sourceId,
      characterId,
      sourceName,
      fidelity: "direct",
      detail: description,
    }),
    note: null,
    rankCount,
  });
}

const definitions = TOW_CHARACTER_ABILITY_SOURCE_ROWS.map(compileAbility);

export const CHARACTER_ABILITIES = Object.freeze(Object.fromEntries(
  definitions.map((definition) => [definition.id, definition]),
));

export function getCharacterAbility(id) {
  return typeof id === "string" && Object.hasOwn(CHARACTER_ABILITIES, id)
    ? CHARACTER_ABILITIES[id]
    : null;
}

export function characterAbilityIds() {
  return Object.keys(CHARACTER_ABILITIES);
}

export function characterAbilitiesFor(characterId) {
  return definitions.filter((definition) => definition.exclusiveTo === characterId);
}
