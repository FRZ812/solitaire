// Unit tests for the optimistic-concurrency guard in the campaigns adapter.
// Supabase is mocked with a chainable stub so we exercise the adapter's own
// state machine — baseline capture, gate application, STALE detection, baseline
// advancement, and per-id save serialization — without a network or database.
import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared mock state + a chainable PostgREST stub. Every builder method records
// its call and returns the chain; terminals (.maybeSingle/.single, or awaiting
// the chain directly) shift the next queued { data, error } response.
const h = vi.hoisted(() => {
  const state = { queue: [], recorded: [] };
  const next = () => Promise.resolve(state.queue.shift() ?? { data: null, error: null });
  const makeChain = () => {
    const chain = {};
    const rec = (op) => { state.recorded.push(op); return chain; };
    for (const m of ["update", "insert", "delete", "eq", "order", "select"]) {
      chain[m] = (...a) => rec([m, ...a]);
    }
    chain.maybeSingle = () => next();
    chain.single = () => next();
    chain.then = (res, rej) => next().then(res, rej); // make the chain awaitable
    return chain;
  };
  return { state, makeChain };
});

vi.mock("./supabase-client.js", () => ({
  supabase: {
    from: () => h.makeChain(),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "u1" } } } }) },
  },
}));

const { loadCampaign, loadCampaignRecord, saveCampaign } = await import("./campaigns-supabase.js");

const gatesFrom = (recorded) =>
  recorded.filter(([m, c]) => m === "eq" && c === "updated_at");

describe("campaigns optimistic-concurrency guard", () => {
  beforeEach(() => {
    h.state.queue = [];
    h.state.recorded = [];
  });

  it("exposes the server timestamp for safe local-resume reconciliation", async () => {
    h.state.queue = [
      { data: { state: { n: 4 }, updated_at: "t4" }, error: null },
    ];
    await expect(loadCampaignRecord("resume-record")).resolves.toEqual({
      state: { n: 4 },
      updatedAt: "t4",
    });
  });

  it("captures the load baseline and gates each save on the latest updated_at", async () => {
    h.state.queue = [
      { data: { state: { n: 1 }, updated_at: "t0" }, error: null }, // loadCampaign
      { data: [{ updated_at: "t1" }], error: null },                // save #1
      { data: [{ updated_at: "t2" }], error: null },                // save #2
    ];
    await loadCampaign("c1");
    await saveCampaign("c1", { n: 2 });
    await saveCampaign("c1", { n: 3 });
    // Save #1 gates on the load baseline (t0); save #2 on save #1's result (t1).
    expect(gatesFrom(h.state.recorded)).toEqual([
      ["eq", "updated_at", "t0"],
      ["eq", "updated_at", "t1"],
    ]);
  });

  it("refuses to save when the row changed since load (STALE_CAMPAIGN)", async () => {
    h.state.queue = [
      { data: { state: {}, updated_at: "t0" }, error: null }, // load → baseline t0
      { data: [], error: null },                              // update → 0 rows matched
      { data: { updated_at: "t9" }, error: null },            // probe → changed externally
    ];
    await loadCampaign("c1");
    await expect(saveCampaign("c1", { n: 2 })).rejects.toMatchObject({
      code: "STALE_CAMPAIGN",
      loadedUpdatedAt: "t0",
      serverUpdatedAt: "t9",
    });
  });

  it("falls back to an unguarded write when no baseline is held, then captures one", async () => {
    h.state.queue = [
      { data: [{ updated_at: "t5" }], error: null }, // update with no prior load
      { data: [{ updated_at: "t6" }], error: null }, // next update gates on t5
    ];
    await saveCampaign("cX", { n: 1 });
    await saveCampaign("cX", { n: 2 });
    // First save had no baseline → no updated_at gate at all; second gates on t5.
    expect(gatesFrom(h.state.recorded)).toEqual([["eq", "updated_at", "t5"]]);
  });

  it("serializes concurrent saves so the second gates on the first's new baseline", async () => {
    h.state.queue = [
      { data: { state: {}, updated_at: "t0" }, error: null }, // load
      { data: [{ updated_at: "t1" }], error: null },          // save A
      { data: [{ updated_at: "t2" }], error: null },          // save B (must run after A)
    ];
    await loadCampaign("c1");
    await Promise.all([saveCampaign("c1", { n: 1 }), saveCampaign("c1", { n: 2 })]);
    // Without serialization both would read t0; serialized, B sees A's t1.
    expect(gatesFrom(h.state.recorded)).toEqual([
      ["eq", "updated_at", "t0"],
      ["eq", "updated_at", "t1"],
    ]);
  });

  it("captures a baseline from insert so the first post-create save is guarded", async () => {
    h.state.queue = [
      { data: { id: "new1", updated_at: "t0" }, error: null }, // insert
      { data: [{ updated_at: "t1" }], error: null },           // first save gates on t0
    ];
    const { id } = await saveCampaign(null, { n: 1 }, { name: "Hero" });
    expect(id).toBe("new1");
    await saveCampaign("new1", { n: 2 });
    expect(gatesFrom(h.state.recorded)).toEqual([["eq", "updated_at", "t0"]]);
  });
});
