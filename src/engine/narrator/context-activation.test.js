// The absence tests §11.3 requires before a selector counts as active.
//
// "A new selector is not considered active while any production call still appends the old
// full-state block." That is not a claim a module can make about itself, so it is checked
// against the source of every caller.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { buildStateContext } from "../api.js";
import { NARRATOR_CONTEXT_BUDGET_CHARS, selectStateContext } from "./context-sections.js";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const CALLERS = [
  ["the narrator request path", "../api-supabase.js"],
  ["the context preview", "../../components/chatContextModel.js"],
];

describe("every caller goes through the selector", () => {
  for (const [label, path] of CALLERS) {
    it(`${label} selects rather than appending the raw block`, () => {
      const text = source(path);
      expect(text).toContain("selectStateContext");
      // The raw builder may still be *called* — it is what produces the block the selector
      // splits — but its output must not reach the request without passing through.
      const rawAppend = /state_context\s*=\s*\[\s*buildStateContext\(/.test(text)
        || /return\s+state\s*\?\s*buildStateContext\(/.test(text);
      expect(rawAppend, `${label} still appends the unselected block`).toBe(false);
    });
  }

  it("has no caller left outside that list", () => {
    // A third caller appearing without a test is how a route quietly keeps the old
    // behaviour while the other two migrate.
    const app = source("../../App.jsx");
    expect(app).not.toContain("buildStateContext");
  });
});

describe("activation changes nothing today", () => {
  const STATES = [
    ["a fresh campaign", () => ({ ...makeInitialState(), created: true })],
    ["a played campaign", () => {
      const state = makeInitialState();
      return {
        ...state,
        created: true,
        character: { ...state.character, conditions: ["Bleeding"] },
        memories: ["The player burned the bridge."],
      };
    }],
  ];

  for (const [label, build] of STATES) {
    it(`sends ${label} the identical block it always did`, () => {
      // The safety argument, stated as a test rather than an intention: at the shipped
      // budget the selector is a no-op on content, so activating it cannot have changed a
      // word of any prompt.
      const block = buildStateContext(build());
      const selected = selectStateContext(block);
      expect(selected.text).toBe(block);
      expect(selected.droppedCount).toBe(0);
    });
  }

  it("ships a budget above what any real campaign renders", () => {
    const block = buildStateContext({ ...makeInitialState(), created: true });
    expect(block.length).toBeLessThan(NARRATOR_CONTEXT_BUDGET_CHARS);
  });

  it("defines what happens under pressure before a campaign grows into it", () => {
    // Discovering what a squeezed prompt does on the turn it first happens is the wrong
    // time to find out.
    const block = buildStateContext({ ...makeInitialState(), created: true });
    const squeezed = selectStateContext(block, { budgetChars: 5_000 });
    expect(squeezed.droppedCount).toBeGreaterThan(0);
    expect(squeezed.usedChars).toBeLessThanOrEqual(5_000);
    // Whole sections, never a cut one.
    expect(squeezed.text).not.toContain("…");
    expect(squeezed.droppedIds.every((id) => id.startsWith("section:"))).toBe(true);
  });
});
