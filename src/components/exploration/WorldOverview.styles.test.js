import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = fileURLToPath(new URL("./exploration.css", import.meta.url));

describe("world overview responsive controls", () => {
  it("keeps map markers touch-sized and collapses the dossier below the map", () => {
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toMatch(/\.world-overview__marker\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.world-overview__body\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.world-overview__party-pulse/s);
  });
});
