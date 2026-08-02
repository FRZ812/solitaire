import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./chat-scene.css", import.meta.url), "utf8");

function rulesFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))]
    .map((match) => match[1]);
}

function lastRule(selector) {
  return rulesFor(selector).at(-1) || "";
}

describe("Narrator picker presentation", () => {
  it("keeps the chat visible behind the narrator model panel", () => {
    const backdrop = lastRule(".narrator-picker__backdrop");
    expect(backdrop).toContain("background: transparent");
    expect(backdrop).not.toContain("backdrop-filter: blur");
  });

  it("uses inherited typography and allows complete sort labels", () => {
    expect(rulesFor(".narrator-picker__sort-trigger"))
      .toContainEqual(expect.stringContaining("font-family: inherit"));
    expect(rulesFor(".narrator-picker__sort-option"))
      .toContainEqual(expect.stringContaining("white-space: normal"));
  });
});
