import { describe, expect, it } from "vitest";
import { towArsenalAbilityRows } from "../../components/ArsenalView.jsx";
import { statusCount } from "../kernel/status-stack.js";
import { abilityTargeting } from "./ability-targeting.js";
import { compileCharacterBootstrap } from "./character-bootstrap.js";
import { createTowEncounter, isTowEncounter, useSkill } from "./encounter.js";
import {
  TOW_GENERAL_ABILITY_SOURCE_ROWS,
  TOW_GENERAL_SOURCE_CAPTURE,
} from "./general-ability-source-data.js";
import { createPracticeSession } from "./practice-scenarios.js";
import { verifyTowSession } from "./replay.js";
import {
  createSkillState,
  effectMagnitude,
  generalAbilityIds,
  getSkill,
  resolveCost,
  skillRankForRarity,
  skillRarityAtRank,
  skillRarityChoices,
  usesPerAct,
} from "./skills.js";
import { getStartingArchetype } from "./starting-archetypes.js";

const RARITIES = Object.freeze([
  "common", "uncommon", "rare", "epic", "legendary", "mythical",
]);

function expectedTiers(rarity) {
  return RARITIES.slice(RARITIES.indexOf(rarity));
}

function expectedEffect(effect) {
  const valueField = ["damage", "shield", "heal-lost-fraction", "scaled-status", "scaled-status-enemy-lost-hp"]
    .includes(effect.type) ? "percentByRank" : "countByRank";
  return Object.fromEntries(Object.entries({
    type: effect.type,
    target: effect.target,
    status: effect.status,
    statuses: effect.statuses ? [...effect.statuses] : undefined,
    scale: effect.scale,
    toPercent: effect.toPercent,
    ...(effect.values ? { [valueField]: [...effect.values] } : {}),
  }).filter(([, value]) => value !== undefined));
}

function compactEffect(effect, skillId, effectIndex, rank) {
  return Object.fromEntries(Object.entries({
    type: effect.type,
    target: effect.target,
    status: effect.status,
    statuses: effect.statuses ? [...effect.statuses] : undefined,
    scale: effect.scale,
    toPercent: effect.toPercent,
    value: effectMagnitude(skillId, effectIndex, rank),
  }).filter(([, value]) => value !== undefined));
}

function sourceEffectAtRank(effect, rank) {
  return Object.fromEntries(Object.entries({
    type: effect.type,
    target: effect.target,
    status: effect.status,
    statuses: effect.statuses ? [...effect.statuses] : undefined,
    scale: effect.scale,
    toPercent: effect.toPercent,
    value: effect.values?.[rank - 1] ?? null,
  }).filter(([, value]) => value !== undefined));
}

function practiceReceiptFor(skillId) {
  const archetype = getStartingArchetype("last-assassin");
  const skillIds = [...archetype.build.skills];
  skillIds[2] = skillId;
  const compiled = compileCharacterBootstrap({
    archetypeId: archetype.id,
    origin: "practice",
    build: { ...archetype.build, skills: skillIds },
  });
  if (!compiled.ok) throw new Error(`${skillId}:${compiled.reason}`);
  return { receipt: compiled.receipt, skillIds };
}

const RUNTIME_ACTOR_IDS = Object.freeze(["player", "ally", "enemy-a", "enemy-b"]);

function runtimeEncounter(skillId, rank) {
  const actor = (id, name, build = null) => ({
    id,
    name,
    hp: 500,
    maxHp: 1_000,
    resolve: 100,
    resolveMax: 100,
    stats: { attack: 100, defense: 100, critRate: 0, dodgeRate: 0 },
    statuses: id === "player" ? [
      { type: "bleed", count: 100 },
      { type: "burn", count: 100 },
      { type: "poison", count: 100 },
    ] : [],
    ...(build
      ? { build }
      : { attacks: [{ id: `${id}-wait`, name: "Wait", hits: 1, damage: 0 }] }),
  });
  return createTowEncounter({
    seed: `general-source:${skillId}:${rank}`,
    player: actor("player", "Player"),
    allies: [actor("ally", "Ally", { traits: {}, skills: ["strike"], runes: [] })],
    enemies: [actor("enemy-a", "Enemy A"), actor("enemy-b", "Enemy B")],
    build: { traits: {}, skills: [createSkillState(skillId, rank)], runes: [] },
    formations: {
      version: 1,
      player: ["player", "ally", null, null, null, null, null, null, null],
      enemy: ["enemy-a", "enemy-b", null, null, null, null, null, null, null],
    },
  });
}

function effectTargets(effect) {
  if (effect.target === "self") return ["player"];
  if (effect.target === "enemy") return ["enemy-a"];
  return [...RUNTIME_ACTOR_IDS];
}

function eventTypeFor(effect) {
  if (effect.type === "damage") return "skill-damage";
  if (effect.type === "shield") return "skill-shield";
  if (effect.type === "heal-lost-fraction") return "skill-heal";
  if (effect.type === "reduce-statuses") return "skill-cleanse";
  return "skill-status";
}

function scaledSourceValue(effect, value, before) {
  if (effect.type === "scaled-status-enemy-lost-hp") {
    return Math.round((before.maxHp - before.hp) * value / 100);
  }
  if (effect.type !== "scaled-status") return value;
  const basis = effect.scale === "attack"
    ? before.stats.attack
    : effect.scale === "defense"
      ? before.stats.defense
      : before.hp;
  const raw = Math.round(basis * value / 100);
  return ["doom", "misfortune"].includes(effect.status)
    ? Math.min(raw, Math.round(before.maxHp * 0.30))
    : raw;
}

describe("General ability source tier truth", () => {
  it("pins the reviewed 18-ability, 69-row source inventory", () => {
    expect(TOW_GENERAL_SOURCE_CAPTURE).toMatchObject({
      retrieved: "2026-08-26",
      rawRowsSha256: "8594d5cc52b2f78b08637ed339d6b97b70e4e6dc705923df61813fda30f9f168",
    });
    expect(TOW_GENERAL_ABILITY_SOURCE_ROWS).toHaveLength(18);
    expect(generalAbilityIds()).toEqual(TOW_GENERAL_ABILITY_SOURCE_ROWS.map((row) => row.id));
    expect(TOW_GENERAL_ABILITY_SOURCE_ROWS
      .reduce((total, row) => total + row.usesByRank.length, 0)).toBe(69);
  });

  it("makes every one of the 51 source promotion edges mechanically meaningful", () => {
    const inert = [];
    let edges = 0;
    for (const row of TOW_GENERAL_ABILITY_SOURCE_ROWS) {
      for (let index = 1; index < row.usesByRank.length; index += 1) {
        edges += 1;
        const before = JSON.stringify({
          effects: row.effects.map((effect) => effect.values?.[index - 1] ?? null),
          cost: row.resolveCostByRank[index - 1],
        });
        const after = JSON.stringify({
          effects: row.effects.map((effect) => effect.values?.[index] ?? null),
          cost: row.resolveCostByRank[index],
        });
        if (before === after) inert.push(`${row.id}:${index}->${index + 1}`);
      }
    }
    expect(edges).toBe(51);
    expect(inert).toEqual([]);
  });

  it("matches every source row in the compiled catalogue and Arsenal projection", () => {
    const failures = [];
    for (const row of TOW_GENERAL_ABILITY_SOURCE_ROWS) {
      const definition = getSkill(row.id);
      const tiers = expectedTiers(row.rarity);
      try {
        expect(definition).toMatchObject({
          id: row.id,
          rarity: row.rarity,
          abilityType: "general",
          exclusiveTo: null,
          consumesTurn: row.consumesTurn,
          cooldown: row.cooldown,
          rankCount: row.usesByRank.length,
          effects: row.effects.map(expectedEffect),
          source: {
            fidelity: "adapted",
            sourceLine: row.sourceLine,
            rawRowsSha256: TOW_GENERAL_SOURCE_CAPTURE.rawRowsSha256,
            adaptations: ["per-act-uses-to-resolve"],
          },
        });
        expect(skillRarityChoices(row.id)).toEqual(tiers);
        for (const [tierIndex, rarity] of tiers.entries()) {
          const rank = tierIndex + 1;
          expect(skillRankForRarity(row.id, rarity)).toBe(rank);
          expect(skillRarityAtRank(row.id, rank)).toBe(rarity);
          expect(usesPerAct(row.id, rank)).toBe(row.usesByRank[tierIndex]);
          expect(resolveCost(row.id, rank)).toBe(row.resolveCostByRank[tierIndex]);
          expect(definition.effects.map((effect, effectIndex) => (
            compactEffect(effect, row.id, effectIndex, rank)
          ))).toEqual(row.effects.map((effect) => sourceEffectAtRank(effect, rank)));
          expect(towArsenalAbilityRows([{ id: row.id, rank }])).toEqual([
            expect.objectContaining({
              definition,
              rank,
              rarity,
              resolveCost: row.resolveCostByRank[tierIndex],
              action: row.consumesTurn ? "main" : "swift",
              cooldown: row.cooldown,
            }),
          ]);
        }
      } catch (error) {
        failures.push(`${row.id}: ${error.message}`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("keeps source recipients single-targeted except Peace Declaration's all-combatant field", () => {
    const failures = [];
    for (const row of TOW_GENERAL_ABILITY_SOURCE_ROWS) {
      const targets = new Set(row.effects.map((effect) => effect.target));
      const expected = targets.has("all")
        ? { anchorSide: "self", footprint: "all" }
        : targets.has("enemy")
          ? { anchorSide: "enemy", footprint: "single" }
          : { anchorSide: "self", footprint: "single" };
      try {
        expect(abilityTargeting(getSkill(row.id))).toMatchObject(expected);
      } catch (error) {
        failures.push(`${row.id}: ${error.message}`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("applies every source tier to the exact actors and canonical state", () => {
    const failures = [];
    let cases = 0;
    for (const row of TOW_GENERAL_ABILITY_SOURCE_ROWS) {
      for (let rank = 1; rank <= row.usesByRank.length; rank += 1) {
        cases += 1;
        const before = runtimeEncounter(row.id, rank);
        const targetId = row.effects.some((effect) => effect.target === "enemy")
          ? "enemy-a"
          : "player";
        const result = useSkill(before, row.id, targetId);
        if (!result.ok) {
          failures.push(`${row.id}@${rank}: ${result.reason}`);
          continue;
        }
        try {
          const events = result.state.events.filter((event) => event.sequence > before.sequence);
          const committed = events.find((event) => event.type === "skill-committed");
          const expectedCommittedTargets = row.effects.some((effect) => effect.target === "all")
            ? [...RUNTIME_ACTOR_IDS]
            : [targetId];
          expect(committed?.targetIds).toEqual(expectedCommittedTargets);
          expect(result.state.actors.player.resolve).toBe(
            before.actors.player.resolve - row.resolveCostByRank[rank - 1],
          );
          expect(events).toContainEqual(expect.objectContaining({
            type: "resolve-spent",
            skillId: row.id,
            amount: row.resolveCostByRank[rank - 1],
          }));
          const expectedActions = row.id === "super-speed"
            ? before.turn.actionsRemaining + row.effects[0].values[rank - 1]
            : row.consumesTurn ? 0 : before.turn.actionsRemaining;
          expect(result.state.turn.actionsRemaining).toBe(expectedActions);
          expect(result.state.build.skills.find((state) => state.id === row.id)?.cooldownRemaining)
            .toBe(row.cooldown);

          for (const effect of row.effects) {
            const value = effect.values?.[rank - 1] ?? null;
            for (const subjectId of effectTargets(effect)) {
              const actorBefore = before.actors[subjectId];
              const actorAfter = result.state.actors[subjectId];
              const expectedValue = scaledSourceValue(effect, value, actorBefore);
              const matchingEvents = events.filter((event) => (
                event.type === eventTypeFor(effect)
                && event.targetId === subjectId
                && (!effect.status || event.status === effect.status)
              ));
              expect(matchingEvents).toHaveLength(1);
              if (effect.type === "damage") {
                const amount = Math.min(
                  Math.round(actorBefore.stats.attack * value / 100),
                  Math.round(actorBefore.maxHp * 0.45),
                );
                expect(actorBefore.hp - actorAfter.hp).toBe(amount);
              } else if (effect.type === "shield") {
                expect(actorAfter.shield - actorBefore.shield).toBe(expectedValue);
              } else if (effect.type === "heal-lost-fraction") {
                expect(actorAfter.hp - actorBefore.hp).toBe(
                  Math.round((actorBefore.maxHp - actorBefore.hp) * value / 100),
                );
              } else if (effect.type === "reduce-statuses") {
                for (const status of effect.statuses) {
                  expect(statusCount(actorAfter.statuses, status)).toBe(60);
                }
              } else {
                expect(statusCount(actorAfter.statuses, effect.status)).toBe(expectedValue);
                if (effect.status === "grow") {
                  expect(actorAfter.maxHp - actorBefore.maxHp).toBe(expectedValue);
                }
              }
            }
          }
        } catch (error) {
          failures.push(`${row.id}@${rank}: ${error.message}`);
        }
      }
    }
    expect(cases).toBe(69);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("routes all 69 source tiers into replay-valid production encounters at the exact rank", () => {
    const failures = [];
    let cases = 0;
    for (const row of TOW_GENERAL_ABILITY_SOURCE_ROWS) {
      const { receipt, skillIds } = practiceReceiptFor(row.id);
      const baseRarities = skillIds.map((id) => getSkill(id).rarity);
      for (const [tierIndex, rarity] of expectedTiers(row.rarity).entries()) {
        cases += 1;
        const skillRarities = [...baseRarities];
        skillRarities[2] = rarity;
        const practice = createPracticeSession(receipt, "training-yard", 0, { skillRarities });
        if (!practice.ok) {
          failures.push(`${row.id}@${rarity}: ${practice.reason}`);
          continue;
        }
        const state = practice.session.encounter.build.skills[2];
        if (state.id !== row.id || state.rank !== tierIndex + 1 || state.usesRemaining !== null) {
          failures.push(`${row.id}@${rarity}: wrong hydrated state ${JSON.stringify(state)}`);
          continue;
        }
        if (!isTowEncounter(practice.session.encounter)) {
          failures.push(`${row.id}@${rarity}: invalid encounter`);
          continue;
        }
        const replay = verifyTowSession(practice.session);
        if (!replay.ok) failures.push(`${row.id}@${rarity}: ${replay.reason}`);
      }
    }
    expect(cases).toBe(69);
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
