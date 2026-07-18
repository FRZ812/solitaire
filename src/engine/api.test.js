import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { buildStateContext } from "./api.js";
import { applyBeat } from "./beat.js";

function singularSavantState() {
  const state = makeInitialState();
  const metamagicIds = ["empowered-signature", "quickened-signature", "piercing-signature"];
  metamagicIds[6] = "subtle-signature";
  metamagicIds[7] = "triggered-signature";
  state.character.abilities = [];
  state.character.progression = {
    version: 2,
    professions: [{
      professionId: "sorcerer",
      levels: 30,
      branchChoices: {
        "sorcerous-focus": "singular-savant",
        "singular-savant-discipline": "mutable-signature",
      },
      choices: {
        signatureSpellId: "firebolt",
        metamagicIds,
        grantSelections: {
          "sorcerer-secondary-spell": ["combust"],
          "sorcerer-tertiary-spell": ["lightning-bolt"],
        },
      },
    }],
    racial: null,
  };
  return state;
}

describe("narrator party context", () => {
  it("lists top-level party members with ids usable by narrator actions", () => {
    const recruited = applyBeat(
      { ...makeInitialState(), created: true },
      { recruit_companion: { id: "bram" } },
    );

    const context = buildStateContext(recruited);

    expect(context).toContain("[COMPANIONS — travelling with you: Bram Holt (id: bram;");
    expect(context).toContain("use their listed id in party_removals");
  });

  it("includes progression spells and exact noncombat metamagic effects", () => {
    const context = buildStateContext(singularSavantState());

    expect(context).toContain("[ABILITIES KNOWN — Spells (magic): Firebolt, Combust, Lightning Bolt]");
    expect(context).toContain("Firebolt [primary signature] = Subtle Signature, Triggered Signature");
    expect(context).toContain("Subtle Signature — Suppress the signature spell's ordinary voice, gesture, and harmless sensory display");
    expect(context).toContain("Triggered Signature — Delay one prepared signature cast behind a declared observable trigger and short duration");
    expect(context).toContain("Signature Utility Mode — Express one harmless bounded property of the signature as a practical effect");
    expect(context).toContain("Reframe Signature — Exchange a bounded targeting or area property for a learned utility mode");
  });

  it("surfaces Bard abilities as non-spell performances", () => {
    const state = makeInitialState();
    state.character.abilities = [];
    state.character.progression = {
      version: 2,
      professions: [{
        professionId: "bard",
        levels: 12,
        branchChoices: { "bard-performance-path": "war-singer" },
        choices: {},
      }],
      racial: null,
    };

    const context = buildStateContext(state);

    expect(context).toContain("[ABILITIES KNOWN — Performances (non-spell): Clarion Note, Steady Beat, War Drum, Cutting Verse]");
    expect(context).not.toContain("Spells (magic): Clarion Note");
  });

  it("surfaces Ranger abilities as non-spell fieldcraft", () => {
    const state = makeInitialState();
    state.character.abilities = [];
    state.character.progression = {
      version: 2,
      professions: [{
        professionId: "ranger",
        levels: 12,
        branchChoices: { "ranger-field-practice": "hunter" },
        choices: {},
      }],
      racial: null,
    };

    const context = buildStateContext(state);

    expect(context).toContain("[ABILITIES KNOWN — Fieldcraft (non-spell): Quarry Sign, Ranging Shot, Patient Aim, Field Dressing]");
    expect(context).not.toContain("Spells (magic): Quarry Sign");
    expect(context).not.toContain("Techniques: Quarry Sign");
  });

  it("surfaces Rogue abilities as non-spell subterfuge", () => {
    const state = makeInitialState();
    state.character.abilities = [];
    state.character.progression = {
      version: 2,
      professions: [{
        professionId: "rogue",
        levels: 12,
        branchChoices: { "rogue-practice": "infiltrator" },
        choices: {},
      }],
      racial: null,
    };

    const context = buildStateContext(state);

    expect(context).toContain("[ABILITIES KNOWN — Subterfuge (non-spell): Assess Mark, Testing Cut, Silent Entry, Slip the Line]");
    expect(context).not.toContain("Spells (magic): Assess Mark");
    expect(context).not.toContain("Techniques: Assess Mark");
  });

  it("surfaces Paladin abilities as non-spell oathcraft", () => {
    const state = makeInitialState();
    state.character.abilities = [];
    state.character.progression = {
      version: 2,
      professions: [{
        professionId: "paladin",
        levels: 12,
        branchChoices: { "paladin-oath": "shield-oath" },
        choices: {},
      }],
      racial: null,
    };

    const context = buildStateContext(state);

    expect(context).toContain("[ABILITIES KNOWN — Oathcraft (non-spell): Oathguard, Vowed Strike, Shield Covenant, Stand Fast]");
    expect(context).not.toContain("Spells (magic): Oathguard");
    expect(context).not.toContain("Techniques: Oathguard");
  });

  it("surfaces Circle of Root abilities as first-class primal spellwork", () => {
    const state = makeInitialState();
    state.character.abilities = [];
    state.character.progression = {
      version: 2,
      professions: [{
        professionId: "druid",
        levels: 12,
        branchChoices: { "druid-circle": "circle-of-root" },
        choices: {},
      }],
      racial: null,
    };

    const context = buildStateContext(state);

    expect(context).toContain("[ABILITIES KNOWN — Primal Arts (primal spellwork): Verdant Spark, Sunlance, Grove Awakening, Leafrot]");
    expect(context).not.toContain("Spells (magic): Verdant Spark");
    expect(context).not.toContain("Techniques: Verdant Spark");
  });

  it("surfaces Demon Warlock abilities as first-class pact spellwork", () => {
    const state = makeInitialState();
    state.character.abilities = [];
    state.character.progression = {
      version: 2,
      professions: [{
        professionId: "warlock",
        levels: 12,
        branchChoices: { "warlock-pact": "demon-warlock" },
        choices: {},
      }],
      racial: null,
    };

    const context = buildStateContext(state);

    expect(context).toContain("[ABILITIES KNOWN — Pact Arts (pact spellwork): Tithe Bolt, Debt Mark, Hellfire Covenant, Favor's Rebuke]");
    expect(context).not.toContain("Spells (magic): Tithe Bolt");
    expect(context).not.toContain("Techniques: Tithe Bolt");
  });

  it("surfaces Runesmith abilities as first-class prepared devicecraft", () => {
    const state = makeInitialState();
    state.character.abilities = [];
    state.character.progression = {
      version: 2,
      professions: [{
        professionId: "artificer",
        levels: 12,
        branchChoices: { "artificer-workshop": "runesmith" },
        choices: {},
      }],
      racial: null,
    };

    const context = buildStateContext(state);

    expect(context).toContain("[ABILITIES KNOWN — Devices (prepared devicecraft): Snapfire Capsule, Field Refit, Inscribed Ward, Guard Projector]");
    expect(context).not.toContain("Spells (magic): Snapfire Capsule");
    expect(context).not.toContain("Techniques: Snapfire Capsule");
  });
});
