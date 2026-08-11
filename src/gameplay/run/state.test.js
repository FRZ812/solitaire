import { describe, expect, it } from "vitest";
import { getActionProgressionOffer } from "../reference/actions.js";
import { getReferenceReward, REFERENCE_REWARDS } from "../reference/rewards.js";
import { chooseActionProgressionOffer, createActionProgressionState } from "./action-progression.js";
import { createBuild } from "./build.js";
import { createRewardOffer } from "./rewards.js";
import {
  claimRunReward,
  createArcticKnightGatekeeperRun,
  createArcticKnightRun,
  draftReferenceRunRewardOffer,
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

function skillCommand(run, skillId, targetId = run.encounter.playerId) {
  return {
    expectedRunSequence: run.sequence,
    type: "use-skill",
    actorId: run.encounter.playerId,
    skillId,
    targetId,
  };
}

function playToReward(initial, { useEvasion = true } = {}) {
  let run = initial;
  let attacks = 0;
  while (run.phase === "encounter" && attacks < 20) {
    const evasion = run.encounter.actors[run.encounter.playerId].skills
      .find(({ id }) => id === "emergency-evasion");
    if (useEvasion && evasion.usesRemaining > 0) {
      const prepared = resolveRunCommand(run, skillCommand(run, "emergency-evasion"));
      if (!prepared.ok) throw new TypeError(prepared.reason);
      run = prepared.state;
    }
    const attacked = resolveRunCommand(run, command(run, "basic-attack"));
    if (!attacked.ok) throw new TypeError(attacked.reason);
    run = attacked.state;
    attacks += 1;
  }
  return { run, attacks };
}

function runOffering(rewardId) {
  for (let seed = 0; seed < 100; seed += 1) {
    let run = playToReward(createArcticKnightGatekeeperRun({
      runId: `claim-${rewardId}-${seed}`,
      seed,
    })).run;
    if (run.rewardOffer.choices.includes(rewardId)) return run;
    const refreshed = refreshRunReward(run, {
      offerId: run.rewardOffer.offerId,
      expectedRevision: run.rewardOffer.revision,
      expectedRunSequence: run.sequence,
    });
    if (refreshed.ok && refreshed.state.rewardOffer.choices.includes(rewardId)) {
      run = refreshed.state;
      return run;
    }
  }
  throw new TypeError(`no-deterministic-offer:${rewardId}`);
}

describe("reference run state", () => {
  it("surfaces unresolved Act 1 content instead of inventing standard encounters", () => {
    const run = createArcticKnightRun({ runId: "run-full", seed: "winter" });

    expect(run).toMatchObject({
      version: 2,
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
    expect(first.history).toEqual([]);
  });

  it("rejects oversized run lineage before constructing externally invalid state", () => {
    expect(() => createArcticKnightGatekeeperRun({
      runId: "r".repeat(257),
      seed: 1447,
    })).toThrow("invalid-run-id");
    expect(() => createArcticKnightGatekeeperRun({
      runId: "bounded-run",
      seed: "s".repeat(257),
    })).toThrow("invalid-run-seed");
    expect(() => createArcticKnightGatekeeperRun({
      runId: "bounded-run",
      seed: Number.MAX_VALUE,
    })).toThrow("invalid-run-seed");
  });

  it("can reach reward drafting from an untouched Gatekeeper run through legal commands", () => {
    const { run, attacks } = playToReward(
      createArcticKnightGatekeeperRun({ runId: "playable", seed: 1447 }),
    );

    expect(run).toMatchObject({ phase: "reward", status: "active" });
    expect(run.player.hp).toBeGreaterThan(0);
    expect(attacks).toBeLessThanOrEqual(8);
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

  it("keeps repeated transitions within the interactive run-controller budget", () => {
    let run = createArcticKnightGatekeeperRun({ runId: "interactive-budget", seed: 17 });
    const startedAt = performance.now();

    for (let index = 0; index < 50; index += 1) {
      const result = resolveRunCommand(
        run,
        command(run, "basic-defense", run.encounter.playerId),
      );
      expect(result.ok).toBe(true);
      run = result.state;
    }

    expect(performance.now() - startedAt).toBeLessThan(2_000);
    expect(run.sequence).toBe(50);
    expect(isReferenceRunState(run)).toBe(true);
  });

  it("settles defeat without opening a reward offer", () => {
    const { run } = playToReward(
      createArcticKnightGatekeeperRun({ runId: "defeat", seed: 5 }),
      { useEvasion: false },
    );

    expect(run).toMatchObject({
      status: "defeated",
      phase: "complete",
      rewardOffer: null,
      player: { hp: 0 },
    });
    expect(isReferenceRunState(run)).toBe(true);
  });

  it("opens a deterministic provisional-baseline reward offer after victory", () => {
    const result = { state: playToReward(
      createArcticKnightGatekeeperRun({ runId: "victory", seed: "reward-path" }),
    ).run, ok: true };

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

  it("returns an explicit content gap when fewer than four rewards remain eligible", () => {
    const replaced = chooseActionProgressionOffer(
      createActionProgressionState(),
      "shield-bash-replacement",
    ).state;
    const exhaustedActions = chooseActionProgressionOffer(
      replaced,
      "shield-bash-upgrade",
    ).state;
    const result = draftReferenceRunRewardOffer({
      runId: "exhausted",
      seed: "exhausted-seed",
      currentStep: { id: "exhausted-step" },
      build: createBuild({ traits: { ironclad: 7, "force-field": 7 } }),
      actionProgression: exhaustedActions,
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient-reward-candidates",
      candidateIds: ["action:shield-bash-upgrade", "item:mithril-helm"],
    });
  });

  it("optimistically applies one claimed reward and makes serial retries idempotent", () => {
    const rewardState = playToReward(
      createArcticKnightGatekeeperRun({ runId: "claim", seed: "reward-action" }),
    ).run;
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
        phase: "content-gap",
        completedStepIds: ["arctic-knight-act-1-gatekeeper"],
        rewardClaims: [{ offerId: claim.offerId, rewardId }],
      },
    });
    expect(first.state.actionProgression.actions.attack).not.toEqual(
      rewardState.actionProgression.actions.attack,
    );
    expect(retry).toMatchObject({ ok: true, applied: false, state: first.state });
    expect(isReferenceRunState(first.state)).toBe(true);

    const missingAppliedEffect = JSON.parse(JSON.stringify(first.state));
    missingAppliedEffect.actionProgression = rewardState.actionProgression;
    expect(isReferenceRunState(missingAppliedEffect)).toBe(false);
  });

  it.each(REFERENCE_REWARDS.map(({ id }) => id))(
    "applies canonical reward %s and preserves a valid settled run",
    (rewardId) => {
      const rewardState = runOffering(rewardId);
      const result = claimRunReward(rewardState, {
        offerId: rewardState.rewardOffer.offerId,
        expectedRevision: rewardState.rewardOffer.revision,
        expectedRunSequence: rewardState.sequence,
        rewardId,
      });
      const reward = getReferenceReward(rewardId);

      expect(result).toMatchObject({
        ok: true,
        applied: true,
        state: {
          status: "completed",
          phase: "content-gap",
          completedStepIds: ["arctic-knight-act-1-gatekeeper"],
        },
      });
      expect(isReferenceRunState(result.state)).toBe(true);
      if (reward.kind === "item") {
        expect(result.state.build.items.some(({ itemId }) => itemId === reward.itemId)).toBe(true);
      } else if (reward.kind === "trait") {
        expect(result.state.build.baseTraits[reward.traitId]).toBeGreaterThanOrEqual(reward.levels);
      } else if (reward.kind === "action") {
        const offer = getActionProgressionOffer(reward.actionOfferId);
        if (offer.kind === "replacement") {
          expect(result.state.actionProgression.actions.attack.actionId).toBe(offer.replacementActionId);
        } else {
          expect(result.state.actionProgression.actions.attack.upgrades).toContainEqual({
            offerId: offer.id,
            familyId: offer.familyId,
            level: 1,
          });
        }
      }
    },
  );

  it("binds refreshes to the current run offer revision", () => {
    const rewardState = playToReward(
      createArcticKnightGatekeeperRun({ runId: "refresh", seed: "reward-refresh" }),
    ).run;
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

  it.each([
    ["enemy HP", (run) => { run.encounter.actors.gatekeeper.hp = 1; }],
    ["derived attack", (run) => { run.encounter.actors[run.encounter.playerId].stats.attack = 1000; }],
    ["authored scheduler", (run) => {
      run.encounter.actors.gatekeeper.intentState = null;
      run.encounter.actors.gatekeeper.intent = {
        id: "forged-wait",
        type: "attack",
        targetId: run.encounter.playerId,
        damage: { min: 0, max: 0 },
      };
    }],
    ["mode ancestry", (run) => { run.mode = "full"; }],
    ["completion prefix", (run) => { run.completedStepIds = [run.currentStep.id]; }],
  ])("rejects unreachable %s authority copies", (_label, forge) => {
    const run = JSON.parse(JSON.stringify(
      createArcticKnightGatekeeperRun({ runId: "authority", seed: 99 }),
    ));
    forge(run);

    expect(isReferenceRunState(run)).toBe(false);
  });

  it("binds reward lineage and refresh history to the owning run", () => {
    const rewardRun = playToReward(
      createArcticKnightGatekeeperRun({ runId: "reward-authority", seed: 22 }),
    ).run;
    const forgedSeed = JSON.parse(JSON.stringify(rewardRun));
    forgedSeed.rewardOffer = createRewardOffer({
      offerId: rewardRun.rewardOffer.offerId,
      seed: "attacker-seed",
      candidateIds: rewardRun.rewardOffer.candidateIds.slice(0, 4),
    });
    expect(isReferenceRunState(forgedSeed)).toBe(false);

    const refreshed = refreshRunReward(rewardRun, {
      offerId: rewardRun.rewardOffer.offerId,
      expectedRevision: rewardRun.rewardOffer.revision,
      expectedRunSequence: rewardRun.sequence,
    }).state;
    const reset = JSON.parse(JSON.stringify(refreshed));
    reset.rewardOffer = rewardRun.rewardOffer;
    expect(isReferenceRunState(reset)).toBe(false);
  });

  it("rejects fabricated claims where no reward offer was reached", () => {
    const blocked = JSON.parse(JSON.stringify(
      createArcticKnightRun({ runId: "no-offer", seed: 71 }),
    ));
    blocked.rewardClaims.push({
      offerId: "no-offer:invented:reward",
      rewardId: "item:mithril-helm",
    });

    expect(isReferenceRunState(blocked)).toBe(false);
    expect(claimRunReward(blocked, {
      offerId: "no-offer:invented:reward",
      expectedRevision: 0,
      expectedRunSequence: 0,
      rewardId: "item:mithril-helm",
    })).toMatchObject({ ok: false, reason: "invalid-run-state", state: null });
  });
});
