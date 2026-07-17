import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManualCreation } from "./ManualCreation.jsx";

describe("ManualCreation progression allocation", () => {
  it("presents profession and racial levels as separate investments", () => {
    const html = renderToStaticMarkup(
      <ManualCreation
        onBegin={() => {}}
        onCancel={() => {}}
        onQuit={() => {}}
        busy={false}
      />,
    );

    expect(html).toContain("Racial evolution · 0 / 30");
    expect(html).toContain("Professions · 10 / 70");
    expect(html).toContain("Total level 10 / 100");
    expect(html).toContain("Multiclass professions");
    expect(html).toContain("Specialization");
    expect(html).toContain("Progression grants");
    expect(html).not.toContain("Martial techniques");
    expect(html).not.toContain("techniques &amp; spells");
    expect(html).not.toContain("Progression level ·");
    expect(html).not.toContain("Standard · Level");
  });
});
