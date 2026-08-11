import { describe, expect, it } from "vitest";
import {
  closeReferenceGameplay,
  openReferenceGameplay as openReferenceGameplayBoundary,
  readReferenceGameplay,
  startReferenceGatekeeperTrial as startReferenceGatekeeperTrialBoundary,
  transitionReferenceGameplay as transitionReferenceGameplayBoundary,
} from "./campaign-boundary.js";
import { createGameplaySave } from "./persistence.js";
import { createArcticKnightRun, resolveRunCommand } from "./state.js";

const startReferenceGatekeeperTrial = (state, options) => startReferenceGatekeeperTrialBoundary(
  state,
  { ...options, previewEnabled: true },
);
const transitionReferenceGameplay = (state, transition, options) => (
  transitionReferenceGameplayBoundary(
    state,
    transition,
    { ...options, previewEnabled: true },
  )
);
const openReferenceGameplay = (state, options) => openReferenceGameplayBoundary(
  state,
  { ...options, previewEnabled: true },
);

function campaignState(overrides = {}) {
  return {
    world: { seed: 9144 },
    turns: [],
    ...overrides,
  };
}

function attackCommand(run) {
  return {
    expectedRunSequence: run.sequence,
    type: "use-action",
    actorId: run.encounter.playerId,
    actionId: "basic-attack",
    targetId: run.encounter.enemyIds[0],
  };
}

describe("reference gameplay campaign boundary", () => {
  it("fails closed unless the application explicitly enables the preview capability", () => {
    const before = campaignState();

    expect(startReferenceGatekeeperTrialBoundary(before, { campaignId: "campaign-7" })).toEqual({
      ok: false,
      reason: "reference-gameplay-preview-disabled",
      state: before,
      run: null,
    });

    const started = startReferenceGatekeeperTrial(before, { campaignId: "campaign-7" }).state;
    expect(transitionReferenceGameplayBoundary(
      started,
      (run) => resolveRunCommand(run, attackCommand(run)),
      { campaignId: "campaign-7" },
    )).toEqual({
      ok: false,
      reason: "reference-gameplay-preview-disabled",
      state: started,
      run: null,
    });

    const closed = closeReferenceGameplay(started, { campaignId: "campaign-7" });
    expect(openReferenceGameplayBoundary(closed, { campaignId: "campaign-7" })).toBe(closed);
  });

  it("starts a deterministic persisted Gatekeeper trial without mutating campaign input", () => {
    const before = campaignState();
    const result = startReferenceGatekeeperTrial(before, { campaignId: "campaign-7" });
    const restored = readReferenceGameplay(result.state, { campaignId: "campaign-7" });

    expect(result.ok).toBe(true);
    expect(before).toEqual(campaignState());
    expect(result.state.referenceGameplayOpen).toBe(true);
    expect(result.state.referenceGameplayAttempt).toBe(1);
    expect(restored.ok).toBe(true);
    expect(restored.run.runId).toBe("campaign-7:tower-winter:1");
    expect(restored.run.seed).toBe("9144:tower-winter:1");
    expect(restored.run.currentStep.enemyId).toBe("gatekeeper");
  });

  it("snapshots campaign seed lineage across callback-time and later host mutations", () => {
    const source = campaignState();
    const started = startReferenceGatekeeperTrial(source, { campaignId: "campaign-7" }).state;
    const result = transitionReferenceGameplay(
      started,
      (run) => {
        source.world.seed = 1337;
        return resolveRunCommand(run, attackCommand(run));
      },
      { campaignId: "campaign-7" },
    );

    expect(result.ok).toBe(true);
    expect(readReferenceGameplay(result.state, { campaignId: "campaign-7" }).ok).toBe(true);
    source.world.seed = 42;
    expect(readReferenceGameplay(result.state, { campaignId: "campaign-7" }).ok).toBe(true);
  });

  it("commits controller transitions against the latest persisted campaign snapshot", () => {
    const started = startReferenceGatekeeperTrial(campaignState(), { campaignId: "campaign-7" }).state;
    const before = readReferenceGameplay(started, { campaignId: "campaign-7" }).run;
    const result = transitionReferenceGameplay(
      started,
      (run) => resolveRunCommand(run, attackCommand(run)),
      { campaignId: "campaign-7" },
    );
    const after = readReferenceGameplay(result.state, { campaignId: "campaign-7" }).run;

    expect(result.ok).toBe(true);
    expect(after.sequence).toBe(before.sequence + 1);
    expect(after.encounter.round).toBe(2);
    expect(result.state.referenceGameplaySave.fingerprint)
      .not.toBe(started.referenceGameplaySave.fingerprint);
  });

  it("preserves the exact campaign object when a stale command is rejected", () => {
    const started = startReferenceGatekeeperTrial(campaignState(), { campaignId: "campaign-7" }).state;
    const run = readReferenceGameplay(started, { campaignId: "campaign-7" }).run;
    const advanced = transitionReferenceGameplay(
      started,
      (current) => resolveRunCommand(current, attackCommand(current)),
      { campaignId: "campaign-7" },
    ).state;
    const result = transitionReferenceGameplay(
      advanced,
      (current) => resolveRunCommand(current, attackCommand(run)),
      { campaignId: "campaign-7" },
    );

    expect(result).toMatchObject({ ok: false, reason: "stale-run-state" });
    expect(result.state).toBe(advanced);
  });

  it("closes and reopens the view without discarding deterministic run progress", () => {
    const started = startReferenceGatekeeperTrial(campaignState(), { campaignId: "campaign-7" }).state;
    const fingerprint = started.referenceGameplaySave.fingerprint;
    const closed = closeReferenceGameplay(started, { campaignId: "campaign-7" });
    const reopened = openReferenceGameplay(closed, { campaignId: "campaign-7" });

    expect(closed.referenceGameplayOpen).toBe(false);
    expect(reopened.referenceGameplayOpen).toBe(true);
    expect(reopened.referenceGameplaySave.fingerprint).toBe(fingerprint);
  });

  it("owns deserialized save envelopes across close and open", () => {
    const started = startReferenceGatekeeperTrial(campaignState(), { campaignId: "campaign-7" }).state;
    const closeSource = JSON.parse(JSON.stringify(started));
    const closed = closeReferenceGameplay(closeSource, { campaignId: "campaign-7" });

    expect(closed.referenceGameplaySave).not.toBe(closeSource.referenceGameplaySave);
    closeSource.referenceGameplaySave.runState.player.hp = 0;
    expect(readReferenceGameplay(closed, { campaignId: "campaign-7" }).ok).toBe(true);

    const openSource = JSON.parse(JSON.stringify(closed));
    const opened = openReferenceGameplay(openSource, { campaignId: "campaign-7" });
    expect(opened.referenceGameplaySave).not.toBe(openSource.referenceGameplaySave);
    openSource.referenceGameplaySave.runState.player.hp = 0;
    expect(readReferenceGameplay(opened, { campaignId: "campaign-7" }).ok).toBe(true);
  });

  it("rejects malformed campaign save envelopes without echoing attacker state", () => {
    const malformed = campaignState({
      referenceGameplayOpen: true,
      referenceGameplaySave: { version: "forged", runState: { phase: "reward" } },
    });
    const read = readReferenceGameplay(malformed, { campaignId: "campaign-7" });
    const transitioned = transitionReferenceGameplay(malformed, () => {
      throw new Error("must not execute");
    }, { campaignId: "campaign-7" });

    expect(read).toEqual({ ok: false, reason: "invalid-gameplay-save", run: null });
    expect(transitioned).toEqual({
      ok: false,
      reason: "invalid-gameplay-save",
      state: malformed,
      run: null,
    });
  });

  it("rejects accessor-backed campaign state without executing getters or transitions", () => {
    let getterCalls = 0;
    let transitionCalls = 0;
    const accessor = campaignState();
    Object.defineProperty(accessor, "referenceGameplaySave", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return startReferenceGatekeeperTrial(campaignState()).state.referenceGameplaySave;
      },
    });

    expect(readReferenceGameplay(accessor, { campaignId: "campaign-7" })).toEqual({
      ok: false,
      reason: "invalid-campaign-state",
      run: null,
    });
    const transitioned = transitionReferenceGameplay(accessor, () => {
      transitionCalls += 1;
      return null;
    }, { campaignId: "campaign-7" });
    expect(transitioned.ok).toBe(false);
    expect(transitioned.reason).toBe("invalid-campaign-state");
    expect(transitioned.state).toBe(accessor);
    expect(getterCalls).toBe(0);
    expect(transitionCalls).toBe(0);
  });

  it("does not apply gameplay-envelope limits to unrelated campaign payloads", () => {
    const largeCampaignField = "x".repeat(2_000_001);
    const result = startReferenceGatekeeperTrial(
      campaignState({ largeCampaignField }),
      { campaignId: "large-campaign" },
    );

    expect(result.ok).toBe(true);
    expect(result.state.largeCampaignField).toBe(largeCampaignField);
    expect(readReferenceGameplay(result.state, { campaignId: "large-campaign" }).ok).toBe(true);
  });

  it("does not execute nested seed accessors", () => {
    let getterCalls = 0;
    const world = {};
    Object.defineProperty(world, "seed", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "callback-seed";
      },
    });
    const result = startReferenceGatekeeperTrial(
      campaignState({ world }),
      { campaignId: "safe-fallback" },
    );

    expect(result.ok).toBe(true);
    expect(result.run.seed).toBe("safe-fallback:tower-winter:1");
    expect(getterCalls).toBe(0);
  });

  it("increments persisted attempt lineage rather than reusing a completed run identity", () => {
    const first = startReferenceGatekeeperTrial(campaignState(), { campaignId: "campaign-7" }).state;
    const second = startReferenceGatekeeperTrial(first, { campaignId: "campaign-7" }).state;
    const restored = readReferenceGameplay(second, { campaignId: "campaign-7" });

    expect(second.referenceGameplayAttempt).toBe(2);
    expect(restored.run.runId).toBe("campaign-7:tower-winter:2");
    expect(restored.run.seed).toBe("9144:tower-winter:2");
  });

  it("resets invalid preview lineage only after explicit replacement", () => {
    const started = startReferenceGatekeeperTrial(campaignState(), { campaignId: "campaign-7" }).state;
    const invalid = { ...started, referenceGameplayAttempt: "corrupt" };

    expect(startReferenceGatekeeperTrial(invalid, { campaignId: "campaign-7" })).toEqual({
      ok: false,
      reason: "invalid-reference-gameplay-attempt",
      state: invalid,
      run: null,
    });

    const replaced = startReferenceGatekeeperTrial(invalid, {
      campaignId: "campaign-7",
      replaceInvalid: true,
    });
    expect(replaced.ok).toBe(true);
    expect(replaced.state.referenceGameplayAttempt).toBe(1);
    expect(replaced.state.referenceGameplayCampaignSeed).toBe("9144");
    expect(replaced.run.runId).toBe("campaign-7:tower-winter:1");
    expect(replaced.run.seed).toBe("9144:tower-winter:1");
  });

  it("rejects transplanted runs and non-monotonic transition replacements", () => {
    const campaignA = startReferenceGatekeeperTrial(campaignState(), {
      campaignId: "campaign-A",
    }).state;
    const transplanted = campaignState({
      referenceGameplayAttempt: campaignA.referenceGameplayAttempt,
      referenceGameplayOpen: true,
      referenceGameplaySave: campaignA.referenceGameplaySave,
    });

    expect(readReferenceGameplay(transplanted, { campaignId: "campaign-B" })).toEqual({
      ok: false,
      reason: "reference-gameplay-lineage-mismatch",
      run: null,
    });

    const advanced = transitionReferenceGameplay(
      campaignA,
      (run) => resolveRunCommand(run, attackCommand(run)),
      { campaignId: "campaign-A" },
    ).state;
    const result = transitionReferenceGameplay(
      advanced,
      (run) => ({
        ok: true,
        state: startReferenceGatekeeperTrial(campaignState(), {
          campaignId: "campaign-A",
        }).run,
        previousRunId: run.runId,
      }),
      { campaignId: "campaign-A" },
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "non-monotonic-reference-transition",
      state: advanced,
    });
  });

  it("rejects an exhausted attempt counter instead of wrapping run identity", () => {
    const before = campaignState({ referenceGameplayAttempt: Number.MAX_SAFE_INTEGER });
    const result = startReferenceGatekeeperTrial(before, { campaignId: "campaign-7" });

    expect(result).toEqual({
      ok: false,
      reason: "reference-gameplay-attempt-limit-reached",
      state: before,
      run: null,
    });
  });

  it("rejects a canonical full-mode run transplanted into the Gatekeeper boundary", () => {
    const run = createArcticKnightRun({
      runId: "campaign-7:tower-winter:1",
      seed: "9144:tower-winter:1",
    });
    const campaign = campaignState({
      referenceGameplayAttempt: 1,
      referenceGameplayCampaignSeed: "9144",
      referenceGameplaySave: createGameplaySave(run),
    });

    expect(readReferenceGameplay(campaign, { campaignId: "campaign-7" })).toEqual({
      ok: false,
      reason: "reference-gameplay-domain-mismatch",
      run: null,
    });
  });

  it("rejects oversized composed lineage without throwing", () => {
    const oversizedCampaignId = "c".repeat(257);
    const oversizedSeedState = campaignState({ world: { seed: "s".repeat(257) } });

    expect(startReferenceGatekeeperTrial(campaignState(), {
      campaignId: oversizedCampaignId,
    })).toEqual({
      ok: false,
      reason: "reference-gameplay-lineage-limit-exceeded",
      state: expect.any(Object),
      run: null,
    });
    expect(startReferenceGatekeeperTrial(oversizedSeedState, {
      campaignId: "campaign-7",
    })).toEqual({
      ok: false,
      reason: "reference-gameplay-lineage-limit-exceeded",
      state: oversizedSeedState,
      run: null,
    });
  });
});
