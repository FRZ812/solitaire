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
import { ProfessionCatalog, ProfessionProgression, RacialProgression, RaceTreePage } from "./ProfessionProgression.jsx";

describe("profession and race node trees", () => {
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
    expect(html).toContain("Choose a profession tree");
    expect(html).toContain("Profession constellation");
    expect(html).not.toContain("100 levels");
    expect(html).not.toContain("Racial or utility branch");
  });

  it("keeps general profession rewards separate from specialization overlays and nested thresholds", () => {
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.wizard} currentLevel={0} onBack={() => {}} />,
    );

    expect(html).toContain("Profession tree · 0–70");
    expect(html).toContain("General core");
    expect(html).toContain("Specialization branches");
    expect(html).toContain("Specialized paths");
    expect(html).toContain("Explicit node choices");
    expect(html).toContain("Center-out node tree");
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
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);

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
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);

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

  it("renders Bard as a complete non-spell Cadence profession with four native performance paths", () => {
    const compiled = compileProfessionTrack("bard");
    const definitions = professionBranchChoices("bard");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.bard} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels[0].feature).toBe("Clarion Note");
    expect(compiled.levels[69].feature).toBe("Grand Finale");
    expect(PROFESSIONS.bard.specializations.map((entry) => entry.name)).toEqual([
      "War Singer", "Satirist", "Resonant Virtuoso", "Lorekeeper",
    ]);
    expect(html).toContain(">Bard</h2>");
    expect(html).toContain("Cadence");
    expect(html).toContain("Clarion Note");
    expect(html).toContain("War Singer Method");
    expect(html).toContain("Drumline");
    expect(html).toContain("Chorus of Scorn");
    expect(html).toContain("Harmonic Weaver");
    expect(html).toContain("Battle Chronicler");
    expect(html).not.toContain("Bardic College");
    expect(html).not.toContain("College of Lore");
    expect(html).not.toContain("College of Valour");
    expect(html).not.toContain("Spell Virtuoso");
    expect(html).not.toContain("Battle Hymn");
    expect(html).not.toContain("Charm");

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "bard-performance-path", threshold: 10 });
    expect(root.options.map((option) => option.id)).toEqual([
      "war-singer", "satirist", "resonant-virtuoso", "lorekeeper",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html).not.toMatch(/Arcane School|Sacred Domain|Pact Source|Primal Circle|magical damage|true damage/);
  });

  it("renders Ranger as a complete non-spell Quarry profession with fieldcraft utility on all 70 levels", () => {
    const compiled = compileProfessionTrack("ranger");
    const definitions = professionBranchChoices("ranger");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.ranger} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(compiled.levels[0].feature).toBe("Quarry Sign");
    expect(compiled.levels[69].feature).toBe("Perfect Hunt");
    expect(PROFESSIONS.ranger.specializations.map((entry) => entry.name)).toEqual([
      "Hunter", "Trailblazer", "Beast Warden", "Trapper",
    ]);
    expect(html).toContain(">Ranger</h2>");
    expect(html).toContain("Quarry Insight");
    expect(html).toContain("Quarry Sign");
    expect(html).toContain("Ranger Field Practice");
    expect(html).toContain("Monster Stalker");
    expect(html).toContain("Deadeye");
    expect(html).toContain("Pathfinder");
    expect(html).toContain("Skirmisher");
    expect(html).toContain("Packmaster");
    expect(html).toContain("Falconer");
    expect(html).toContain("Snarewright");
    expect(html).toContain("Ambusher");
    expect(html).toContain("High-Circle Spotter");
    expect(html).toContain("Humane Captor");
    expect(html).toContain("already-present trained mundane animal");
    expect(html).toContain("never summons");
    expect(html).not.toContain("Ranger Conclave");
    expect(html).not.toContain("Horizon Walker");
    expect(html).not.toContain("Gloom Stalker");
    expect(html).not.toContain("Primal Companion");

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "ranger-field-practice", threshold: 10 });
    expect(root.options.map((option) => option.id)).toEqual([
      "hunter", "trailblazer", "beast-warden", "trapper",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);
    expect(html).not.toMatch(/Arcane School|Sacred Domain|Pact Source|Primal Circle|Warrior Tempo|Posture Strain|Barbarian Fury/);
  });

  it("renders Rogue as a complete mundane Opportunity Window profession with noncombat utility on all 70 levels", () => {
    const compiled = compileProfessionTrack("rogue");
    const definitions = professionBranchChoices("rogue");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.rogue} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(compiled.levels[0].feature).toBe("Assess Mark");
    expect(compiled.levels[69].feature).toBe("Perfect Opportunity");
    expect(PROFESSIONS.rogue.specializations.map((entry) => entry.name)).toEqual([
      "Infiltrator", "Scoundrel", "Assassin", "Saboteur",
    ]);
    expect(html).toContain(">Rogue</h2>");
    expect(html).toContain("Opportunity Window");
    expect(html).toContain("Assess Mark");
    expect(html).toContain("Rogue Practice");
    expect(html).toContain("Cat Burglar");
    expect(html).toContain("Crowd Ghost");
    expect(html).toContain("Confidence Artist");
    expect(html).toContain("Dirty Fighter");
    expect(html).toContain("Ambusher");
    expect(html).toContain("Poisoner");
    expect(html).toContain("Locksmith");
    expect(html).toContain("Wrecker");
    expect(html).toContain("Roofline Surveyor");
    expect(html).toContain("Antidote Keeper");
    expect(html).toContain("Selective Collapse");
    expect(html).not.toContain("Roguish Practice");
    expect(html).not.toContain("Underworld Mastery");
    expect(html).not.toMatch(/Shadowblade|Arcane Trickster|Soulknife|Phantom/);

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "rogue-practice", threshold: 10 });
    expect(root.options.map((option) => option.id)).toEqual([
      "infiltrator", "scoundrel", "assassin", "saboteur",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);
    expect(html).not.toMatch(/Arcane School|Sacred Domain|Pact Source|Primal Circle|Warrior Tempo|Posture Strain|Barbarian Fury|Quarry Insight/);
  });

  it("renders Paladin as a complete non-spell Conviction protector with oathbound utility on all 70 levels", () => {
    const compiled = compileProfessionTrack("paladin");
    const definitions = professionBranchChoices("paladin");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.paladin} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(compiled.levels[0].feature).toBe("Oathguard");
    expect(compiled.levels[69].feature).toBe("Oath Incarnate");
    expect(PROFESSIONS.paladin.specializations.map((entry) => entry.name)).toEqual([
      "Shield Oath", "Truth Oath", "Mercy Oath", "Beacon Oath",
    ]);
    expect(html).toContain(">Paladin</h2>");
    expect(html).toContain("Conviction");
    expect(html).toContain("Oathguard");
    expect(html).toContain("Paladin Oath");
    expect(html).toContain("Shieldbearer");
    expect(html).toContain("Gatekeeper");
    expect(html).toContain("Inquisitor");
    expect(html).toContain("Magistrate");
    expect(html).toContain("Redeemer");
    expect(html).toContain("Martyr");
    expect(html).toContain("Dawnblade");
    expect(html).toContain("Roadwarden");
    expect(html).toContain("Living Rampart");
    expect(html).toContain("Falsehood Scourge");
    expect(html).toContain("Chainbreaker");
    expect(html).toContain("Horizon Guardian");
    expect(html).not.toMatch(/Sacred Oath|Devotion|Vengeance|Consecrated Office|Holy Shield|Divine Avenger/);

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "paladin-oath", threshold: 10 });
    expect(root.options.map((option) => option.id)).toEqual([
      "shield-oath", "truth-oath", "mercy-oath", "beacon-oath",
    ]);
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);
    expect(html).not.toMatch(/Arcane School|Sacred Domain|Pact Source|Primal Circle|Warrior Tempo|Posture Strain|Barbarian Fury|Cadence|Quarry Insight|Opportunity Window/);
  });

  it("renders Innkeeper as a complete non-combat hospitality profession with layered house callings", () => {
    const compiled = compileProfessionTrack("innkeeper");
    const definitions = professionBranchChoices("innkeeper");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.innkeeper} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(compiled.levels.flatMap((row) => row.grants).some((grant) => grant.type === "ability")).toBe(false);
    expect(PROFESSIONS.innkeeper.specializations.map((entry) => entry.name)).toEqual([
      "Hearthkeeper", "Publican", "Provisioner", "Wayhouse Broker",
    ]);
    expect(html).toContain(">Innkeeper</h2>");
    expect(html).toContain("Open the House");
    expect(html).toContain("House Calling");
    expect(html).toContain("Sanctuary Warden");
    expect(html).toContain("Taproom Host");
    expect(html).toContain("Cellar Master");
    expect(html).toContain("Rumour Broker");
    expect(html).toContain("Refuge Network Steward");
    expect(html).toContain("Crowd Steward");
    expect(html).toContain("Community Kitchen Keeper");
    expect(html).toContain("Network Innkeeper");
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "innkeeper-calling", threshold: 10 });
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html).not.toMatch(/Spell|Cadence|Quarry Insight|Opportunity Window|Device Charges|Pact Favor|Conviction/);
  });

  it("renders Farmer as a complete non-combat husbandry profession with four material practices", () => {
    const compiled = compileProfessionTrack("farmer");
    const definitions = professionBranchChoices("farmer");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.farmer} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(compiled.levels.flatMap((row) => row.grants).some((grant) => grant.type === "ability")).toBe(false);
    expect(PROFESSIONS.farmer.specializations.map((entry) => entry.name)).toEqual([
      "Field Cultivator", "Herd Keeper", "Orchard Keeper", "Land Reclaimer",
    ]);
    expect(html).toContain(">Farmer</h2>");
    expect(html).toContain("Farm Year");
    expect(html).toContain("Agricultural Practice");
    expect(html).toContain("Seed Steward");
    expect(html).toContain("Pasture Warden");
    expect(html).toContain("Graftmaster");
    expect(html).toContain("Reclamation Farmer");
    expect(html).toContain("Landrace Keeper");
    expect(html).toContain("Welfare Breeder");
    expect(html).toContain("Orchard Ecologist");
    expect(html).toContain("Post-Disaster Cultivator");
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "farmer-practice", threshold: 10 });
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html).not.toMatch(/Arcane School|Cadence|Quarry Insight|Opportunity Window|Device Charges|Pact Favor|Conviction/);
  });

  it("renders Merchant as a complete non-combat trade profession with four accountable practices", () => {
    const compiled = compileProfessionTrack("merchant");
    const definitions = professionBranchChoices("merchant");
    const html = renderToStaticMarkup(
      <ProfessionProgression profession={PROFESSIONS.merchant} currentLevel={0} onBack={() => {}} />,
    );

    expect(compiled.levels).toHaveLength(70);
    expect(new Set(compiled.levels.map((row) => row.feature)).size).toBe(70);
    expect(compiled.levels.every((row) => row.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(compiled.levels.flatMap((row) => row.grants).some((grant) => grant.type === "ability")).toBe(false);
    expect(PROFESSIONS.merchant.specializations.map((entry) => entry.name)).toEqual([
      "Peddler", "Caravan Factor", "Guild Broker", "Credit Steward",
    ]);
    expect(html).toContain(">Merchant</h2>");
    expect(html).toContain("Honest Trade");
    expect(html).toContain("Commercial Practice");
    expect(html).toContain("Stallholder");
    expect(html).toContain("Cargo Steward");
    expect(html).toContain("Contract Broker");
    expect(html).toContain("Risk Underwriter");
    expect(html).toContain("Market Hall Steward");
    expect(html).toContain("Provenance Factor");
    expect(html).toContain("Public Procurement Steward");
    expect(html).toContain("Catastrophe Underwriter");
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(70);

    const root = definitions.find((definition) => !definition.parentChoiceId);
    expect(root).toMatchObject({ id: "merchant-practice", threshold: 10 });
    expect(definitions.filter((definition) => definition.threshold === 30)).toHaveLength(4);
    expect(definitions.filter((definition) => definition.threshold === 50)).toHaveLength(8);
    expect(html).not.toMatch(/Arcane School|Cadence|Quarry Insight|Opportunity Window|Device Charges|Pact Favor|Conviction/);
  });

  it("surfaces the character's lineage as a dedicated 30-node Race panel", () => {
    const character = {
      race: "vampire",
      progression: {
        version: 2,
        professions: [],
        racial: { raceId: "vampire", evolutionId: "lesser-vampire", paths: { "vampire-awakening": 8 } },
      },
    };
    const html = renderToStaticMarkup(<RaceTreePage state={{ character }} />);

    expect(html).toContain("<h3>Race</h3>");
    expect(html).toContain("Race tree · 0–30");
    expect(html).toContain("<h2>Vampire</h2>");
    expect(html).toContain("8 allocated · 0 available");
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(30);
    expect(html).toContain("Scrollable Vampire lineage tree");
    expect(html).not.toContain("Choose a profession tree");
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
      expect(html, raceId).toContain("Levels 1–30");
      expect(html.match(/class="progression-tree__node/g), raceId).toHaveLength(30);
      expect(html, raceId).toContain("Center-out node tree");
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
      expect(html, raceId).toContain("← Race tree");
      expect(html, raceId).not.toContain("← All professions");
      expect(html, raceId).not.toContain("Power tier");
      expect(html, raceId).not.toMatch(/>(?:Epic|Legendary|Mythical|Divine)</);
    }
  });

  it("shows every authored racial level, metamorphosis, and nested branch in the dedicated tree", () => {
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

    expect(html).toContain("Race tree · 0–30");
    expect(html).toContain("Levels 1–30");
    expect(html).toContain("Lesser Vampire");
    expect(html).toContain("True Vampire");
    expect(html).toContain("Evolution branches");
    expect(html).toContain("Racial level 10");
    expect(html).toContain("Blood Sovereign");
    expect(html).toContain("Night Stalker");
    expect(html).toContain("Corpse Lord");
    expect(html).toContain("Racial level 20");
    expect(html).toContain("Choice required");
    expect(html).toContain('aria-label="Racial level 30 attributes"');
    expect(html).toContain("Before profession levels");
    expect(html).toContain("← Race tree");
    expect(html).not.toContain("← All professions");
  });
});
