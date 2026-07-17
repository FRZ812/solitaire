import { describe, expect, it } from "vitest";
import { AUTHORED_WORLD_LEVELS, progressionLevel } from "../engine/progression.js";
import { attributeCeilingForLevel, compileCharacterProgression } from "./progression-paths.js";
import { makeInitialState } from "./initial-state.js";

const rankTotal = (paths = {}) => Object.values(paths).reduce((sum, rank) => sum + (Number(rank) || 0), 0);

describe("fresh Codex progression", () => {
  it("gives every Codex character a generalized profession and v2 rank ledger", () => {
    const characters = makeInitialState().world.codex.characters;

    for (const character of Object.values(characters)) {
      expect(character.profession, character.id).toBeTruthy();
      expect(character.progression, character.id).toMatchObject({ version: 2 });
      expect(character.progression.professions.length, character.id).toBeGreaterThan(0);
      expect(character.progression.racial, character.id).toBeTruthy();
      expect(progressionLevel(character), character.id).toBeGreaterThan(0);
      expect(character, character.id).not.toHaveProperty("level");
    }
  });

  it("uses deliberate authored levels and route-bounded attributes for the named world cast", () => {
    const characters = makeInitialState().world.codex.characters;

    for (const [id, level] of Object.entries(AUTHORED_WORLD_LEVELS)) {
      const character = characters[id];
      const route = compileCharacterProgression({
        professions: character.progression.professions.map((track) => ({
          professionId: track.professionId,
          specializationId: track.specializationId,
          levels: rankTotal(track.paths),
          choices: track.choices,
          branchChoices: track.branchChoices,
        })),
        racial: {
          raceId: character.progression.racial.raceId,
          evolutionId: character.progression.racial.evolutionId,
          levels: rankTotal(character.progression.racial.paths),
          branchChoices: character.progression.racial.branchChoices,
        },
      });
      expect(progressionLevel(character), id).toBe(level);
      const actualTotal = Object.values(character.attributes).reduce((sum, value) => sum + value, 0);
      const routeTotal = Object.values(route.finalAttributes).reduce((sum, value) => sum + value, 0);
      expect(actualTotal, `${id} attribute budget`).toBeGreaterThanOrEqual(Math.round(routeTotal * 0.85));
      expect(actualTotal, `${id} attribute budget`).toBeLessThanOrEqual(Math.round(routeTotal * 1.15));
      expect(Math.max(...Object.values(character.attributes)), `${id} attribute cap`).toBeLessThanOrEqual(attributeCeilingForLevel(level));
    }
  });
});
