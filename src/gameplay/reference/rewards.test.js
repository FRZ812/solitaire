import { describe, expect, it } from "vitest";
import { isJsonData } from "../kernel/json-data.js";
import { getActionProgressionOffer } from "./actions.js";
import { getReferenceTrait } from "./abilities.js";
import { getReferenceItem } from "./items.js";
import { getReferenceReward, REFERENCE_REWARDS, referenceRewardIds } from "./rewards.js";

describe("reference reward catalogue", () => {
  it("contains unique callback-free entries backed by their upstream registries", () => {
    expect(new Set(referenceRewardIds()).size).toBe(REFERENCE_REWARDS.length);
    expect(REFERENCE_REWARDS.length).toBeGreaterThan(3);
    expect(isJsonData(REFERENCE_REWARDS)).toBe(true);

    for (const reward of REFERENCE_REWARDS) {
      expect(getReferenceReward(reward.id)).toBe(reward);
      if (reward.kind === "action") expect(getActionProgressionOffer(reward.actionOfferId)).not.toBeNull();
      if (reward.kind === "item") expect(getReferenceItem(reward.itemId)).not.toBeNull();
      if (reward.kind === "trait") expect(getReferenceTrait(reward.traitId)).not.toBeNull();
    }
  });

  it.each(["missing", "toString", "constructor", "__proto__"])(
    "rejects non-catalogue reward id %s",
    (rewardId) => expect(getReferenceReward(rewardId)).toBeNull(),
  );
});
