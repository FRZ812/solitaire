import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildNarratorProjection } from "../narrator-projection.js";
import {
  ALWAYS_INCLUDED_TYPES,
  CONTEXT_TYPES,
  RANK_WEIGHTS,
  contextRecord,
  renderSelectedContext,
  scoreRecord,
  selectNarratorContext,
  turnSubjectIds,
} from "./context-selection.js";

function record(overrides = {}) {
  return contextRecord({
    id: "r1",
    type: "person",
    text: "Hale keeps the toll bridge and remembers a slight.",
    ...overrides,
  });
}

describe("building a record", () => {
  it("measures its own size rather than trusting the caller", () => {
    // The budget is only meaningful if the number it packs against is the number that will
    // actually be sent.
    const built = record({ text: "Twelve chars" });
    expect(built.chars).toBe("Twelve chars".length);
  });

  it("refuses a record with nothing in it", () => {
    expect(record({ text: "   " })).toBe(null);
    expect(record({ text: null })).toBe(null);
  });

  it("refuses a type nobody defined", () => {
    expect(record({ type: "vibes" })).toBe(null);
    expect(CONTEXT_TYPES).toContain("chronicle");
  });

  it("bounds authored priority rather than trusting it", () => {
    expect(record({ priority: 9999 }).priority).toBe(100);
    expect(record({ priority: -5 }).priority).toBe(0);
  });
});

describe("ranking", () => {
  const context = { subjectIds: ["hale"], route: "trade-presentation", revision: 10 };

  it("puts what the turn is about above what is merely important", () => {
    // A scene about Hale wants everything about Hale before it wants the most important
    // thing in the world, because the most important thing in the world is not in the room.
    const aboutHale = record({ id: "a", subjectIds: ["hale"], priority: 0 });
    const veryImportant = record({ id: "b", subjectIds: ["someone-else"], priority: 100 });
    expect(scoreRecord(aboutHale, context)).toBeGreaterThan(scoreRecord(veryImportant, context));
  });

  it("puts an exact subject above a matching route", () => {
    const subject = record({ id: "a", subjectIds: ["hale"] });
    const routed = record({ id: "b", routeTags: ["trade-presentation"] });
    expect(scoreRecord(subject, context)).toBeGreaterThan(scoreRecord(routed, context));
    expect(RANK_WEIGHTS.subjectMatch).toBeGreaterThan(RANK_WEIGHTS.routeMatch);
  });

  it("lets recency break a tie without overturning relevance", () => {
    const oldButRelevant = record({ id: "a", subjectIds: ["hale"], sourceRevision: 0 });
    const newButNot = record({ id: "b", subjectIds: [], sourceRevision: 10 });
    expect(scoreRecord(oldButRelevant, context)).toBeGreaterThan(scoreRecord(newButNot, context));

    const older = record({ id: "c", subjectIds: ["hale"], sourceRevision: 2 });
    const newer = record({ id: "d", subjectIds: ["hale"], sourceRevision: 9 });
    expect(scoreRecord(newer, context)).toBeGreaterThan(scoreRecord(older, context));
  });
});

describe("packing", () => {
  it("keeps records whole or drops them", () => {
    // Half a sentence about someone's death reads as a complete sentence about something
    // else, which is worse than the record being absent.
    const long = record({ id: "long", text: "x".repeat(500) });
    const short = record({ id: "short", text: "y".repeat(50) });
    const selection = selectNarratorContext([long, short], { budgetChars: 200 });
    expect(selection.selectedIds).toEqual(["short"]);
    expect(selection.droppedIds).toEqual(["long"]);
    expect(selection.selected.every((entry) => entry.text.length === entry.chars)).toBe(true);
  });

  it("never drops the frame the scene is read against", () => {
    const player = record({ id: "p", type: "player", text: "z".repeat(400) });
    const place = record({ id: "l", type: "place", text: "w".repeat(400) });
    const other = record({ id: "o", type: "person" });
    const selection = selectNarratorContext([player, place, other], { budgetChars: 100 });
    expect(selection.selectedIds).toContain("p");
    expect(selection.selectedIds).toContain("l");
    expect(ALWAYS_INCLUDED_TYPES).toEqual(["player", "place"]);
  });

  it("reports going over rather than cutting the frame", () => {
    // The answer to a frame that will not fit is a bigger budget or a smaller frame, not a
    // severed sentence.
    const player = record({ id: "p", type: "player", text: "z".repeat(400) });
    const selection = selectNarratorContext([player], { budgetChars: 100 });
    expect(selection.overBudget).toBe(true);
    expect(selection.selectedIds).toEqual(["p"]);
  });

  it("records what it dropped, so a missing fact is findable", () => {
    const records = Array.from({ length: 20 }, (_, index) => (
      record({ id: `r${index}`, text: "x".repeat(100) })
    ));
    const selection = selectNarratorContext(records, { budgetChars: 350 });
    expect(selection.selected).toHaveLength(3);
    expect(selection.droppedCount).toBe(17);
    expect(selection.usedChars).toBeLessThanOrEqual(selection.budgetChars);
  });

  it("is deterministic under identical inputs", () => {
    // A selector that reordered would make every narrator comparison meaningless, including
    // the evaluation this is meant to be measured by.
    const records = ["c", "a", "b"].map((id) => record({ id, priority: 50 }));
    const once = selectNarratorContext(records, { budgetChars: 10_000 });
    const twice = selectNarratorContext([...records].reverse(), { budgetChars: 10_000 });
    expect(once.selectedIds).toEqual(twice.selectedIds);
  });

  it("breaks equal scores on id rather than on input order", () => {
    const records = ["c", "a", "b"].map((id) => record({ id, priority: 50 }));
    expect(selectNarratorContext(records, { budgetChars: 10_000 }).selectedIds)
      .toEqual(["a", "b", "c"]);
  });

  it("survives an empty candidate list", () => {
    const selection = selectNarratorContext([], { budgetChars: 100 });
    expect(selection.selected).toEqual([]);
    expect(selection.overBudget).toBe(false);
  });
});

describe("what the turn is about", () => {
  it("comes from what the engine decided, never from the narrator", () => {
    // A model that could nominate its own subjects could pull whatever context it liked
    // into view.
    expect(turnSubjectIds({ playerId: "wanderer", speakerIds: ["hale"], targetIds: ["hale", "marsh"] }))
      .toEqual(["wanderer", "hale", "marsh"]);
  });

  it("drops empties without complaint", () => {
    expect(turnSubjectIds({ playerId: null, speakerIds: [undefined], targetIds: [] })).toEqual([]);
  });
});

describe("rendering", () => {
  it("labels each record and keeps them separated", () => {
    const rendered = renderSelectedContext(selectNarratorContext(
      [record({ id: "a", type: "person", text: "Hale is here." })],
      { budgetChars: 1_000 },
    ));
    expect(rendered).toBe("[PERSON] Hale is here.");
  });
});

describe("selection is not authority", () => {
  const source = readFileSync(new URL("./context-selection.js", import.meta.url), "utf8");

  it("cannot reach the projection at all", () => {
    // The compiler's projection is what decides which of the model's claims are allowed.
    // Budgeting it would not save tokens the model reads — it would weaken the gate. The
    // selector has no import of it, which is the strongest form of "never trims it".
    expect(source).not.toContain("narrator-projection");
    expect(source).not.toContain("buildNarratorProjection");
  });

  it("produces nothing that grants permission", () => {
    // Every field in a selection is prose-facing. None of them is a valid-id list, a
    // capability token, or a fund — the things a dropped record could otherwise silently
    // widen.
    const selection = selectNarratorContext([record({ id: "a" })], { budgetChars: 1_000 });
    for (const key of ["validIds", "capabilities", "funds", "party", "permissions", "allowed"]) {
      expect(Object.hasOwn(selection, key), key).toBe(false);
    }
    for (const entry of selection.selected) {
      expect(Object.keys(entry).sort()).toEqual([
        "chars", "id", "priority", "routeTags", "sourceRevision", "subjectIds", "text",
        "type", "version",
      ]);
    }
  });

  it("leaves the projection identical however hard the context is squeezed", () => {
    // The plan's rule stated directly: dropping context records cannot widen authority,
    // because the two objects never meet.
    const state = {
      character: { name: "Wanderer" },
      world: { codex: { characters: {} }, currentTile: { x: 0, y: 0 } },
      party: [],
      beats: [],
      time: { day: 1, hour: 9, minute: 0 },
    };
    const before = JSON.stringify(buildNarratorProjection(state));
    selectNarratorContext(
      Array.from({ length: 50 }, (_, i) => record({ id: `r${i}`, text: "x".repeat(500) })),
      { budgetChars: 1 },
    );
    expect(JSON.stringify(buildNarratorProjection(state))).toBe(before);
  });
});
