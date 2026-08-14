import { describe, expect, it } from "vitest";
import {
  acquireSkill,
  createSkillState,
  effectMagnitude,
  generalAbilityIds,
  getSkill,
  isSkillState,
  maxRankOf,
  passiveBonuses,
  passiveSkillIds,
  refillForNewAct,
  restoreUses,
  replaceableSkillIds,
  skillIds,
  skillLegality,
  SKILL_SLOTS,
  spendSkill,
  tickSkillCooldown,
  UNLIMITED_USES,
  usesPerAct,
} from "./skills.js";
import {
  SUPPORTED_SKILL_EFFECT_TYPES,
  createTowEncounter,
  useSkill,
} from "./encounter.js";
import { towBuildForCharacter } from "./professions.js";
import { startingPackageIds } from "./starting-packages.js";

describe("the catalogue", () => {
  it("holds five slots, as the wiki records", () => {
    expect(SKILL_SLOTS).toBe(5);
  });

  it("registers all eighteen sourced General abilities without putting them in a starting kit", () => {
    expect(generalAbilityIds()).toHaveLength(18);
    expect(new Set(generalAbilityIds()).size).toBe(18);
    for (const id of generalAbilityIds()) {
      expect(getSkill(id)).toMatchObject({ abilityType: "general", exclusiveTo: null });
      expect(getSkill(id).source.page).toContain("#s-11.1");
    }
  });

  it("transcribes per-rank magnitudes verbatim rather than interpolating", () => {
    // Strike: "(100/115/130/145/160/175)% of attack power".
    expect([1, 2, 3, 4, 5, 6].map((rank) => effectMagnitude("strike", 0, rank)))
      .toEqual([100, 115, 130, 145, 160, 175]);
    // Block: "(250/300/350/400/450/500)% of your armor".
    expect([1, 2, 3, 4, 5, 6].map((rank) => effectMagnitude("block", 0, rank)))
      .toEqual([250, 300, 350, 400, 450, 500]);
    // Mortal Blow: "(210/240/270/300/330)%".
    expect([1, 2, 3, 4, 5].map((rank) => effectMagnitude("mortal-blow", 0, rank)))
      .toEqual([210, 240, 270, 300, 330]);
  });

  it("knows which skills replace a basic action rather than taking a slot", () => {
    expect(getSkill("shield-bash").replaces).toBe("strike");
    expect(getSkill("slaughter").replaces).toBe("strike");
    expect(getSkill("parry").replaces).toBe("block");
    expect(getSkill("defensive-stance").replaces).toBe("block");
    expect(getSkill("strike").replaces).toBeNull();
  });

  it("knows which skills leave the turn open", () => {
    for (const id of ["emergency-evasion", "elixir-of-wrath", "shouting", "sudden-blow",
      "thirst-for-blood", "unbendable-will", "urgent-guard", "warcry", "threatening-cry",
      "judge-of-fate"]) {
      expect(getSkill(id).consumesTurn).toBe(false);
    }
    expect(getSkill("strike").consumesTurn).toBe(true);
    expect(getSkill("sleep-grenade").consumesTurn).toBe(true);
  });

  it("carries the recorded cooldowns", () => {
    expect(getSkill("rapid-cooling").cooldown).toBe(3);
    expect(getSkill("sleep-grenade").cooldown).toBe(6);
    expect(getSkill("judge-of-fate").cooldown).toBe(6);
    expect(getSkill("thirst-for-blood").cooldown).toBe(9);
    expect(getSkill("strike").cooldown).toBe(0);
  });

  it("carries the recorded act limits, including ones that scale with rank", () => {
    expect(usesPerAct("strike")).toBe(UNLIMITED_USES);
    expect(usesPerAct("slaughter")).toBe(UNLIMITED_USES);
    expect(usesPerAct("block")).toBe(30);
    expect(usesPerAct("parry")).toBe(25);
    expect(usesPerAct("incineration")).toBe(1);
    // Defensive Stance: "18/21/24/27/30".
    expect([1, 2, 3, 4, 5].map((rank) => usesPerAct("defensive-stance", rank)))
      .toEqual([18, 21, 24, 27, 30]);
    // Warcry: "4/5/6/7".
    expect([1, 2, 3, 4].map((rank) => usesPerAct("warcry", rank))).toEqual([4, 5, 6, 7]);
  });

  it("returns null for unknown ids", () => {
    expect(getSkill("nonsense")).toBeNull();
    expect(getSkill(null)).toBeNull();
    expect(() => usesPerAct("nonsense")).toThrow(/unknown-skill/);
    expect(() => effectMagnitude("strike", 0, 99)).toThrow(/invalid-skill-rank/);
  });

  it("models multi-part skills as several effects", () => {
    // Slaughter deals damage and bleeds for the same fraction of ATK.
    const slaughter = getSkill("slaughter");
    expect(slaughter.effects).toHaveLength(2);
    expect(slaughter.effects[1]).toMatchObject({ status: "bleed", target: "enemy" });
    // Mortal Blow costs the user a Paralyze.
    expect(getSkill("mortal-blow").effects[1]).toMatchObject({ status: "paralyze", target: "self" });
    // Rapid Cooling paralyses the enemy but gives it a Solidity back.
    expect(getSkill("rapid-cooling").effects.map((e) => e.target)).toEqual(["enemy", "self"]);
  });
});

describe("skill state", () => {
  it("starts an act full and off cooldown", () => {
    expect(createSkillState("block")).toEqual({
      id: "block",
      rank: 1,
      usesRemaining: 30,
      cooldownRemaining: 0,
    });
    expect(createSkillState("strike").usesRemaining).toBe(UNLIMITED_USES);
  });

  it("validates its own shape", () => {
    expect(isSkillState(createSkillState("block"))).toBe(true);
    expect(isSkillState(JSON.parse(JSON.stringify(createSkillState("block"))))).toBe(true);
    expect(isSkillState(null)).toBe(false);
    expect(isSkillState({ id: "block", rank: 1, usesRemaining: 31, cooldownRemaining: 0 })).toBe(false);
    expect(isSkillState({ id: "block", rank: 1, usesRemaining: -1, cooldownRemaining: 0 })).toBe(false);
    expect(isSkillState({ id: "block", rank: 9, usesRemaining: 30, cooldownRemaining: 0 })).toBe(false);
    expect(isSkillState({ id: "nonsense", rank: 1, usesRemaining: 1, cooldownRemaining: 0 })).toBe(false);
    expect(isSkillState({ id: "strike", rank: 1, usesRemaining: 5, cooldownRemaining: 0 })).toBe(false);
    expect(isSkillState({ ...createSkillState("block"), extra: 1 })).toBe(false);
  });

  it("refuses state for an unslotted skill", () => {
    expect(() => createSkillState("power-of-beast")).toThrow(/unslotted/);
  });
});

describe("using a skill", () => {
  it("spends a use and starts the cooldown", () => {
    const spent = spendSkill(createSkillState("sleep-grenade"));
    expect(spent.ok).toBe(true);
    expect(spent.state).toMatchObject({ usesRemaining: 3, cooldownRemaining: 6 });
  });

  it("leaves an unlimited skill unlimited", () => {
    const spent = spendSkill(createSkillState("strike"));
    expect(spent.state.usesRemaining).toBe(UNLIMITED_USES);
  });

  it("is illegal while on cooldown", () => {
    const spent = spendSkill(createSkillState("rapid-cooling")).state;
    expect(skillLegality(spent)).toEqual({ ok: false, reason: "on-cooldown" });
    expect(spendSkill(spent)).toMatchObject({ ok: false, reason: "on-cooldown" });
  });

  it("comes off cooldown one turn at a time", () => {
    let state = spendSkill(createSkillState("rapid-cooling")).state;
    expect(state.cooldownRemaining).toBe(3);
    state = tickSkillCooldown(state);
    state = tickSkillCooldown(state);
    expect(skillLegality(state)).toMatchObject({ ok: false, reason: "on-cooldown" });
    state = tickSkillCooldown(state);
    expect(state.cooldownRemaining).toBe(0);
    expect(skillLegality(state).ok).toBe(true);
    // Ticking past zero does not go negative.
    expect(tickSkillCooldown(state).cooldownRemaining).toBe(0);
  });

  it("is illegal when the act's uses are gone", () => {
    let state = createSkillState("incineration");
    state = spendSkill(state).state;
    expect(state.usesRemaining).toBe(0);
    expect(skillLegality(state)).toEqual({ ok: false, reason: "no-uses-remaining" });
  });

  it("stays legal after the turn is spent only when it does not consume a turn", () => {
    expect(skillLegality(createSkillState("emergency-evasion"), { turnAvailable: false }).ok).toBe(true);
    expect(skillLegality(createSkillState("sleep-grenade"), { turnAvailable: false }))
      .toEqual({ ok: false, reason: "turn-already-spent" });
  });

  it("does not mutate the state it spends", () => {
    const state = createSkillState("block");
    spendSkill(state);
    expect(state.usesRemaining).toBe(30);
  });
});

describe("refilling", () => {
  it("fills uses and clears cooldowns at the start of an act", () => {
    let state = spendSkill(createSkillState("sleep-grenade")).state;
    state = spendSkill({ ...state, cooldownRemaining: 0 }).state;
    expect(state.usesRemaining).toBe(2);
    expect(refillForNewAct(state)).toMatchObject({ usesRemaining: 4, cooldownRemaining: 0 });
  });

  it("tops up partially without exceeding the act limit", () => {
    const spent = { ...createSkillState("block"), usesRemaining: 28 };
    expect(restoreUses(spent, 1).usesRemaining).toBe(29);
    expect(restoreUses(spent, 50).usesRemaining).toBe(30);
    expect(restoreUses(createSkillState("strike"), 5).usesRemaining).toBe(UNLIMITED_USES);
    expect(() => restoreUses(spent, -1)).toThrow(/invalid-restore-amount/);
  });

  it("refills to the rank's limit, not rank one's", () => {
    const ranked = { ...createSkillState("defensive-stance", 5), usesRemaining: 0 };
    expect(refillForNewAct(ranked).usesRemaining).toBe(30);
  });
});

describe("acquiring skills", () => {
  it("upgrades a rank and refills when the skill is already held", () => {
    // Thirst for Blood is recorded as Rare > Epic — two ranks, 16 then 20 Lifesteal.
    const spent = [{ ...createSkillState("thirst-for-blood"), usesRemaining: 1, cooldownRemaining: 4 }];
    const result = acquireSkill(spent, "thirst-for-blood");
    expect(result).toMatchObject({ ok: true, upgraded: true });
    expect(result.loadout[0]).toMatchObject({ rank: 2, usesRemaining: 4, cooldownRemaining: 0 });
    expect(effectMagnitude("thirst-for-blood", 0, 2)).toBe(20);
  });

  it("refills a skill the wiki records at a single rank without inventing one", () => {
    // Sleep Grenade has no documented rank progression, so acquiring it again refills
    // rather than inventing a rank 2 magnitude.
    const spent = [{ ...createSkillState("sleep-grenade"), usesRemaining: 1, cooldownRemaining: 4 }];
    const result = acquireSkill(spent, "sleep-grenade");
    expect(result.loadout[0]).toMatchObject({ rank: 1, usesRemaining: 4, cooldownRemaining: 0 });
  });

  it("stops upgrading at the top rank", () => {
    const top = [createSkillState("strike", maxRankOf("strike"))];
    expect(acquireSkill(top, "strike").loadout[0].rank).toBe(maxRankOf("strike"));
  });

  it("takes over the slot of the action it replaces", () => {
    const loadout = [createSkillState("strike"), createSkillState("block")];
    const result = acquireSkill(loadout, "slaughter");
    expect(result.ok).toBe(true);
    expect(result.loadout.map((entry) => entry.id)).toEqual(["slaughter", "block"]);
    // And a second replacement takes over from the first.
    const again = acquireSkill(result.loadout, "shield-bash");
    expect(again.loadout.map((entry) => entry.id)).toEqual(["shield-bash", "block"]);
  });

  it("fills a free slot when there is one", () => {
    const loadout = [createSkillState("strike"), createSkillState("block")];
    expect(acquireSkill(loadout, "warcry").loadout).toHaveLength(3);
  });

  it("needs a nominated replacement once all five slots are full", () => {
    const loadout = ["strike", "block", "warcry", "impregnable", "penetration"]
      .map((id) => createSkillState(id));
    expect(acquireSkill(loadout, "first-aid"))
      .toMatchObject({ ok: false, reason: "loadout-full" });

    const replaced = acquireSkill(loadout, "first-aid", { replacingId: "penetration" });
    expect(replaced.ok).toBe(true);
    expect(replaced.loadout.map((entry) => entry.id))
      .toEqual(["strike", "block", "warcry", "impregnable", "first-aid"]);

    expect(acquireSkill(loadout, "first-aid", { replacingId: "not-held" }))
      .toMatchObject({ ok: false, reason: "unknown-replacement" });
  });

  it("protects basic and defensive slots while exposing three flexible slots", () => {
    const loadout = [
      "arctic-strike",
      "arctic-block",
      "arctic-deliberate-blow",
      "arctic-incineration",
      "arctic-mortal-blow",
    ].map((id) => createSkillState(id));
    expect(replaceableSkillIds(loadout)).toEqual([
      "arctic-deliberate-blow",
      "arctic-incineration",
      "arctic-mortal-blow",
    ]);
    expect(acquireSkill(loadout, "first-aid", { replacingId: "arctic-strike" }))
      .toMatchObject({ ok: false, reason: "protected-ability-slot" });
    expect(acquireSkill(loadout, "first-aid", { replacingId: "arctic-block" }))
      .toMatchObject({ ok: false, reason: "protected-ability-slot" });
  });

  it("refuses unslotted and unknown skills", () => {
    expect(acquireSkill([], "power-of-beast")).toMatchObject({ ok: false, reason: "unslotted-skill" });
    expect(acquireSkill([], "nonsense")).toMatchObject({ ok: false, reason: "unknown-skill" });
  });

  it("does not mutate the loadout it is given", () => {
    const loadout = [createSkillState("strike")];
    const before = JSON.stringify(loadout);
    acquireSkill(loadout, "warcry");
    acquireSkill(loadout, "strike");
    expect(JSON.stringify(loadout)).toBe(before);
  });
});

describe("unslotted skills", () => {
  it("are permanent stat increases that take no slot", () => {
    expect(passiveSkillIds()).toHaveLength(12);
    expect(getSkill("ascension").slot).toBe("unslotted");
    expect(skillIds()).not.toContain("ascension");
  });

  it("sum into one set of bonuses", () => {
    expect(passiveBonuses(["power-of-beast", "power-of-giant", "crushing-blow"]))
      .toMatchObject({ attack: 8, critRate: 12 });
    expect(passiveBonuses(["ascension"]))
      .toMatchObject({ attack: 3, defense: 3, critRate: 3, dodgeRate: 3 });
    expect(passiveBonuses(["infinite-vitality"]).maxHpPercent).toBe(70);
  });

  it("ignores slotted and unknown ids", () => {
    expect(passiveBonuses(["strike", "nonsense"]))
      .toEqual({ attack: 0, defense: 0, maxHp: 0, critRate: 0, dodgeRate: 0, maxHpPercent: 0 });
    expect(passiveBonuses(null).attack).toBe(0);
  });
});

describe("every catalogue effect reaches the resolver", () => {
  // A skill whose effect the resolver cannot express is worse than a missing skill: the
  // player is offered it, spends a use and a turn, and gets nothing. First Aid shipped in
  // three professions' packages while two of its effects were unimplemented — one of them
  // crashed outright — and nothing caught it until a simulation ran the whole catalogue.
  it("names an effect type the reducer actually implements", () => {
    const unsupported = [];
    for (const skillId of skillIds()) {
      for (const effect of getSkill(skillId).effects) {
        if (!SUPPORTED_SKILL_EFFECT_TYPES.includes(effect.type)) {
          unsupported.push(`${skillId}:${effect.type}`);
        }
      }
    }
    expect(unsupported).toEqual([]);
  });

  it("carries a rank table wherever the resolver reads a magnitude", () => {
    const scaled = ["damage", "shield", "status", "scaled-status", "heal-lost-fraction", "scaled-status-enemy-lost-hp"];
    const missing = [];
    for (const skillId of skillIds()) {
      getSkill(skillId).effects.forEach((effect, index) => {
        if (!scaled.includes(effect.type)) return;
        if (!effect.percentByRank && !effect.countByRank) missing.push(`${skillId}[${index}]`);
      });
    }
    expect(missing).toEqual([]);
  });

  it("can resolve every skill in every starting package without throwing", () => {
    for (const packageId of startingPackageIds()) {
      const build = towBuildForCharacter({ profession: packageId, level: 1 });
      for (const skillId of build.skills) {
        const state = createTowEncounter({
          seed: `catalogue::${packageId}::${skillId}`,
          player: {
            id: "p",
            name: "P",
            maxHp: 100,
            hp: 40,
            statuses: [{ type: "bleed", count: 6 }, { type: "burn", count: 4 }],
            stats: { attack: 12, defense: 9, critRate: 0, dodgeRate: 0 },
          },
          enemies: [{
            id: "foe-0",
            name: "Foe",
            maxHp: 100,
            hp: 55,
            stats: { attack: 5, defense: 2, critRate: 0, dodgeRate: 0 },
            attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 4 }],
          }],
          build,
        });
        expect(() => useSkill(state, skillId, "foe-0")).not.toThrow();
        expect(useSkill(state, skillId, "foe-0").ok).toBe(true);
      }
    }
  });
});
