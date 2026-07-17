import { describe, expect, it } from "vitest";
import { CHARACTER_TEMPLATES, TEMPLATE_RACIAL_LEVELS } from "./templates.js";
import {
  TEMPLATE_RACIAL_BRANCH_BUILDS,
  TEMPLATE_RACIAL_BRANCH_CHOICES,
  validateTemplateRacialBranchBuilds,
} from "./template-racial-branches.js";
import { pendingRacialBranchChoices, racialBranchChoices } from "./racial-branches.js";

const TEMPLATE_RACES = Object.freeze(Object.fromEntries(
  CHARACTER_TEMPLATES.map((template) => [template.id, template.setup.race]),
));

const EXPECTED_ELIGIBLE_IDS = [
  "champion-paladin",
  "dragon-hunter",
  "high-sorcerer",
  "warlord",
  "fae-touched",
  "archmage-ascendant",
  "undying-champion",
  "demon-warlock",
  "dragon-ascendant",
  "enchanter-tyrant",
];

describe("ready-made racial branch selections", () => {
  it("covers exactly the templates whose authored racial level has reached a choice", () => {
    const eligible = Object.entries(TEMPLATE_RACIAL_LEVELS)
      .filter(([, level]) => level >= 10)
      .map(([templateId]) => templateId);
    expect(eligible).toEqual(EXPECTED_ELIGIBLE_IDS);
    expect(Object.keys(TEMPLATE_RACIAL_BRANCH_BUILDS)).toEqual(EXPECTED_ELIGIBLE_IDS);
    expect(Object.keys(TEMPLATE_RACIAL_BRANCH_CHOICES)).toEqual(EXPECTED_ELIGIBLE_IDS);
  });

  it("validates every option, threshold, race, and nested prerequisite against live template levels", () => {
    expect(validateTemplateRacialBranchBuilds(TEMPLATE_RACIAL_LEVELS, TEMPLATE_RACES)).toEqual([]);
    for (const [templateId, build] of Object.entries(TEMPLATE_RACIAL_BRANCH_BUILDS)) {
      const level = TEMPLATE_RACIAL_LEVELS[templateId];
      expect(pendingRacialBranchChoices(build.raceId, level, build.branchChoices), templateId).toEqual([]);
      for (const [choiceId, optionId] of Object.entries(build.branchChoices)) {
        const definition = racialBranchChoices(build.raceId).find((entry) => entry.id === choiceId);
        expect(definition.threshold, `${templateId}/${choiceId}`).toBeLessThanOrEqual(level);
        expect(definition.options.map((entry) => entry.id), `${templateId}/${choiceId}`).toContain(optionId);
      }
    }
  });

  it("resolves only the root for levels 10-19 and includes the reached child from level 20", () => {
    for (const [templateId, build] of Object.entries(TEMPLATE_RACIAL_BRANCH_BUILDS)) {
      const level = TEMPLATE_RACIAL_LEVELS[templateId];
      expect(Object.keys(build.branchChoices), templateId).toHaveLength(level >= 20 ? 2 : 1);
    }
  });

  it("matches the supernatural ready-made identities to individually authored racial paths", () => {
    expect(TEMPLATE_RACIAL_BRANCH_CHOICES["fae-touched"]).toEqual({
      "elf-awakening": "greenblood",
      "elf-greenblood-destiny": "wild-runner",
    });
    expect(TEMPLATE_RACIAL_BRANCH_CHOICES["demon-warlock"]).toEqual({
      "demonborn-inheritance": "velvet-tempter",
      "demonborn-tempter-apex": "court-devil",
    });
    expect(TEMPLATE_RACIAL_BRANCH_CHOICES["dragon-ascendant"]).toEqual({
      "drakeborn-breath-line": "ember-line",
      "drakeborn-ember-ascendance": "cinder-tyrant",
    });
    expect(TEMPLATE_RACIAL_BRANCH_CHOICES["enchanter-tyrant"]).toEqual({
      "human-adaptation": "prodigy",
      "human-prodigy-calling": "polymath",
    });
  });

  it("would reject an early or prerequisite-breaking authored selection", () => {
    expect(validateTemplateRacialBranchBuilds(
      { ...TEMPLATE_RACIAL_LEVELS, "dragon-ascendant": 19 },
      TEMPLATE_RACES,
    )).toEqual(expect.arrayContaining([
      expect.stringContaining("dragon-ascendant: selected drakeborn-ember-ascendance at 19"),
    ]));
    expect(validateTemplateRacialBranchBuilds(
      TEMPLATE_RACIAL_LEVELS,
      { ...TEMPLATE_RACES, "demon-warlock": "human" },
    )).toContain("demon-warlock: branch race demonborn does not match human");
  });
});
