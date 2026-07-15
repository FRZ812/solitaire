import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { itemTemplate } from "../data/catalog.js";
import { ItemIcon } from "./ItemIcon.jsx";

describe("ItemIcon", () => {
  it("renders stable atlas cells by equipment family and item category", () => {
    const sword = renderToStaticMarkup(<ItemIcon item={itemTemplate("arming-sword")} size={24} />);
    const remedy = renderToStaticMarkup(<ItemIcon item={itemTemplate("healing-salve")} size={24} decorative={false} />);

    expect(sword).toContain('data-icon-key="equipment:sword"');
    expect(sword).toContain('data-atlas-column="1"');
    expect(sword).toContain('data-atlas-row="0"');
    expect(sword).toContain('aria-hidden="true"');
    expect(remedy).toContain('data-icon-key="items:remedy"');
    expect(remedy).toContain('aria-label="Remedy icon"');
    expect(remedy).not.toContain("<svg");
  });
});
