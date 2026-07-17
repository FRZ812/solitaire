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
  pendingProgressionChoices,
  professionProgressionLevel,
  progressionEntitlements,
  progressionLevel,
  progressionSummary,
  racialProgressionLevel,
  resolveProfessionChoice,
  resolveLevelAllocationChoice,
  resolveRacialProgressionChoice,
  resolveProgressionGrantChoice,
} from "./progression.js";
import { progressionXpForLevel } from "../data/progression-paths.js";

describe("progression v2 allocation", () => {
  it("derives a 100 total from an independent 70/30 allocation", () => {
    const progression = createProgression({ professionId: "wizard", raceId: "vampire", level: 100 });
    expect(progression).toMatchObject({ version: 2, professionId: "wizard", racial: { raceId: "vampire" } });
    expect(professionProgressionLevel(progression)).toBe(70);
    expect(racialProgressionLevel(progression)).toBe(30);
    expect(progressionLevel(progression)).toBe(100);
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
});

describe("choices and entitlements", () => {
  it("does not silently select a Wizard school and resolves nested choices explicitly", () => {
    const progression = createProgression({ professionId: "wizard", level: 50 });
    expect(pendingProgressionChoices(progression).map((choice) => choice.id)).toContain("wizard-school");
    const necromancer = resolveProfessionChoice(progression, { professionId: "wizard", choiceId: "wizard-school", optionId: "necromancy" });
    expect(pendingProgressionChoices(necromancer).map((choice) => choice.id)).toContain("necromancy-discipline");
    const deathMage = resolveProfessionChoice(necromancer, { professionId: "wizard", choiceId: "necromancy-discipline", optionId: "death-magic" });
    expect(pendingProgressionChoices(deathMage).map((choice) => choice.id)).toContain("death-magic-mastery");
    const final = resolveProfessionChoice(deathMage, { professionId: "wizard", choiceId: "death-magic-mastery", optionId: "instant-death" });
    expect(progressionEntitlements(final).abilities).toContain("grasp-heart");
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

  it("targeted profession XP can establish a new multiclass track", () => {
    const character = { race: "human", profession: "fighter", attributes: {}, progression: createProgression({ professionId: "fighter", level: 10 }) };
    resolveProfessionChoice(character, { professionId: "fighter", choiceId: "warrior-specialization", optionId: "sellsword" });
    advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(10));
    const pending = pendingLevelAllocations(character);
    resolveLevelAllocationChoice(character, { choiceId: pending.choiceId, optionId: "profession:artisan", specializationId: "blacksmith" });
    expect(character.progression.professions.map((track) => track.professionId)).toEqual(["fighter", "artisan"]);
    expect(character.progression.professions.find((track) => track.professionId === "artisan").specializationId).toBe("blacksmith");
    expect(professionProgressionLevel(character)).toBe(11);
  });
});

describe("migration", () => {
  it("migrates v1 to v2 without expanding already-expanded attributes again", () => {
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
    expect(state.character.progression).toMatchObject({ version: 2, professionId: "wizard", archetypeId: "battle-archmage" });
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
    expect(state.world.codex.characters.npc.progression.version).toBe(2);
    expect(state.turns[0].char.progression.version).toBe(2);
    expect(state.turns[0].world.codex.characters.past.progression.version).toBe(2);
    expect(state.pools.codex[0].characters.pooled.progression.version).toBe(2);
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
