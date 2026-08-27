import { describe, expect, it } from "vitest";
import { createTowBuild, isTowBuild, startingBuild } from "./build.js";
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
import { SKILL_SLOTS, getSkill, maxRankOf, skillIds } from "./skills.js";
import { getStartingArchetype } from "./starting-archetypes.js";
import { TRAIT_RANK_CAP } from "./traits.js";

function build() {
  return startingBuild("fighter", { level: 1 });
}

function offerFor(target = build(), seed = "combat-1::reward::7") {
  const compiled = compileRewardOffer(target, { sourceReceiptId: "combat-1", seed });
  if (!compiled.ok) throw new Error(compiled.reason);
  return compiled.offer;
}

function fullArchetypeBuild() {
  const archetype = getStartingArchetype("arctic-knight");
  return createTowBuild({ ...archetype.build, professionId: archetype.professionId });
}

function offerWithReplacement(target = fullArchetypeBuild()) {
  for (let index = 0; index < 40; index += 1) {
    const offer = offerFor(target, `replacement-seed-${index}`);
    if (offer.candidates.some((candidate) => candidate.kind === "skill")) return offer;
  }
  throw new Error("no-general-replacement-offer");
}

function offerWithSkill(target, predicate) {
  for (let index = 0; index < 500; index += 1) {
    const offer = offerFor(target, `catalogue-skill-seed-${index}`);
    const choice = offer.candidates.find((candidate) => (
      candidate.kind === "skill" && predicate(getSkill(candidate.id))
    ));
    if (choice) return { offer, choice };
  }
  throw new Error("no-matching-skill-offer");
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

  it("accepts a canonical offer after JSON storage reorders candidate keys", () => {
    const target = build();
    const offer = offerFor(target, "json-key-order");
    const reordered = {
      ...offer,
      candidates: offer.candidates.map((candidate) => (
        Object.fromEntries(Object.entries(candidate).reverse())
      )),
    };

    expect(reordered.checksum).toBe(offer.checksum);
    expect(isRewardOffer(reordered)).toBe(true);
    expect(claimReward(target, reordered, reordered.candidates[0].id).ok).toBe(true);
  });

  it("rejects a persisted offer whose deterministic candidates were substituted", () => {
    const target = build();
    const offer = offerFor(target, "candidate-binding");
    const offeredIds = new Set(offer.candidates.map((candidate) => candidate.id));
    const substituted = rewardCandidates().find((candidate) => !offeredIds.has(candidate.id));
    const tampered = {
      ...offer,
      candidates: [{ ...substituted, requiresReplacement: false }],
    };

    expect(isRewardOffer(tampered)).toBe(false);
    expect(claimReward(target, tampered, substituted.id))
      .toMatchObject({ ok: false, reason: "invalid-reward-offer" });
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
    const target = createTowBuild({
      ...build(),
      skills: build().skills.map((skill) => (
        skill.id === "strike" ? { ...skill, rank: getSkill(skill.id).rankCount } : skill
      )),
    });
    const offer = offerFor(target);
    const held = offer.ineligible.find((entry) => entry.id === "strike");
    expect(held).toMatchObject({ reason: "skill-at-rank-cap" });
  });

  it("offers General and same-character exclusive abilities, never foreign exclusives", () => {
    const target = fullArchetypeBuild();
    const seen = [];
    for (let index = 0; index < 80; index += 1) {
      const offer = offerFor(target, `roster-catalogue-${index}`);
      for (const candidate of offer.candidates.filter((entry) => entry.kind === "skill")) {
        const skill = getSkill(candidate.id);
        seen.push(skill);
        expect([null, "arctic-knight"]).toContain(skill.exclusiveTo);
        expect(candidate.requiresReplacement).toBe(candidate.currentRank === undefined);
      }
    }
    expect(seen.some((skill) => skill.abilityType === "general")).toBe(true);
    expect(seen.some((skill) => skill.exclusiveTo === "arctic-knight")).toBe(true);
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
  it("promotes every live ability through its maximum and survives JSON", () => {
    for (const id of skillIds()) {
      let target = createTowBuild({
        professionId: "fighter",
        traits: { ironclad: 1 },
        skills: [{ id, rank: 1 }],
        runes: [],
      });
      let finalUnclaimedOffer = null;
      for (let rank = 2; rank <= maxRankOf(id); rank += 1) {
        const { offer } = offerWithSkill(target, (skill) => skill.id === id);
        if (rank === maxRankOf(id)) finalUnclaimedOffer = offer;
        const claimed = claimReward(target, offer, id);
        expect(claimed.ok, `${id} rank ${rank}`).toBe(true);
        target = claimed.build;
        expect(target.skills).toEqual([{ id, rank }]);
      }

      const restored = JSON.parse(JSON.stringify(target));
      expect(isTowBuild(restored), id).toBe(true);
      expect(restored.skills).toEqual([{ id, rank: maxRankOf(id) }]);
      if (finalUnclaimedOffer) {
        expect(claimReward(target, finalUnclaimedOffer, id), id)
          .toMatchObject({ ok: false, reason: "skill-at-rank-cap" });
      }
    }
  });

  it("promotes an already-owned skill without consuming or replacing a slot", () => {
    const target = createTowBuild({
      professionId: "fighter",
      traits: { ironclad: 1 },
      skills: [{ id: "strike", rank: 1 }],
      runes: [],
    });
    const { offer, choice } = offerWithSkill(target, (skill) => skill.id === "strike");

    expect(choice).toMatchObject({
      id: "strike",
      currentRank: 1,
      nextRank: 2,
      requiresReplacement: false,
    });
    const claimed = claimReward(target, offer, "strike", { replacingId: "stale-ui-slot" });

    expect(claimed.ok).toBe(true);
    expect(claimed.build.skills).toEqual([{ id: "strike", rank: 2 }]);
    expect(claimed.provenance).toMatchObject({ id: "strike", rank: 2, replacedId: null });
  });

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
      rulesetId: "solitaire-tow-v1.3",
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
    const alreadyTaken = createTowBuild({
      ...target,
      skills: [
        ...target.skills,
        { id: skillChoice.id, rank: getSkill(skillChoice.id).rankCount },
      ],
    });
    expect(claimReward(alreadyTaken, offer, skillChoice.id))
      .toMatchObject({ ok: false, reason: "skill-at-rank-cap" });
  });

  it("takes a shared reward by replacing only one of the three flexible abilities", () => {
    const target = fullArchetypeBuild();
    const { offer, choice } = offerWithSkill(target, (skill) => skill.abilityType === "general");

    expect(claimReward(target, offer, choice.id))
      .toMatchObject({ ok: false, reason: "replacement-required" });
    expect(claimReward(target, offer, choice.id, { replacingId: target.skills[0].id }))
      .toMatchObject({ ok: false, reason: "protected-ability-slot" });
    expect(claimReward(target, offer, choice.id, { replacingId: target.skills[1].id }))
      .toMatchObject({ ok: false, reason: "protected-ability-slot" });

    const replacedId = target.skills[2].id;
    const claimed = claimReward(target, offer, choice.id, { replacingId: replacedId });
    expect(claimed.ok).toBe(true);
    expect(claimed.build.skills).toHaveLength(SKILL_SLOTS);
    expect(claimed.build.skills.slice(0, 2)).toEqual(target.skills.slice(0, 2));
    expect(claimed.build.skills).toContainEqual({ id: choice.id, rank: 1 });
    expect(claimed.build.skills.map((skill) => skill.id)).not.toContain(replacedId);
    expect(claimed.provenance.replacedId).toBe(replacedId);
  });

  it("can offer and claim an alternate Basic Attack without moving the other four slots", () => {
    const target = fullArchetypeBuild();
    const { offer, choice } = offerWithSkill(
      target,
      (skill) => skill.exclusiveTo === "arctic-knight" && skill.abilityType === "basic-attack",
    );

    expect(choice.detail).toContain("replaces the Basic Attack slot");
    expect(claimReward(target, offer, choice.id, { replacingId: target.skills[2].id }))
      .toMatchObject({ ok: false, reason: "incompatible-ability-slot" });

    const claimed = claimReward(target, offer, choice.id, { replacingId: target.skills[0].id });
    expect(claimed.ok).toBe(true);
    expect(claimed.build.skills[0]).toEqual({ id: choice.id, rank: 1 });
    expect(claimed.build.skills.slice(1)).toEqual(target.skills.slice(1));
  });

  it("replaces a legacy compatibility Basic Attack even before the loadout is full", () => {
    const target = createTowBuild({
      professionId: "fighter",
      traits: { ironclad: 1 },
      skills: ["strike", "block", "warcry"],
      runes: [],
    });
    const offer = compileRewardOffer(target, {
      sourceReceiptId: "legacy-fight",
      seed: "legacy-31",
    }).offer;
    const choice = offer.candidates.find((candidate) => candidate.id === "arctic-strike");
    expect(choice).toBeTruthy();

    const claimed = claimReward(target, offer, choice.id);

    expect(claimed.ok).toBe(true);
    expect(claimed.build.skills.map((entry) => entry.id)).toEqual([
      "arctic-strike", "block", "warcry",
    ]);
    expect(claimed.provenance.replacedId).toBe("strike");
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
