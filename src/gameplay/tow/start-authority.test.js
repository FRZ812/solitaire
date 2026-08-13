// Phase 4's deletion guards, as tests rather than intentions.
//
// Two claims the phase gate makes are only true for as long as nobody adds a second way to
// do the thing. Both are cheap to check against the source, and expensive to discover the
// hard way: a character started outside the compiler is a character whose build nobody can
// reproduce, and a Combat Lab that ships enabled is a fight-starting debug surface in a
// player's hands.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMBAT_LAB_ENV, combatLabEnabled } from "./lab-gate.js";

const SRC = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function sourceFiles(dir = SRC, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out);
      continue;
    }
    if (!/\.(js|jsx)$/.test(entry)) continue;
    if (/\.test\.(js|jsx)$/.test(entry)) continue;
    out.push(path);
  }
  return out;
}

const FILES = sourceFiles().map((path) => ({ path, source: readFileSync(path, "utf8") }));

describe("one applicator owns the start of a character", () => {
  it("is imported by nothing that is not itself the compiler or a test", () => {
    // Ready-made, custom, Quick Start, practice and fixtures all have to arrive through the
    // same validator, or two entry paths drift into producing subtly different characters.
    const importers = FILES.filter(({ path, source }) => (
      !path.endsWith("character-bootstrap.js")
      && /applyCharacterBootstrap/.test(source)
    ));
    // Nothing wires it yet — the start UI is the lane that will — but when something does,
    // this test is where a second applicator would be caught.
    expect(importers.map(({ path }) => path.replace(SRC, ""))).toEqual([]);
  });

  it("is the only thing that writes a real bootstrap id", () => {
    // The value has to be captured rather than excluded with a lookahead: `\s*` backtracks
    // to zero width, so `(?!null)` would happily pass on ` null`. Reading the id back — to
    // seal a checkpoint against it, say — is not writing one, so an expression that mentions
    // `bootstrapId` is a pass-through rather than a second applicator.
    const writers = FILES.filter(({ path, source }) => {
      if (path.endsWith("character-bootstrap.js")) return false;
      const assignments = [...source.matchAll(/bootstrapId:\s*([^,\n}]+)/g)];
      return assignments.some(([, raw]) => {
        const value = raw.trim();
        return value !== "null" && !value.includes("bootstrapId");
      });
    });
    expect(writers.map(({ path }) => path.replace(SRC, ""))).toEqual([]);
  });
});

describe("the Combat Lab cannot ship enabled", () => {
  it("is off without an environment, and off for anything but the exact value", () => {
    expect(combatLabEnabled(undefined)).toBe(false);
    expect(combatLabEnabled({})).toBe(false);
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: "" })).toBe(false);
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: "1" })).toBe(false);
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: "yes" })).toBe(false);
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: true })).toBe(false);
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: "TRUE" })).toBe(false);
  });

  it("is on only for the literal flag in a non-production build", () => {
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: "true" })).toBe(true);
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: "true", PROD: false })).toBe(true);
  });

  it("stays off in a production build even when the flag is set", () => {
    // This is what makes "impossible to open in production" independent of whether someone
    // set the variable in the release pipeline.
    expect(combatLabEnabled({ [COMBAT_LAB_ENV]: "true", PROD: true })).toBe(false);
  });

  it("cannot be turned on by a query string, because it never reads one", () => {
    const source = readFileSync(new URL("./lab-gate.js", import.meta.url), "utf8");
    expect(source).not.toContain("location");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("URLSearchParams");
  });

  it("is not imported by anything on the production path", () => {
    // The Lab may name itself; nothing else may name it. An import from App.jsx or any other
    // shipped surface would put a fight-starting debug tool into the bundle.
    const importers = FILES.filter(({ path, source }) => (
      !path.endsWith("lab-gate.js")
      && !path.endsWith("CombatLab.jsx")
      && /CombatLab/.test(source)
    ));
    expect(importers.map(({ path }) => path.replace(SRC, ""))).toEqual([]);
  });

  it("brings no narrator or storage dependency with it", () => {
    const source = readFileSync(
      new URL("../../components/combat/CombatLab.jsx", import.meta.url),
      "utf8",
    );
    for (const forbidden of [
      "supabase", "api-supabase", "campaign-resume", "localStorage", "narrateSpecialized",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});

describe("practice cannot reach persistence", () => {
  it("imports nothing that writes a campaign", () => {
    const source = readFileSync(new URL("./practice-scenarios.js", import.meta.url), "utf8");
    for (const forbidden of [
      "campaigns-supabase",
      "campaign-resume",
      "supabase-client",
      "api-supabase",
      "localStorage",
      "settlement.js",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
