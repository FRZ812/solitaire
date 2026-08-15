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
    expect(html).toContain('aria-label="Skill categories"');
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
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 3");
    expect(html).toContain("Spells · 5");
    expect(html).toContain('data-tier="divine"');
    expect(html).toContain("<span>Spellcasting</span><strong>16</strong>");
  });

  it("keeps a Knight archetype's real five-action Tower kit visible after creation", () => {
    const state = makeInitialState();
    state.character.progressionModel = "tow-archetype";
    state.mechanics = {
      ...state.mechanics,
      build: {
        traits: { ironclad: 3 },
        skills: ["arctic-strike", "arctic-block", "arctic-deliberate-blow", "arctic-incineration", "arctic-mortal-blow"],
        runes: [],
      },
    };
    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain('aria-label="Tower combat kit"');
    expect(html).toContain("Tower combat kit · 5");
    expect(html).toContain("Basic attack");
    expect(html).toContain("Defensive");
    expect(html).toContain("Archetype ability");
    expect(html).toContain("Burning Reprisal");
    expect(html).toContain("Mortal Blow");
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

  it("keeps Bard performances separate from spells and other techniques", () => {
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

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.performances.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "bard-clarion-note", "bard-steady-beat", "bard-war-drum", "bard-cutting-verse",
    ]));
    expect(groups.performances).toHaveLength(4);
    expect(groups.spells).toEqual([]);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Performance</span><strong>4</strong>");
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 7");
    expect(html).not.toContain("Spells · 4");
  });

  it("keeps Ranger fieldcraft separate from spells, performance, and generic techniques", () => {
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

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.fieldcraft.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "ranger-quarry-sign", "ranger-ranging-shot", "ranger-patient-aim", "ranger-field-dressing",
    ]));
    expect(groups.fieldcraft).toHaveLength(4);
    expect(groups.spells).toEqual([]);
    expect(groups.performances).toEqual([]);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Fieldcraft</span><strong>4</strong>");
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 7");
    expect(html).not.toContain("Spells · 4");
  });

  it("keeps Rogue subterfuge separate from spells and generic techniques", () => {
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

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.subterfuge.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "rogue-assess-mark", "rogue-testing-cut", "rogue-slip-the-line", "rogue-silent-entry",
    ]));
    expect(groups.subterfuge).toHaveLength(4);
    expect(groups.spells).toEqual([]);
    expect(groups.performances).toEqual([]);
    expect(groups.fieldcraft).toEqual([]);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Subterfuge</span><strong>4</strong>");
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 7");
    expect(html).not.toContain("Spells · 4");
  });

  it("keeps Paladin oathcraft separate from spells and generic techniques", () => {
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

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.oathcraft.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "paladin-oathguard", "paladin-vowed-strike", "paladin-shield-covenant", "paladin-stand-fast",
    ]));
    expect(groups.oathcraft).toHaveLength(4);
    expect(groups.spells).toEqual([]);
    expect(groups.performances).toEqual([]);
    expect(groups.fieldcraft).toEqual([]);
    expect(groups.subterfuge).toEqual([]);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Oathcraft</span><strong>4</strong>");
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 7");
    expect(html).not.toContain("Spells · 4");
  });

  it("surfaces Circle of Root spellwork as first-class Primal Arts", () => {
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

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.primalcraft.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "druid-verdant-spark", "druid-sunlance", "druid-grove-awakening", "druid-leafrot",
    ]));
    expect(groups.primalcraft).toHaveLength(4);
    expect(groups.spells).toEqual([]);
    expect(groups.performances).toEqual([]);
    expect(groups.fieldcraft).toEqual([]);
    expect(groups.subterfuge).toEqual([]);
    expect(groups.oathcraft).toEqual([]);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Primal Arts</span><strong>4</strong>");
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 7");
    expect(html).toContain("Primalcraft");
    expect(html).not.toContain("Spells · 4");
  });

  it("surfaces Demon Warlock spellwork as first-class Pact Arts", () => {
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

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.pactcraft.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "warlock-tithe-bolt", "warlock-debt-mark", "warlock-favors-rebuke", "warlock-hellfire-covenant",
    ]));
    expect(groups.pactcraft).toHaveLength(4);
    expect(groups.spells).toEqual([]);
    expect(groups.primalcraft).toEqual([]);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Pact Arts</span><strong>4</strong>");
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 7");
    expect(html).toContain("Pactcraft");
    expect(html).not.toContain("Spells · 4");
  });

  it("surfaces Runesmith works as first-class prepared Devices", () => {
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

    const groups = arsenalAbilityGroups(state.character);
    expect(groups.devicecraft.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      "artificer-snapfire-capsule", "artificer-field-refit", "artificer-guard-projector", "artificer-inscribed-ward",
    ]));
    expect(groups.devicecraft).toHaveLength(4);
    expect(groups.spells).toEqual([]);
    expect(groups.pactcraft).toEqual([]);
    expect(groups.techniques.map((ability) => ability.id)).toEqual(["basic-attack", "defend", "talk"]);

    const html = renderToStaticMarkup(<ArsenalView state={state} />);
    expect(html).toContain("Devices</span><strong>4</strong>");
    expect(html).toContain("Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · 7");
    expect(html).toContain("Devicecraft");
    expect(html).not.toContain("Spells · 4");
  });
});
