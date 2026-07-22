import { describe, expect, it, vi } from "vitest";
import { createTravelMarchWaiter } from "./travel-lifecycle.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function controlledTimer() {
  let callback = null;
  return {
    setTimer: vi.fn((next, delay) => { callback = next; return 17; }),
    clearTimer: vi.fn(),
    expire: () => callback?.(),
  };
}

describe("concurrent travel completion gates", () => {
  it("allows the visual gate to finish first while narration continues", async () => {
    const timer = controlledTimer();
    const visual = createTravelMarchWaiter(timer);
    const narrator = deferred();
    let allSettled = false;
    const both = Promise.all([narrator.promise, visual.promise]).then(() => { allSettled = true; });

    expect(timer.setTimer).toHaveBeenCalledWith(expect.any(Function), 7_000);
    visual.resolve("finished");
    await visual.promise;
    expect(allSettled).toBe(false);

    narrator.resolve("narrated");
    await both;
    expect(allSettled).toBe(true);
    expect(timer.clearTimer).toHaveBeenCalledWith(17);
  });

  it("keeps an already-running visual timeout after narration finishes first", async () => {
    const timer = controlledTimer();
    const visual = createTravelMarchWaiter(timer);
    const narrator = deferred();
    narrator.resolve("narrated");

    await narrator.promise;
    expect(timer.setTimer).toHaveBeenCalledWith(expect.any(Function), 7_000);
    expect(timer.clearTimer).not.toHaveBeenCalled();

    visual.resolve("finished");
    await expect(visual.promise).resolves.toBe("finished");
  });

  it("fails open when the renderer never reports completion", async () => {
    const timer = controlledTimer();
    const visual = createTravelMarchWaiter(timer);

    timer.expire();

    await expect(visual.promise).resolves.toBe("timeout");
    expect(timer.clearTimer).toHaveBeenCalledWith(17);
    expect(visual.resolve("late-finish")).toBe(false);
  });
});
