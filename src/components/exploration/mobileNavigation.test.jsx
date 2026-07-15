import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { PlaceView } from "../PlaceView.jsx";
import { WorldExploration } from "./WorldExploration.jsx";

describe("mobile map navigation markup", () => {
  it("uses direct map selection and a dedicated encounter action on the world map", () => {
    const html = renderToStaticMarkup(
      <WorldExploration
        state={makeInitialState()}
        onClose={vi.fn()}
        onTravel={vi.fn()}
        onFly={vi.fn()}
        onTeleport={vi.fn()}
        onSeekCombat={vi.fn()}
        loading={false}
      />,
    );

    expect(html).toContain("Choose on the map");
    expect(html).toContain("Tap a tile");
    expect(html).toContain('aria-label="Seek a hostile encounter"');
    expect(html).toContain('aria-label="Open world atlas"');
    expect(html).toContain('aria-label="Open quest journal"');
    expect(html).not.toContain("Map cursor controls");
    expect(html).not.toContain("Choose a destination");
    expect(html).not.toContain("rpg-trail-choices");
  });

  it("keeps city movement on the same tap-and-confirm interaction", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <PlaceView
        state={state}
        time={state.time}
        onMove={vi.fn()}
        onLeave={vi.fn()}
        onService={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Tap a landmark");
    expect(html).toContain("Confirm the walk");
    expect(html).toContain('aria-label="Open city guide"');
    expect(html).toContain('aria-label="Center map on current location"');
    expect(html).not.toContain("City cursor controls");
    expect(html).not.toContain("Ways from here");
    expect(html).not.toContain("place-nearby-choices");
  });
});
