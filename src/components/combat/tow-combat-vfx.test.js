import { describe, expect, it } from "vitest";
import { skillIds } from "../../gameplay/tow/skills.js";
import {
  COMBAT_VFX_ASSETS,
  combatVfxForEvent,
  combatVfxForIntent,
  combatVfxVariantForForm,
  combatVfxVariantForSkill,
} from "./tow-combat-vfx.js";

describe("authored combat VFX", () => {
  it("has a transparent dedicated asset for every visual family", () => {
    expect(Object.keys(COMBAT_VFX_ASSETS).sort()).toEqual([
      "afflict", "arcane", "evade", "fire", "frost", "gash", "heal", "impact",
      "lightning", "pierce", "slash", "ward",
    ]);
    expect(Object.values(COMBAT_VFX_ASSETS).every((asset) => typeof asset === "string" && asset.length > 0)).toBe(true);
    expect(new Set(Object.values(COMBAT_VFX_ASSETS)).size).toBe(12);
  });

  it("gives every active ability an authored variant instead of a generic fallback", () => {
    expect(skillIds().filter((skillId) => !combatVfxVariantForSkill(skillId))).toEqual([]);
  });

  it("keeps weapon forms visually distinct within and across attack families", () => {
    expect(combatVfxVariantForForm("measured-cut")).toMatchObject({ family: "slash", variant: "measured-cut", motion: "measured" });
    expect(combatVfxVariantForForm("threefold-cut")).toMatchObject({ family: "gash", variant: "threefold-cut", motion: "flurry" });
    expect(combatVfxVariantForForm("pinning-arrow")).toMatchObject({ family: "pierce", variant: "pinning-arrow", motion: "pin" });
    expect(combatVfxVariantForForm("cinder-mark")).toMatchObject({ family: "fire", variant: "cinder-mark", motion: "brand" });
    expect(combatVfxVariantForForm("forked-bolt")).toMatchObject({ family: "lightning", variant: "forked-bolt", motion: "fork" });
  });

  it("derives enemy intent and attack art from the declared move", () => {
    expect(combatVfxForIntent({ attackId: "foe-jab", name: "Jab", hits: 1 })).toMatchObject({ family: "pierce" });
    expect(combatVfxForIntent({ attackId: "heavy-smash", name: "Heavy Smash", hits: 1 })).toMatchObject({ family: "impact" });
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
