import { describe, expect, it } from "vitest";
import {
  ABILITY_CATALOG,
  ABILITY_LIBRARY,
  abilityCategoryOf,
  abilityReqLine,
  abilityStatLine,
  getAbilityDef,
} from "../data/abilities.js";
import {
  ABILITY_CATEGORIES,
  abilityCategoryIdOf,
  abilityTaxonomy,
  magicSchoolIdOf,
} from "../data/ability-taxonomy.js";
import { cardDefinition } from "../data/combat-cards.js";

const GENERAL_IDS = Object.freeze([
  "warlock-tithe-bolt",
  "warlock-debt-mark",
  "warlock-favors-rebuke",
  "warlock-open-covenant",
  "warlock-owed-ward",
  "warlock-covenant-lash",
  "warlock-creditors-gaze",
  "warlock-claim-due",
  "warlock-ruinous-terms",
  "warlock-fivefold-collection",
  "warlock-black-bargain",
  "warlock-pact-apotheosis",
]);

const BRANCH_IDS = Object.freeze([
  "warlock-hellfire-covenant",
  "warlock-witch-mark",
  "warlock-pact-chain",
  "warlock-whispered-terms",
  "warlock-infernal-volley",
  "warlock-devils-due",
  "warlock-layered-hex",
  "warlock-sympathetic-token",
  "warlock-binding-links",
  "warlock-shared-burden",
  "warlock-secret-leverage",
  "warlock-open-bargain",
]);

const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

const RESOLVE_BY_ID = Object.freeze({
  "warlock-tithe-bolt": 3,
  "warlock-debt-mark": 3,
  "warlock-favors-rebuke": 4,
  "warlock-open-covenant": 4,
  "warlock-owed-ward": 4,
  "warlock-covenant-lash": 6,
  "warlock-creditors-gaze": 6,
  "warlock-claim-due": 8,
  "warlock-ruinous-terms": 8,
  "warlock-fivefold-collection": 10,
  "warlock-black-bargain": 12,
  "warlock-pact-apotheosis": 15,
  "warlock-hellfire-covenant": 4,
  "warlock-witch-mark": 4,
  "warlock-pact-chain": 4,
  "warlock-whispered-terms": 4,
  "warlock-infernal-volley": 6,
  "warlock-devils-due": 6,
  "warlock-layered-hex": 6,
  "warlock-sympathetic-token": 6,
  "warlock-binding-links": 6,
  "warlock-shared-burden": 6,
  "warlock-secret-leverage": 6,
  "warlock-open-bargain": 6,
});

const PRICE_BY_ID = Object.freeze({
  "warlock-tithe-bolt": { type: "health", maxHealth: 0.04, cap: 0.04, nonlethal: true },
  "warlock-open-covenant": { type: "exposure", incomingDamage: 0.15, cap: 0.20, duration: 2 },
  "warlock-covenant-lash": { type: "health", maxHealth: 0.06, cap: 0.06, nonlethal: true },
  "warlock-creditors-gaze": { type: "exposure", incomingDamage: 0.15, cap: 0.20, duration: 2 },
  "warlock-ruinous-terms": { type: "exposure", incomingDamage: 0.20, cap: 0.20, duration: 2 },
  "warlock-hellfire-covenant": { type: "health", maxHealth: 0.05, cap: 0.05, nonlethal: true },
  "warlock-witch-mark": { type: "exposure", incomingDamage: 0.15, cap: 0.20, duration: 2 },
  "warlock-pact-chain": { type: "health", maxHealth: 0.04, cap: 0.04, nonlethal: true },
  "warlock-whispered-terms": { type: "exposure", incomingDamage: 0.15, cap: 0.20, duration: 2 },
});

const COST_BY_ID = Object.freeze({
  "warlock-favors-rebuke": 1,
  "warlock-owed-ward": 1,
  "warlock-claim-due": 2,
  "warlock-fivefold-collection": 3,
  "warlock-black-bargain": 4,
  "warlock-pact-apotheosis": 5,
  "warlock-infernal-volley": 2,
  "warlock-devils-due": 2,
  "warlock-layered-hex": 2,
  "warlock-sympathetic-token": 2,
  "warlock-binding-links": 2,
  "warlock-shared-burden": 2,
  "warlock-secret-leverage": 2,
  "warlock-open-bargain": 2,
});

const EFFECT_BY_ID = Object.freeze({
  "warlock-tithe-bolt": null,
  "warlock-debt-mark": "warlockDebtMark",
  "warlock-favors-rebuke": "warlockFavorsRebuke",
  "warlock-open-covenant": "warlockOpenCovenant",
  "warlock-owed-ward": "warlockOwedWard",
  "warlock-covenant-lash": "warlockCovenantLash",
  "warlock-creditors-gaze": "warlockCreditorsGaze",
  "warlock-claim-due": "warlockClaimDue",
  "warlock-ruinous-terms": "warlockRuinousTerms",
  "warlock-fivefold-collection": null,
  "warlock-black-bargain": "warlockBlackBargain",
  "warlock-pact-apotheosis": "warlockPactApotheosis",
  "warlock-hellfire-covenant": "warlockHellfireCovenant",
  "warlock-witch-mark": "warlockWitchMark",
  "warlock-pact-chain": "warlockPactChain",
  "warlock-whispered-terms": "warlockWhisperedTerms",
  "warlock-infernal-volley": "warlockInfernalVolley",
  "warlock-devils-due": "warlockDevilsDue",
  "warlock-layered-hex": "warlockLayeredHex",
  "warlock-sympathetic-token": "warlockSympatheticToken",
  "warlock-binding-links": "warlockBindingLinks",
  "warlock-shared-burden": "warlockSharedBurden",
  "warlock-secret-leverage": "warlockSecretLeverage",
  "warlock-open-bargain": "warlockOpenBargain",
});

const TARGET_BY_ID = Object.freeze({
  "warlock-tithe-bolt": "enemy",
  "warlock-debt-mark": "enemy",
  "warlock-favors-rebuke": "enemy",
  "warlock-open-covenant": "self",
  "warlock-owed-ward": "self",
  "warlock-covenant-lash": "enemy",
  "warlock-creditors-gaze": "enemy",
  "warlock-claim-due": "enemy",
  "warlock-ruinous-terms": "all-enemies",
  "warlock-fivefold-collection": "enemy",
  "warlock-black-bargain": "all-allies",
  "warlock-pact-apotheosis": "all-enemies",
  "warlock-hellfire-covenant": "enemy",
  "warlock-witch-mark": "enemy",
  "warlock-pact-chain": "enemy",
  "warlock-whispered-terms": "enemy",
  "warlock-infernal-volley": "enemy",
  "warlock-devils-due": "enemy",
  "warlock-layered-hex": "enemy",
  "warlock-sympathetic-token": "enemy",
  "warlock-binding-links": "all-enemies",
  "warlock-shared-burden": "all-allies",
  "warlock-secret-leverage": "enemy",
  "warlock-open-bargain": "enemy",
});

const DAMAGE_IDS = Object.freeze([
  "warlock-tithe-bolt",
  "warlock-favors-rebuke",
  "warlock-covenant-lash",
  "warlock-claim-due",
  "warlock-ruinous-terms",
  "warlock-fivefold-collection",
  "warlock-pact-apotheosis",
  "warlock-hellfire-covenant",
  "warlock-infernal-volley",
  "warlock-devils-due",
  "warlock-sympathetic-token",
]);

describe("Warlock pactcraft independence", () => {
  it("defines exactly twelve general and twelve specialization-owned native cards", () => {
    const definitions = ABILITY_LIBRARY.filter(({ id }) => id.startsWith("warlock-"));
    expect(definitions.map(({ id }) => id)).toEqual(ALL_IDS);
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(24);
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive === true)).toBe(true);
    expect(ABILITY_CATALOG.filter(({ id }) => ALL_IDS.includes(id)).map(({ id }) => id)).toEqual(ALL_IDS);
  });

  it("classifies each native card as first-class Resolve-powered pact spellwork", () => {
    expect(ABILITY_CATEGORIES.pactcraft).toMatchObject({ id: "pactcraft", label: "Pactcraft", mark: "W" });
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "warlock",
        progressionExclusive: true,
        school: "pactcraft",
        warlockFavorMax: 5,
      });
      expect(definition.resolveCost, id).toBe(RESOLVE_BY_ID[id]);
      expect(definition.resolveCost, id).toBeGreaterThan(0);
      expect(definition.innate, id).toBeFalsy();
      expect(definition.magicSchool, id).toBeUndefined();
      expect(abilityCategoryOf(definition), id).toBe("pactcraft");
      expect(abilityCategoryIdOf(definition), id).toBe("pactcraft");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect(abilityTaxonomy(definition), id).toMatchObject({
        categoryId: "pactcraft",
        category: ABILITY_CATEGORIES.pactcraft,
        magicSchoolId: null,
        magicSchool: null,
        iconKey: "category:pactcraft",
      });
      expect(abilityStatLine(definition, definition.minTier || "common"), id).toContain(`${definition.resolveCost} resolve`);
      expect(cardDefinition(id, definition.minTier || "common"), id).toMatchObject({
        category: "pactcraft",
        categoryLabel: "Pactcraft",
        magicSchool: null,
        tradition: "pactcraft",
        resolveCost: RESOLVE_BY_ID[id],
      });
    }
  });

  it("earns at most one Favor only after a bounded concrete Pact Price is paid once", () => {
    expect(Object.keys(PRICE_BY_ID)).toHaveLength(9);
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      const price = PRICE_BY_ID[id];
      expect(definition.warlockPactPrice, id).toEqual(price);
      expect(definition.warlockFavorBuild, id).toBe(price ? 1 : undefined);
      expect(definition.warlockFavorBuildOnPaidPrice, id).toBe(price ? true : undefined);
      expect(definition.warlockPriceCommitOnce, id).toBe(price ? true : undefined);
      if (!price) continue;

      if (price.type === "health") {
        expect(price.maxHealth, id).toBeGreaterThan(0);
        expect(price.maxHealth, id).toBeLessThanOrEqual(0.06);
        expect(price.cap, id).toBe(price.maxHealth);
        expect(price.nonlethal, id).toBe(true);
      } else {
        expect(price, id).toMatchObject({ type: "exposure", duration: 2, cap: 0.20 });
        expect(price.incomingDamage, id).toBeGreaterThan(0);
        expect(price.incomingDamage, id).toBeLessThanOrEqual(price.cap);
      }

      const line = abilityStatLine(definition, definition.minTier || "common");
      expect(line, id).toContain("once");
      expect(line, id).toContain("builds 1 Pact Favor only after price is paid (max 5)");
    }
  });

  it("commits every Favor spend once for the whole action, including multihit paths", () => {
    expect(Object.keys(COST_BY_ID)).toHaveLength(14);
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      const cost = COST_BY_ID[id];
      expect(definition.warlockFavorCost, id).toBe(cost);
      expect(definition.warlockFavorCommitSpend, id).toBe(cost ? true : undefined);
      expect(Boolean(definition.warlockPactPrice) && Boolean(cost), id).toBe(false);
      if (cost) expect(abilityStatLine(definition, definition.minTier || "common"), id)
        .toContain(`cost ${cost} Pact Favor (committed once)`);
    }
    expect(getAbilityDef("warlock-fivefold-collection").hits).toBe(5);
    expect(getAbilityDef("warlock-infernal-volley").hits).toBe(2);
    expect(ALL_IDS.filter((id) => (getAbilityDef(id).hits || 1) > 1)).toEqual([
      "warlock-fivefold-collection",
      "warlock-infernal-volley",
    ]);
    expect(getAbilityDef("warlock-debt-mark").warlockPactPrice).toBeUndefined();
    expect(getAbilityDef("warlock-debt-mark").warlockFavorBuild).toBeUndefined();
    expect(getAbilityDef("warlock-debt-mark").warlockFavorCost).toBeUndefined();
  });

  it("locks native targets, effect identities, and ward-respecting magical damage", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition.target, id).toBe(TARGET_BY_ID[id]);
      expect(definition.effect?.type || null, id).toBe(EFFECT_BY_ID[id]);
      if (definition.effect) expect(definition.effect.type, id).toMatch(/^warlock[A-Z]/);
      if (DAMAGE_IDS.includes(id)) {
        expect(definition, id).toMatchObject({ damageType: "magical", scaling: "stat" });
        expect(definition.dmg?.length, id).toBe(2);
      } else {
        expect(definition, id).toMatchObject({ damageType: null, scaling: "none", dmg: null });
      }
      expect(definition, id).not.toHaveProperty("ignoreWard");
      expect(definition, id).not.toHaveProperty("trueDamage");
      expect(definition.damageType, id).not.toBe("true");
    }
  });

  it("keeps Demon Warlock to paid contracts and ward-respecting hellfire", () => {
    const hellfire = getAbilityDef("warlock-hellfire-covenant");
    expect(hellfire).toMatchObject({
      warlockPactPrice: { type: "health", maxHealth: 0.05, nonlethal: true },
      effect: { type: "warlockHellfireCovenant", scorch: 3, sourceOwned: true },
    });
    expect(getAbilityDef("warlock-infernal-volley")).toMatchObject({ hits: 2, warlockFavorCost: 2 });
    expect(getAbilityDef("warlock-devils-due")).toMatchObject({
      warlockFavorCost: 2,
      warlockRequiresOwnHellfireCovenant: true,
      effect: { type: "warlockDevilsDue", sourceOwned: true },
    });
    expect(abilityReqLine(getAbilityDef("warlock-devils-due"))).toContain("needs your active Hellfire Covenant on this target");
    for (const id of ["warlock-hellfire-covenant", "warlock-infernal-volley", "warlock-devils-due"]) {
      expect(getAbilityDef(id).damageType, id).toBe("magical");
      expect(getAbilityDef(id).innate, id).toBeFalsy();
    }
  });

  it("keeps Witch workings source-owned, crafted, and separate from Wizard study", () => {
    for (const id of ["warlock-witch-mark", "warlock-layered-hex", "warlock-sympathetic-token"]) {
      const definition = getAbilityDef(id);
      expect(definition.effect, id).toMatchObject({ sourceOwned: true });
      expect(definition.magicSchool, id).toBeUndefined();
      expect(definition.school, id).toBe("pactcraft");
      expect(definition, id).not.toHaveProperty("metamagic");
      expect(definition, id).not.toHaveProperty("spellbook");
    }
    expect(getAbilityDef("warlock-layered-hex").effect).toMatchObject({ hexPressure: 24, maxStacks: 2 });
    expect(getAbilityDef("warlock-sympathetic-token").requiresCarriedSympatheticToken).toBe(true);
    expect(abilityReqLine(getAbilityDef("warlock-sympathetic-token"))).toContain("needs a carried token genuinely linked to the target");
  });

  it("keeps Chainbinder links bounded without charm, domination, or allegiance rewriting", () => {
    expect(getAbilityDef("warlock-pact-chain").effect).toMatchObject({ chainPressure: 18, bossScale: 0.35, sourceOwned: true });
    expect(getAbilityDef("warlock-binding-links").effect).toMatchObject({ chainPressure: 25, bossScale: 0.35, sourceOwned: true });
    expect(getAbilityDef("warlock-shared-burden").effect).toMatchObject({ share: 0.20, cap: 0.08, sourceOwned: true });
    for (const id of ["warlock-pact-chain", "warlock-binding-links", "warlock-shared-burden"]) {
      const mechanical = { ...getAbilityDef(id), desc: undefined };
      expect(JSON.stringify(mechanical), id).not.toMatch(/charm|dominat|compuls|allegiance|hardControl/i);
    }
  });

  it("keeps Whisper Broker bargains audible, understood, voluntary, and soft", () => {
    const whisperIds = ["warlock-whispered-terms", "warlock-secret-leverage", "warlock-open-bargain"];
    for (const id of whisperIds) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        audible: true,
        requiresAwareness: true,
        requiresUnderstanding: true,
        effect: { voluntary: true, soft: true },
      });
      expect(abilityReqLine(definition), id).toContain("target must be aware");
      expect(abilityReqLine(definition), id).toContain("target must understand");
      const mechanical = { ...definition, desc: undefined };
      expect(JSON.stringify(mechanical), id).not.toMatch(/charm|dominat|compuls|allegiance/i);
    }
    expect(getAbilityDef("warlock-secret-leverage").requiresKnownSecret).toBe(true);
    expect(abilityReqLine(getAbilityDef("warlock-secret-leverage"))).toContain("needs a genuinely known relevant secret");
  });

  it("never borrows foreign resources or enables prohibited pact shortcuts", () => {
    const foreignMetadata = /^(?:warrior|monk|barbarian|bard|ranger|rogue|sorcerer|wizard|cleric|paladin|druid|artificer)/i;
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(Object.keys(definition).filter((key) => foreignMetadata.test(key)), id).toEqual([]);
      const mechanical = { ...definition, desc: undefined };
      expect(JSON.stringify(mechanical), id).not.toMatch(/instantKill|soulSteal|summon|conjureCreature|freeSummon/i);
      expect(definition, id).not.toHaveProperty("metamagic");
      expect(definition, id).not.toHaveProperty("signatureSpell");
      expect(definition, id).not.toHaveProperty("channelDivinity");
      expect(definition, id).not.toHaveProperty("druidSeason");
      expect(definition, id).not.toHaveProperty("paladinConvictionCost");
    }
  });
});
