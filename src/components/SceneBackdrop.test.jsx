import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { SceneBackdrop } from "./SceneBackdrop.jsx";

describe("SceneBackdrop", () => {
  it("uses a stable POI plate and a non-architectural tier treatment", () => {
    const html = renderToStaticMarkup(<SceneBackdrop state={makeInitialState()} />);

    expect(html.match(/<img/g)).toHaveLength(2);
    expect(html).toContain('data-scene-family="market"');
    expect(html).toContain('data-poi-tier="standard"');
    expect(html).toContain("scene-backdrop__layer--far");
    expect(html).toContain("scene-backdrop__tier");
    expect(html).not.toContain("scene-backdrop__layer--near");
  });

  it("uses an untiered POI scene for a visited building", () => {
    const state = makeInitialState();
    state.world.currentTile = { x: 300, y: 0 };
    state.world.tiles["300,0"] = {
      terrain: "indoor",
      poi: { type: "temple", name: "The Roadside Chapel" },
    };

    const html = renderToStaticMarkup(<SceneBackdrop state={state} />);

    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain('data-scene-family="sacred"');
    expect(html).toMatch(/data-scene-variant="[ab]"/);
    expect(html).not.toContain("scene-backdrop__tier");
  });

  it("keeps the regional scene when the visited tile has no POI", () => {
    const state = makeInitialState();
    state.world.currentTile = { x: 301, y: 0 };
    state.world.tiles["301,0"] = { terrain: "forest" };

    const html = renderToStaticMarkup(<SceneBackdrop state={state} />);

    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).not.toContain("data-scene-family");
    expect(html).not.toContain("scene-backdrop__tier");
  });
});
