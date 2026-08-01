import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { NARRATOR_INSTRUCTION_CORPUS as SYSTEM_PROMPT } from "../narrator-instructions.js";
import { buildStateContext, summarizeProgressionAllocation } from "./api.js";
import { applyBeat } from "./beat.js";
import {
  sanitizeNarratorProgressionHints,
  sanitizeProfessionPlan,
} from "./discoveries.js";
import { progressionLevel } from "./progression.js";

describe("narrator profession-plan validation", () => {
  it("keeps Cleric titles under the generalized profession and numeric power bands unlabeled", () => {
    expect(SYSTEM_PROMPT).toContain("Devout and War-Priest are Cleric specializations");
    expect(SYSTEM_PROMPT).toContain("LEVEL 41–60 EXCEPTIONAL FIGURE");
    expect(SYSTEM_PROMPT).toContain("LEVEL 61–100 EXPLICIT EXCEPTIONS ONLY");
    expect(SYSTEM_PROMPT).not.toContain("EPIC FIGURE:");
    expect(SYSTEM_PROMPT).not.toContain("LEGENDARY / MYTHICAL / DIVINE:");
  });

  it("folds exact vocation titles into generalized professions and enforces both budgets", () => {
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

    const hints = sanitizeNarratorProgressionHints({
      level: 100,
      racial_levels: 80,
      profession_plan: [{ profession: "High Sorcerer", levels: 80 }],
      progression: { version: 999, paths: { invented: 100 } },
      templateId: "forbidden-template",
      signature_spell: "star-fire",
      metamagic: ["empowered"],
    });

    expect(hints).toMatchObject({
      level: 100,
      racial_levels: 30,
      profession: "sorcerer",
      archetype: "High Sorcerer",
      profession_plan: [{ profession: "sorcerer", specialization: "High Sorcerer", levels: 70 }],
      signature_spell: "star-fire",
      metamagic: ["empowered"],
    });
    expect(hints).not.toHaveProperty("progression");
    expect(hints).not.toHaveProperty("templateId");
  });

  it("drops Sorcerer-only choices and all allocation mutations from invalid contexts", () => {
    const nonSorcerer = sanitizeNarratorProgressionHints({
      profession_plan: [{ profession: "Hedge Mage", levels: 12 }],
      racial_levels: 2,
      signature_spell: "star-fire",
      metamagic: ["empowered"],
    });
    expect(nonSorcerer.profession).toBe("wizard");
    expect(nonSorcerer).not.toHaveProperty("signature_spell");
    expect(nonSorcerer).not.toHaveProperty("metamagic");

    const update = sanitizeNarratorProgressionHints({
      level: 100,
      racial_levels: 30,
      profession_plan: [{ profession: "sorcerer", levels: 70 }],
      signature_spell: "star-fire",
      metamagic: ["empowered"],
      description: "Still the same person.",
    }, { existing: true });
    expect(update).toEqual({ description: "Still the same person." });
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

describe("creation and narrator context allocation", () => {
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

  it("compiles racial and multiclass setup hints into the engine-owned ledger", () => {
    const next = applyBeat(makeInitialState(), {
      character_setup: {
        name: "Mara",
        race: "vampire",
        racial_levels: 8,
        profession_plan: [
          { profession: "Hedge Mage", levels: 12 },
          { profession: "Artisan", specialization: "Runesmith", levels: 5 },
        ],
      },
    });

    expect(next.character).toMatchObject({
      profession: "wizard",
      archetype: "hedge-mage",
    });
    expect(progressionLevel(next.character)).toBe(25);
    const allocation = summarizeProgressionAllocation(next.character);
    expect(allocation).toMatchObject({ totalLevel: 25, racialLevel: 8, professionLevel: 17 });
    expect(allocation.professionText).toContain("Wizard");
    expect(allocation.professionText).toContain("Artisan");
  });

  it("shows exact numeric allocation to the narrator without a character rarity label", () => {
    const next = applyBeat(makeInitialState(), {
      character_setup: {
        name: "Mara",
        race: "vampire",
        racial_levels: 4,
        profession_plan: [{ profession: "Archmage", levels: 17 }],
      },
    });
    const context = buildStateContext(next);

    expect(context).toContain("[PROGRESSION — level 21/100 = racial 4/30 + professions 17/70");
    expect(context).toContain("Wizard (Archmage) 17");
    expect(context).not.toMatch(/\[PROGRESSION[^\n]*(Standard|Veteran|Epic|Legendary|Mythical|Divine)/);
  });
});
