import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CHARACTER_ABILITY_ADAPTATION_TYPES,
  CHARACTER_ABILITIES,
  TOW_STATUS_ID_TO_TYPE,
  describeCharacterAbilityEffect,
  getCharacterAbility,
} from "./character-abilities.js";
import {
  TOW_CHARACTER_ABILITY_SOURCE_ROWS,
  TOW_STATUS_SOURCE_ROWS,
} from "./character-ability-source-data.js";

const RANKS_BY_GRADE = Object.freeze({
  Common: 6,
  Uncommon: 5,
  Rare: 4,
  Legendary: 2,
  Mythic: 1,
});
const RARITY_BY_GRADE = Object.freeze({
  Common: "common",
  Uncommon: "uncommon",
  Rare: "rare",
  Legendary: "legendary",
  Mythic: "mythical",
});
const TARGET = Object.freeze({ Ally: "self", Enemy: "enemy", All: "all" });
const SCALE = Object.freeze({
  Attack: "attack",
  Defense: "defense",
  MaxHp: "max-hp",
  Hp: "current-hp",
});
const FACTOR = Object.freeze({
  LostHp: ["self", "lost-hp"],
  TargetHp: ["enemy", "current-hp"],
  TargetLostHp: ["enemy", "lost-hp"],
  TargetMaxHp: ["enemy", "max-hp"],
});
const STATUS_ROW_BY_ID = new Map(TOW_STATUS_SOURCE_ROWS.map((row) => [row[0], row]));

function round(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function rankTable(base, increment, rankCount, multiplier = 1) {
  return Array.from({ length: rankCount }, (_, index) => (
    round((base + increment * index) * multiplier)
  ));
}

function sourceTarget(value) {
  if (!Object.hasOwn(TARGET, value)) throw new TypeError(`oracle-target:${value}`);
  return TARGET[value];
}

function statusType(sourceId) {
  const type = TOW_STATUS_ID_TO_TYPE[sourceId];
  if (!type) throw new TypeError(`oracle-status:${sourceId}`);
  return type;
}

function sourceAttack(raw, rankCount) {
  const [, factorType, base, increment, , factorStatusId, target] = raw;
  if (SCALE[factorType]) {
    return {
      type: "damage",
      target: sourceTarget(target),
      scale: SCALE[factorType],
      percentByRank: rankTable(base, increment, rankCount, 100),
    };
  }
  if (FACTOR[factorType]) {
    const [factorOwner, factorScale] = FACTOR[factorType];
    return {
      type: "damage",
      target: sourceTarget(target),
      factorOwner,
      factorScale,
      percentByRank: rankTable(base, increment, rankCount, 100),
    };
  }
  if (["StatusEffectStackCount", "TargetStatusEffectStackCount"].includes(factorType)) {
    return {
      type: "damage",
      target: sourceTarget(target),
      factorOwner: factorType === "StatusEffectStackCount" ? "self" : "enemy",
      factorStatus: statusType(factorStatusId),
      factorByRank: rankTable(base, increment, rankCount),
    };
  }
  throw new TypeError(`oracle-attack:${factorType}`);
}

function sourceHeal(raw, rankCount) {
  const [, factorType, base, increment, , , target] = raw;
  if (SCALE[factorType]) {
    return {
      type: "heal",
      target: sourceTarget(target),
      scale: SCALE[factorType],
      percentByRank: rankTable(base, increment, rankCount, 100),
    };
  }
  if (factorType === "LostHp") {
    return {
      type: "heal-lost-fraction",
      target: sourceTarget(target),
      percentByRank: rankTable(base, increment, rankCount, 100),
    };
  }
  if (factorType === "None") {
    return {
      type: "heal-flat",
      target: sourceTarget(target),
      countByRank: rankTable(base, increment, rankCount),
    };
  }
  throw new TypeError(`oracle-heal:${factorType}`);
}

function sourceState(raw, rankCount) {
  const [, factorType, base, increment, sourceStatusId, factorStatusId, target, stackDownDelay] = raw;
  const resolvedTarget = sourceTarget(target);
  const status = statusType(sourceStatusId);
  if (sourceStatusId === 1020008) {
    return {
      type: "shield",
      target: resolvedTarget,
      scale: SCALE[factorType] || null,
      percentByRank: rankTable(base, increment, rankCount, 100),
    };
  }
  if ([1020058, 1020060].includes(sourceStatusId)) {
    return {
      type: "delayed-damage",
      target: resolvedTarget,
      countByRank: Array(rankCount).fill(STATUS_ROW_BY_ID.get(sourceStatusId)[9].Value),
      turnsByRank: rankTable(base, increment, rankCount),
      status,
    };
  }
  if (SCALE[factorType]) {
    return {
      type: "scaled-status",
      status,
      target: resolvedTarget,
      scale: SCALE[factorType],
      percentByRank: rankTable(base, increment, rankCount, 100),
      stackDownDelay,
    };
  }
  if (factorType === "TargetHp") {
    return {
      type: "scaled-status",
      status,
      target: resolvedTarget,
      factorOwner: "enemy",
      factorScale: "current-hp",
      percentByRank: rankTable(base, increment, rankCount, 100),
      stackDownDelay,
    };
  }
  if (factorType === "None") {
    const values = rankTable(base, increment, rankCount);
    return {
      type: values.some((value) => value < 0) ? "modify-status" : "status",
      status,
      target: resolvedTarget,
      countByRank: values,
      stackDownDelay,
    };
  }
  if (["StatusEffectStackCount", "TargetStatusEffectStackCount"].includes(factorType)) {
    return {
      type: "status-from-status",
      status,
      target: resolvedTarget,
      factorOwner: factorType === "StatusEffectStackCount" ? "self" : "enemy",
      factorStatus: statusType(factorStatusId),
      factorByRank: rankTable(base, increment, rankCount),
      stackDownDelay,
    };
  }
  throw new TypeError(`oracle-state:${factorType}`);
}

function sourceMultiplier(raw, rankCount) {
  const [, factorType, base, increment, sourceStatusId, , target] = raw;
  if (factorType !== "None") throw new TypeError(`oracle-multiplier:${factorType}`);
  return {
    type: "scale-status",
    statuses: [statusType(sourceStatusId)],
    target: sourceTarget(target),
    percentByRank: rankTable(base, increment, rankCount, 100),
  };
}

function sourceCharger(raw, rankCount) {
  const [, factorType, base, increment, , , target] = raw;
  if (factorType !== "None") throw new TypeError(`oracle-charger:${factorType}`);
  return {
    type: "restore-skill-uses",
    target: sourceTarget(target),
    countByRank: rankTable(base, increment, rankCount),
  };
}

function sameDamage(left, right) {
  return left?.type === "damage"
    && right?.type === "damage"
    && JSON.stringify({ ...left, hits: 1 }) === JSON.stringify({ ...right, hits: 1 });
}

function mergeRepeatedSourceEffects(effects) {
  const merged = [];
  for (const effect of effects) {
    const previous = merged.at(-1);
    if (sameDamage(previous, effect)) {
      merged[merged.length - 1] = { ...previous, hits: (previous.hits || 1) + 1 };
      continue;
    }
    if (
      previous?.type === "scale-status"
      && effect.type === "scale-status"
      && previous.target === effect.target
      && JSON.stringify(previous.percentByRank) === JSON.stringify(effect.percentByRank)
    ) {
      merged[merged.length - 1] = {
        ...previous,
        statuses: [...previous.statuses, ...effect.statuses],
      };
      continue;
    }
    merged.push(effect);
  }
  return merged;
}

function expectedEffects(sourceId, rawEffects, rankCount) {
  if (sourceId === 1030820) {
    const immortality = STATUS_ROW_BY_ID.get(1020059);
    const ceremony = STATUS_ROW_BY_ID.get(1020060);
    const duration = rawEffects.find((effect) => effect[4] === 1020059)?.[2];
    return [{
      type: "temporary-max-hp",
      target: "self",
      countByRank: [immortality[9].Value],
      turns: duration,
      fatal: true,
      expirationDamage: ceremony[9].Value,
    }];
  }
  const compiled = rawEffects.map((effect) => {
    if (effect[0] === "Attack") return sourceAttack(effect, rankCount);
    if (effect[0] === "Heal") return sourceHeal(effect, rankCount);
    if (effect[0] === "StateEffect") return sourceState(effect, rankCount);
    if (effect[0] === "StateMultiplier") return sourceMultiplier(effect, rankCount);
    if (effect[0] === "SkillCharger") return sourceCharger(effect, rankCount);
    throw new TypeError(`oracle-effect:${effect[0]}`);
  });
  if (sourceId === 1031206) {
    return compiled.map((effect) => ({
      ...effect,
      countByRank: rankTable(25, 25, rankCount),
    }));
  }
  return mergeRepeatedSourceEffects(compiled);
}

function expectedDefinition(row) {
  const [
    sourceId, id, characterId, , , grade, abilityType, consumesTurn,
    sourceUses, usesIncrement, cooldown, rawEffects,
  ] = row;
  const rankCount = RANKS_BY_GRADE[grade];
  return {
    id,
    rarity: RARITY_BY_GRADE[grade],
    abilityType,
    effects: expectedEffects(sourceId, rawEffects, rankCount),
    consumesTurn,
    cooldown,
    usesPerAct: sourceUses === 0 ? null : sourceUses,
    usesPerActByRank: sourceUses > 0 && usesIncrement !== 0
      ? rankTable(sourceUses, usesIncrement, rankCount)
      : null,
    exclusiveTo: characterId,
    rankCount,
  };
}

const MAGNITUDE_KEYS = Object.freeze(["percentByRank", "countByRank", "factorByRank"]);
const EXPLICIT_ADAPTATION_SOURCE_IDS = Object.freeze({
  "source-shape": Object.freeze([1031206]),
  "encounter-scale": Object.freeze([1030820, 1030823]),
  "resolve-generation": Object.freeze([1030316, 1030914, 1031223]),
  "mythical-signature": Object.freeze([
    1030122, 1030123, 1030222, 1030223, 1030322, 1030522, 1030523, 1030619, 1030723,
  ]),
});

function effectShape(effect) {
  const shape = { ...effect };
  for (const key of MAGNITUDE_KEYS) delete shape[key];
  return shape;
}

function magnitudeTable(effect) {
  const key = MAGNITUDE_KEYS.find((candidate) => Array.isArray(effect[candidate]));
  return key ? { key, values: effect[key] } : null;
}

describe("shipped character ability source contract", () => {
  it("pins the exact generated source tables used for this proof", () => {
    expect(TOW_CHARACTER_ABILITY_SOURCE_ROWS).toHaveLength(276);
    expect(TOW_STATUS_SOURCE_ROWS).toHaveLength(65);
    expect(createHash("sha256").update(JSON.stringify(TOW_CHARACTER_ABILITY_SOURCE_ROWS)).digest("hex"))
      .toBe("6c0a239da29b3ece187dbac28b90c28f31e10465558876de5649724f8a9836d1");
    expect(createHash("sha256").update(JSON.stringify(TOW_STATUS_SOURCE_ROWS)).digest("hex"))
      .toBe("58b72aa06c464d0e27865913d8d319d37e1eba575ab450a26408f77d45e0bbf7");
  });

  it("keeps direct rows exact and proves each adapted row against its declared boundary", () => {
    const failures = [];
    let ranks = 0;
    let effects = 0;
    let effectRanks = 0;
    for (const row of TOW_CHARACTER_ABILITY_SOURCE_ROWS) {
      const expected = expectedDefinition(row);
      const actual = getCharacterAbility(expected.id);
      ranks += expected.rankCount;
      effects += expected.effects.length;
      effectRanks += expected.effects.length * expected.rankCount;
      try {
        const { effects: expectedEffects, ...expectedMetadata } = expected;
        expect(actual).toMatchObject(expectedMetadata);
        expect(actual.description).toBe(
          `${actual.effects.map((effect) => describeCharacterAbilityEffect(effect)).join("; ")}.`,
        );
        expect(actual.source).toMatchObject({
          sourceId: row[0],
          characterId: row[2],
          fidelity: actual.source.adaptations.length > 0 ? "adapted" : "direct",
          adaptations: expect.any(Array),
        });
        expect(actual.source.adaptations.every((id) => (
          CHARACTER_ABILITY_ADAPTATION_TYPES.includes(id)
        ))).toBe(true);

        if (actual.source.adaptations.length === 0) {
          expect(actual.effects).toEqual(expectedEffects);
        } else if (actual.source.adaptations.every((id) => id === "functional-promotions")) {
          expect(actual.effects.map(effectShape)).toEqual(expectedEffects.map(effectShape));
          expect(actual.effects).toHaveLength(expectedEffects.length);
          for (const [index, sourceEffect] of expectedEffects.entries()) {
            const sourceTable = magnitudeTable(sourceEffect);
            const actualTable = magnitudeTable(actual.effects[index]);
            expect(actualTable?.key).toBe(sourceTable?.key);
            if (sourceTable) {
              expect(actualTable.values).toHaveLength(expected.rankCount);
              const fullRemovalProgression = sourceEffect.type === "scale-status"
                && sourceTable.values.every((value) => value === 0);
              if (fullRemovalProgression) {
                expect(actualTable.values.at(-1)).toBe(0);
                expect(actualTable.values.every((value, at, values) => (
                  at === 0 || value <= values[at - 1]
                ))).toBe(true);
              } else {
                expect(actualTable.values[0]).toBe(sourceTable.values[0]);
              }
            }
          }
        }
      } catch (error) {
        failures.push(`${expected.id}: ${error.message}`);
      }
    }
    expect({ rows: TOW_CHARACTER_ABILITY_SOURCE_ROWS.length, ranks, effects, effectRanks })
      .toEqual({ rows: 276, ranks: 1068, effects: 408, effectRanks: 1586 });
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("pins the complete machine-readable adaptation manifest", () => {
    for (const [adaptation, sourceIds] of Object.entries(EXPLICIT_ADAPTATION_SOURCE_IDS)) {
      expect(Object.values(CHARACTER_ABILITIES)
        .filter((ability) => ability.source.adaptations.includes(adaptation))
        .map((ability) => ability.source.sourceId)
        .sort((left, right) => left - right))
        .toEqual([...sourceIds].sort((left, right) => left - right));
    }
    const manifest = Object.values(CHARACTER_ABILITIES)
      .filter((ability) => ability.source.adaptations.length > 0)
      .map((ability) => ({ id: ability.id, adaptations: ability.source.adaptations }));
    expect(manifest).toHaveLength(139);
    expect(createHash("sha256").update(JSON.stringify(manifest)).digest("hex"))
      .toBe("6a9736ba6d2b7cdb403af9a68f8be335e47ac20b7acc3c7588d7b47441928382");
  });

  it("resolves every source status id and every factor-status id to a runtime type", () => {
    const referenced = new Set(TOW_CHARACTER_ABILITY_SOURCE_ROWS.flatMap((row) => (
      row[11].flatMap((effect) => [effect[4], effect[5]]).filter((id) => id !== 0)
    )));
    expect([...referenced].filter((sourceId) => !TOW_STATUS_ID_TO_TYPE[sourceId])).toEqual([]);
    expect(new Set(Object.values(TOW_STATUS_ID_TO_TYPE)).size).toBe(TOW_STATUS_SOURCE_ROWS.length);
  });
});
