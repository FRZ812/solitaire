import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressionChoiceModal } from "./ProgressionChoiceModal.jsx";

describe("ProgressionChoiceModal", () => {
  it("renders a required nested specialization choice with typed rewards", () => {
    const html = renderToStaticMarkup(
      <ProgressionChoiceModal
        choice={{
          id: "necromancy-method",
          professionId: "wizard",
          threshold: 35,
          name: "Choose a necromantic discipline",
          description: "Your school now divides into a deeper practice.",
          breadcrumbs: ["Wizard", "Necromancy", "Death Magic"],
          options: [
            {
              id: "drain",
              name: "Vital Drain",
              description: "Turn death magic toward theft and restoration.",
              grants: [{ type: "ability", id: "life-drain" }],
              nextChoices: ["drain-mastery"],
            },
            {
              id: "instant-kill",
              name: "Final Word",
              grants: [{ type: "metamagic", id: "piercing-signature" }],
            },
          ],
        }}
        onChoose={() => {}}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Wizard · Profession level 35");
    expect(html).toContain("Wizard</li><li>Necromancy</li><li>Death Magic");
    expect(html).toContain("Vital Drain");
    expect(html).toContain("Life Drain");
    expect(html).toContain("Piercing Signature");
    expect(html).toContain("Unlocks later branch choices");
    expect(html).toContain("This decision is not made automatically");
    expect(html).not.toContain("Close");
  });

  it("renders nothing without a pending choice", () => {
    expect(renderToStaticMarkup(<ProgressionChoiceModal choice={null} onChoose={() => {}} />)).toBe("");
  });

  it("renders an earned character level as a race-or-profession allocation", () => {
    const html = renderToStaticMarkup(
      <ProgressionChoiceModal
        choice={{
          id: "level-allocation-18",
          kind: "level-allocation",
          level: 18,
          name: "Allocate level 18",
          description: "Choose racial evolution or one specific profession track for this earned level.",
          options: [
            { optionId: "racial:evolution", track: "racial", name: "Evolve Human", description: "Invest one rank in racial evolution." },
            { optionId: "profession:wizard", track: "profession", name: "Advance Wizard", description: "Invest one rank in Wizard." },
          ],
        }}
        onChoose={() => {}}
      />,
    );

    expect(html).toContain("Character progression · Character level 18");
    expect(html).toContain("Racial level");
    expect(html).toContain("Profession level");
    expect(html).toContain("Evolve Human");
    expect(html).toContain("Advance Wizard");
    expect(html).toContain("Invest this earned level in one racial or profession track");
    expect(html).not.toContain("disabled");
  });

  it("keeps multi-pick progress visible and prevents choosing the same spell twice", () => {
    const html = renderToStaticMarkup(
      <ProgressionChoiceModal
        choice={{
          id: "sorcerer-spell-constellation",
          kind: "grant",
          type: "ability-choice",
          name: "Spell Constellation",
          options: ["fireball", "chain-lightning", "frost-lance"],
          selectedOptions: ["fireball"],
          remainingCount: 1,
        }}
        onChoose={() => {}}
      />,
    );

    expect(html).toContain("Spell choice");
    expect(html).toContain("A burst of flame that sears and ignites every foe.");
    expect(html).toMatch(/<button[^>]*class="is-selected"[^>]*disabled=""[^>]*aria-pressed="true"[^>]*>[\s\S]*?Fireball[\s\S]*?Selected/);
    expect(html).toContain("1 selection remaining");
  });

  it("labels and explains metamagic choices from the authored catalog", () => {
    const html = renderToStaticMarkup(
      <ProgressionChoiceModal
        choice={{
          id: "sorcerer-metamagic-1",
          kind: "grant",
          type: "metamagic-choice",
          name: "Shape innate magic",
          options: ["empowered-signature", "subtle-signature"],
        }}
        onChoose={() => {}}
      />,
    );

    expect(html).toContain("Metamagic choice");
    expect(html).toContain("Empowered Signature");
    expect(html).toContain("Increase the force of the chosen signature spell.");
    expect(html).toContain("Subtle Signature");
    expect(html).not.toContain("Specialization branch");
  });
});
