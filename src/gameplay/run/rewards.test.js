import { describe, expect, it } from "vitest";
import { createRewardOffer, refreshRewardOffer, selectReward } from "./rewards.js";

const candidates = Object.freeze([
  Object.freeze({ id: "attack-1", kind: "stat", stat: "attack", amount: 1 }),
  Object.freeze({ id: "defense-1", kind: "stat", stat: "defense", amount: 1 }),
  Object.freeze({ id: "sleep-bomb", kind: "skill", skillId: "sleep-bomb" }),
  Object.freeze({ id: "mithril-helm", kind: "item", itemId: "mithril-helm" }),
  Object.freeze({ id: "ironclad-1", kind: "trait", traitId: "ironclad", levels: 1 }),
]);

describe("deterministic reward offers", () => {
  it("selects three unique serializable choices reproducibly from a seeded pool", () => {
    const first = createRewardOffer({ seed: "act-1:1", candidates });
    const repeated = createRewardOffer({ seed: "act-1:1", candidates });

    expect(first).toEqual(repeated);
    expect(first.choices).toHaveLength(3);
    expect(new Set(first.choices.map((choice) => choice.id)).size).toBe(3);
    expect(first.refreshesRemaining).toBe(1);
    expect(first.selected).toBe(null);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(candidates).toHaveLength(5);
  });

  it("rejects executable reward content instead of silently cloning callbacks", () => {
    const executable = [
      ...candidates.slice(0, 2),
      { id: "scripted", kind: "skill", apply: () => "mutate-state" },
    ];

    expect(() => createRewardOffer({ seed: 1, candidates: executable })).toThrow(
      "invalid-reward-candidate",
    );
  });

  it("rejects accessor-backed reward content without executing the getter", () => {
    let getterCalls = 0;
    const candidate = { id: "accessor", kind: "stat" };
    Object.defineProperty(candidate, "amount", {
      enumerable: true,
      get: () => { getterCalls += 1; return 1; },
    });

    expect(() => createRewardOffer({
      seed: 1,
      candidates: [...candidates.slice(0, 2), candidate],
    })).toThrow("invalid-reward-candidate");
    expect(getterCalls).toBe(0);
  });

  it("rejects accessor-backed candidate arrays without executing the index getter", () => {
    let getterCalls = 0;
    const pool = [...candidates.slice(0, 3)];
    Object.defineProperty(pool, "1", {
      enumerable: true,
      get: () => { getterCalls += 1; return candidates[1]; },
    });

    expect(() => createRewardOffer({ seed: 1, candidates: pool })).toThrow(
      "invalid-reward-candidate",
    );
    expect(getterCalls).toBe(0);
  });

  it("enforces exactly three choices and one refresh for every reward offer", () => {
    expect(() => createRewardOffer({ seed: 1, candidates, count: 2 })).toThrow(
      "invalid-reward-count",
    );
    expect(() => createRewardOffer({ seed: 1, candidates, refreshes: 2 })).toThrow(
      "invalid-refresh-count",
    );
  });

  it("spends the single refresh reproducibly and rejects further refreshes atomically", () => {
    const initial = createRewardOffer({ seed: "act-1:1", candidates });
    const refreshed = refreshRewardOffer(initial);
    const repeated = refreshRewardOffer(createRewardOffer({ seed: "act-1:1", candidates }));

    expect(refreshed).toEqual(repeated);
    expect(refreshed.ok).toBe(true);
    expect(refreshed.state.refreshesRemaining).toBe(0);
    expect(refreshed.state.choices).not.toEqual(initial.choices);
    expect(new Set(refreshed.state.choices.map((choice) => choice.id)).size).toBe(3);

    expect(refreshRewardOffer(refreshed.state)).toEqual({
      ok: false,
      reason: "reward-refresh-exhausted",
      state: refreshed.state,
    });

    const restored = JSON.parse(JSON.stringify(refreshed.state));
    const exhausted = refreshRewardOffer(restored);
    restored.choices[0].id = "mutated-after-return";
    expect(exhausted.state.choices[0].id).not.toBe("mutated-after-return");
    expect(Object.isFrozen(exhausted.state)).toBe(true);
  });

  it("selects an offered reward exactly once by stable ID", () => {
    const offer = createRewardOffer({ seed: "act-1:1", candidates });
    const rewardId = offer.choices[1].id;
    const selected = selectReward(offer, rewardId);

    expect(selected).toMatchObject({
      ok: true,
      selected: true,
      reward: offer.choices[1],
      state: { selected: rewardId },
    });
    expect(selectReward(selected.state, rewardId)).toEqual({
      ok: true,
      selected: false,
      reward: offer.choices[1],
      state: selected.state,
    });

    const restored = JSON.parse(JSON.stringify(selected.state));
    const retry = selectReward(restored, rewardId);
    restored.choices[1].id = "mutated-input";
    expect(retry.state.choices[1].id).toBe(rewardId);
    expect(retry.reward.id).toBe(rewardId);
    expect(retry.reward).not.toBe(retry.state.choices[1]);
  });

  it("locks the offer against refresh after a reward is selected", () => {
    const offer = createRewardOffer({ seed: "act-1:1", candidates });
    const selected = selectReward(offer, offer.choices[0].id);

    expect(refreshRewardOffer(selected.state)).toEqual({
      ok: false,
      reason: "reward-already-selected",
      state: selected.state,
    });
  });

  it("rejects forged reward state without executing toJSON callbacks", () => {
    const state = JSON.parse(JSON.stringify(createRewardOffer({ seed: 1, candidates })));
    let callbackCalls = 0;
    state.choices[0].toJSON = () => { callbackCalls += 1; return { id: state.choices[0].id }; };

    expect(selectReward(state, state.choices[0].id)).toEqual({
      ok: false,
      reason: "invalid-reward-state",
      state: null,
    });
    expect(callbackCalls).toBe(0);
    JSON.stringify(selectReward(state, state.choices[0].id));
    expect(callbackCalls).toBe(0);
  });

  it("rejects selected state whose receipt is not in the offered choices", () => {
    const state = JSON.parse(JSON.stringify(createRewardOffer({ seed: 1, candidates })));
    state.selected = "not-offered";

    expect(selectReward(state, "not-offered")).toEqual({
      ok: false,
      reason: "invalid-reward-state",
      state: null,
    });
  });
});
