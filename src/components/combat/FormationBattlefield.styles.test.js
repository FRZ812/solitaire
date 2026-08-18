import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const formationCss = readFileSync(new URL("./tow-combat-formation.css", import.meta.url), "utf8");

function cssBlock(selector) {
  const start = formationCss.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return formationCss.slice(start, formationCss.indexOf("}", start) + 1);
}

describe("formation battlefield layout", () => {
  it("pins the compact HUD to portrait corners and stacks vitals vertically", () => {
    expect(cssBlock(".tow-formation-cell__overlays .tow-combat__intent"))
      .toMatch(/position:\s*absolute;[\s\S]*top:\s*0\.12rem;[\s\S]*right:\s*7%;/);
    expect(cssBlock(".tow-formation-cell__overlays .tow-combat__intent-sigil"))
      .toContain("border-radius: 50%");
    expect(cssBlock(".tow-formation-statuses"))
      .toMatch(/bottom:\s*1\.34rem;[\s\S]*min-height:\s*0\.96rem;/);
    expect(cssBlock(".tow-formation-unit__vitals"))
      .toContain("grid-template-columns: minmax(0, 1fr)");
    expect(formationCss).not.toContain(".tow-formation-unit__name {");
  });
});
