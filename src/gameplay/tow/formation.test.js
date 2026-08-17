import { describe, expect, it } from "vitest";
import {
  FORMATION_CELLS,
  FORMATION_CELL_COUNT,
  FORMATION_FOOTPRINTS,
  FORMATION_WIDTH,
  actorAtCell,
  cellForActor,
  footprintCells,
  formationColumn,
  formationRow,
  livingActorIds,
  livingOccupants,
  normalizeFormation,
} from "./formation.js";

describe("3x3 formation geometry", () => {
  it("numbers every cell row-major with row zero as the front rank", () => {
    expect(FORMATION_WIDTH).toBe(3);
    expect(FORMATION_CELL_COUNT).toBe(9);
    expect(FORMATION_CELLS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(FORMATION_CELLS.map(formationRow)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(FORMATION_CELLS.map(formationColumn)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
  });

  it("resolves every footprint from the centre in canonical cell order", () => {
    expect(FORMATION_FOOTPRINTS).toEqual([
      "single", "row", "column", "cross-short", "cross-full", "all",
    ]);
    expect(footprintCells(4, "single")).toEqual([4]);
    expect(footprintCells(4, "row")).toEqual([3, 4, 5]);
    expect(footprintCells(4, "column")).toEqual([1, 4, 7]);
    expect(footprintCells(4, "cross-short")).toEqual([1, 3, 4, 5, 7]);
    expect(footprintCells(4, "cross-full")).toEqual([1, 3, 4, 5, 7]);
    expect(footprintCells(4, "all")).toEqual(FORMATION_CELLS);
  });

  it("clips a short cross at an edge while a full cross spans its whole row and column", () => {
    expect(footprintCells(0, "cross-short")).toEqual([0, 1, 3]);
    expect(footprintCells(0, "cross-full")).toEqual([0, 1, 2, 3, 6]);
    expect(footprintCells(1, "cross-short")).toEqual([0, 1, 2, 4]);
    expect(footprintCells(1, "cross-full")).toEqual([0, 1, 2, 4, 7]);
    expect(footprintCells(8, "cross-short")).toEqual([5, 7, 8]);
    expect(footprintCells(8, "cross-full")).toEqual([2, 5, 6, 7, 8]);
  });

  it("refuses unknown footprints and out-of-bounds cells", () => {
    expect(() => footprintCells(9, "single")).toThrow("invalid-formation-cell");
    expect(() => footprintCells(-1, "single")).toThrow("invalid-formation-cell");
    expect(() => footprintCells(4, "diamond")).toThrow("invalid-formation-footprint");
  });
});

describe("formation normalization", () => {
  it("places an ordered roster into nine row-major cells by default", () => {
    expect(normalizeFormation(["player", "ally-a", "ally-b"])).toEqual([
      "player", "ally-a", "ally-b",
      null, null, null,
      null, null, null,
    ]);
    expect(normalizeFormation([])).toEqual(Array(9).fill(null));
  });

  it("keeps valid requested cells, prunes stale duplicates, and fills gaps deterministically", () => {
    const preferred = [null, "ally-a", "gone", "ally-a", null, null, null, null, null];
    expect(normalizeFormation(["player", "ally-a", "ally-b"], preferred)).toEqual([
      "player", "ally-a", "ally-b",
      null, null, null,
      null, null, null,
    ]);
  });

  it("preserves current placements when one actor leaves and another joins", () => {
    const previous = [null, "player", null, null, "departed", null, null, null, "ally-a"];
    expect(normalizeFormation(["player", "ally-a", "ally-new"], previous)).toEqual([
      "ally-new", "player", null,
      null, null, null,
      null, null, "ally-a",
    ]);
  });

  it("does not mutate the roster or requested formation", () => {
    const roster = ["player", "ally"];
    const preferred = [null, "ally"];
    const rosterBefore = [...roster];
    const preferredBefore = [...preferred];
    normalizeFormation(roster, preferred);
    expect(roster).toEqual(rosterBefore);
    expect(preferred).toEqual(preferredBefore);
  });

  it("refuses malformed or overfull rosters", () => {
    expect(() => normalizeFormation("player")).toThrow("invalid-formation-actor-ids");
    expect(() => normalizeFormation(["player", "player"])).toThrow("invalid-formation-actor-ids");
    expect(() => normalizeFormation(["player", ""])).toThrow("invalid-formation-actor-ids");
    expect(() => normalizeFormation(Array.from({ length: 10 }, (_, index) => `actor-${index}`)))
      .toThrow("invalid-formation-actor-ids");
    expect(() => normalizeFormation(["player"], {})).toThrow("invalid-formation");
  });
});

describe("formation occupancy", () => {
  const formation = [
    "player", null, "ally-a",
    null, "ally-b", null,
    "ally-c", null, null,
  ];
  const actors = {
    player: { id: "player", hp: 20 },
    "ally-a": { id: "ally-a", hp: 0 },
    "ally-b": { id: "ally-b", hp: 7 },
    // Deliberately omit ally-c: a stale actor map must not invent an occupant.
  };

  it("looks up actors and cells without treating an empty slot as an actor", () => {
    expect(actorAtCell(formation, 0)).toBe("player");
    expect(actorAtCell(formation, 1)).toBeNull();
    expect(cellForActor(formation, "ally-b")).toBe(4);
    expect(cellForActor(formation, "not-fielded")).toBeNull();
  });

  it("returns only living, present actors in cell order", () => {
    expect(livingOccupants(formation, actors)).toEqual([
      { cell: 0, actorId: "player", actor: actors.player },
      { cell: 4, actorId: "ally-b", actor: actors["ally-b"] },
    ]);
    expect(livingActorIds(formation, actors)).toEqual(["player", "ally-b"]);
  });

  it("can restrict occupancy to a footprint and canonicalizes repeated cells", () => {
    expect(livingActorIds(formation, actors, [4, 0, 4])).toEqual(["player", "ally-b"]);
    expect(livingActorIds(formation, actors, footprintCells(0, "cross-full")))
      .toEqual(["player"]);
  });

  it("refuses malformed formations and selections", () => {
    expect(() => actorAtCell(["player"], 0)).toThrow("invalid-formation");
    expect(() => actorAtCell([...formation, "extra"], 0)).toThrow("invalid-formation");
    expect(() => livingActorIds(formation, actors, [9])).toThrow("invalid-formation-cell");
    expect(() => livingActorIds(formation, null)).toThrow("invalid-formation-actors");
  });
});
