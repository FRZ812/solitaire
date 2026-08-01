import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { NARRATOR_INSTRUCTION_CORPUS as SYSTEM_PROMPT } from "../../narrator-instructions.js";
import { WorldOverview, worldOverviewMarkerClass } from "./WorldOverview.jsx";

describe("far-above world overview", () => {
  it("renders one geographic continent with roads, water, relief, and many destinations", () => {
    const html = renderToStaticMarkup(
      <WorldOverview
        state={makeInitialState()}
        inspectedCoord={{ x: 0, y: 0 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="World overview of Avarra"');
    expect(html).toContain("world-overview__coast");
    expect(html).toContain("world-overview__route");
    expect(html).toContain("world-overview__waterway");
    expect(html).toContain("world-overview__mountains");
    expect(html.match(/data-world-place=/g)?.length).toBeGreaterThan(50);
    expect(html).toContain('data-world-place="aurora-vault"');
    expect(html).toContain('data-world-place="star-forge"');
    expect(html).toContain('data-world-place="old-root-ruins"');
    expect(html).not.toContain("Choose a region");
    expect(html).not.toContain("region-selector__card");
    expect(SYSTEM_PROMPT).not.toMatch(/region selector/i);
    expect(SYSTEM_PROMPT).toMatch(/world overview/i);
  });

  it("owns modal focus and dismissal semantics", () => {
    const html = renderToStaticMarkup(
      <WorldOverview state={makeInitialState()} inspectedCoord={{ x: 0, y: 0 }} onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="world-overview-title"');
    expect(html).toContain('data-modal-autofocus="true"');
    expect(html).not.toMatch(/\sautofocus=/);
  });

  it("keeps projected destination controls on the SVG coordinate plane", () => {
    const html = renderToStaticMarkup(
      <WorldOverview state={makeInitialState()} inspectedCoord={{ x: 0, y: 0 }} onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    expect(html).toContain('style="aspect-ratio:1200 / 780"');
  });

  it("opens on a useful destination dossier rather than a capital list", () => {
    const html = renderToStaticMarkup(
      <WorldOverview
        state={makeInitialState()}
        inspectedCoord={{ x: 0, y: 0 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Whitemarch");
    expect(html).toContain("Regional capital");
    expect(html).toContain("Faction seat");
    expect(html).toContain("Open regional map at Whitemarch");
    expect(html).toContain("does not move or teleport the party");
    expect(html).toContain('aria-label="Filter atlas places"');
    expect(html).toContain('aria-label="Search places on the world map"');
  });

  it("keeps every map marker as a real keyboard and touch control", () => {
    const html = renderToStaticMarkup(
      <WorldOverview
        state={makeInitialState()}
        inspectedCoord={{ x: 0, y: 0 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('class="world-overview__marker is-major is-current is-selected"');
    expect(worldOverviewMarkerClass({ major: false, current: false }, false, true))
      .toBe("world-overview__marker is-refined");
    expect(html).toContain('aria-label="Inspect The Star-Forge on the world map"');
    expect(html).toContain('aria-label="Zoom in"');
    expect(html).toContain('aria-label="Zoom out"');
    expect(html).toContain('aria-label="Fit entire continent"');
  });
});
