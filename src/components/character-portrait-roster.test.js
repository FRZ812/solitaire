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
  it("locks the exhaustive 112-identity, 224-variant production boundary", () => {
    expect(CHARACTER_PORTRAIT_IDENTITIES).toHaveLength(112);
    expect(new Set(CHARACTER_PORTRAIT_IDENTITIES.map(({ key }) => key)).size).toBe(112);
    expect(CHARACTER_PORTRAIT_IDENTITIES.every(({ requiredVariants }) => requiredVariants === 2)).toBe(true);
    expect(CHARACTER_PORTRAIT_IDENTITIES.reduce((sum, entry) => sum + entry.requiredVariants, 0)).toBe(224);
    expect(Object.keys(CHARACTER_PORTRAIT_IDENTITY_BY_KEY)).toHaveLength(112);
  });

  it("covers every stable authored source pool exactly once", () => {
    expect(CHARACTER_PORTRAIT_CATEGORY_COUNTS).toEqual({
      "fixed-codex": 23,
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
    expect(characterPortraitIdentityKey({ id: "wanderer" })).toBeNull();
  });
});
