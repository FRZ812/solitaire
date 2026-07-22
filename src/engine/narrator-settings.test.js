import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { buildStateContext } from "./api.js";
import {
  NARRATOR_VERBOSITY_MODES,
  buildNarratorSteering,
  normalizeNarratorSettings,
} from "./narrator-settings.js";

describe("campaign narrator settings", () => {
  it("normalizes invalid settings and injects persistent creative direction", () => {
    expect(normalizeNarratorSettings({ memoryMode: "always", instructions: "  Be patient.  " }))
      .toEqual({ memoryMode: "balanced", verbosity: "concise", instructions: "Be patient." });

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

  it("defaults old and new campaigns to concise dialogue-forward adaptive pacing", () => {
    const steering = buildNarratorSteering({});
    expect(steering).toContain("[NARRATION PACING — CONCISE & DIALOGUE]");
    expect(steering).toContain("Routine beats stay compact");
    expect(steering).toContain("Let dialogue carry scenes");
    expect(steering).toContain("Expand selectively for important moments");
    expect(steering).toContain("return to concise pacing afterward");
  });

  it("offers increasing verbosity templates while keeping High-impact detail selective", () => {
    expect(NARRATOR_VERBOSITY_MODES.map((mode) => mode.id)).toEqual(["concise", "balanced", "expansive"]);
    expect(buildNarratorSteering({ verbosity: "balanced" })).toContain("[NARRATION PACING — BALANCED]");
    expect(buildNarratorSteering({ verbosity: "expansive" })).toContain("[NARRATION PACING — EXPANSIVE]");
    expect(buildNarratorSteering({ verbosity: "expansive" })).toContain("Do not inflate routine actions");
  });
});
