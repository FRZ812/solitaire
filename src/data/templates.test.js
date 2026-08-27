import { describe, expect, it } from "vitest";
import { AUTHORED_TEMPLATE_LEVELS, CHARACTER_TEMPLATES, TEMPLATE_RACIAL_LEVELS } from "./templates.js";
import { PROFESSIONS } from "./professions.js";
import { RACES } from "./races.js";
import { itemTemplate } from "./catalog.js";
import { getAbilityDef } from "./abilities.js";
import { CHARACTER_PORTRAITS } from "../components/character-portrait-assets.js";
import { characterArchetype } from "./character-archetypes.js";
import { ratingFromXp } from "./proficiencies.js";
import { compileCharacterProgression } from "./progression-paths.js";
import { pendingProgressionChoices, professionProgressionLevel, progressionLevel, racialProgressionLevel } from "../engine/progression.js";

const rankTotal = (paths = {}) => Object.values(paths).reduce((sum, rank) => sum + (Number(rank) || 0), 0);

describe("authored character templates", () => {
  it("keeps every ready-made character unique and fully authored", () => {
    expect(CHARACTER_TEMPLATES).toHaveLength(27);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.id)).size).toBe(27);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.setup.name)).size).toBe(27);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.portraitKey)).size).toBe(27);
    for (const template of CHARACTER_TEMPLATES) {
      expect(template.voice, `${template.id} voice`).toBeTruthy();
      expect(template.complication, `${template.id} complication`).toBeTruthy();
      expect(template.signature, `${template.id} signature`).toBeTruthy();
      expect(template.portraitKey).toBe(`template:${template.id}`);
      expect(template).not.toHaveProperty("opening");
      expect(template).not.toHaveProperty("icon");
    }
  });

  it("references canonical races, professions, abilities, and gear", () => {
    for (const template of CHARACTER_TEMPLATES) {
      expect(RACES[template.setup.race], `${template.id} race`).toBeTruthy();
      expect(PROFESSIONS[template.setup.profession], `${template.id} profession`).toBeTruthy();
      for (const ability of template.setup.abilities || []) {
        expect(getAbilityDef(ability.id), `${template.id} ability ${ability.id}`).toBeTruthy();
      }
      for (const item of template.setup.items || []) {
        expect(itemTemplate(item.itemId), `${template.id} item ${item.itemId}`).toBeTruthy();
      }
    }
  });

  it("persists a specialized archetype separately from the broad profession", () => {
    const shadowblade = CHARACTER_TEMPLATES.find((template) => template.id === "shadowblade");
    expect(shadowblade.setup).toMatchObject({ profession: "rogue", archetype: "shadowblade" });
    expect(characterArchetype({ templateId: "shadowblade", profession: "rogue" }))
      .toMatchObject({ id: "shadowblade", label: "Shadowblade" });
    for (const template of CHARACTER_TEMPLATES) {
      expect(template.setup).not.toHaveProperty("subclass");
      if (template.id !== template.setup.profession) expect(template.setup.archetype, `${template.id} specialization`).toBeTruthy();
    }
  });

  it("uses individually authored campaign levels instead of tier anchor templates", () => {
    expect(new Set(Object.values(AUTHORED_TEMPLATE_LEVELS)).size).toBe(CHARACTER_TEMPLATES.length);
    for (const template of CHARACTER_TEMPLATES) {
      expect(progressionLevel(template.setup), `${template.id} starting level`)
        .toBe(AUTHORED_TEMPLATE_LEVELS[template.id]);
      if (template.tier === "divine") expect(progressionLevel(template.setup)).toBeGreaterThan(85);
      if (template.tier === "mythical") expect(progressionLevel(template.setup)).toBeGreaterThan(70);
      if (template.tier === "legendary") expect(progressionLevel(template.setup)).toBeGreaterThan(60);
      if (template.tier === "epic") expect(progressionLevel(template.setup)).toBeGreaterThan(40);
    }
  });

  it("starts every ready-made sheet on its exact racial and multiclass route", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const tracks = template.setup.progression.professions.map((track) => ({
        professionId: track.professionId,
        specializationId: track.specializationId,
        levels: rankTotal(track.paths),
        choices: track.choices,
        branchChoices: track.branchChoices,
      }));
      const route = compileCharacterProgression({
        professions: tracks,
        racial: {
          raceId: template.setup.progression.racial.raceId,
          evolutionId: template.setup.progression.racial.evolutionId,
          levels: rankTotal(template.setup.progression.racial.paths),
          branchChoices: template.setup.progression.racial.branchChoices,
        },
      });
      expect(template.setup.attributes, `${template.id} route attributes`).toEqual(route.finalAttributes);
      expect(racialProgressionLevel(template.setup), `${template.id} racial levels`).toBe(TEMPLATE_RACIAL_LEVELS[template.id]);
      expect(professionProgressionLevel(template.setup) + racialProgressionLevel(template.setup), `${template.id} allocated total`).toBe(AUTHORED_TEMPLATE_LEVELS[template.id]);
      expect(professionProgressionLevel(template.setup)).toBeLessThanOrEqual(70);
      expect(racialProgressionLevel(template.setup)).toBeLessThanOrEqual(30);
      expect(pendingProgressionChoices(template.setup).filter((choice) => choice.kind === "racial-branch"), `${template.id} racial choices`).toEqual([]);
    }
  });

  it("keeps Devout below Sacred Domain and resolves War-Priest as War Domain", () => {
    const devout = CHARACTER_TEMPLATES.find((template) => template.id === "devout");
    const warPriest = CHARACTER_TEMPLATES.find((template) => template.id === "war-priest");
    expect(racialProgressionLevel(devout.setup)).toBe(2);
    expect(professionProgressionLevel(devout.setup)).toBe(9);
    expect(devout.setup.progression.professions[0].branchChoices).not.toHaveProperty("sacred-domain");
    expect(pendingProgressionChoices(devout.setup)).toEqual([]);
    expect(warPriest.setup.progression.professions.find((track) => track.professionId === "cleric").branchChoices)
      .toMatchObject({ "sacred-domain": "war" });
    expect(pendingProgressionChoices(warPriest.setup)).toEqual([]);
  });

  it("fully authors reached Sorcerer choices and independent spell profiles", () => {
    const highSorcerer = CHARACTER_TEMPLATES.find((template) => template.id === "high-sorcerer");
    const dragonAscendant = CHARACTER_TEMPLATES.find((template) => template.id === "dragon-ascendant");
    expect(pendingProgressionChoices(highSorcerer.setup), "high-sorcerer pending choices").toEqual([]);
    expect(pendingProgressionChoices(dragonAscendant.setup), "dragon-ascendant pending choices").toEqual([]);
    const highTrack = highSorcerer.setup.progression.professions.find((track) => track.professionId === "sorcerer");
    expect(highTrack.branchChoices).toMatchObject({
      "sorcerous-focus": "specialized-spellweaver",
      "spellweaver-discipline": "constellation-weaver",
      "constellation-weaver-apotheosis": "grand-constellation",
    });
    expect(highTrack.choices.metamagicProfiles).toMatchObject({
      "woven-spell-i": ["quickened-signature"],
      "woven-spell-ii": ["shaped-signature"],
      "woven-spell-iii": ["transmuted-signature"],
    });
    const dragonTrack = dragonAscendant.setup.progression.professions.find((track) => track.professionId === "sorcerer");
    expect(dragonTrack.branchChoices).toMatchObject({
      "sorcerous-focus": "singular-savant",
      "singular-savant-discipline": "overwhelming-signature",
    });
  });

  it("fully authors reached Wizard choices for every ready-made Wizard track", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const wizard = template.setup.progression.professions.find((track) => track.professionId === "wizard");
      if (!wizard) continue;
      expect(
        pendingProgressionChoices(template.setup).filter((choice) => choice.professionId === "wizard"),
        `${template.id} Wizard choices`,
      ).toEqual([]);
    }
  });

  it("fully resolves every reached Warrior branch with native Warrior abilities", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const warrior = template.setup.progression.professions.find((track) => track.professionId === "fighter");
      if (!warrior) continue;
      expect(["sellsword", "duelist", "iron-vanguard", "undying-champion"], `${template.id} Warrior specialization`)
        .toContain(warrior.specializationId);
      expect(
        pendingProgressionChoices(template.setup).filter((choice) => choice.professionId === "fighter"),
        `${template.id} Warrior choices`,
      ).toEqual([]);
    }

    const sellsword = CHARACTER_TEMPLATES.find((template) => template.id === "sellsword");
    const duelist = CHARACTER_TEMPLATES.find((template) => template.id === "duelist");
    const champion = CHARACTER_TEMPLATES.find((template) => template.id === "undying-champion");
    expect(PROFESSIONS.fighter.name).toBe("Warrior");
    expect(duelist.setup.progression.professions[0].branchChoices)
      .toMatchObject({ "warrior-specialization": "duelist" });
    expect(champion.setup.progression.professions[0].branchChoices).toMatchObject({
      "warrior-specialization": "undying-champion",
      "undying-champion-method": "last-stand-exemplar",
      "last-stand-apotheosis": "deathless-victor",
    });

    const retired = new Set([
      "power-strike", "cleave", "earthshatter", "reaping", "bulwark-stance", "execute",
      "rapid-jabs", "feint", "lunge", "shadowstep", "whirlwind", "unbreakable-will", "second-wind",
    ]);
    for (const template of [sellsword, duelist, champion]) {
      const abilityIds = template.setup.abilities.map((ability) => ability.id);
      expect(abilityIds.every((id) => id.startsWith("warrior-")), template.id).toBe(true);
      expect(abilityIds.some((id) => retired.has(id)), template.id).toBe(false);
    }
  });

  it("keeps the level-8 Reaver below its first branch and grants only earned native Barbarian cards", () => {
    const reaver = CHARACTER_TEMPLATES.find((template) => template.id === "reaver");
    const track = reaver.setup.progression.professions.find((entry) => entry.professionId === "barbarian");
    expect(reaver.setup).toMatchObject({ profession: "barbarian", archetype: "reaver" });
    expect(rankTotal(track.paths)).toBe(8);
    expect(track.branchChoices).not.toHaveProperty("barbarian-fury-path");
    expect(pendingProgressionChoices(reaver.setup)).toEqual([]);
    expect(reaver.setup.abilities.map((ability) => ability.id)).toEqual([
      "barbarian-brutal-swing",
      "barbarian-bait-the-blow",
    ]);
    expect(reaver.setup.abilities.some((ability) => ["power-strike", "rend", "second-wind"].includes(ability.id))).toBe(false);
  });

  it("routes every ready-made Ranger through reached fieldcraft branches with only native Ranger cards", () => {
    const ranger = CHARACTER_TEMPLATES.find((template) => template.id === "ranger");
    const beastWarden = CHARACTER_TEMPLATES.find((template) => template.id === "beast-warden");
    const dragonHunter = CHARACTER_TEMPLATES.find((template) => template.id === "dragon-hunter");
    expect(PROFESSIONS.ranger.specializations.map((entry) => entry.name)).toEqual([
      "Hunter", "Trailblazer", "Beast Warden", "Trapper",
    ]);
    expect(ranger.setup.progression.professions.find((track) => track.professionId === "ranger").branchChoices)
      .toMatchObject({ "ranger-field-practice": "hunter" });
    expect(beastWarden.setup.progression.professions.find((track) => track.professionId === "ranger").branchChoices)
      .toMatchObject({ "ranger-field-practice": "beast-warden", "beast-warden-method": "packmaster" });
    expect(dragonHunter.setup.progression.professions.find((track) => track.professionId === "ranger").branchChoices)
      .toMatchObject({ "ranger-field-practice": "hunter", "hunter-method": "monster-stalker" });
    for (const template of [ranger, beastWarden, dragonHunter]) {
      expect(pendingProgressionChoices(template.setup).filter((choice) => choice.professionId === "ranger"), template.id).toEqual([]);
      expect(template.setup.abilities.every((ability) => ability.id.startsWith("ranger-")), template.id).toBe(true);
      expect(template.setup.abilities.some((ability) => [
        "aimed-shot", "hamstring-shot", "snare", "twin-shot", "piercing-shot", "arrow-volley", "pinning-shot",
      ].includes(ability.id)), template.id).toBe(false);
    }
  });

  it("routes ready-made Rogues through mundane paths with native Rogue kits", () => {
    const cutthroat = CHARACTER_TEMPLATES.find((template) => template.id === "cutthroat");
    const shadowblade = CHARACTER_TEMPLATES.find((template) => template.id === "shadowblade");
    expect(PROFESSIONS.rogue.specializations.map((entry) => entry.name)).toEqual([
      "Infiltrator", "Scoundrel", "Assassin", "Saboteur",
    ]);
    expect(cutthroat.setup.progression.professions.find((track) => track.professionId === "rogue").branchChoices)
      .toMatchObject({ "rogue-practice": "assassin" });
    expect(shadowblade.setup.progression.professions.find((track) => track.professionId === "rogue").branchChoices)
      .toMatchObject({ "rogue-practice": "infiltrator", "rogue-infiltrator-method": "crowd-ghost" });
    expect(shadowblade.setup.progression.professions.find((track) => track.professionId === "wizard").branchChoices)
      .toMatchObject({ "wizard-school": "illusion" });
    for (const template of [cutthroat, shadowblade]) {
      expect(pendingProgressionChoices(template.setup).filter((choice) => choice.professionId === "rogue"), template.id).toEqual([]);
      expect(template.setup.abilities.every((ability) => ability.id.startsWith("rogue-")), template.id).toBe(true);
      expect(template.setup.abilities.some((ability) => [
        "rapid-jabs", "feint", "venom-strike", "shadowstep", "disarming-strike", "execute", "lunge",
      ].includes(ability.id)), template.id).toBe(false);
    }
  });

  it("routes ready-made Paladins through oathbound paths with native non-spell kits", () => {
    const knight = CHARACTER_TEMPLATES.find((template) => template.id === "knight-errant");
    const champion = CHARACTER_TEMPLATES.find((template) => template.id === "champion-paladin");
    const knightTrack = knight.setup.progression.professions.find((track) => track.professionId === "paladin");
    const championTrack = champion.setup.progression.professions.find((track) => track.professionId === "paladin");
    const championWarrior = champion.setup.progression.professions.find((track) => track.professionId === "fighter");
    expect(PROFESSIONS.paladin.specializations.map((entry) => entry.name)).toEqual([
      "Shield Oath", "Truth Oath", "Mercy Oath", "Beacon Oath",
    ]);
    expect(rankTotal(knightTrack.paths)).toBe(22);
    expect(knightTrack.branchChoices).toMatchObject({ "paladin-oath": "beacon-oath" });
    expect(rankTotal(championTrack.paths)).toBe(35);
    expect(championTrack.branchChoices).toMatchObject({
      "paladin-oath": "shield-oath", "paladin-shield-method": "shieldbearer",
    });
    expect(championWarrior.branchChoices).toMatchObject({ "warrior-specialization": "iron-vanguard" });
    expect(pendingProgressionChoices(knight.setup).filter((choice) => choice.professionId === "paladin")).toEqual([]);
    expect(pendingProgressionChoices(champion.setup).filter((choice) => choice.professionId === "paladin")).toEqual([]);
    expect(knight.setup.abilities.map((ability) => ability.id)).toEqual([
      "paladin-oathguard", "paladin-vowed-strike", "paladin-stand-fast", "paladin-challenge-of-witness", "paladin-beacon-stance",
    ]);
    expect(champion.setup.abilities.map((ability) => ability.id)).toEqual([
      "paladin-oathguard", "paladin-vowed-strike", "paladin-stand-fast", "paladin-challenge-of-witness",
      "paladin-bear-the-blow", "paladin-steadfast-word", "paladin-shield-covenant", "paladin-rampart-exchange",
    ]);
    const retired = new Set(["power-strike", "bulwark-stance", "shield-bash", "second-wind", "smite", "heal", "radiance", "shield-of-faith", "judgment"]);
    for (const template of [knight, champion]) {
      expect(template.setup.abilities.every((ability) => ability.id.startsWith("paladin-")), template.id).toBe(true);
      expect(template.setup.abilities.some((ability) => retired.has(ability.id)), template.id).toBe(false);
      expect(template.setup.proficiencies?.spellcasting, template.id).toBeUndefined();
    }
    expect(champion.role).toBe("Protector");
    expect(champion.concept).not.toMatch(/heal|smite/i);
  });

  it("gives trained caster templates power-appropriate spellcasting mastery", () => {
    const devout = CHARACTER_TEMPLATES.find((template) => template.id === "devout");
    const hedgeMage = CHARACTER_TEMPLATES.find((template) => template.id === "hedge-mage");
    const korvane = CHARACTER_TEMPLATES.find((template) => template.id === "enchanter-tyrant");
    const sellsword = CHARACTER_TEMPLATES.find((template) => template.id === "sellsword");

    expect(ratingFromXp(devout.setup.proficiencies.spellcasting)).toBe(2);
    expect(ratingFromXp(hedgeMage.setup.proficiencies.spellcasting)).toBe(4);
    expect(ratingFromXp(korvane.setup.proficiencies.spellcasting)).toBe(15);
    expect(sellsword.setup.proficiencies?.spellcasting).toBeUndefined();
  });

  it("keeps template portraits unique and limits aliases to the same combat archetype", () => {
    const generated = Object.values(CHARACTER_PORTRAITS);
    expect(generated).toHaveLength(51);
    expect(new Set(generated).size).toBe(39);
    expect(CHARACTER_PORTRAITS["dragon-hunter"]).toContain("dragon-hunter-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["high-sorcerer"]).toContain("high-sorcerer-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["court-envoy"]).toContain("court-envoy-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["confidence-artist"]).toContain("confidence-artist-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["guild-advocate"]).toContain("guild-advocate-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["velvet-courtier"]).toContain("velvet-courtier-portrait-v3.png");
    const aliases = {
      knight: "arctic-knight",
      ranger: "demon-slayer",
      artificer: "owner-of-clocktower",
      berserker: "old-king-of-northland",
      sorcerer: "sleepless-one",
      rogue: "last-assassin",
      warlock: "witch-of-eternity",
      wizard: "tenacious-mage",
      paladin: "exiled-priestess",
      blademaster: "wandering-blade",
      vampire: "desolate-vampire",
      automaton: "forsaken-automaton",
    };
    const archetypePortraits = Object.keys(aliases).map((id) => CHARACTER_PORTRAITS[`tow:${id}`]);
    expect(new Set(archetypePortraits).size).toBe(archetypePortraits.length);
    for (const [id, legacyId] of Object.entries(aliases)) {
      expect(CHARACTER_PORTRAITS[`tow:${legacyId}`]).toBe(CHARACTER_PORTRAITS[`tow:${id}`]);
    }
  });
});
