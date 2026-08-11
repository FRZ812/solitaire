import { describe, expect, it } from "vitest";
import { createEncounter } from "./model.js";
import {
  advanceIntent,
  createIntentState,
  encounterIntentFromState,
  MAX_INTENT_DECLARATIONS,
} from "./intent.js";
import { createRng, nextInt } from "./rng.js";
import { resolveCommand } from "./resolve.js";
import { getReferenceIntentPattern } from "../reference/enemies.js";

function intentStateAtLimit(seed = "intent-limit") {
  const pattern = getReferenceIntentPattern("gatekeeper-reference-v1");
  let rng = createRng(seed);
  let intent = null;
  for (let index = 0; index <= MAX_INTENT_DECLARATIONS; index += 1) {
    const step = pattern.steps[index % pattern.steps.length];
    const optionDraw = nextInt(rng, 0, step.options.length - 1);
    const option = step.options[optionDraw.value];
    const damageDraw = nextInt(optionDraw.rng, option.damage.min, option.damage.max);
    rng = damageDraw.rng;
    intent = {
      id: option.id,
      type: option.type,
      target: option.target,
      damage: damageDraw.value,
    };
  }
  return {
    version: 1,
    patternId: pattern.id,
    seed,
    declarationIndex: MAX_INTENT_DECLARATIONS,
    stepIndex: MAX_INTENT_DECLARATIONS % pattern.steps.length,
    rng,
    intent,
  };
}

function scheduledEncounter(seed = "gatekeeper-run") {
  const intentState = createIntentState({
    seed: `${seed}:intent`,
    patternId: "gatekeeper-reference-v1",
  }).state;
  return createEncounter({
    seed: `${seed}:combat`,
    player: {
      id: "player",
      name: "Arctic Knight",
      hp: 24,
      maxHp: 24,
      stats: { attack: 4, defense: 2 },
      actions: ["basic-attack", "basic-defense"],
    },
    enemy: {
      id: "gatekeeper",
      name: "The Gatekeeper",
      hp: 60,
      maxHp: 60,
      stats: {},
      intentState,
      intent: encounterIntentFromState(intentState, "player"),
    },
  });
}

const defend = Object.freeze({
  type: "use-action",
  actorId: "player",
  actionId: "basic-defense",
  targetId: "player",
});

describe("authored intent scheduling in encounter resolution", () => {
  it("advances the persisted scheduler and declares its exact next intent", () => {
    const before = scheduledEncounter();
    const expected = advanceIntent(before.actors.gatekeeper.intentState).state;
    const result = resolveCommand(before, defend);

    expect(result.ok).toBe(true);
    expect(result.state.actors.gatekeeper.intentState).toEqual(expected);
    expect(result.state.actors.gatekeeper.intent).toEqual(
      encounterIntentFromState(expected, "player"),
    );
    expect(result.events.at(-1)).toMatchObject({
      type: "intent-declared",
      intent: encounterIntentFromState(expected, "player"),
    });
    expect(before.actors.gatekeeper.intentState.stepIndex).toBe(0);
  });

  it("keeps a scheduled encounter deterministic after JSON restoration", () => {
    const live = resolveCommand(scheduledEncounter(47), defend);
    const restored = resolveCommand(
      JSON.parse(JSON.stringify(scheduledEncounter(47))),
      JSON.parse(JSON.stringify(defend)),
    );

    expect(restored).toEqual(live);
  });

  it("rejects an exhausted declaration schedule before partially resolving a turn", () => {
    const before = scheduledEncounter();
    const intentState = intentStateAtLimit();
    before.actors.gatekeeper.intentState = intentState;
    before.actors.gatekeeper.intent = encounterIntentFromState(intentState, before.playerId);

    expect(advanceIntent(intentState)).toMatchObject({
      ok: false,
      reason: "intent-declaration-limit-exceeded",
    });
    expect(resolveCommand(before, defend)).toEqual({
      ok: false,
      reason: "intent-declaration-limit-exceeded",
      state: before,
      events: [],
    });
  });

  it("allows the final declaration to settle a terminal victory without inventing another intent", () => {
    const before = scheduledEncounter();
    const intentState = intentStateAtLimit();
    before.actors.gatekeeper.hp = 1;
    before.actors.gatekeeper.intentState = intentState;
    before.actors.gatekeeper.intent = encounterIntentFromState(intentState, before.playerId);

    const result = resolveCommand(before, {
      type: "use-action",
      actorId: "player",
      actionId: "basic-attack",
      targetId: "gatekeeper",
    });

    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe("victory");
    expect(result.state.actors.gatekeeper.intent).toBe(null);
    expect(result.events.at(-1)).toMatchObject({ type: "encounter-ended", outcome: "victory" });
    expect(before.actors.gatekeeper.hp).toBe(1);
  });
});
