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
    state,
    metadata,
  });
  expect(result.ok, JSON.stringify(result.violations || [])).toBe(true);
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

  it("keeps a closed character action's portrait actor on the story-only path", () => {
    const state = makeInitialState();
    const turn = compileTurn(
      state,
      { id: "presentation", allowedEffects: [] },
      {
        story: [{
          type: "beat",
          cue: {
            kind: "character",
            actor_id: "threshold-voice",
            action: "waits",
            target_id: null,
            manner: "quietly",
          },
        }],
      },
    );

    const next = applyCompiledNarratorStoryPresentation(state, turn);

    expect(next.beats.at(-1)).toMatchObject({
      type: "narration",
      actorId: "threshold-voice",
      content: "The Threshold Voice waits quietly.",
    });
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

  it("applies effects admitted by the compiler-bound route instead of a stale second allowlist", () => {
    const state = makeInitialState();
    const policy = { id: "loot-fallout", allowedEffects: ["discoveries"] };
    const turn = compileTurn(state, policy, {
      discoveries: {
        characters: [],
        races: [{
          id: "river-folk",
          name: "River Folk",
          appearance: "Reed-cloaked travelers",
          description: "People of the lower river.",
        }],
        items: [],
        spells: [],
        skills: [],
      },
    });

    const next = applyCompiledNarratorTurn(state, turn);

    expect(next).not.toHaveProperty("lastIntentRefusals");
    expect(next.world.codex.races["river-folk"]).toMatchObject({ name: "River Folk" });
  });

  it("refuses a memory the model tried to author in its own response body", () => {
    // The only channel a memory may arrive through is the `remember` tool, which the Edge
    // validates before streaming. A field in the JSON body is the model writing straight to
    // storage, and the unknown-key rule refuses it outright.
    const state = { ...makeInitialState(), memories: ["An engine-authored fact."] };
    expect(() => compileTurn(
      state,
      { id: "general-action", allowedEffects: [] },
      { _memories: ["The player silently consents to the bargain."] },
      null,
    )).toThrow();
  });

  it("persists only the typed proposal the tool channel recorded", () => {
    // This was broken and silent: the compiler never picked memories out of its metadata, so
    // `beat._memories` was always undefined and every fact the `remember` tool recorded
    // merged into nothing. The tool was writing to a channel that ended one object short of
    // campaign state.
    const state = { ...makeInitialState(), memories: ["An engine-authored fact."] };
    const turn = compileTurn(
      state,
      { id: "general-action", allowedEffects: [] },
      {},
      {
        memories: ["arbitrary compatibility text"],
        memoryProposals: [{
          kind: "person",
          subjectIds: ["wanderer"],
          scopeIds: ["campaign"],
          text: "The ferryman owes the player passage.",
          evidence: [],
        }],
      },
    );

    const next = applyCompiledNarratorTurn(state, turn);

    expect(next.memories).toEqual([
      "An engine-authored fact.",
      "The ferryman owes the player passage.",
    ]);
  });

  it("rejects uncompiled presentation before invoking its applicator", () => {
    const applyPresentation = vi.fn();

    expect(() => applyCompiledNarratorPresentation({}, { story: [] }, applyPresentation))
      .toThrow("Refusing to present an uncompiled narrator turn.");
    expect(applyPresentation).not.toHaveBeenCalled();
  });
});

describe("the typed memory bank", () => {
  function proposal(overrides = {}) {
    return {
      kind: "person",
      subjectIds: ["wanderer"],
      scopeIds: ["campaign"],
      text: "The wanderer never pays the toll twice.",
      evidence: [{ kind: "turn", id: "turn-1" }],
      ...overrides,
    };
  }

  it("grows alongside the flat list rather than replacing it", () => {
    // Every existing consumer keeps reading `memories`; the bank gains what a string cannot
    // carry — who it is about, and whether it is a belief or something that happened.
    const state = { ...makeInitialState(), memories: [] };
    const turn = compileTurn(
      state,
      { id: "general-action", allowedEffects: [] },
      {},
      { memories: ["The wanderer never pays the toll twice."], memoryProposals: [proposal()] },
    );

    const next = applyCompiledNarratorTurn(state, turn);

    expect(next.memories).toEqual(["The wanderer never pays the toll twice."]);
    expect(next.memoryBank).toHaveLength(1);
    expect(next.memoryBank[0]).toMatchObject({
      kind: "person",
      subjectIds: ["wanderer"],
      status: "active",
      pinned: false,
    });
  });

  it("mints what the model is not allowed to choose", () => {
    const state = { ...makeInitialState(), memories: [] };
    const turn = compileTurn(
      state,
      { id: "general-action", allowedEffects: [] },
      {},
      // A proposal trying to set its own weight, permanence and identity.
      { memoryProposals: [{ ...proposal(), salience: 100, pinned: true, id: "chosen" }] },
    );

    const record = applyCompiledNarratorTurn(state, turn).memoryBank[0];
    expect(record.id).not.toBe("chosen");
    expect(record.pinned).toBe(false);
    expect(record.salience).toBeLessThan(100);
  });

  it("refuses a memory about someone the world has never heard of before application", () => {
    // The same rule the gateway applies to knowledge_updates, wherever a name arrives.
    const state = { ...makeInitialState(), memories: [] };
    const projection = buildNarratorProjection(state);
    const result = compileNarratorCandidate({
      candidate: candidate(projection),
      projection,
      turnPolicy: { id: "general-action", allowedEffects: [] },
      state,
      metadata: { memoryProposals: [proposal({ subjectIds: ["someone-invented"] })] },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "MEMORY_PROVENANCE", path: "/_memoryProposals/0" }),
      ]),
    });
    expect(state.memoryBank).toBeUndefined();
  });

  it("types old string memories on first touch rather than in a migration pass", () => {
    // A campaign that never records another memory never needs converting; one that does
    // gets its history typed at the moment it first matters.
    const state = { ...makeInitialState(), memories: ["The player burned the bridge."] };
    const turn = compileTurn(
      state,
      { id: "general-action", allowedEffects: [] },
      {},
      { memoryProposals: [proposal()] },
    );

    const bank = applyCompiledNarratorTurn(state, turn).memoryBank;
    const legacy = bank.find((entry) => entry.summary === "The player burned the bridge.");
    expect(legacy.kind).toBe("event");
    // Honest about provenance: trusted before there was a way to check is not the same as
    // having been checked.
    expect(legacy.evidence[0].kind).toBe("legacy-canonical");
  });
});
