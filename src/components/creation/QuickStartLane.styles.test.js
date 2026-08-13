import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const quickStartCss = readFileSync(new URL("./quick-start.css", import.meta.url), "utf8");

describe("Quick Start layout", () => {
  it("owns the viewport instead of shrinking the game HUD behind it", () => {
    const shellRule = quickStartCss.match(/\.quick-start\s*\{([^}]*)\}/)?.[1] || "";
    expect(shellRule).toContain("position: fixed");
    expect(shellRule).toContain("inset: 0");
    expect(shellRule).toContain("z-index: 60");
    expect(shellRule).toContain("overflow-y: auto");
  });
});
