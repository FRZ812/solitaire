import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import { ArsenalView, arsenalAbilityGroups } from "./ArsenalView.jsx";
import { InventoryView } from "./InventoryView.jsx";

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

describe("inventory and arsenal atlas integration", () => {
  it("uses normalized equipment silhouettes for empty paper-doll slots", () => {
    const html = renderToStaticMarkup(<InventoryView state={makeInitialState()} />);
    expect(html).toContain('data-icon-key="equipment:trinket"');
    expect(html).toContain('data-icon-key="equipment:head"');
    expect(html).toContain('data-icon-key="equipment:sword"');
    expect(html).toContain('data-icon-key="equipment:shield"');
  });

  it("exposes category filters and generated nonmagic ability art", () => {
    const html = renderToStaticMarkup(<ArsenalView state={makeInitialState()} />);
    expect(html).toContain('aria-label="Technique categories"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-icon-key="category:martial"');
    expect(html).toContain('data-icon-key="category:social"');
    expect(html).not.toContain("ability-icon__category\">M");
  });

  it("surfaces a mage template's combat magic as spells with established mastery", () => {
    const korvane = CHARACTER_TEMPLATES.find((template) => template.id === "enchanter-tyrant");
    const state = makeInitialState();
    state.character = {
      ...state.character,
      abilities: korvane.setup.abilities,
      proficiencies: korvane.setup.proficiencies,
      proficiencyGrowthMult: 1.25,
    };

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);
    expect(groups.spells.map((ability) => ability.id)).toEqual(["dominate", "charm", "meteor", "time-stop", "dispel"]);
    expect(korvane.setup.proficiencies.spellcasting).toBe(1350);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Techniques &amp; core actions · 3");
    expect(html).toContain("Spells · 5");
    expect(html).toContain('data-tier="divine"');
    expect(html).toContain("<span>Spellcasting</span><strong>16</strong>");
  });

  it("surfaces selected Sorcerer repertoire and authored utility modes", () => {
    const state = singularSavantState();
    const groups = arsenalAbilityGroups(state.character);

    expect(groups.spells.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "firebolt", "combust", "lightning-bolt",
    ]));

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Spells · 3");
    expect(html).toContain('aria-label="Earned progression capabilities"');
    expect(html).toContain("Primary signature");
    expect(html).toContain("Subtle Signature");
    expect(html).toContain("ordinary voice, gesture, and harmless sensory display");
    expect(html).toContain("Triggered Signature");
    expect(html).toContain("only one triggered signature may be held at once");
    expect(html).toContain("Signature Utility Mode");
    expect(html).toContain("Reframe Signature");
  });
});
