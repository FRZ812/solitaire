import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { VitalsStrip } from "./primitives.jsx";

describe("VitalsStrip", () => {
  it("surfaces visibility and obscurity as a first-class HUD state", () => {
    const html = renderToStaticMarkup(<VitalsStrip state={makeInitialState()} onExtinguish={() => {}} />);

    expect(html).toContain("Obscurity");
    expect(html).toContain("Visible");
    expect(html).toContain("Clear sightlines");
    expect(html).toContain("visibility-status--clear");
    expect(html).toContain("visibilityOpen");
    expect(html).toContain('data-game-icon="hunger"');
    expect(html).not.toContain("hud-light");
  });

  it("uses closed, half-open, and open eyes for hidden, obscured, and revealed states", () => {
    const state = makeInitialState();
    state.time.hour = 23;
    // The unified capital owns 0,0 authoritatively. Exercise wilderness
    // visibility on a synthetic visited tile outside its footprint instead.
    state.world.currentTile = { x: 1000, y: 0 };
    state.world.tiles["1000,0"] = { terrain: "forest", poi: null };

    const hiddenHtml = renderToStaticMarkup(<VitalsStrip state={state} onExtinguish={() => {}} />);
    expect(hiddenHtml).toContain("Hidden");
    expect(hiddenHtml).toContain("Sight impaired");
    expect(hiddenHtml).toContain("visibility-status--heavy");
    expect(hiddenHtml).toContain("visibilityClosed");

    state.character.darkvision = true;
    const obscuredHtml = renderToStaticMarkup(<VitalsStrip state={state} onExtinguish={() => {}} />);
    expect(obscuredHtml).toContain("Obscured");
    expect(obscuredHtml).toContain("Darkvision · unseen");
    expect(obscuredHtml).toContain("visibility-status--partial");
    expect(obscuredHtml).toContain("visibilityHalf");

    state.character.darkvision = false;
    state.character.light = { source: "torch", minutes: 42 };
    const revealedHtml = renderToStaticMarkup(<VitalsStrip state={state} onExtinguish={() => {}} />);
    expect(revealedHtml).toContain("Revealed");
    expect(revealedHtml).toContain("Torch · 42m");
    expect(revealedHtml).toContain("visibility-status--revealed");
    expect(revealedHtml).toContain("visibilityOpen");
  });
});
