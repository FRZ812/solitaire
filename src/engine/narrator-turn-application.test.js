import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { compileNarratorCandidate } from "./narrator-turn-compiler.js";
import { buildNarratorProjection, narratorTurnPolicy } from "./narrator-projection.js";
import {
  applyCompiledNarratorPresentation,
  applyCompiledNarratorStoryPresentation,
  applyCompiledNarratorTurn,
} from "./narrator-turn-application.js";

function candidate(projection, overrides = {}) {
  return {
    contract_version: 2,
    state_revision: projection.stateRevision,
    story: [{ type: "beat", cue: { kind: "scene", event: "rain-falls" } }],
    minutes_passed: 0,
    roll: null,
    encounter: null,
    vitality_change: 0,
    resolve_change: 0,
    new_conditions: null,
    tile_discovery: null,
    tile_move: null,
    start_combat: null,
    assassination: null,
    location_update: null,
    discoveries: null,
    inventory_changes: null,
    knowledge_updates: null,
    attribute_changes: null,
    needs_changes: null,
    recruit_companion: null,
    grant_mount: null,
    buy_mount: null,
    purchase_captive: null,
    purchase_rights: null,
    part_ways: null,
    party_removals: null,
    companion_gear: null,
    relationship_changes: null,
    memory_updates: null,
    progression_focus: null,
    character_setup: null,
    player_update: null,
    ...overrides,
  };
}

function compileTurn(
  state,
  turnPolicy = { id: "presentation", allowedEffects: [] },
  overrides = {},
  metadata = {},
) {
  const projection = buildNarratorProjection(state);
  const result = compileNarratorCandidate({
    candidate: candidate(projection, overrides),
    projection,
    turnPolicy,
    metadata,
  });
  expect(result.ok).toBe(true);
  return result.turn;
}

describe("compiled narrator turn application", () => {
  it("rejects an uncompiled turn before the mechanics reducer can see it", () => {
    expect(() => applyCompiledNarratorTurn(makeInitialState(), { story: [] }))
      .toThrow("Refusing to apply an uncompiled narrator turn.");
  });

  it("allows a genuinely compiled turn through a presentation-only applicator exactly once", () => {
    const state = makeInitialState();
    const turn = compileTurn(state);
    const applyPresentation = vi.fn(() => ({ marker: "presented" }));

    expect(applyCompiledNarratorPresentation(state, turn, applyPresentation))
      .toEqual({ marker: "presented" });
    expect(applyPresentation).toHaveBeenCalledWith(state, turn);
    expect(() => applyCompiledNarratorPresentation(state, turn, applyPresentation))
      .toThrow("already been consumed");
  });

  it("can verify a presentation turn against its generation state before rendering a deterministic settlement", () => {
    const generationState = makeInitialState();
    const turn = compileTurn(generationState);
    const settledState = {
      ...generationState,
      time: { ...generationState.time, minute: (generationState.time.minute || 0) + 5 },
    };
    const applyPresentation = vi.fn((state) => ({ ...state, marker: "presented" }));

    expect(applyCompiledNarratorPresentation(
      settledState,
      turn,
      applyPresentation,
      generationState,
    )).toMatchObject({ marker: "presented", time: settledState.time });
    expect(applyPresentation).toHaveBeenCalledWith(settledState, turn);
  });

  it("applies combat aftermath through a story-only path that cannot touch canonical mechanics", () => {
    const state = { ...makeInitialState(), memories: ["Canonical memory."] };
    const turn = compileTurn(
      state,
      { id: "combat-aftermath", allowedEffects: [] },
      {},
      { memories: ["The player agrees to surrender."], userMsg: "settled aftermath", raw: "{}" },
    );

    const next = applyCompiledNarratorStoryPresentation(state, turn);

    expect(next.character).toBe(state.character);
    expect(next.world).toBe(state.world);
    expect(next.time).toBe(state.time);
    expect(next.party).toBe(state.party);
    expect(next.memories).toEqual(["Canonical memory."]);
    expect(next.beats.at(-1)).toMatchObject({ type: "narration", content: "Rain falls across the scene." });
    expect(next.apiHistory.slice(-2)).toEqual([
      { role: "user", content: "settled aftermath" },
      { role: "assistant", content: "{}" },
    ]);
  });

  it("deep-freezes compiled output before application", () => {
    const state = makeInitialState();
    const turn = compileTurn(state);

    expect(Object.isFrozen(turn)).toBe(true);
    expect(Object.isFrozen(turn.story)).toBe(true);
    expect(Object.isFrozen(turn.story[0])).toBe(true);
    expect(() => { turn.inventory_changes = { added: [{ itemId: "hardtack", quantity: 99 }] }; })
      .toThrow();
  });

  it("applies an exactly guarded narrator assassination death without starting combat", () => {
    const state = makeInitialState();
    const current = state.world.currentTile;
    state.created = true;
    state.character = {
      ...state.character,
      attributes: { body: 12, reflex: 16, vigor: 10, mind: 4, wit: 14, presence: 4 },
      proficiencies: { ...(state.character.proficiencies || {}), ambush: 600 },
      abilities: [{ id: "execute", tier: "rare" }],
    };
    state.world.codex.characters.wanderer = {
      ...state.world.codex.characters.wanderer,
      attributes: { ...state.character.attributes },
      proficiencies: { ...state.character.proficiencies },
      abilities: [...state.character.abilities],
    };
    state.world.codex.characters.mark = {
      id: "mark",
      kind: "npc",
      name: "The Mark",
      race: "human",
      level: 1,
      attributes: { body: 1, reflex: 1, vigor: 1, mind: 1, wit: 1, presence: 1 },
      proficiencies: {},
      abilities: [],
      innatePassives: [],
      worn: [],
      ridingOn: "horse",
      at: { x: current.x, y: current.y, day: state.time.day },
    };
    state.world.codex.characters.horse = {
      id: "horse",
      kind: "mount",
      name: "Horse",
      riders: ["mark"],
    };
    const turn = compileTurn(
      state,
      narratorTurnPolicy("I assassinate the mark.", state),
      {
        story: [{
          type: "beat",
          cue: { kind: "character", actor_id: "mark", action: "dies", target_id: null, manner: null },
        }],
        assassination: {
          target_id: "mark", method: "basic", outcome: "killed", surprise: null,
        },
      },
    );

    const next = applyCompiledNarratorTurn(state, turn);

    expect(next).not.toHaveProperty("combat");
    expect(next.world.codex.characters.mark).toMatchObject({
      deathDay: state.time.day,
      ridingOn: null,
      combatState: { health: 0, status: "dead" },
    });
    expect(next.world.codex.characters.horse.riders).toEqual([]);
    expect(next.beats).toContainEqual(expect.objectContaining({ content: "The Mark dies." }));
  });

  it("rejects a compiled turn against a different authoritative state revision", () => {
    const state = makeInitialState();
    const turn = compileTurn(state);
    const changed = { ...state, time: { ...state.time, minute: (state.time.minute || 0) + 1 } };

    expect(() => applyCompiledNarratorTurn(changed, turn)).toThrow("state revision");
  });

  it("persists and then clears compiler-bound multi-turn route authority", () => {
    const state = makeInitialState();
    const effectConstraints = { buy_mount: { fields: { id: "horse" } } };
    const policy = {
      id: "mount-negotiation",
      allowedEffects: ["buy_mount"],
      effectConstraints,
      continuation: { terminalEffect: "buy_mount" },
    };
    const opening = compileTurn(state, policy);
    const continuedState = applyCompiledNarratorTurn(state, opening);
    expect(continuedState.narratorTurnContinuation).toEqual({
      route: "mount-negotiation",
      effectConstraints,
    });

    const settlement = {
      buy_mount: {
        id: "horse",
        priceCp: 0,
        name: "Ash",
        settlement: "gift",
        settlementNote: "The stablemaster grants the horse.",
      },
    };
    const declinedTurn = compileTurn(continuedState, policy, settlement);
    const acceptedTurn = compileTurn(continuedState, policy, settlement);

    const declinedState = applyCompiledNarratorTurn(continuedState, declinedTurn);
    expect(declinedState.party).not.toContain("horse");
    expect(declinedState).not.toHaveProperty("narratorTurnContinuation");

    const acceptedState = applyCompiledNarratorTurn(
      continuedState,
      acceptedTurn,
      { acceptTerminalEffect: true },
    );
    expect(acceptedState.party).toContain("horse");
    expect(acceptedState).not.toHaveProperty("narratorTurnContinuation");
  });

  it("does not persist unrestricted model-authored memory metadata", () => {
    const state = { ...makeInitialState(), memories: ["An engine-authored fact."] };
    const turn = compileTurn(
      state,
      { id: "general-action", allowedEffects: [] },
      {},
      { memories: ["The player silently consents to the bargain."] },
    );

    const next = applyCompiledNarratorTurn(state, turn);

    expect(next.memories).toEqual(["An engine-authored fact."]);
  });

  it("rejects uncompiled presentation before invoking its applicator", () => {
    const applyPresentation = vi.fn();

    expect(() => applyCompiledNarratorPresentation({}, { story: [] }, applyPresentation))
      .toThrow("Refusing to present an uncompiled narrator turn.");
    expect(applyPresentation).not.toHaveBeenCalled();
  });
});
