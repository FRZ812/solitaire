import { describe, expect, it } from "vitest";
import {
  TOW_COMBAT_CUTOUTS,
  combatPortraitTemplateId,
  resolveEnemyCombatCutout,
  resolvePlayerCombatCutout,
  resolveTowCombatArt,
} from "./tow-combat-art.js";

describe("Tower combat art", () => {
  it("maps every authored starter portrait to a background-free battle cutout", () => {
    const portraits = {
      "template:sellsword": "ironbound",
      "template:ranger": "wildstrider",
      "template:cutthroat": "gloamknife",
      "template:devout": "dawnwarden",
      "template:hedge-mage": "ashcaller",
      "template:champion-paladin": "oathforged",
      "template:shadowblade": "night-sovereign",
      "template:dragon-ascendant": "wyrm-ascendant",
    };

    for (const [portraitKey, cutoutId] of Object.entries(portraits)) {
      expect(resolvePlayerCombatCutout(portraitKey)).toBe(TOW_COMBAT_CUTOUTS[cutoutId]);
    }
  });

  it("recognises template keys without leaking their storage prefix", () => {
    expect(combatPortraitTemplateId("template:cutthroat")).toBe("cutthroat");
    expect(combatPortraitTemplateId("ranger")).toBe("ranger");
    expect(combatPortraitTemplateId(null)).toBe(null);
  });

  it("uses distinctive staged enemy art where the bestiary identity is known", () => {
    expect(resolveEnemyCombatCutout({ id: "foe", name: "Duellist" }))
      .toBe(TOW_COMBAT_CUTOUTS["duellist-foe"]);
    expect(resolveEnemyCombatCutout({ id: "foe", name: "Road brigand" }))
      .toBe(TOW_COMBAT_CUTOUTS["raider-foe"]);
    expect(resolveEnemyCombatCutout({ id: "foe", name: "Fabled beast" })).toBe(null);
  });

  it("keeps the player portrait binding separate from enemy fallback matching", () => {
    const actor = { id: "wanderer", name: "Ren Kairo", side: "player" };
    expect(resolveTowCombatArt(actor, {
      playerId: "wanderer",
      playerPortraitKey: "template:cutthroat",
    })).toBe(TOW_COMBAT_CUTOUTS.gloamknife);
  });
});
