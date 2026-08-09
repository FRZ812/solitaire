import { describe, expect, it } from "vitest";
import { REFERENCE_POLICY } from "../reference/policy.js";
import { getReferenceReward, referenceRewardIds } from "../reference/rewards.js";
import {
  REWARD_STATE_VERSION,
  createRewardOffer,
  isRewardState,
  refreshRewardOffer,
  selectReward,
} from "./rewards.js";

const candidateIds = Object.freeze(referenceRewardIds());

function create(seed = "act-1:reward-1") {
  return createRewardOffer({
    offerId: "act-1:step-1:reward",
    seed,
    candidateIds,
  });
}

describe("deterministic reward drafting", () => {
  it("pins the versioned offer, exact choices, and RNG cursor for a seed", () => {
    const first = create();
    const repeated = create();

    expect(first).toEqual(repeated);
    expect(first).toMatchObject({
      version: REWARD_STATE_VERSION,
      baselineVersion: REFERENCE_POLICY.id,
      offerId: "act-1:step-1:reward",
      revision: 0,
      refreshesUsed: 0,
      refreshesRemaining: 1,
      selectedRewardId: null,
    });
    expect(first.choices).toEqual([
      "action:shield-bash-replacement",
      "item:mithril-helm",
      "action:shield-bash-upgrade",
    ]);
    expect(first.rng).toEqual({ algorithm: "mulberry32", state: 2303045535 });
    expect(new Set(first.choices).size).toBe(3);
    expect(isRewardState(first)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.choices)).toBe(true);
  });

  it("owns its candidate IDs instead of retaining caller arrays", () => {
    const mutable = [...candidateIds];
    const state = createRewardOffer({ offerId: "offer-2", seed: 2, candidateIds: mutable });

    mutable[0] = "missing";

    expect(state.candidateIds[0]).not.toBe("missing");
    expect(isRewardState(state)).toBe(true);
  });

  it("uses the single policy refresh and guarantees a meaningfully different set", () => {
    const initial = create(2);
    const refreshed = refreshRewardOffer(initial, {
      offerId: initial.offerId,
      expectedRevision: 0,
    });

    expect(refreshed).toMatchObject({ ok: true, refreshed: true });
    expect(refreshed.state).toMatchObject({ revision: 1, refreshesUsed: 1, refreshesRemaining: 0 });
    expect(new Set(refreshed.state.choices)).not.toEqual(new Set(initial.choices));
    expect(isRewardState(refreshed.state)).toBe(true);

    expect(refreshRewardOffer(refreshed.state, {
      offerId: initial.offerId,
      expectedRevision: 1,
    })).toEqual({
      ok: false,
      reason: "refresh-exhausted",
      state: refreshed.state,
    });
  });

  it("selects a registry-backed reward and is serially idempotent on the committed successor", () => {
    const state = create();
    const command = {
      offerId: state.offerId,
      expectedRevision: state.revision,
      rewardId: state.choices[1],
    };
    const first = selectReward(state, command);
    const retry = selectReward(first.state, command);

    expect(first).toMatchObject({
      ok: true,
      selected: true,
      reward: getReferenceReward(command.rewardId),
      state: { selectedRewardId: command.rewardId, revision: 1 },
    });
    expect(retry).toEqual({
      ok: true,
      selected: false,
      reward: getReferenceReward(command.rewardId),
      state: first.state,
    });
  });

  it("exposes offer/revision conflicts for atomic settlement by the owning run", () => {
    const state = create();

    expect(selectReward(state, {
      offerId: "other-offer",
      expectedRevision: 0,
      rewardId: state.choices[0],
    })).toEqual({ ok: false, reason: "reward-offer-mismatch", state });
    expect(selectReward(state, {
      offerId: state.offerId,
      expectedRevision: 99,
      rewardId: state.choices[0],
    })).toEqual({ ok: false, reason: "stale-reward-offer", state });
  });

  it("rejects forged choices and restored refresh budgets that do not match seeded provenance", () => {
    const initial = create();
    const forgedChoices = JSON.parse(JSON.stringify(initial));
    forgedChoices.choices = candidateIds.filter((id) => !initial.choices.includes(id)).slice(0, 3);

    const refreshed = refreshRewardOffer(initial, {
      offerId: initial.offerId,
      expectedRevision: 0,
    }).state;
    const forgedBudget = JSON.parse(JSON.stringify(refreshed));
    forgedBudget.refreshesRemaining = 1;

    expect(isRewardState(forgedChoices)).toBe(false);
    expect(isRewardState(forgedBudget)).toBe(false);
    expect(selectReward(forgedChoices, {
      offerId: initial.offerId,
      expectedRevision: 0,
      rewardId: forgedChoices.choices[0],
    })).toEqual({ ok: false, reason: "invalid-reward-state", state: null });
  });

  it("round-trips then continues with the same deterministic refresh", () => {
    const live = create("round-trip");
    const restored = JSON.parse(JSON.stringify(live));
    const command = { offerId: live.offerId, expectedRevision: 0 };

    expect(refreshRewardOffer(restored, command)).toEqual(refreshRewardOffer(live, command));
  });

  it("rejects unknown candidate IDs and executable input without invoking callbacks", () => {
    expect(() => createRewardOffer({
      offerId: "bad-pool",
      seed: 1,
      candidateIds: [...candidateIds.slice(0, 3), "missing"],
    })).toThrow("invalid-reward-candidates");

    let callbackCalls = 0;
    const input = {
      offerId: "bad-input",
      seed: 1,
      candidateIds: [...candidateIds],
      toJSON: () => { callbackCalls += 1; return {}; },
    };
    expect(() => createRewardOffer(input)).toThrow("invalid-reward-offer-input");
    expect(callbackCalls).toBe(0);
  });

  it("distinguishes supplementary Unicode seeds", () => {
    expect(create("act:😀").choices).not.toEqual(create("act:😁").choices);
  });
});
