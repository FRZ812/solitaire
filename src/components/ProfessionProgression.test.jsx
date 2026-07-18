import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { professionBranchChoices, progressionXpForLevel } from "../data/progression-paths.js";
import { createProgression } from "../engine/progression.js";
import { ProgressionPage, ProgressionPanel } from "./ProfessionProgression.jsx";

function characterAt({ professionId = "fighter", allocatedLevel = 1, earnedLevel = allocatedLevel, raceId = "human" } = {}) {
  const progression = createProgression({ professionId, raceId, level: allocatedLevel });
  progression.xp = progressionXpForLevel(earnedLevel);
  return { race: raceId, profession: professionId, attributes: {}, progression };
}

describe("compact character progression", () => {
  it("combines profession advancement, multiclassing, and lineage in one lightweight panel", () => {
    const character = characterAt({ allocatedLevel: 9, earnedLevel: 10 });
    const html = renderToStaticMarkup(
      <ProgressionPage state={{ character }} onChooseProgression={() => {}} />,
    );

    expect(html).toContain("<h3>Progression</h3>");
    expect(html).toContain('data-game-icon="progression"');
    expect(html).toContain("1 advancement ready · 9 allocated");
    expect(html).toContain('aria-label="Current character progression"');
    expect(html).toContain("Warrior</strong><b>9</b>");
    expect(html).toContain("Human</strong><b>0</b>");
    expect(html).toContain("Warrior 9 → 10");
    expect(html).toContain('aria-label="Choose a new profession to multiclass"');
    expect(html.match(/<option /g)).toHaveLength(28);
    expect(html).toContain("Lineage</small><strong>Human 0 → 1");
    expect(html).toContain('aria-label="Take Warrior level 10"');

    expect(html).not.toContain("<svg");
    expect(html).not.toContain("data-node-id");
    expect(html).not.toContain("profession-tree");
    expect(html).not.toContain("progression-tree");
    expect(html).not.toContain("pan and zoom");
    expect(html).not.toContain("Find any profession");
  });

  it("keeps detailed track information closed until requested", () => {
    const html = renderToStaticMarkup(
      <ProgressionPanel character={characterAt({ professionId: "wizard", allocatedLevel: 4, earnedLevel: 5 })} onChooseProgression={() => {}} />,
    );

    expect(html).toContain('aria-expanded="false">View details</button>');
    expect(html).toContain("Next ·");
    expect(html).not.toContain('aria-label="Character progression details"');
    expect(html).not.toContain("Level 70 attributes");
    expect(html).not.toContain("full track projection");
  });

  it("replaces allocation with the compact required decision when a branch is pending", () => {
    const branch = professionBranchChoices("fighter")[0];
    const character = characterAt({ allocatedLevel: branch.threshold, earnedLevel: branch.threshold + 1 });
    const html = renderToStaticMarkup(
      <ProgressionPanel character={character} onChooseProgression={() => {}} />,
    );

    expect(html).toContain(branch.name);
    for (const option of branch.options) expect(html).toContain(option.name);
    expect(html).toContain("Warrior decision");
    expect(html).not.toContain("Choose your advancement");
    expect(html).not.toContain('aria-label="Choose a new profession to multiclass"');
  });

  it("shows a quiet current state with an optional details action when no point is waiting", () => {
    const html = renderToStaticMarkup(
      <ProgressionPage state={{ character: characterAt({ allocatedLevel: 6 }) }} onChooseProgression={() => {}} />,
    );

    expect(html).toContain("6 allocated · details available");
    expect(html).toContain("Progression is current");
    expect(html).toContain("Your next choice appears here when you level up.");
    expect(html).toContain('aria-expanded="false">View details</button>');
    expect(html).not.toContain("Choose your advancement");
  });
});
