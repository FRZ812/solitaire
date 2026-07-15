import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { SceneBackdrop } from "./SceneBackdrop.jsx";

describe("SceneBackdrop", () => {
  it("renders one scene plate so parallax cannot double the architecture", () => {
    const html = renderToStaticMarkup(<SceneBackdrop state={makeInitialState()} />);

    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain("scene-backdrop__layer--far");
    expect(html).not.toContain("scene-backdrop__layer--near");
  });
});
