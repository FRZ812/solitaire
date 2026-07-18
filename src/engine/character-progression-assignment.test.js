import { describe, expect, it } from "vitest";
import { COMPANION_LIST, companionCodexEntry } from "../data/companions.js";
import { BESTIARY, enemyFromNPC, generateEnemy } from "../data/bestiary.js";
import { makeInitialState } from "../data/initial-state.js";
import { MOUNT_LIST, mountCodexEntry } from "../data/mounts.js";
import { professionBranchChoices } from "../data/profession-branches.js";
import { PROFESSION_PROFILES } from "../data/profession-progressions.js";
import { racialBranchChoices } from "../data/racial-branches.js";
import { PRISONER_POOL, prisonerCodexEntry } from "../data/gaol.js";
import { CAPTIVE_POOL, bondedCodexEntry } from "../data/slaves.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import { mergeDiscoveries } from "./discoveries.js";
import {
  allocatedProgressionLevel,
  createProgression,
  migrateProgressionState,
  professionProgressionLevel,
  progressionLevel,
  racialProgressionLevel,
} from "./progression.js";

const rankTotal = (paths = {}) => Object.values(paths)
  .reduce((sum, rank) => sum + Math.max(0, Math.floor(Number(rank) || 0)), 0);

function expectReachedBranches(character) {
  for (const track of character.progression.professions) {
    const level = rankTotal(track.paths);
    const selected = track.branchChoices || {};
    for (const [choiceId, optionId] of Object.entries(selected)) {
      const definition = professionBranchChoices(track.professionId).find((choice) => choice.id === choiceId);
      expect(definition, `${character.id || character.name}: ${track.professionId}/${choiceId}`).toBeTruthy();
      expect(definition.threshold, `${character.id || character.name}: ${choiceId} threshold`).toBeLessThanOrEqual(level);
      expect(definition.options.some((option) => option.id === optionId), `${character.id || character.name}: ${choiceId}/${optionId}`).toBe(true);
      if (definition.parentChoiceId) {
        expect(selected[definition.parentChoiceId], `${character.id || character.name}: ${choiceId} parent`)
          .toBe(definition.parentOptionId);
      }
    }
  }

  const racial = character.progression.racial;
  const racialLevel = rankTotal(racial.paths);
  for (const [choiceId, optionId] of Object.entries(racial.branchChoices || {})) {
    const definition = racialBranchChoices(racial.raceId).find((choice) => choice.id === choiceId);
    expect(definition, `${character.id || character.name}: ${racial.raceId}/${choiceId}`).toBeTruthy();
    expect(definition.threshold, `${character.id || character.name}: ${choiceId} threshold`).toBeLessThanOrEqual(racialLevel);
    expect(definition.options.some((option) => option.id === optionId), `${character.id || character.name}: ${choiceId}/${optionId}`).toBe(true);
    if (definition.parentChoiceId) {
      expect(racial.branchChoices[definition.parentChoiceId], `${character.id || character.name}: ${choiceId} parent`)
        .toBe(definition.parentOptionId);
    }
  }
}

function expectValidLedger(character, { exact = true } = {}) {
  expect(character.progression, character.id || character.name).toMatchObject({ version: 2 });
  expect(character.progression.professions.length, character.id || character.name).toBeGreaterThan(0);
  expect(character.progression.racial?.raceId, character.id || character.name).toBeTruthy();
  for (const track of character.progression.professions) {
    expect(PROFESSION_PROFILES[track.professionId], `${character.id || character.name}: ${track.professionId}`).toBeTruthy();
    expect(track.paths, `${character.id || character.name}: ${track.professionId} paths`).toBeTruthy();
  }
  const professionLevel = professionProgressionLevel(character);
  const racialLevel = racialProgressionLevel(character);
  expect(professionLevel, `${character.id || character.name}: profession budget`).toBeLessThanOrEqual(70);
  expect(racialLevel, `${character.id || character.name}: racial budget`).toBeLessThanOrEqual(30);
  expect(allocatedProgressionLevel(character), `${character.id || character.name}: split total`)
    .toBe(professionLevel + racialLevel);
  expect(allocatedProgressionLevel(character), `${character.id || character.name}: character cap`).toBeLessThanOrEqual(100);
  if (exact) expect(progressionLevel(character), `${character.id || character.name}: exact allocation`).toBe(allocatedProgressionLevel(character));
  expectReachedBranches(character);
}

describe("character progression assignment", () => {
  it("gives every campaign template and fresh Codex character a valid profession/race ledger", () => {
    for (const template of CHARACTER_TEMPLATES) expectValidLedger({ id: template.id, ...template.setup });
    for (const character of Object.values(makeInitialState().world.codex.characters)) {
      expectValidLedger(character);
      expect(character, character.id).not.toHaveProperty("level");
    }
  });

  it("normalizes every reusable character factory before its entry reaches the Codex", () => {
    const entries = [
      ...COMPANION_LIST.map((template) => companionCodexEntry(template)),
      ...MOUNT_LIST.map((template) => mountCodexEntry(template, template.name)),
      ...CAPTIVE_POOL.map((template) => bondedCodexEntry(template)),
      ...PRISONER_POOL.map((template) => prisonerCodexEntry(template)),
    ];

    expect(entries.length).toBeGreaterThan(20);
    for (const entry of entries) {
      expectValidLedger(entry);
      expect(entry).not.toHaveProperty("level");
    }
  });

  it("attaches a hidden, spread level ledger to generated and known-NPC combatants", () => {
    const tierIds = ["common", "uncommon", "rare", "very-rare", "epic", "legendary", "mythical", "divine"];
    const generated = Object.keys(BESTIARY).map((kind, index) => generateEnemy(kind, {
      tierId: tierIds[index % tierIds.length],
      index,
      total: Object.keys(BESTIARY).length,
    }));
    for (const combatant of generated) {
      expectValidLedger(combatant);
      expect(progressionLevel(combatant)).toBeLessThanOrEqual(60);
      expect(combatant).not.toHaveProperty("level");
    }
    expect(new Set(generated.map((combatant) => progressionLevel(combatant))).size).toBeGreaterThan(8);

    const state = makeInitialState();
    const source = state.world.codex.characters["demon-king"];
    const known = enemyFromNPC(source, state.world.codex);
    expectValidLedger(known);
    expect(progressionLevel(known)).toBe(100);
    expect(known.progression).toBe(source.progression);
  });

  it("fits an overdeclared generated NPC plan to the living-world cap and prunes unreached branches", () => {
    const { codex } = mergeDiscoveries({ characters: {} }, {
      characters: [{
        id: "pale-road-necromancer",
        name: "The Pale Road Necromancer",
        race: "human",
        level: 100,
        racial_levels: 30,
        profession_plan: [{
          profession: "wizard",
          specialization: "Necromancer",
          levels: 70,
          branchChoices: {
            "wizard-school": "necromancy",
            "necromancy-discipline": "death-magic",
            "death-magic-mastery": "drain",
          },
        }],
      }],
    });
    const character = codex.characters["pale-road-necromancer"];
    const wizard = character.progression.professions[0];

    expectValidLedger(character);
    expect(progressionLevel(character)).toBe(60);
    expect(professionProgressionLevel(character)).toBe(30);
    expect(racialProgressionLevel(character)).toBe(30);
    expect(wizard.branchChoices).toEqual({
      "wizard-school": "necromancy",
      "necromancy-discipline": "death-magic",
    });
  });

  it("repairs migrated v2 ledgers without changing their varied total level", () => {
    const progression = createProgression({
      professionId: "wizard",
      raceId: "human",
      level: 17,
      professionLevels: 12,
      racialLevels: 5,
    });
    progression.professions[0].branchChoices = {
      "wizard-school": "necromancy",
      "necromancy-discipline": "death-magic",
      "death-magic-mastery": "drain",
    };
    progression.racial.branchChoices = {
      "human-adaptation": "prodigy",
      "human-prodigy-calling": "polymath",
    };
    const state = {
      progressionVersion: 2,
      attributeScaleVersion: 2,
      character: {
        id: "wanderer",
        kind: "player",
        race: "human",
        profession: "wizard",
        attributes: { body: 4, reflex: 4, vigor: 4, mind: 10, wit: 8, presence: 3 },
        progression,
      },
      world: { codex: { characters: {} } },
      turns: [],
      pools: { codex: [] },
    };

    migrateProgressionState(state);
    const migrated = state.character;
    expectValidLedger(migrated);
    expect(progressionLevel(migrated)).toBe(17);
    expect(migrated.progression.professions[0].branchChoices).toEqual({ "wizard-school": "necromancy" });
    expect(migrated.progression.racial.branchChoices).toEqual({});
  });
});
