import { describe, expect, it } from "vitest";
import { createRng } from "../kernel/rng.js";
import {
  INTENT_CONTROL_POLICY,
  MAX_INTENT_SCHEDULE_STEPS,
  advanceTowIntent,
  declareTowIntent,
  defaultIntentSchedule,
  describeTowIntent,
  intentSchedulesSnapshot,
  isIntentSchedule,
  isTowIntent,
  resolveDeclaredAttack,
} from "./intent.js";

const TABLE = [
  { id: "jab", name: "Jab", hits: 1, damage: 4 },
  { id: "swing", name: "Swing", hits: 1, damage: 9 },
  { id: "heavy", name: "Heavy blow", hits: 1, damage: 15 },
  { id: "flurry", name: "Flurry", hits: 2, damage: 3 },
];

describe("the default rotation", () => {
  it("covers every attack a foe actually has", () => {
    const schedule = defaultIntentSchedule("foe-0", TABLE);
    expect(isIntentSchedule(schedule)).toBe(true);
    expect(schedule.steps).toHaveLength(TABLE.length);
    const named = new Set(schedule.steps.flatMap((step) => step.attackIds));
    expect([...named].sort()).toEqual(TABLE.map((attack) => attack.id).sort());
  });

  it("offers a choice each step, so the rotation cannot be memorised into a script", () => {
    // The player never has to guess what is coming *this* round — that is always declared.
    // What they cannot do is skip reading it because they learned the pattern.
    const schedule = defaultIntentSchedule("foe-0", TABLE);
    expect(schedule.steps.every((step) => step.attackIds.length === 2)).toBe(true);
  });

  it("degenerates honestly for a foe with one attack", () => {
    const schedule = defaultIntentSchedule("foe-0", [TABLE[0]]);
    expect(schedule.steps).toHaveLength(1);
    expect(schedule.steps[0].attackIds).toEqual(["jab"]);
  });

  it("has nothing to say for a foe with no attack table", () => {
    expect(defaultIntentSchedule("foe-0", [])).toBe(null);
    expect(defaultIntentSchedule("foe-0", null)).toBe(null);
  });

  it("stays inside the step budget for an absurd attack table", () => {
    const huge = Array.from({ length: 500 }, (_, index) => ({
      id: `a-${index}`, name: `A${index}`, hits: 1, damage: 1,
    }));
    const schedule = defaultIntentSchedule("foe-0", huge);
    expect(schedule.steps.length).toBe(MAX_INTENT_SCHEDULE_STEPS);
    expect(isIntentSchedule(schedule)).toBe(true);
  });
});

describe("declaring", () => {
  it("names an attack from the step it is on and advances the stream", () => {
    const schedule = defaultIntentSchedule("foe-0", TABLE);
    const rng = createRng("intent-seed");
    const declared = declareTowIntent({ schedule, declarationIndex: 0, targetId: "p", rng });
    expect(isTowIntent(declared.intent)).toBe(true);
    expect(declared.intent.stepIndex).toBe(0);
    expect(schedule.steps[0].attackIds).toContain(declared.intent.attackId);
    expect(declared.rng).not.toEqual(rng);
  });

  it("walks the rotation and wraps", () => {
    const schedule = defaultIntentSchedule("foe-0", TABLE);
    let rng = createRng("intent-seed");
    let intent = declareTowIntent({ schedule, declarationIndex: 0, targetId: "p", rng }).intent;
    const steps = [intent.stepIndex];
    for (let round = 0; round < TABLE.length; round += 1) {
      const advanced = advanceTowIntent({ schedule, intent, targetId: "p", rng });
      rng = advanced.rng;
      intent = advanced.intent;
      steps.push(intent.stepIndex);
    }
    expect(steps).toEqual([0, 1, 2, 3, 0]);
  });

  it("is reproducible from the same stream", () => {
    const schedule = defaultIntentSchedule("foe-0", TABLE);
    const once = declareTowIntent({ schedule, declarationIndex: 2, targetId: "p", rng: createRng("s") });
    const twice = declareTowIntent({ schedule, declarationIndex: 2, targetId: "p", rng: createRng("s") });
    expect(once.intent).toEqual(twice.intent);
    expect(once.rng).toEqual(twice.rng);
  });
});

describe("honouring a declaration", () => {
  it("resolves it back to the foe's own attack", () => {
    const intent = declareTowIntent({
      schedule: defaultIntentSchedule("foe-0", TABLE),
      declarationIndex: 0,
      targetId: "p",
      rng: createRng("s"),
    }).intent;
    const attack = resolveDeclaredAttack(intent, TABLE);
    expect(attack.id).toBe(intent.attackId);
  });

  it("refuses to invent one the foe cannot do", () => {
    // A telegraph the engine does not honour is worse than no telegraph — the player has
    // been taught to trust it. Returning null makes the reducer refuse rather than swing
    // something of its own choosing.
    const forged = {
      version: 1,
      patternId: "foe-0-rotation",
      declarationIndex: 0,
      stepIndex: 0,
      attackId: "meteor",
      targetId: "p",
    };
    expect(resolveDeclaredAttack(forged, TABLE)).toBe(null);
    expect(describeTowIntent(forged, TABLE)).toBe(null);
  });

  it("describes what is coming without exposing a roll that has not happened", () => {
    const intent = { ...declareTowIntent({
      schedule: defaultIntentSchedule("foe-0", TABLE),
      declarationIndex: 0,
      targetId: "p",
      rng: createRng("s"),
    }).intent, attackId: "flurry" };
    expect(describeTowIntent(intent, TABLE)).toEqual({
      attackId: "flurry",
      name: "Flurry",
      hits: 2,
      damage: 3,
      targetId: "p",
    });
  });
});

describe("schedule validation", () => {
  it("rejects a schedule with a repeated step, no options, or a stray key", () => {
    const good = defaultIntentSchedule("foe-0", TABLE);
    expect(isIntentSchedule({ ...good, steps: [good.steps[0], good.steps[0]] })).toBe(false);
    expect(isIntentSchedule({ ...good, steps: [{ id: "s", attackIds: [] }] })).toBe(false);
    expect(isIntentSchedule({ ...good, extra: 1 })).toBe(false);
    expect(isIntentSchedule({ ...good, steps: [] })).toBe(false);
  });

  it("snapshots a schedule map, or refuses the whole map", () => {
    const good = defaultIntentSchedule("foe-0", TABLE);
    expect(intentSchedulesSnapshot({ "foe-0": good })).toEqual({ "foe-0": good });
    expect(intentSchedulesSnapshot({})).toEqual({});
    expect(intentSchedulesSnapshot({ "foe-0": { id: "x" } })).toBe(null);
    expect(intentSchedulesSnapshot([])).toBe(null);
  });
});

describe("the control policy is a recorded decision, not an accident", () => {
  it("holds a stunned foe's telegraph rather than erasing the attack", () => {
    expect(INTENT_CONTROL_POLICY.nullifiedEnemyAdvancesIntent).toBe(false);
    expect(INTENT_CONTROL_POLICY.evidence).toBe("authored-adaptation");
  });
});
