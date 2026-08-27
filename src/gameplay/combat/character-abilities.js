// Source-calibrated abilities for the complete Solitaire combat rules roster.
//
// Stable Solitaire ids remain unchanged so saves, authored VFX, and loadouts keep working.
// Every player-facing mechanic is compiled directly from the shipped 1.4.16 table rows
// in `character-ability-source-data.js`: 12 reusable archetypes x 23 abilities.

import {
  COMBAT_CHARACTER_ABILITY_SOURCE_ROWS,
  COMBAT_CHARACTER_SOURCE_PAGE,
  COMBAT_RELEASE_SOURCE_PAGE,
  COMBAT_SOURCE_BUILD,
  COMBAT_STATUS_SOURCE_ROWS,
} from "./character-ability-source-data.js";
import { canonicalCombatArchetypeId, sameCombatArchetype } from "./archetype-identities.js";
import { withFunctionalPromotions } from "./ability-progression.js";

export const CHARACTER_ABILITY_TYPES = Object.freeze([
  "basic-attack",
  "defensive",
  "archetype",
  "general",
]);

export const CHARACTER_ABILITY_TYPE_LABELS = Object.freeze({
  "basic-attack": "Basic attack",
  defensive: "Defensive",
  archetype: "Archetype ability",
  general: "General ability",
});

export const FIXED_CHARACTER_ABILITY_TYPES = Object.freeze(["basic-attack", "defensive"]);
export const FLEXIBLE_CHARACTER_ABILITY_TYPES = Object.freeze(["archetype", "general"]);

export const CHARACTER_ABILITY_ADAPTATION_TYPES = Object.freeze([
  "source-shape",
  "encounter-scale",
  "resolve-generation",
  "mythical-signature",
  "functional-promotions",
]);

// Only presentation is reflavoured. Stable ids, source effects, ranks, and legacy owner ids
// remain untouched so historical saves and deterministic replays keep their exact rules.
const GENERALIZED_ABILITY_NAMES = Object.freeze({
  "arctic-slaughter": "Bleeding Cut",
  "arctic-threatening-cry": "Challenge",
  "arctic-gather-strength": "Gather Strength",
  "arctic-battle-cry": "Rally",
  "arctic-giants-smash": "Colossus Blow",
  "arctic-thirst-for-blood": "Martial Vigor",
  "arctic-fist-of-justice": "Shield Verdict",
  "arctic-secret-blow": "Guardbreaker",
  "arctic-incineration": "Burning Reprisal",
  "arctic-ultimate-body": "Tempered Bulwark",
  "demon-apply-poison": "Envenom",
  "demon-snipe": "Snipe",
  "demon-ultimate-venom": "Virulent Toxin",
  "demon-overwhelm": "Field Rush",
  "demon-d-day": "Marked Quarry",
  "demon-shadow-stealth": "Camouflage",
  "demon-endless-grudge": "Barbed Arrows",
  "artificer-binding-shot": "Binding Shot",
  "artificer-cloaking-field": "Cloaking Field",
  "artificer-fusion-barrier": "Composite Barrier",
  "artificer-grappling-hook": "Grappling Hook",
  "artificer-ultra-barrier": "Reinforced Field",
  "artificer-grenade-toss": "Grenade",
  "artificer-tailored-drink": "Combat Tonic",
  "artificer-mysterious-stopwatch": "Phase Regulator",
  "artificer-time-machine": "Temporal Overdrive",
  "north-king-bears-blessing": "Battle Hardened",
  "north-king-boulder-toss": "Boulder Toss",
  "north-king-rampage": "Rampage",
  "north-king-natures-intervention": "Blood Truce",
  "north-king-beasts-heart": "Berserker's Heart",
  "sleepless-swing": "Arcane Lash",
  "sleepless-hard-scales": "Arcane Ward",
  "sleepless-steel-scales": "Hardened Ward",
  "sleepless-entangling-roots": "Binding Growth",
  "sleepless-mark-of-the-wild": "Elemental Attunement",
  "sleepless-water-totem": "Water Sigil",
  "sleepless-cool-composure": "Still Mind",
  "sleepless-tail-swipe": "Force Sweep",
  "sleepless-transference": "Elemental Transfer",
  "sleepless-predators-instinct": "Heightened Instinct",
  "sleepless-gale-totem": "Gale Sigil",
  "sleepless-fire-dragons-breath": "Dragonfire",
  "sleepless-hardening": "Elemental Bastion",
  "sleepless-high-speed-flight": "Arcane Flight",
  "assassin-boost-up": "Exploit Opening",
  "assassin-storm-of-knives": "Storm of Knives",
  "assassin-finishing-blow": "Finishing Strike",
  "assassin-perfect-opportunity": "Widen Opening",
  "assassin-execution": "Execution",
  "assassin-life-saving-pill": "Field Remedy",
  "witch-skull-throw": "Bone Cast",
  "witch-ghost-form": "Wraithform",
  "witch-touch-of-the-dead": "Grave Grasp",
  "witch-demons-sigil": "Pact Circle",
  "witch-battering-ram": "Bound Horror",
  "witch-proliferation": "Raise Host",
  "witch-void-monster": "Call Voidling",
  "witch-human-wave-tactics": "Sacrifice Host",
  "witch-gate-underworld": "Open the Gate",
  "witch-hellfire-spirit": "Bind Infernal",
  "witch-limited-life-sentence": "Pact Sentence",
  "mage-magic-arrow": "Arcane Missile",
  "mage-incinerate": "Ember Formula",
  "mage-blood-judgment": "Crimson Formula",
  "mage-invincible": "Absolute Ward",
  "mage-disintegrate": "Disintegrate",
  "mage-god-slaying-spear": "Grand Arcane Lance",
  "mage-regression": "Vital Reversion",
  "priestess-wrath-of-heaven": "Sacred Verdict",
  "priestess-divine-favor": "Oath's Blessing",
  "priestess-divine-barrier": "Sacred Aegis",
  "priestess-intercession": "Intercession",
  "priestess-immediate-judgment": "Immediate Judgment",
  "priestess-oracle": "Oath Ascendant",
  "priestess-doom": "Condemnation",
  "priestess-holy-binding": "Oathbinding",
  "priestess-power-of-god": "Oath Unbound",
  "priestess-immortality": "Lasting Oath",
  "blade-slash": "Measured Slash",
  "blade-inversion": "Sword Wave",
  "blade-quick-swordsmanship": "Quickdraw",
  "blade-double-slash": "Twin Arc",
  "blade-domain": "Blade Domain",
  "blade-katana-dance": "Blade Dance",
  "blade-mountain-of-blades": "Mountain of Blades",
  "blade-latent-power": "Mortal Commitment",
  "blade-selfless-state": "Empty Mind",
  "blade-instant-kill": "Severing Wing",
  "blade-breakthrough": "Crescent Break",
  "blade-one-flash": "Final Flash",
  "blade-flowing-water": "Still Water Counter",
  "vampire-claw": "Claw Strike",
  "vampire-bite": "Blood Bite",
  "vampire-bloodflow-absorption": "Sanguine Draw",
  "vampire-rain-of-death": "Crimson Rain",
  "vampire-ancestral-blood": "Elder Blood",
  "automaton-bombardment": "Bombardment",
  "automaton-repair": "Field Repair",
  "automaton-interception": "Intercepting Field",
  "automaton-flash": "Combat Flare",
  "automaton-scorched-earth": "Scorched Earth",
  "automaton-emergency-fuel": "Redline Fuel",
  "automaton-fate-manipulator": "Thermal Transfer",
  "automaton-infinite-power": "Reserve Cell",
});

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

export const COMBAT_STATUS_ID_TO_TYPE = Object.freeze(Object.fromEntries(
  COMBAT_STATUS_SOURCE_ROWS.map(([sourceId, englishName, koreanName]) => [
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
      factorStatus: COMBAT_STATUS_ID_TO_TYPE[factorStatusId],
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
  const status = COMBAT_STATUS_ID_TO_TYPE[statusId];

  // Source Shield is a transient absorb pool in the actor model, not a persistent status.
  if (statusId === 1020008) {
    return freezeEffect({
      type: "shield",
      target,
      scale: scaleOf(factorType),
      percentByRank: rankTable(base, increment, rankCount, 100),
    });
  }

  // Pact Sentence must land inside a normal encounter. Preserve the source's 666 execution
  // payload but compress its boss-scale thirteen-turn countdown to two combat rounds.
  if (statusId === 1020058) {
    return freezeEffect({
      type: "delayed-damage",
      target,
      countByRank: Object.freeze(Array(rankCount).fill(666)),
      turnsByRank: Object.freeze(Array(rankCount).fill(2)),
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
      factorStatus: COMBAT_STATUS_ID_TO_TYPE[factorStatusId],
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
    statuses: Object.freeze([COMBAT_STATUS_ID_TO_TYPE[statusId]]),
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

const RESOLVE_REGEN_FLOORS_BY_SOURCE_ID = Object.freeze({
  1030316: Object.freeze([2, 3]),
  1030914: Object.freeze([2, 3, 4, 5]),
  1031223: Object.freeze([4]),
});

const MYTHICAL_MAGNITUDES_BY_SOURCE_ID = Object.freeze({
  1030122: Object.freeze([300, 300, 1]),
  1030123: Object.freeze([150]),
  1030222: Object.freeze([4]),
  1030223: Object.freeze([30]),
  1030322: Object.freeze([100]),
  1030522: Object.freeze([400, 3]),
  1030523: Object.freeze([100, 0]),
  1030723: Object.freeze([100, 100]),
});

const PROMOTED_MYTHICAL_RIDERS_BY_SOURCE_ID = Object.freeze({
  1030619: freezeEffect({
    type: "status",
    status: "strength",
    target: "self",
    countByRank: Object.freeze([20, 30]),
  }),
});

function withMythicalSignature(sourceId, effects) {
  const magnitudes = MYTHICAL_MAGNITUDES_BY_SOURCE_ID[sourceId];
  if (!magnitudes) return effects;
  const rewritten = effects.map((effect, index) => {
    const key = ["percentByRank", "countByRank", "factorByRank"]
      .find((candidate) => Array.isArray(effect[candidate]));
    if (!key || magnitudes[index] === undefined) return effect;
    return freezeEffect({ ...effect, [key]: Object.freeze([magnitudes[index]]) });
  });
  if (sourceId === 1030222) {
    rewritten.push(freezeEffect({
      type: "status",
      status: "priority",
      target: "self",
      countByRank: Object.freeze([3]),
    }));
  }
  return rewritten;
}

function withPromotedMythicalRider(sourceId, effects) {
  const rider = PROMOTED_MYTHICAL_RIDERS_BY_SOURCE_ID[sourceId];
  return rider ? Object.freeze([...effects, rider]) : effects;
}

function compileEffects(sourceId, sourceEffects, rankCount) {
  // Forbidden Ritual is adapted to the actor's scale: Legendary grants 35% temporary max HP
  // and Mythical grants 50%, both as immediately usable health. The fatal source expiry stays
  // intact, represented by one scheduled effect so the temporary maximum cannot leak.
  if (sourceId === 1030820) {
    return Object.freeze([freezeEffect({
      type: "temporary-max-hp",
      target: "self",
      scale: "max-hp",
      percentByRank: Object.freeze([35, 50]),
      turns: 4,
      fatal: true,
      expirationDamage: 9999,
    })]);
  }

  let compiled = sourceEffects.map((effect) => {
    if (effect[0] === "Attack") return sourceDamage(effect, rankCount);
    if (effect[0] === "Heal") return sourceHeal(effect, rankCount);
    if (effect[0] === "StateEffect") return sourceState(effect, rankCount);
    if (effect[0] === "StateMultiplier") return sourceMultiplier(effect, rankCount);
    if (effect[0] === "SkillCharger") return sourceCharger(effect, rankCount);
    throw new TypeError(`unknown-source-effect:${effect[0]}`);
  });
  compiled = withMythicalSignature(sourceId, compiled);
  // The captured Interception row starts at zero and would spend an action for no outcome.
  // Its recorded 25-point promotion increment is the first useful Solitaire rank, so preserve
  // that progression without exposing an inert Common command.
  if (sourceId === 1031206) {
    return Object.freeze(compiled.map((effect) => freezeEffect({
      ...effect,
      countByRank: rankTable(25, 25, rankCount),
    })));
  }
  if (sourceId === 1031223) {
    compiled = compiled.map((effect) => (effect.type === "restore-skill-uses"
      ? freezeEffect({ ...effect, countByRank: Object.freeze([9]) })
      : effect));
  }
  const resolveRegenFloors = RESOLVE_REGEN_FLOORS_BY_SOURCE_ID[sourceId];
  if (resolveRegenFloors) {
    compiled = [
      ...compiled,
      freezeEffect({
        type: "resolve-regen",
        target: "self",
        countByRank: resolveRegenFloors,
      }),
    ];
  }
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

function decayProtectionClause(effect) {
  return effect.stackDownDelay > 0
    ? "; persists through its first turn end before normal decay"
    : "";
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
  if (effect.type === "status") return `${effect.target === "self" ? "Gain" : "Inflict"} ${value} ${statusLabel(effect.status)}${effect.target === "all" ? " on all combatants" : ""}${decayProtectionClause(effect)}`;
  if (effect.type === "modify-status") return `Lose ${Math.abs(value)} ${statusLabel(effect.status)}`;
  if (effect.type === "scaled-status") return `${effect.target === "self" ? "Gain" : "Inflict"} ${statusLabel(effect.status)} equal to ${value}% ${factorLabel(effect)}${decayProtectionClause(effect)}`;
  if (effect.type === "status-from-status") return `${effect.target === "self" ? "Gain" : "Inflict"} ${statusLabel(effect.status)} equal to ${value}× ${factorLabel(effect)}${decayProtectionClause(effect)}`;
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
    return `Inflict ${statusLabel(effect.status)} equal to ${value}% of enemy lost health${decayProtectionClause(effect)}`;
  }
  if (effect.type === "delayed-damage") {
    const turns = effect.turnsByRank?.[Math.min(effect.turnsByRank.length - 1, Math.max(0, rank - 1))]
      ?? effect.turns;
    return `Deal ${value} damage after ${turns} turns`;
  }
  if (effect.type === "temporary-max-hp") {
    const amount = effect.scale === "max-hp"
      ? `${value}% of maximum health`
      : `${value} maximum health`;
    return effect.fatal
      ? `Gain ${amount} for ${effect.turns} turns, then fall to 0 health when it expires`
      : `Gain ${amount} for ${effect.turns} turns, then suffer ${effect.expirationDamage} damage`;
  }
  if (effect.type === "restore-skill-uses") return `Restore ${value} Resolve`;
  if (effect.type === "resolve-regen") return `Raise Resolve recovery to ${value} per round`;
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
  const compiledEffects = compileEffects(sourceId, sourceEffects, rankCount);
  const effects = withPromotedMythicalRider(
    sourceId,
    withFunctionalPromotions(
      compiledEffects,
      rankCount,
      "mythical",
    ),
  );
  const usesPerAct = sourceUses === 0 ? null : sourceUses;
  const usesPerActByRank = sourceUses > 0 && usesIncrement !== 0
    ? rankTable(sourceUses, usesIncrement, rankCount)
    : null;
  const description = `${effects.map((effect) => describeCharacterAbilityEffect(effect)).join("; ")}.`;
  const archetypeId = canonicalCombatArchetypeId(characterId);
  const resourceAdaptation = RESOLVE_REGEN_FLOORS_BY_SOURCE_ID[sourceId];
  const mythicalAdaptation = MYTHICAL_MAGNITUDES_BY_SOURCE_ID[sourceId]
    || PROMOTED_MYTHICAL_RIDERS_BY_SOURCE_ID[sourceId];
  const timingOrScaleAdaptation = sourceId === 1030820 || sourceId === 1030823;
  const promotionAdaptation = JSON.stringify(effects) !== JSON.stringify(compiledEffects);
  const adaptations = Object.freeze([
    ...(sourceId === 1031206 ? ["source-shape"] : []),
    ...(timingOrScaleAdaptation ? ["encounter-scale"] : []),
    ...(resourceAdaptation ? ["resolve-generation"] : []),
    ...(mythicalAdaptation ? ["mythical-signature"] : []),
    ...(promotionAdaptation ? ["functional-promotions"] : []),
  ]);
  const sourceTranslation = sourceId === 1031206
    ? {
      fidelity: "adapted",
      detail: "The shipped zero-value source row is skipped so every offered Interception rank has a mechanical outcome; its captured +25 progression is preserved.",
    }
    : resourceAdaptation || mythicalAdaptation || timingOrScaleAdaptation || promotionAdaptation
      ? {
        fidelity: "adapted",
        detail: timingOrScaleAdaptation
          ? "The source identity is preserved with percentage health scaling or encounter-length timing suitable for Solitaire combat."
          : resourceAdaptation
          ? "The source effect is preserved and gains explicit Solitaire Resolve generation so the ability remains functional in the shared resource economy."
          : mythicalAdaptation
            ? "The source identity is preserved with a decisive Solitaire-scale Mythical magnitude."
            : "The source identity is preserved while stagnant promotion edges gain authoritative mechanical progression.",
      }
      : { fidelity: "direct", detail: description };
  return Object.freeze({
    id,
    name: GENERALIZED_ABILITY_NAMES[id] || name.trim(),
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
    archetypeId,
    description,
    source: Object.freeze({
      page: COMBAT_CHARACTER_SOURCE_PAGE,
      releasePage: COMBAT_RELEASE_SOURCE_PAGE,
      build: COMBAT_SOURCE_BUILD,
      sourceId,
      characterId,
      archetypeId,
      sourceName,
      ...sourceTranslation,
      adaptations,
    }),
    note: null,
    rankCount,
  });
}

const definitions = COMBAT_CHARACTER_ABILITY_SOURCE_ROWS.map(compileAbility);

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
  return definitions.filter((definition) => sameCombatArchetype(definition.exclusiveTo, characterId));
}
