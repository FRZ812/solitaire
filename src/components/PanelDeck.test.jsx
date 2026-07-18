import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { PanelDeck, shouldDismissPanel } from "./PanelDeck.jsx";
import { CodexEntry } from "./CodexView.jsx";
import { createProgression } from "../engine/progression.js";
import { progressionXpForLevel } from "../data/progression-paths.js";

describe("PanelDeck", () => {
  it("renders Profession, Race, Skills, and Codex as peer deck pages with handle-only sheet chrome", () => {
    const html = renderToStaticMarkup(
      <PanelDeck
        state={makeInitialState()}
        user={null}
        initialPage="abilities"
        onClose={() => {}}
        handlers={{}}
      />,
    );

    expect(html).toContain("<h3>Skills</h3>");
    expect(html).toContain("Drag down or tap to close menu");
    expect(html.match(/role="tab"/g)).toHaveLength(8);
    expect(html).toContain("Profession");
    expect(html).toContain("Race");
    expect(html).toContain("Codex");
    expect(html).toContain("Settings");
    expect(html).not.toContain("Wanderer dossier");
    expect(html).not.toContain("Close character menu");
    expect(html).toContain("choose a section · drag handle to close");
    expect(html).not.toContain("swipe sections");
  });

  it("uses the same page shell and heading contract for every dossier section", () => {
    const headings = {
      party: "Company",
      character: "Character",
      abilities: "Skills",
      inventory: "Inventory",
      profession: "Profession",
      race: "Race",
      codex: "Codex",
      settings: "Settings",
    };

    for (const [initialPage, heading] of Object.entries(headings)) {
      const html = renderToStaticMarkup(
        <PanelDeck state={makeInitialState()} user={null} initialPage={initialPage} onClose={() => {}} handlers={{}} />,
      );
      expect(html.match(/class="deck-page__header"/g)).toHaveLength(1);
      expect(html).toContain(`<h3>${heading}</h3>`);
      expect(html).toContain("deck-page deck-view");
    }
  });

  it("provides a dedicated campaign settings page for narration and memory management", () => {
    const state = makeInitialState();
    state.memories = ["The north gate captain expects the wanderer before dawn."];
    state.narratorSettings = { memoryMode: "essential", instructions: "Let companions disagree openly." };
    const html = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="settings" onClose={() => {}} handlers={{}} />,
    );

    expect(html).toContain("Narrator · memory · campaign");
    expect(html).toContain("Direct the storyteller");
    expect(html).toContain("Let companions disagree openly.");
    expect(html).toContain("Memory");
    expect(html).toContain("General");
  });

  it("keeps proficiencies in Skills and redundant weapon detail out of Character", () => {
    const state = makeInitialState();
    state.character.proficiencies = { "mastery-sword": 40 };
    const characterHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="character" onClose={() => {}} handlers={{}} />,
    );
    const skillsHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="abilities" onClose={() => {}} handlers={{}} />,
    );

    expect(characterHtml).not.toContain("Proficiencies");
    expect(characterHtml).not.toContain("Readied weapon");
    expect(skillsHtml).toContain("Proficiencies");
  });

  it("renders the living Codex inside the dossier instead of as a character action", () => {
    const state = makeInitialState();
    const codexHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="codex" onClose={() => {}} handlers={{ onTrackCharacter: () => {} }} />,
    );
    const characterHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="character" onClose={() => {}} handlers={{}} />,
    );

    expect(codexHtml).toContain("<h3>Codex</h3>");
    expect(codexHtml).toContain("known characters · people · places · lore");
    expect(codexHtml).toContain("codex-entry__portrait");
    expect(codexHtml).toContain("portrait placeholder");
    expect(codexHtml).toContain('data-portrait-atlas="important"');
    expect(codexHtml).toContain('data-icon-key="codex:characters"');
    expect(codexHtml).toContain("codex-tab-icon-slot");
    expect(codexHtml).toContain('aria-label="Search Codex characters"');
    expect(codexHtml).toContain(">Playable<");
    expect(codexHtml).toContain(">Track<");
    expect(characterHtml).not.toContain("Open Codex");
    expect(characterHtml).toContain("character-status-overview");
    expect(characterHtml).toContain("Ready for the road");
    expect(characterHtml).toContain('data-game-icon="hunger"');
    expect(characterHtml).not.toContain("drumstick");
    expect(characterHtml).toContain("Upload portrait");
    expect(characterHtml).toContain("image/png,image/jpeg,image/webp");
  });

  it("opens a Codex character as a full portrait dossier with polished detail sections", () => {
    const state = makeInitialState();
    const entry = state.world.codex.characters["demon-king"];
    const html = renderToStaticMarkup(
      <CodexEntry
        entry={entry}
        kind="characters"
        codex={state.world.codex}
        detailMode
        onBack={() => {}}
        onPortraitChange={() => {}}
      />,
    );

    expect(html).toContain("codex-entry--dossier is-open");
    expect(html).toContain("Back to roster");
    expect(html).toContain('data-portrait-source="detail"');
    expect(html).toContain("codex-individual/demon-king.webp");
    expect(html).toContain("Identity and progression");
    expect(html).toContain("Visible details");
    expect(html).toContain("Known story");
    expect(html).toContain("Upload portrait");
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
    expect(authoredHtml).toContain("ranger-grounded-v3.webp");
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

  it("surfaces race, highest specialization, and total level without redundant dossier labels", () => {
    const state = makeInitialState();
    Object.assign(state.character, {
      templateId: "shadowblade",
      portraitKey: "template:shadowblade",
      profession: "rogue",
      archetype: "shadowblade",
      progression: createProgression({ professionId: "rogue", archetypeId: "shadowblade", level: 45, sidePath: "utility" }),
    });
    Object.assign(state.world.codex.characters.wanderer, {
      templateId: "shadowblade",
      portraitKey: "template:shadowblade",
      profession: "rogue",
      archetype: "shadowblade",
      progression: createProgression({ professionId: "assassin", archetypeId: "shadowblade", level: 45, sidePath: "utility" }),
    });

    const characterHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="character" onClose={() => {}} handlers={{}} />,
    );
    const codexHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="codex" onClose={() => {}} handlers={{}} />,
    );

    expect(characterHtml).toContain('>Human</span><strong class="is-archetype">Shadowblade</strong>');
    expect(characterHtml).not.toContain("Profession</em>");
    expect(characterHtml).not.toContain("Specialization</em>");
    expect(characterHtml).not.toContain(">Player character</small>");
    expect(characterHtml).toContain("Level</em>45");
    expect(characterHtml).not.toContain("Professions</em>");
    expect(characterHtml).not.toContain(" / 30");
    expect(characterHtml).not.toContain(" / 70");
    expect(codexHtml).toContain("Level 45");
    expect(codexHtml).toContain(">Human</span>");
    expect(codexHtml).toContain(">Shadowblade</span>");
    expect(codexHtml).not.toContain("Specialization · Shadowblade");
    expect(codexHtml).not.toContain("Level 45 / 100");
    expect(codexHtml).not.toContain(">You</span>");
    expect(codexHtml).not.toContain("codex-entry__eyebrow");
  });

  it("surfaces earned points on both dedicated trees and makes the next connected node spendable", () => {
    const state = makeInitialState();
    state.character.profession = "fighter";
    state.character.progression = createProgression({ professionId: "fighter", raceId: "human", level: 9 });
    state.character.progression.xp = progressionXpForLevel(10);

    const professionHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="profession" onClose={() => {}} handlers={{ onChooseProgression: () => {} }} />,
    );
    const raceHtml = renderToStaticMarkup(
      <PanelDeck state={state} user={null} initialPage="race" onClose={() => {}} handlers={{ onChooseProgression: () => {} }} />,
    );

    expect(professionHtml).toContain("1 unspent point · 9 / 70 invested · unified skill tree");
    expect(professionHtml).toContain("All professions · one connected constellation");
    expect(professionHtml.match(/data-node-id=/g)).toHaveLength(2030);
    expect(professionHtml.match(/data-start="true"/g)).toHaveLength(29);
    expect(professionHtml).toContain('data-node-state="available"');
    expect(professionHtml).toContain("Spend 1 point ·");
    expect(raceHtml).toContain("1 unspent point · lineage · evolution");
    expect(raceHtml).toContain('aria-label="Level 1 — Mortal Beginning — available"');
    expect(raceHtml).toContain("Invest 1 point in Human lineage");
    expect(raceHtml.match(/class="progression-tree__node/g)).toHaveLength(30);
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
