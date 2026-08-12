import { describe, expect, it } from "vitest";
import {
  INTENT_STATUS,
  MAX_ATTRIBUTE_DELTA,
  MAX_NARRATED_MINUTES,
  OWNER_MODE,
  PASS_THROUGH_REASONS,
  gatewayCoverage,
  refusalNotice,
  resolveNarratorIntents,
  unownedIntentFields,
} from "./command-gateway.js";
import { intentFields } from "./narrator-field-inventory.js";

function campaign(overrides = {}) {
  return {
    created: true,
    character: { vitality: 20, vitalityMax: 30, attributes: { body: 2 } },
    world: {
      codex: {
        characters: {
          hale: { id: "hale", name: "Hale", combatState: { status: "ok" } },
          corpse: { id: "corpse", name: "Corpse", combatState: { status: "dead" } },
        },
      },
    },
    ...overrides,
  };
}

function turnWith(fields = {}) {
  return { contract_version: 1, state_revision: 1, story: [], ...fields };
}

function receiptFor(result, field) {
  return result.receipts.find((entry) => entry.field === field);
}

describe("every mechanical field crosses the door", () => {
  it("issues a receipt for each one, present or not", () => {
    // Coverage is complete from the first commit: a path where half the fields are policed
    // and half are not is worse than either end, because nobody can tell which is which.
    const result = resolveNarratorIntents(campaign(), turnWith());
    expect(result.receipts).toHaveLength(intentFields().length);
    expect(result.receipts.every((entry) => entry.field && entry.id)).toBe(true);
  });

  it("marks an absent field absent rather than silently skipping it", () => {
    const result = resolveNarratorIntents(campaign(), turnWith());
    expect(receiptFor(result, "minutes_passed").status).toBe(INTENT_STATUS.ABSENT);
  });

  it("leaves a clean turn untouched", () => {
    const turn = turnWith({ minutes_passed: 30 });
    const result = resolveNarratorIntents(campaign(), turn);
    expect(result.refused).toBe(false);
    expect(result.turn).toBe(turn);
  });

  it("gives every field an owner of one kind or the other", () => {
    expect(unownedIntentFields()).toEqual([]);
  });
});

describe("time", () => {
  it("allows a beat-sized passage", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 240 }));
    expect(receiptFor(result, "minutes_passed").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses a beat that would skip past a day of hunger and danger", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ minutes_passed: MAX_NARRATED_MINUTES + 1 }),
    );
    expect(receiptFor(result, "minutes_passed"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "time-exceeds-one-beat" });
    // Stripped, so it never reaches the reducer — the refusal is a refusal.
    expect(result.turn.minutes_passed).toBe(null);
  });

  it("refuses a value that is not a whole number of minutes", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 1.5 })), "minutes_passed").reason)
      .toBe("time-not-an-integer");
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ minutes_passed: -5 })), "minutes_passed").reason)
      .toBe("time-not-an-integer");
  });
});

describe("health", () => {
  it("allows a wound and a survivable recovery", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ vitality_change: -5 })), "vitality_change").status)
      .toBe(INTENT_STATUS.APPLIED);
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ vitality_change: 8 })), "vitality_change").status)
      .toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses healing past the ceiling, so a beat is not a heal button", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ vitality_change: 50 }));
    expect(receiptFor(result, "vitality_change"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "vitality-above-maximum" });
    expect(result.turn.vitality_change).toBe(null);
  });

  it("refuses a loss larger than the whole pool", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ vitality_change: -400 })), "vitality_change").reason)
      .toBe("vitality-loss-exceeds-pool");
  });
});

describe("conditions", () => {
  it("allows an authored one", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ new_conditions: ["Bleeding"] }));
    expect(receiptFor(result, "new_conditions").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses one nobody wrote", () => {
    // Conditions are combat modifiers now. An invented name would block the next fight
    // outright, which is a strange way to discover the narrator made up a disease.
    const result = resolveNarratorIntents(
      campaign(), turnWith({ new_conditions: ["Bleeding", "Spectral Ennui"] }),
    );
    expect(receiptFor(result, "new_conditions"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "unauthored-condition" });
    expect(receiptFor(result, "new_conditions").unknown).toEqual(["Spectral Ennui"]);
    expect(result.turn.new_conditions).toBe(null);
  });

  it("reads a condition however the narrator shaped it", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ new_conditions: [{ name: "Poisoned" }] }),
    );
    expect(receiptFor(result, "new_conditions").status).toBe(INTENT_STATUS.APPLIED);
  });
});

describe("attributes", () => {
  it("allows a nudge", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ attribute_changes: { body: 1 } }));
    expect(receiptFor(result, "attribute_changes").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses a rewrite", () => {
    // Attributes feed every derived combat stat through the bridge; this is the most
    // load-bearing field in the contract.
    const result = resolveNarratorIntents(
      campaign(), turnWith({ attribute_changes: { body: MAX_ATTRIBUTE_DELTA + 3 } }),
    );
    expect(receiptFor(result, "attribute_changes"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "attribute-delta-too-large" });
  });
});

describe("death", () => {
  it("allows killing someone who is alive and real", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "hale", outcome: "killed" } }),
    );
    expect(receiptFor(result, "assassination").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses killing someone who does not exist", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "nobody", outcome: "killed" } }),
    );
    expect(receiptFor(result, "assassination"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "unknown-assassination-target" });
    expect(result.turn.assassination).toBe(null);
  });

  it("refuses killing someone already dead", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "corpse", outcome: "killed" } }),
    );
    expect(receiptFor(result, "assassination").reason).toBe("target-already-dead");
  });

  it("lets a survived attempt through", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "hale", outcome: "survived" } }),
    );
    expect(receiptFor(result, "assassination").status).toBe(INTENT_STATUS.APPLIED);
  });
});

describe("creation", () => {
  it("refuses a second start for a character who already exists", () => {
    const result = resolveNarratorIntents(
      campaign({ created: true }), turnWith({ character_setup: { name: "Someone Else" } }),
    );
    expect(receiptFor(result, "character_setup"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "character-already-created" });
  });

  it("allows the first one", () => {
    const result = resolveNarratorIntents(
      campaign({ created: false }), turnWith({ character_setup: { name: "Wanderer" } }),
    );
    expect(receiptFor(result, "character_setup").status).toBe(INTENT_STATUS.APPLIED);
  });
});

describe("what is not yet policed says so", () => {
  it("passes a field through and records it", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ relationship_changes: [{ id: "hale", delta: 5 }] }),
    );
    expect(receiptFor(result, "relationship_changes").status).toBe(INTENT_STATUS.PASSED_THROUGH);
    expect(result.turn.relationship_changes).toBeTruthy();
  });

  it("gives every pass-through a reason worth reading", () => {
    // Shrinking this list is the work; enumerating it is what makes the work reviewable.
    for (const [field, reason] of Object.entries(PASS_THROUGH_REASONS)) {
      expect(reason.length, field).toBeGreaterThan(40);
    }
  });

  it("reports coverage as a number rather than a feeling", () => {
    const coverage = gatewayCoverage();
    expect(coverage.total).toBe(intentFields().length);
    expect(coverage.enforced.length + coverage.passThrough.length).toBe(coverage.total);
    expect(coverage.fraction).toBeGreaterThan(0);
    // The fields most able to break the game are the ones enforced first.
    for (const field of [
      "minutes_passed", "vitality_change", "new_conditions", "attribute_changes",
      "assassination", "character_setup",
    ]) {
      expect(coverage.enforced, field).toContain(field);
    }
  });
});

describe("telling the player", () => {
  it("names what was trimmed", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ minutes_passed: 99_999, vitality_change: 400 }),
    );
    const notice = refusalNotice(result.refusals);
    expect(notice).toContain("minutes_passed");
    expect(notice).toContain("vitality_change");
  });

  it("says nothing when nothing was trimmed", () => {
    expect(refusalNotice([])).toBe(null);
    expect(refusalNotice(null)).toBe(null);
  });
});

describe("receipts", () => {
  it("are identified by their own content", () => {
    const first = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 30 }));
    const second = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 30 }));
    expect(receiptFor(second, "minutes_passed").id).toBe(receiptFor(first, "minutes_passed").id);
    const different = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 31 }));
    // Same field, same verdict, same revision — the id tracks the decision, not the value.
    expect(receiptFor(different, "minutes_passed").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("carry the revision they were decided against", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 30 }), {
      stateRevision: 42,
    });
    expect(receiptFor(result, "minutes_passed").stateRevision).toBe(42);
  });
});

describe("the owner modes are the whole design", () => {
  it("has exactly two", () => {
    expect(Object.values(OWNER_MODE).sort()).toEqual(["enforced", "pass-through"]);
  });
});
