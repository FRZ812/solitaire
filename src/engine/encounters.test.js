import { describe, expect, it } from "vitest";
import { pathThroughEncounter } from "./encounters.js";

describe("pathThroughEncounter", () => {
  const route = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ];

  it("ends the presented and canonical route on the first encounter tile", () => {
    const encounter = {
      atIndex: 2,
      atTile: route[2],
      encounter: { kind: "brigands", posture: "hostile" },
    };

    const leg = pathThroughEncounter(route, encounter);

    expect(leg).toEqual(route.slice(0, 3));
    expect(leg.at(-1)).toEqual(encounter.atTile);
    expect(route).toHaveLength(4);
  });

  it("returns a defensive copy when there is no valid matching encounter", () => {
    const noEncounter = pathThroughEncounter(route, null);
    const staleIndex = pathThroughEncounter(route, { atIndex: route.length });
    const mismatchedTile = pathThroughEncounter(route, { atIndex: 2, atTile: { x: 99, y: 99 } });

    expect(noEncounter).toEqual(route);
    expect(noEncounter).not.toBe(route);
    expect(staleIndex).toEqual(route);
    expect(mismatchedTile).toEqual(route);
  });
});
