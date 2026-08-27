import { describe, expect, it } from "vitest";
import {
  REGIONAL_ESTABLISHMENT_CHARACTER_IDENTITIES,
  makeRegionalEstablishmentCharacters,
} from "./regional-establishment-characters.js";
import { makeInitialState } from "./initial-state.js";

describe("regional establishment portrait characters", () => {
  it("turns every accepted portrait into one adult woman with a Codex identity and home", () => {
    const characters = makeRegionalEstablishmentCharacters();
    const ids = REGIONAL_ESTABLISHMENT_CHARACTER_IDENTITIES.map(([id]) => id);

    expect(Object.keys(characters).sort()).toEqual([...ids].sort());
    expect(ids).toHaveLength(10);

    for (const id of ids) {
      const character = characters[id];
      expect(character.id).toBe(id);
      expect(character.portraitKey).toBe(`codex:${id}`);
      expect(character.gender).toBe("female");
      expect(character.age).toBeGreaterThanOrEqual(18);
      expect(character.attractiveness).toBeGreaterThanOrEqual(7);
      expect(character.at).toEqual(expect.objectContaining({ day: 0 }));
      expect(character.home).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    }
  });

  it("places every dossier in the initial in-game Codex", () => {
    const state = makeInitialState({ worldSeed: "regional-establishment-portrait-test" });
    const codexCharacters = state.world.codex.characters;

    for (const [id, name] of REGIONAL_ESTABLISHMENT_CHARACTER_IDENTITIES) {
      expect(codexCharacters[id]).toEqual(expect.objectContaining({
        id,
        name,
        portraitKey: `codex:${id}`,
      }));
    }
  });
});
