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

  it("keeps full-bleed ability-card art out of character-anchored foreground VFX", () => {
    const visuals = skillIds().map((skillId) => combatVfxVariantForSkill(skillId));
    expect(visuals.filter((visual) => !visual)).toEqual([]);
    expect(visuals.every((visual) => visual.asset.endsWith(".png"))).toBe(true);
    expect(visuals.every((visual) => ["family", "dedicated"].includes(visual.assetSource))).toBe(true);
    expect(visuals.every((visual) => !Object.hasOwn(visual, "signatureAsset"))).toBe(true);

    const slash = combatVfxVariantForSkill("blade-slash");
    expect(slash).toMatchObject({ asset: COMBAT_VFX_ASSETS.slash, assetSource: "family" });
    expect(slash.asset).not.toBe(resolveTowAbilityArt(getSkill("blade-slash")));
  });

  it("separates the Last Assassin execution impact from the multi-hit knife storm", () => {
    const execution = combatVfxVariantForSkill("assassin-execution");
    const storm = combatVfxVariantForSkill("assassin-storm-of-knives");
    expect(execution.asset).toContain("assassin-execution-vfx-v1.png");
    expect(storm.asset).toContain("assassin-storm-of-knives-vfx-v1.png");
    expect(execution.asset).not.toBe(storm.asset);
    expect(execution.motion).toBe("execution");
    expect(storm.motion).toBe("volley");
  });

  it("renders persistent damage with transparent effect families instead of source-skill cards", () => {
    const tickCases = [
      [{ voidMonster: 12 }, "arcane"],
      [{ hellfireSpirit: 20 }, "fire"],
      [{ delayedDamage: 666 }, "afflict"],
      [{ forbiddenRitual: true }, "arcane"],
    ];
    for (const [detail, family] of tickCases) {
      const visual = combatVfxForEvent({}, { type: "tick-damage", ...detail });
      expect(visual).toMatchObject({ family, asset: COMBAT_VFX_ASSETS[family], assetSource: "family" });
      expect(visual.asset).not.toContain("abilities/");
    }
  });

  it("gives Whirlwind wind-pressure VFX without floating its square ability card", () => {
    const whirlwind = combatVfxVariantForSkill("north-king-whirlwind");
    expect(whirlwind).toMatchObject({
      family: "wind",
      variant: "north-king-whirlwind",
      motion: "cyclone",
    });
    expect(whirlwind.asset).toBe(COMBAT_VFX_ASSETS.wind);
    expect(whirlwind.asset).not.toBe(COMBAT_VFX_ASSETS.slash);
    expect(whirlwind).not.toHaveProperty("signatureAsset");
  });

  it("gives every active status an icon-ready transparent effect", () => {
    for (const status of statusTypes()) {
      expect(combatVfxForStatus(status), status).toMatchObject({
        asset: expect.stringMatching(/\.png$/),
        iconAsset: expect.stringMatching(/\.(?:png|webp)$/),
        iconPosition: expect.stringMatching(/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/),
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
    expect(combatVfxVariantForForm("measured-cut").asset).toBe(COMBAT_VFX_ASSETS.slash);
    expect(combatVfxVariantForForm("threefold-cut").asset).toBe(COMBAT_VFX_ASSETS.gash);
    expect(combatVfxVariantForForm("pinning-arrow").asset).toBe(COMBAT_VFX_ASSETS.pierce);
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
