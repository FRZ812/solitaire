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
    expect(canonicalProfessionId("Resonant Virtuoso")).toBe("bard");
    expect(canonicalProfessionId("Trailblazer")).toBe("ranger");
    expect(canonicalProfessionId("Beast Warden")).toBe("ranger");
    expect(canonicalProfessionId("Scoundrel")).toBe("rogue");
    expect(canonicalProfessionId("Shadowblade")).toBe("rogue");
    expect(canonicalProfessionId("Shield Oath")).toBe("paladin");
    expect(canonicalProfessionId("Champion Paladin")).toBe("paladin");
    expect(canonicalProfessionIdentity("Enchanter Tyrant")).toEqual({ professionId: "wizard", specializationId: "enchanter-tyrant" });
    expect(canonicalProfessionIdentity("Open Hand")).toEqual({ professionId: "monk", specializationId: "open-hand" });
    expect(canonicalProfessionIdentity("Reaver")).toEqual({ professionId: "barbarian", specializationId: "reaver" });
    expect(canonicalProfessionIdentity("barbarian")).toEqual({ professionId: "barbarian", specializationId: null });
    expect(canonicalProfessionIdentity("War Singer")).toEqual({ professionId: "bard", specializationId: "war-singer" });
    expect(canonicalProfessionIdentity("bard")).toEqual({ professionId: "bard", specializationId: null });
    expect(canonicalProfessionIdentity("Hunter")).toEqual({ professionId: "ranger", specializationId: "hunter" });
    expect(canonicalProfessionIdentity("ranger")).toEqual({ professionId: "ranger", specializationId: null });
    expect(canonicalProfessionIdentity("Saboteur")).toEqual({ professionId: "rogue", specializationId: "saboteur" });
    expect(canonicalProfessionIdentity("rogue")).toEqual({ professionId: "rogue", specializationId: null });
    expect(canonicalProfessionIdentity("Mercy Oath")).toEqual({ professionId: "paladin", specializationId: "mercy-oath" });
    expect(canonicalProfessionIdentity("paladin")).toEqual({ professionId: "paladin", specializationId: null });
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
      const roots = branches.filter((entry) => !entry.parentChoiceId);
      expect(roots, `${professionId} roots`).toHaveLength(1);
      const root = roots[0];
      expect(root, professionId).toBeTruthy();
      const byId = new Map(branches.map((entry) => [entry.id, entry]));
      for (const definition of branches) {
        if (!definition.parentChoiceId) continue;
        const parent = byId.get(definition.parentChoiceId);
        expect(parent, `${professionId}/${definition.id} parent`).toBeTruthy();
        expect(parent.options.some((option) => option.id === definition.parentOptionId), `${professionId}/${definition.id} parent option`).toBe(true);
        expect(parent.threshold, `${professionId}/${definition.id} threshold`).toBeLessThan(definition.threshold);
        const seen = new Set([definition.id]);
        let ancestor = parent;
        while (ancestor) {
          expect(seen.has(ancestor.id), `${professionId}/${definition.id} cycle`).toBe(false);
          seen.add(ancestor.id);
          ancestor = ancestor.parentChoiceId ? byId.get(ancestor.parentChoiceId) : null;
        }
      }
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

  it("prunes mastery selections whose full Wizard ancestry is incompatible", () => {
    const corruptedNecromancer = compileProfessionTrack("wizard", { branchChoices: {
      "wizard-school": "necromancy",
      "abjuration-discipline": "warder",
      "warder-mastery": "mirror-warden",
    } });

    expect(corruptedNecromancer.branchChoices).toEqual({ "wizard-school": "necromancy" });
    expect(corruptedNecromancer.pendingChoices.map((entry) => entry.id)).toEqual(["necromancy-discipline"]);
    const grantIds = corruptedNecromancer.levels.flatMap((row) => row.branchGrants).map((grant) => grant.id);
    expect(grantIds).not.toContain("spell-reflection");
    expect(grantIds).not.toContain("wizard:mirror-warden");
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

  it("authors 70 unique Bard levels around alternating self-side four-count Cadence", () => {
    const bard = compileProfessionTrack("bard");
    const grantedAbilities = bard.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(bard.levels).toHaveLength(70);
    expect(new Set(bard.levels.map((row) => row.feature)).size).toBe(70);
    expect(bard.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(bard.levels.every((row) => row.generalGrants.some((grant) => ["ability", "action", "passive"].includes(grant.type)))).toBe(true);
    expect(grantedAbilities).toEqual([
      "bard-clarion-note",
      "bard-steady-beat",
      "bard-cutting-verse",
      "bard-rising-tempo",
      "bard-dissonant-chord",
      "bard-call-and-response",
      "bard-stinging-refrain",
      "bard-crescendo",
      "bard-syncopated-break",
      "bard-heartening-chorus",
      "bard-counter-melody",
      "bard-grand-finale",
    ]);
    expect(PROFESSION_PROFILES.bard).toMatchObject({ name: "Bard", domain: "performance", abilities: grantedAbilities });
    expect(grantedAbilities.every((id) => id.startsWith("bard-"))).toBe(true);
    expect(bard.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "bard:cadence",
      selfSide: true,
      cadenceMax: 4,
      cadenceBuildRule: "alternate-native-motif",
      repeatingMotifBuilds: false,
      resetsEachFight: true,
    }));
    expect(bard.levels[69].feature).toBe("Grand Finale");
    expect(professionContentStatus("bard")).toBe("complete");
  });

  it("gives every Bard path its own L30 method and two L50 non-spell apexes", () => {
    const branches = professionBranchChoices("bard");
    const root = branches.find((entry) => entry.id === "bard-performance-path");
    expect(root.options.map((option) => option.id)).toEqual([
      "war-singer", "satirist", "resonant-virtuoso", "lorekeeper",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30).map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "war-singer-method": ["drumline", "anthemist"],
      "satirist-method": ["heckler", "chorus-of-scorn"],
      "resonant-virtuoso-method": ["shattertone", "harmonic-weaver"],
      "lorekeeper-method": ["balladeer", "battle-chronicler"],
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
    expect(branchAbilities).toEqual([
      "bard-war-drum", "bard-pointed-satire", "bard-resonant-pulse", "bard-lore-callout",
      "bard-marching-cadence", "bard-defiant-anthem", "bard-hecklers-hook", "bard-chorus-of-scorn",
      "bard-shattertone", "bard-harmonic-weave", "bard-old-ballad", "bard-battle-chronicle",
    ]);
    expect(new Set(branchAbilities).size).toBe(12);
    expect(JSON.stringify(branches)).not.toMatch(/bardic college|college of lore|college of valour|world singer|spell virtuoso|broad magic/i);
  });

  it("gates Bard methods in sequence without spell, charm, rally, or foreign cards", () => {
    expect(pendingProfessionChoices({ professionId: "bard", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["bard-performance-path"]);
    expect(pendingProfessionChoices({ professionId: "bard", levels: 30, branchChoices: {
      "bard-performance-path": "war-singer",
    } }).map((entry) => entry.id)).toEqual(["war-singer-method"]);
    expect(pendingProfessionChoices({ professionId: "bard", levels: 50, branchChoices: {
      "bard-performance-path": "war-singer", "war-singer-method": "drumline",
    } }).map((entry) => entry.id)).toEqual(["drumline-apex"]);

    const generalIds = new Set(compileProfessionTrack("bard").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const retired = new Set(["rallying-shout", "bless", "battle-hymn", "charm", "battle-focus"]);
    expect(PROFESSION_PROFILES.bard.abilities.some((id) => retired.has(id))).toBe(false);
    for (const definition of professionBranchChoices("bard")) for (const option of definition.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(grant.id, `${definition.id}/${option.id}`).toMatch(/^bard-/);
        expect(generalIds.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(retired.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
      }
    }
  });

  it("authors 70 unique Ranger levels with target-bound Quarry Insight and noncombat fieldcraft at every rank", () => {
    const ranger = compileProfessionTrack("ranger");
    const grantedAbilities = ranger.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(ranger.levels).toHaveLength(70);
    expect(new Set(ranger.levels.map((row) => row.feature)).size).toBe(70);
    expect(ranger.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(ranger.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(grantedAbilities).toEqual([
      "ranger-quarry-sign",
      "ranger-ranging-shot",
      "ranger-field-dressing",
      "ranger-trail-cut",
      "ranger-pinpoint-volley",
      "ranger-evading-step",
      "ranger-crippling-shot",
      "ranger-pursuit-line",
      "ranger-covering-shot",
      "ranger-kill-window",
      "ranger-relentless-trail",
      "ranger-perfect-hunt",
    ]);
    expect(PROFESSION_PROFILES.ranger).toMatchObject({ name: "Ranger", domain: "fieldcraft", abilities: grantedAbilities });
    expect(grantedAbilities.every((id) => id.startsWith("ranger-"))).toBe(true);
    expect(ranger.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "ranger:quarry-insight",
      selfSide: true,
      targetBound: true,
      integerOnly: true,
      quarryInsightMin: 0,
      quarryInsightMax: 5,
      differentQuarryResets: true,
      buildRequiresSuccessfulSetupOrHit: true,
      spenderRequiresCurrentQuarry: true,
      spendOncePerAction: true,
      resetsEachFight: true,
    }));
    expect(ranger.levels[69].feature).toBe("Perfect Hunt");
    expect(professionContentStatus("ranger")).toBe("complete");
  });

  it("gives every Ranger practice its own L30 method and two L50 mundane apexes", () => {
    const branches = professionBranchChoices("ranger");
    const root = branches.find((entry) => entry.id === "ranger-field-practice");
    expect(root.options.map((option) => option.id)).toEqual([
      "hunter", "trailblazer", "beast-warden", "trapper",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30).map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "hunter-method": ["monster-stalker", "deadeye"],
      "trailblazer-method": ["pathfinder", "skirmisher"],
      "beast-warden-method": ["packmaster", "falconer"],
      "trapper-method": ["snarewright", "ambusher"],
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
    expect(branchAbilities).toEqual([
      "ranger-patient-aim", "ranger-pathfinder-step", "ranger-companion-signal", "ranger-set-snare",
      "ranger-read-monster", "ranger-deadeye-breath", "ranger-safe-passage", "ranger-running-shot",
      "ranger-pack-command", "ranger-falcon-stoop", "ranger-layered-snare", "ranger-kill-zone",
    ]);
    expect(new Set(branchAbilities).size).toBe(12);
    const beastText = JSON.stringify(branches.filter((entry) => entry.id.includes("beast") || entry.id.includes("pack") || entry.id.includes("falcon")));
    expect(beastText).toMatch(/already-present trained mundane animal/i);
    expect(beastText).toMatch(/"summonsAnimal":false/);
    expect(JSON.stringify(branches)).not.toMatch(/Ranger Conclave|Horizon Walker|Gloom Stalker|Fey Wanderer|Swarmkeeper/i);
  });

  it("gates Ranger methods in sequence without magical marks, borrowed cards, or legacy attacks", () => {
    expect(pendingProfessionChoices({ professionId: "ranger", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["ranger-field-practice"]);
    expect(pendingProfessionChoices({ professionId: "ranger", levels: 30, branchChoices: {
      "ranger-field-practice": "beast-warden",
    } }).map((entry) => entry.id)).toEqual(["beast-warden-method"]);
    expect(pendingProfessionChoices({ professionId: "ranger", levels: 50, branchChoices: {
      "ranger-field-practice": "beast-warden", "beast-warden-method": "falconer",
    } }).map((entry) => entry.id)).toEqual(["falconer-apex"]);

    const generalIds = new Set(compileProfessionTrack("ranger").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const retired = new Set(["aimed-shot", "hamstring-shot", "snare", "twin-shot", "piercing-shot", "arrow-volley", "pinning-shot"]);
    expect(PROFESSION_PROFILES.ranger.abilities.some((id) => retired.has(id))).toBe(false);
    for (const definition of professionBranchChoices("ranger")) for (const option of definition.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(grant.id, `${definition.id}/${option.id}`).toMatch(/^ranger-/);
        expect(generalIds.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(retired.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(grant.id).not.toMatch(/^warrior-|^monk-|^barbarian-/);
      }
    }
  });

  it("authors 70 unique Rogue levels with source-owned boolean Opportunity Windows and noncombat utility at every rank", () => {
    const rogue = compileProfessionTrack("rogue");
    const grantedAbilities = rogue.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(rogue.levels).toHaveLength(70);
    expect(new Set(rogue.levels.map((row) => row.feature)).size).toBe(70);
    expect(rogue.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(rogue.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(grantedAbilities).toEqual([
      "rogue-assess-mark",
      "rogue-testing-cut",
      "rogue-slip-the-line",
      "rogue-false-opening",
      "rogue-exploit-guard",
      "rogue-sap-blow",
      "rogue-concealed-shift",
      "rogue-hamstring",
      "rogue-switchback-feint",
      "rogue-kidney-shot",
      "rogue-finishing-angle",
      "rogue-perfect-opportunity",
    ]);
    expect(PROFESSION_PROFILES.rogue).toMatchObject({ name: "Rogue", domain: "subterfuge", abilities: grantedAbilities });
    expect(grantedAbilities.every((id) => id.startsWith("rogue-"))).toBe(true);
    expect(rogue.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "rogue:opportunity-window",
      sourceOwned: true,
      targetStatus: true,
      booleanState: true,
      nonNumeric: true,
      stacks: false,
      durationTurns: 2,
      successfulNativeSetupOrHitOnly: true,
      refreshesDuration: true,
      multipleTargetsPerSource: true,
      independentSources: true,
      exploitRequiresMatchingSourceAndTarget: true,
      consumesOnCommit: true,
      consumeOncePerAction: true,
      multiHitConsumesOnce: true,
      transfers: false,
      basicActionsCreate: false,
      unrelatedActionsCreate: false,
    }));
    expect(rogue.levels[69].feature).toBe("Perfect Opportunity");
    expect(professionContentStatus("rogue")).toBe("complete");
  });

  it("gives every Rogue practice its own L30 method and two L50 mundane capability apexes", () => {
    const branches = professionBranchChoices("rogue");
    const root = branches.find((entry) => entry.id === "rogue-practice");
    expect(root.options.map((option) => option.id)).toEqual([
      "infiltrator", "scoundrel", "assassin", "saboteur",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30).map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "rogue-infiltrator-method": ["cat-burglar", "crowd-ghost"],
      "rogue-scoundrel-method": ["confidence-artist", "dirty-fighter"],
      "rogue-assassin-method": ["ambusher", "poisoner"],
      "rogue-saboteur-method": ["locksmith", "wrecker"],
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
    expect(branchAbilities).toEqual([
      "rogue-silent-entry", "rogue-brazen-feint", "rogue-killing-measure", "rogue-fault-finder",
      "rogue-high-window", "rogue-crowd-ghost", "rogue-confidence-play", "rogue-dirty-trick",
      "rogue-first-strike", "rogue-venom-work", "rogue-master-key", "rogue-planned-collapse",
    ]);
    expect(new Set(branchAbilities).size).toBe(12);
    expect(JSON.stringify(branches)).not.toMatch(/Roguish Practice|Underworld Mastery|Arcane Trickster|Soulknife|Phantom|Shadowblade/i);
  });

  it("gates Rogue methods in sequence without shadow magic, foreign resources, or retired generic cards", () => {
    expect(pendingProfessionChoices({ professionId: "rogue", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["rogue-practice"]);
    expect(pendingProfessionChoices({ professionId: "rogue", levels: 30, branchChoices: {
      "rogue-practice": "scoundrel",
    } }).map((entry) => entry.id)).toEqual(["rogue-scoundrel-method"]);
    expect(pendingProfessionChoices({ professionId: "rogue", levels: 50, branchChoices: {
      "rogue-practice": "scoundrel", "rogue-scoundrel-method": "confidence-artist",
    } }).map((entry) => entry.id)).toEqual(["rogue-confidence-artist-apex"]);

    const generalIds = new Set(compileProfessionTrack("rogue").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const retired = new Set(["rapid-jabs", "feint", "venom-strike", "shadowstep", "disarming-strike", "execute", "lunge"]);
    expect(PROFESSION_PROFILES.rogue.abilities.some((id) => retired.has(id))).toBe(false);
    for (const definition of professionBranchChoices("rogue")) for (const option of definition.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(grant.id, `${definition.id}/${option.id}`).toMatch(/^rogue-/);
        expect(generalIds.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(retired.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(grant.id).not.toMatch(/^warrior-|^monk-|^barbarian-|^bard-|^ranger-/);
      }
    }
  });

  it("authors 70 unique Paladin levels with strict Conviction and concrete noncombat duty at every rank", () => {
    const paladin = compileProfessionTrack("paladin");
    const grantedAbilities = paladin.levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(paladin.levels).toHaveLength(70);
    expect(new Set(paladin.levels.map((row) => row.feature)).size).toBe(70);
    expect(paladin.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(paladin.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(grantedAbilities).toEqual([
      "paladin-oathguard",
      "paladin-vowed-strike",
      "paladin-stand-fast",
      "paladin-challenge-of-witness",
      "paladin-bear-the-blow",
      "paladin-steadfast-word",
      "paladin-judgment-stroke",
      "paladin-hold-the-line",
      "paladin-merciful-arrest",
      "paladin-oathfire-edge",
      "paladin-last-witness",
      "paladin-oath-incarnate",
    ]);
    expect(PROFESSION_PROFILES.paladin).toMatchObject({ name: "Paladin", domain: "oathcraft", abilities: grantedAbilities });
    expect(grantedAbilities.every((id) => id.startsWith("paladin-"))).toBe(true);
    expect(paladin.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "paladin:conviction",
      selfSide: true,
      integer: true,
      min: 0,
      max: 5,
      resetEachFight: true,
      earnedOnlyByNativeProtection: true,
      oathguardInterceptsHostileDamageForAlly: true,
      standFastAbsorbsRealHostileHit: true,
      paladinConvictionOnIntercept: 1,
      paladinConvictionOnAbsorb: 1,
      requiresActualDamage: true,
      attemptsBuild: false,
      zeroDamageBuilds: false,
      ordinaryDamageBuilds: false,
      selfManufacturedDamageBuilds: false,
      healingBuilds: false,
      unrelatedActionsBuild: false,
      oncePerHostileActionPerPaladin: true,
      independentPaladins: true,
      nativeOathcraftCommitSpendOnly: true,
      spendsOnCommitEvenIfMissed: true,
      multiHitSpendsOnce: true,
      genericSpellcasting: false,
      borrowedResource: false,
    }));
    expect(paladin.levels[69].feature).toBe("Oath Incarnate");
    expect(professionContentStatus("paladin")).toBe("complete");
  });

  it("gives every Paladin oath two L30 offices and every office two card-free L50 apexes", () => {
    const branches = professionBranchChoices("paladin");
    const root = branches.find((entry) => entry.id === "paladin-oath");
    expect(root.options.map((option) => option.id)).toEqual([
      "shield-oath", "truth-oath", "mercy-oath", "beacon-oath",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.reduce((sum, entry) => sum + entry.options.length, 0)).toBe(28);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30).map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "paladin-shield-method": ["shieldbearer", "gatekeeper"],
      "paladin-truth-method": ["inquisitor", "magistrate"],
      "paladin-mercy-method": ["redeemer", "martyr"],
      "paladin-beacon-method": ["dawnblade", "roadwarden"],
    });
    for (const oath of root.options) {
      const office = branches.find((entry) => entry.threshold === 30
        && entry.parentChoiceId === root.id && entry.parentOptionId === oath.id);
      expect(office, oath.id).toBeTruthy();
      expect(office.options, oath.id).toHaveLength(2);
      for (const option of office.options) {
        const apex = branches.find((entry) => entry.threshold === 50
          && entry.parentChoiceId === office.id && entry.parentOptionId === option.id);
        expect(apex, `${oath.id}/${option.id}`).toBeTruthy();
        expect(apex.options, `${oath.id}/${option.id}`).toHaveLength(2);
        expect(apex.options.flatMap((entry) => entry.grants).some((grant) => grant.type === "ability"), apex.id).toBe(false);
      }
    }
    const branchAbilities = branches.flatMap((entry) => entry.options)
      .flatMap((option) => option.grants).filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(branchAbilities).toEqual([
      "paladin-shield-covenant", "paladin-call-to-account", "paladin-offer-quarter", "paladin-beacon-stance",
      "paladin-rampart-exchange", "paladin-threshold-blow", "paladin-verdict-edge", "paladin-peace-command",
      "paladin-redeeming-intercession", "paladin-burden-taken", "paladin-sunward-cut", "paladin-pilgrim-aegis",
    ]);
    expect(new Set(branchAbilities).size).toBe(12);
    expect(JSON.stringify(branches)).not.toMatch(/Sacred Oath|Devotion|Vengeance|Consecrated Office|Holy Shield|Divine Avenger/i);
  });

  it("gates Paladin oaths in sequence without Cleric cards, Warrior resources, healing, smites, or legacy branches", () => {
    expect(pendingProfessionChoices({ professionId: "paladin", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["paladin-oath"]);
    expect(pendingProfessionChoices({ professionId: "paladin", levels: 30, branchChoices: {
      "paladin-oath": "truth-oath",
    } }).map((entry) => entry.id)).toEqual(["paladin-truth-method"]);
    expect(pendingProfessionChoices({ professionId: "paladin", levels: 50, branchChoices: {
      "paladin-oath": "truth-oath", "paladin-truth-method": "inquisitor",
    } }).map((entry) => entry.id)).toEqual(["paladin-inquisitor-apex"]);

    const generalIds = new Set(compileProfessionTrack("paladin").levels.flatMap((row) => row.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id));
    const retired = new Set(["power-strike", "smite", "heal", "shield-of-faith", "radiance", "bulwark-stance", "sanctuary", "judgment", "unbreakable-will"]);
    expect(PROFESSION_PROFILES.paladin.abilities.some((id) => retired.has(id))).toBe(false);
    for (const definition of professionBranchChoices("paladin")) for (const option of definition.options) {
      for (const grant of option.grants.filter((entry) => entry.type === "ability")) {
        expect(grant.id, `${definition.id}/${option.id}`).toMatch(/^paladin-/);
        expect(generalIds.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(retired.has(grant.id), `${definition.id}/${option.id}/${grant.id}`).toBe(false);
        expect(grant.id).not.toMatch(/^cleric-|^warrior-|^monk-|^barbarian-|^bard-|^ranger-|^rogue-/);
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
    expect(professionContentStatus("bard")).toBe("complete");
    expect(professionContentStatus("ranger")).toBe("complete");
    expect(professionContentStatus("rogue")).toBe("complete");
    expect(professionContentStatus("paladin")).toBe("complete");
    expect(professionContentStatus("druid")).toBe("complete");
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
