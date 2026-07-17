import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampaignsList } from "./CampaignsList.jsx";
import { CreationHub } from "./CreationHub.jsx";
import { TitleScreen } from "./TitleScreen.jsx";

describe("front-of-game menu flow", () => {
  it("renders a deliberate authenticated title gate with account controls", () => {
    const html = renderToStaticMarkup(
      <TitleScreen
        email="wanderer@example.com"
        onStart={() => {}}
        onSignOut={() => {}}
      />,
    );

    expect(html).toContain("Your choices become history");
    expect(html).toContain("Open your campaigns");
    expect(html).toContain("Campaign ledger");
    expect(html).toContain("wanderer@example.com");
    expect(html).toContain("Sign out");
    expect(html).toContain("logo-solitaire-compass-v1.png");
  });

  it("renders campaigns as a library with title and sign-out navigation", () => {
    const html = renderToStaticMarkup(
      <CampaignsList
        campaigns={[{ id: "road-1", name: "The White Road", last_played_at: new Date().toISOString() }]}
        email="wanderer@example.com"
        onSelect={() => {}}
        onNew={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
        onBack={() => {}}
        onSignOut={() => {}}
        busy={false}
      />,
    );

    expect(html).toContain("Choose your journey");
    expect(html).toContain("Begin a new journey");
    expect(html).toContain("The White Road");
    expect(html).toContain("Continue from your last passage");
    expect(html).toContain("Cloud saved");
    expect(html).toContain("Campaign library");
    expect(html).toContain("Sign out");
  });

  it("renders the complete portrait-led roster with power, role, and search controls", () => {
    const html = renderToStaticMarkup(
      <CreationHub onPickTemplate={() => {}} onCustom={() => {}} onQuit={() => {}} busy={false} />,
    );

    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html.match(/class="creation-card"/g)).toHaveLength(27);
    expect(html).toContain("Choose your power fantasy");
    expect(html).toContain("Sets tone &amp; challenge");
    expect(html).toContain("All: 27 lives");
    expect(html).toContain("Standard: Grounded");
    expect(html.indexOf("Choose your power fantasy")).toBeLessThan(html.indexOf("Name your traveller"));
    expect(html).toContain("Bram Coltaine");
    expect(html).toContain("Faelar Sylvareth");
    expect(html).toContain("Ysolde Varen");
    expect(html).toContain("Nadira Sahir");
    expect(html).toContain("Lethira Vael");
    expect(html).toContain("Tomas Vell");
    expect(html).toContain("Amahara Sayo");
    expect(html).toContain("Korvane Ashfell");
    expect(html).toContain("Search name, profession, archetype, kindred…");
    expect(html).toContain("All roles");
    expect(html).toContain("data-atlas-cell=\"sellsword\"");
    expect(html).toContain("data-atlas-cell=\"cutthroat\"");
    expect(html).toContain("data-atlas-cell=\"shadowblade\"");
    expect(html).toContain("creation-card__profession-badge");
    expect(html).toContain("aria-label=\"Archetype: Cutthroat\"");
    expect(html).toContain("aria-label=\"Archetype: Shadowblade\"");
    expect(html).toContain("Standard · Level 10");
    expect(html).toContain("Divine · Level 100");
    expect(html).toContain("sellsword-grounded-v3.webp");
    expect(html).toContain("Create a custom traveller");
    expect(html).toContain("character-roster-threshold-v1.webp");
  });
});
