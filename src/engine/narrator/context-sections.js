// Making the existing context block selectable without rewriting a word of it.
//
// `buildStateContext` renders twenty-five labelled sections into one string, and every route
// receives all of it. The selector beside this file can rank and budget records — but only
// if the block is records, and reimplementing twenty-five bespoke renderers to get there
// would mean rewriting the narrator's entire prompt in one step and hoping.
//
// So the block is split rather than rebuilt. Each `[SECTION — …]` becomes a record carrying
// the exact text the renderer already produced, which makes the adapter losslessly
// reversible by construction: re-joining the sections reproduces the input byte for byte,
// and a test asserts it on real campaign states rather than trusting the parser.
//
// That is what makes activation safe. Selection goes live against content that has not
// changed, so the only thing that can differ is *which* sections a route receives and in
// what order — deterministic, diagnosable, and reversible by raising the budget. Rewriting
// the sections into first-class authored records is the next step, and it can now happen one
// section at a time against a working baseline instead of all at once against nothing.

import { contextRecord, selectNarratorContext } from "./context-selection.js";

export const CONTEXT_SECTION_VERSION = 1;

/**
 * A section header: a bracketed run of capitals, up to the em-dash or the closing bracket.
 *
 * Stopping at the separator matters — a greedy class that swallowed the dash would capture
 * "PLAYER — Y" as the marker, because the first word of the body is capitalised too.
 */
const SECTION_HEADER = /^\[([A-Z][A-Z0-9 &']*?)\s*(?:—|\]|$)/;

/**
 * Which sections are the frame rather than the furniture.
 *
 * These carry who the player is, where and when they are, and the instructions that make
 * the rest legible. A scene missing them is not leaner, it is incoherent — so they are typed
 * as the always-included kinds and never ranked.
 */
const FRAME_MARKERS = new Set(["STATE", "PLAYER", "AUTHORED CHARACTER", "REGION", "AREA", "LOCAL PLACE"]);

/**
 * Sections whose absence would let the narrator invent something the engine must then
 * discard. They are not authority — the compiler still refuses an uncatalogued id whether
 * or not the catalogue was shown — but dropping them turns a clean refusal into a wasted
 * turn, so they rank at the top of what is rankable.
 */
const CATALOGUE_MARKERS = new Set([
  "ITEM CATALOG",
  "GRANTABLE ABILITIES",
  "ABILITIES KNOWN",
  "PROGRESSION CAPABILITIES",
]);

function priorityFor(marker) {
  if (CATALOGUE_MARKERS.has(marker)) return 95;
  if (marker === "CODEX" || marker === "BONDS & MEMORIES" || marker === "KNOWLEDGE BY CHARACTER") return 80;
  if (marker === "MEMORY BANK") return 78;
  if (marker === "ACTIVE TASKS" || marker === "COMPANIONS") return 70;
  if (marker === "INVENTORY" || marker === "NEEDS" || marker === "ATTRIBUTES") return 65;
  if (marker === "PROGRESSION") return 60;
  return 40;
}

function typeFor(marker) {
  if (FRAME_MARKERS.has(marker)) return marker === "PLAYER" || marker === "AUTHORED CHARACTER" ? "player" : "place";
  if (marker === "MEMORY BANK" || marker === "BONDS & MEMORIES") return "memory";
  if (marker === "CODEX" || marker === "KNOWLEDGE BY CHARACTER" || marker === "COMPANIONS") return "person";
  if (marker === "ACTIVE TASKS") return "quest";
  return "world-fact";
}

/**
 * Split a rendered context block into its sections, losslessly.
 *
 * The first chunk has no header — the renderer opens with the player and steering lines —
 * and is kept as the preamble so the join is exact. Everything else begins at a header line.
 */
export function splitStateContextSections(block) {
  const text = typeof block === "string" ? block : "";
  if (!text) return [];
  const lines = text.split("\n");
  const sections = [];
  let current = { marker: null, lines: [] };

  for (const line of lines) {
    const header = line.match(SECTION_HEADER);
    if (header) {
      if (current.lines.length > 0) sections.push(current);
      current = { marker: header[1].trim().replace(/[\s—-]+$/, ""), lines: [line] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length > 0) sections.push(current);

  return sections.map((section, index) => ({
    marker: section.marker ?? "PREAMBLE",
    order: index,
    text: section.lines.join("\n"),
  }));
}

/** Re-join split sections. `joinStateContextSections(split(x)) === x` for any rendered block. */
export function joinStateContextSections(sections) {
  return sections.map((section) => section.text).join("\n");
}

/**
 * The existing block as ranked candidate records.
 *
 * Order is preserved as a tiebreak so a budget that fits everything renders the block in the
 * order the prompt has always used — the narrator has been trained against that shape, and
 * reshuffling it for no reason is a change nobody asked for.
 */
export function stateContextSectionRecords(block, { revision = 0 } = {}) {
  return splitStateContextSections(block)
    .map((section) => contextRecord({
      // Order is in the id so equal-score ties break into the original order.
      id: `section:${String(section.order).padStart(3, "0")}:${section.marker}`,
      type: section.marker === "PREAMBLE" ? "player" : typeFor(section.marker),
      priority: section.marker === "PREAMBLE" ? 100 : priorityFor(section.marker),
      text: section.text,
      sourceRevision: revision,
    }))
    .filter(Boolean);
}

/**
 * The budget a live narrator turn selects within.
 *
 * Set above the largest block any real campaign currently renders, so activation changes
 * nothing today: every section fits, and selection is a no-op on content. It exists so the
 * behaviour under pressure is defined and tested *before* a campaign grows into it —
 * discovering what a squeezed prompt does on the turn it first happens is the wrong time to
 * find out.
 */
export const NARRATOR_CONTEXT_BUDGET_CHARS = 200_000;

/**
 * The context a narrator request should carry.
 *
 * One call replaces `buildStateContext(state)` at every site. At the default budget it
 * returns the identical string; below it, whole sections drop by rank and the diagnostics
 * say which.
 */
export function selectStateContext(block, {
  budgetChars = NARRATOR_CONTEXT_BUDGET_CHARS,
  route = null,
  subjectIds = [],
  revision = 0,
} = {}) {
  const records = stateContextSectionRecords(block, { revision });
  const selection = selectNarratorContext(records, {
    budgetChars,
    route,
    subjectIds,
    revision,
    // The prompt has always read in this order and the narrator is tuned against it.
    preserveInputOrder: true,
  });
  return {
    text: joinStateContextSections(selection.selected),
    droppedIds: selection.droppedIds,
    droppedCount: selection.droppedCount,
    usedChars: selection.usedChars,
    budgetChars: selection.budgetChars,
  };
}
