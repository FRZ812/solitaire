import { describe, expect, it } from "vitest";
import { CONDITIONS } from "../../data/conditions.js";
import { getStatusDefinition } from "../kernel/status-stack.js";
import {
  ADMISSION_DISPOSITION,
  CONDITION_COMBAT_EFFECTS,
  admissionPlayerNotice,
  admitTowEncounter,
  conditionAdmission,
  unmappedConditionNames,
} from "./admission.js";

const FOES = [{ name: "Brigand" }];

function codes(notes, code) {
  return notes.filter((entry) => entry.code === code);
}

describe("every authored condition has been decided about", () => {
  it("leaves none unmapped", () => {
    // The safety property this whole module exists for: authoring a condition without
    // deciding what it does in a fight has to fail here, not ship as a debuff that silently
    // does nothing.
    expect(unmappedConditionNames()).toEqual([]);
  });

  it("maps only to statuses the kernel actually defines", () => {
    for (const [name, effect] of Object.entries(CONDITION_COMBAT_EFFECTS)) {
      if (effect.kind !== "status") continue;
      expect(getStatusDefinition(effect.status), `${name} -> ${effect.status}`).toBeTruthy();
      expect(effect.count).toBeGreaterThan(0);
    }
  });

  it("gives every no-combat-expression entry a real reason", () => {
    for (const [name, effect] of Object.entries(CONDITION_COMBAT_EFFECTS)) {
      if (effect.kind !== "none") continue;
      expect(effect.reason.length, name).toBeGreaterThan(30);
    }
  });

  it("names nothing that is not an authored condition", () => {
    const stray = Object.keys(CONDITION_COMBAT_EFFECTS)
      .filter((name) => !Object.hasOwn(CONDITIONS, name));
    expect(stray).toEqual([]);
  });
});

describe("conditions reach the fight", () => {
  it("makes a bleeding character actually bleed", () => {
    // The gap this closes: the live path never asked the support matrix anything, so a
    // character walked in wounded and fought as though they were not.
    const result = conditionAdmission(["Bleeding"]);
    expect(result.statuses).toEqual([{ type: "bleed", count: 4 }]);
    expect(result.blockers).toEqual([]);
  });

  it("sums two conditions that land on the same status", () => {
    const result = conditionAdmission(["Bruised", "Weakened"]);
    expect(result.statuses).toEqual([{ type: "weak", count: 6 }]);
  });

  it("carries a blessing as readily as a wound", () => {
    const result = conditionAdmission(["Blessed", "Hastened"]);
    expect(result.statuses).toEqual([
      { type: "protection", count: 3 },
      { type: "haste", count: 1 },
    ]);
  });

  it("records a need as superseded rather than dropping it", () => {
    const result = conditionAdmission(["Thirsty"]);
    expect(result.statuses).toEqual([]);
    expect(result.notes[0]).toMatchObject({
      disposition: ADMISSION_DISPOSITION.SUPERSEDED,
      code: "condition-has-no-combat-expression",
      conditionName: "Thirsty",
    });
  });

  it("blocks a condition nobody has decided about", () => {
    const result = conditionAdmission(["Spontaneously Combusting"]);
    expect(result.blockers).toEqual([
      { code: "unsupported-condition", conditionName: "Spontaneously Combusting" },
    ]);
  });

  it("reads a condition however the campaign stored it", () => {
    // Conditions are sometimes bare strings and sometimes objects with a name.
    expect(conditionAdmission([{ name: "Bleeding" }]).statuses)
      .toEqual([{ type: "bleed", count: 4 }]);
  });
});

describe("admitting an encounter", () => {
  it("admits an ordinary fight and carries the wounds in", () => {
    const admission = admitTowEncounter({
      character: { conditions: ["Bleeding"] },
      party: [],
      enemies: FOES,
    });
    expect(admission.supported).toBe(true);
    expect(admission.blockers).toEqual([]);
    expect(admission.openingStatuses).toEqual([{ type: "bleed", count: 4 }]);
  });

  it("refuses a fight with no foes", () => {
    expect(admitTowEncounter({ character: {}, party: [], enemies: [] }))
      .toMatchObject({ supported: false, blockers: [{ code: "no-enemies" }] });
  });

  it("refuses a foe carrying mechanics the kernel cannot express", () => {
    const admission = admitTowEncounter({
      character: {},
      party: [],
      enemies: [{ name: "Wyrm", abilities: ["dragon-breath"] }],
    });
    expect(admission.supported).toBe(false);
    expect(admission.blockers[0]).toMatchObject({
      code: "unsupported-enemy-mechanics",
      enemyName: "Wyrm",
    });
  });

  it("records each superseded ability by name", () => {
    // The package is the combat identity — that is the design. Naming what it replaces is
    // what separates a decision from a silence.
    const admission = admitTowEncounter({
      character: { abilities: [{ id: "power-strike" }, "rapid-jabs"] },
      party: [],
      enemies: FOES,
    });
    expect(admission.supported).toBe(true);
    expect(codes(admission.notes, "ability-superseded-by-package").map((n) => n.abilityId))
      .toEqual(["power-strike", "rapid-jabs"]);
  });

  it("records a racial passive rather than pretending it fought", () => {
    const admission = admitTowEncounter({
      character: { racialPassives: ["darkvision"] },
      party: [],
      enemies: FOES,
    });
    expect(codes(admission.notes, "racial-passive-superseded-by-package")).toHaveLength(1);
  });

  it("records a companion who is not fielded, and says so to the player", () => {
    const admission = admitTowEncounter({
      character: {},
      party: [{ id: "freed-captive" }],
      enemies: FOES,
    });
    expect(admission.supported).toBe(true);
    const held = codes(admission.notes, "companion-not-admitted");
    expect(held).toHaveLength(1);
    expect(held[0].reason).toContain("Allied actors");
    expect(admissionPlayerNotice(admission)).toBe("Your companion holds back from the fight.");
  });

  it("counts more than one held-back companion", () => {
    const admission = admitTowEncounter({
      character: {},
      party: [{ id: "a" }, { id: "b" }],
      enemies: FOES,
    });
    expect(admissionPlayerNotice(admission)).toBe("Your 2 companions hold back from the fight.");
  });

  it("says nothing when there is nothing to say", () => {
    expect(admissionPlayerNotice(admitTowEncounter({ character: {}, party: [], enemies: FOES })))
      .toBe(null);
  });

  it("puts every part of the projection into exactly one disposition", () => {
    // Nothing may fall outside adapted / superseded / blocked. That is the invariant; a
    // capability with no home is how things went missing before.
    const admission = admitTowEncounter({
      character: {
        conditions: ["Bleeding", "Thirsty"],
        abilities: ["power-strike"],
        racialPassives: ["darkvision"],
      },
      party: [{ id: "ally" }],
      enemies: FOES,
    });
    const dispositions = new Set(admission.notes.map((entry) => entry.disposition));
    expect([...dispositions].sort()).toEqual([
      ADMISSION_DISPOSITION.ADAPTED,
      ADMISSION_DISPOSITION.SUPERSEDED,
    ]);
    expect(admission.notes).toHaveLength(5);
  });
});
