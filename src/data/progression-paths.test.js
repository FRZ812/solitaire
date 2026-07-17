import { describe, expect, it } from "vitest";
import { CHARACTER_TEMPLATES } from "./templates.js";
import {
  LEVEL_TIER_BANDS,
  PATH_GRADE_CAPS,
  PROFESSION_BUILDS,
  PROGRESSION_PATHS,
  STARTING_LEVEL_BY_POWER_TIER,
  attributeCeilingForLevel,
  canonicalProfessionId,
  compileProfessionBuild,
  expandLegacyAttribute,
  expandLegacyAttributes,
  levelTier,
  validateProgressionCatalog,
} from "./progression-paths.js";

describe("profession progression catalog", () => {
  it("compiles every profession and either side-path choice into one contiguous 100-level stack", () => {
    expect(validateProgressionCatalog()).toEqual([]);

    for (const professionId of Object.keys(PROFESSION_BUILDS)) {
      for (const sidePath of ["racial", "utility"]) {
        const compiled = compileProfessionBuild(professionId, { sidePath });

        expect(compiled.totalLevels, `${professionId}/${sidePath} total`).toBe(100);
        expect(compiled.levels, `${professionId}/${sidePath} rows`).toHaveLength(100);
        expect(compiled.levels.map((row) => row.level), `${professionId}/${sidePath} order`)
          .toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
        expect(Object.values(compiled.ranks).reduce((sum, rank) => sum + rank, 0)).toBe(100);
        expect(compiled.levels.every((row) => row.rank <= row.maxRank)).toBe(true);
      }
    }
  });

  it("enforces the 15/10/5 grade caps instead of allowing a single 100-rank path", () => {
    expect(PATH_GRADE_CAPS).toEqual({ standard: 15, advanced: 10, specialized: 5 });

    for (const path of Object.values(PROGRESSION_PATHS)) {
      expect(path.maxRank, `${path.id} cap`).toBe(PATH_GRADE_CAPS[path.grade]);
      expect(path.maxRank).toBeLessThan(100);
    }
  });

  it("uses the same ten-level budget slot for racial development or utility breadth", () => {
    for (const professionId of Object.keys(PROFESSION_BUILDS)) {
      const racial = compileProfessionBuild(professionId, { sidePath: "racial" });
      const utility = compileProfessionBuild(professionId, { sidePath: "utility" });
      const racialBranch = racial.segments.find((segment) => segment.pathId === "awakened-lineage");
      const utilityBranch = utility.segments.find((segment) => segment.pathId === "worldly-versatility");

      expect(racialBranch).toMatchObject({ kind: "racial", grade: "advanced", ranks: 10, start: 41, end: 50 });
      expect(utilityBranch).toMatchObject({ kind: "utility", grade: "advanced", ranks: 10, start: 41, end: 50 });
      expect(racial.segments.map((segment) => [segment.start, segment.end]))
        .toEqual(utility.segments.map((segment) => [segment.start, segment.end]));
    }
  });

  it("turns each specialized archetype into distinct path ids and attribute growth", () => {
    const quietBlade = compileProfessionBuild("assassin", { archetypeId: "assassin-quiet-blade" });
    const shadowblade = compileProfessionBuild("assassin", { archetypeId: "shadowblade" });

    expect(quietBlade.archetype).toBe("Quiet Blade");
    expect(shadowblade.archetype).toBe("Shadowblade");
    expect(shadowblade.levels[50]).toMatchObject({ level: 51, pathName: "Shadowblade", archetypeId: "shadowblade" });
    expect(shadowblade.levels[50].pathId).not.toBe(quietBlade.levels[50].pathId);
    expect(shadowblade.finalAttributes).not.toEqual(quietBlade.finalAttributes);
  });

  it("folds exact vocations into broad non-combat professions", () => {
    expect(canonicalProfessionId("blacksmith")).toBe("artisan");
    expect(canonicalProfessionId("porter")).toBe("labourer");
    expect(canonicalProfessionId("house-scribe")).toBe("scholar");
    expect(canonicalProfessionId("herb-healer")).toBe("healer");
    expect(canonicalProfessionId("marsh-spearman")).toBe("soldier");
  });

  it("allows a racial calling to devote most of its stack to racial levels", () => {
    const wyrm = compileProfessionBuild("dragon-ascendant", { sidePath: "racial" });
    const racialLevels = wyrm.levels.filter((row) => row.kind === "racial").length;
    const utilityLevels = wyrm.levels.filter((row) => row.kind === "utility").length;

    expect(racialLevels).toBeGreaterThanOrEqual(80);
    expect(utilityLevels).toBeGreaterThan(0);
  });
});

describe("level tiers and expanded attributes", () => {
  it("keeps deliberate gaps between campaign anchors and high-world tier thresholds", () => {
    expect(STARTING_LEVEL_BY_POWER_TIER).toEqual({
      standard: 10,
      mid: 25,
      epic: 45,
      legendary: 65,
      mythical: 85,
      divine: 100,
    });
    expect(LEVEL_TIER_BANDS.map(({ id, min, max }) => ({ id, min, max }))).toEqual([
      { id: "standard", min: 1, max: 20 },
      { id: "mid", min: 21, max: 40 },
      { id: "epic", min: 41, max: 60 },
      { id: "legendary", min: 61, max: 70 },
      { id: "mythical", min: 71, max: 85 },
      { id: "divine", min: 86, max: 100 },
    ]);
    expect([1, 20, 21, 40, 41, 60, 61, 70, 71, 85, 86, 100].map((level) => levelTier(level).id))
      .toEqual(["standard", "standard", "mid", "mid", "epic", "epic", "legendary", "legendary", "mythical", "mythical", "divine", "divine"]);
  });

  it("expands retired 0-30 attributes onto the new 0-90 curve", () => {
    expect([0, 5, 10, 20, 30].map(expandLegacyAttribute)).toEqual([0, 6, 14, 42, 90]);
    expect(expandLegacyAttributes({ body: 30, reflex: 20, vigor: 10, mind: 5, wit: 0, presence: 99 }))
      .toEqual({ body: 90, reflex: 42, vigor: 14, mind: 6, wit: 0, presence: 90 });
  });

  it("widens attribute ceilings with level and contains every legal route projection", () => {
    expect([1, 10, 60, 85, 94, 100].map(attributeCeilingForLevel)).toEqual([10, 18, 58, 79, 90, 90]);
    const violations = [];
    const routeCases = Object.keys(PROFESSION_BUILDS).flatMap((professionId) => [
      { professionId, archetypeId: null },
      ...Array.from({ length: 12 }, (_, index) => ({ professionId, archetypeId: `ceiling-probe-${index}` })),
    ]);
    for (const template of CHARACTER_TEMPLATES) {
      routeCases.push({ professionId: template.setup.profession, archetypeId: template.setup.archetype });
    }
    for (const { professionId, archetypeId } of routeCases) {
      for (const sidePath of ["racial", "utility"]) {
        const compiled = compileProfessionBuild(professionId, { sidePath, archetypeId });
        for (const row of compiled.levels) {
          const maximum = Math.max(...Object.values(row.cumulativeAttributes));
          const ceiling = attributeCeilingForLevel(row.level);
          if (maximum > ceiling) violations.push(`${professionId}/${archetypeId || "canonical"}/${sidePath}/L${row.level}: ${maximum}>${ceiling}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
