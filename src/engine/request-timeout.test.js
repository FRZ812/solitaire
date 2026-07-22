import { afterEach, describe, expect, it, vi } from "vitest";
import { withAbortTimeout } from "./request-timeout.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("withAbortTimeout", () => {
  it("aborts a stalled task and reports a stable timeout error", async () => {
    vi.useFakeTimers();
    let observedSignal;
    const pending = withAbortTimeout(
      (signal) => {
        observedSignal = signal;
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
      250,
      "Narrator request timed out. Please retry.",
    );

    const rejection = expect(pending).rejects.toThrow("Narrator request timed out. Please retry.");
    await vi.advanceTimersByTimeAsync(250);

    await rejection;
    expect(observedSignal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts immediately when a parent lifecycle signal is cancelled", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    let observedSignal;
    const pending = withAbortTimeout(
      (signal) => {
        observedSignal = signal;
        return new Promise(() => {});
      },
      5_000,
      "late timeout",
      parent.signal,
    );

    parent.abort(new Error("travel cancelled"));

    await expect(pending).rejects.toThrow("travel cancelled");
    expect(observedSignal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an already-cancelled parent without starting the task", async () => {
    const parent = new AbortController();
    parent.abort(new Error("campaign changed"));
    const task = vi.fn();

    await expect(withAbortTimeout(task, 250, "late", parent.signal))
      .rejects.toThrow("campaign changed");
    expect(task).not.toHaveBeenCalled();
  });

  it("clears its timer when the task completes or fails first", async () => {
    vi.useFakeTimers();

    await expect(withAbortTimeout(() => Promise.resolve("done"), 250, "late")).resolves.toBe("done");
    await expect(withAbortTimeout(() => Promise.reject(new Error("upstream")), 250, "late"))
      .rejects.toThrow("upstream");
    expect(vi.getTimerCount()).toBe(0);
  });
});
