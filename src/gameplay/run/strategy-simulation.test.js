import { describe, expect, it } from "vitest";
import { createRng, nextInt } from "../kernel/rng.js";
import { isEncounterState } from "../kernel/model.js";
import { resolveCommand } from "../kernel/resolve.js";
import { getReferenceSkill } from "../reference/skills.js";
import { createArcticKnightGatekeeperRun } from "./state.js";

const SEED_COUNT = 100;
const MAX_POLICY_COMMANDS = 100;

function command(run, type, id) {
  const playerId = run.playerId;
  const enemyId = run.enemyIds[0];
  const definition = type === "use-skill" ? getReferenceSkill(id) : null;
  return {
    type,
    actorId: playerId,
    ...(type === "use-action" ? { actionId: id } : { skillId: id }),
    targetId: definition?.target === "self" || id === "basic-defense" ? playerId : enemyId,
  };
}

function legalOptions(run) {
  const player = run.actors[run.playerId];
  return [
    ...player.actions.map((id) => command(run, "use-action", id)),
    ...player.skills
      .filter((skill) => skill.cooldownRemaining === 0 && skill.usesRemaining !== 0)
      .map((skill) => command(run, "use-skill", skill.id)),
  ];
}

function intentAwareCommand(run) {
  const player = run.actors[run.playerId];
  const enemy = run.actors[run.enemyIds[0]];
  const evasion = player.skills.find((skill) => skill.id === "emergency-evasion");
  if (
    enemy.intent.damage.max >= 4
    && evasion
    && evasion.cooldownRemaining === 0
    && evasion.usesRemaining !== 0
  ) {
    return command(run, "use-skill", evasion.id);
  }
  return command(run, "use-action", "basic-attack");
}

function simulate(seed, policy) {
  let encounter = createArcticKnightGatekeeperRun({
    runId: `strategy-${policy}-${seed}`,
    seed,
  }).encounter;
  let policyRng = createRng(`legal-policy:${seed}`);
  let commandCount = 0;

  while (encounter.phase === "player" && commandCount < MAX_POLICY_COMMANDS) {
    let selected;
    if (policy === "intent-aware") {
      selected = intentAwareCommand(encounter);
    } else {
      const options = legalOptions(encounter);
      const draw = nextInt(policyRng, 0, options.length - 1);
      policyRng = draw.rng;
      selected = options[draw.value];
    }
    const result = resolveCommand(encounter, selected);
    expect(result.ok).toBe(true);
    encounter = result.state;
    commandCount += 1;
  }

  expect(isEncounterState(encounter)).toBe(true);
  return { commandCount, phase: encounter.phase };
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

describe("Gatekeeper strategy calibration", () => {
  it("fuzzes 100 seeds and rewards intent-aware play with at least 20% fewer commands", () => {
    const seeds = Array.from({ length: SEED_COUNT }, (_, index) => index + 1);
    const aware = seeds.map((seed) => simulate(seed, "intent-aware"));
    const random = seeds.map((seed) => simulate(seed, "legal-random"));
    const awareMeanCommands = mean(aware.map((result) => result.commandCount));
    const randomMeanCommands = mean(random.map((result) => result.commandCount));

    expect(aware.every((result) => result.phase === "victory")).toBe(true);
    expect(random.every((result) => result.phase === "victory")).toBe(true);
    expect({ awareMeanCommands, randomMeanCommands }).toEqual({
      awareMeanCommands: 11.04,
      randomMeanCommands: 19.73,
    });
    expect(awareMeanCommands).toBeLessThanOrEqual(randomMeanCommands * 0.8);
  }, 60_000);
});
