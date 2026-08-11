import { describe, expect, it } from "vitest";
import {
  canTrackCharacter,
  playableCharactersNear,
  scryResult,
} from "./positions.js";

function stateWithNaturallyDeadCharacter() {
  return {
    character: { id: "wanderer", abilities: [] },
    party: [],
    time: { day: 9 },
    world: {
      currentTile: { x: 3, y: 4 },
      tiles: {},
      codex: {
        spells: {},
        characters: {
          elder: {
            id: "elder",
            name: "Old Nara",
            playable: true,
            at: { x: 3, y: 4, day: 8 },
            home: { x: 3, y: 4 },
            deathDay: 8,
            deathReason: "natural",
          },
        },
      },
    },
  };
}

describe("dead character location authority", () => {
  it("excludes natural deaths from tracking, proximity, and live scry results", () => {
    const state = stateWithNaturallyDeadCharacter();

    expect(canTrackCharacter(state, "elder")).toBe(false);
    expect(playableCharactersNear(state)).toEqual([]);
    expect(scryResult(state, "elder")).toBeNull();
  });
});