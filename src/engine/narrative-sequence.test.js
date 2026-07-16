import { describe, expect, it } from "vitest";
import { storyFromResponse, storyTextLength } from "./narrative-sequence.js";

describe("narrator story sequence", () => {
  it("preserves chronological beat/dialogue interleaving", () => {
    const response = {
      story: [
        { type: "beat", text: "The keeper uncoils the rope." },
        { type: "dialogue", name: "Keeper", line: "Two bedrolls." },
        { type: "beat", text: "He knots the bundle and sets it down." },
      ],
    };

    expect(storyFromResponse(response)).toEqual(response.story);
    expect(storyTextLength(response)).toBeGreaterThan(0);
  });

  it("keeps legacy narration followed by dialogues readable", () => {
    expect(storyFromResponse({
      narration: "The rain starts.",
      dialogues: [{ name: "Mira", line: "Inside. Now." }],
    })).toEqual([
      { type: "beat", text: "The rain starts." },
      { type: "dialogue", name: "Mira", line: "Inside. Now." },
    ]);
  });
});
