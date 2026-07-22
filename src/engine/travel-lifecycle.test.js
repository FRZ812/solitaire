import { describe, expect, it, vi } from "vitest";
import {
  createTravelMarchWaiter,
  isTravelLifecycleTokenCurrent,
  settleTravelLifecycle,
  travelHaltBeat,
} from "./travel-lifecycle.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
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
  it("rejects superseded and aborted lifecycle tokens", () => {
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = { generation: 1, campaignId: "campaign", controller: firstController };
    const second = { generation: 2, campaignId: "campaign", controller: secondController };

    expect(isTravelLifecycleTokenCurrent(first, 2, "campaign")).toBe(false);
    expect(isTravelLifecycleTokenCurrent(second, 2, "campaign")).toBe(true);
    secondController.abort();
    expect(isTravelLifecycleTokenCurrent(second, 2, "campaign")).toBe(false);
  });

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

describe("travel settlement ordering", () => {
  it("builds an explicit halt beat from the deterministic route encounter", () => {
    expect(travelHaltBeat({
      toName: "Briar Ford",
      encounter: {
        kind: "bog-hounds",
        posture: "hostile",
        desc: "A mud-caked pack closes around the road.",
      },
    }, "halt-7")).toEqual({
      id: "halt-7",
      type: "travel_halt",
      location: "Briar Ford",
      encounterKind: "bog hounds",
      posture: "hostile",
      description: "A mud-caked pack closes around the road.",
    });
    expect(travelHaltBeat({ toName: "Briar Ford" }, "unused")).toBeNull();
  });

  it("publishes arrival as soon as the visual route ends while narration continues", async () => {
    const visual = deferred();
    const narrator = deferred();
    const order = [];
    const settlement = settleTravelLifecycle({
      visual: visual.promise,
      narration: narrator.promise,
      onArrival: () => order.push("arrival"),
      onNarration: () => order.push("narration"),
    });

    visual.resolve("finished");
    await visual.promise;
    await Promise.resolve();
    expect(order).toEqual(["arrival"]);

    narrator.resolve({ narrative: "The road settles behind you." });
    await settlement;
    expect(order).toEqual(["arrival", "narration"]);
  });

  it("holds early narration until visual arrival and settles mechanics first", async () => {
    const visual = deferred();
    const narrator = deferred();
    const order = [];
    const settlement = settleTravelLifecycle({
      visual: visual.promise,
      narration: narrator.promise,
      onArrival: () => order.push("arrival"),
      onNarration: () => order.push("narration"),
    });

    narrator.resolve({ narrative: "Already narrated." });
    await narrator.promise;
    await Promise.resolve();
    expect(order).toEqual([]);

    visual.resolve("finished");
    await settlement;
    expect(order).toEqual(["arrival", "narration"]);
  });

  it("keeps arrival committed when narration fails", async () => {
    const visual = deferred();
    const narrator = deferred();
    const order = [];
    const settlement = settleTravelLifecycle({
      visual: visual.promise,
      narration: narrator.promise,
      onArrival: () => order.push("arrival"),
      onNarrationError: (error) => order.push(error.message),
    });

    visual.resolve("finished");
    await visual.promise;
    await Promise.resolve();
    expect(order).toEqual(["arrival"]);

    narrator.reject(new Error("narrator offline"));
    await settlement;
    expect(order).toEqual(["arrival", "narrator offline"]);
  });
});
