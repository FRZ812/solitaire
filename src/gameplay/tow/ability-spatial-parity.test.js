import { describe, expect, it } from "vitest";
import { abilityTargeting, effectRecipient } from "./ability-targeting.js";
import { createTowEncounter, useSkill } from "./encounter.js";
import { createSkillState, getSkill, skillIds } from "./skills.js";
import { legalSkillAnchors, resolveSkillTargets } from "./targeting.js";

const PLAYER_ID = "player";
const ALLY_IDS = ["ally-n", "ally-w", "ally-e", "ally-s"];
const ENEMY_IDS = Array.from({ length: 9 }, (_, index) => `enemy-${index}`);

const EVENT_BY_EFFECT = Object.freeze({
  damage: "skill-damage",
  "delayed-damage": "skill-status",
  heal: "skill-heal",
  "heal-flat": "skill-heal",
  "heal-lost-fraction": "skill-heal",
  "modify-status": "skill-status-modified",
  "reduce-statuses": "skill-cleanse",
  "restore-skill-uses": "skill-resolve-restored",
  "scale-status": "skill-status-scaled",
  "scaled-status": "skill-status",
  "scaled-status-enemy-lost-hp": "skill-status",
  shield: "skill-shield",
  status: "skill-status",
  "status-from-status": "skill-status",
  "temporary-max-hp": "skill-max-hp",
});

function prerequisiteStatuses(definition) {
  const ids = new Set();
  for (const effect of definition.effects) {
    if (effect.factorStatus) ids.add(effect.factorStatus);
    for (const status of effect.statuses || []) ids.add(status);
    if (["modify-status", "reduce-statuses"].includes(effect.type) && effect.status) {
      ids.add(effect.status);
    }
  }
  return [...ids].map((type) => ({ type, count: 10 }));
}

function actor(id, name, statuses) {
  return {
    id,
    name,
    hp: 5_000,
    maxHp: 10_000,
    resolve: 50,
    resolveMax: 100,
    statuses,
    stats: { attack: 1_000, defense: 1_000, critRate: 0, dodgeRate: 0 },
  };
}

function encounterFor(definition) {
  const statuses = prerequisiteStatuses(definition);
  return createTowEncounter({
    seed: `spatial-oracle:${definition.id}`,
    player: actor(PLAYER_ID, "Player", statuses),
    allies: ALLY_IDS.map((id) => ({
      ...actor(id, id, statuses),
      build: { traits: {}, skills: ["strike"] },
    })),
    enemies: ENEMY_IDS.map((id) => ({
      ...actor(id, id, statuses),
      stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "wait", name: "Wait", hits: 1, damage: 0 }],
    })),
    build: { traits: {}, skills: [createSkillState(definition.id, 1)], runes: [] },
    formations: {
      version: 1,
      player: [null, "ally-n", null, "ally-w", PLAYER_ID, "ally-e", null, "ally-s", null],
      enemy: [...ENEMY_IDS],
    },
  });
}

function eventMatchesEffect(event, effect) {
  if (event.type !== EVENT_BY_EFFECT[effect.type]) return false;
  if ([
    "delayed-damage",
    "scaled-status",
    "scaled-status-enemy-lost-hp",
    "status",
    "status-from-status",
  ].includes(effect.type)) {
    return event.status === (effect.status || "limited-life-sentence");
  }
  if (effect.type === "modify-status") return event.status === effect.status;
  if (["reduce-statuses", "scale-status"].includes(effect.type)) {
    return effect.statuses.every((status) => event.statuses?.includes(status));
  }
  return true;
}

function eventSubject(event) {
  return event.targetId || event.actorId;
}

describe("catalogue-wide spatial ability parity", () => {
  it("applies every area ability to exactly the recipients in its resolved contract", () => {
    const failures = [];
    let checkedEffects = 0;

    for (const skillId of skillIds()) {
      const definition = getSkill(skillId);
      if (abilityTargeting(definition).footprint === "single") continue;
      const state = encounterFor(definition);
      const candidates = legalSkillAnchors(state, skillId, PLAYER_ID)
        .map((anchorCell) => resolveSkillTargets(state, definition, PLAYER_ID, { anchorCell }))
        .filter((result) => result.ok)
        .sort((left, right) => right.targetIds.length - left.targetIds.length);
      const resolved = candidates[0];
      if (!resolved) {
        failures.push(`${skillId}: no legal area anchor`);
        continue;
      }
      const used = useSkill(
        { ...state, turn: { ...state.turn, actionsRemaining: 2 } },
        skillId,
        resolved.primaryTargetId,
        PLAYER_ID,
        resolved.anchorCell,
      );
      if (!used.ok) {
        failures.push(`${skillId}: command rejected (${used.reason})`);
        continue;
      }
      const committed = used.state.events.find((event) => (
        event.type === "skill-committed" && event.skillId === skillId
      ));
      if (JSON.stringify(committed?.targetIds) !== JSON.stringify(resolved.targetIds)) {
        failures.push(`${skillId}: committed targetIds diverged from preview`);
      }

      definition.effects.forEach((effect, effectIndex) => {
        checkedEffects += 1;
        const recipient = effectRecipient(definition, effect, effectIndex);
        const expected = recipient === "anchor"
          ? resolved.targetIds
          : recipient === "caster"
            ? [PLAYER_ID]
            : [PLAYER_ID, ...ALLY_IDS, ...ENEMY_IDS];
        const actual = used.state.events
          .filter((event) => event.skillId === skillId && eventMatchesEffect(event, effect))
          .map(eventSubject);
        for (const actorId of expected) {
          if (!actual.includes(actorId)) {
            failures.push(`${skillId} effect[${effectIndex}] ${effect.type}: missing ${actorId}`);
          }
        }
      });
    }

    expect(checkedEffects).toBeGreaterThan(0);
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
