import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFESSIONS } from "../data/professions.js";
import { ProfessionGlossary } from "./CodexView.jsx";

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
    expect(html).toContain("Path choices");
    expect(html).toContain("Specializations");
    expect(html).not.toContain(">Fighter</h4>");
  });

  it("defers level and branch rows until their disclosures are opened", () => {
    const html = renderToStaticMarkup(<ProfessionGlossary initialProfessionId="wizard" />);

    expect(html.match(/profession-glossary__disclosure profession-glossary__stage/g)).toHaveLength(7);
    expect(html).not.toContain("profession-glossary__level");
    expect(html).not.toContain("profession-glossary__choice-groups");
    expect(html).not.toContain("profession-glossary__specializations\"><div>");
  });

  it("keeps generic profession tracks readable without exposing content status internals", () => {
    const html = renderToStaticMarkup(
      <ProfessionGlossary
        initialProfessionId="artisan"
        initialOpenStageId="artisan-foundation"
        initialOpenChoices
      />,
    );

    expect(html).toContain(">Artisan</h4>");
    expect(html).toContain("Artisan Foundation");
    expect(html).toContain(">Craft</strong>");
    expect(html).toContain("Craft Discipline");
    expect(html).toContain("Fine Crafter");
    expect(html).not.toContain("content-incomplete");
  });
});
