import { describe, expect, it } from "vitest";
import { startingBuild } from "./build.js";
import {
  REWARD_CHOICE_COUNT,
  claimReward,
  compileRewardOffer,
  grantRune,
  isRewardOffer,
  rerollRewardOffer,
  rewardCandidates,
  rewardSeedFor,
} from "./rewards.js";
import { SKILL_SLOTS, getSkill } from "./skills.js";
import { TRAIT_RANK_CAP } from "./traits.js";

function build() {
  return startingBuild("fighter", { level: 1 });
}

function offerFor(target = build(), seed = "combat-1::reward::7") {
  const compiled = compileRewardOffer(target, { sourceReceiptId: "combat-1", seed });
  if (!compiled.ok) throw new Error(compiled.reason);
  return compiled.offer;
}

describe("compiling an offer", () => {
  it("gives three distinct, well-formed choices", () => {
    const offer = offerFor();
    expect(isRewardOffer(offer)).toBe(true);
    expect(offer.candidates).toHaveLength(REWARD_CHOICE_COUNT);
    expect(new Set(offer.candidates.map((entry) => entry.id)).size).toBe(REWARD_CHOICE_COUNT);
    expect(offer.claimedId).toBe(null);
  });

  it("is reproducible from its seed", () => {
    // A reward nobody can reproduce is a reward nobody can audit when it looks wrong.
    expect(offerFor()).toEqual(offerFor());
    expect(offerFor(build(), "other-seed").candidates)
      .not.toEqual(offerFor().candidates);
  });

  it("draws from the live registries rather than a curated list", () => {
    // A trait or skill added to the game becomes reachable without anyone editing rewards.
    const kinds = new Set(rewardCandidates().map((entry) => entry.kind));
    expect([...kinds].sort()).toEqual(["skill", "trait"]);
    expect(rewardCandidates().length).toBeGreaterThan(50);
  });

  it("never offers something the build cannot take", () => {
    const target = build();
    for (const candidate of offerFor(target).candidates) {
      if (candidate.kind === "skill") {
        expect(target.skills, candidate.id).not.toContain(candidate.id);
        expect(getSkill(candidate.id).slot).toBe("slotted");
      } else {
        expect(target.traits[candidate.id] ?? 0).toBeLessThan(TRAIT_RANK_CAP);
      }
    }
  });

  it("records why a candidate was ruled out", () => {
    const target = build();
    const offer = offerFor(target);
    // The fighter already holds Strike, so it must appear as ineligible with a real reason
    // rather than simply being absent.
    const held = offer.ineligible.find((entry) => entry.id === target.skills[0]);
    expect(held).toMatchObject({ reason: "skill-already-held" });
  });

  it("says so when there is genuinely nothing left to give", () => {
    // A build at every cap has earned being told, rather than handed an empty offer.
    const full = { ...build(), skills: [] };
    const capped = {
      ...full,
      traits: Object.fromEntries(
        Object.keys(full.traits).map((id) => [id, TRAIT_RANK_CAP]),
      ),
      skills: build().skills.slice(0, SKILL_SLOTS),
    };
    const stuffed = { ...capped, skills: Array.from({ length: SKILL_SLOTS }, (_, i) => build().skills[i % build().skills.length]) };
    const compiled = compileRewardOffer(stuffed, { sourceReceiptId: "s", seed: "x" });
    // Either it finds something or it explains itself; it never returns an empty offer.
    if (!compiled.ok) expect(compiled.reason).toBe("no-eligible-rewards");
    else expect(compiled.offer.candidates.length).toBeGreaterThan(0);
  });

  it("refuses inputs it cannot record", () => {
    expect(compileRewardOffer(build(), { sourceReceiptId: "", seed: "s" }).reason)
      .toBe("invalid-reward-source");
    expect(compileRewardOffer(build(), { sourceReceiptId: "s", seed: "" }).reason)
      .toBe("invalid-reward-seed");
    expect(compileRewardOffer(null, { sourceReceiptId: "s", seed: "x" }).reason)
      .toBe("invalid-build");
  });
});

describe("the reroll", () => {
  it("is refused when none was granted", () => {
    expect(rerollRewardOffer(build(), offerFor()))
      .toMatchObject({ ok: false, reason: "no-rerolls-remaining" });
  });

  it("gives different choices and spends the grant", () => {
    const target = build();
    const offer = compileRewardOffer(target, {
      sourceReceiptId: "combat-1", seed: "s", rerolls: 1,
    }).offer;
    const rerolled = rerollRewardOffer(target, offer);
    expect(rerolled.ok).toBe(true);
    expect(rerolled.offer.rerolled).toBe(true);
    expect(rerolled.offer.rerollsRemaining).toBe(0);
    expect(rerolled.offer.candidates).not.toEqual(offer.candidates);
    // Still one offer for one fight, so a claim cannot be made against both.
    expect(rerolled.offer.id).toBe(offer.id);
    expect(rerollRewardOffer(target, rerolled.offer))
      .toMatchObject({ ok: false, reason: "no-rerolls-remaining" });
  });

  it("stays reproducible after rerolling", () => {
    const target = build();
    const offer = compileRewardOffer(target, {
      sourceReceiptId: "combat-1", seed: "s", rerolls: 1,
    }).offer;
    expect(rerollRewardOffer(target, offer).offer)
      .toEqual(rerollRewardOffer(target, offer).offer);
  });

  it("cannot be used after a claim", () => {
    const target = build();
    const offer = compileRewardOffer(target, {
      sourceReceiptId: "combat-1", seed: "s", rerolls: 1,
    }).offer;
    const claimed = claimReward(target, offer, offer.candidates[0].id);
    expect(rerollRewardOffer(claimed.build, claimed.offer))
      .toMatchObject({ ok: false, reason: "reward-already-claimed" });
  });
});

describe("claiming", () => {
  it("writes the choice into the build with provenance", () => {
    const target = build();
    const offer = offerFor(target);
    const choice = offer.candidates[0];
    const claimed = claimReward(target, offer, choice.id);

    expect(claimed.ok).toBe(true);
    expect(claimed.offer.claimedId).toBe(choice.id);
    expect(claimed.provenance).toMatchObject({
      offerId: offer.id,
      sourceReceiptId: "combat-1",
      rulesetId: "solitaire-tow-v1",
      id: choice.id,
    });
    if (choice.kind === "skill") expect(claimed.build.skills).toContain(choice.id);
    else expect(claimed.build.traits[choice.id]).toBeGreaterThanOrEqual(1);
  });

  it("leaves the original build untouched", () => {
    const target = build();
    const before = JSON.stringify(target);
    claimReward(target, offerFor(target), offerFor(target).candidates[0].id);
    expect(JSON.stringify(target)).toBe(before);
  });

  it("absorbs the same claim twice", () => {
    // A double-tap, or a resumed save replaying the click.
    const target = build();
    const offer = offerFor(target);
    const first = claimReward(target, offer, offer.candidates[0].id);
    const again = claimReward(first.build, first.offer, offer.candidates[0].id);
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(again.build).toBe(first.build);
  });

  it("refuses a second, different reward from one offer", () => {
    const target = build();
    const offer = offerFor(target);
    const first = claimReward(target, offer, offer.candidates[0].id);
    expect(claimReward(first.build, first.offer, offer.candidates[1].id))
      .toMatchObject({ ok: false, reason: "reward-already-claimed" });
  });

  it("refuses something that was never offered", () => {
    const offer = offerFor();
    expect(claimReward(build(), offer, "not-on-the-list"))
      .toMatchObject({ ok: false, reason: "reward-not-offered" });
  });

  it("re-checks eligibility at claim time, not just at offer time", () => {
    // The build can move between the offer and the claim; a reward that was legal an hour
    // ago must not write an illegal build now.
    const target = build();
    const offer = offerFor(target);
    const skillChoice = offer.candidates.find((entry) => entry.kind === "skill");
    if (!skillChoice) return;
    const alreadyTaken = { ...target, skills: [...target.skills, skillChoice.id] };
    expect(claimReward(alreadyTaken, offer, skillChoice.id))
      .toMatchObject({ ok: false, reason: "skill-already-held" });
  });

  it("refuses an offer it cannot read", () => {
    expect(claimReward(build(), { nonsense: true }, "x"))
      .toMatchObject({ ok: false, reason: "invalid-reward-offer" });
  });
});

describe("the open-world channel writes the same build", () => {
  it("grants a rune with provenance", () => {
    const granted = grantRune(build(), "rune-of-ash", { sourceReceiptId: "forge-1" });
    expect(granted.ok).toBe(true);
    expect(granted.build.runes).toContain("rune-of-ash");
    expect(granted.provenance).toMatchObject({ kind: "rune", sourceReceiptId: "forge-1" });
  });

  it("refuses a duplicate rune", () => {
    const first = grantRune(build(), "rune-of-ash", { sourceReceiptId: "forge-1" });
    expect(grantRune(first.build, "rune-of-ash", { sourceReceiptId: "forge-2" }))
      .toMatchObject({ ok: false, reason: "rune-already-held" });
  });
});

describe("the seed comes from the fight", () => {
  it("is derived from the session and its reward stream", () => {
    expect(rewardSeedFor("combat-1", { state: 42 })).toBe("combat-1::reward::42");
    expect(rewardSeedFor("combat-1", { state: 43 }))
      .not.toBe(rewardSeedFor("combat-1", { state: 42 }));
  });
});
