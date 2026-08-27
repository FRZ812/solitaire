import { describe, expect, it } from "vitest";
import { TRAIT_CAPACITY, TRAIT_RANK_CAP } from "./traits.js";
import { SKILL_SLOTS } from "./skills.js";
import {
  acquireRune,
  acquireTrait,
  createTowBuild,
  encounterBuildFrom,
  isTowBuild,
  startingBuild,
} from "./build.js";
import {
  allStartingPackages,
  isValidStartingPackage,
  startingPackage,
  startingPackageIds,
} from "./starting-packages.js";
import {
  applyCharacterBootstrap,
  compileCharacterBootstrap,
  isCharacterBootstrapReceipt,
} from "./character-bootstrap.js";
import { getStartingArchetype } from "./starting-archetypes.js";

describe("starting packages are inspectable before play", () => {
  it("gives every profession a well-formed package", () => {
    const packages = allStartingPackages();
    expect(packages.length).toBe(startingPackageIds().length);
    for (const pkg of packages) {
      expect(isValidStartingPackage(pkg), pkg.professionId).toBe(true);
      expect(pkg.skills.length).toBeLessThanOrEqual(SKILL_SLOTS);
      // The whole point is that a player can read their combat identity at select time.
      expect(pkg.trait.name.length).toBeGreaterThan(0);
      expect(pkg.trait.effect).toBeTruthy();
    }
  });

  it("raises the opening trait rank with level", () => {
    expect(startingPackage("fighter", { level: 1 }).trait.rank)
      .toBeLessThan(startingPackage("fighter", { level: 70 }).trait.rank);
    expect(startingPackage("fighter", { level: 70 }).trait.rank).toBeLessThanOrEqual(TRAIT_RANK_CAP);
  });

  it("falls back rather than returning nothing for an unknown profession", () => {
    const pkg = startingPackage("not-a-profession");
    expect(isValidStartingPackage(pkg)).toBe(true);
  });

  it("orders packages stably", () => {
    expect(allStartingPackages().map((p) => p.professionId))
      .toEqual(allStartingPackages().map((p) => p.professionId));
  });
});

describe("the durable build", () => {
  it("is built from a profession and validates", () => {
    const build = startingBuild("fighter");
    expect(isTowBuild(build)).toBe(true);
    expect(build.professionId).toBe("fighter");
    expect(Object.keys(build.traits).length).toBe(1);
    expect(build.skills).toContainEqual({ id: "strike", rank: 1 });
  });

  it("survives a JSON round trip", () => {
    const build = startingBuild("rogue");
    expect(isTowBuild(JSON.parse(JSON.stringify(build)))).toBe(true);
  });

  it("persists owned skill ranks and hands them to the encounter kernel", () => {
    const build = createTowBuild({
      professionId: "fighter",
      traits: { ironclad: 1 },
      skills: [{ id: "strike", rank: 6 }, { id: "block", rank: 2 }],
      runes: [],
    });
    const restored = JSON.parse(JSON.stringify(build));

    expect(isTowBuild(restored)).toBe(true);
    expect(restored.skills).toEqual([
      { id: "strike", rank: 6 },
      { id: "block", rank: 2 },
    ]);
    expect(encounterBuildFrom(restored).skills).toEqual(restored.skills);
  });

  it("canonicalises so the same build hashes the same", () => {
    const a = createTowBuild({ professionId: "fighter", traits: { ironclad: 2, rage: 1 }, skills: ["strike"], runes: ["b", "a"] });
    const b = createTowBuild({ professionId: "fighter", traits: { rage: 1, ironclad: 2 }, skills: ["strike"], runes: ["a", "b"] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rejects what a fight could not run", () => {
    expect(() => createTowBuild({ professionId: "" })).toThrow(/invalid-build-profession/);
    expect(() => createTowBuild({ professionId: "fighter", traits: { nonsense: 1 } })).toThrow(/unknown-trait/);
    expect(() => createTowBuild({ professionId: "fighter", traits: { ironclad: 9 } })).toThrow(/invalid-trait-rank/);
    expect(() => createTowBuild({ professionId: "fighter", skills: ["nonsense"] })).toThrow(/unknown-skill/);
    expect(() => createTowBuild({ professionId: "fighter", skills: ["power-of-beast"] })).toThrow(/unslotted-skill/);
    expect(() => createTowBuild({ professionId: "fighter", skills: ["strike", "strike"] })).toThrow(/duplicate-skill/);
    expect(() => createTowBuild({
      professionId: "fighter",
      skills: ["strike", "block", "warcry", "penetration", "first-aid", "impregnable"],
    })).toThrow(/skill-capacity-exceeded/);
  });

  it("hands the kernel only what it consumes", () => {
    const shape = encounterBuildFrom(startingBuild("monk"));
    expect(Object.keys(shape).sort()).toEqual(["runes", "skills", "traits"]);
  });

  describe("growth", () => {
    it("raises a held trait and adds a new one", () => {
      let build = startingBuild("fighter");
      const held = Object.keys(build.traits)[0];
      const raised = acquireTrait(build, held);
      expect(raised.ok).toBe(true);
      expect(raised.build.traits[held]).toBe(build.traits[held] + 1);

      build = acquireTrait(build, "swift").build;
      expect(build.traits.swift).toBe(1);
    });

    it("stops at the rank cap and the trait capacity", () => {
      let build = createTowBuild({ professionId: "fighter", traits: { ironclad: TRAIT_RANK_CAP }, skills: [] });
      expect(acquireTrait(build, "ironclad")).toMatchObject({ ok: false, reason: "trait-at-rank-cap" });

      const traits = {};
      for (const id of ["ironclad", "aegis", "agility", "swift", "rage", "fury", "venom", "decay", "luck", "charge"]) {
        traits[id] = 1;
      }
      build = createTowBuild({ professionId: "fighter", traits, skills: [] });
      expect(Object.keys(build.traits).length).toBe(TRAIT_CAPACITY);
      expect(acquireTrait(build, "accuracy")).toMatchObject({ ok: false, reason: "trait-capacity-full" });
      // But raising one already held is still allowed at capacity.
      expect(acquireTrait(build, "ironclad").ok).toBe(true);
    });

    it("collects runes, which is what makes a fusion reachable", () => {
      const build = startingBuild("fighter");
      const withRune = acquireRune(build, "rune-of-metal");
      expect(withRune.ok).toBe(true);
      expect(withRune.build.runes).toContain("rune-of-metal");
      expect(acquireRune(withRune.build, "rune-of-metal"))
        .toMatchObject({ ok: false, reason: "rune-already-held" });
    });

    it("does not mutate the build it grows", () => {
      const build = startingBuild("fighter");
      const before = JSON.stringify(build);
      acquireTrait(build, "swift");
      acquireRune(build, "rune-of-metal");
      expect(JSON.stringify(build)).toBe(before);
    });
  });
});

describe("one bootstrap compiler", () => {
  it("compiles a template, a custom start and a practice draft through the same validator", () => {
    for (const origin of ["template", "custom", "quick-start", "practice", "fixture"]) {
      const compiled = compileCharacterBootstrap({ professionId: "fighter", origin });
      expect(compiled.ok, origin).toBe(true);
      expect(isCharacterBootstrapReceipt(compiled.receipt)).toBe(true);
    }
  });

  it("compiles the new level-free archetypes without accepting a power level input", () => {
    const knight = compileCharacterBootstrap({ archetypeId: "arctic-knight", origin: "archetype" });
    const automaton = compileCharacterBootstrap({ archetypeId: "forsaken-automaton", origin: "archetype" });
    expect(knight.ok).toBe(true);
    expect(automaton.ok).toBe(true);
    expect(knight.receipt.archetypeId).toBe("knight");
    expect(automaton.receipt.archetypeId).toBe("automaton");
    expect(knight.receipt.build).not.toHaveProperty("level");
    expect(automaton.receipt.build).not.toHaveProperty("level");
    expect(knight.receipt.id).not.toBe(automaton.receipt.id);
  });

  it("derives receipt identity from content, so the same request compiles identically", () => {
    const a = compileCharacterBootstrap({ professionId: "rogue", level: 5, origin: "template" });
    const b = compileCharacterBootstrap({ professionId: "rogue", level: 5, origin: "template" });
    expect(a.receipt.id).toBe(b.receipt.id);

    const different = compileCharacterBootstrap({ professionId: "monk", level: 5, origin: "template" });
    expect(different.receipt.id).not.toBe(a.receipt.id);
  });

  it("refuses malformed requests without producing a receipt", () => {
    expect(compileCharacterBootstrap({ origin: "nonsense" }))
      .toMatchObject({ ok: false, reason: "invalid-bootstrap-origin", receipt: null });
    expect(compileCharacterBootstrap({ level: 0 }))
      .toMatchObject({ ok: false, reason: "invalid-bootstrap-level", receipt: null });
    expect(compileCharacterBootstrap({ level: 1.5 }))
      .toMatchObject({ ok: false, reason: "invalid-bootstrap-level" });
    expect(compileCharacterBootstrap({ build: { traits: { nonsense: 1 } } }).ok).toBe(false);
  });

  it("falls back for an unknown profession rather than failing a start", () => {
    const compiled = compileCharacterBootstrap({ professionId: "not-a-profession" });
    expect(compiled.ok).toBe(true);
    expect(isTowBuild(compiled.receipt.build)).toBe(true);
  });

  it("honours an explicit build but validates it the same way", () => {
    const compiled = compileCharacterBootstrap({
      professionId: "fighter",
      build: { traits: { swift: 3 }, skills: ["strike", "warcry"], runes: [] },
    });
    expect(compiled.receipt.build.traits).toEqual({ swift: 3 });
    expect(compiled.receipt.build.skills).toEqual([
      { id: "strike", rank: 1 },
      { id: "warcry", rank: 1 },
    ]);
  });

  it("lets a validated practice build override an archetype's authored skills", () => {
    const archetype = getStartingArchetype("arctic-knight");
    const skills = [
      ...archetype.build.skills.slice(0, 2),
      "penetration",
      ...archetype.build.skills.slice(3),
    ];
    const compiled = compileCharacterBootstrap({
      archetypeId: archetype.id,
      origin: "practice",
      build: { ...archetype.build, skills },
    });

    expect(compiled.ok).toBe(true);
    expect(compiled.receipt.archetypeId).toBe(archetype.id);
    expect(compiled.receipt.build.skills).toEqual(skills.map((id) => ({ id, rank: 1 })));
  });
});

describe("applying a bootstrap is exactly once", () => {
  const receipt = compileCharacterBootstrap({ professionId: "fighter", origin: "template" }).receipt;

  it("writes the build on first application", () => {
    const result = applyCharacterBootstrap({}, receipt);
    expect(result).toMatchObject({ ok: true, applied: true });
    expect(result.mechanics.bootstrapId).toBe(receipt.id);
    expect(isTowBuild(result.mechanics.build)).toBe(true);
  });

  it("is a verified no-op when the same receipt is applied again", () => {
    const once = applyCharacterBootstrap({}, receipt).mechanics;
    const twice = applyCharacterBootstrap(once, receipt);
    expect(twice).toMatchObject({ ok: true, applied: false });
    expect(twice.mechanics).toBe(once);
  });

  it("refuses a different receipt against an already-started character", () => {
    const once = applyCharacterBootstrap({}, receipt).mechanics;
    const other = compileCharacterBootstrap({ professionId: "monk", origin: "template" }).receipt;
    expect(applyCharacterBootstrap(once, other))
      .toEqual({ ok: false, reason: "bootstrap-already-applied", mechanics: null });
  });

  it("refuses a partially initialised state rather than overwriting it", () => {
    // A build with no receipt id means something wrote character state outside the compiler.
    const partial = { build: startingBuild("rogue") };
    expect(applyCharacterBootstrap(partial, receipt))
      .toEqual({ ok: false, reason: "partial-bootstrap-state", mechanics: null });
  });

  it("refuses anything that is not a receipt", () => {
    for (const bad of [null, {}, { id: "x" }, { ...receipt, id: "not-a-checksum" }]) {
      expect(applyCharacterBootstrap({}, bad))
        .toMatchObject({ ok: false, reason: "invalid-bootstrap-receipt" });
    }
  });
});
