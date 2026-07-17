import { describe, expect, it } from "vitest";
import { AUTHORED_WORLD_LEVELS, progressionLevel } from "../engine/progression.js";
import { progressionAtLevel } from "./progression-paths.js";
import { makeInitialState } from "./initial-state.js";

describe("fresh Codex progression", () => {
  it("gives every Codex character a profession, archetype, and rank-derived level", () => {
    const characters = makeInitialState().world.codex.characters;

    for (const character of Object.values(characters)) {
      expect(character.profession, character.id).toBeTruthy();
      expect(character.archetype, character.id).toBeTruthy();
      expect(character.progression, character.id).toMatchObject({ version: 1 });
      expect(progressionLevel(character), character.id).toBeGreaterThan(0);
      expect(character, character.id).not.toHaveProperty("level");
    }
  });

  it("uses deliberate authored levels and exact route attributes for the named world cast", () => {
    const characters = makeInitialState().world.codex.characters;

    for (const [id, level] of Object.entries(AUTHORED_WORLD_LEVELS)) {
      const character = characters[id];
      const route = progressionAtLevel(character.progression.professionId, level, {
        sidePath: character.progression.sidePath,
        archetypeId: character.progression.archetypeId,
      });
      expect(progressionLevel(character), id).toBe(level);
      expect(character.attributes, id).toEqual(route.attributes);
    }
  });
});
