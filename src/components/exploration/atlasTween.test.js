import { afterEach, describe, expect, it, vi } from "vitest";
import { createAtlasTween, easeAtlasTween } from "./atlasTween.js";

function manualScheduler(initialTime = 0) {
  let now = initialTime;
  let nextId = 1;
  const frames = new Map();

  return {
    now: () => now,
    request(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    cancel(id) {
      frames.delete(id);
    },
    step(milliseconds) {
      now += milliseconds;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(now));
    },
    get pending() {
      return frames.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("atlas tween", () => {
  it("advances on animation frames with eased and raw progress", () => {
    const scheduler = manualScheduler(100);
    const updates = [];
    const onFinish = vi.fn();
    const tween = createAtlasTween({
      duration: 100,
      scheduler,
      onUpdate: (value, progress) => updates.push([value, progress]),
      onFinish,
    });

    expect(updates).toEqual([[0, 0]]);
    expect(tween.running).toBe(true);
    scheduler.step(25);
    expect(updates.at(-1)).toEqual([0.0625, 0.25]);
    scheduler.step(25);
    expect(updates.at(-1)).toEqual([0.5, 0.5]);
    scheduler.step(50);

    expect(updates.at(-1)).toEqual([1, 1]);
    expect(tween.status).toBe("finished");
    expect(tween.progress).toBe(1);
    expect(scheduler.pending).toBe(0);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith({ reason: "completed", progress: 1, value: 1 });
  });

  it("cancels the queued frame without jumping to the end", () => {
    const scheduler = manualScheduler();
    const updates = [];
    const onFinish = vi.fn();
    const onCancel = vi.fn();
    const tween = createAtlasTween({
      duration: 200,
      easing: (progress) => progress,
      scheduler,
      onUpdate: (value) => updates.push(value),
      onFinish,
      onCancel,
    });

    scheduler.step(50);
    expect(tween.cancel()).toBe(true);
    expect(tween.cancel()).toBe(false);
    scheduler.step(200);

    expect(updates).toEqual([0, 0.25]);
    expect(tween.status).toBe("cancelled");
    expect(tween.progress).toBe(0.25);
    expect(scheduler.pending).toBe(0);
    expect(onFinish).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledWith({ reason: "cancelled", progress: 0.25, value: 0.25 });
  });

  it("finishes immediately from the current frame and only settles once", () => {
    const scheduler = manualScheduler();
    const updates = [];
    const onFinish = vi.fn();
    const tween = createAtlasTween({
      duration: 400,
      easing: (progress) => progress,
      scheduler,
      onUpdate: (value) => updates.push(value),
      onFinish,
    });

    scheduler.step(100);
    expect(tween.finish()).toBe(true);
    expect(tween.finish()).toBe(false);
    scheduler.step(400);

    expect(updates).toEqual([0, 0.25, 1]);
    expect(tween.status).toBe("finished");
    expect(scheduler.pending).toBe(0);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith({ reason: "finished", progress: 1, value: 1 });
  });

  it.each([
    { duration: 0, reducedMotion: false },
    { duration: -10, reducedMotion: false },
    { duration: 500, reducedMotion: true },
  ])("settles without scheduling for $duration ms with reducedMotion=$reducedMotion", ({ duration, reducedMotion }) => {
    const scheduler = manualScheduler();
    const onUpdate = vi.fn();
    const onFinish = vi.fn();
    const tween = createAtlasTween({ duration, reducedMotion, scheduler, onUpdate, onFinish });

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith(1, 1);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(tween.status).toBe("finished");
    expect(tween.finish()).toBe(false);
    expect(scheduler.pending).toBe(0);
  });

  it("uses requestAnimationFrame by default", () => {
    let frameCallback;
    const requestAnimationFrame = vi.fn((callback) => {
      frameCallback = callback;
      return 17;
    });
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const onFinish = vi.fn();

    const tween = createAtlasTween({ duration: 100, onFinish });
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    frameCallback(Number.MAX_SAFE_INTEGER);

    expect(tween.status).toBe("finished");
    expect(onFinish).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it("clamps easing inputs and outputs to a stable unit interval", () => {
    expect(easeAtlasTween(-1)).toBe(0);
    expect(easeAtlasTween(0.5)).toBe(0.5);
    expect(easeAtlasTween(2)).toBe(1);

    const scheduler = manualScheduler();
    const onUpdate = vi.fn();
    createAtlasTween({
      duration: 100,
      easing: () => 10,
      scheduler,
      onUpdate,
    });
    scheduler.step(50);
    expect(onUpdate).toHaveBeenLastCalledWith(1, 0.5);
  });
});
