import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRESSION_VERSION } from "../engine/progression.js";
import { stateBeforeTurn } from "../engine/timeline.js";
import { WORLD_GENERATOR_VERSION, WORLD_GEOGRAPHY_VERSION } from "./continent.js";
import { HANDCRAFTED } from "./handcrafted-map.js";
import {
  campaignWorldSeed,
  makeInitialState,
  makeNewCampaignState,
  migrateCodex,
  resetCampaignState,
} from "./initial-state.js";

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

  it("accepts a persistent campaign seed for variable minor content", () => {
    const firstSeed = campaignWorldSeed("campaign-a");
    const secondSeed = campaignWorldSeed("campaign-b");

    expect(firstSeed).not.toBe(secondSeed);
    expect(campaignWorldSeed("campaign-a")).toBe(firstSeed);
    expect(makeInitialState({ worldSeed: firstSeed }).world.seed).toBe(firstSeed);
    expect(makeInitialState({ worldSeed: secondSeed }).world.seed).toBe(secondSeed);
  });

  it("creates unique persisted seeds at the production boundary and preserves them on reset", () => {
    const seedFactory = vi.fn()
      .mockReturnValueOnce("campaign-seed:first")
      .mockReturnValueOnce("campaign-seed:second");

    const first = makeNewCampaignState({ seedFactory });
    const second = makeNewCampaignState({ seedFactory });
    const resetFactory = vi.fn(() => "campaign-seed:replacement");
    const reset = resetCampaignState(first, { seedFactory: resetFactory });

    expect(first.world.seed).toBe("campaign-seed:first");
    expect(second.world.seed).toBe("campaign-seed:second");
    expect(second.world.seed).not.toBe(first.world.seed);
    expect(reset.world.seed).toBe(first.world.seed);
    expect(seedFactory).toHaveBeenCalledTimes(2);
    expect(resetFactory).not.toHaveBeenCalled();
  });

  it("labels fresh and migrated saves with the active geography and generator versions", () => {
    const fresh = makeInitialState();
    expect(fresh.world).toMatchObject({
      geographyVersion: WORLD_GEOGRAPHY_VERSION,
      generatorVersion: WORLD_GENERATOR_VERSION,
    });

    const legacy = makeInitialState();
    legacy.world.geographyVersion = 1;
    legacy.world.generatorVersion = 2;
    legacy.world.tiles["90,90"] = {
      procedural: true,
      terrain: "forest",
      status: "scorched",
      poi: { type: "ruin", name: "The Already Found Vault" },
    };
    legacy.world.tiles["91,90"] = {
      procedural: true,
      terrain: "hills",
      cache: { id: "buried-cache" },
      poi: { type: "hidden", generated: { id: "site:2:legacy" } },
    };
    legacy.world.tiles["92,90"] = {
      terrain: "settlement",
      poi: { type: "market", name: "An Authored Market" },
    };
    legacy.pools = {
      codex: [legacy.world.codex],
      seen: [legacy.world.seen],
      tiles: [{
        "93,90": {
          procedural: true,
          terrain: "forest",
          poi: { type: "shrine", name: "The Remembered Shrine" },
        },
      }],
    };
    legacy.turns = [{
      beatsLen: 0,
      historyLen: 0,
      char: legacy.character,
      time: legacy.time,
      world: {
        codexIdx: 0,
        seenIdx: 0,
        tilesIdx: 0,
        currentTile: { x: 93, y: 90 },
        geographyVersion: 1,
        generatorVersion: 2,
      },
    }];

    const migrated = migrateCodex(legacy);
    expect(migrated.world).toMatchObject({
      geographyVersion: WORLD_GEOGRAPHY_VERSION,
      generatorVersion: WORLD_GENERATOR_VERSION,
    });
    expect(migrated.world.tiles["90,90"]).toEqual({
      proceduralDelta: true,
      visited: true,
      status: "scorched",
      poi: { type: "ruin", name: "The Already Found Vault" },
    });
    expect(migrated.world.tiles["91,90"]).toEqual({
      proceduralDelta: true,
      visited: true,
      cache: { id: "buried-cache" },
    });
    expect(migrated.world.tiles["92,90"]).toEqual({
      terrain: "settlement",
      poi: { type: "market", name: "An Authored Market" },
    });
    expect(migrated.pools.tiles[0]["93,90"]).toEqual({
      proceduralDelta: true,
      visited: true,
      poi: { type: "shrine", name: "The Remembered Shrine" },
    });
    expect(migrated.turns[0].world).toMatchObject({
      seed: migrated.world.seed,
      geographyVersion: WORLD_GEOGRAPHY_VERSION,
      generatorVersion: WORLD_GENERATOR_VERSION,
    });
    expect(stateBeforeTurn(migrated, 0).world).toMatchObject({
      seed: migrated.world.seed,
      geographyVersion: WORLD_GEOGRAPHY_VERSION,
      generatorVersion: WORLD_GENERATOR_VERSION,
      tiles: migrated.pools.tiles[0],
    });
    const remigrated = migrateCodex(migrated);
    expect(remigrated.world).toEqual(migrated.world);
    expect(remigrated.pools).toEqual(migrated.pools);
    expect(remigrated.turns).toEqual(migrated.turns);
  });

  it.each([
    ["geographyVersion", 0],
    ["geographyVersion", "not-a-version"],
    ["geographyVersion", true],
    ["generatorVersion", 0],
    ["generatorVersion", 2.5],
    ["generatorVersion", String(WORLD_GENERATOR_VERSION)],
  ])("rejects a malformed live %s value", (field, value) => {
    const state = makeInitialState();
    state.world[field] = value;
    expect(() => migrateCodex(state)).toThrow(/invalid world .* version/i);
  });

  it.each([
    ["geographyVersion", WORLD_GEOGRAPHY_VERSION + 1],
    ["generatorVersion", WORLD_GENERATOR_VERSION + 1],
  ])("rejects an unsupported rewind-checkpoint %s", (field, value) => {
    const state = makeInitialState();
    state.turns = [{ world: { [field]: value } }];
    expect(() => migrateCodex(state)).toThrow(/requires world geography .* generator .* update Solitaire/i);
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
