import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import {
  buildNarratorContextCandidates,
  candidateTypeCounts,
} from "./context-candidates.js";
import { selectNarratorContext, turnSubjectIds } from "./context-selection.js";

function campaign(overrides = {}) {
  const state = makeInitialState();
  return {
    ...state,
    created: true,
    character: {
      ...state.character,
      name: "Wanderer",
      conditions: ["Bleeding"],
      ...(overrides.character || {}),
    },
    world: {
      ...state.world,
      codex: {
        ...state.world.codex,
        characters: {
          hale: { id: "hale", name: "Hale", role: "toll-keeper", description: "Remembers a slight." },
          marsh: { id: "marsh", name: "Marsh", description: "Sells rope." },
          ...(overrides.characters || {}),
        },
      },
      quests: overrides.quests ?? [
        { id: "q1", status: "active", title: "The missing cart", giver: "Hale", giverId: "hale", summary: "Find it." },
        { id: "q2", status: "done", title: "Old business" },
      ],
    },
    party: overrides.party ?? [],
    memories: overrides.memories ?? ["The player burned the bridge.", "Hale saw it."],
  };
}

describe("what a campaign offers", () => {
  it("produces a record of every kind the state actually has", () => {
    const counts = candidateTypeCounts(buildNarratorContextCandidates(campaign()));
    expect(counts.player).toBe(1);
    expect(counts.place).toBe(1);
    expect(counts.person).toBe(2);
    expect(counts.quest).toBe(1);
    expect(counts.condition).toBe(1);
    expect(counts.memory).toBe(2);
  });

  it("gives each person their own record, so a scene can pull exactly who is in it", () => {
    // This is the whole reason for splitting the monolith: one string cannot be asked who
    // it is about.
    const records = buildNarratorContextCandidates(campaign());
    const hale = records.find((entry) => entry.id === "person:hale");
    expect(hale.subjectIds).toEqual(["hale"]);
    expect(hale.text).toContain("Hale");
    expect(hale.text).toContain("toll-keeper");
  });

  it("ranks a travelling companion above someone met once", () => {
    const records = buildNarratorContextCandidates(campaign({ party: ["hale"] }));
    const hale = records.find((entry) => entry.id === "person:hale");
    const marsh = records.find((entry) => entry.id === "person:marsh");
    expect(hale.priority).toBeGreaterThan(marsh.priority);
  });

  it("carries only live quests", () => {
    const records = buildNarratorContextCandidates(campaign());
    expect(records.filter((entry) => entry.type === "quest").map((entry) => entry.id))
      .toEqual(["quest:q1"]);
  });

  it("attributes a quest to the people it involves", () => {
    const quest = buildNarratorContextCandidates(campaign())
      .find((entry) => entry.id === "quest:q1");
    expect(quest.subjectIds).toContain("hale");
  });

  it("does not describe the player twice", () => {
    const records = buildNarratorContextCandidates(campaign({
      characters: { wanderer: { id: "wanderer", name: "Wanderer" } },
    }));
    expect(records.filter((entry) => entry.type === "player")).toHaveLength(1);
    expect(records.find((entry) => entry.id === "person:wanderer")).toBeUndefined();
  });

  it("makes later memories newer, so recency means something", () => {
    const memories = buildNarratorContextCandidates(campaign(), { revision: 100 })
      .filter((entry) => entry.type === "memory");
    expect(memories[1].sourceRevision).toBeGreaterThan(memories[0].sourceRevision);
  });

  it("puts the receipt a presentation route exists to render above everything", () => {
    const records = buildNarratorContextCandidates(campaign(), {
      route: "combat-aftermath",
      receipt: { id: "combat-1", text: "The brigand went down." },
    });
    const chronicle = records.find((entry) => entry.type === "chronicle");
    expect(chronicle.priority).toBe(100);
    expect(chronicle.routeTags).toEqual(["combat-aftermath"]);
  });

  it("keeps each record short enough to be a fact rather than a chapter", () => {
    const records = buildNarratorContextCandidates(campaign({
      characters: { windbag: { id: "windbag", name: "Windbag", description: "x".repeat(5_000) } },
    }));
    expect(records.every((entry) => entry.chars <= 600)).toBe(true);
  });

  it("survives a state with almost nothing in it", () => {
    const records = buildNarratorContextCandidates({});
    expect(records.map((entry) => entry.type)).toEqual(["player", "place"]);
  });
});

describe("candidates and the selector together", () => {
  it("pulls the person a scene is about ahead of everyone else", () => {
    const state = campaign();
    const records = buildNarratorContextCandidates(state, { revision: 5 });
    const selection = selectNarratorContext(records, {
      budgetChars: 260,
      subjectIds: turnSubjectIds({ playerId: "wanderer", speakerIds: ["hale"] }),
      revision: 5,
    });
    expect(selection.selectedIds).toContain("person:hale");
    // And the frame is always there to read it against.
    expect(selection.selectedIds).toContain("player");
    expect(selection.selectedIds).toContain("place");
  });

  it("drops the far side of the room rather than truncating it", () => {
    const state = campaign();
    const selection = selectNarratorContext(
      buildNarratorContextCandidates(state, { revision: 5 }),
      { budgetChars: 200, subjectIds: ["hale"], revision: 5 },
    );
    expect(selection.droppedCount).toBeGreaterThan(0);
    expect(selection.selected.every((entry) => entry.text.length === entry.chars)).toBe(true);
  });

  it("is stable for the same state and turn", () => {
    const state = campaign();
    const once = selectNarratorContext(buildNarratorContextCandidates(state), { budgetChars: 500 });
    const twice = selectNarratorContext(buildNarratorContextCandidates(state), { budgetChars: 500 });
    expect(once.selectedIds).toEqual(twice.selectedIds);
  });
});

describe("candidates grant nothing", () => {
  it("cannot reach the authority projection either", () => {
    // Same rule as the selector: these are facts it is useful to know, not facts that make
    // anything allowed.
    const source = readFileSync(new URL("./context-candidates.js", import.meta.url), "utf8");
    expect(source).not.toContain("narrator-projection");
    expect(source).not.toContain("buildNarratorProjection");
  });

  it("carries no permission-bearing field on any record", () => {
    for (const entry of buildNarratorContextCandidates(campaign({ party: ["hale"] }))) {
      expect(Object.keys(entry).sort()).toEqual([
        "chars", "id", "priority", "routeTags", "sourceRevision", "subjectIds", "text",
        "type", "version",
      ]);
    }
  });
});
