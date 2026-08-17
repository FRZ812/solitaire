// Unit tests for the optimistic-concurrency guard in the campaigns adapter.
// Supabase is mocked with a chainable stub so we exercise the adapter's own
// state machine — baseline capture, gate application, STALE detection, baseline
// advancement, and per-id save serialization — without a network or database.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { emptyMechanicsSidecar } from "./campaign-migration.js";
import { ATTRIBUTE_SCALE_VERSION, PROGRESSION_VERSION } from "./progression.js";

// Shared mock state + a chainable PostgREST stub. Every builder method records
// its call and returns the chain; terminals (.maybeSingle/.single, or awaiting
// the chain directly) shift the next queued { data, error } response.
const h = vi.hoisted(() => {
  const state = { queue: [], recorded: [] };
  const next = () => Promise.resolve(state.queue.shift() ?? { data: null, error: null });
  const makeChain = () => {
    const chain = {};
    const rec = (op) => { state.recorded.push(op); return chain; };
    for (const m of ["update", "insert", "delete", "eq", "in", "order", "select"]) {
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

const {
  listCampaigns,
  loadCampaign,
  loadCampaignRecord,
  saveCampaign,
} = await import("./campaigns-supabase.js");
const { prepareCampaignState } = await import("../App.jsx");

const gatesFrom = (recorded) =>
  recorded.filter(([m, c]) => m === "eq" && c === "updated_at");

const writableState = (n) => ({
  n,
  mechanics: emptyMechanicsSidecar(),
  progressionVersion: PROGRESSION_VERSION,
  attributeScaleVersion: ATTRIBUTE_SCALE_VERSION,
});

describe("campaigns optimistic-concurrency guard", () => {
  beforeEach(() => {
    h.state.queue = [];
    h.state.recorded = [];
  });

  it("exposes the server timestamp for safe local-resume reconciliation", async () => {
    h.state.queue = [
      { data: { state: { n: 4 }, updated_at: "t4", schema_version: "v12" }, error: null },
    ];
    await expect(loadCampaignRecord("resume-record")).resolves.toEqual({
      state: { n: 4 },
      updatedAt: "t4",
    });
  });

  it("lists every readable schema during rollout instead of hiding v12 campaigns", async () => {
    h.state.queue = [{ data: [], error: null }];

    await listCampaigns();

    expect(h.state.recorded).toContainEqual(["in", "schema_version", ["v12", "v13"]]);
    expect(h.state.recorded).not.toContainEqual(["eq", "schema_version", "v13"]);
  });

  it("loads, prepares, and safely converges the live v12 Tower shape on its next save", async () => {
    const legacy = makeInitialState();
    legacy.progressionVersion = PROGRESSION_VERSION - 1;
    legacy.character.progressionModel = "tow-archetype";
    legacy.character.combatArchetypeId = "arctic-knight";
    legacy.character.towBaseStats = { hp: 186, resolve: 8 };
    legacy.character.level = 31;
    legacy.world.codex.characters.wanderer = {
      ...legacy.world.codex.characters.wanderer,
      progressionModel: "tow-archetype",
      combatArchetypeId: "arctic-knight",
      towBaseStats: { hp: 186, resolve: 8 },
      progression: legacy.character.progression,
      level: 31,
    };
    legacy.mechanics.bootstrapId = "0123456789abcdef";
    legacy.mechanics.build = { version: 1, marker: "keep-build" };
    legacy.mechanics.tow.activeCombat = null;
    legacy.mechanics.tow.readiness = { strike: 2 };
    legacy.mechanics.tow.companionReadiness = { ally: { block: 1 } };
    delete legacy.mechanics.tow.formation;
    h.state.queue = [
      { data: { state: legacy, updated_at: "t0", schema_version: "v12" }, error: null },
      { data: [{ updated_at: "t1" }], error: null },
    ];

    const loaded = await loadCampaignRecord("live-v12");
    const prepared = prepareCampaignState(loaded.state);
    await saveCampaign("live-v12", prepared);

    expect(prepared.mechanics).toMatchObject({
      bootstrapId: "0123456789abcdef",
      build: { version: 1, marker: "keep-build" },
      tow: {
        activeCombat: null,
        readiness: { strike: 2 },
        companionReadiness: { ally: { block: 1 } },
        formation: emptyMechanicsSidecar().tow.formation,
      },
    });
    expect(prepared.progressionVersion).toBe(PROGRESSION_VERSION);
    expect(prepared.character).not.toHaveProperty("progression");
    expect(prepared.character).not.toHaveProperty("level");
    expect(prepared.world.codex.characters.wanderer).not.toHaveProperty("progression");
    expect(gatesFrom(h.state.recorded)).toContainEqual(["eq", "updated_at", "t0"]);
    expect(h.state.recorded).toContainEqual([
      "update",
      expect.objectContaining({
        state: prepared,
        schema_version: "v13",
      }),
    ]);
  });

  it.each(["v99", null, undefined])(
    "fails closed when a directly opened campaign has unsupported schema %s",
    async (schemaVersion) => {
      h.state.queue = [{
        data: { state: { n: 4 }, updated_at: "t4", schema_version: schemaVersion },
        error: null,
      }];

      await expect(loadCampaignRecord("future-record")).rejects.toMatchObject({
        code: "UNSUPPORTED_CAMPAIGN_SCHEMA",
        schemaVersion: schemaVersion ?? null,
      });
    },
  );

  it("captures the load baseline and gates each save on the latest updated_at", async () => {
    h.state.queue = [
      { data: { state: { n: 1 }, updated_at: "t0", schema_version: "v12" }, error: null }, // loadCampaign
      { data: [{ updated_at: "t1" }], error: null },                // save #1
      { data: [{ updated_at: "t2" }], error: null },                // save #2
    ];
    await loadCampaign("c1");
    await saveCampaign("c1", writableState(2));
    await saveCampaign("c1", writableState(3));
    // Save #1 gates on the load baseline (t0); save #2 on save #1's result (t1).
    expect(gatesFrom(h.state.recorded)).toEqual([
      ["eq", "updated_at", "t0"],
      ["eq", "updated_at", "t1"],
    ]);
  });

  it("refuses to save when the row changed since load (STALE_CAMPAIGN)", async () => {
    h.state.queue = [
      { data: { state: {}, updated_at: "t0", schema_version: "v12" }, error: null }, // load → baseline t0
      { data: [], error: null },                              // update → 0 rows matched
      { data: { updated_at: "t9" }, error: null },            // probe → changed externally
    ];
    await loadCampaign("c1");
    await expect(saveCampaign("c1", writableState(2))).rejects.toMatchObject({
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
    await saveCampaign("cX", writableState(1));
    await saveCampaign("cX", writableState(2));
    // First save had no baseline → no updated_at gate at all; second gates on t5.
    expect(gatesFrom(h.state.recorded)).toEqual([["eq", "updated_at", "t5"]]);
  });

  it("serializes concurrent saves so the second gates on the first's new baseline", async () => {
    h.state.queue = [
      { data: { state: {}, updated_at: "t0", schema_version: "v12" }, error: null }, // load
      { data: [{ updated_at: "t1" }], error: null },          // save A
      { data: [{ updated_at: "t2" }], error: null },          // save B (must run after A)
    ];
    await loadCampaign("c1");
    await Promise.all([saveCampaign("c1", writableState(1)), saveCampaign("c1", writableState(2))]);
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
    const { id } = await saveCampaign(null, writableState(1), { name: "Hero" });
    expect(id).toBe("new1");
    await saveCampaign("new1", writableState(2));
    expect(gatesFrom(h.state.recorded)).toEqual([["eq", "updated_at", "t0"]]);
    expect(h.state.recorded).toContainEqual([
      "insert",
      expect.objectContaining({ schema_version: "v13" }),
    ]);
    expect(h.state.recorded).toContainEqual([
      "update",
      expect.objectContaining({ schema_version: "v13" }),
    ]);
  });

  it("refuses to stamp an unprepared payload with the current schema", async () => {
    await expect(saveCampaign(null, { n: 1 }, { name: "Unsafe" })).rejects.toMatchObject({
      code: "CAMPAIGN_MIGRATION_REQUIRED",
    });
    await expect(saveCampaign("existing", {
      ...writableState(2),
      progressionVersion: PROGRESSION_VERSION - 1,
    })).rejects.toMatchObject({ code: "CAMPAIGN_MIGRATION_REQUIRED" });

    const malformedTow = writableState(3);
    malformedTow.mechanics.tow = "broken";
    await expect(saveCampaign("broken-tow", malformedTow)).rejects.toMatchObject({
      code: "CAMPAIGN_MIGRATION_REQUIRED",
    });

    const futureFormation = writableState(4);
    futureFormation.mechanics.tow.formation = { version: 2, cells: Array(9).fill(null) };
    await expect(saveCampaign("future-formation", futureFormation)).rejects.toMatchObject({
      code: "CAMPAIGN_MIGRATION_REQUIRED",
    });
    expect(h.state.recorded).toEqual([]);
  });
});
