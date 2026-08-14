import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const quickStartCss = readFileSync(new URL("./quick-start.css", import.meta.url), "utf8");
const characterSelectCss = readFileSync(new URL("./character-select-polish.css", import.meta.url), "utf8");
const archetypeStartCss = readFileSync(new URL("./archetype-start.css", import.meta.url), "utf8");

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

  it("lays the twelve-character source roster out as posters with a two-column mobile fallback", () => {
    const gridRule = characterSelectCss.match(/\.character-choice-grid\s*\{([^}]*)\}/)?.[1] || "";
    const cardRule = characterSelectCss.match(/\.character-choice-card\s*\{([^}]*)\}/)?.[1] || "";
    expect(gridRule).toContain("repeat(6");
    expect(cardRule).toContain("aspect-ratio: 3 / 4");
    expect(characterSelectCss).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.character-choice-grid\s*\{[\s\S]*?repeat\(2/);
  });

  it("shows an explicit four-slot ability strip instead of an overflow affordance", () => {
    expect(characterSelectCss).toContain(".character-preview__ability-strip");
    expect(characterSelectCss).toContain('[data-ability-type="ultimate"]');
  });

  it("lets the detail sheet scroll without collapsing its stat row", () => {
    const sectionRule = archetypeStartCss.match(/\.character-details__body > section\s*\{([^}]*)\}/)?.[1] || "";
    expect(sectionRule).toContain("flex: 0 0 auto");
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
