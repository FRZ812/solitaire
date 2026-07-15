import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { PanelDeck, shouldDismissPanel } from "./PanelDeck.jsx";

describe("PanelDeck", () => {
  it("renders abilities as a peer deck page with handle-only sheet chrome", () => {
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
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html).not.toContain("Wanderer dossier");
    expect(html).not.toContain("Close character menu");
  });

  it("snaps short pulls back and dismisses long or deliberate flicks", () => {
    expect(shouldDismissPanel(12, 2)).toBe(false);
    expect(shouldDismissPanel(60, 0.2)).toBe(false);
    expect(shouldDismissPanel(60, 0.7)).toBe(true);
    expect(shouldDismissPanel(96, 0.1)).toBe(true);
  });
});
