import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFESSIONS } from "../data/professions.js";
import {
  compileProfessionTrack,
  compileRacialTrack,
  professionBranchChoices,
  RACIAL_PROFILES,
  racialBranchChoices,
} from "../data/progression-paths.js";
import { ProfessionCatalog, ProfessionProgression, RacialProgression } from "./ProfessionProgression.jsx";

describe("layered Profession Codex", () => {
  it("lists broad combat and noncombat professions against the shared 70-level budget", () => {
    const html = renderToStaticMarkup(<ProfessionCatalog character={null} />);

    expect(html).toContain("broad professions");
    expect(html).toContain("0–70 levels");
    expect(html).toContain("Warrior");
    expect(html).not.toContain(">Fighter<");
    expect(html).toContain("Wizard");
    expect(html).toContain("Artisan");
    expect(html).toContain("Healer");
    expect(html).toContain("Scholar");
    expect(html).toContain("Professions &amp; specializations");
    expect(html).not.toContain("100 levels");
    expect(html).not.toContain("Racial or utility branch");
  });

  it("keeps general profession rewards separate from specialization overlays and nested thresholds", () => {
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.wizard} currentLevel={0} onBack={() => {}} />,
    );

    expect(html).toContain("Broad profession · 0–70");
    expect(html).toContain("General rewards");
    expect(html).toContain("Specialization overlays");
    expect(html).toContain("Branch thresholds");
    expect(html).toContain("Never chosen automatically");
    expect(html).toContain("Abjuration");
    expect(html).toContain("Necromancy");
    expect(html).toContain("Undead Lord");
    expect(html).toContain("Death Magic");
    expect(html).toContain("Levels 1–70");
    expect(html).not.toContain("Grade rank caps");
    expect(html).not.toContain("Level 100 projection");
  });

  it("renders Cleric as a complete prepared-divine profession with nested domain ministries", () => {
    const compiled = compileProfessionTrack("cleric");
    const definitions = professionBranchChoices("cleric");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.cleric} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(compiled.levels.map((row) => row.trackLevel)).toEqual(
      Array.from({ length: 70 }, (_, index) => index + 1),
    );
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels.every((row) => row.authoredContent && row.featureDescription)).toBe(true);
    expect(html).toContain("<h2");
    expect(html).toContain(">Cleric</h2>");
    expect(html).toContain("Devout");
    expect(html).toContain("War-Priest");
    expect(PROFESSIONS.cleric.specializations.map((entry) => entry.name)).toEqual(["Devout", "War-Priest"]);
    expect(html).toContain("Levels 1–70");
    expect(html).toContain("Levels 1–10");
    expect(html).toContain("Levels 11–20");
    expect(html).toContain("Levels 21–30");
    expect(html).toContain("Levels 31–40");
    expect(html).toContain("Levels 41–50");
    expect(html).toContain("Levels 51–60");
    expect(html).toContain("Levels 61–70");
    expect(html.match(/<section class="profession-progress__band/g)).toHaveLength(7);

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "sacred-domain", threshold: 10 });
    expect(root.options.map((option) => option.name)).toEqual([
      "Life Domain", "Light Domain", "War Domain", "Grave Domain",
      "Knowledge Domain", "Tempest Domain", "Nature Domain", "Trickery Domain",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(8);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(16);
    for (const definition of definitions) {
      expect(html, definition.id).toContain(`data-choice-id="${definition.id}"`);
      expect(html, definition.id).toContain(`Profession level ${definition.threshold}`);
      if (definition.threshold > 10) {
        expect(definition.parentChoiceId, `${definition.id} is not nested`).toBeTruthy();
        expect(html, definition.id).toContain(`data-parent-choice="${definition.parentChoiceId}"`);
      }
    }

    expect(html).not.toContain("Power tier");
    expect(html).not.toContain("Character tier");
    expect(html).not.toMatch(/(?:Standard|Veteran|Epic|Legendary|Mythical|Divine)\s*·\s*Level/);
    expect(html).not.toContain("Subclass");
    expect(html).not.toMatch(/>Class</);
  });

  it("renders Warrior as a complete native martial profession with no Fighter-facing label", () => {
    const compiled = compileProfessionTrack("fighter");
    const definitions = professionBranchChoices("fighter");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.fighter} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(html).toContain(">Warrior</h2>");
    expect(html).not.toContain(">Fighter</h2>");
    expect(PROFESSIONS.fighter.specializations.map((entry) => entry.name)).toEqual([
      "Sellsword", "Duelist", "Iron Vanguard", "Undying Champion",
    ]);
    expect(html).toContain("Warrior&#x27;s Measure");
    expect(compiled.levels[69].feature).toBe("Perfect Technique");
    expect(html).toContain("Sellsword Method");
    expect(html).toContain("Counterfencer");
    expect(html).toContain("Deathless Victor");
    expect(html.match(/<section class="profession-progress__band/g)).toHaveLength(7);

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "warrior-specialization", threshold: 10 });
    expect(root.options.map((option) => option.name)).toEqual([
      "Sellsword", "Duelist", "Iron Vanguard", "Undying Champion",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html).not.toMatch(/Arcane|Divine|Pact Source|Primal Circle/);
  });

  it("renders Monk as a complete physical Posture profession with one bounded weapon discipline", () => {
    const compiled = compileProfessionTrack("monk");
    const definitions = professionBranchChoices("monk");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.monk} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels[69].feature).toBe("Perfect Impact");
    expect(PROFESSIONS.monk.specializations.map((entry) => entry.name)).toEqual([
      "Open Hand", "Iron Body", "Wind Step", "Temple Arms",
    ]);
    expect(html).toContain(">Monk</h2>");
    expect(html).toContain("Measured Palm");
    expect(html).toContain("Posture Strain");
    expect(html).toContain("Open Hand Method");
    expect(html).toContain("Conditioned Frame");
    expect(html).toContain("Physical Aerialist");
    expect(html).toContain("Temple Blade Kata");
    expect(html).not.toContain("Way of Shadow");
    expect(html).not.toContain("Diamond Soul");
    expect(html).not.toContain("Empty Body");

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "monk-discipline", threshold: 10 });
    expect(root.options.map((option) => option.id)).toEqual([
      "open-hand", "iron-body", "wind-step", "temple-arms",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(root.options.filter((option) => option.grants.some((grant) => grant.weaponPermitted)).map((option) => option.id))
      .toEqual(["temple-arms"]);
    expect(html).not.toMatch(/Arcane School|Sacred Domain|Pact Source|Primal Circle/);
  });

  it("renders Barbarian as a complete self-side Fury profession with four physical paths", () => {
    const compiled = compileProfessionTrack("barbarian");
    const definitions = professionBranchChoices("barbarian");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.barbarian} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels[0].feature).toBe("Brutal Swing");
    expect(compiled.levels[69].feature).toBe("World-Shaking Blow");
    expect(PROFESSIONS.barbarian.specializations.map((entry) => entry.name)).toEqual([
      "Reaver", "Berserker", "Juggernaut", "Clan Champion",
    ]);
    expect(html).toContain(">Barbarian</h2>");
    expect(html).toContain("Fury");
    expect(html).toContain("Bait the Blow");
    expect(html).toContain("Reaver Method");
    expect(html).toContain("Blood Trail");
    expect(html).toContain("Pain Eater");
    expect(html).toContain("Living Ram");
    expect(html).toContain("Foe Caller");
    expect(html).toContain("War Cry");
    expect(html).not.toContain("Totem Warrior");
    expect(html).not.toContain("Storm Rager");
    expect(html).not.toContain("Primal Apotheosis");

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "barbarian-fury-path", threshold: 10 });
    expect(root.options.map((option) => option.id)).toEqual([
      "reaver", "berserker", "juggernaut", "clan-champion",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html).not.toMatch(/Arcane School|Sacred Domain|Pact Source|Primal Circle|Warrior Tempo|Posture Strain/);
  });

  it("surfaces a character's racial evolution as a separate 30-level track", () => {
    const character = {
      race: "vampire",
      progression: {
        version: 2,
        professions: [],
        racial: { raceId: "vampire", evolutionId: "lesser-vampire", paths: { "vampire-awakening": 8 } },
      },
    };
    const html = renderToStaticMarkup(<ProfessionCatalog character={character} />);

    expect(html).toContain("Separate racial track");
    expect(html).toContain("Vampire evolution");
    expect(html).toContain("8 / 30 levels");
    expect(html).toContain("Racial evolutions");
    expect(html).toContain("15 ancestries");
    expect(html).toContain("Human");
    expect(html).toContain("Drake-Blooded");
    expect(html).toContain("30 authored levels");

    for (const profile of Object.values(RACIAL_PROFILES)) {
      expect(html, `${profile.name} is missing from the racial directory`).toContain(`<strong>${profile.name}</strong>`);
    }
    expect(html.match(/<b aria-hidden="true">→<\/b>/g)).toHaveLength(Object.keys(RACIAL_PROFILES).length);
  });

  it("makes every catalogued ancestry browseable with its complete authored track and nested branches", () => {
    for (const [raceId, profile] of Object.entries(RACIAL_PROFILES)) {
      const compiled = compileRacialTrack(raceId);
      const definitions = racialBranchChoices(raceId);
      const html = renderToStaticMarkup(
        <RacialProgression character={null} raceId={raceId} onBack={() => {}} />,
      );

      expect(compiled.levels, raceId).toHaveLength(30);
      expect(compiled.levels.map((row) => row.level), raceId).toEqual(
        Array.from({ length: 30 }, (_, index) => index + 1),
      );
      expect(html, raceId).toContain(`<h2>${profile.name}</h2>`);
      expect(html, raceId).toContain("Levels 1–10");
      expect(html, raceId).toContain("Levels 11–20");
      expect(html, raceId).toContain("Levels 21–30");
      expect(html.match(/<section class="profession-progress__band/g), raceId).toHaveLength(3);
      expect(html, raceId).toContain("Racial level 10");
      expect(html, raceId).toContain("Racial level 20");

      const root = definitions.find((definition) => !definition.parentChoiceId);
      expect(root, `${raceId} is missing its level-10 root branch`).toBeTruthy();
      for (const definition of definitions) {
        expect(html, `${raceId}/${definition.id} is missing from the detail view`).toContain(`data-choice-id="${definition.id}"`);
        if (definition.parentChoiceId) {
          expect(html, `${raceId}/${definition.id} lost its nested branch relationship`).toContain(
            `data-parent-choice="${definition.parentChoiceId}"`,
          );
        }
      }

      expect(html, raceId).toContain('aria-label="Racial level 30 attributes"');
      expect(html, raceId).toContain("Racial track projection");
      expect(html, raceId).toContain("Level 30 attributes");
      expect(html, raceId).toContain("Before profession levels");
      expect(html, raceId).toContain("← Progression catalog");
      expect(html, raceId).not.toContain("← All professions");
      expect(html, raceId).not.toContain("Power tier");
      expect(html, raceId).not.toMatch(/>(?:Epic|Legendary|Mythical|Divine)</);
    }
  });

  it("shows every authored racial level, metamorphosis, and nested racial branch in the Codex detail", () => {
    const compiled = compileRacialTrack("vampire");
    const paths = {};
    for (const row of compiled.levels.slice(0, 20)) paths[row.pathId] = row.rank;
    const character = {
      race: "vampire",
      progression: {
        version: 2,
        professions: [],
        racial: { raceId: "vampire", evolutionId: "lesser-vampire", paths, branchChoices: {} },
      },
    };
    const html = renderToStaticMarkup(<RacialProgression character={character} onBack={() => {}} />);

    expect(html).toContain("Racial evolution · 0–30");
    expect(html).toContain("Levels 1–30");
    expect(html).toContain("Lesser Vampire");
    expect(html).toContain("True Vampire");
    expect(html).toContain("Evolution overlays");
    expect(html).toContain("Racial level 10");
    expect(html).toContain("Blood Sovereign");
    expect(html).toContain("Night Stalker");
    expect(html).toContain("Corpse Lord");
    expect(html).toContain("Racial level 20");
    expect(html).toContain("Choice required");
    expect(html).toContain('aria-label="Racial level 30 attributes"');
    expect(html).toContain("Before profession levels");
    expect(html).toContain("← Progression catalog");
    expect(html).not.toContain("← All professions");
  });
});
