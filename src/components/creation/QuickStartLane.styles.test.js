import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const quickStartCss = readFileSync(new URL("./quick-start.css", import.meta.url), "utf8");
const characterSelectCss = readFileSync(new URL("./character-select-polish.css", import.meta.url), "utf8");

describe("Quick Start layout", () => {
  it("owns the viewport instead of shrinking the game HUD behind it", () => {
    const shellRule = quickStartCss.match(/\.quick-start\s*\{([^}]*)\}/)?.[1] || "";
    expect(shellRule).toContain("position: fixed");
    expect(shellRule).toContain("inset: 0");
    expect(shellRule).toContain("z-index: 60");
    expect(shellRule).toContain("overflow-y: auto");
  });

  it("keeps the padded character preview inside the viewport", () => {
    const stageRule = characterSelectCss.match(/\.character-preview__stage\s*\{([^}]*)\}/)?.[1] || "";
    expect(stageRule).toContain("box-sizing: border-box");
    expect(stageRule).toContain("width: min(1280px, 100%)");
  });
});

describe("Practice result layout", () => {
  it("owns the viewport the same way the fight it replaces does", () => {
    // The fight is a fixed full-screen overlay and the result screen replaces it in the same
    // instant. As a plain section it fell into normal document flow the moment the last blow
    // landed — rendered off-screen behind the story shell, disturbing that shell's layout on
    // the way past, so the fight appeared to end in nothing and the composer floated to
    // mid-screen. Mounted but invisible is the worst of both: no error to find, and the
    // player is simply stuck.
    const rule = quickStartCss.match(/\.practice-fight--result,\s*\.practice-fight--failed\s*\{([^}]*)\}/)?.[1] || "";
    expect(rule).toContain("position: fixed");
    expect(rule).toContain("inset: 0");
    expect(rule).toContain("overflow: auto");
    // Same stacking as .production-combat, because these two are one surface to the player.
    expect(rule).toContain("z-index: 10020");
  });

  it("keeps the reading width the card had before it became an overlay", () => {
    const rule = quickStartCss.match(/\.practice-fight--result > \*,\s*\.practice-fight--failed > \*\s*\{([^}]*)\}/)?.[1] || "";
    expect(rule).toContain("40rem");
  });
});
