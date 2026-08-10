import { describe, expect, it } from "vitest";
import { advanceIntent, createIntentState } from "./intent.js";

describe("deterministic authored enemy intents", () => {
  it("declares a reproducible input-ready intent from seed and pattern", () => {
    const first = createIntentState({ seed: 1447, patternId: "gatekeeper-reference-v1" });
    const second = createIntentState({ seed: 1447, patternId: "gatekeeper-reference-v1" });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      state: {
        patternId: "gatekeeper-reference-v1",
        stepIndex: 0,
        intent: { type: "attack", target: "player" },
      },
    });
    expect(Number.isInteger(first.state.intent.damage)).toBe(true);
    expect(JSON.parse(JSON.stringify(first.state))).toEqual(first.state);
  });

  it("advances immutably and deterministically with no missing declared intent", () => {
    const initial = createIntentState({ seed: "gatekeeper-run", patternId: "gatekeeper-reference-v1" }).state;
    const snapshot = JSON.stringify(initial);

    const first = advanceIntent(initial);
    const second = advanceIntent(initial);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, state: { stepIndex: 1 } });
    expect(first.state.intent).toMatchObject({ type: "attack", target: "player" });
    expect(JSON.stringify(initial)).toBe(snapshot);
  });

  it.each(["missing", "toString", "constructor", "__proto__"])(
    "fails closed for unknown intent pattern %s",
    (patternId) => {
      expect(createIntentState({ seed: 1, patternId })).toEqual({
        ok: false,
        reason: "unknown-intent-pattern",
        state: null,
      });
    },
  );

  it("rejects nonprimitive seeds without executing coercion hooks", () => {
    let coercions = 0;
    const seed = { [Symbol.toPrimitive]: () => { coercions += 1; return "seed"; } };

    expect(createIntentState({ seed, patternId: "gatekeeper-reference-v1" })).toEqual({
      ok: false,
      reason: "invalid-intent-seed",
      state: null,
    });
    expect(coercions).toBe(0);
  });

  it("rejects missing or accessor-backed persisted intent state without executing getters", () => {
    const missing = JSON.parse(JSON.stringify(
      createIntentState({ seed: 1, patternId: "gatekeeper-reference-v1" }).state,
    ));
    delete missing.intent;
    expect(advanceIntent(missing)).toEqual({ ok: false, reason: "invalid-intent-state", state: missing });

    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "patternId", {
      enumerable: true,
      get: () => { getterCalls += 1; return "gatekeeper-reference-v1"; },
    });
    expect(advanceIntent(accessor)).toEqual({
      ok: false,
      reason: "invalid-intent-state",
      state: null,
    });
    expect(getterCalls).toBe(0);
  });
});
