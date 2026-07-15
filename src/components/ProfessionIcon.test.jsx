import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFESSION_ATLAS_CELLS, ProfessionIcon, professionAtlasPosition, professionIconKey } from "./ProfessionIcon.jsx";

describe("ProfessionIcon", () => {
  it("indexes all 23 authored class medallions into the 5x5 atlas", () => {
    expect(PROFESSION_ATLAS_CELLS).toHaveLength(23);
    expect(new Set(PROFESSION_ATLAS_CELLS).size).toBe(23);
    expect(professionAtlasPosition("sellsword")).toBe("0% 0%");
    expect(professionAtlasPosition("devout")).toBe("100% 0%");
    expect(professionAtlasPosition("enchanter-tyrant")).toBe("50% 100%");
  });

  it("prefers a character-specific cell and falls back by profession", () => {
    expect(professionIconKey({ templateId: "shadowblade", profession: "assassin" })).toBe("shadowblade");
    expect(professionIconKey({ profession: "assassin" })).toBe("cutthroat");
    const html = renderToStaticMarkup(<ProfessionIcon templateId="shadowblade" profession="assassin" />);
    expect(html).toContain("data-atlas-cell=\"shadowblade\"");
    expect(html).toContain("profession-atlas-anime-v2.webp");
  });
});
