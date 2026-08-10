import { describe, expect, it } from "vitest";
import { getReferenceReward } from "../reference/rewards.js";
import {
  claimRunReward,
  createArcticKnightGatekeeperRun,
  createArcticKnightRun,
  isReferenceRunState,
  refreshRunReward,
  resolveRunCommand,
} from "./state.js";

function command(run, actionId, targetId = run.encounter.enemyIds[0]) {
  return {
    expectedRunSequence: run.sequence,
    type: "use-action",
    actorId: run.encounter.playerId,
    actionId,
    targetId,
  };
}

function oneHitVictory(run) {
  const snapshot = JSON.parse(JSON.stringify(run));
  snapshot.encounter.actors[snapshot.encounter.enemyIds[0]].hp = 1;
  return snapshot;
}

describe("reference run state", () => {
  it("surfaces unresolved Act 1 content instead of inventing standard encounters", () => {
    const run = createArcticKnightRun({ runId: "run-full", seed: "winter" });

    expect(run).toMatchObject({
      version: 1,
      runId: "run-full",
      characterId: "arctic-knight",
      actId: "arctic-knight-act-1",
      mode: "full",
      status: "blocked",
      phase: "content-gap",
      stepIndex: 0,
      currentStep: {
        position: 1,
        kind: "standard",
        enemyId: null,
        contentConfidence: "gap",
      },
      encounter: null,
      rewardOffer: null,
    });
    expect(run.completedStepIds).toEqual([]);
    expect(isReferenceRunState(run)).toBe(true);
    expect(Object.isFrozen(run)).toBe(true);
  });

  it("creates a deterministic, playable Gatekeeper vertical slice", () => {
    const first = createArcticKnightGatekeeperRun({ runId: "preview", seed: 1447 });
    const second = createArcticKnightGatekeeperRun({ runId: "preview", seed: 1447 });
    const enemy = first.encounter.actors.gatekeeper;
    const player = first.encounter.actors[first.encounter.playerId];

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      mode: "gatekeeper-preview",
      status: "active",
      phase: "encounter",
      stepIndex: 11,
      currentStep: { kind: "boss", enemyId: "gatekeeper" },
    });
    expect(enemy).toMatchObject({
      name: "The Gatekeeper",
      hp: 60,
      maxHp: 60,
      intentState: { patternId: "gatekeeper-reference-v1", stepIndex: 0 },
    });
    expect(player.actions).toEqual(["basic-attack", "basic-defense"]);
    expect(player.skills.map(({ id }) => id)).toEqual([
      "emergency-evasion",
      "sleep-bomb",
    ]);
    expect(isReferenceRunState(first)).toBe(true);
  });

  it("resolves commands through the kernel and advances authored intents immutably", () => {
    const before = createArcticKnightGatekeeperRun({ runId: "command", seed: 9 });
    const result = resolveRunCommand(
      before,
      command(before, "basic-defense", before.encounter.playerId),
    );

    expect(result.ok).toBe(true);
    expect(result.state.encounter.round).toBe(2);
    expect(result.state.encounter.actors.gatekeeper.intentState.stepIndex).toBe(1);
    expect(result.state.sequence).toBe(1);
    expect(result.state.events.at(-1)).toMatchObject({
      sequence: 1,
      type: "combat-command-resolved",
      commandType: "use-action",
    });
    expect(before.encounter.round).toBe(1);
    expect(isReferenceRunState(result.state)).toBe(true);
    expect(resolveRunCommand(
      result.state,
      command(before, "basic-defense", before.encounter.playerId),
    )).toMatchObject({ ok: false, reason: "stale-run-state" });
  });

  it("settles defeat without opening a reward offer", () => {
    const run = JSON.parse(JSON.stringify(
      createArcticKnightGatekeeperRun({ runId: "defeat", seed: 4 }),
    ));
    run.player.hp = 1;
    run.encounter.actors[run.encounter.playerId].hp = 1;

    const result = resolveRunCommand(
      run,
      command(run, "basic-defense", run.encounter.playerId),
    );

    expect(result).toMatchObject({
      ok: true,
      state: {
        status: "defeated",
        phase: "complete",
        rewardOffer: null,
        player: { hp: 0 },
      },
    });
    expect(isReferenceRunState(result.state)).toBe(true);
  });

  it("opens a deterministic authoritative reward offer after victory", () => {
    const run = oneHitVictory(
      createArcticKnightGatekeeperRun({ runId: "victory", seed: "reward-path" }),
    );
    const result = resolveRunCommand(run, command(run, "basic-attack"));

    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({
      status: "active",
      phase: "reward",
      completedStepIds: [],
      rewardOffer: {
        offerId: "victory:arctic-knight-act-1-gatekeeper:reward",
        revision: 0,
        refreshesRemaining: 1,
      },
    });
    expect(result.state.rewardOffer.choices).toHaveLength(3);
    expect(result.state.rewardOffer.candidateIds.length).toBeGreaterThan(3);
    expect(isReferenceRunState(result.state)).toBe(true);
  });

  it("atomically applies one claimed reward and makes serial retries idempotent", () => {
    const run = oneHitVictory(
      createArcticKnightGatekeeperRun({ runId: "claim", seed: "reward-action" }),
    );
    const rewardState = resolveRunCommand(run, command(run, "basic-attack")).state;
    const rewardId = rewardState.rewardOffer.choices.find(
      (candidateId) => getReferenceReward(candidateId)?.kind === "action",
    );
    expect(rewardId).toBeTruthy();
    const claim = {
      offerId: rewardState.rewardOffer.offerId,
      expectedRevision: rewardState.rewardOffer.revision,
      expectedRunSequence: rewardState.sequence,
      rewardId,
    };

    const first = claimRunReward(rewardState, claim);
    const retry = claimRunReward(first.state, claim);

    expect(first).toMatchObject({
      ok: true,
      applied: true,
      state: {
        status: "completed",
        phase: "complete",
        completedStepIds: ["arctic-knight-act-1-gatekeeper"],
        rewardClaims: [{ offerId: claim.offerId, rewardId }],
      },
    });
    expect(first.state.actionProgression.actions.attack).not.toEqual(
      rewardState.actionProgression.actions.attack,
    );
    expect(retry).toMatchObject({ ok: true, applied: false, state: first.state });
    expect(isReferenceRunState(first.state)).toBe(true);
  });

  it("binds refreshes to the current run offer revision", () => {
    const run = oneHitVictory(
      createArcticKnightGatekeeperRun({ runId: "refresh", seed: "reward-refresh" }),
    );
    const rewardState = resolveRunCommand(run, command(run, "basic-attack")).state;
    const request = {
      offerId: rewardState.rewardOffer.offerId,
      expectedRevision: 0,
      expectedRunSequence: rewardState.sequence,
    };

    const first = refreshRunReward(rewardState, request);
    const stale = refreshRunReward(first.state, request);

    expect(first).toMatchObject({
      ok: true,
      state: { rewardOffer: { revision: 1, refreshesRemaining: 0 } },
    });
    expect(new Set(first.state.rewardOffer.choices)).not.toEqual(
      new Set(rewardState.rewardOffer.choices),
    );
    expect(stale).toMatchObject({ ok: false, reason: "stale-run-state" });
    expect(isReferenceRunState(first.state)).toBe(true);
  });

  it("rejects forged phase and encounter relationships", () => {
    const run = JSON.parse(JSON.stringify(
      createArcticKnightGatekeeperRun({ runId: "forged", seed: 1 }),
    ));
    run.phase = "reward";

    expect(isReferenceRunState(run)).toBe(false);
    expect(resolveRunCommand(run, command(run, "basic-attack"))).toEqual({
      ok: false,
      reason: "invalid-run-state",
      state: null,
      events: [],
    });
  });
});
