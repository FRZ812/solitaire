import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFESSIONS } from "../data/professions.js";
import { createProgression } from "../engine/progression.js";
import { ProfessionCatalog, ProfessionProgression } from "./ProfessionProgression.jsx";

describe("Profession Codex", () => {
  it("lists the complete profession catalog including non-combat work", () => {
    const html = renderToStaticMarkup(<ProfessionCatalog character={null} />);

    expect(html).toContain("45 of 45 canonical professions");
    expect(html).toContain("Farmer");
    expect(html).toContain("Peddler");
    expect(html).toContain("Innkeeper");
    expect(html).toContain("Courtier");
    expect(html).toContain("Artisan");
    expect(html).toContain("Healer");
    expect(html).toContain("Scholar");
    expect(html).toContain("100 levels");
  });

  it("shows exact stacked caps, branches, attributes, and level rows", () => {
    const current = createProgression({ professionId: "farmer", level: 45, sidePath: "utility" });
    const html = renderToStaticMarkup(
      <ProfessionProgression
        profession={PROFESSIONS.farmer}
        defaultSidePath="utility"
        currentLevel={45}
        currentProfessionId="farmer"
        currentPaths={current.paths}
      />,
    );

    expect(html).toContain("No path reaches 100 alone");
    expect(html).toContain("Standard");
    expect(html).toContain("Advanced");
    expect(html).toContain("Specialized");
    expect(html).toContain("Racial or utility branch");
    expect(html).toContain("11 paths · 100 ranks");
    expect(html).toContain("Levels 1–100");
    expect(html).toContain("Levels 1–10");
    expect(html).toContain("Level 100 projection");
    expect(html).toContain("Your chosen utility branch");
    expect(html).toContain("is-attained");
  });

  it("renders a character's specialized archetype as a distinct route", () => {
    const html = renderToStaticMarkup(
      <ProfessionProgression
        profession={PROFESSIONS.assassin}
        currentLevel={65}
        currentProfessionId="assassin"
        currentArchetypeId="shadowblade"
      />,
    );

    expect(html).toContain("Shadowblade");
    expect(html).toContain("Shadowblade Synthesis");
    expect(html).toContain("Shadowblade redirects");
  });
});
