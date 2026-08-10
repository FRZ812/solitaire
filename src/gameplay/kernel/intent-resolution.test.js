import { describe, expect, it } from "vitest";
import { createEncounter } from "./model.js";
import {
  advanceIntent,
  createIntentState,
  encounterIntentFromState,
} from "./intent.js";
import { resolveCommand } from "./resolve.js";

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
});
