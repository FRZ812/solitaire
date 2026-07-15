import { describe, expect, it } from "vitest";
import { advanceLiveNarrator, emptyLiveNarrator } from "./live-narrator.js";

function stream(chunks) {
  return chunks.reduce((state, chunk) => advanceLiveNarrator(state, chunk), emptyLiveNarrator());
}

describe("live narrator progress", () => {
  it("projects narration and dialogue from incomplete streamed JSON", () => {
    const wire = JSON.stringify({
      narration: 'Rain taps the glass.\nA voice says "stay".',
      minutes_passed: 1,
      dialogues: [{ name: "Mira", line: "Do not turn around." }],
    });
    const chunks = wire.slice(0, -1).match(/[\s\S]{1,7}/g).map((text) => ({ text }));
    const progress = stream([{ thinking: "We need a quiet answer." }, ...chunks]);

    expect(progress.thinking).toBe("We need a quiet answer.");
    expect(progress.narration).toBe('Rain taps the glass.\nA voice says "stay".');
    expect(progress.dialogues).toEqual([{ name: "Mira", line: "Do not turn around." }]);
  });

  it("replaces every visible channel when a retry starts", () => {
    let progress = stream([
      { thinking: "First take" },
      { text: '{"narration":"The first take' },
    ]);
    progress = advanceLiveNarrator(progress, { reset: true });
    progress = advanceLiveNarrator(progress, { thinking: "Second take" });
    progress = advanceLiveNarrator(progress, { text: '{"narration":"The final take' });

    expect(progress.raw).not.toContain("first");
    expect(progress.thinking).toBe("Second take");
    expect(progress.narration).toBe("The final take");
    expect(progress.dialogues).toEqual([]);
  });

  it("keeps the last valid preview across a temporarily broken chunk", () => {
    let progress = advanceLiveNarrator(emptyLiveNarrator(), { text: '{"narration":"Visible' });
    progress = advanceLiveNarrator(progress, { text: "\\" });
    expect(progress.narration).toBe("Visible");
  });
});
