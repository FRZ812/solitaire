import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { CompactHeader } from "./CompactHeader.jsx";

describe("CompactHeader", () => {
  it("renders world time as an accessible analog clock", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <CompactHeader state={state} onMap={() => {}} onOpenDeck={() => {}} />,
    );

    expect(html).toContain('class="compact-header__clock"');
    expect(html).toContain('aria-label="World time 13:30"');
    expect(html).toContain('--clock-angle:45deg');
    expect(html).toContain('--clock-angle:180deg');
    expect(html).toContain("compact-header__title-track");
  });
});
