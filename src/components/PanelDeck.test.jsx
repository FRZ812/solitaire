import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { PanelDeck, shouldDismissPanel } from "./PanelDeck.jsx";

describe("PanelDeck", () => {
  it("renders abilities and Codex as peer deck pages with handle-only sheet chrome", () => {
    const html = renderToStaticMarkup(
      <PanelDeck
        state={makeInitialState()}
        user={null}
        initialPage="abilities"
        onClose={() => {}}
        handlers={{}}
      />,
    );

    expect(html).toContain("Abilities &amp; Spells");
    expect(html).toContain("Drag down or tap to close menu");
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    expect(html).toContain("Codex");
    expect(html).not.toContain("Wanderer dossier");
    expect(html).not.toContain("Close character menu");
    expect(html).toContain("choose a section · drag handle to close");
    expect(html).not.toContain("swipe sections");
  });

  it("renders the living Codex inside the dossier instead of as a character action", () => {
    const state = makeInitialState();
    const codexHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="codex" onClose={() => {}} handlers={{}} />,
    );
    const characterHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="character" onClose={() => {}} handlers={{}} />,
    );

    expect(codexHtml).toContain("Lore Codex");
    expect(codexHtml).toContain("People, lore, and hard-won knowledge gathered on the road.");
    expect(codexHtml).toContain("codex-entry__portrait");
    expect(codexHtml).toContain("portrait placeholder");
    expect(codexHtml).toContain('data-portrait-atlas="important"');
    expect(codexHtml).toContain('data-icon-key="codex:characters"');
    expect(codexHtml).toContain("codex-tab-icon-slot");
    expect(codexHtml).toContain('aria-label="Search Codex characters"');
    expect(characterHtml).not.toContain("Open Codex");
    expect(characterHtml).toContain("character-status-overview");
    expect(characterHtml).toContain("Ready for the road");
    expect(characterHtml).toContain('data-game-icon="hunger"');
    expect(characterHtml).not.toContain("drumstick");
    expect(characterHtml).toContain("Upload portrait");
    expect(characterHtml).toContain("image/png,image/jpeg,image/webp");
  });

  it("resolves authored and uploaded player portraits with reset controls", () => {
    const authored = makeInitialState();
    authored.character.templateId = "ranger";
    authored.character.portraitKey = "template:ranger";
    authored.character.profession = "ranger";
    Object.assign(authored.world.codex.characters.wanderer, {
      templateId: "ranger",
      portraitKey: "template:ranger",
      profession: "ranger",
    });
    const authoredHtml = renderToStaticMarkup(
      <PanelDeck state={authored} user={null} initialPage="character" onClose={() => {}} handlers={{ onPortraitChange: () => {} }} />,
    );
    expect(authoredHtml).toContain("ranger-anime-v2.webp");
    expect(authoredHtml).toContain("Upload portrait");
    expect(authoredHtml).toContain("data-atlas-cell=\"ranger\"");

    const custom = structuredClone(authored);
    custom.portraitOverrides.wanderer = "data:image/webp;base64,AAAA";
    const customHtml = renderToStaticMarkup(
      <PanelDeck state={custom} user={null} initialPage="character" onClose={() => {}} handlers={{ onPortraitChange: () => {} }} />,
    );
    expect(customHtml).toContain("data:image/webp;base64,AAAA");
    expect(customHtml).toContain("Change portrait");
    expect(customHtml).toContain("Use original");
  });

  it("surfaces a character's parent class and specific subclass in the dossier and Codex", () => {
    const state = makeInitialState();
    Object.assign(state.character, {
      templateId: "shadowblade",
      portraitKey: "template:shadowblade",
      profession: "assassin",
      subclass: "shadowblade",
    });
    Object.assign(state.world.codex.characters.wanderer, {
      templateId: "shadowblade",
      portraitKey: "template:shadowblade",
      profession: "assassin",
      subclass: "shadowblade",
    });

    const characterHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="character" onClose={() => {}} handlers={{}} />,
    );
    const codexHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="codex" onClose={() => {}} handlers={{}} />,
    );

    expect(characterHtml).toContain("Assassin");
    expect(characterHtml).toContain("Class</em>Assassin");
    expect(characterHtml).toContain("Subclass</em>Shadowblade");
    expect(codexHtml).toContain("Assassin class · Shadowblade subclass");
    expect(codexHtml).toContain("Subclass · Shadowblade");
  });

  it("resolves a persistent NPC portrait override throughout the Codex", () => {
    const state = makeInitialState();
    state.portraitOverrides["demon-king"] = "data:image/webp;base64,TkPC";
    const html = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="codex" onClose={() => {}} handlers={{ onPortraitChange: () => {} }} />,
    );
    expect(html).toContain("data:image/webp;base64,TkPC");
    expect(html).toContain("The Demon King portrait");
  });

  it("snaps short pulls back and dismisses long or deliberate flicks", () => {
    expect(shouldDismissPanel(12, 2)).toBe(false);
    expect(shouldDismissPanel(60, 0.2)).toBe(false);
    expect(shouldDismissPanel(60, 0.7)).toBe(true);
    expect(shouldDismissPanel(96, 0.1)).toBe(true);
  });
});
