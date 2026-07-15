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
    expect(html).not.toContain("hud-light");
  });

  it("distinguishes hidden darkness from a revealing carried flame", () => {
    const state = makeInitialState();
    state.time.hour = 23;
    state.world.tiles["0,0"] = { terrain: "forest", poi: null };

    const hiddenHtml = renderToStaticMarkup(<VitalsStrip state={state} onExtinguish={() => {}} />);
    expect(hiddenHtml).toContain("Obscured");
    expect(hiddenHtml).toContain("Hidden · sight impaired");
    expect(hiddenHtml).toContain("visibility-status--heavy");

    state.character.light = { source: "torch", minutes: 42 };
    const revealedHtml = renderToStaticMarkup(<VitalsStrip state={state} onExtinguish={() => {}} />);
    expect(revealedHtml).toContain("Revealed");
    expect(revealedHtml).toContain("Torch · 42m");
    expect(revealedHtml).toContain("visibility-status--revealed");
  });
});
