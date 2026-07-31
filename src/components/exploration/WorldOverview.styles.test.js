import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = fileURLToPath(new URL("./exploration.css", import.meta.url));

describe("world overview responsive controls", () => {
  it("keeps map markers touch-sized and collapses the dossier below the map", () => {
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toMatch(/\.world-overview__marker\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/);
    expect(css).toMatch(/\.world-overview__map-controls button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/);
    expect(css).toMatch(/\.world-overview__search input\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(css).toMatch(/\.world-overview__filters button\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(css).not.toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.world-overview__map-controls button\s*\{[^}]*?(?:width|height):\s*(?:3\d|4[0-3])px/);
    expect(css).not.toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.world-overview__(?:search input|filters button)\s*\{[^}]*?min-height:\s*(?:3\d|4[0-3])px/);
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.world-overview__body\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.world-overview__party-pulse/s);
    expect(css).not.toMatch(/@keyframes\s+world-overview-enter\s*\{[^}]*scale\(/);
    expect(css).toMatch(/@media\s*\(max-height:\s*520px\)[\s\S]*?\.world-overview__stage\s*\{[^}]*max-width:\s*calc\(153\.84615385dvh\s*-\s*258\.46153846px\)/);
    expect(css).toMatch(/@media\s*\(max-height:\s*520px\)[\s\S]*?\.world-overview__realm-label\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media\s*\(max-height:\s*520px\)[\s\S]*?\.world-overview__marker:not\(\.is-major\):not\(\.is-current\):not\(\.is-selected\):not\(\.is-refined\)\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media\s*\(max-height:\s*520px\)\s*and\s*\(max-width:\s*760px\)[\s\S]*?\.world-overview__toolbar\s*\{[^}]*flex-direction:\s*row/);
  });
});
