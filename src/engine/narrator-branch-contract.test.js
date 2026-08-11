import { describe, expect, it } from "vitest";
import { summarizeProgressionAllocation } from "./api.js";
import { sanitizeProfessionPlan } from "./discoveries.js";

// ============================================================================
// DOOMED CONTRACT — expected to die with the profession branch tree.
//
// Every assertion here depends on `src/data/profession-branches.js` (2,922 LOC
// of choice/option ids) or on the generated path-map keys produced by the
// 7-segment compiler in `src/data/progression-paths.js`. The combat/class
// redesign deletes both, replacing them with archetype talent tracks.
//
// Split out of progression-narrator-contract.test.js deliberately: when these
// go red during the progression swap, that is the migration working. Delete
// this file in the same commit as the branch tree — do NOT "fix" it, and above
// all do not loosen the frozen profession assertions next door to make a whole
// combined file pass.
//
// What genuinely must survive is already asserted in the frozen file:
//   - narrator branch choices never take effect during player creation
//     (re-expressed there as: the engine owns the ledger, hints are stripped)
//   - profession folding, level budgets, and the progression context line
// ============================================================================

describe("doomed — narrator branch-choice round-trip", () => {
  it("carries authored branch choices through when branches are explicitly allowed", () => {
    const plan = sanitizeProfessionPlan({
      profession_plan: [
        {
          profession: "Archmage",
          levels: 45,
          specializationPath: "necromancy",
          branchChoices: {
            "wizard-school@10": "necromancy",
            "necromancy-path@30": "undead-lord",
          },
        },
        { profession: "Demon Warlock", levels: 40 },
      ],
    }, { allowBranches: true });

    expect(plan).toEqual([
      {
        profession: "wizard",
        specialization: "Archmage",
        levels: 45,
        specializationPath: "necromancy",
        branchChoices: {
          "wizard-school@10": "necromancy",
          "necromancy-path@30": "undead-lord",
        },
      },
      { profession: "warlock", specialization: "Demon Warlock", levels: 25 },
    ]);
  });

  it("does not accept narrator-selected branch choices during player creation", () => {
    expect(sanitizeProfessionPlan({
      profession_plan: [{
        profession: "wizard",
        specialization: "Necromancer",
        levels: 20,
        specializationPath: "necromancy",
        branchChoices: { "necromancy-path@30": "death-magic" },
      }],
    })).toEqual([{ profession: "wizard", specialization: "Necromancer", levels: 20 }]);
  });
});

describe("doomed — compiled path-map summarization", () => {
  it("distinguishes broad profession growth from selected layered NPC branches", () => {
    const allocation = summarizeProgressionAllocation({
      progression: {
        version: 2,
        racial: { paths: { "vampire-foundation": 6 } },
        professions: [{
          professionId: "wizard",
          specializationId: "Pale Archivist",
          paths: { "wizard-foundation": 15, "wizard-study": 15, necromancy: 10 },
          branchChoices: {
            "wizard-school@10": "necromancy",
            "necromancy-path@30": "undead-lord",
          },
        }],
      },
    });

    expect(allocation).toMatchObject({ racialLevel: 6, professionLevel: 40 });
    expect(allocation.professionText).toContain("Wizard (Pale Archivist) 40");
    expect(allocation.professionText).toContain("wizard-school@10=necromancy");
    expect(allocation.professionText).toContain("necromancy-path@30=undead-lord");
  });
});

describe("doomed — sorcerer branch gating on narrator hints", () => {
  it("drops Sorcerer-only choices from a non-Sorcerer plan", async () => {
    const { sanitizeNarratorProgressionHints } = await import("./discoveries.js");
    const nonSorcerer = sanitizeNarratorProgressionHints({
      profession_plan: [{ profession: "Hedge Mage", levels: 12 }],
      racial_levels: 2,
      signature_spell: "star-fire",
      metamagic: ["empowered"],
    });
    expect(nonSorcerer.profession).toBe("wizard");
    expect(nonSorcerer).not.toHaveProperty("signature_spell");
    expect(nonSorcerer).not.toHaveProperty("metamagic");
  });

  it("keeps Sorcerer choices on a genuine Sorcerer plan", async () => {
    const { sanitizeNarratorProgressionHints } = await import("./discoveries.js");
    const hints = sanitizeNarratorProgressionHints({
      level: 100,
      racial_levels: 80,
      profession_plan: [{ profession: "High Sorcerer", levels: 80 }],
      signature_spell: "star-fire",
      metamagic: ["empowered"],
    });
    expect(hints).toMatchObject({ signature_spell: "star-fire", metamagic: ["empowered"] });
  });
});
