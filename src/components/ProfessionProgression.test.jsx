import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  professionTreeGraph,
  professionTreeStartNodeId,
} from "../data/profession-tree.js";
import { PROFESSIONS } from "../data/professions.js";
import {
  compileProfessionTrack,
  compileRacialTrack,
  professionBranchChoices,
  progressionXpForLevel,
  RACIAL_PROFILES,
  racialBranchChoices,
} from "../data/progression-paths.js";
import { createProgression } from "../engine/progression.js";
import {
  ProfessionTreePage,
  RacialProgression,
  RaceTreePage,
  UnifiedProfessionTree,
} from "./ProfessionProgression.jsx";

function characterWithProfession(professionId, { allocatedLevel = 1, earnedLevel = allocatedLevel } = {}) {
  const progression = createProgression({ professionId, raceId: "human", level: allocatedLevel });
  progression.xp = progressionXpForLevel(earnedLevel);
  return { race: "human", profession: professionId, attributes: {}, progression };
}

function nodeButton(html, nodeId) {
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<button[^>]*data-node-id="${escaped}"[^>]*>`))?.[0] || "";
}

describe("unified profession tree", () => {
  it("renders every profession and node together in one connected constellation", () => {
    const character = characterWithProfession("fighter");
    const html = renderToStaticMarkup(<ProfessionTreePage state={{ character }} />);

    expect(html).toContain("Unified profession skill tree");
    expect(html).toContain("All professions · one connected constellation");
    expect(html).toContain("Follow any connected line, split into several directions");
    expect(html).toContain("0 unspent points · 1 / 70 invested · unified skill tree");
    expect(html.match(/data-node-id="profession:/g)).toHaveLength(2030);
    expect(html.match(/data-start="true"/g)).toHaveLength(29);

    expect(nodeButton(html, professionTreeStartNodeId("fighter"))).toContain('data-node-state="owned"');
    expect(nodeButton(html, "profession:fighter:node:1")).toContain('data-node-state="frontier"');
    expect(nodeButton(html, professionTreeStartNodeId("barbarian"))).toContain('data-node-state="locked"');
    expect(nodeButton(html, professionTreeStartNodeId("ruler"))).toContain('data-node-state="locked"');
    expect(nodeButton(html, professionTreeStartNodeId("wizard"))).toContain('data-node-state="locked"');

    expect(html).not.toContain("Choose a profession tree");
    expect(html).not.toContain("← All professions");
  });

  it("marks every connected direction spendable when a level point is waiting", () => {
    const character = characterWithProfession("fighter", { allocatedLevel: 1, earnedLevel: 2 });
    const html = renderToStaticMarkup(<UnifiedProfessionTree character={character} />);
    const availableButtons = html.match(/<button[^>]*data-node-state="available"[^>]*>/g) || [];

    expect(availableButtons).toHaveLength(6);
    expect(nodeButton(html, "profession:fighter:node:1")).toContain('data-node-state="available"');
    expect(nodeButton(html, "profession:fighter:node:6")).toContain('data-node-state="available"');
    expect(nodeButton(html, professionTreeStartNodeId("barbarian"))).toContain('data-node-state="locked"');
    expect(nodeButton(html, professionTreeStartNodeId("ruler"))).toContain('data-node-state="locked"');
    expect(nodeButton(html, professionTreeStartNodeId("wanderer"))).toContain('data-node-state="locked"');
    expect(nodeButton(html, professionTreeStartNodeId("wizard"))).toContain('data-node-state="locked"');
    expect(html).toContain("Spendable frontier");
  });

  it("exposes searchable pan-and-zoom controls and keyboard-readable nodes in SSR", () => {
    const html = renderToStaticMarkup(<UnifiedProfessionTree character={characterWithProfession("wizard")} />);
    const nodeButtons = html.match(/<button[^>]*data-node-id="profession:[^"]+"[^>]*>/g) || [];

    expect(html).toContain('aria-label="Profession tree controls"');
    expect(html).toContain("Find any profession or skill");
    expect(html).toContain('role="combobox" aria-autocomplete="list" aria-expanded="false"');
    expect(html).toContain('id="profession-tree-search-results"');
    expect(html).toContain('placeholder="Wizard, medicine, Perfect Hunt…"');
    expect(html).toContain('aria-label="Zoom out profession tree"');
    expect(html).toContain('aria-label="Profession tree zoom"');
    expect(html).toContain('aria-label="Zoom in profession tree"');
    expect(html).toContain(">Fit tree</button>");
    expect(html).toContain(">My start</button>");
    expect(html).toContain('role="region" aria-label="Pan and zoom unified profession skill tree"');
    expect(html).toContain('aria-describedby="profession-tree-instructions"');
    expect(html).toContain("Arrow keys move between connected nodes and Home returns to your starting profession");

    expect(nodeButtons).toHaveLength(2030);
    expect(nodeButtons.every((button) => button.includes("aria-label=") && button.includes("aria-pressed=") && button.includes("tabindex="))).toBe(true);
    expect(nodeButtons.filter((button) => button.includes('tabindex="0"'))).toHaveLength(1);
  });

  it("maps all 29 profession tracks and every authored branch gate into the shared graph", () => {
    const graph = professionTreeGraph();
    const professionIds = Object.keys(PROFESSIONS);
    let authoredNodeCount = 0;
    let authoredChoiceCount = 0;
    let authoredOptionCount = 0;

    expect(graph.nodes).toHaveLength(2030);
    expect([...graph.startNodes.keys()]).toHaveLength(29);
    expect(graph.bridgeNodeIds.size).toBeGreaterThan(100);
    expect(professionIds).toHaveLength(29);

    for (const professionId of professionIds) {
      const rows = compileProfessionTrack(professionId).levels;
      const nodes = graph.professionNodes.get(professionId);
      const definitions = professionBranchChoices(professionId);

      expect(nodes, professionId).toHaveLength(70);
      expect(rows, professionId).toHaveLength(70);
      expect(rows.map((row) => row.trackLevel), professionId).toEqual(
        Array.from({ length: 70 }, (_, index) => index + 1),
      );
      expect(nodes.map((node) => node.localIndex + 1), professionId).toEqual(rows.map((row) => row.trackLevel));
      expect(rows.every((row) => row.feature), professionId).toBe(true);
      const authoredRows = rows.filter((row) => row.authoredContent);
      expect([0, 70], `${professionId} mixes authored and fallback nodes`).toContain(authoredRows.length);
      expect(authoredRows.every((row) => row.featureDescription), professionId).toBe(true);
      authoredNodeCount += authoredRows.length;

      authoredChoiceCount += definitions.length;
      authoredOptionCount += definitions.reduce((sum, definition) => sum + (definition.options || []).length, 0);
      for (const definition of definitions) {
        const gateNode = nodes[definition.threshold - 1];
        expect(gateNode.choiceIds, `${professionId}/${definition.id}`).toContain(definition.id);
        expect(gateNode.isChoiceGate, `${professionId}/${definition.id}`).toBe(true);
      }
    }

    expect(authoredNodeCount).toBe(1120);
    expect(graph.nodes.filter((node) => node.isChoiceGate).length).toBeGreaterThan(0);
    expect(graph.nodes.reduce((sum, node) => sum + node.choiceIds.length, 0)).toBe(authoredChoiceCount);
    expect(graph.nodes.reduce((sum, node) => sum + node.choiceOptionCount, 0)).toBe(authoredOptionCount);
  });
});

describe("dedicated race tree", () => {
  it("surfaces the character's lineage as a dedicated 30-node Race panel", () => {
    const character = {
      race: "vampire",
      progression: {
        version: 2,
        professions: [],
        racial: { raceId: "vampire", evolutionId: "lesser-vampire", paths: { "vampire-awakening": 8 } },
      },
    };
    const html = renderToStaticMarkup(<RaceTreePage state={{ character }} />);

    expect(html).toContain("<h3>Race</h3>");
    expect(html).toContain("Race tree · 0–30");
    expect(html).toContain("<h2>Vampire</h2>");
    expect(html).toContain("8 allocated · 0 available");
    expect(html.match(/class="progression-tree__node/g)).toHaveLength(30);
    expect(html).toContain("Scrollable Vampire lineage tree");
    expect(html).not.toContain("Unified profession skill tree");
  });

  it("makes every catalogued ancestry browseable with its complete authored track and nested branches", () => {
    for (const [raceId, profile] of Object.entries(RACIAL_PROFILES)) {
      const compiled = compileRacialTrack(raceId);
      const definitions = racialBranchChoices(raceId);
      const html = renderToStaticMarkup(
        <RacialProgression character={null} raceId={raceId} onBack={() => {}} />,
      );

      expect(compiled.levels, raceId).toHaveLength(30);
      expect(compiled.levels.map((row) => row.level), raceId).toEqual(
        Array.from({ length: 30 }, (_, index) => index + 1),
      );
      expect(html, raceId).toContain(`<h2>${profile.name}</h2>`);
      expect(html, raceId).toContain("Levels 1–30");
      expect(html.match(/class="progression-tree__node/g), raceId).toHaveLength(30);
      expect(html, raceId).toContain("Center-out node tree");
      expect(html, raceId).toContain("Racial level 10");
      expect(html, raceId).toContain("Racial level 20");

      const root = definitions.find((definition) => !definition.parentChoiceId);
      expect(root, `${raceId} is missing its level-10 root branch`).toBeTruthy();
      for (const definition of definitions) {
        expect(html, `${raceId}/${definition.id} is missing from the detail view`).toContain(`data-choice-id="${definition.id}"`);
        if (definition.parentChoiceId) {
          expect(html, `${raceId}/${definition.id} lost its nested branch relationship`).toContain(
            `data-parent-choice="${definition.parentChoiceId}"`,
          );
        }
      }

      expect(html, raceId).toContain('aria-label="Racial level 30 attributes"');
      expect(html, raceId).toContain("Racial track projection");
      expect(html, raceId).toContain("Level 30 attributes");
      expect(html, raceId).toContain("Before profession levels");
      expect(html, raceId).toContain("← Race tree");
      expect(html, raceId).not.toContain("← All professions");
      expect(html, raceId).not.toContain("Power tier");
      expect(html, raceId).not.toMatch(/>(?:Epic|Legendary|Mythical|Divine)</);
    }
  });

  it("shows every authored racial level, metamorphosis, and nested branch in the dedicated tree", () => {
    const compiled = compileRacialTrack("vampire");
    const paths = {};
    for (const row of compiled.levels.slice(0, 20)) paths[row.pathId] = row.rank;
    const character = {
      race: "vampire",
      progression: {
        version: 2,
        professions: [],
        racial: { raceId: "vampire", evolutionId: "lesser-vampire", paths, branchChoices: {} },
      },
    };
    const html = renderToStaticMarkup(<RacialProgression character={character} onBack={() => {}} />);

    expect(html).toContain("Race tree · 0–30");
    expect(html).toContain("Levels 1–30");
    expect(html).toContain("Lesser Vampire");
    expect(html).toContain("True Vampire");
    expect(html).toContain("Evolution branches");
    expect(html).toContain("Racial level 10");
    expect(html).toContain("Blood Sovereign");
    expect(html).toContain("Night Stalker");
    expect(html).toContain("Corpse Lord");
    expect(html).toContain("Racial level 20");
    expect(html).toContain("Choice required");
    expect(html).toContain('aria-label="Racial level 30 attributes"');
    expect(html).toContain("Before profession levels");
    expect(html).toContain("← Race tree");
    expect(html).not.toContain("← All professions");
  });
});
