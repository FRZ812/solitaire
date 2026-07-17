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
});
