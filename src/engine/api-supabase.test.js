import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  extractJSON: vi.fn(),
}));

vi.mock("./supabase-client.js", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));
vi.mock("./api.js", () => ({ buildStateContext: () => "state context" }));
vi.mock("./json.js", () => ({ extractJSON: mocks.extractJSON }));
vi.mock("./narrator-models.js", () => ({
  getNarratorModel: () => "test/model",
  getNarratorEffort: () => "low",
}));
vi.mock("./narrative-sequence.js", () => ({ storyTextLength: () => 0 }));
vi.mock("./narrator-history.js", () => ({ prepareNarratorHistory: () => [] }));
vi.mock("./narrator-settings.js", () => ({ normalizeNarratorSettings: () => ({ memoryMode: "off" }) }));
vi.mock("./memory.js", () => ({ mergeMemoryBank: (_base, values = []) => values }));

import { callNarrator } from "./api-supabase.js";

describe("callNarrator lifecycle deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getSession.mockReset();
    mocks.extractJSON.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("times out even when authentication never settles", async () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));

    const pending = callNarrator({}, "travel", vi.fn(), { timeoutMs: 250 });
    const rejection = expect(pending).rejects.toThrow("Narrator request timed out. Please retry.");
    await vi.advanceTimersByTimeAsync(250);

    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("abandons stalled authentication when the travel lifecycle is cancelled", async () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    const lifecycle = new AbortController();
    const pending = callNarrator({}, "travel", vi.fn(), { signal: lifecycle.signal, timeoutMs: 5_000 });

    lifecycle.abort(new Error("travel cancelled"));

    await expect(pending).rejects.toThrow("travel cancelled");
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("does not swallow cancellation during a truncation retry", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
    mocks.extractJSON.mockReturnValue(null);
    const encoder = new TextEncoder();
    const firstBody = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}\n\n'));
        controller.close();
      },
    });
    let markSecondStarted;
    const secondStarted = new Promise((resolve) => { markSecondStarted = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, body: firstBody })
      .mockImplementationOnce((_url, { signal }) => {
        markSecondStarted();
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      });
    vi.stubGlobal("fetch", fetchMock);
    const lifecycle = new AbortController();
    const pending = callNarrator({}, "travel", vi.fn(), { signal: lifecycle.signal, timeoutMs: 5_000 });

    await secondStarted;
    lifecycle.abort(new Error("campaign changed"));

    await expect(pending).rejects.toThrow("campaign changed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
