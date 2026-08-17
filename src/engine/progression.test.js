import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_SCALE_VERSION,
  PROGRESSION_VERSION,
  advanceProgression,
  advanceRacialProgression,
  createProgression,
  migrateProgressionState,
  normalizeCharacterProgression,
  pendingLevelAllocations,
  pendingProfessionChoices,
  pendingProgressionChoices,
  professionProgressionLevel,
  progressionEntitlements,
  progressionLevel,
  projectCharacterProgression,
  progressionSummary,
  racialProgressionLevel,
  resolveProfessionChoice,
  resolveLevelAllocationChoice,
  resolveLevelAllocation,
  resolveRacialProgressionChoice,
  resolveProgressionGrantChoice,
  stripTowLegacyProgression,
} from "./progression.js";
import { PROFESSION_PROFILES, progressionXpForLevel } from "../data/progression-paths.js";

describe("progression v4 class allocation", () => {
  it("derives a 100 total from an independent 70/30 allocation", () => {
    const progression = createProgression({ professionId: "wizard", raceId: "vampire", level: 100 });
    expect(progression).toMatchObject({ version: PROGRESSION_VERSION, professionId: "wizard", racial: { raceId: "vampire" } });
    expect(professionProgressionLevel(progression)).toBe(70);
    expect(racialProgressionLevel(progression)).toBe(30);
    expect(progressionLevel(progression)).toBe(100);
    expect(progression).not.toHaveProperty("professionTree");
  });

  it("supports multiclass profession allocations", () => {
    const progression = createProgression({
      level: 80,
      racialLevels: 10,
      professions: [
        { profession: "wizard", specialization: "battle-archmage", levels: 35 },
        { profession: "cleric", specialization: "life-domain", levels: 20 },
        { profession: "artisan", specialization: "runesmith", levels: 15 },
      ],
      raceId: "human",
    });
    expect(progression.professions.map((track) => [track.professionId, professionProgressionLevel({ ...progression, professions: [track] })]))
      .toEqual([["wizard", 35], ["cleric", 20], ["artisan", 15]]);
    expect(progressionLevel(progression)).toBe(80);
  });

  it("preserves legacy exact titles as specializations on generalized professions", () => {
    const progression = createProgression({ professionId: "Enchanter Tyrant", level: 40 });
    expect(progression).toMatchObject({ professionId: "wizard", archetypeId: "enchanter-tyrant" });
    const character = normalizeCharacterProgression({ profession: "Demon Warlock", race: "demonborn", level: 30 });
    expect(character).toMatchObject({ profession: "warlock", archetype: "demon-warlock" });
  });

  it("offers every profession as a compact advance or multiclass choice", () => {
    const character = {
      race: "human",
      profession: "fighter",
      attributes: {},
      progression: createProgression({ professionId: "fighter", level: 1 }),
    };
    advanceProgression(character, progressionXpForLevel(2) - progressionXpForLevel(1));
    const pending = pendingLevelAllocations(character);
    const professionOptions = pending.options.filter((option) => option.track === "profession");

    expect(professionOptions).toHaveLength(Object.keys(PROFESSION_PROFILES).length);
    expect(professionOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ optionId: "profession:fighter", name: "Advance Warrior", currentTrackLevel: 1 }),
      expect.objectContaining({ optionId: "profession:wizard", name: "Enter Wizard", currentTrackLevel: 0 }),
    ]));
    expect(professionOptions.every((option) => !Object.prototype.hasOwnProperty.call(option, "availableNodeIds"))).toBe(true);

    resolveLevelAllocationChoice(character, {
      choiceId: pending.choiceId,
      optionId: "profession:wizard",
      specializationId: "battle-archmage",
    });
    expect(character.progression.professions.map((track) => [track.professionId, Object.values(track.paths).reduce((sum, rank) => sum + rank, 0)]))
      .toEqual([["fighter", 1], ["wizard", 1]]);
    expect(character.progression).toMatchObject({ activeProfessionId: "wizard", professionId: "wizard", archetypeId: "battle-archmage" });
    expect(professionProgressionLevel(character)).toBe(2);
  });

  it("advances the same profession by taking its next authored class level", () => {
    const character = {
      race: "human",
      profession: "fighter",
      attributes: {},
      progression: createProgression({ professionId: "fighter", level: 1 }),
    };
    advanceProgression(character, progressionXpForLevel(2) - progressionXpForLevel(1));
    const pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, {
      choiceId: pending.choiceId,
      optionId: "profession:fighter",
    });
    expect(character.progression.professions).toHaveLength(1);
    expect(professionProgressionLevel(character)).toBe(2);
    expect(progressionEntitlements(character).grants.map((grant) => grant.level)).toEqual(expect.arrayContaining([1, 2]));
  });

  it("stops offering profession choices once the shared profession cap is full", () => {
    const character = {
      race: "human",
      profession: "fighter",
      attributes: {},
      progression: createProgression({ professionId: "fighter", level: 70 }),
    };
    advanceProgression(character, progressionXpForLevel(71) - progressionXpForLevel(70));
    expect(pendingLevelAllocations(character).options.map((option) => option.optionId)).toEqual(["racial:evolution"]);
  });
});

describe("Tower legacy progression firewall", () => {
  const retiredKeys = [
    "progression", "level",
    "subclass",
    "professionPlan", "profession_plan",
    "racialLevels", "racial_levels",
    "progressionChoices", "progression_choices",
    "signatureSpell", "signature_spell", "signatureSpellId", "signature_spell_id",
    "signatureSpellIds", "signature_spell_ids", "signatureSpells", "signature_spells",
    "metamagic", "metamagicId", "metamagic_id",
    "metamagicIds", "metamagic_ids", "metamagicProfiles", "metamagic_profiles",
  ];

  function contaminatedTowCharacter(overrides = {}) {
    return {
      id: "wanderer",
      profession: "ranger",
      archetype: "ranger",
      combatArchetypeId: "ranger",
      progressionModel: "tow-archetype",
      towBaseStats: { hp: 96, resolve: 8 },
      attributes: { body: 6, reflex: 8, vigor: 5, mind: 3, wit: 7, presence: 4 },
      abilities: [
        { id: "gate", tier: "legendary" },
        { id: "power-strike", tier: "rare" },
        { id: "field-lore", rating: 2 },
      ],
      racialPassives: ["darkvision"],
      progression: createProgression({ professionId: "ranger", level: 25 }),
      level: 25,
      subclass: "old-ranger-specialization",
      professionPlan: [{ profession: "ranger", levels: 25 }],
      profession_plan: [{ profession: "ranger", levels: 25 }],
      racialLevels: 2,
      racial_levels: 2,
      progressionChoices: { metamagic: ["quickened-signature"] },
      progression_choices: { signatureSpellId: "fireball" },
      signatureSpell: "fireball",
      signature_spell: "fireball",
      signatureSpellId: "fireball",
      signature_spell_id: "fireball",
      signatureSpellIds: ["fireball"],
      signature_spell_ids: ["fireball"],
      signatureSpells: ["fireball"],
      signature_spells: ["fireball"],
      metamagic: ["quickened-signature"],
      metamagicId: "quickened-signature",
      metamagic_id: "quickened-signature",
      metamagicIds: ["quickened-signature"],
      metamagic_ids: ["quickened-signature"],
      metamagicProfiles: { fireball: ["quickened-signature"] },
      metamagic_profiles: { fireball: ["quickened-signature"] },
      ...overrides,
    };
  }

  function expectCleanTowCharacter(character) {
    for (const key of retiredKeys) expect(character).not.toHaveProperty(key);
    expect(character).toMatchObject({
      profession: "ranger",
      archetype: "ranger",
      combatArchetypeId: "ranger",
      progressionModel: "tow-archetype",
      towBaseStats: { hp: 96, resolve: 8 },
      attributes: { body: 6, reflex: 8, vigor: 5, mind: 3, wit: 7, presence: 4 },
      abilities: [{ id: "gate", tier: "legendary" }],
      racialPassives: ["darkvision"],
    });
  }

  it("strips retired fields idempotently while preserving Tower identity, stats, and world powers", () => {
    const character = contaminatedTowCharacter();
    expect(stripTowLegacyProgression(character)).toBe(character);
    expectCleanTowCharacter(character);
    const once = structuredClone(character);
    stripTowLegacyProgression(character);
    expect(character).toEqual(once);
  });

  it("keeps direct normalize, advance, and summary APIs from recreating a legacy track", () => {
    const normalized = contaminatedTowCharacter();
    normalizeCharacterProgression(normalized);
    expectCleanTowCharacter(normalized);

    const advanced = contaminatedTowCharacter();
    expect(advanceProgression(advanced, progressionXpForLevel(50))).toMatchObject({
      character: advanced,
      beforeLevel: 0,
      afterLevel: 0,
      earnedLevels: 0,
      unspentLevels: 0,
      pendingChoices: [],
    });
    expectCleanTowCharacter(advanced);

    const summarized = contaminatedTowCharacter();
    expect(progressionSummary(summarized)).toBeNull();
    expectCleanTowCharacter(summarized);

    const projected = projectCharacterProgression({
      character: contaminatedTowCharacter(),
      world: { codex: { characters: { wanderer: contaminatedTowCharacter() } } },
    });
    expectCleanTowCharacter(projected.character);
    expectCleanTowCharacter(projected.world.codex.characters.wanderer);
  });

  it("cleans contaminated ledgers before pending reads or choice mutations can expose them", () => {
    const pendingCases = [
      [pendingProfessionChoices, []],
      [pendingProgressionChoices, []],
      [pendingLevelAllocations, null],
    ];
    for (const [readPending, expected] of pendingCases) {
      const character = contaminatedTowCharacter();
      const ledger = structuredClone(character.progression);
      expect(readPending(character)).toEqual(expected);
      expect(character.progression).toEqual(ledger);
    }

    const resolverCases = [
      (character) => resolveProfessionChoice(character, {
        professionId: "ranger", choiceId: "ranger-field-practice", optionId: "hunter",
      }),
      (character) => resolveRacialProgressionChoice(character, {
        choiceId: "vampire-dark-legacy", optionId: "night-stalker",
      }),
      (character) => resolveProgressionGrantChoice(character, {
        professionId: "ranger", grantId: "retired-grant", optionId: "retired-option",
      }),
      (character) => resolveLevelAllocationChoice(character, {
        choiceId: "level-allocation-26", optionId: "profession:ranger",
      }),
      (character) => resolveLevelAllocation(character, { track: "profession", professionId: "ranger" }),
    ];
    for (const resolve of resolverCases) {
      const character = contaminatedTowCharacter();
      expect(() => resolve(character)).toThrow("Tower archetypes do not use legacy progression choices");
      expectCleanTowCharacter(character);
    }
  });
});

describe("choices and entitlements", () => {
  it("does not silently select a Wizard school and resolves nested choices explicitly", () => {
    const progression = createProgression({ professionId: "wizard", level: 50 });
    expect(pendingProgressionChoices(progression).map((choice) => choice.id)).toContain("wizard-school");
    const necromancer = resolveProfessionChoice(progression, { professionId: "wizard", choiceId: "wizard-school", optionId: "necromancy" });
    const necromancyChoice = pendingProgressionChoices(necromancer).find((choice) => choice.id === "necromancy-discipline");
    expect(necromancyChoice).toMatchObject({ exclusive: true, breadcrumbs: [{ id: "necromancy", name: "Necromancy" }] });
    expect(necromancyChoice.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "death-magic", nextChoices: [expect.objectContaining({ id: "death-magic-mastery", threshold: 50 })] }),
    ]));
    const deathMage = resolveProfessionChoice(necromancer, { professionId: "wizard", choiceId: "necromancy-discipline", optionId: "death-magic" });
    expect(pendingProgressionChoices(deathMage).find((choice) => choice.id === "death-magic-mastery"))
      .toMatchObject({ breadcrumbs: [{ id: "necromancy", name: "Necromancy" }, { id: "death-magic", name: "Death Magic" }] });
    const final = resolveProfessionChoice(deathMage, { professionId: "wizard", choiceId: "death-magic-mastery", optionId: "instant-death" });
    expect(progressionEntitlements(final).abilities).toContain("grasp-heart");
  });

  it("locks resolved specialization gates instead of permitting a sibling respec", () => {
    const progression = createProgression({ professionId: "wizard", level: 50 });
    const necromancer = resolveProfessionChoice(progression, {
      professionId: "wizard", choiceId: "wizard-school", optionId: "necromancy",
    });

    expect(() => resolveProfessionChoice(necromancer, {
      professionId: "wizard", choiceId: "wizard-school", optionId: "abjuration",
    })).toThrow(/already locked/);
    expect(necromancer.professions[0].branchChoices).toEqual({ "wizard-school": "necromancy" });
  });

  it("rejects and removes Warder mastery descendants from a Necromancy path", () => {
    const progression = createProgression({ professionId: "wizard", level: 50 });
    progression.professions[0].branchChoices = {
      "wizard-school": "necromancy",
      "abjuration-discipline": "warder",
      "warder-mastery": "mirror-warden",
    };

    expect(() => resolveProfessionChoice(progression, {
      professionId: "wizard", choiceId: "warder-mastery", optionId: "mirror-warden",
    })).toThrow(/prerequisite/);
    expect(progressionEntitlements(progression).abilities).not.toContain("spell-reflection");
    expect(pendingProgressionChoices(progression).map((choice) => choice.id)).toContain("necromancy-discipline");
    expect(pendingProgressionChoices(progression).map((choice) => choice.id)).not.toContain("warder-mastery");
  });

  it("resolves branch-granted bounded spell choices under grant-specific keys", () => {
    let progression = createProgression({ professionId: "wizard", level: 50 });
    progression = resolveProfessionChoice(progression, { professionId: "wizard", choiceId: "wizard-school", optionId: "universalist" });
    progression = resolveProfessionChoice(progression, { professionId: "wizard", choiceId: "universalist-discipline", optionId: "polymath" });
    expect(pendingProgressionChoices(progression)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wizard:polymath-spell", count: 1 }),
      expect.objectContaining({ id: "polymath-mastery" }),
    ]));
    progression = resolveProgressionGrantChoice(progression, { professionId: "wizard", grantId: "wizard:polymath-spell", optionId: "frost-nova" });
    progression = resolveProfessionChoice(progression, { professionId: "wizard", choiceId: "polymath-mastery", optionId: "living-spellbook" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "wizard", grantId: "wizard:living-spellbook-formulae", optionId: "fireball" });
    expect(pendingProgressionChoices(progression)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wizard:living-spellbook-formulae", remainingCount: 1 }),
    ]));
    progression = resolveProgressionGrantChoice(progression, { professionId: "wizard", grantId: "wizard:living-spellbook-formulae", optionId: "haste" });
    expect(pendingProgressionChoices(progression).map((choice) => choice.id)).not.toContain("wizard:living-spellbook-formulae");
    expect(progressionEntitlements(progression).abilities).toEqual(expect.arrayContaining(["frost-nova", "fireball", "haste"]));
    expect(progression.professions[0].choices.grantSelections).toMatchObject({
      "wizard:polymath-spell": ["frost-nova"],
      "wizard:living-spellbook-formulae": ["fireball", "haste"],
    });
  });

  it("requires explicit Sorcerer signature, metamagic, and exchange choices", () => {
    let progression = createProgression({ professionId: "sorcerer", level: 25 });
    expect(pendingProgressionChoices(progression)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "sorcerer-signature-spell" }),
      expect.objectContaining({ id: "sorcerer-metamagic-1" }),
      expect.objectContaining({ id: "sorcerer-signature-exchange-25" }),
    ]));
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-spell", optionId: "fireball" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-metamagic-1", optionId: "empowered-signature" });
    expect(progressionEntitlements(progression).abilities).toContain("fireball");
    expect(progressionEntitlements(progression).metamagic).toContain("empowered-signature");
    expect(pendingProgressionChoices(progression).map((choice) => choice.id)).not.toContain("sorcerer-signature-spell");
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-exchange-25", optionId: "lightning-bolt" });
    expect(progression.professions[0].choices).toMatchObject({
      signatureSpellId: "lightning-bolt",
      signatureExchanges: { 25: "lightning-bolt" },
      metamagicIds: ["empowered-signature"],
    });
    expect(progressionEntitlements(progression).abilities).toContain("lightning-bolt");
    expect(progressionEntitlements(progression).abilities).not.toContain("fireball");
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-secondary-spell", optionId: "fireball" });
    expect(progressionEntitlements(progression).abilities).toEqual(expect.arrayContaining(["lightning-bolt", "fireball"]));
  });

  it("stores independent metamagic profiles for specialized Sorcerer spells", () => {
    let progression = createProgression({ professionId: "sorcerer", level: 30 });
    progression = resolveProfessionChoice(progression, { professionId: "sorcerer", choiceId: "sorcerous-focus", optionId: "specialized-spellweaver" });
    expect(pendingProgressionChoices(progression)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "sorcerer:weave-spell-i" }),
      expect.objectContaining({ id: "sorcerer:weave-profile-i", profileId: "woven-spell-i" }),
      expect.objectContaining({ id: "spellweaver-discipline" }),
    ]));
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer:weave-spell-i", optionId: "lightning-bolt" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer:weave-profile-i", optionId: "quickened-signature" });
    progression = resolveProfessionChoice(progression, { professionId: "sorcerer", choiceId: "spellweaver-discipline", optionId: "constellation-weaver" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer:weave-spell-ii", optionId: "frost-lance" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer:weave-profile-ii", optionId: "shaped-signature" });
    expect(progression.professions[0].choices).toMatchObject({
      grantSelections: {
        "sorcerer:weave-spell-i": ["lightning-bolt"],
        "sorcerer:weave-spell-ii": ["frost-lance"],
      },
      metamagicProfiles: {
        "woven-spell-i": ["quickened-signature"],
        "woven-spell-ii": ["shaped-signature"],
      },
    });
    expect(progressionEntitlements(progression).abilities).toEqual(expect.arrayContaining(["lightning-bolt", "frost-lance"]));
    expect(progressionEntitlements(progression).metamagic).toEqual(expect.arrayContaining(["quickened-signature", "shaped-signature"]));
  });

  it("keeps signature exchange history without granting retired primary spells", () => {
    let progression = createProgression({ professionId: "sorcerer", level: 45 });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-spell", optionId: "fireball" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-exchange-25", optionId: "lightning-bolt" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-exchange-45", optionId: "frost-lance" });
    expect(progression.professions[0].choices).toMatchObject({
      signatureSpellId: "frost-lance",
      signatureExchanges: { 25: "lightning-bolt", 45: "frost-lance" },
    });
    expect(progressionEntitlements(progression).abilities).toContain("frost-lance");
    expect(progressionEntitlements(progression).abilities).not.toContain("fireball");
    expect(progressionEntitlements(progression).abilities).not.toContain("lightning-bolt");
    expect(progressionEntitlements(progression).proficiencies).toContain("sorcerer:signature-focus-history-25");
  });

  it("keeps compact Sorcerer repertoire and woven spell slots distinct", () => {
    let progression = createProgression({ professionId: "sorcerer", level: 48 });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-spell", optionId: "fireball" });
    let pending = pendingProgressionChoices(progression);
    expect(pending.find((choice) => choice.id === "sorcerer-secondary-spell").options).not.toContain("fireball");
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-secondary-spell", optionId: "lightning-bolt" });
    pending = pendingProgressionChoices(progression);
    expect(pending.find((choice) => choice.id === "sorcerer-tertiary-spell").options).not.toContain("fireball");
    expect(pending.find((choice) => choice.id === "sorcerer-tertiary-spell").options).not.toContain("lightning-bolt");
    expect(() => resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-tertiary-spell", optionId: "lightning-bolt" })).toThrow(/not available/);
    progression = resolveProfessionChoice(progression, { professionId: "sorcerer", choiceId: "sorcerous-focus", optionId: "specialized-spellweaver" });
    const wovenOptions = pendingProgressionChoices(progression).find((choice) => choice.id === "sorcerer:weave-spell-i").options;
    expect(wovenOptions).not.toContain("fireball");
    expect(wovenOptions).not.toContain("lightning-bolt");
  });

  it("allows keeping the current focus and re-learning a retired primary independently", () => {
    let progression = createProgression({ professionId: "sorcerer", level: 25 });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-spell", optionId: "fireball" });
    expect(pendingProgressionChoices(progression).find((choice) => choice.id === "sorcerer-signature-exchange-25").options).toContain("fireball");
    const kept = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-exchange-25", optionId: "fireball" });
    expect(kept.professions[0].choices.signatureSpellId).toBe("fireball");

    progression = createProgression({ professionId: "sorcerer", level: 25 });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-spell", optionId: "fireball" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-signature-exchange-25", optionId: "lightning-bolt" });
    expect(pendingProgressionChoices(progression).find((choice) => choice.id === "sorcerer-secondary-spell").options).toContain("fireball");
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-secondary-spell", optionId: "fireball" });
    expect(progressionEntitlements(progression).abilities).toEqual(expect.arrayContaining(["lightning-bolt", "fireball"]));
  });

  it("stores Singular Savant utility metamagic outside the core combat slots", () => {
    let progression = createProgression({ professionId: "sorcerer", level: 30 });
    expect(() => resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer-metamagic-1", optionId: "subtle-signature" })).toThrow(/not available/);
    progression = resolveProfessionChoice(progression, { professionId: "sorcerer", choiceId: "sorcerous-focus", optionId: "singular-savant" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer:singular-metamagic-i", optionId: "subtle-signature" });
    progression = resolveProfessionChoice(progression, { professionId: "sorcerer", choiceId: "singular-savant-discipline", optionId: "mutable-signature" });
    progression = resolveProgressionGrantChoice(progression, { professionId: "sorcerer", grantId: "sorcerer:singular-metamagic-ii", optionId: "triggered-signature" });
    expect(progression.professions[0].choices.metamagicIds).toMatchObject({ 6: "subtle-signature", 7: "triggered-signature" });
    expect(progressionEntitlements(progression).metamagic).toEqual(expect.arrayContaining(["subtle-signature", "triggered-signature"]));
  });
});

describe("separate advancement", () => {
  it("halts Cleric advancement at Sacred Domain until the choice is resolved", () => {
    const character = {
      race: "human", profession: "cleric", attributes: {},
      progression: createProgression({ professionId: "cleric", level: 9 }),
    };
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:cleric" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "branch", id: "sacred-domain" });
    pending = pendingLevelAllocations(character);
    expect(() => resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:cleric" }))
      .toThrow(/Resolve sacred-domain/);
    resolveProfessionChoice(character, { professionId: "cleric", choiceId: "sacred-domain", optionId: "life" });
    pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:cleric" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("halts Monk advancement at discipline thresholds until the physical branch is resolved", () => {
    const character = {
      race: "human", profession: "monk", attributes: {},
      progression: createProgression({ professionId: "monk", level: 9 }),
    };
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:monk" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "branch", id: "monk-discipline" });
    pending = pendingLevelAllocations(character);
    expect(() => resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:monk" }))
      .toThrow(/Resolve monk-discipline/);
    resolveProfessionChoice(character, { professionId: "monk", choiceId: "monk-discipline", optionId: "open-hand" });
    pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:monk" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("halts Barbarian advancement at Fury-path thresholds until the physical branch is resolved", () => {
    const character = {
      race: "human", profession: "barbarian", attributes: {},
      progression: createProgression({ professionId: "barbarian", level: 9 }),
    };
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:barbarian" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "branch", id: "barbarian-fury-path" });
    pending = pendingLevelAllocations(character);
    expect(() => resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:barbarian" }))
      .toThrow(/Resolve barbarian-fury-path/);
    resolveProfessionChoice(character, { professionId: "barbarian", choiceId: "barbarian-fury-path", optionId: "reaver" });
    pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:barbarian" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("halts Bard advancement at performance-path thresholds until the non-spell branch is resolved", () => {
    const character = {
      race: "human", profession: "bard", attributes: {},
      progression: createProgression({ professionId: "bard", level: 9 }),
    };
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:bard" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "branch", id: "bard-performance-path" });
    pending = pendingLevelAllocations(character);
    expect(() => resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:bard" }))
      .toThrow(/Resolve bard-performance-path/);
    resolveProfessionChoice(character, { professionId: "bard", choiceId: "bard-performance-path", optionId: "war-singer" });
    pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:bard" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("halts Ranger advancement at field-practice thresholds until the non-spell branch is resolved", () => {
    const character = {
      race: "human", profession: "ranger", attributes: {},
      progression: createProgression({ professionId: "ranger", level: 9 }),
    };
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:ranger" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "branch", id: "ranger-field-practice" });
    pending = pendingLevelAllocations(character);
    expect(() => resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:ranger" }))
      .toThrow(/Resolve ranger-field-practice/);
    resolveProfessionChoice(character, { professionId: "ranger", choiceId: "ranger-field-practice", optionId: "hunter" });
    pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:ranger" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("halts Rogue advancement at practice thresholds until the mundane branch is resolved", () => {
    const character = {
      race: "human", profession: "rogue", attributes: {},
      progression: createProgression({ professionId: "rogue", level: 9 }),
    };
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:rogue" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "branch", id: "rogue-practice" });
    pending = pendingLevelAllocations(character);
    expect(() => resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:rogue" }))
      .toThrow(/Resolve rogue-practice/);
    resolveProfessionChoice(character, { professionId: "rogue", choiceId: "rogue-practice", optionId: "infiltrator" });
    pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:rogue" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("halts Paladin advancement at the oath threshold until its non-spell protector path is resolved", () => {
    const character = {
      race: "human", profession: "paladin", attributes: {},
      progression: createProgression({ professionId: "paladin", level: 9 }),
    };
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:paladin" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "branch", id: "paladin-oath" });
    pending = pendingLevelAllocations(character);
    expect(() => resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:paladin" }))
      .toThrow(/Resolve paladin-oath/);
    resolveProfessionChoice(character, { professionId: "paladin", choiceId: "paladin-oath", optionId: "shield-oath" });
    pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:paladin" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("profession XP advances only profession ranks", () => {
    const character = { race: "human", profession: "fighter", attributes: {}, progression: createProgression({ professionId: "fighter", level: 10 }) };
    resolveProfessionChoice(character, { professionId: "fighter", choiceId: "warrior-specialization", optionId: "sellsword" });
    const result = advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(10));
    expect(result).toMatchObject({ beforeLevel: 10, afterLevel: 10, beforeEarnedLevel: 10, afterEarnedLevel: 11, earnedLevels: 1, unspentLevels: 1 });
    expect(professionProgressionLevel(character)).toBe(10);
    expect(racialProgressionLevel(character)).toBe(0);
    const pending = pendingLevelAllocations(character);
    expect(pending.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ optionId: "profession:fighter", name: "Advance Warrior" }),
      expect.objectContaining({ optionId: "racial:evolution", name: "Evolve Human" }),
    ]));
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:fighter" });
    expect(professionProgressionLevel(character)).toBe(11);
  });

  it("sequences a racial allocation, its threshold branch, then the next unspent level", () => {
    const character = {
      race: "vampire", profession: "fighter", attributes: {},
      progression: createProgression({ professionId: "fighter", level: 9, professionLevels: 0, racialLevels: 9, raceId: "vampire" }),
    };
    advanceProgression(character, progressionXpForLevel(10) - progressionXpForLevel(9));
    let pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "racial:evolution" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "racial-branch", id: "vampire-dark-legacy" });
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(10));
    expect(pendingProgressionChoices(character)[0].kind).toBe("racial-branch");
    resolveRacialProgressionChoice(character, { choiceId: "vampire-dark-legacy", optionId: "night-stalker" });
    expect(pendingProgressionChoices(character)[0]).toMatchObject({ kind: "level-allocation" });
  });

  it("racial XP advances only racial ranks", () => {
    const character = { race: "vampire", profession: "fighter", attributes: {}, progression: createProgression({ professionId: "fighter", raceId: "vampire", level: 10 }) };
    resolveProfessionChoice(character, { professionId: "fighter", choiceId: "warrior-specialization", optionId: "sellsword" });
    advanceRacialProgression(character, progressionXpForLevel(11) - progressionXpForLevel(10));
    expect(professionProgressionLevel(character)).toBe(10);
    expect(racialProgressionLevel(character)).toBe(0);
    const pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "racial:evolution" });
    expect(racialProgressionLevel(character)).toBe(1);
  });

  it("can establish a new multiclass track with any earned profession level", () => {
    const character = { race: "human", profession: "fighter", attributes: {}, progression: createProgression({ professionId: "fighter", level: 10 }) };
    resolveProfessionChoice(character, { professionId: "fighter", choiceId: "warrior-specialization", optionId: "sellsword" });
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(10));
    const pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, {
      choiceId: pending.choiceId,
      optionId: "profession:artisan",
      specializationId: "blacksmith",
    });
    expect(character.progression.professions.map((track) => track.professionId)).toEqual(["fighter", "artisan"]);
    expect(character.progression.professions.find((track) => track.professionId === "artisan").specializationId).toBe("blacksmith");
    expect(professionProgressionLevel(character)).toBe(11);
  });
});

describe("migration", () => {
  it("migrates v1 to v3 without expanding already-expanded attributes again", () => {
    const state = {
      progressionVersion: 1,
      character: {
        id: "wanderer", kind: "player", race: "vampire", profession: "archmage", archetype: "battle-archmage",
        attributes: { body: 42, reflex: 30, vigor: 35, mind: 70, wit: 55, presence: 40 },
        progression: { version: 1, professionId: "archmage", archetypeId: "battle-archmage", xp: progressionXpForLevel(100), paths: { oldProfession: 70, "awakened-lineage": 10, "dragon-ascendant-old": 20 } },
      },
      world: { codex: { characters: {} } }, turns: [], pools: { codex: [] },
    };
    const before = { ...state.character.attributes };
    migrateProgressionState(state);
    expect(state).toMatchObject({ progressionVersion: PROGRESSION_VERSION, attributeScaleVersion: ATTRIBUTE_SCALE_VERSION });
    expect(state.character.attributes).toEqual(before);
    expect(state.character.progression).toMatchObject({ version: PROGRESSION_VERSION, professionId: "wizard", archetypeId: "battle-archmage" });
    expect(progressionLevel(state.character)).toBe(100);
    expect(professionProgressionLevel(state.character)).toBe(70);
    expect(racialProgressionLevel(state.character)).toBe(30);
    const once = structuredClone(state);
    migrateProgressionState(state);
    expect(state).toEqual(once);
  });

  it("still expands truly legacy 0-30 attributes once", () => {
    const state = {
      character: { id: "wanderer", kind: "player", race: "human", profession: "fighter", level: 25, attributes: { body: 20, reflex: 10, vigor: 10, mind: 5, wit: 5, presence: 5 } },
      world: { codex: { characters: {} } }, turns: [],
    };
    migrateProgressionState(state);
    expect(state.character.attributes.body).toBeGreaterThan(20);
    const once = structuredClone(state);
    migrateProgressionState(state);
    expect(state).toEqual(once);
  });

  it("migrates timeline and pooled Codex snapshots", () => {
    const legacy = () => ({ profession: "hedge-mage", race: "human", level: 12, attributes: { body: 3, reflex: 3, vigor: 3, mind: 10, wit: 6, presence: 4 } });
    const state = {
      character: { id: "wanderer", kind: "player", ...legacy() },
      world: { codex: { characters: { npc: { id: "npc", ...legacy() } } } },
      turns: [{ char: legacy(), world: { codex: { characters: { past: legacy() } } } }],
      pools: { codex: [{ characters: { pooled: legacy() } }] },
    };
    migrateProgressionState(state);
    expect(state.world.codex.characters.npc.progression.version).toBe(PROGRESSION_VERSION);
    expect(state.turns[0].char.progression.version).toBe(PROGRESSION_VERSION);
    expect(state.turns[0].world.codex.characters.past.progression.version).toBe(PROGRESSION_VERSION);
    expect(state.pools.codex[0].characters.pooled.progression.version).toBe(PROGRESSION_VERSION);
  });

  it("purges Tower player projections throughout live, timeline, and pooled state without touching world powers", () => {
    const contaminated = (overrides = {}) => ({
      id: "wanderer",
      profession: "ranger",
      archetype: "ranger",
      combatArchetypeId: "ranger",
      progressionModel: "tow-archetype",
      towBaseStats: { hp: 96, resolve: 8 },
      attributes: { body: 6, reflex: 8, vigor: 5, mind: 3, wit: 7, presence: 4 },
      abilities: [
        { id: "gate", tier: "legendary" },
        { id: "power-strike", tier: "rare" },
        { id: "field-lore", rating: 2 },
      ],
      racialPassives: ["darkvision"],
      progression: createProgression({ professionId: "ranger", level: 25 }),
      level: 25,
      subclass: "old-ranger-specialization",
      profession_plan: [{ profession: "ranger", levels: 25 }],
      signature_spell: "fireball",
      metamagic: ["quickened-signature"],
      ...overrides,
    });
    const unmarkedProjection = (overrides = {}) => {
      const projection = contaminated(overrides);
      delete projection.progressionModel;
      return projection;
    };
    const nonTower = (version, marker) => {
      const progression = createProgression({ professionId: "fighter", level: 10 });
      progression.version = version;
      progression.professions[0].choices.saveMarker = marker;
      return { id: marker, profession: "fighter", race: "human", attributes: {}, progression };
    };
    const state = {
      progressionVersion: 3,
      attributeScaleVersion: ATTRIBUTE_SCALE_VERSION,
      character: (() => {
        const root = unmarkedProjection({ kind: "player" });
        delete root.combatArchetypeId;
        delete root.towBaseStats;
        return root;
      })(),
      world: { codex: { characters: {
        wanderer: contaminated(),
        towerCompanion: contaminated({ id: "towerCompanion" }),
        legacyV2: nonTower(2, "v2-choice"),
        legacyV3: nonTower(3, "v3-choice"),
      } } },
      turns: [{
        char: unmarkedProjection({ kind: "player" }),
        world: { codex: { characters: { wanderer: unmarkedProjection() } } },
      }],
      pools: { codex: [{ characters: {
        wanderer: unmarkedProjection(),
        towerCompanion: contaminated({ id: "towerCompanion" }),
      } }] },
    };

    migrateProgressionState(state);

    const towerSnapshots = [
      state.character,
      state.world.codex.characters.wanderer,
      state.world.codex.characters.towerCompanion,
      state.turns[0].char,
      state.turns[0].world.codex.characters.wanderer,
      state.pools.codex[0].characters.wanderer,
      state.pools.codex[0].characters.towerCompanion,
    ];
    for (const character of towerSnapshots) {
      expect(character).toMatchObject({
        profession: "ranger",
        archetype: "ranger",
        combatArchetypeId: "ranger",
        progressionModel: "tow-archetype",
        towBaseStats: { hp: 96, resolve: 8 },
        attributes: { body: 6, reflex: 8, vigor: 5, mind: 3, wit: 7, presence: 4 },
        abilities: [{ id: "gate", tier: "legendary" }],
        racialPassives: ["darkvision"],
      });
      for (const key of ["progression", "level", "subclass", "profession_plan", "signature_spell", "metamagic"]) {
        expect(character).not.toHaveProperty(key);
      }
    }
    expect(state.world.codex.characters.legacyV2.progression).toMatchObject({
      version: PROGRESSION_VERSION,
      professions: [expect.objectContaining({ choices: expect.objectContaining({ saveMarker: "v2-choice" }) })],
    });
    expect(state.world.codex.characters.legacyV3.progression).toMatchObject({
      version: PROGRESSION_VERSION,
      professions: [expect.objectContaining({ choices: expect.objectContaining({ saveMarker: "v3-choice" }) })],
    });
    const once = structuredClone(state);
    migrateProgressionState(state);
    expect(state).toEqual(once);
  });

  it("recognizes an unmarked historical Tower projection from its combat archetype id", () => {
    const legacyProgression = createProgression({ professionId: "fighter", level: 18 });
    const projection = (overrides = {}) => ({
      id: "wanderer",
      profession: "fighter",
      archetype: "knight",
      combatArchetypeId: "arctic-knight",
      towBaseStats: { hp: 186, resolve: 8 },
      attributes: { body: 8, reflex: 5, vigor: 9, mind: 3, wit: 4, presence: 5 },
      progression: structuredClone(legacyProgression),
      level: 18,
      subclass: "retired-knight-specialization",
      ...overrides,
    });
    const state = {
      progressionVersion: 3,
      attributeScaleVersion: ATTRIBUTE_SCALE_VERSION,
      character: projection({ kind: "player" }),
      world: { codex: { characters: { wanderer: projection() } } },
      turns: [{
        char: projection({ kind: "player" }),
        world: { codex: { characters: { wanderer: projection() } } },
      }],
      pools: { codex: [{ characters: { wanderer: projection() } }] },
    };

    migrateProgressionState(state);

    for (const character of [
      state.character,
      state.world.codex.characters.wanderer,
      state.turns[0].char,
      state.turns[0].world.codex.characters.wanderer,
      state.pools.codex[0].characters.wanderer,
    ]) {
      expect(character).toMatchObject({
        progressionModel: "tow-archetype",
        combatArchetypeId: "arctic-knight",
        towBaseStats: { hp: 186, resolve: 8 },
      });
      expect(character).not.toHaveProperty("progression");
      expect(character).not.toHaveProperty("level");
      expect(character).not.toHaveProperty("subclass");
    }
  });

  it("preserves compact v2 multiclass tracks without rebuilding a graph", () => {
    const legacy = createProgression({
      level: 3,
      professions: [
        { profession: "fighter", levels: 2 },
        { profession: "artisan", specialization: "blacksmith", levels: 1 },
      ],
      raceId: "human",
    });
    legacy.version = 2;
    const character = { race: "human", profession: "fighter", attributes: {}, progression: legacy };

    normalizeCharacterProgression(character);

    expect(character.progression.version).toBe(PROGRESSION_VERSION);
    expect(character.progression).not.toHaveProperty("professionTree");
    expect(character.progression.professions.map((track) => [track.professionId, Object.values(track.paths).reduce((sum, rank) => sum + rank, 0)]))
      .toEqual([["fighter", 2], ["artisan", 1]]);
  });

  it("preserves v3 structured choices while advancing the schema version", () => {
    const saved = createProgression({ professionId: "sorcerer", level: 25 });
    saved.version = 3;
    saved.professions[0].choices = {
      ...saved.professions[0].choices,
      signatureSpellId: "fireball",
      metamagicIds: ["empowered-signature"],
      saveMarker: "v3-choice",
    };
    const character = { race: "human", profession: "sorcerer", attributes: {}, progression: saved };

    normalizeCharacterProgression(character);

    expect(character.progression).toMatchObject({
      version: PROGRESSION_VERSION,
      professions: [expect.objectContaining({
        choices: expect.objectContaining({
          signatureSpellId: "fireball",
          metamagicIds: ["empowered-signature"],
          saveMarker: "v3-choice",
        }),
      })],
    });
  });

  it("collapses retired v3 graph allocations into class levels and prunes unreachable branch choices", () => {
    const legacy = createProgression({
      level: 12,
      racialLevels: 1,
      professions: [
        {
          profession: "fighter",
          levels: 10,
          choices: { saveMarker: "fighter-choice" },
          branchChoices: { "warrior-specialization": "sellsword" },
        },
        { profession: "artisan", specialization: "blacksmith", levels: 1 },
      ],
      racial: { raceId: "vampire", levels: 1, choices: { saveMarker: "racial-choice" } },
      activeProfessionId: "artisan",
    });
    const savedXp = legacy.xp;
    legacy.professions[0].branchChoices["sellsword-method"] = "arsenal-adept";
    legacy.professions[0].paths = {};
    legacy.professionTree = {
      version: 1,
      startProfessionId: "fighter",
      allocations: Object.fromEntries([
        ...Array.from({ length: 10 }, (_, index) => [`retired-fighter-${index}`, { professionId: "fighter", trackLevel: index + 1, order: index + 1 }]),
        ["retired-artisan-0", { professionId: "artisan", trackLevel: 1, order: 11 }],
      ]),
    };
    const character = { race: "vampire", profession: "artisan", attributes: {}, progression: legacy };

    normalizeCharacterProgression(character);

    expect(character.progression).not.toHaveProperty("professionTree");
    expect(character.progression).toMatchObject({
      version: PROGRESSION_VERSION,
      activeProfessionId: "artisan",
      professionId: "artisan",
      archetypeId: "blacksmith",
      xp: savedXp,
      racial: { raceId: "vampire", choices: { saveMarker: "racial-choice" } },
    });
    expect(character.progression.professions.map((track) => [track.professionId, Object.values(track.paths).reduce((sum, rank) => sum + rank, 0)]))
      .toEqual([["fighter", 10], ["artisan", 1]]);
    expect(character.progression.professions[0]).toMatchObject({
      choices: { saveMarker: "fighter-choice" },
      branchChoices: { "warrior-specialization": "sellsword" },
    });
    expect(professionProgressionLevel(character)).toBe(11);
    expect(racialProgressionLevel(character)).toBe(1);
  });
});

describe("summary", () => {
  it("returns numeric track breakdowns without a labeled power tier", () => {
    const character = { profession: "fighter", race: "human", progression: createProgression({ professionId: "fighter", level: 35 }) };
    const summary = progressionSummary(character);
    expect(summary).toMatchObject({ level: 35, professionLevel: 35, professionCap: 70, racialLevel: 0, racialCap: 30 });
    expect(summary).not.toHaveProperty("tier");
  });
});
