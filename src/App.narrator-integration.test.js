import { describe, expect, it } from "vitest";
import * as App from "./App.jsx";
import { makeInitialState } from "./data/initial-state.js";
import { buildNarratorProjection } from "./engine/narrator-projection.js";
import {
  compileNarratorCandidate,
  NARRATOR_RESPONSE_KEYS,
} from "./engine/narrator-turn-compiler.js";
import { readPendingCombatHandoff } from "./gameplay/production/pending-directive.js";

function requestFixture(baseState, overrides = {}) {
  return {
    id: 7,
    campaignId: "campaign-a",
    userId: "user-a",
    baseState,
    stateRevision: buildNarratorProjection(baseState).stateRevision,
    ...overrides,
  };
}

function freshnessInput(overrides = {}) {
  const baseState = overrides.baseState || makeInitialState();
  const request = overrides.request || requestFixture(baseState);
  return {
    request,
    activeRequest: request,
    currentCampaignId: "campaign-a",
    currentUserId: "user-a",
    currentState: baseState,
    response: { _stateRevision: request.stateRevision },
    ...overrides,
    baseState: undefined,
  };
}

describe("App narrator result integration", () => {
  it("requires an engine-owned confirmation for narrator-proposed terminal transactions", () => {
    expect(App.narratorTerminalEffectConfirmation(
      { route: "mount-negotiation" },
      { buy_mount: { id: "horse", priceCp: 450, settlement: "coin" } },
    )).toEqual({
      title: "Confirm mount transaction",
      body: "Apply the proposed buy mount for horse? Exact price: 450 copper. Settlement: coin.",
      confirmLabel: "Accept",
    });
    expect(App.narratorTerminalEffectConfirmation(
      { route: "general-action" },
      { buy_mount: { id: "horse", priceCp: 450 } },
    )).toBeNull();
  });

  it("runs an ordinary narrator result through the compiled-turn trust gate", () => {
    const base = makeInitialState();

    expect(() => App.applyNarratorTurnResult(
      base,
      "[PLAYER ACTION] Wait.",
      { story: [] },
      base,
    )).toThrow("Refusing to apply an uncompiled narrator turn.");
  });

  it("applies a compiled ordinary turn and checkpoints its exact policy", () => {
    const base = makeInitialState();
    const policyOptions = {
      route: "mount-negotiation",
      effectConstraints: { buy_mount: { fields: { id: "ash-runner" } } },
    };
    const projection = buildNarratorProjection(base);
    const candidate = Object.fromEntries(NARRATOR_RESPONSE_KEYS.map((key) => [key, null]));
    Object.assign(candidate, {
      contract_version: projection.contractVersion,
      state_revision: projection.stateRevision,
      story: [{ type: "beat", cue: { kind: "scene", event: "fire-crackles" } }],
      minutes_passed: 0,
      vitality_change: 0,
      resolve_change: 0,
    });
    const compiled = compileNarratorCandidate({
      candidate,
      projection,
      turnPolicy: {
        id: policyOptions.route,
        allowedEffects: ["buy_mount"],
        effectConstraints: policyOptions.effectConstraints,
      },
    });
    expect(compiled.ok).toBe(true);

    const result = App.applyNarratorTurnResult(base, "mount prompt", compiled.turn, base, { policyOptions });

    expect(result.beats.at(-1)).toMatchObject({
      type: "narration",
      content: "A nearby fire crackles.",
    });
    expect(result.turns.at(-1).policyOptions).toEqual(policyOptions);
  });

  it("uses a presentation-only applicator for settled combat aftermath", () => {
    const base = { ...makeInitialState(), created: true, memories: ["Canonical fact."] };
    const projection = buildNarratorProjection(base);
    const candidate = Object.fromEntries(NARRATOR_RESPONSE_KEYS.map((key) => [key, null]));
    Object.assign(candidate, {
      contract_version: projection.contractVersion,
      state_revision: projection.stateRevision,
      story: [{ type: "beat", cue: { kind: "scene", event: "rain-falls" } }],
      minutes_passed: 0,
      vitality_change: 0,
      resolve_change: 0,
    });
    const compiled = compileNarratorCandidate({
      candidate,
      projection,
      turnPolicy: { id: "combat-aftermath", allowedEffects: [] },
    });
    expect(compiled.ok).toBe(true);

    const result = App.applyNarratorTurnResult(base, "settled combat", compiled.turn, base, {
      policyOptions: { route: "combat-aftermath" },
    });

    expect(result.character).toBe(base.character);
    expect(result.world).toBe(base.world);
    expect(result.time).toBe(base.time);
    expect(result.memories).toEqual(["Canonical fact."]);
    expect(result.beats.at(-1)).toMatchObject({
      type: "narration",
      content: "Rain falls across the scene.",
    });
  });

  it("hands a guarded detected assassination to combat without killing the canonical target", () => {
    const base = makeInitialState();
    const current = base.world.currentTile;
    base.created = true;
    base.character = {
      ...base.character,
      attributes: { body: 12, reflex: 16, vigor: 10, mind: 4, wit: 14, presence: 4 },
      proficiencies: { ...(base.character.proficiencies || {}), ambush: 600 },
    };
    base.world.codex.characters.wanderer = {
      ...base.world.codex.characters.wanderer,
      attributes: { ...base.character.attributes },
      proficiencies: { ...base.character.proficiencies },
    };
    base.world.codex.characters.mark = {
      id: "mark",
      kind: "npc",
      name: "The Mark",
      race: "human",
      level: 1,
      tier: "rare",
      attributes: { body: 1, reflex: 1, vigor: 1, mind: 1, wit: 1, presence: 1 },
      proficiencies: {},
      abilities: [],
      innatePassives: [],
      worn: [],
      at: { x: current.x, y: current.y, day: base.time.day },
    };
    const projection = buildNarratorProjection(base);
    const candidate = Object.fromEntries(NARRATOR_RESPONSE_KEYS.map((key) => [key, null]));
    Object.assign(candidate, {
      contract_version: projection.contractVersion,
      state_revision: projection.stateRevision,
      story: [{ type: "beat", cue: { kind: "scene", event: "silence-settles" } }],
      minutes_passed: 0,
      vitality_change: 0,
      resolve_change: 0,
      assassination: {
        target_id: "mark", method: "basic", outcome: "detected-combat", surprise: true,
      },
    });
    const compiled = compileNarratorCandidate({
      candidate,
      projection,
      turnPolicy: { id: "general-action", allowedEffects: ["assassination"] },
    });
    expect(compiled.ok).toBe(true);

    const result = App.applyNarratorTurnResult(base, "attempt", compiled.turn, base);

    expect(result.world.codex.characters.mark).not.toHaveProperty("deathDay");
    expect(result).not.toHaveProperty("lastIntentRefusals");
    expect(App.narratorCombatHandoff(compiled.turn)).toEqual({
      mode: "immediate",
      directive: compiled.turn.start_combat,
    });
    expect(compiled.turn.start_combat.foes).toEqual([
      { npc_id: "mark", kind: "npc", name: "The Mark", tier: "rare", count: 1 },
    ]);
    const staged = App.stageImmediateCombatHandoff(
      result,
      compiled.turn.start_combat,
      "campaign-a",
    );
    expect(staged.ok).toBe(true);
    expect(staged.state.pendingCombatDirective).toBeTruthy();
    expect(readPendingCombatHandoff(staged.state.pendingCombatDirective, {
      campaignId: "campaign-a",
      state: staged.state,
    }).ok).toBe(true);
    expect(result.pendingCombatDirective).toBe(null);
  });

  it("accepts only the active request for the same user, campaign, revision, and state", () => {
    expect(App.isNarratorRequestFresh(freshnessInput())).toBe(true);

    const baseState = makeInitialState();
    const request = requestFixture(baseState);
    expect(App.isNarratorRequestFresh(freshnessInput({
      baseState,
      request,
      activeRequest: { ...request },
    }))).toBe(false);
    expect(App.isNarratorRequestFresh(freshnessInput({
      baseState,
      request,
      currentCampaignId: "campaign-b",
    }))).toBe(false);
    expect(App.isNarratorRequestFresh(freshnessInput({
      baseState,
      request,
      currentUserId: null,
    }))).toBe(false);
    expect(App.isNarratorRequestFresh(freshnessInput({
      baseState,
      request,
      response: { _stateRevision: "stale-revision" },
    }))).toBe(false);
  });

  it("rejects a response after narrative or narrator-settings state changes", () => {
    const baseState = makeInitialState();
    const request = requestFixture(baseState);

    expect(App.isNarratorRequestFresh(freshnessInput({
      baseState,
      request,
      currentState: {
        ...baseState,
        beats: [...baseState.beats, { id: "local", type: "player", content: "A newer action." }],
      },
    }))).toBe(false);
    expect(App.isNarratorRequestFresh(freshnessInput({
      baseState,
      request,
      currentState: {
        ...baseState,
        narratorSettings: { ...(baseState.narratorSettings || {}), memoryMode: "off" },
      },
    }))).toBe(false);
  });

  it("keeps a valid response when only portrait presentation changed", () => {
    const baseState = makeInitialState();
    const request = requestFixture(baseState);

    expect(App.isNarratorRequestFresh(freshnessInput({
      baseState,
      request,
      currentState: {
        ...baseState,
        portraitOverrides: { keeper: "data:image/png;base64,portrait" },
      },
    }))).toBe(true);
  });

  it("invalidates request identity before aborting in-flight work", () => {
    const controller = new AbortController();
    const request = { controller };
    const activeRequestRef = { current: request };

    App.invalidateNarratorRequest(activeRequestRef, "Campaign changed.");

    expect(activeRequestRef.current).toBeNull();
    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toMatchObject({ message: "Campaign changed." });
  });
});
