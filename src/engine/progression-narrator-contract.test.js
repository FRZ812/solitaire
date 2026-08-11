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

// ============================================================================
// FROZEN CONTRACT — do not edit to make a refactor pass.
//
// Everything here is the NARRATIVE identity layer: profession folding, the
// 1-100 level scale, the racial/profession budgets, and the exact prompt strings
// the narrator is steered by. None of it depends on the profession branch tree,
// the authored 70-level tables, or the path compiler.
//
// The combat/class redesign keeps all 29 professions and the 1-100 level scale
// precisely so this file keeps passing. A failure here means the redesign has
// eroded the narrative layer — which is the entire justification for keeping
// professions at all. Fix the code, not the assertion.
//
// Assertions that DO depend on the branch tree live in
// narrator-branch-contract.test.js and are expected to die with it.
// ============================================================================

describe("frozen — narrator prompt bands", () => {
  it("keeps Cleric titles under the generalized profession and numeric power bands unlabeled", () => {
    expect(SYSTEM_PROMPT).toContain("Devout and War-Priest are Cleric specializations");
    expect(SYSTEM_PROMPT).toContain("LEVEL 41–60 EXCEPTIONAL FIGURE");
    expect(SYSTEM_PROMPT).toContain("LEVEL 61–100 EXPLICIT EXCEPTIONS ONLY");
    expect(SYSTEM_PROMPT).not.toContain("EPIC FIGURE:");
    expect(SYSTEM_PROMPT).not.toContain("LEGENDARY / MYTHICAL / DIVINE:");
  });
});

describe("frozen — profession folding and level budgets", () => {
  it("folds exact vocation titles into generalized professions and enforces the profession budget", () => {
    const plan = sanitizeProfessionPlan({
      profession_plan: [
        { profession: "Archmage", levels: 45 },
        { profession: "Demon Warlock", levels: 40 },
      ],
    });

    expect(plan).toEqual([
      { profession: "wizard", specialization: "Archmage", levels: 45 },
      { profession: "warlock", specialization: "Demon Warlock", levels: 25 },
    ]);
  });

  it("clamps narrator hints to the racial and profession budgets and strips engine-owned fields", () => {
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
    });
    // The narrator never authors the ledger or picks a ready-made sheet.
    expect(hints).not.toHaveProperty("progression");
    expect(hints).not.toHaveProperty("templateId");
  });

  it("folds a broad title on a non-matching profession and rejects mutations on an existing character", () => {
    expect(sanitizeNarratorProgressionHints({
      profession_plan: [{ profession: "Hedge Mage", levels: 12 }],
      racial_levels: 2,
    }).profession).toBe("wizard");

    // An established character's numbers are the engine's. The narrator may
    // re-describe them and nothing else.
    const update = sanitizeNarratorProgressionHints({
      level: 100,
      racial_levels: 30,
      profession_plan: [{ profession: "sorcerer", levels: 70 }],
      description: "Still the same person.",
    }, { existing: true });
    expect(update).toEqual({ description: "Still the same person." });
  });
});

describe("frozen — creation and narrator context allocation", () => {
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

    expect(next.character).toMatchObject({ profession: "wizard", archetype: "hedge-mage" });
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
