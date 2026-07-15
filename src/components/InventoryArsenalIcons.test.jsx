import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { ArsenalView } from "./ArsenalView.jsx";
import { InventoryView } from "./InventoryView.jsx";

describe("inventory and arsenal atlas integration", () => {
  it("uses normalized equipment silhouettes for empty paper-doll slots", () => {
    const html = renderToStaticMarkup(<InventoryView state={makeInitialState()} />);
    expect(html).toContain('data-icon-key="equipment:trinket"');
    expect(html).toContain('data-icon-key="equipment:head"');
    expect(html).toContain('data-icon-key="equipment:sword"');
    expect(html).toContain('data-icon-key="equipment:shield"');
  });

  it("exposes category filters and generated nonmagic ability art", () => {
    const html = renderToStaticMarkup(<ArsenalView state={makeInitialState()} />);
    expect(html).toContain('aria-label="Ability categories"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-icon-key="category:martial"');
    expect(html).toContain('data-icon-key="category:social"');
    expect(html).not.toContain("ability-icon__category\">M");
  });
});
