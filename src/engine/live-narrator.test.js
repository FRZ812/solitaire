import { describe, expect, it } from "vitest";
import { advanceLiveNarrator, emptyLiveNarrator } from "./live-narrator.js";

function stream(chunks) {
  return chunks.reduce((state, chunk) => advanceLiveNarrator(state, chunk), emptyLiveNarrator());
}

describe("live narrator progress", () => {
  it("projects chronologically interleaved story items from incomplete streamed JSON", () => {
    const wire = JSON.stringify({
      story: [
        { type: "beat", text: "Rain taps the glass." },
        { type: "dialogue", name: "Mira", line: "Do not turn around." },
        { type: "beat", text: "The latch lifts behind you." },
      ],
      minutes_passed: 1,
    });
    const chunks = wire.slice(0, -1).match(/[\s\S]{1,7}/g).map((text) => ({ text }));
    const progress = stream([{ thinking: "We need a quiet answer." }, ...chunks]);

    expect(progress.thinking).toBe("We need a quiet answer.");
    expect(progress.story).toEqual([
      { type: "beat", text: "Rain taps the glass." },
      { type: "dialogue", name: "Mira", line: "Do not turn around." },
      { type: "beat", text: "The latch lifts behind you." },
    ]);
  });

  it("replaces every visible channel when a retry starts", () => {
    let progress = stream([
      { thinking: "First take" },
      { text: '{"story":[{"type":"beat","text":"The first take' },
    ]);
    progress = advanceLiveNarrator(progress, { reset: true });
    progress = advanceLiveNarrator(progress, { thinking: "Second take" });
    progress = advanceLiveNarrator(progress, { text: '{"story":[{"type":"beat","text":"The final take' });

    expect(progress.raw).not.toContain("first");
    expect(progress.thinking).toBe("Second take");
    expect(progress.story).toEqual([{ type: "beat", text: "The final take" }]);
  });

  it("keeps the last valid preview across a temporarily broken chunk", () => {
    let progress = advanceLiveNarrator(emptyLiveNarrator(), { text: '{"story":[{"type":"beat","text":"Visible' });
    progress = advanceLiveNarrator(progress, { text: "\\" });
    expect(progress.story).toEqual([{ type: "beat", text: "Visible" }]);
  });
});
