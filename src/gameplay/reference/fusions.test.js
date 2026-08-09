import { describe, expect, it } from "vitest";
import { activeReferenceFusions } from "./fusions.js";

describe("reference fusion prerequisites", () => {
  it("ignores inherited trait levels when evaluating a fusion", () => {
    const inherited = Object.create({ ironclad: 1, "force-field": 1 });

    expect(activeReferenceFusions(inherited)).toEqual([]);
  });

  it("rejects coercible and non-finite trait levels without executing callbacks", () => {
    let coercions = 0;
    const coercible = { valueOf: () => { coercions += 1; return 1; } };

    expect(activeReferenceFusions({ ironclad: coercible, "force-field": 1 })).toEqual([]);
    expect(activeReferenceFusions({ ironclad: "1", "force-field": 1 })).toEqual([]);
    expect(activeReferenceFusions({ ironclad: Number.POSITIVE_INFINITY, "force-field": 1 })).toEqual([]);
    expect(coercions).toBe(0);
  });
});
