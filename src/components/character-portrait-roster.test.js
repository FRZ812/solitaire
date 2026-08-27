import { describe, expect, it } from "vitest";
import { CAPTIVE_POOL } from "../data/slaves.js";
import { COMPANION_LIST } from "../data/companions.js";
import { PRISONER_POOL, WANTED_POOL } from "../data/gaol.js";
import { MOUNT_LIST } from "../data/mounts.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import { STARTING_ARCHETYPES } from "../gameplay/tow/starting-archetypes.js";
import {
  CHARACTER_PORTRAIT_CATEGORY_COUNTS,
  CHARACTER_PORTRAIT_IDENTITIES,
  CHARACTER_PORTRAIT_IDENTITY_BY_KEY,
  characterPortraitIdentityKey,
} from "./character-portrait-roster.js";

describe("complete authored character portrait roster", () => {
  it("locks the exhaustive roster while explicitly allowing named missing-art fallbacks", () => {
    expect(CHARACTER_PORTRAIT_IDENTITIES).toHaveLength(162);
    expect(new Set(CHARACTER_PORTRAIT_IDENTITIES.map(({ key }) => key)).size).toBe(162);
    expect(CHARACTER_PORTRAIT_IDENTITIES.reduce((sum, entry) => sum + entry.requiredVariants, 0)).toBe(219);
    expect(Object.keys(CHARACTER_PORTRAIT_IDENTITY_BY_KEY)).toHaveLength(162);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["wanted:eel"].requiredVariants).toBe(0);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["wanted:crows"].requiredVariants).toBe(0);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["template:velvet-courtier"].requiredVariants).toBe(1);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["companion:tomkin"].requiredVariants).toBe(1);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["bonded:rurik"].requiredVariants).toBe(0);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["bonded:loff"].requiredVariants).toBe(1);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["wanted:redhand"].requiredVariants).toBe(1);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["wanted:vane"].requiredVariants).toBe(1);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["codex:heron-archivist-isera"].requiredVariants).toBe(0);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["codex:whitemarch-apothecary-tavia-vane"].requiredVariants).toBe(1);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["codex:selenyan-moonbough-irelwen"].requiredVariants).toBe(1);
    expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY["codex:old-root-ritualist-velisse"].requiredVariants).toBe(2);
    for (const id of ["elske", "garran", "linnet"]) {
      expect(CHARACTER_PORTRAIT_IDENTITY_BY_KEY[`companion:${id}`].requiredVariants).toBe(0);
    }
  });

  it("covers every stable authored source pool exactly once", () => {
    expect(CHARACTER_PORTRAIT_CATEGORY_COUNTS).toEqual({
      "fixed-codex": 23,
      "repurposed-codex": 8,
      "regional-establishment": 10,
      "portrait-candidate-codex": 29,
      "playable-template": CHARACTER_TEMPLATES.length,
      "tow-archetype": STARTING_ARCHETYPES.length,
      companion: COMPANION_LIST.length,
      "bonded-captive": CAPTIVE_POOL.length,
      "gaol-prisoner": PRISONER_POOL.length,
      "wanted-person": WANTED_POOL.length,
      mount: MOUNT_LIST.length,
      "fixed-codex-special": 1,
    });
  });

  it("resolves stable keys independently of day-stamped acquisition IDs", () => {
    expect(characterPortraitIdentityKey({ id: "bonded-harl-3", kind: "bonded" })).toBe("bonded:harl");
    expect(characterPortraitIdentityKey({ id: "bonded-loff-19", kind: "bonded" })).toBe("bonded:loff");
    expect(characterPortraitIdentityKey({ id: "senna", portraitKey: "companion:senna" })).toBe("companion:senna");
    expect(characterPortraitIdentityKey({ id: "senna", kind: "companion" })).toBe("companion:senna");
    expect(characterPortraitIdentityKey({ id: "wanted-redhand" })).toBe("wanted:redhand");
    expect(characterPortraitIdentityKey({ id: "dragon", kind: "mount" })).toBe("mount:dragon");
    expect(characterPortraitIdentityKey({ id: "demon-king" })).toBe("codex:demon-king");
    expect(characterPortraitIdentityKey({ id: "whitemarch-deed-keeper-ilyra" })).toBe("codex:whitemarch-deed-keeper-ilyra");
    expect(characterPortraitIdentityKey({ id: "whitemarch-apothecary-tavia-vane" })).toBe("codex:whitemarch-apothecary-tavia-vane");
    expect(characterPortraitIdentityKey({ id: "wanderer" })).toBeNull();
  });
});
