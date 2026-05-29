import { describe, it, expect } from "vitest";
import { applyBeat } from "./beat.js";
import { makeInitialState } from "../data/initial-state.js";
import { ALL_ITEMS } from "../data/catalog.js";
import { maxVitalityFor } from "./attributes.js";

// A fresh, post-creation state so the full applyBeat pipeline runs (the limbo
// state freezes the clock and the body-ledger).
const fresh = () => ({ ...makeInitialState(), created: true });
const totalMinutes = (t) => t.day * 1440 + t.hour * 60 + t.minute;

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
