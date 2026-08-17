import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFESSIONS } from "../data/professions.js";
import { ProfessionGlossary, abilityCatalogOwnership } from "./CodexView.jsx";

describe("ability catalog ownership", () => {
  const codex = {
    skills: {
      firebolt: { id: "firebolt", name: "Firebolt", combatAbility: true, tier: "epic" },
      haste: { id: "haste", name: "Haste", combatAbility: true, tier: "rare" },
    },
    spells: {
      firebolt: { id: "firebolt", name: "Firebolt" },
      haste: { id: "haste", name: "Haste" },
    },
  };

  it("leaves legacy characters' Known and Owned projection unchanged", () => {
    const projection = abilityCatalogOwnership({
      abilities: [{ id: "firebolt", tier: "legendary" }, "haste"],
    }, codex);

    expect([...projection.known]).toEqual(["firebolt", "haste"]);
    expect(projection.ownedTier).toEqual({ firebolt: "legendary", haste: "common" });
  });

  it("keeps the legacy catalog reference-only for Tower characters, including world Haste", () => {
    const projection = abilityCatalogOwnership({
      progressionModel: "tow-archetype",
      abilities: [
        { id: "firebolt", tier: "legendary" },
        { id: "haste", tier: "rare" },
      ],
    }, codex);

    expect([...projection.known]).toEqual([]);
    expect(projection.ownedTier).toEqual({});
  });
});

describe("ProfessionGlossary", () => {
  it("keeps every profession in a compact searchable index", () => {
    const html = renderToStaticMarkup(<ProfessionGlossary />);

    expect(html.match(/class="profession-glossary__card"/g)).toHaveLength(Object.keys(PROFESSIONS).length);
    expect(html).toContain('aria-label="Search professions"');
    expect(html).toContain('aria-label="View Warrior progression"');
    expect(html).toContain('aria-label="View Wizard progression"');
    expect(html).toContain("Every calling, one compact index");
    expect(html).not.toContain("Open a stage to inspect its levels");
  });

  it("reveals the complete Warrior progression through compact disclosures", () => {
    const html = renderToStaticMarkup(
      <ProfessionGlossary
        initialProfessionId="fighter"
        initialOpenStageId="fighter-foundation"
        initialOpenChoices
      />,
    );

    expect(html).toContain(">Warrior</h4>");
    expect(html).toContain(">Martial</small>");
    expect(html).toContain("A wholly nonmagical master of weapons");
    expect(html.match(/profession-glossary__disclosure profession-glossary__stage/g)).toHaveLength(7);
    expect(html).toContain("Levels 1–15");
    expect(html).toContain("Warrior Foundation");
    expect(html).toContain("Warrior&#x27;s Measure");
    expect(html).toContain("Learn the distance at which the held weapon can strike cleanly");
    expect(html).toContain("Warrior Specialization");
    expect(html).toContain("Iron Vanguard");
    expect(html).toContain("Specialization tree");
    expect(html).toContain("Sellsword Method");
    expect(html).toContain("Requires Sellsword");
    expect(html).toContain("Known archetypes");
    expect(html).not.toContain(">Fighter</h4>");
  });

  it("shows one exclusive Wizard school subtree with its prerequisite flow", () => {
    const html = renderToStaticMarkup(
      <ProfessionGlossary
        initialProfessionId="wizard"
        initialOpenChoices
        initialBranchOptionId="necromancy"
      />,
    );

    expect(html).toContain('data-branch-choice-id="wizard-school"');
    expect(html).toContain('data-branch-option-id="necromancy"');
    expect(html).toContain("Necromantic Discipline");
    expect(html).toContain("Requires Necromancy");
    expect(html).toContain("Undead Lord Mastery");
    expect(html).toContain("Requires Undead Lord");
    expect(html).toContain("Death Magic Mastery");
    expect(html).toContain("Requires Death Magic");
    expect(html).toContain("Choose 1");
    expect(html).not.toContain("Warder Mastery");
    expect(html).not.toContain("Nullifier Mastery");
    expect(html).not.toContain("Elementalist Mastery");
  });

  it("defers level and branch rows until their disclosures are opened", () => {
    const html = renderToStaticMarkup(<ProfessionGlossary initialProfessionId="wizard" />);

    expect(html.match(/profession-glossary__disclosure profession-glossary__stage/g)).toHaveLength(7);
    expect(html).not.toContain("profession-glossary__level");
    expect(html).not.toContain("profession-glossary__branch-map");
    expect(html).not.toContain("profession-glossary__specializations\"><div>");
  });

  it("keeps generic profession tracks readable without exposing content status internals", () => {
    const html = renderToStaticMarkup(
      <ProfessionGlossary
        initialProfessionId="artisan"
        initialOpenStageId="artisan-foundation"
        initialOpenChoices
        initialBranchOptionId="smith"
      />,
    );

    expect(html).toContain(">Artisan</h4>");
    expect(html).toContain("Artisan Foundation");
    expect(html).toContain(">Craft</strong>");
    expect(html).toContain("Craft Discipline");
    expect(html).toContain("Fine Crafter");
    expect(html).toContain("Requires Smith");
    expect(html).toContain("Masterwork Tradition");
    expect(html).not.toContain("content-incomplete");
  });
});
