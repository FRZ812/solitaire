import { describe, expect, it } from "vitest";
import { CHARACTER_PORTRAIT_VARIANTS } from "../components/character-portrait-assets.js";
import { CHARACTER_PORTRAIT_IDENTITY_BY_KEY } from "../components/character-portrait-roster.js";
import { characterPosition } from "../engine/positions.js";
import { makeInitialState } from "./initial-state.js";
import {
  PORTRAIT_CANDIDATE_CHARACTER_IDENTITIES,
} from "./portrait-candidate-characters.js";

const CANDIDATE_ASSET_COUNT = 30;

describe("unused portrait candidates become reachable characters", () => {
  it("registers 29 positioned people backed by all 30 distinct asset slots", () => {
    const state = makeInitialState({ worldSeed: "portrait-candidate-contract" });
    const ids = PORTRAIT_CANDIDATE_CHARACTER_IDENTITIES.map(([id]) => id);
    expect(ids).toHaveLength(29);
    expect(new Set(ids).size).toBe(ids.length);

    const usedAssets = [];
    for (const id of ids) {
      const character = state.world.codex.characters[id];
      expect(character, id).toBeTruthy();
      expect(character.portraitKey, id).toBe(`codex:${id}`);
      expect(character.at, id).toMatchObject({ day: 0 });
      expect(character.home, id).toEqual({ x: character.at.x, y: character.at.y });
      expect(characterPosition(state, id), id).not.toBeNull();
      expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY[`codex:${id}`], id).toMatchObject({ id });
      const variants = CHARACTER_PORTRAIT_VARIANTS[`codex:${id}`];
      expect(variants?.length, id).toBeGreaterThan(0);
      usedAssets.push(...variants);
    }
    expect(usedAssets).toHaveLength(CANDIDATE_ASSET_COUNT);
    expect(new Set(usedAssets).size).toBe(CANDIDATE_ASSET_COUNT);
  });

  it("keeps the Glass Spire twins co-located but mechanically distinct", () => {
    const state = makeInitialState({ worldSeed: "glass-spire-twin-contract" });
    const highMaster = state.world.codex.characters["glass-spire-master"];
    const shadowMaster = state.world.codex.characters["glass-spire-key-master-iorin"];

    expect(highMaster.profession).toBe("sorcerer");
    expect(shadowMaster.profession).toBe("sorcerer");
    expect(highMaster.title).toBe("Mystic Archmage");
    expect(highMaster.magicDiscipline).toBe("mystic-astral");
    expect(shadowMaster.title).toBe("Master of Shadows");
    expect(shadowMaster.magicDiscipline).toBe("shadow");
    expect(highMaster.description).toMatch(/mystic|astral|arcane/i);
    expect(shadowMaster.description).toMatch(/shadow/i);
    expect(highMaster.at).toEqual(shadowMaster.at);
    expect(highMaster.home).toEqual(shadowMaster.home);
    expect(characterPosition(state, highMaster.id)).not.toBeNull();
    expect(characterPosition(state, shadowMaster.id)).not.toBeNull();
  });
});
