import { afterEach, describe, expect, it, vi } from "vitest";
import { BORDER_CHECKPOINTS, LANDMARKS } from "../data/continent.js";
import { ROAD_EVENTS, ROAD_OFFERS, roadEventsWhere } from "../data/road-events.js";
import { makeInitialState } from "../data/initial-state.js";
import { findWorldRoute, getTile } from "./world.js";
import {
  ROAD_EVENT_BASE,
  ROAD_EVENT_CEIL,
  roadEventChance,
  roadEventWhere,
  rollRoadEvent,
} from "./road-events.js";

afterEach(() => { vi.restoreAllMocks(); });

// Generated ground, which is the only ground a road event happens on.
const open = (extra = {}) => ({ procedural: true, terrain: "plains", regionId: "r", ...extra });

// Somewhere well off the map's inhabited country, so `settled` cannot be the
// answer by accident.
const NOWHERE = { x: 4000, y: 4000 };
const village = LANDMARKS.find((l) => ["city", "town", "village", "port"].includes(l.kind));

describe("which table a hex belongs to", () => {
  it("says nothing at all about ground that narrates itself", () => {
    // Handcrafted streets, open water and any site the party arrives at: a road
    // event is what is met between places, not a second thing at one.
    expect(roadEventWhere(null, null, NOWHERE.x, NOWHERE.y)).toBeNull();
    expect(roadEventWhere({ terrain: "street", route: true }, null, NOWHERE.x, NOWHERE.y)).toBeNull();
    expect(roadEventWhere(open({ terrain: "water" }), null, NOWHERE.x, NOWHERE.y)).toBeNull();
    expect(roadEventWhere(open({ route: true, poi: { type: "shrine" } }), null, NOWHERE.x, NOWHERE.y)).toBeNull();
  });

  it("answers for a customs fort before anything else, because one is both", () => {
    // A checkpoint tile is authored ground and carries a poi, so it would fail
    // both exclusions above if it were asked about second.
    const post = BORDER_CHECKPOINTS[0];
    const gate = { terrain: "hills", poi: { type: "fortress" }, checkpoint: post };
    expect(roadEventWhere(gate, null, NOWHERE.x, NOWHERE.y)).toBe("checkpoint");
  });

  it("reads a bridge or a ford off the tile rather than the terrain", () => {
    expect(roadEventWhere(open({ route: true, waterway: "river" }), null, NOWHERE.x, NOWHERE.y)).toBe("crossing");
    expect(roadEventWhere(open({ route: true, crossing: true }), null, NOWHERE.x, NOWHERE.y)).toBe("crossing");
    // Water with no road at it is not a crossing; nobody is standing there.
    expect(roadEventWhere(open({ waterway: "river" }), null, NOWHERE.x, NOWHERE.y)).toBe("wild");
  });

  it("calls it a border only where one authority hands over to another on a road", () => {
    const here = open({ route: true, regionId: "north" });
    expect(roadEventWhere(here, open({ regionId: "south" }), NOWHERE.x, NOWHERE.y)).toBe("border");
    expect(roadEventWhere(here, open({ regionId: "north" }), NOWHERE.x, NOWHERE.y)).toBe("road");
    // The same line off the road is just country: there is no gate to hold.
    expect(roadEventWhere(open({ regionId: "north" }), open({ regionId: "south" }), NOWHERE.x, NOWHERE.y)).toBe("wild");
  });

  it("knows a road working its own country from a road crossing empty ground", () => {
    expect(roadEventWhere(open({ route: true }), null, village.coord.x, village.coord.y)).toBe("settled");
    expect(roadEventWhere(open({ route: true }), null, NOWHERE.x, NOWHERE.y)).toBe("road");
    expect(roadEventWhere(open(), null, NOWHERE.x, NOWHERE.y)).toBe("wild");
  });
});

describe("how often a march carries one", () => {
  it("rises with the ground covered and then stops", () => {
    expect(roadEventChance(0)).toBe(ROAD_EVENT_BASE);
    expect(roadEventChance(-5)).toBe(ROAD_EVENT_BASE);
    expect(roadEventChance(8)).toBeGreaterThan(roadEventChance(4));
    expect(roadEventChance(400)).toBe(ROAD_EVENT_CEIL);
  });
});

describe("the table", () => {
  it("hands back a frozen list per kind of ground, and nothing for ground it has none for", () => {
    expect(roadEventsWhere("nowhere-in-particular")).toEqual([]);
    for (const where of ["road", "crossing", "settled", "border", "wild"]) {
      const list = roadEventsWhere(where);
      expect(list.length).toBeGreaterThan(0);
      expect(Object.isFrozen(list)).toBe(true);
      expect(list.every((e) => e.where === where && ROAD_OFFERS[e.offer])).toBe(true);
    }
    expect(ROAD_EVENTS.filter((e) => e.stops).length).toBeLessThanOrEqual(4);
  });
});

describe("rolling for one", () => {
  const state = makeInitialState();
  const START = state.world.currentTile;

  // A real journey, because the classifier only means anything over ground the
  // planner would actually send a party across.
  const march = LANDMARKS
    .filter((l) => ["city", "town"].includes(l.kind))
    .map((l) => findWorldRoute(state, START, l.coord))
    .find((path) => path && path.length > 20 && !path.some((p) => getTile(state, p.x, p.y).checkpoint));

  it("has a leg long enough to have a middle", () => {
    expect(march?.length).toBeGreaterThan(20);
  });

  it("reports nothing rather than throwing when there is no middle to the leg", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(rollRoadEvent(state, [])).toBeNull();
    expect(rollRoadEvent(state, null)).toBeNull();
    expect(rollRoadEvent(state, [START])).toBeNull();
    expect(rollRoadEvent(state, [START, march[1]])).toBeNull();
  });

  it("does not draw when the leg comes up short of its chance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(rollRoadEvent(state, march.slice(0, 25))).toBeNull();
  });

  it("places whatever it draws on ground that qualifies for it", () => {
    const leg = march.slice(0, 25);
    let drawn = 0;
    for (let i = 0; i < 200; i++) {
      const hit = rollRoadEvent(state, leg);
      if (!hit) continue;
      drawn++;
      const tile = getTile(state, hit.atTile.x, hit.atTile.y);
      const previous = getTile(state, leg[hit.atIndex - 1].x, leg[hit.atIndex - 1].y);
      expect(roadEventWhere(tile, previous, hit.atTile.x, hit.atTile.y)).toBe(hit.event.where);
    }
    expect(drawn).toBeGreaterThan(0);
  });

  it("never puts one on the hex the leg ends at, which the party stops at anyway", () => {
    const leg = march.slice(0, 25);
    for (let i = 0; i < 200; i++) {
      const hit = rollRoadEvent(state, leg);
      if (hit) expect(hit.atIndex).toBeLessThan(leg.length - 1);
    }
  });

  it("halts a march at an authored customs fort without rolling for it", () => {
    // Five staffed forts have sat in the map data with garrisons and controlling
    // factions since it was written, and travel had never read one.
    const post = BORDER_CHECKPOINTS[0];
    const approach = findWorldRoute(state, START, post.coord);
    // Crossing the fort rather than ending at it: the last hex is never eligible.
    const beyond = [...approach, { x: post.coord.x + 1, y: post.coord.y }];

    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const hit = rollRoadEvent(state, beyond);

    expect(hit.event).toMatchObject({ id: `checkpoint:${post.id}`, where: "checkpoint", stops: true });
    expect(hit.event.detail).toContain(post.garrison);
    expect(hit.atTile).toEqual(post.coord);
  });
});
