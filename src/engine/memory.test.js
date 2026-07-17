import { describe, expect, it } from "vitest";
import { makeInitialState, migrateCodex } from "../data/initial-state.js";
import { applyBeat } from "./beat.js";
import { memoryFingerprint, mergeMemoryBank, normalizeMemoryBank } from "./memory.js";

describe("campaign memory bank", () => {
  it("normalizes whitespace, removes semantic duplicates, and keeps the newest bounded window", () => {
    const memories = mergeMemoryBank(
      ["  A promise was made.  ", "The bridge is watched"],
      ["a promise was made", "A new secret"],
      2,
    );

    expect(memories).toEqual(["The bridge is watched", "A new secret"]);
    expect(memoryFingerprint("A PROMISE was made! ")).toBe(memoryFingerprint("a promise was made"));
  });

  it("deduplicates parallel or retried remember tool results before saving", () => {
    const state = { ...makeInitialState(), created: true, memories: ["The bell is cracked."] };
    const next = applyBeat(state, {
      _memories: ["the bell is cracked", "The ferryman owes the player passage."],
    });

    expect(next.memories).toEqual([
      "The bell is cracked.",
      "The ferryman owes the player passage.",
    ]);
  });

  it("migrates old saves to normalized memory and narrator settings data", () => {
    const old = makeInitialState();
    old.memories = ["  one   fact ", "One fact."];
    delete old.narratorSettings;
    const migrated = migrateCodex(old);

    expect(migrated.memories).toEqual(["one fact"]);
    expect(migrated.narratorSettings).toEqual({ instructions: "", memoryMode: "balanced" });
    expect(normalizeMemoryBank(null)).toEqual([]);
  });
});
