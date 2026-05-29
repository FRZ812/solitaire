import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyBeat } from "./beat.js";
import { makeInitialState } from "../data/initial-state.js";
import { ALL_ITEMS } from "../data/catalog.js";
import { maxVitalityFor } from "./attributes.js";

// A fresh, post-creation state so the full applyBeat pipeline runs (the limbo
// state freezes the clock and the body-ledger).
const fresh = () => ({ ...makeInitialState(), created: true });
const totalMinutes = (t) => t.day * 1440 + t.hour * 60 + t.minute;

// Curated views for the golden snapshots — drop volatile ids and the bulky
// codex so the snapshot is the behaviorally-relevant output only.
const beatView = (beats) => beats.map(({ id, ...rest }) => rest);
const charView = (c) => ({
  vitality: c.vitality, vitalityMax: c.vitalityMax, resolve: c.resolve, resolveMax: c.resolveMax,
  attributes: c.attributes, needs: c.needs, conditions: c.conditions, overburdened: c.overburdened,
  coins: c.inventory.coins, carried: c.inventory.carried,
});

describe("applyBeat — time & feed", () => {
  it("advances the clock by minutes_passed", () => {
    const base = fresh();
    const next = applyBeat(base, { minutes_passed: 90 });
    expect(totalMinutes(next.time) - totalMinutes(base.time)).toBe(90);
  });

  it("appends a narration beat carrying the content", () => {
    const next = applyBeat(fresh(), { narration: "The wind howls down the pass." });
    expect(next.beats.some((b) => b.type === "narration" && b.content === "The wind howls down the pass.")).toBe(true);
  });

  it("treats the input state as immutable", () => {
    const base = fresh();
    const beatsLen = base.beats.length;
    const vigor = base.character.attributes.vigor;
    applyBeat(base, { narration: "x", minutes_passed: 60, attribute_changes: { vigor: 2 } });
    expect(base.beats.length).toBe(beatsLen);
    expect(base.character.attributes.vigor).toBe(vigor);
  });
});

describe("applyBeat — attributes & vitals", () => {
  it("applies attribute_changes and keeps vitalityMax in sync", () => {
    const base = fresh();
    const next = applyBeat(base, { attribute_changes: { vigor: 2 } });
    expect(next.character.attributes.vigor).toBe(base.character.attributes.vigor + 2);
    expect(next.character.vitalityMax).toBe(maxVitalityFor(next.character));
  });

  it("clamps vitality_change into [0, vitalityMax]", () => {
    const base = fresh();
    expect(applyBeat(base, { vitality_change: 9999 }).character.vitality).toBe(base.character.vitalityMax);
    expect(applyBeat(base, { vitality_change: -9999 }).character.vitality).toBe(0);
  });
});

describe("applyBeat — inventory catalog gate", () => {
  it("drops invented (non-catalog) items but keeps catalog ones", () => {
    const validId = Object.keys(ALL_ITEMS)[0];
    const next = applyBeat(fresh(), {
      inventory_changes: { added: [
        { itemId: "totally-invented-xyz", quantity: 1 },
        { itemId: validId, quantity: 1 },
      ] },
    });
    const ids = next.character.inventory.carried.map((c) => c.itemId);
    expect(ids).not.toContain("totally-invented-xyz");
    expect(ids).toContain(validId);
  });
});

describe("applyBeat — needs depletion", () => {
  it("depletes needs as the clock turns (no food in the empty starting pack)", () => {
    const base = fresh();
    const next = applyBeat(base, { minutes_passed: 600 });
    expect(next.character.needs.hunger).toBeLessThan(base.character.needs.hunger);
  });
});

// GOLDEN characterization — full curated output of representative beats, captured
// as inline snapshots. These exist to make the Stage-3 applyBeat decomposition
// provably behavior-preserving: the snapshots must stay byte-identical across the
// refactor. Date.now is pinned so any id-bearing field is stable (ids are also
// stripped by beatView). Beats here avoid Math.random paths (no mount-name gen).
describe("applyBeat — golden snapshots (refactor safety net)", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(1_000_000));
  afterEach(() => vi.restoreAllMocks());

  it("golden — a rich survival/inventory/attribute/vitals beat", () => {
    const validId = Object.keys(ALL_ITEMS)[0];
    const next = applyBeat(fresh(), {
      minutes_passed: 60,
      narration: "You press on through the pass.",
      attribute_changes: { vigor: 1 },
      inventory_changes: { added: [{ itemId: validId, quantity: 2 }], coins: { silver: 3 } },
      vitality_change: 5,
      resolve_change: -2,
      needs_changes: { hunger: 10 },
    });
    expect({
      time: next.time, party: next.party, created: next.created,
      character: charView(next.character), beats: beatView(next.beats),
    }).toMatchSnapshot();
  });

  it("golden — recruiting a companion files them into the party + codex", () => {
    const next = applyBeat(fresh(), { recruit_companion: { id: "bram" } });
    const bram = next.world.codex.characters.bram;
    expect({
      party: next.party,
      bram: bram && { id: bram.id, name: bram.name, kind: bram.kind, hasAttributes: !!bram.attributes, hasAbilities: Array.isArray(bram.abilities) },
      recruitBeats: next.beats.filter((b) => b.type === "recruit").map((b) => b.text),
    }).toMatchSnapshot();
  });
});
