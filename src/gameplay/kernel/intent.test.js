import { describe, expect, it } from "vitest";
import { advanceIntent, createIntentState, isIntentState } from "./intent.js";

describe("deterministic authored enemy intents", () => {
  it("owns and replays a bounded embedded production intent pattern", () => {
    const pattern = {
      id: "single-hostile-production-v1",
      steps: [{
        id: "pressure",
        options: [{
          id: "hostile-strike",
          type: "attack",
          target: "player",
          damage: { min: 2, max: 4 },
        }],
      }],
    };

    const created = createIntentState({ seed: "production-run", pattern });

    expect(created).toMatchObject({
      ok: true,
      state: {
        version: 2,
        patternId: pattern.id,
        pattern,
        declarationIndex: 0,
        intent: { id: "hostile-strike", damage: 2 },
      },
    });
    expect(Object.isFrozen(created.state.pattern)).toBe(true);
    expect(Object.isFrozen(created.state.pattern.steps[0].options[0].damage)).toBe(true);

    pattern.steps[0].options[0].damage.min = 99;
    const serialized = JSON.parse(JSON.stringify(created.state));
    expect(isIntentState(serialized)).toBe(true);
    expect(advanceIntent(serialized)).toMatchObject({
      ok: true,
      state: {
        version: 2,
        patternId: "single-hostile-production-v1",
        declarationIndex: 1,
        intent: { id: "hostile-strike" },
      },
    });
  });

  it("declares a reproducible input-ready intent from seed and pattern", () => {
    const first = createIntentState({ seed: 1447, patternId: "gatekeeper-reference-v1" });
    const second = createIntentState({ seed: 1447, patternId: "gatekeeper-reference-v1" });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      state: {
        patternId: "gatekeeper-reference-v1",
        seed: 1447,
        declarationIndex: 0,
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
    expect(first).toMatchObject({ ok: true, state: { declarationIndex: 1, stepIndex: 1 } });
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

  it("rejects constructor input that exceeds the shared JSON resource budget", () => {
    expect(createIntentState({
      seed: "x".repeat(2_000_001),
      patternId: "gatekeeper-reference-v1",
    })).toEqual({ ok: false, reason: "invalid-intent-input", state: null });
  });

  it("returns a stable rejection when descriptor reflection itself fails", () => {
    let descriptorTraps = 0;
    const hostile = new Proxy({}, {
      getOwnPropertyDescriptor: () => {
        descriptorTraps += 1;
        throw new Error("hostile-descriptor");
      },
    });

    expect(createIntentState(hostile)).toEqual({
      ok: false,
      reason: "invalid-intent-input",
      state: null,
    });
    expect(descriptorTraps).toBe(1);
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

  it("rejects self-consistent-looking declarations that do not match seeded lineage", () => {
    const canonical = createIntentState({ seed: 1447, patternId: "gatekeeper-reference-v1" }).state;
    const forged = JSON.parse(JSON.stringify(canonical));
    forged.intent = {
      id: canonical.intent.id === "gatekeeper-strike"
        ? "gatekeeper-sweeping-strike"
        : "gatekeeper-strike",
      type: "attack",
      target: "player",
      damage: canonical.intent.id === "gatekeeper-strike" ? 6 : 8,
    };

    expect(isIntentState(forged)).toBe(false);
    expect(advanceIntent(forged)).toMatchObject({ ok: false, reason: "invalid-intent-state" });
  });
});
