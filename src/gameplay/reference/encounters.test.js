import { describe, expect, it } from "vitest";
import { ARCTIC_KNIGHT_ACT_1, getReferenceAct } from "./encounters.js";

describe("Arctic Knight Act 1 topology", () => {
  it("defines positions 1/12 through 12/12 with exactly one final boss gate", () => {
    expect(ARCTIC_KNIGHT_ACT_1.steps).toHaveLength(12);
    expect(ARCTIC_KNIGHT_ACT_1.steps.map((step) => step.position)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(ARCTIC_KNIGHT_ACT_1.steps.filter((step) => step.bossGate)).toEqual([
      expect.objectContaining({ position: 12, kind: "boss", enemyId: "gatekeeper" }),
    ]);
    expect(ARCTIC_KNIGHT_ACT_1.steps.slice(0, 11).every(
      (step) => step.kind === "standard" && step.bossGate === false,
    )).toBe(true);
  });

  it("keeps unresolved standard-enemy content explicit and serializable", () => {
    expect(ARCTIC_KNIGHT_ACT_1.steps.slice(0, 11).every(
      (step) => step.enemyId === null && step.contentConfidence === "gap",
    )).toBe(true);
    expect(ARCTIC_KNIGHT_ACT_1.evidence.confidence).toBe("inferred");
    expect(JSON.parse(JSON.stringify(ARCTIC_KNIGHT_ACT_1))).toEqual(ARCTIC_KNIGHT_ACT_1);
  });

  it.each(["unknown", "toString", "constructor", "__proto__"])(
    "fails closed for unknown act ID %s",
    (actId) => expect(getReferenceAct(actId)).toBeNull(),
  );
});
