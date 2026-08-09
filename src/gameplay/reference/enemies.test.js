import { describe, expect, it } from "vitest";
import {
  GATEKEEPER,
  GATEKEEPER_INTENT_PATTERN,
  getReferenceEnemy,
  getReferenceIntentPattern,
} from "./enemies.js";

function containsFunction(value) {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsFunction);
}

describe("reference enemies", () => {
  it("defines the observed Gatekeeper identity and HP with field-level evidence", () => {
    expect(GATEKEEPER).toMatchObject({
      id: "gatekeeper",
      name: "The Gatekeeper",
      maxHp: 60,
      intentPatternId: GATEKEEPER_INTENT_PATTERN.id,
    });
    expect(GATEKEEPER.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fields: ["name", "maxHp"],
        confidence: "observed",
        sourceType: "first-party-screenshot",
      }),
      expect.objectContaining({
        fields: ["intentPatternId"],
        confidence: "inferred",
      }),
    ]));
  });

  it.each(["missing", "toString", "constructor", "__proto__"])(
    "fails closed for unknown enemy and pattern ID %s",
    (id) => {
      expect(getReferenceEnemy(id)).toBeNull();
      expect(getReferenceIntentPattern(id)).toBeNull();
    },
  );

  it("rejects non-string registry IDs without coercion", () => {
    let coercions = 0;
    const malicious = {
      [Symbol.toPrimitive]: () => { coercions += 1; return "gatekeeper"; },
    };

    expect(getReferenceEnemy(malicious)).toBeNull();
    expect(getReferenceIntentPattern(malicious)).toBeNull();
    expect(coercions).toBe(0);
  });

  it("keeps authored intent patterns serializable data without callbacks", () => {
    expect(GATEKEEPER_INTENT_PATTERN.steps.length).toBeGreaterThan(1);
    expect(containsFunction(GATEKEEPER_INTENT_PATTERN)).toBe(false);
    expect(JSON.parse(JSON.stringify(GATEKEEPER_INTENT_PATTERN))).toEqual(
      GATEKEEPER_INTENT_PATTERN,
    );
  });
});
