import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { buildStateContext } from "./api.js";
import { buildNarratorSteering, normalizeNarratorSettings } from "./narrator-settings.js";

describe("campaign narrator settings", () => {
  it("normalizes invalid settings and injects persistent creative direction", () => {
    expect(normalizeNarratorSettings({ memoryMode: "always", instructions: "  Be patient.  " }))
      .toEqual({ memoryMode: "balanced", instructions: "Be patient." });

    const state = makeInitialState();
    state.narratorSettings = {
      memoryMode: "essential",
      instructions: "Let companions challenge the player in dialogue.",
    };
    const context = buildStateContext(state);

    expect(context).toContain("[NARRATION STEERING");
    expect(context).toContain("Let companions challenge the player in dialogue.");
    expect(context).toContain("[MEMORY POLICY — ESSENTIAL ONLY");
  });

  it("makes manual memory mode explicit to the narrator", () => {
    expect(buildNarratorSteering({ memoryMode: "manual" })).toContain("Automatic long-term memory recording is disabled");
  });
});
