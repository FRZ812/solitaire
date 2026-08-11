// Gate D8 from the rebuild plan: nothing in production may reach the retired deck engine.
//
// A deletion is only durable if something notices when it grows back. These modules and
// symbols were removed when combat moved onto the Tower of Winter kernel, and an import
// of any of them means a compatibility path has reappeared — which is exactly what the
// cutover was for.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");

const RETIRED_MODULES = Object.freeze([
  "engine/combat.js",
  "engine/combat-ai.js",
  "engine/combat-result.js",
  "data/combat-archetypes.js",
  "data/combat-cards.js",
  "components/combat/CombatView.jsx",
  "components/combat/CombatCard.jsx",
]);

const RETIRED_SYMBOLS = Object.freeze([
  "initCombat",
  "playCard",
  "defaultCombatDeck",
  "applyCombatResult",
  "archetypeForCharacter",
  "staminaMaxFor",
  "cardDefinition",
]);

function sourceFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (!/\.(js|jsx)$/.test(entry)) continue;
    // Tests may still name a retired symbol to prove it stays gone; this file does.
    if (/\.test\.(js|jsx)$/.test(entry)) continue;
    found.push(path);
  }
  return found;
}

const FILES = sourceFiles(SRC).map((path) => ({
  path: path.slice(ROOT.length).replace(/\\/g, "/"),
  text: readFileSync(path, "utf8"),
}));

describe("the retired deck engine stays retired", () => {
  it("finds production sources to scan", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it.each(RETIRED_MODULES)("no production module imports %s", (modulePath) => {
    const offenders = FILES.filter((file) => file.text.includes(modulePath));
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it.each(RETIRED_SYMBOLS)("no production module references %s", (symbol) => {
    const pattern = new RegExp(`\\b${symbol}\\b`);
    const offenders = FILES.filter((file) => pattern.test(file.text));
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it("keeps no deck, draw, discard or exhaust surface in the UI", () => {
    const pattern = /\b(deck-combat|combat__deck|drawPile|discardPile|exhaustPile)\b/;
    const offenders = FILES.filter((file) => pattern.test(file.text));
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it("still owns the non-combat modules the plan said to keep", () => {
    // combat-stats keeps the equipment and inventory APIs the codex and bestiary use;
    // combat-loot keeps spoils and the search-the-fallen flow; condition-combat is read
    // by the codex. Deleting these would have taken product features with them.
    const kept = ["engine/combat-stats.js", "engine/combat-loot.js", "engine/condition-combat.js"];
    for (const path of kept) {
      expect(() => statSync(join(SRC, path)), `${path} should still exist`).not.toThrow();
    }
  });
});
