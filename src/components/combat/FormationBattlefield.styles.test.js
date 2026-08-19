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

  it("floats target confirmation above the action tray without consuming layout height", () => {
    expect(cssBlock(".tow-combat__target-confirm"))
      .toMatch(/position:\s*absolute;[\s\S]*bottom:\s*calc\(100% \+ 0\.55rem\);/);
    expect(cssBlock(".tow-combat__target-confirm")).toContain("margin: 0 auto");
  });

  it("renders targeting as borderless backlight behind the unit card", () => {
    expect(formationCss).toMatch(/\.tow-formation-cell::before,\s*\n\.tow-formation-cell::after\s*\{[\s\S]*border-radius:\s*50%;/);
    expect(cssBlock(".tow-formation-cell::before")).not.toContain("border:");
    expect(formationCss).not.toContain("clip-path: polygon(");
    expect(cssBlock(".tow-formation-cell::before"))
      .toMatch(/radial-gradient[\s\S]*filter:\s*blur\(0\.42rem\);/);
    expect(cssBlock(".tow-formation-cell.is-affected::before"))
      .toMatch(/opacity:\s*0\.68;[\s\S]*transform:\s*scale\(1\);/);
    expect(cssBlock(".tow-formation-cell.is-preview-anchor::before"))
      .toContain("opacity: 0.98");
  });

  it("moves the complete unit card rather than animating only the portrait", () => {
    expect(cssBlock(".tow-formation-unit.is-lunging"))
      .toMatch(/animation:\s*tow-formation-melee-lunge[\s\S]*620ms/);
    expect(cssBlock(".tow-formation-unit.is-lunging .tow-formation-unit__figure"))
      .not.toContain("animation:");
  });
});
