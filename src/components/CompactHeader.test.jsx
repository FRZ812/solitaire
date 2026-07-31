import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HANDCRAFTED } from "../data/handcrafted-map.js";
import { makeInitialState } from "../data/initial-state.js";
import { CompactHeader, compactLocation } from "./CompactHeader.jsx";

describe("CompactHeader", () => {
  it("renders world time as an accessible analog clock", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <CompactHeader state={state} onMap={() => {}} onOpenDeck={() => {}} />,
    );

    expect(html).toContain('class="compact-header__clock"');
    expect(html).toContain('aria-label="World time 13:30"');
    expect(html).toContain('--clock-angle:45deg');
    expect(html).toContain('--clock-angle:180deg');
    expect(html).toContain("compact-header__title-track");
  });

  it("keeps one character-deck opener and omits player identity from the HUD", () => {
    const state = makeInitialState();
    state.character.name = "A Name That Belongs In The Dossier";
    const html = renderToStaticMarkup(
      <CompactHeader state={state} onMap={() => {}} onOpenDeck={() => {}} />,
    );

    expect(html).not.toContain("compact-header__menu");
    expect(html).not.toContain("compact-header__actor");
    expect(html).not.toContain("A Name That Belongs In The Dossier");
    expect(html.match(/Character, company, skills, inventory, and codex/g)).toHaveLength(1);
  });

  it("keeps the local place in the title and moves its area hierarchy below it", () => {
    const html = renderToStaticMarkup(
      <CompactHeader state={makeInitialState()} onMap={() => {}} onOpenDeck={() => {}} />,
    );

    expect(html).toContain('compact-header__title-text">Grain Square</span>');
    expect(html).not.toContain("Whitemarch — The Grand Market");
    expect(html).toMatch(/compact-header__place[\s\S]*Settlement[\s\S]*The Grand Market[\s\S]*Whitemarch/);
  });

  it("shows the Citadel Ward below the Iron Palace and before Whitemarch", () => {
    const state = makeInitialState();
    const [coordinate] = Object.entries(HANDCRAFTED).find(([, tile]) => tile.poi?.part === "iron-palace");
    const [x, y] = coordinate.split(",").map(Number);
    state.world.currentTile = { x, y };
    const html = renderToStaticMarkup(
      <CompactHeader state={state} onMap={() => {}} onOpenDeck={() => {}} />,
    );

    expect(html).toContain('compact-header__title-text">The Iron Palace</span>');
    expect(html).not.toContain("Whitemarch — The Citadel Ward");
    expect(html).toMatch(/compact-header__place[\s\S]*Settlement[\s\S]*The Citadel Ward[\s\S]*Whitemarch/);
  });

  it("does not expose a hidden POI name at the current tile", () => {
    expect(compactLocation({
      terrain: "forest",
      poi: {
        type: "hidden",
        name: "The Glass Cairn",
        partName: "Inner Vault",
        districtName: "Secret Precinct",
      },
    })).toEqual({ district: null, title: "Forest" });
  });

  it("still presents discovered public places", () => {
    expect(compactLocation({
      terrain: "settlement",
      districtName: "Lantern Ward",
      poi: { type: "tavern", name: "The Copper Cup" },
    })).toMatchObject({ district: "Lantern Ward", title: "The Copper Cup" });
  });
});
