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
  it("registers exactly the canonical portrait roster with two distinct assets per identity", () => {
    const registeredKeys = Object.keys(CHARACTER_PORTRAIT_VARIANTS).sort();
    const canonicalKeys = CHARACTER_PORTRAIT_IDENTITIES.map(({ key }) => key).sort();
    expect(registeredKeys).toEqual(canonicalKeys);

    for (const variants of Object.values(CHARACTER_PORTRAIT_VARIANTS)) {
      expect(Object.isFrozen(variants)).toBe(true);
      expect(variants).toHaveLength(2);
      expect(variants[0]).not.toBe(variants[1]);
    }

    expect(CHARACTER_PORTRAIT_VARIANTS["codex:demon-king"][0]).toContain("codex-individual/demon-king.webp");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:demon-king"][1]).toContain("demon-king-portrait-v2.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:knight"][0]).toContain("knight-portrait-v3.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:knight"][1]).toContain("knight-portrait-v4.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:ranger"][0]).toContain("ranger-portrait-v4.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:ranger"][1]).toContain("ranger-portrait-v5.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:vampire"][0]).toContain("vampire-portrait-v3.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["tow:vampire"][1]).toContain("vampire-portrait-v4.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["companion:cray"][0]).toContain("mother-cray-portrait-v1.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["bonded:neela"][1]).toContain("neela-portrait-v2.png");
    expect(CHARACTER_PORTRAIT_VARIANTS["codex:threshold-voice"][1]).toContain("threshold-voice-portrait-v2.png");
  });

  it("registers the completed legacy identity pairs", () => {
    for (const templateId of [
      "court-envoy",
      "confidence-artist",
      "guild-advocate",
      "velvet-courtier",
      "dragon-hunter",
      "high-sorcerer",
    ]) {
      const record = { portraitKey: `template:${templateId}` };
      expect(portraitVariantsFor(record)).toHaveLength(2);
      expect(portraitVariantsFor(record)[0]).toContain(`${templateId}-grounded-v3.webp`);
      expect(portraitVariantsFor(record)[1]).toContain(`${templateId}-portrait-v2.png`);
    }
  });

  it("normalizes every stable runtime identity shape before looking up art", () => {
    expect(portraitIdentityKey({ id: "demon-king" })).toBe("codex:demon-king");
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
    const record = { id: "demon-king" };
    const token = createPortraitVariantToken(record, 2);
    expect(token).toBe("builtin:codex:demon-king:v2");
    expect(parsePortraitVariantToken(token)).toEqual({ identityKey: "codex:demon-king", variantNumber: 2 });
    expect(selectedPortraitVariantNumber(record, token)).toBe(2);
    expect(resolveCharacterPortrait(record, null, token)).toBe(CHARACTER_PORTRAIT_VARIANTS["codex:demon-king"][1]);

    const upload = "data:image/webp;base64,QUJDRA==";
    expect(selectedPortraitVariantNumber(record, upload)).toBeNull();
    expect(resolveCharacterPortrait(record, null, upload)).toBe(upload);

    expect(createPortraitVariantToken(record, 3)).toBeNull();
    expect(resolveCharacterPortrait(record, null, "builtin:tow:knight:v2")).toBe(CHARACTER_PORTRAIT_VARIANTS["codex:demon-king"][0]);
  });
});
