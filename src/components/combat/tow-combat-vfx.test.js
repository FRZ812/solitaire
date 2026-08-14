import { describe, expect, it } from "vitest";
import { getSkill, skillIds } from "../../gameplay/tow/skills.js";
import { statusTypes } from "../../gameplay/kernel/status-stack.js";
import { resolveTowAbilityArt } from "./tow-combat-ability-art.js";
import {
  COMBAT_VFX_ASSETS,
  combatVfxForEvent,
  combatVfxForIntent,
  combatVfxForStatus,
  combatVfxVariantForForm,
  combatVfxVariantForSkill,
} from "./tow-combat-vfx.js";

describe("authored combat VFX", () => {
  it("has a transparent dedicated asset for every visual family", () => {
    expect(Object.keys(COMBAT_VFX_ASSETS).sort()).toEqual([
      "afflict", "arcane", "evade", "fire", "frost", "gash", "heal", "impact",
      "lightning", "pierce", "slash", "ward", "wind",
    ]);
    expect(Object.values(COMBAT_VFX_ASSETS).every((asset) => asset.endsWith(".png"))).toBe(true);
    expect(Object.values(COMBAT_VFX_ASSETS).every((asset) => !asset.includes("svg"))).toBe(true);
    expect(new Set(Object.values(COMBAT_VFX_ASSETS)).size).toBe(13);
  });

  it("gives every active ability its own generated signature over a raster VFX family", () => {
    const visuals = skillIds().map((skillId) => combatVfxVariantForSkill(skillId));
    expect(visuals.filter((visual) => !visual)).toEqual([]);
    expect(visuals.every((visual) => visual.asset.endsWith(".png"))).toBe(true);
    expect(visuals.every((visual) => /\.(?:png|webp)$/.test(visual.signatureAsset))).toBe(true);
    expect(visuals.every((visual) => !visual.asset.includes("svg") && !visual.signatureAsset.includes("svg"))).toBe(true);
    expect(new Set(visuals.map((visual) => visual.signatureAsset)).size).toBe(visuals.length);
  });

  it("makes Whirlwind a wind-pressure signature without the shared slash decal", () => {
    const whirlwind = combatVfxVariantForSkill("north-king-whirlwind");
    expect(whirlwind).toMatchObject({
      family: "wind",
      variant: "north-king-whirlwind",
      motion: "cyclone",
    });
    expect(whirlwind.asset).toBe(COMBAT_VFX_ASSETS.wind);
    expect(whirlwind.asset).not.toBe(COMBAT_VFX_ASSETS.slash);
    expect(whirlwind.signatureAsset).toContain("north-king-whirlwind-v1.webp");
  });

  it("gives every active status an icon-ready transparent effect", () => {
    for (const status of statusTypes()) {
      expect(combatVfxForStatus(status), status).toMatchObject({
        asset: expect.stringMatching(/\.png$/),
        iconAsset: expect.stringMatching(/\.png$/),
        iconPosition: expect.stringMatching(/^(?:0|100)% (?:0|100)%$/),
        family: expect.any(String),
        variant: `status-${status}`,
      });
    }
    const icons = statusTypes().map((status) => {
      const visual = combatVfxForStatus(status);
      return `${visual.iconAsset}#${visual.iconPosition}`;
    });
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("keeps weapon forms visually distinct within and across attack families", () => {
    expect(combatVfxVariantForForm("measured-cut")).toMatchObject({ family: "slash", variant: "measured-cut", motion: "measured" });
    expect(combatVfxVariantForForm("threefold-cut")).toMatchObject({ family: "gash", variant: "threefold-cut", motion: "flurry" });
    expect(combatVfxVariantForForm("pinning-arrow")).toMatchObject({ family: "pierce", variant: "pinning-arrow", motion: "pin" });
    expect(combatVfxVariantForForm("cinder-mark")).toMatchObject({ family: "fire", variant: "cinder-mark", motion: "brand" });
    expect(combatVfxVariantForForm("forked-bolt")).toMatchObject({ family: "lightning", variant: "forked-bolt", motion: "fork" });
    const formSignatures = ["measured-cut", "crossing-cuts", "threefold-cut", "pinning-arrow", "forked-bolt"]
      .map((formId) => combatVfxVariantForForm(formId).signatureAsset);
    expect(new Set(formSignatures).size).toBe(formSignatures.length);
  });

  it("derives enemy intent and attack art from the declared move", () => {
    expect(combatVfxForIntent({ attackId: "foe-jab", name: "Jab", hits: 1 })).toMatchObject({ family: "pierce" });
    expect(combatVfxForIntent({ attackId: "heavy-smash", name: "Heavy Smash", hits: 1 })).toMatchObject({ family: "impact" });
    const dance = combatVfxForIntent({
      attackId: "enemy-blade-katana-dance",
      skillId: "blade-katana-dance",
      name: "Katana Dance",
      hits: 3,
    });
    expect(dance.asset).toBe(resolveTowAbilityArt(getSkill("blade-katana-dance")));
    expect(dance.asset).toContain("blade-katana-dance-v1.webp");
    expect(dance.asset).not.toContain("svg");
    expect(combatVfxForEvent({
      enemyAttacks: { foe: [{ id: "storm-flurry", name: "Storm Flurry", hits: 3 }] },
    }, {
      type: "enemy-attack", enemyId: "foe", attackId: "storm-flurry", hits: [{}, {}, {}],
    })).toMatchObject({ family: "lightning", variant: "enemy-storm-flurry", motion: "multi" });
  });

  it("gives hybrid abilities distinct impact, ward, and status phases", () => {
    expect(combatVfxForEvent({}, {
      type: "skill-damage", skillId: "sleepless-flame-curtain",
    })).toMatchObject({ family: "fire", variant: "sleepless-flame-curtain" });
    expect(combatVfxForEvent({}, {
      type: "skill-shield", skillId: "sleepless-flame-curtain",
    })).toMatchObject({ family: "ward", variant: "sleepless-flame-curtain-ward" });
    expect(combatVfxForEvent({}, {
      type: "skill-status", skillId: "sleepless-flame-curtain", status: "burn",
    })).toMatchObject({ family: "fire", variant: "sleepless-flame-curtain-burn" });
  });
});
