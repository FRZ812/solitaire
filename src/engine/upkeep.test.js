import { describe, it, expect } from "vitest";
import { autoConsume, woundTick, companionUpkeep } from "./upkeep.js";

// Self-contained codex item defs so these tests don't depend on the live catalog.
const ITEMS = {
  ration: { id: "ration", name: "Trail Ration", kind: "food", use: { needs: { hunger: 40 } } },
  waterskin: { id: "waterskin", name: "Waterskin", kind: "drink", capacity: 3, use: { needs: { thirst: 30 } } },
};

describe("autoConsume", () => {
  it("eats from the pack when hunger dips below 55, clamped to 100", () => {
    const inv = { carried: [{ itemId: "ration", quantity: 2 }] };
    const r = autoConsume(inv, { hunger: 30, thirst: 80, sleep: 80 }, ITEMS);
    expect(r.needs.hunger).toBe(70); // 30 + 40
    expect(r.inventory.carried[0].quantity).toBe(1); // one ration consumed
    expect(r.lines.some((l) => /ate/.test(l))).toBe(true);
  });

  it("drinks from a vessel (decrementing its water) before eating drink items", () => {
    const inv = { carried: [{ itemId: "waterskin", quantity: 1, water: 3 }] };
    const r = autoConsume(inv, { hunger: 80, thirst: 30, sleep: 80 }, ITEMS);
    expect(r.needs.thirst).toBe(60); // 30 + 30
    expect(r.inventory.carried[0].water).toBe(2); // a draught drawn
    expect(r.inventory.carried[0].quantity).toBe(1); // vessel not consumed
  });

  it("does nothing when needs are above the auto thresholds", () => {
    const inv = { carried: [{ itemId: "ration", quantity: 1 }] };
    const r = autoConsume(inv, { hunger: 90, thirst: 90, sleep: 90 }, ITEMS);
    expect(r.needs).toEqual({ hunger: 90, thirst: 90, sleep: 90 });
    expect(r.lines).toEqual([]);
  });

  it("does not mutate the inventory passed in", () => {
    const inv = { carried: [{ itemId: "ration", quantity: 2 }] };
    autoConsume(inv, { hunger: 10, thirst: 80, sleep: 80 }, ITEMS);
    expect(inv.carried[0].quantity).toBe(2); // original untouched
  });
});

describe("woundTick", () => {
  it("saps vitality by the summed dotPerHour × hours, rounded", () => {
    // Bleeding 3/hr + Poisoned 2/hr = 5/hr; over 2 hours = 10.
    const r = woundTick(100, [{ name: "Bleeding" }, { name: "Poisoned" }], 120);
    expect(r.vitality).toBe(90);
    expect(r.lines).toHaveLength(1);
  });

  it("floors vitality at 0 and no-ops without time or DoT", () => {
    expect(woundTick(4, [{ name: "Bleeding" }], 600).vitality).toBe(0); // 3/hr × 10h = 30 dmg
    expect(woundTick(100, [{ name: "Bleeding" }], 0)).toEqual({ vitality: 100, lines: [] });
    expect(woundTick(100, [{ name: "Bruised" }], 120)).toEqual({ vitality: 100, lines: [] }); // no dotPerHour
  });
});

describe("companionUpkeep", () => {
  it("depletes each living companion's needs over time", () => {
    const party = ["bram"];
    const chars = { bram: { id: "bram", name: "Bram", needs: { hunger: 100, thirst: 100, sleep: 100 } } };
    const r = companionUpkeep(party, chars, { carried: [] }, 120, 1, {});
    expect(r.companions.bram.needs.hunger).toBeLessThan(100);
    expect(r.companions.bram.needs.thirst).toBeLessThan(100);
  });

  it("skips the dead and returns the (possibly unchanged) shared inventory", () => {
    const chars = { ghost: { id: "ghost", name: "Ghost", combatState: { status: "dead" }, needs: { hunger: 100, thirst: 100, sleep: 100 } } };
    const r = companionUpkeep(["ghost"], chars, { carried: [] }, 120, 1, {});
    expect(r.companions.ghost).toBeUndefined();
    expect(r.inventory).toEqual({ carried: [] });
  });
});
