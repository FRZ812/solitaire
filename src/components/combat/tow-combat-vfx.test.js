import { describe, expect, it } from "vitest";
import { getSkill, skillIds } from "../../gameplay/tow/skills.js";
import { statusTypes } from "../../gameplay/kernel/status-stack.js";
import { resolveTowAbilityArt } from "./tow-combat-ability-art.js";
import {
  COMBAT_VFX_ASSETS,
  COMBAT_VFX_PLANNED_SKILL_REGISTRY,
  COMBAT_VFX_SKILL_REGISTRY,
  combatVfxForEvent,
  combatVfxForHit,
  combatVfxForIntent,
  combatVfxForStatus,
  combatVfxVariantForForm,
  combatVfxVariantForSkill,
} from "./tow-combat-vfx.js";
import { canvasSupportsChoreography } from "./TowCombatVfxCanvas.jsx";

const ARCHETYPE_PREFIXES = Object.freeze([
  "arctic-",
  "assassin-",
  "automaton-",
  "blade-",
  "clocktower-",
  "demon-",
  "mage-",
  "north-king-",
  "priestess-",
  "sleepless-",
  "vampire-",
  "witch-",
]);

function expectCanvasVisual(visual) {
  expect(visual).toMatchObject({
    asset: null,
    assetSource: "canvas",
    authored: true,
    choreography: expect.any(String),
    palette: {
      primary: expect.any(String),
      secondary: expect.any(String),
      shadow: expect.any(String),
    },
    profile: {
      key: expect.stringMatching(/^vfx-/),
      seed: expect.any(Number),
    },
    signatureKey: expect.any(String),
  });
  expect(canvasSupportsChoreography(visual.choreography), visual.variant).toBe(true);
}

describe("authored procedural combat VFX", () => {
  it("keeps the raster family manifest only for backwards-compatible UI consumers", () => {
    expect(Object.keys(COMBAT_VFX_ASSETS).sort()).toEqual([
      "afflict", "arcane", "evade", "fire", "frost", "gash", "heal", "impact",
      "lightning", "pierce", "slash", "ward", "wind",
    ]);
    expect(Object.values(COMBAT_VFX_ASSETS).every((asset) => asset.endsWith(".png"))).toBe(true);
    expect(new Set(Object.values(COMBAT_VFX_ASSETS)).size).toBe(13);
  });

  it("exhaustively maps the 276 archetype abilities and every current combat skill", () => {
    const ids = skillIds();
    const archetypeIds = ids.filter((id) => (
      id !== "blade-of-curse"
      && ARCHETYPE_PREFIXES.some((prefix) => id.startsWith(prefix))
    ));
    expect(archetypeIds).toHaveLength(276);
    expect(Object.keys(COMBAT_VFX_SKILL_REGISTRY)).toEqual(ids);

    const visuals = ids.map((skillId) => combatVfxVariantForSkill(skillId));
    visuals.forEach(expectCanvasVisual);
    expect(new Set(visuals.map((visual) => visual.signatureKey)).size).toBe(visuals.length);

    const slash = combatVfxVariantForSkill("blade-slash");
    expect(slash.asset).toBeNull();
    expect(slash.asset).not.toBe(resolveTowAbilityArt(getSkill("blade-slash")));
  });

  it("authors the forward-compatible ability aliases named by the implementation plan", () => {
    const visuals = Object.values(COMBAT_VFX_PLANNED_SKILL_REGISTRY);
    expect(visuals).toHaveLength(141);
    visuals.forEach(expectCanvasVisual);
    expect(combatVfxVariantForSkill("mage-chain-lightning").choreography).toBe("lightning-fork");
    expect(combatVfxVariantForSkill("automaton-orbital-laser").choreography).toBe("orbital-pillar");
    expect(combatVfxVariantForSkill("blade-thousand-cuts").choreography).toBe("strike-combo");
  });

  it("separates the Last Assassin execution line from every knife-storm contact", () => {
    const execution = combatVfxVariantForSkill("assassin-execution");
    const storm = combatVfxVariantForSkill("assassin-storm-of-knives");
    expectCanvasVisual(execution);
    expectCanvasVisual(storm);
    expect(execution).toMatchObject({ choreography: "execution-line", motion: "execution" });
    expect(storm).toMatchObject({ choreography: "knife-combo", motion: "volley" });
    expect(execution.signatureKey).not.toBe(storm.signatureKey);

    const hits = Array.from({ length: 4 }, (_, index) => combatVfxForHit(storm, index, 4));
    expect(hits.map((visual) => visual.choreography)).toEqual([
      "knife-left", "knife-right", "knife-thrust", "knife-cross",
    ]);
    expect(new Set(hits.map((visual) => visual.signatureKey)).size).toBe(4);
  });

  it("gives the Desolate Vampire semantic motion and keeps Thorn out of the claw family", () => {
    expect(combatVfxVariantForSkill("vampire-claw").choreography).toBe("claw-trails");
    expect(combatVfxVariantForSkill("vampire-blood-spear").choreography).toBe("blood-lance");
    expect(combatVfxVariantForSkill("vampire-heart-destroyer").choreography).toBe("heart-pierce");
    expect(combatVfxVariantForSkill("vampire-blood-whirlwind").choreography).toBe("blood-maelstrom");

    const rampage = combatVfxVariantForSkill("vampire-rampage");
    expect(Array.from({ length: 4 }, (_, index) => combatVfxForHit(rampage, index, 4).choreography))
      .toEqual(["blood-sweep-left", "blood-sweep-right", "blood-lance", "blood-backflow"]);

    const thorn = combatVfxForStatus("thorn");
    expect(thorn).toMatchObject({
      family: "nature",
      choreography: "thorn-growth",
      palette: { primary: "#7bd88f", secondary: "#3a8043", shadow: "#183e1c" },
    });
    expect(thorn.family).not.toBe("gash");
    expect(thorn.choreography).not.toContain("claw");
  });

  it("renders persistent damage as procedural status choreography", () => {
    const tickCases = [
      [{ voidMonster: 12 }, "void", "void-tendrils"],
      [{ hellfireSpirit: 20 }, "fire", "hellfire-rise"],
      [{ delayedDamage: 666 }, "void", "fate-clock"],
      [{ forbiddenRitual: true }, "void", "forbidden-glyph"],
    ];
    for (const [detail, family, choreography] of tickCases) {
      expect(combatVfxForEvent({}, { type: "tick-damage", ...detail })).toMatchObject({
        family,
        choreography,
        asset: null,
        assetSource: "canvas",
      });
    }
  });

  it("gives every active status canvas choreography while retaining icon metadata", () => {
    const types = statusTypes();
    const visuals = types.map((status) => combatVfxForStatus(status));
    for (const [index, visual] of visuals.entries()) {
      expectCanvasVisual(visual);
      expect(visual.variant).toBe(`status-${types[index]}`);
      expect(visual.iconAsset).toMatch(/\.(?:png|webp)$/);
      expect(visual.iconPosition).toMatch(/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/);
    }
    expect(new Set(visuals.map((visual) => visual.signatureKey)).size).toBe(visuals.length);
    expect(new Set(visuals.map((visual) => `${visual.iconAsset}#${visual.iconPosition}`)).size)
      .toBe(visuals.length);
    expect(combatVfxForStatus("bleed").choreography).toBe("blood-drip");
    expect(combatVfxForStatus("bleed-atk").choreography).toBe("wound-rip");
    expect(combatVfxForStatus("stun").choreography).toBe("impact-stagger");
  });

  it("gives every weapon form an authored, canvas-native lineage", () => {
    const forms = [
      ["measured-cut", "slash", "single-sweep"],
      ["threefold-cut", "gash", "strike-combo"],
      ["pinning-arrow", "pierce", "binding-lines"],
      ["cinder-mark", "fire", "ember-sweep"],
      ["forked-bolt", "lightning", "lightning-fork"],
    ];
    for (const [formId, family, choreography] of forms) {
      const visual = combatVfxVariantForForm(formId);
      expectCanvasVisual(visual);
      expect(visual).toMatchObject({ family, choreography });
    }
  });

  it("keeps full ability art on declared enemy intent, not on the battlefield effect", () => {
    expect(combatVfxForIntent({ attackId: "foe-jab", name: "Jab", hits: 1 })).toMatchObject({
      family: "pierce",
      assetSource: "intent-art",
    });
    const dance = combatVfxForIntent({
      attackId: "enemy-blade-katana-dance",
      skillId: "blade-katana-dance",
      name: "Katana Dance",
      hits: 3,
    });
    expect(dance.asset).toBe(resolveTowAbilityArt(getSkill("blade-katana-dance")));
    expect(dance.asset).toContain("blade-katana-dance-v1.webp");

    const attack = combatVfxForEvent({
      enemyAttacks: { foe: [{ id: "storm-flurry", name: "Storm Flurry", hits: 3 }] },
    }, {
      type: "enemy-attack", enemyId: "foe", attackId: "storm-flurry", hits: [{}, {}, {}],
    });
    expect(attack).toMatchObject({ asset: null, assetSource: "canvas", motion: "multi" });
    expect(canvasSupportsChoreography(attack.choreography)).toBe(true);
  });

  it("gives hybrid abilities distinct impact, ward, and status phases", () => {
    expect(combatVfxForEvent({}, {
      type: "skill-damage", skillId: "sleepless-flame-curtain",
    })).toMatchObject({ family: "fire", choreography: "curtain-rise" });
    expect(combatVfxForEvent({}, {
      type: "skill-shield", skillId: "sleepless-flame-curtain",
    })).toMatchObject({ family: "ward", choreography: "ward-arc" });
    expect(combatVfxForEvent({}, {
      type: "skill-status", skillId: "sleepless-flame-curtain", status: "burn",
    })).toMatchObject({ family: "fire", choreography: "flame-rise" });
  });
});
