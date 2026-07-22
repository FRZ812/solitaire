import { describe, expect, it } from "vitest";
import { applyWorldMovement } from "./beat-world.js";

function fixture() {
  const codex = { characters: {}, items: {}, locations: {}, factions: {}, lore: [] };
  return {
    state: {
      world: {
        currentTile: { x: 87, y: 88 },
        seen: {},
        tiles: {
          "88,88": {
            terrain: "forest",
            poi: {
              type: "hidden",
              name: "Saint Orra's Chapel",
              description: "A sealed chapel under the ward.",
              parentName: "Old Ward",
              districtName: "Lampmakers' Rise",
              marketTier: "III",
              revealType: "temple",
            },
          },
        },
        codex,
      },
      apiHistory: [],
      character: {
        darkvision: false,
        inventory: { carried: [], worn: [], coins: {} },
      },
      time: { day: 1, hour: 12, minute: 0 },
    },
    codex,
  };
}

describe("world travel discovery", () => {
  it("reveals an authored hidden site without discarding canonical metadata", () => {
    const { state, codex } = fixture();
    const character = structuredClone(state.character);
    const result = applyWorldMovement({
      state,
      codex,
      character,
      newTime: state.time,
      options: { travelToCoords: { x: 88, y: 88 } },
      beat: {
        tile_discovery: {
          name: "Saint Orra's Chapel",
          poi_type: "temple",
          description: "A sealed chapel under the ward.",
        },
      },
    });

    expect(result.world.tiles["88,88"].poi).toMatchObject({
      type: "temple",
      name: "Saint Orra's Chapel",
      parentName: "Old Ward",
      districtName: "Lampmakers' Rise",
      marketTier: "III",
      revealType: "temple",
    });
  });
});
