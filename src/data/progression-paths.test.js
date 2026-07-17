import { describe, expect, it } from "vitest";
import {
  PATH_GRADE_CAPS,
  METAMAGIC_FEATURES,
  PROFESSION_BRANCHES,
  PROFESSION_BUILDS,
  PROFESSION_LEVEL_CAP,
  PROFESSION_PROFILES,
  RACIAL_LEVEL_CAP,
  canonicalProfessionId,
  canonicalProfessionIdentity,
  compileCharacterProgression,
  compileProfessionTrack,
  compileRacialTrack,
  pendingProfessionChoices,
  pendingRacialBranchChoices,
  professionBranchChoices,
  validateProgressionCatalog,
  professionContentStatus,
} from "./progression-paths.js";

describe("progression v2 catalogs", () => {
  it("validates every path, branch capability, typed grant, and ability id", () => {
    expect(validateProgressionCatalog()).toEqual([]);
  });

  it("compiles independent 70-rank profession and 30-rank racial tracks", () => {
    for (const professionId of Object.keys(PROFESSION_BUILDS)) {
      const compiled = compileProfessionTrack(professionId);
      expect(compiled.totalLevels, professionId).toBe(PROFESSION_LEVEL_CAP);
      expect(compiled.levels).toHaveLength(70);
      expect(compiled.levels.every((row) => row.kind === "profession" && row.rank <= row.maxRank)).toBe(true);
    }
    const vampire = compileRacialTrack("vampire");
    expect(vampire.totalLevels).toBe(RACIAL_LEVEL_CAP);
    expect(vampire.levels).toHaveLength(30);
    expect(vampire.stages).toEqual(["Lesser Vampire", "Vampire", "True Vampire"]);
    expect(vampire.segments.map((segment) => segment.pathName)).toEqual(vampire.stages);
  });

  it("retains small internal path caps", () => {
    expect(PATH_GRADE_CAPS).toEqual({ standard: 15, advanced: 10, specialized: 5 });
    const fighter = compileProfessionTrack("fighter");
    expect(fighter.segments.map((segment) => segment.ranks)).toEqual([15, 15, 10, 10, 10, 5, 5]);
  });

  it("allows one profession to consume all 70 levels", () => {
    const compiled = compileCharacterProgression({ professions: [{ professionId: "wizard", levels: 70 }] });
    expect(compiled.professionLevels).toBe(70);
    expect(compiled.racialLevels).toBe(0);
    expect(compiled.totalLevels).toBe(70);
  });

  it("supports multiclass allocations plus a separately capped race", () => {
    const compiled = compileCharacterProgression({
      professions: [
        { professionId: "wizard", levels: 35 },
        { professionId: "cleric", levels: 25 },
        { professionId: "artisan", levels: 10 },
      ],
      racial: { raceId: "vampire", levels: 30 },
    });
    expect(compiled).toMatchObject({ professionLevels: 70, racialLevels: 30, totalLevels: 100 });
    expect(() => compileCharacterProgression({ professions: [{ professionId: "wizard", levels: 71 }] })).toThrow(/exceed 70/);
    expect(() => compileCharacterProgression({ professions: [{ professionId: "wizard", levels: 70 }], racial: { raceId: "vampire", levels: 31 } })).toThrow(/exceed 30/);
  });

  it("maps old titles to generalized professions while preserving specialization identity", () => {
    expect(canonicalProfessionId("Archmage")).toBe("wizard");
    expect(canonicalProfessionId("Demon Warlock")).toBe("warlock");
    expect(canonicalProfessionId("High Sorcerer")).toBe("sorcerer");
    expect(canonicalProfessionId("Hedge Mage")).toBe("wizard");
    expect(canonicalProfessionId("Temple Arms")).toBe("monk");
    expect(canonicalProfessionId("Clan Champion")).toBe("barbarian");
    expect(canonicalProfessionIdentity("Enchanter Tyrant")).toEqual({ professionId: "wizard", specializationId: "enchanter-tyrant" });
    expect(canonicalProfessionIdentity("Open Hand")).toEqual({ professionId: "monk", specializationId: "open-hand" });
    expect(canonicalProfessionIdentity("Reaver")).toEqual({ professionId: "barbarian", specializationId: "reaver" });
    expect(canonicalProfessionIdentity("barbarian")).toEqual({ professionId: "barbarian", specializationId: null });
    expect(canonicalProfessionIdentity("monk")).toEqual({ professionId: "monk", specializationId: null });
    expect(canonicalProfessionIdentity("wizard")).toEqual({ professionId: "wizard", specializationId: null });
  });

  it("keeps general progression and branch overlays separate", () => {
    const wizard = compileProfessionTrack("wizard", { branchChoices: { "wizard-school": "evocation" } });
    const threshold = wizard.levels[9];
    expect(threshold).toMatchObject({ authoredContent: true, feature: "School Declaration" });
    expect(threshold.branchGrants).toEqual(expect.arrayContaining([expect.objectContaining({ type: "ability", id: "combust" })]));
    expect(threshold.grants).toEqual([...threshold.generalGrants, ...threshold.branchGrants]);
  });

  it("authors gated nested branches for every profession", () => {
    for (const professionId of Object.keys(PROFESSION_BUILDS)) {
      const branches = professionBranchChoices(professionId);
      expect(branches.length, professionId).toBeGreaterThanOrEqual(3);
      const root = branches.find((entry) => !entry.parentChoiceId);
      expect(root, professionId).toBeTruthy();
      for (const option of root.options) {
        const child = branches.find((entry) => entry.parentChoiceId === root.id && entry.parentOptionId === option.id);
        expect(child, `${professionId}/${option.id}`).toBeTruthy();
      }
      for (const branch of branches) for (const option of branch.options) {
        expect(option.grants.some((grant) => ["ability", "action", "passive"].includes(grant.type)), `${professionId}/${option.id}`).toBe(true);
      }
    }
    expect(Object.keys(PROFESSION_BRANCHES)).toEqual(expect.arrayContaining(Object.keys(PROFESSION_BUILDS)));
  });

  it("requires Wizard choices and reveals nested Necromancy decisions in order", () => {
    expect(pendingProfessionChoices({ professionId: "wizard", levels: 10, paths: {}, branchChoices: {} }).map((entry) => entry.id)).toEqual(["wizard-school"]);
    expect(pendingProfessionChoices({ professionId: "wizard", levels: 30, branchChoices: { "wizard-school": "necromancy" } }).map((entry) => entry.id)).toEqual(["necromancy-discipline"]);
    expect(pendingProfessionChoices({ professionId: "wizard", levels: 50, branchChoices: { "wizard-school": "necromancy", "necromancy-discipline": "death-magic" } }).map((entry) => entry.id)).toEqual(["death-magic-mastery"]);
    const deathMage = compileProfessionTrack("wizard", { branchChoices: {
      "wizard-school": "necromancy", "necromancy-discipline": "death-magic", "death-magic-mastery": "instant-death",
    } });
    expect(deathMage.levels[49].branchGrants).toEqual(expect.arrayContaining([expect.objectContaining({ type: "ability", id: "grasp-heart" })]));
  });

  it("keeps racial branches separate from the uninterrupted 30-level ancestry ladder", () => {
    expect(pendingRacialBranchChoices("vampire", 10, {}).map((entry) => entry.id)).toEqual(["vampire-dark-legacy"]);
    const vampire = compileRacialTrack("vampire", { branchChoices: { "vampire-dark-legacy": "night-stalker" } });
    expect(vampire.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(vampire.levels[15]).toMatchObject({ feature: "Vampire" });
    expect(vampire.levels[25]).toMatchObject({ feature: "True Vampire" });
    expect(vampire.levels[9].branchGrants.length).toBeGreaterThan(0);
    expect(vampire.levels[9].grants).toEqual([...vampire.levels[9].generalGrants, ...vampire.levels[9].branchGrants]);
  });

  it("gives Wizard broad spell access but leaves Sorcerer signature and metamagic choices unresolved", () => {
    const wizard = compileProfessionTrack("wizard");
    const sorcerer = compileProfessionTrack("sorcerer");
    const wizardAbilities = wizard.levels.flatMap((row) => row.generalGrants).filter((grant) => grant.type === "ability");
    const unresolved = sorcerer.levels.flatMap((row) => row.generalGrants).filter((grant) => grant.type.endsWith("choice"));
    expect(new Set(wizardAbilities.map((grant) => grant.id)).size).toBeGreaterThanOrEqual(12);
    expect(sorcerer.levels.flatMap((row) => row.generalGrants).filter((grant) => grant.type === "ability")).toEqual([]);
    expect(unresolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "sorcerer-signature-spell", type: "ability-choice" }),
      expect.objectContaining({ id: "sorcerer-metamagic-1", type: "metamagic-choice" }),
      expect.objectContaining({ id: "sorcerer-signature-exchange-25", replace: true }),
    ]));
    const resolved = compileProfessionTrack("sorcerer", { choices: { signatureSpellId: "fireball", metamagicIds: ["empowered-signature"] } });
    expect(resolved.levels[0].generalGrants).toContainEqual(expect.objectContaining({ type: "ability", id: "fireball", signature: true }));
    expect(resolved.levels[9].generalGrants).toContainEqual(expect.objectContaining({ type: "metamagic", id: "empowered-signature" }));
  });

  it("authors Cleric as a broad prepared liturgy narrower than Wizard and broader than Sorcerer", () => {
    const wizard = compileProfessionTrack("wizard");
    const cleric = compileProfessionTrack("cleric");
    const sorcerer = compileProfessionTrack("sorcerer");
    const distinctGeneralAbilities = (track) => new Set(track.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const wizardAbilities = distinctGeneralAbilities(wizard);
    const clericAbilities = distinctGeneralAbilities(cleric);
    const sorcererSpellSlots = sorcerer.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability-choice" && !grant.replace);

    expect(cleric.levels).toHaveLength(70);
    expect(new Set(cleric.levels.map((row) => row.feature)).size).toBe(70);
    expect(cleric.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(cleric.levels.every((row) => row.generalGrants.some((grant) => ["ability", "action", "passive"].includes(grant.type)))).toBe(true);
    expect([...clericAbilities]).toHaveLength(12);
    expect(clericAbilities.size).toBeLessThan(wizardAbilities.size);
    expect(clericAbilities.size).toBeGreaterThan(sorcererSpellSlots.length);
    expect(cleric.levels.flatMap((row) => row.generalGrants).filter((grant) => grant.id?.startsWith("cleric:prayer-circle-")))
      .toHaveLength(10);
    expect(professionContentStatus("cleric")).toBe("complete");
  });

  it("gives all eight Cleric domains complete parent-specific L30 and L50 trees", () => {
    const branches = professionBranchChoices("cleric");
    const root = branches.find((choice) => choice.id === "sacred-domain");
    expect(root.options.map((option) => option.id)).toEqual([
      "life", "light", "war", "grave", "knowledge", "tempest", "nature", "trickery",
    ]);
    expect(branches).toHaveLength(25);
    for (const domain of root.options) {
      const ministry = branches.find((choice) => choice.parentChoiceId === root.id && choice.parentOptionId === domain.id);
      expect(ministry, domain.id).toBeTruthy();
      expect(ministry.options, domain.id).toHaveLength(2);
      for (const option of ministry.options) {
        const apotheosis = branches.find((choice) => choice.parentChoiceId === ministry.id && choice.parentOptionId === option.id);
        expect(apotheosis, `${domain.id}/${option.id}`).toBeTruthy();
        expect(apotheosis.options, `${domain.id}/${option.id}`).toHaveLength(2);
      }
    }
  });

  it("reveals Cleric domain, ministry, and apotheosis choices in order without re-granting general prayers", () => {
    expect(pendingProfessionChoices({ professionId: "cleric", levels: 10, branchChoices: {} }).map((entry) => entry.id)).toEqual(["sacred-domain"]);
    expect(pendingProfessionChoices({ professionId: "cleric", levels: 30, branchChoices: { "sacred-domain": "knowledge" } }).map((entry) => entry.id)).toEqual(["knowledge-ministry"]);
    expect(pendingProfessionChoices({ professionId: "cleric", levels: 50, branchChoices: {
      "sacred-domain": "knowledge", "knowledge-ministry": "oracle-ministry",
    } }).map((entry) => entry.id)).toEqual(["oracle-ministry-apotheosis"]);

    const generalAbilityIds = new Set(compileProfessionTrack("cleric").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    for (const choice of professionBranchChoices("cleric")) for (const option of choice.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(generalAbilityIds.has(grant.id), `${choice.id}/${option.id}/${grant.id}`).toBe(false);
      }
    }

    const knowledgeOracle = compileProfessionTrack("cleric", { branchChoices: {
      "sacred-domain": "knowledge", "knowledge-ministry": "oracle-ministry",
      "oracle-ministry-apotheosis": "counsel-of-the-crossroads",
    } });
    const tempestStorm = compileProfessionTrack("cleric", { branchChoices: {
      "sacred-domain": "tempest", "tempest-ministry": "storm-ministry",
      "storm-ministry-apotheosis": "thunder-hierophant",
    } });
    expect(knowledgeOracle.levels[29].branchGrants).toContainEqual(expect.objectContaining({ id: "cleric:oracular-consultation", type: "action" }));
    expect(tempestStorm.levels[29].branchGrants).toContainEqual(expect.objectContaining({ id: "storm-rebuke", type: "ability" }));
    expect(knowledgeOracle.levels.flatMap((row) => row.branchGrants).map((grant) => grant.id)).not.toContain("storm-rebuke");
  });

  it("authors 70 unique Warrior levels as native nonmagical martial mastery", () => {
    const warrior = compileProfessionTrack("fighter");
    const grantedAbilities = warrior.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(warrior.levels).toHaveLength(70);
    expect(new Set(warrior.levels.map((row) => row.feature)).size).toBe(70);
    expect(warrior.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(warrior.levels.every((row) => row.generalGrants.some((grant) => ["ability", "action", "passive"].includes(grant.type)))).toBe(true);
    expect(grantedAbilities).toEqual([
      "warrior-measured-strike",
      "warrior-guarded-cut",
      "warrior-passing-step",
      "warrior-weapon-bind",
      "warrior-turning-parry",
      "warrior-sweeping-denial",
      "warrior-break-guard",
      "warrior-masterstroke",
      "warrior-iron-sequence",
      "warrior-adaptive-form",
      "warrior-veteran-reversal",
      "warrior-perfect-technique",
    ]);
    expect(PROFESSION_PROFILES.fighter).toMatchObject({ name: "Warrior", abilities: grantedAbilities });
    expect(grantedAbilities.every((id) => id.startsWith("warrior-"))).toBe(true);
    expect(professionContentStatus("fighter")).toBe("complete");
  });

  it("gives every Warrior specialization its own L30 doctrine and L50 outcomes", () => {
    const branches = professionBranchChoices("fighter");
    const root = branches.find((entry) => entry.id === "warrior-specialization");
    expect(root.options.map((option) => option.id)).toEqual([
      "sellsword", "duelist", "iron-vanguard", "undying-champion",
    ]);
    expect(branches).toHaveLength(13);
    for (const specialization of root.options) {
      const doctrine = branches.find((entry) => (
        entry.threshold === 30
        && entry.parentChoiceId === root.id
        && entry.parentOptionId === specialization.id
      ));
      expect(doctrine, specialization.id).toBeTruthy();
      expect(doctrine.options, specialization.id).toHaveLength(2);
      for (const option of doctrine.options) {
        const apotheosis = branches.find((entry) => (
          entry.threshold === 50
          && entry.parentChoiceId === doctrine.id
          && entry.parentOptionId === option.id
        ));
        expect(apotheosis, `${specialization.id}/${option.id}`).toBeTruthy();
        expect(apotheosis.options, `${specialization.id}/${option.id}`).toHaveLength(2);
      }
    }
  });

  it("gates Warrior doctrine and apotheosis in sequence without borrowing other professions", () => {
    expect(pendingProfessionChoices({ professionId: "fighter", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["warrior-specialization"]);
    expect(pendingProfessionChoices({ professionId: "fighter", levels: 30, branchChoices: {
      "warrior-specialization": "duelist",
    } }).map((entry) => entry.id)).toEqual(["duelist-method"]);
    expect(pendingProfessionChoices({ professionId: "fighter", levels: 50, branchChoices: {
      "warrior-specialization": "duelist", "duelist-method": "counterfencer",
    } }).map((entry) => entry.id)).toEqual(["counterfencer-apotheosis"]);

    const generalIds = new Set(compileProfessionTrack("fighter").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const forbiddenIds = new Set([
      "power-strike", "cleave", "earthshatter", "reaping", "bulwark-stance", "execute",
      "rapid-jabs", "feint", "lunge", "shadowstep", "whirlwind", "unbreakable-will", "second-wind",
    ]);
    for (const branchChoice of professionBranchChoices("fighter")) for (const option of branchChoice.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(grant.id, `${branchChoice.id}/${option.id}`).toMatch(/^warrior-/);
        expect(generalIds.has(grant.id), `${branchChoice.id}/${option.id}/${grant.id}`).toBe(false);
        expect(forbiddenIds.has(grant.id), `${branchChoice.id}/${option.id}/${grant.id}`).toBe(false);
      }
    }
  });

  it("authors 70 unique Monk levels around unarmed target-side Posture Strain", () => {
    const monk = compileProfessionTrack("monk");
    const grantedAbilities = monk.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(monk.levels).toHaveLength(70);
    expect(new Set(monk.levels.map((row) => row.feature)).size).toBe(70);
    expect(monk.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(monk.levels.every((row) => row.generalGrants.some((grant) => ["ability", "action", "passive"].includes(grant.type)))).toBe(true);
    expect(grantedAbilities).toEqual([
      "monk-measured-palm",
      "monk-three-beat-strike",
      "monk-yielding-guard",
      "monk-joint-check",
      "monk-reaping-kick",
      "monk-crossing-step",
      "monk-posture-break",
      "monk-cascade-blows",
      "monk-resonant-impact",
      "monk-shoulder-throw",
      "monk-ascending-knee",
      "monk-perfect-impact",
    ]);
    expect(PROFESSION_PROFILES.monk).toMatchObject({ name: "Monk", abilities: grantedAbilities });
    expect(grantedAbilities.every((id) => id.startsWith("monk-"))).toBe(true);
    expect(monk.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "monk:posture-strain", targetSide: true, postureStrainMax: 3,
    }));
    expect(professionContentStatus("monk")).toBe("complete");
  });

  it("gives every Monk discipline its own L30 method and L50 physical outcomes", () => {
    const branches = professionBranchChoices("monk");
    const root = branches.find((entry) => entry.id === "monk-discipline");
    expect(root.options.map((option) => option.id)).toEqual([
      "open-hand", "iron-body", "wind-step", "temple-arms",
    ]);
    expect(branches).toHaveLength(13);
    for (const discipline of root.options) {
      const method = branches.find((entry) => (
        entry.threshold === 30
        && entry.parentChoiceId === root.id
        && entry.parentOptionId === discipline.id
      ));
      expect(method, discipline.id).toBeTruthy();
      expect(method.options, discipline.id).toHaveLength(2);
      for (const option of method.options) {
        const apotheosis = branches.find((entry) => (
          entry.threshold === 50
          && entry.parentChoiceId === method.id
          && entry.parentOptionId === option.id
        ));
        expect(apotheosis, `${discipline.id}/${option.id}`).toBeTruthy();
        expect(apotheosis.options, `${discipline.id}/${option.id}`).toHaveLength(2);
      }
    }

    const weaponRoots = root.options.filter((option) => option.grants.some((grant) => grant.weaponPermitted));
    expect(weaponRoots.map((option) => option.id)).toEqual(["temple-arms"]);
    expect(weaponRoots[0].grants.find((grant) => grant.weaponPermitted).weaponFamilies)
      .toEqual(["staff", "spear", "sword"]);
  });

  it("gates Monk methods in sequence and never grants another profession's cards", () => {
    expect(pendingProfessionChoices({ professionId: "monk", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["monk-discipline"]);
    expect(pendingProfessionChoices({ professionId: "monk", levels: 30, branchChoices: {
      "monk-discipline": "open-hand",
    } }).map((entry) => entry.id)).toEqual(["open-hand-method"]);
    expect(pendingProfessionChoices({ professionId: "monk", levels: 50, branchChoices: {
      "monk-discipline": "open-hand", "open-hand-method": "joint-weaver",
    } }).map((entry) => entry.id)).toEqual(["joint-weaver-apotheosis"]);

    const generalIds = new Set(compileProfessionTrack("monk").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const retired = new Set(["rapid-jabs", "battle-focus", "second-wind", "lunge", "unbreakable-will"]);
    expect(PROFESSION_PROFILES.monk.abilities.some((id) => retired.has(id))).toBe(false);
    for (const definition of professionBranchChoices("monk")) for (const option of definition.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(grant.id, `${definition.id}/${option.id}`).toMatch(/^monk-/);
        expect(generalIds.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(retired.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
      }
    }
  });

  it("authors 70 unique Barbarian levels around self-side five-count Fury", () => {
    const barbarian = compileProfessionTrack("barbarian");
    const grantedAbilities = barbarian.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(barbarian.levels).toHaveLength(70);
    expect(new Set(barbarian.levels.map((row) => row.feature)).size).toBe(70);
    expect(barbarian.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(barbarian.levels.every((row) => row.generalGrants.some((grant) => ["ability", "action", "passive"].includes(grant.type)))).toBe(true);
    expect(grantedAbilities).toEqual([
      "barbarian-brutal-swing",
      "barbarian-bait-the-blow",
      "barbarian-fury-hewn-strike",
      "barbarian-reckless-onslaught",
      "barbarian-savage-reprisal",
      "barbarian-crashing-advance",
      "barbarian-armour-crumpler",
      "barbarian-great-arc",
      "barbarian-grit-through",
      "barbarian-ruinous-collision",
      "barbarian-unrelenting-assault",
      "barbarian-world-shaking-blow",
    ]);
    expect(PROFESSION_PROFILES.barbarian).toMatchObject({ name: "Barbarian", abilities: grantedAbilities });
    expect(grantedAbilities.every((id) => id.startsWith("barbarian-"))).toBe(true);
    expect(barbarian.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "barbarian:fury",
      selfSide: true,
      furyMax: 5,
      furyGainPerAction: 1,
      furyTrigger: "hostile-direct-damage",
      resetsEachFight: true,
    }));
    expect(barbarian.levels[69].feature).toBe("World-Shaking Blow");
    expect(professionContentStatus("barbarian")).toBe("complete");
  });

  it("gives every Barbarian Fury path its own L30 method and two L50 physical apexes", () => {
    const branches = professionBranchChoices("barbarian");
    const root = branches.find((entry) => entry.id === "barbarian-fury-path");
    expect(root.options.map((option) => option.id)).toEqual([
      "reaver", "berserker", "juggernaut", "clan-champion",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30).map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "reaver-method": ["blood-trail", "wide-ruin"],
      "berserker-method": ["pain-eater", "red-haze"],
      "juggernaut-method": ["living-ram", "mountain-frame"],
      "clan-champion-method": ["foe-caller", "war-cry"],
    });
    for (const path of root.options) {
      const method = branches.find((entry) => entry.threshold === 30
        && entry.parentChoiceId === root.id && entry.parentOptionId === path.id);
      expect(method, path.id).toBeTruthy();
      expect(method.options, path.id).toHaveLength(2);
      for (const option of method.options) {
        const apex = branches.find((entry) => entry.threshold === 50
          && entry.parentChoiceId === method.id && entry.parentOptionId === option.id);
        expect(apex, `${path.id}/${option.id}`).toBeTruthy();
        expect(apex.options, `${path.id}/${option.id}`).toHaveLength(2);
        expect(apex.options.flatMap((entry) => entry.grants).some((grant) => grant.type === "ability"), apex.id).toBe(false);
      }
    }
    const branchAbilities = branches.flatMap((entry) => entry.options)
      .flatMap((option) => option.grants).filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(branchAbilities).toHaveLength(12);
    expect(new Set(branchAbilities).size).toBe(12);
    expect(branchAbilities.every((id) => id.startsWith("barbarian-"))).toBe(true);
    expect(JSON.stringify(branches)).not.toMatch(/totem warrior|storm rager|primal apotheosis|elemental violence|shapeshift/i);
  });

  it("gates Barbarian methods in sequence without Warrior, Monk, spell, or legacy cards", () => {
    expect(pendingProfessionChoices({ professionId: "barbarian", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["barbarian-fury-path"]);
    expect(pendingProfessionChoices({ professionId: "barbarian", levels: 30, branchChoices: {
      "barbarian-fury-path": "reaver",
    } }).map((entry) => entry.id)).toEqual(["reaver-method"]);
    expect(pendingProfessionChoices({ professionId: "barbarian", levels: 50, branchChoices: {
      "barbarian-fury-path": "reaver", "reaver-method": "blood-trail",
    } }).map((entry) => entry.id)).toEqual(["blood-trail-apex"]);

    const generalIds = new Set(compileProfessionTrack("barbarian").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const retired = new Set(["power-strike", "cleave", "second-wind", "whirlwind", "wrath", "earthshatter", "reaping"]);
    expect(PROFESSION_PROFILES.barbarian.abilities.some((id) => retired.has(id))).toBe(false);
    for (const definition of professionBranchChoices("barbarian")) for (const option of definition.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(grant.id, `${definition.id}/${option.id}`).toMatch(/^barbarian-/);
        expect(generalIds.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(retired.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(grant.id).not.toMatch(/^warrior-|^monk-/);
      }
    }
  });

  it("authors 70 unique Sorcerer rows with narrow spells and widening metamagic scope", () => {
    const wizard = compileProfessionTrack("wizard");
    const sorcerer = compileProfessionTrack("sorcerer");
    expect(sorcerer.levels).toHaveLength(70);
    expect(new Set(sorcerer.levels.map((row) => row.feature)).size).toBe(70);
    expect(sorcerer.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    const wizardSpellIds = new Set(wizard.levels.flatMap((row) => row.generalGrants).filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const sorcererSpellSlots = sorcerer.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability-choice" && !grant.replace);
    expect(sorcererSpellSlots).toHaveLength(4);
    expect(sorcererSpellSlots.length).toBeLessThan(wizardSpellIds.size);
    expect(sorcerer.levels[9].generalGrants).toContainEqual(expect.objectContaining({ id: "sorcerer-metamagic-scope-i", spellCount: 1 }));
    expect(sorcerer.levels[19].generalGrants).toContainEqual(expect.objectContaining({ id: "sorcerer-metamagic-scope-ii", spellCount: 2 }));
    expect(sorcerer.levels[39].generalGrants).toContainEqual(expect.objectContaining({ id: "sorcerer-metamagic-scope-iii", spellCount: 3 }));
    expect(sorcerer.levels[59].generalGrants).toContainEqual(expect.objectContaining({ id: "sorcerer-metamagic-scope-iv", spellCount: 4 }));
    expect(sorcerer.levels[0].featureDescription).toMatch(/primary signature.*compact/i);
    expect(sorcerer.levels[69].featureDescription).toMatch(/compact multi-signature repertoire.*four spells/i);
    expect(professionContentStatus("sorcerer")).toBe("complete");
  });

  it("reveals Sorcerer's single-signature and multi-profile branches in order", () => {
    expect(pendingProfessionChoices({ professionId: "sorcerer", levels: 10, branchChoices: {} }).map((entry) => entry.id)).toEqual(["sorcerous-focus"]);
    expect(pendingProfessionChoices({ professionId: "sorcerer", levels: 30, branchChoices: { "sorcerous-focus": "singular-savant" } }).map((entry) => entry.id)).toEqual(["singular-savant-discipline"]);
    expect(pendingProfessionChoices({ professionId: "sorcerer", levels: 50, branchChoices: { "sorcerous-focus": "singular-savant", "singular-savant-discipline": "mutable-signature" } }).map((entry) => entry.id)).toEqual(["mutable-signature-apotheosis"]);
    expect(pendingProfessionChoices({ professionId: "sorcerer", levels: 30, branchChoices: { "sorcerous-focus": "specialized-spellweaver" } }).map((entry) => entry.id)).toEqual(["spellweaver-discipline"]);
    const weaver = compileProfessionTrack("sorcerer", { branchChoices: { "sorcerous-focus": "specialized-spellweaver" } });
    expect(weaver.levels[9].branchGrants).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "sorcerer:weave-spell-i", type: "ability-choice" }),
      expect.objectContaining({ id: "sorcerer:weave-profile-i", type: "metamagic-choice", profileId: "woven-spell-i" }),
    ]));
  });

  it("reserves a distinct bounded utility metamagic pool for Singular Savant", () => {
    const utilityIds = ["subtle-signature", "lingering-signature", "triggered-signature", "reversible-signature"];
    for (const id of utilityIds) expect(METAMAGIC_FEATURES[id]).toMatchObject({ id, name: expect.any(String), description: expect.any(String) });
    const general = compileProfessionTrack("sorcerer");
    const coreOptions = general.levels[9].generalGrants.find((grant) => grant.id === "sorcerer-metamagic-1").options;
    const singular = compileProfessionTrack("sorcerer", { branchChoices: { "sorcerous-focus": "singular-savant" } });
    const singularChoice = singular.levels[9].branchGrants.find((grant) => grant.id === "sorcerer:singular-metamagic-i");
    expect(singularChoice).toMatchObject({ type: "metamagic-choice", utility: true, options: utilityIds });
    expect(singular.levels[9].branchGrants).toContainEqual(expect.objectContaining({
      id: "sorcerer:singular-devotion", metamagicSpellLimit: 1, overridesGeneralMetamagicScope: true,
    }));
    expect(singularChoice.options.some((id) => coreOptions.includes(id))).toBe(false);
    const weaver = compileProfessionTrack("sorcerer", { branchChoices: { "sorcerous-focus": "specialized-spellweaver" } });
    expect(weaver.levels[9].branchGrants.find((grant) => grant.id === "sorcerer:weave-profile-i").options).toEqual(coreOptions);
    expect(weaver.levels[9].branchGrants).toContainEqual(expect.objectContaining({
      id: "sorcerer:separate-profiles", independentMetamagicProfiles: true, metamagicSpellLimit: 4,
    }));
  });

  it("marks each individually authored profession complete without presenting generated professions as finished", () => {
    const wizard = compileProfessionTrack("wizard");
    expect(wizard.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(professionContentStatus("wizard")).toBe("complete");
    expect(professionContentStatus("cleric")).toBe("complete");
    expect(professionContentStatus("sorcerer")).toBe("complete");
    expect(professionContentStatus("fighter")).toBe("complete");
    expect(professionContentStatus("monk")).toBe("complete");
    expect(professionContentStatus("barbarian")).toBe("complete");
  });

  it("lets a focused level-100 route naturally reach the expanded attribute apex", () => {
    const compiled = compileCharacterProgression({
      professions: [{ professionId: "wizard", levels: 70, branchChoices: { "wizard-school": "evocation" } }],
      racial: { raceId: "vampire", levels: 30 },
    });
    expect(Math.max(...Object.values(compiled.finalAttributes))).toBe(90);
    expect(Math.min(...Object.values(compiled.finalAttributes))).toBeLessThan(45);
  });
});
