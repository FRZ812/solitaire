import { describe, expect, it } from "vitest";
import { CONTINENT, REGION_DEFINITIONS } from "../data/continent.js";
import { makeInitialState } from "../data/initial-state.js";
import { getTile } from "./world.js";
import { recordTurn, stateBeforeTurn } from "./timeline.js";
import {
  applyTravelNarrationPresentation,
  authoritativeTravelDiscovery,
  deterministicTravelBeat,
  prepareTravelSettlement,
  publicTravelLocationName,
  replayTravelSettlement,
} from "./travel-settlement.js";

function fixture({ minutes = 0 } = {}) {
  const base = makeInitialState();
  const start = { ...base.world.currentTile };
  const dest = { x: start.x + 1, y: start.y };
  const playerBeat = { id: "travel-player", type: "player", content: "Travel onward." };
  const prepared = {
    ...base,
    beats: [...base.beats, playerBeat],
  };
  return {
    base,
    prepared,
    travel: {
      fromName: "Departure",
      toName: "Arrival",
      dest,
      path: [start, dest],
      totalMins: minutes,
      mode: "ground",
      encounter: null,
    },
  };
}

function withTravelActors(state) {
  const characters = {
    ...state.world.codex.characters,
    caster: { id: "caster", name: "Caster", resolve: 12, needs: { hunger: 10, thirst: 10, sleep: 10 } },
    gryphon: { id: "gryphon", name: "Gryphon", resolve: 0, needs: { hunger: 20, thirst: 15, sleep: 30 } },
  };
  const playerResolve = Math.max(1, state.character.resolveMax || state.character.resolve || 1);
  return {
    ...state,
    character: { ...state.character, resolve: playerResolve },
    world: { ...state.world, codex: { ...state.world.codex, characters } },
  };
}

describe("canonical immediate travel settlement", () => {
  it("derives an authoritative reveal for an authored hidden destination", () => {
    const tile = {
      terrain: "indoor",
      poi: {
        type: "hidden",
        name: "Hidden Chapel",
        description: "A sealed chapel under the ward.",
        revealType: "temple",
      },
    };
    const discovery = authoritativeTravelDiscovery(tile);
    expect(discovery).toEqual({
      name: "Hidden Chapel",
      poi_type: "temple",
      description: "A sealed chapel under the ward.",
    });
    expect(deterministicTravelBeat({}, { totalMins: 12, discovery })).toMatchObject({
      minutes_passed: 12,
      tile_discovery: discovery,
    });
  });

  it("merges player, companion, and flying-mount costs exactly once", () => {
    const initial = fixture();
    const base = withTravelActors(initial.base);
    const preparedActors = base.world.codex.characters;
    const prepared = {
      ...initial.prepared,
      character: { ...base.character, resolve: base.character.resolve - 3 },
      world: {
        ...base.world,
        codex: {
          ...base.world.codex,
          characters: {
            ...preparedActors,
            caster: { ...preparedActors.caster, resolve: 8 },
            gryphon: {
              ...preparedActors.gryphon,
              needs: { ...preparedActors.gryphon.needs, hunger: 27, sleep: 35 },
            },
          },
        },
      },
    };

    const result = prepareTravelSettlement(base, base, prepared, initial.travel);

    expect(result.state.character.resolve).toBe(base.character.resolve - 3);
    expect(result.state.world.codex.characters.caster.resolve).toBe(8);
    expect(result.state.world.codex.characters.gryphon.needs).toMatchObject({ hunger: 27, sleep: 35 });
    expect(result.checkpointBase.character.resolve).toBe(base.character.resolve);
    expect(result.checkpointBase.world.codex.characters.caster.resolve).toBe(12);
    expect(result.checkpointBase.world.codex.characters.gryphon.needs).toMatchObject({ hunger: 20, sleep: 30 });
  });

  it("advances canonical time and lands before narration exists", () => {
    const { base, prepared, travel } = fixture({ minutes: 95 });
    const narrationCount = prepared.beats.filter((beat) => beat.type === "narration").length;

    const result = prepareTravelSettlement(base, base, prepared, travel);

    expect(result.state.world.currentTile).toEqual(travel.dest);
    expect(result.state.world.tiles[`${travel.dest.x},${travel.dest.y}`]).toBeDefined();
    expect(result.state.time).not.toEqual(base.time);
    expect(result.state.beats.some((beat) => beat.type === "travel_card" && beat.mins === 95)).toBe(true);
    expect(result.state.beats.filter((beat) => beat.type === "narration")).toHaveLength(narrationCount);
  });

  it("uses deterministic authored identity for a hidden generated destination", () => {
    const { base, prepared, travel: nearbyTravel } = fixture();
    const center = REGION_DEFINITIONS.mire.sites[0];
    let hidden = null;
    for (let y = center.y - CONTINENT.chunkSize; y <= center.y + CONTINENT.chunkSize && !hidden; y += 1) {
      for (let x = center.x - CONTINENT.chunkSize; x <= center.x + CONTINENT.chunkSize; x += 1) {
        const tile = getTile(base, x, y);
        if (tile.poi?.type === "hidden" && tile.poi.generated) {
          hidden = { x, y, tile };
          break;
        }
      }
    }
    expect(hidden).toBeTruthy();
    const dest = { x: hidden.x, y: hidden.y };
    const travel = {
      ...nearbyTravel,
      dest,
      path: [nearbyTravel.path[0], dest],
    };
    const generated = hidden.tile.poi.generated;

    expect(publicTravelLocationName(hidden.tile, travel.dest)).not.toContain(generated.name);
    const result = prepareTravelSettlement(base, base, prepared, travel);
    expect(result.state.world.tiles[`${travel.dest.x},${travel.dest.y}`].poi).toMatchObject({
      type: generated.poiType,
      name: generated.name,
      description: generated.description,
    });
  });
});

describe("late travel narration", () => {
  it("adds presentation/history without replaying narrator mechanics", () => {
    const { base, prepared, travel } = fixture({ minutes: 60 });
    const { state: settled } = prepareTravelSettlement(base, base, prepared, travel);
    const before = {
      time: settled.time,
      tile: settled.world.currentTile,
      resolve: settled.character.resolve,
      needs: settled.character.needs,
    };

    const narrated = applyTravelNarrationPresentation(settled, {
      story: [{ type: "beat", text: "The road settles behind you." }],
      minutes_passed: 999,
      resolve_change: -99,
      tile_move: { x: 999, y: 999 },
      inventory_changes: { coins: { gold: 999 } },
      _userMsg: "travel prompt",
      _raw: "raw narrator response",
    });

    expect(narrated.time).toBe(before.time);
    expect(narrated.world.currentTile).toBe(before.tile);
    expect(narrated.character.resolve).toBe(before.resolve);
    expect(narrated.character.needs).toBe(before.needs);
    expect(narrated.beats.at(-1)).toMatchObject({ type: "narration", content: "The road settles behind you." });
    expect(narrated.apiHistory.slice(-2)).toEqual([
      { role: "user", content: "travel prompt" },
      { role: "assistant", content: "raw narrator response" },
    ]);
  });

  it("records a true pre-travel checkpoint while keeping the player bubble", () => {
    const initial = fixture({ minutes: 40 });
    const base = withTravelActors(initial.base);
    const playerBeat = initial.prepared.beats.at(-1);
    const prepared = {
      ...base,
      character: { ...base.character, resolve: base.character.resolve - 3 },
      beats: [...base.beats, playerBeat],
    };
    const { state: settled, checkpointBase, preparedDelta } = prepareTravelSettlement(base, base, prepared, initial.travel);
    const narrated = applyTravelNarrationPresentation(settled, {
      story: [{ type: "beat", text: "Arrival." }],
      _userMsg: "travel prompt",
      _raw: "travel response",
    });
    const recordedTravel = { ...initial.travel, preparedDelta };
    const recorded = recordTurn(checkpointBase, "travel prompt", narrated, { travel: recordedTravel });
    const rewound = stateBeforeTurn(recorded, recorded.turns.length - 1);

    expect(rewound.world.currentTile).toEqual(base.world.currentTile);
    expect(rewound.time).toEqual(base.time);
    expect(rewound.character.resolve).toBe(base.character.resolve);
    expect(rewound.beats.at(-1)).toEqual(playerBeat);

    const rewritten = replayTravelSettlement(rewound, recordedTravel);
    expect(rewritten.character.resolve).toBe(base.character.resolve - 3);
    expect(rewritten.world.currentTile).toEqual(initial.travel.dest);
    expect(rewritten.time).toEqual(settled.time);
  });
});
