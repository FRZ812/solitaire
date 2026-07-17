import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JourneyLoader, JourneyResumeOverlay } from "./JourneyLoader.jsx";

describe("journey loading states", () => {
  it("announces the startup phase instead of exposing a background-only frame", () => {
    const html = renderToStaticMarkup(
      <JourneyLoader title="Opening your journey" detail="Restoring your latest save" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Opening your journey");
    expect(html).toContain("Restoring your latest save");
    expect(html).toContain("journey-loader__track");
  });

  it("blocks a warm game snapshot while its server version is checked", () => {
    const html = renderToStaticMarkup(<JourneyResumeOverlay />);
    expect(html).toContain("Restoring your journey");
    expect(html).toContain("Checking for newer progress");
    expect(html).toContain('aria-busy="true"');
  });
});
