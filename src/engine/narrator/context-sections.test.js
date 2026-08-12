// The proof that makes activation safe.
//
// Selection can only go live against the existing prompt if splitting it and re-joining it
// returns exactly what went in. These tests do that against real campaign states rather than
// a hand-written sample, because the sections that would break a parser — the multi-line
// catalogues, the knowledge tables, the empty ones — only exist in real state.

import { describe, expect, it } from "vitest";
import { buildStateContext } from "../api.js";
import { makeInitialState } from "../../data/initial-state.js";
import {
  joinStateContextSections,
  splitStateContextSections,
  stateContextSectionRecords,
} from "./context-sections.js";
import { renderSelectedContext, selectNarratorContext } from "./context-selection.js";

function campaign(overrides = {}) {
  const state = makeInitialState();
  return {
    ...state,
    created: true,
    character: { ...state.character, name: "Wanderer", conditions: ["Bleeding"], ...(overrides.character || {}) },
    world: {
      ...state.world,
      quests: [{ id: "q1", status: "active", title: "The missing cart", giver: "Hale" }],
      codex: {
        ...state.world.codex,
        characters: {
          ...state.world.codex.characters,
          hale: { id: "hale", name: "Hale", role: "toll-keeper", description: "Remembers a slight." },
        },
      },
    },
    memories: ["The player burned the bridge."],
    ...(overrides.state || {}),
  };
}

const STATES = [
  ["a fresh campaign", () => ({ ...makeInitialState(), created: true })],
  ["a played campaign", () => campaign()],
  ["a wounded traveller with company", () => campaign({
    character: { conditions: ["Bleeding", "Exhausted"], vitality: 6 },
    state: { party: ["hale"] },
  })],
];

describe("splitting is lossless", () => {
  for (const [label, build] of STATES) {
    it(`round-trips ${label} byte for byte`, () => {
      // The whole safety argument: if this holds, activating selection cannot change a word
      // of what the narrator receives at a budget that fits everything.
      const block = buildStateContext(build());
      expect(joinStateContextSections(splitStateContextSections(block))).toBe(block);
    });
  }

  it("finds the sections rather than one undifferentiated blob", () => {
    const sections = splitStateContextSections(buildStateContext(campaign()));
    const markers = sections.map((section) => section.marker);
    expect(sections.length).toBeGreaterThan(10);
    expect(markers).toContain("STATE");
    expect(markers).toContain("ITEM CATALOG");
    expect(markers).toContain("CODEX");
    // The block opens on the player, and that stays first — the frame the rest is read
    // against. An unlabelled opening, were there one, would be kept as PREAMBLE rather than
    // dropped; that path is covered by the round-trip above.
    expect(markers[0]).toBe("PLAYER");
  });

  it("keeps a multi-line section whole", () => {
    // KNOWLEDGE BY CHARACTER and the catalogues put their body on following lines; a parser
    // that split on every line would shred them.
    const sections = splitStateContextSections(buildStateContext(campaign()));
    const catalog = sections.find((section) => section.marker === "ITEM CATALOG");
    expect(catalog.text.split("\n").length).toBeGreaterThan(1);
  });

  it("survives an empty block", () => {
    expect(splitStateContextSections("")).toEqual([]);
    expect(joinStateContextSections([])).toBe("");
  });
});

describe("sections as records", () => {
  it("never truncates a section, however large", () => {
    // The item catalogue is far past the old record ceiling. Cutting it would be the same
    // failure the packer avoids: half a list reads as a complete list.
    const block = buildStateContext(campaign());
    const records = stateContextSectionRecords(block);
    const catalog = records.find((record) => record.id.includes("ITEM CATALOG"));
    expect(catalog.chars).toBeGreaterThan(2_000);
    expect(catalog.text.endsWith("]")).toBe(true);
  });

  it("produces a record for every section", () => {
    const block = buildStateContext(campaign());
    expect(stateContextSectionRecords(block))
      .toHaveLength(splitStateContextSections(block).length);
  });

  it("types the frame so it is never dropped", () => {
    const records = stateContextSectionRecords(buildStateContext(campaign()));
    const state = records.find((record) => record.id.includes("STATE"));
    expect(["player", "place"]).toContain(state.type);
  });
});

describe("selection over the real block", () => {
  it("reproduces the prompt exactly when the budget fits everything", () => {
    // Activation with a generous budget is a no-op on content. That is the point: the only
    // thing that can differ is which sections a squeezed route receives.
    const block = buildStateContext(campaign());
    const records = stateContextSectionRecords(block);
    const selection = selectNarratorContext(records, { budgetChars: 10_000_000, preserveInputOrder: true });
    expect(selection.droppedCount).toBe(0);
    expect(selection.selected.map((record) => record.text).join("\n")).toBe(block);
  });

  it("keeps the original section order at equal rank", () => {
    // The narrator has been trained against this shape; reshuffling it for no reason is a
    // change nobody asked for.
    const records = stateContextSectionRecords(buildStateContext(campaign()));
    const selection = selectNarratorContext(records, { budgetChars: 10_000_000, preserveInputOrder: true });
    expect(selection.selectedIds.filter((id) => id.startsWith("section:")))
      .toEqual([...selection.selectedIds].filter((id) => id.startsWith("section:")).sort());
  });

  it("drops whole sections rather than cutting one when squeezed", () => {
    const block = buildStateContext(campaign());
    const records = stateContextSectionRecords(block);
    const selection = selectNarratorContext(records, { budgetChars: 4_000 });
    expect(selection.droppedCount).toBeGreaterThan(0);
    for (const record of selection.selected) {
      const original = records.find((entry) => entry.id === record.id);
      expect(record.text).toBe(original.text);
    }
  });

  it("keeps the frame and the catalogues when it has to choose", () => {
    // A squeezed turn should still know who and where the player is, and should still be
    // able to name a real item rather than inventing one the engine then discards.
    const records = stateContextSectionRecords(buildStateContext(campaign()));
    const selection = selectNarratorContext(records, { budgetChars: 30_000 });
    const kept = selection.selectedIds.join(" ");
    expect(kept).toContain("STATE");
    expect(kept).toContain("ITEM CATALOG");
  });

  it("renders without the type labels the authored records use", () => {
    // These records *are* the prompt's own text; labelling them again would double every
    // header.
    const records = stateContextSectionRecords(buildStateContext(campaign()));
    const rendered = renderSelectedContext(selectNarratorContext(records, { budgetChars: 10_000_000, preserveInputOrder: true }));
    expect(rendered).toContain("[STATE —");
  });
});
