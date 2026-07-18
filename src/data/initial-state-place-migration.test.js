import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROGRESSION_VERSION } from "../engine/progression.js";
import { HANDCRAFTED } from "./handcrafted-map.js";
import { makeInitialState, migrateCodex } from "./initial-state.js";

let originalTiles;

beforeEach(() => {
  originalTiles = { ...HANDCRAFTED };
  for (const key of Object.keys(HANDCRAFTED)) delete HANDCRAFTED[key];
  HANDCRAFTED["0,0"] = {
    terrain: "settlement",
    poi: {
      type: "market",
      name: "Grain Square",
      part: "grain-square",
      partName: "Grain Square",
      parentName: "The Grand Market",
      district: "grand-market",
      districtName: "The Grand Market",
      service: "market",
    },
  };
  HANDCRAFTED["2,11"] = {
    terrain: "settlement",
    poi: {
      name: "Smith Row",
      part: "smith-row",
      partName: "Smith Row",
      parentName: "The Grand Market",
      service: "blacksmith",
    },
  };
});

afterEach(() => {
  for (const key of Object.keys(HANDCRAFTED)) delete HANDCRAFTED[key];
  Object.assign(HANDCRAFTED, originalTiles);
});

describe("unified capital migration", () => {
  it("starts fresh campaigns at Grain Square in continent coordinates", () => {
    const state = makeInitialState();

    expect(state.world.currentTile).toEqual({ x: 0, y: 0 });
    expect(state.world).not.toHaveProperty("place");
    expect(state.world.tiles["0,0"]?.poi?.service).toBe("market");
  });

  it("moves legacy place saves and their rewind checkpoints onto world POIs", () => {
    const state = makeInitialState();
    state.world.currentTile = { x: 0, y: 0 };
    state.world.place = { id: "whitemarch", node: "smith-row" };
    state.turns = [{
      world: {
        currentTile: { x: 0, y: 0 },
        place: { id: "whitemarch", node: "grain-square" },
        codexIdx: 0,
        seenIdx: 0,
        tilesIdx: 0,
      },
    }];

    const migrated = migrateCodex(state);

    expect(migrated.world.currentTile).toEqual({ x: 2, y: 11 });
    expect(migrated.world).not.toHaveProperty("place");
    expect(migrated.turns[0].world.currentTile).toEqual({ x: 0, y: 0 });
    expect(migrated.turns[0].world).not.toHaveProperty("place");

    // The migration is deliberately one-way and safe to run on every load.
    expect(migrateCodex(migrated).world.currentTile).toEqual({ x: 2, y: 11 });
  });

  it("retires world.place even when a minimal legacy save has no Codex", () => {
    const legacy = {
      character: {
        profession: "farmer",
        attributes: { body: 5, reflex: 3, vigor: 6, mind: 3, wit: 4, presence: 2 },
      },
      world: {
        currentTile: { x: 0, y: 0 },
        place: { id: "whitemarch", node: "smith-row" },
      },
    };

    const migrated = migrateCodex(legacy);

    expect(migrated.world.currentTile).toEqual({ x: 2, y: 11 });
    expect(migrated.world).not.toHaveProperty("place");
    expect(migrated.world.codex).toBeUndefined();
    expect(migrated.character).toMatchObject({ id: "wanderer", kind: "player", profession: "farmer" });
    expect(migrated.character.progression).toMatchObject({ version: PROGRESSION_VERSION, professionId: "farmer" });
  });
});
