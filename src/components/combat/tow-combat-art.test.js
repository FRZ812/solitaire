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

  it("maps every legacy Tower id to its generalized archetype portrait", () => {
    const characterIds = [
      "arctic-knight",
      "demon-slayer",
      "owner-of-clocktower",
      "old-king-of-northland",
      "sleepless-one",
      "last-assassin",
      "witch-of-eternity",
      "tenacious-mage",
      "exiled-priestess",
      "wandering-blade",
      "desolate-vampire",
      "forsaken-automaton",
    ];
    const resolved = characterIds.map((id) => resolvePlayerCombatCutout(`tow:${id}`));
    expect(resolved).toEqual(characterIds.map((id) => TOW_COMBAT_CUTOUTS[id]));
    expect(new Set(resolved).size).toBe(characterIds.length);
  });

  it("maps all canonical modular archetypes without colliding with template portraits", () => {
    const ids = [
      "knight", "ranger", "artificer", "berserker", "sorcerer", "rogue",
      "warlock", "wizard", "paladin", "blademaster", "vampire", "automaton",
    ];
    const resolved = ids.map((id) => resolvePlayerCombatCutout(`tow:${id}`));
    expect(resolved).toEqual(ids.map((id) => TOW_COMBAT_CUTOUTS[id]));
    expect(new Set(resolved).size).toBe(ids.length);
    expect(resolvePlayerCombatCutout("template:ranger")).toBe(TOW_COMBAT_CUTOUTS.wildstrider);
    expect(resolvePlayerCombatCutout("tow:ranger")).toBe(TOW_COMBAT_CUTOUTS.ranger);
  });

  it("ships the normalized painterly v2 portrait cohort in every modular slot", () => {
    const expectedFiles = {
      knight: "knight-portrait-v2.png",
      ranger: "ranger-portrait-v3.png",
      artificer: "artificer-portrait-v2.png",
      berserker: "berserker-portrait-v2.png",
      sorcerer: "sorcerer-portrait-v2.png",
      rogue: "rogue-portrait-v2.png",
      warlock: "warlock-portrait-v2.png",
      wizard: "wizard-portrait-v2.png",
      paladin: "paladin-portrait-v2.png",
      blademaster: "blademaster-portrait-v2.png",
      vampire: "vampire-portrait-v2.png",
      automaton: "automaton-portrait-v2.png",
    };

    for (const [id, fileName] of Object.entries(expectedFiles)) {
      expect(String(TOW_COMBAT_CUTOUTS[id])).toMatch(new RegExp(`${fileName.replace(".", "\\.")}$`));
    }
  });

  it("gives legacy companions a half-body cutout from their profession", () => {
    expect(resolvePlayerCombatCutout(null, { name: "Kestrel", profession: "ranger" }))
      .toBe(TOW_COMBAT_CUTOUTS.wildstrider);
  });

  it("recognises template keys without leaking their storage prefix", () => {
    expect(combatPortraitTemplateId("template:cutthroat")).toBe("cutthroat");
    expect(combatPortraitTemplateId("tow:arctic-knight")).toBe("arctic-knight");
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
