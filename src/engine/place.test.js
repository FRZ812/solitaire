import { describe, it, expect } from "vitest";
import {
  getPlace, enterPlace, leavePlace, moveToNode, moveAlongPlaceRoute, currentNode, currentExits,
  inPlace, standingNodeTile, placeAtTile, nodeTile,
} from "./place.js";
import { marchRoute } from "./world.js";

describe("place graph (scale 2)", () => {
  it("loads Whitemarch with symmetrised exits", () => {
    const wm = getPlace("whitemarch");
    expect(wm).toBeTruthy();
    expect(wm.nodes["grain-square"]).toBeTruthy();
    // grand-concourse lists grain-square; the reverse link is auto-added on load.
    expect(wm.nodes["grain-square"].exits).toContain("grand-concourse");
    expect(wm.nodes["grand-concourse"].exits).toContain("grain-square");
  });

  it("the gate is the only world exit and (0,0) is its mouth", () => {
    expect(getPlace("whitemarch").nodes["crown-gate"].worldExit).toBe(true);
    expect(placeAtTile(null, 0, 0)).toBe("whitemarch");
    expect(placeAtTile(null, 9, 9)).toBe(null);
  });

  it("enter / move / leave reducers", () => {
    const base = { world: { currentTile: { x: 0, y: 0 } } };
    const inWm = enterPlace(base, "whitemarch", "grain-square");
    expect(inPlace(inWm)).toBe(true);
    expect(currentNode(inWm).id).toBe("grain-square");

    // Can only move to an actual exit of the current node.
    const exits = currentExits(inWm).map((e) => e.id);
    expect(exits).toContain("grand-concourse");
    const moved = moveToNode(inWm, "grand-concourse");
    expect(currentNode(moved).id).toBe("grand-concourse");
    // A non-adjacent node is rejected (no teleporting across the graph).
    expect(currentNode(moveToNode(inWm, "iron-palace")).id).toBe("grain-square");

    const out = leavePlace(moved);
    expect(inPlace(out)).toBe(false);
  });

  it("the standing tile carries the node's service for the town system", () => {
    const inWm = enterPlace({ world: { currentTile: { x: 0, y: 0 } } }, "whitemarch", "grain-square");
    const t = standingNodeTile(inWm);
    expect(t.terrain).toBe("settlement");
    expect(t.poi.service).toBe("market");      // wires data/town.js BUILDINGS.market
    expect(t.poi.parentName).toBe("Whitemarch");
    expect(nodeTile(getPlace("whitemarch"), getPlace("whitemarch").nodes["smith-row"]).poi.service).toBe("blacksmith");
  });

  it("walks a validated multi-node city route atomically", () => {
    const base = enterPlace({ world: { currentTile: { x: 0, y: 0 } } }, "whitemarch", "grain-square");
    const walked = moveAlongPlaceRoute(base, ["grand-concourse", "guild-court", "inner-gate", "muster-court", "iron-palace"]);
    expect(currentNode(walked).id).toBe("iron-palace");

    const rejected = moveAlongPlaceRoute(base, ["grand-concourse", "iron-palace"]);
    expect(rejected).toBe(base);
    expect(currentNode(rejected).id).toBe("grain-square");
  });
});

describe("go-anywhere march", () => {
  const blank = { world: { tiles: {}, seen: {} } };

  it("reaches an open destination it has never seen", () => {
    // Populate a path of passable road tiles since procedural wilderness is now impassable by ground.
    const tiles = {};
    for (let x = 200; x <= 205; x++) {
      tiles[`${x},200`] = { terrain: "road" };
    }
    const state = { world: { tiles, seen: {} } };
    const route = marchRoute(state, { x: 200, y: 200 }, { x: 205, y: 200 }, 48);
    const end = route[route.length - 1];
    expect(end).toEqual({ x: 205, y: 200 });
    expect(route.length).toBe(6); // start + 5 steps
  });

  it("returns just the origin when already at the destination", () => {
    const route = marchRoute(blank, { x: 1, y: 1 }, { x: 1, y: 1 }, 48);
    expect(route).toEqual([{ x: 1, y: 1 }]);
  });
});
