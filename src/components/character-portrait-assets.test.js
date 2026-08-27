import { describe, expect, it } from "vitest";
import {
  CHARACTER_PORTRAIT_VARIANTS,
  createPortraitVariantToken,
  parsePortraitVariantToken,
  portraitIdentityKey,
  portraitVariantsFor,
  resolveCharacterPortrait,
  selectedPortraitVariantNumber,
} from "./character-portrait-assets.js";
import { CHARACTER_PORTRAIT_IDENTITIES } from "./character-portrait-roster.js";

describe("character portrait variants", () => {
  it("registers the requested portrait count for every canonical identity", () => {
    const registeredKeys = Object.keys(CHARACTER_PORTRAIT_VARIANTS).sort();
    const canonicalKeys = CHARACTER_PORTRAIT_IDENTITIES.map(({ key }) => key).sort();
    expect(registeredKeys).toEqual(canonicalKeys);

    for (const identity of CHARACTER_PORTRAIT_IDENTITIES) {
      const variants = CHARACTER_PORTRAIT_VARIANTS[identity.key];
      expect(Object.isFrozen(variants)).toBe(true);
      expect(variants, identity.key).toHaveLength(identity.requiredVariants);
      expect(new Set(variants).size).toBe(variants.length);
    }

    expect(CHARACTER_PORTRAIT_VARIANTS["codex:demon-king"]).toHaveLength(1);
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:demon-king"][0]).toContain("codex-individual/demon-king.webp");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:whitemarch-treasurer-halen"][0]).toContain("whitemarch-treasurer-halen-portrait-v3.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:whitemarch-deed-keeper-ilyra"][0]).toContain("whitemarch-treasurer-halen-portrait-v2.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:whitemarch-apothecary-tavia-vane"][0]).toContain("whitemarch-apothecary-tavia-vane-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:wintermere-amber-cup-astrid"][0]).toContain("wintermere-amber-cup-astrid-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:selenyan-moonbough-irelwen"][0]).toContain("selenyan-moonbough-irelwen-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:king-of-three"][0]).toContain("king-of-three-portrait-v2.png");
    expect(Object.values(CHARACTER_PORTRAIT_VARIANTS).flat().join("\n")).not.toContain("king-of-three-portrait-v3.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:knight"][0]).toContain("knight-portrait-v3.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:knight"][1]).toContain("knight-portrait-v4.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:ranger"][0]).toContain("ranger-portrait-v4.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:ranger"][1]).toContain("ranger-portrait-v5.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:vampire"][0]).toContain("vampire-portrait-v3.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:vampire"][1]).toContain("vampire-portrait-v4.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["companion:cray"][0]).toContain("mother-cray-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["bonded:neela"][0]).toContain("neela-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["wanted:vane"]).toHaveLength(1);
    expect(CHARACTER_PORTRAIT_VARIANTS["wanted:vane"][0]).toContain("goodwife-vane-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:threshold-voice"][1]).toContain("threshold-voice-portrait-v2.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["wanted:eel"]).toEqual([]);
    expect(CHARACTER_PORTRAIT_VARIANTS["wanted:crows"]).toEqual([]);
    expect(resolveCharacterPortrait({ id: "wanted-eel" }, null)).toBeNull();
    expect(CHARACTER_PORTRAIT_VARIANTS["template:velvet-courtier"]).toHaveLength(1);
    expect(CHARACTER_PORTRAIT_VARIANTS["template:velvet-courtier"][0]).toContain("velvet-courtier-portrait-v3.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["companion:tomkin"][0]).toContain("tomkin-burr-portrait-v2.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["bonded:rurik"]).toEqual([]);
    expect(CHARACTER_PORTRAIT_VARIANTS["bonded:loff"][0]).toContain("loff-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["wanted:redhand"][0]).toContain("red-hand-mott-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:heron-archivist-isera"]).toEqual([]);
    for (const id of ["elske", "garran", "linnet"]) {
      expect(CHARACTER_PORTRAIT_VARIANTS[`companion:${id}`]).toEqual([]);
    }
  });

  it("registers the completed legacy identity pairs", () => {
    for (const templateId of [
      "court-envoy",
      "confidence-artist",
      "guild-advocate",
      "dragon-hunter",
      "high-sorcerer",
    ]) {
      const record = { portraitKey: `template:${templateId}` };
      expect(portraitVariantsFor(record)).toHaveLength(2);
      expect(portraitVariantsFor(record)[0]).toContain(`${templateId}-grounded-v3.webp`);
      expect(portraitVariantsFor(record)[1]).toContain(`${templateId}-portrait-v2.png`);
    }
    expect(portraitVariantsFor({ portraitKey: "template:velvet-courtier" })).toHaveLength(1);
  });

  it("normalizes every stable runtime identity shape before looking up art", () => {
    expect(portraitIdentityKey({ id: "demon-king" })).toBe("codex:demon-king");
    expect(portraitIdentityKey({ id: "whitemarch-deed-keeper-ilyra" })).toBe("codex:whitemarch-deed-keeper-ilyra");
    expect(portraitIdentityKey({ id: "whitemarch-apothecary-tavia-vane" })).toBe("codex:whitemarch-apothecary-tavia-vane");
    expect(portraitIdentityKey({ portraitKey: "template:sellsword" })).toBe("template:sellsword");
    expect(portraitIdentityKey({ templateId: "sellsword" })).toBe("template:sellsword");
    expect(portraitIdentityKey({ portraitKey: "tow:knight" })).toBe("tow:knight");
    expect(portraitIdentityKey({ portraitKey: "tow:arctic-knight" })).toBe("tow:knight");
    expect(portraitIdentityKey({ portraitKey: "companion:bram" })).toBe("companion:bram");
    expect(portraitIdentityKey({ portraitKey: "bonded:harl" })).toBe("bonded:harl");
    expect(portraitIdentityKey({ id: "bonded-harl-17" })).toBe("bonded:harl");
    expect(portraitIdentityKey({ portraitKey: "mount:pony" })).toBe("mount:pony");
    expect(portraitIdentityKey({ id: "pony", kind: "mount" })).toBe("mount:pony");
    expect(portraitVariantsFor({ id: "bonded-harl-17" })).toBe(CHARACTER_PORTRAIT_VARIANTS["bonded:harl"]);
  });

  it("stores built-in choices as stable identity tokens and still accepts uploads", () => {
    const record = { id: "knight", portraitKey: "tow:knight" };
    const token = createPortraitVariantToken(record, 2);
    expect(token).toBe("builtin:tow:knight:v2");
    expect(parsePortraitVariantToken(token)).toEqual({ identityKey: "tow:knight", variantNumber: 2 });
    expect(selectedPortraitVariantNumber(record, token)).toBe(2);
    expect(resolveCharacterPortrait(record, null, token)).toBe(CHARACTER_PORTRAIT_VARIANTS["tow:knight"][1]);

    const upload = "data:image/webp;base64,QUJDRA==";
    expect(selectedPortraitVariantNumber(record, upload)).toBeNull();
    expect(resolveCharacterPortrait(record, null, upload)).toBe(upload);

    expect(createPortraitVariantToken(record, 3)).toBeNull();
    const demonKing = { id: "demon-king" };
    expect(createPortraitVariantToken(demonKing, 2)).toBeNull();
    expect(resolveCharacterPortrait(demonKing, null, "builtin:codex:demon-king:v2"))
      .toBe(CHARACTER_PORTRAIT_VARIANTS["codex:demon-king"][0]);
  });
});
