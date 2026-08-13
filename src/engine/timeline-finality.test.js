// Rewriting the telling is not the same as undoing the thing.
//
// A checkpoint restores the character, the world and the story. It deliberately does not
// restore settlement receipts, the durable build, readiness, or a permanent death — those
// are irreversible by design. That asymmetry is the danger: rewinding the codex past a
// fight while its settlement receipt stays put would resurrect a foe the world still records
// as dead, and every other irreversible receipt has the same shape.
//
// The plan names the failures this has to prevent by name. Each one is below.

import { describe, expect, it } from "vitest";
import {
  canRewindToTurn,
  mechanicsSeal,
  startTurnCheckpoint,
  stateBeforeTurn,
} from "./timeline.js";

function baseState(overrides = {}) {
  return {
    character: { name: "Wanderer", vitality: 20 },
    party: [],
    memories: [],
    created: true,
    time: { day: 1, hour: 9, minute: 0 },
    world: {
      currentTile: { x: 0, y: 0 },
      codex: { characters: { hale: { id: "hale", combatState: { status: "ok" } } } },
      seen: {},
      tiles: {},
    },
    beats: [{ id: "b0", type: "narration", content: "Opening." }],
    apiHistory: [],
    turns: [],
    pools: { codex: [], seen: [], tiles: [] },
    combatSettlementReceipts: [],
    presentationJobs: [],
    mechanics: { version: 1, bootstrapId: null, build: null, tow: { activeCombat: null, readiness: {} } },
    ended: false,
    ...overrides,
  };
}

/** Take a turn, so there is a checkpoint to try to rewind to. */
function withTurn(state, next = {}) {
  const after = {
    ...state,
    ...next,
    beats: [...state.beats, { id: `b${state.beats.length}`, type: "narration", content: "A turn." }],
  };
  return startTurnCheckpoint(state, "the player said something", after);
}

describe("the seal reads the facts that cannot be undone", () => {
  it("moves when a fight settles", () => {
    const before = mechanicsSeal(baseState());
    const after = mechanicsSeal(baseState({ combatSettlementReceipts: [{ sessionId: "s1" }] }));
    expect(after).not.toEqual(before);
  });

  it("moves when a character is bootstrapped", () => {
    const after = mechanicsSeal(baseState({
      mechanics: { version: 1, bootstrapId: "0123456789abcdef", build: {}, tow: {} },
    }));
    expect(after.bootstrapId).toBe("0123456789abcdef");
  });

  it("moves when the run ends", () => {
    expect(mechanicsSeal(baseState({ ended: true })).ended).toBe(true);
  });

  it("moves when one fight ends and another begins", () => {
    const first = mechanicsSeal(baseState({
      mechanics: { tow: { activeCombat: { sessionId: "combat-1" } } },
    }));
    const second = mechanicsSeal(baseState({
      mechanics: { tow: { activeCombat: { sessionId: "combat-2" } } },
    }));
    expect(second).not.toEqual(first);
  });

  it("does not move for prose, time, or travel", () => {
    const before = mechanicsSeal(baseState());
    const after = mechanicsSeal(baseState({
      beats: [{ id: "x", type: "narration", content: "Much later." }],
      time: { day: 9, hour: 3, minute: 0 },
      world: { currentTile: { x: 12, y: 4 }, codex: {}, seen: {}, tiles: {} },
    }));
    expect(after).toEqual(before);
  });
});

describe("what rewind refuses", () => {
  it("allows a rewind that crosses nothing irreversible", () => {
    const state = withTurn(baseState());
    expect(canRewindToTurn(state, 0)).toMatchObject({ ok: true });
  });

  it("cannot resurrect a foe the world records as dead", () => {
    // The headline failure: the checkpoint's codex has Hale alive, and the settlement that
    // killed him is not in the checkpoint at all.
    let state = withTurn(baseState());
    state = {
      ...state,
      combatSettlementReceipts: [{ sessionId: "combat-1", outcome: "victory" }],
      world: {
        ...state.world,
        codex: { characters: { hale: { id: "hale", combatState: { status: "dead" } } } },
      },
    };
    expect(canRewindToTurn(state, 0))
      .toMatchObject({ ok: false, reason: "crosses-irreversible-mechanics" });
    // And the reconstruction really would have brought him back, which is why it is refused.
    expect(stateBeforeTurn(state, 0).world.codex.characters.hale.combatState.status).toBe("ok");
  });

  it("cannot refund readiness a fight spent", () => {
    let state = withTurn(baseState());
    state = {
      ...state,
      combatSettlementReceipts: [{ sessionId: "combat-1" }],
      mechanics: { ...state.mechanics, tow: { activeCombat: null, readiness: { block: 4 } } },
    };
    expect(canRewindToTurn(state, 0).ok).toBe(false);
  });

  it("cannot erase a permanent death", () => {
    let state = withTurn(baseState());
    state = { ...state, ended: true };
    expect(canRewindToTurn(state, 0).ok).toBe(false);
  });

  it("cannot roll back across a character bootstrap", () => {
    let state = withTurn(baseState());
    state = {
      ...state,
      mechanics: { ...state.mechanics, bootstrapId: "0123456789abcdef", build: {} },
    };
    expect(canRewindToTurn(state, 0).ok).toBe(false);
  });

  it("cannot re-enter a fight that has since ended", () => {
    let state = withTurn(baseState({
      mechanics: { version: 1, bootstrapId: null, build: null, tow: { activeCombat: { sessionId: "combat-1" } } },
    }));
    state = {
      ...state,
      combatSettlementReceipts: [{ sessionId: "combat-1" }],
      mechanics: { ...state.mechanics, tow: { activeCombat: null } },
    };
    expect(canRewindToTurn(state, 0).ok).toBe(false);
  });

  it("still allows rewinding a purely narrative turn after one that settled", () => {
    // The boundary is where the mechanic changed, not everything after it. A player who
    // fights and then talks for three turns can still rewrite the talking.
    let state = withTurn(baseState());
    state = { ...state, combatSettlementReceipts: [{ sessionId: "combat-1" }] };
    state = withTurn(state);
    expect(canRewindToTurn(state, 1)).toMatchObject({ ok: true });
    expect(canRewindToTurn(state, 0).ok).toBe(false);
  });
});

describe("saves that predate the seal", () => {
  it("are rewindable rather than refused", () => {
    // A checkpoint with no seal predates combat being durable at all, so there is nothing it
    // could be crossing. Refusing them would break every existing campaign.
    const state = withTurn(baseState());
    const legacy = {
      ...state,
      turns: state.turns.map(({ mechanicsSeal: _seal, ...rest }) => rest),
      combatSettlementReceipts: [{ sessionId: "combat-1" }],
    };
    expect(canRewindToTurn(legacy, 0)).toMatchObject({ ok: true });
  });

  it("refuse a turn that does not exist", () => {
    expect(canRewindToTurn(baseState(), 3)).toMatchObject({ ok: false, reason: "unknown-turn" });
  });
});
