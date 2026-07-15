import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { VitalsStrip } from "./primitives.jsx";

describe("VitalsStrip", () => {
  it("surfaces ambient light in the persistent HUD", () => {
    const html = renderToStaticMarkup(<VitalsStrip state={makeInitialState()} onExtinguish={() => {}} />);

    expect(html).toContain("Light");
    expect(html).toContain("daylight");
    expect(html).toContain("hud-light");
  });
});
