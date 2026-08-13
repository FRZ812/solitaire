// Turning campaign state into things the narrator might usefully be told.
//
// `buildStateContext` renders one string containing everything, and every route gets all of
// it. This produces the same material as separable records instead, each one a bounded fact
// about a named subject, so the selector beside this file can rank them against what the
// turn is actually about and pack what fits.
//
// The split matters more than the saving. A record knows who it is about, which is what lets
// "everything we know about Hale" outrank "the most important thing in the world" in a scene
// where Hale is the only person present. A single string cannot be asked that question.
//
// Nothing here grants permission. These are facts it is useful to know, not facts that make
// anything allowed — the compiler's authority projection is a separate object built
// elsewhere, and no record produced here reaches it.

import { condNames } from "../../data/conditions.js";
import { contextRecord } from "./context-selection.js";

export const CONTEXT_CANDIDATE_VERSION = 1;

/** Kept short deliberately: a record is a fact, not a chapter. */
const MAX_RECORD_CHARS = 600;

function clamp(text) {
  const body = String(text ?? "").replace(/\s+/g, " ").trim();
  return body.length > MAX_RECORD_CHARS ? `${body.slice(0, MAX_RECORD_CHARS - 1)}…` : body;
}

function personSummary(person) {
  const bits = [person.name];
  if (person.role || person.profession) bits.push(person.role || person.profession);
  if (person.combatState?.status && person.combatState.status !== "ok") {
    bits.push(person.combatState.status);
  }
  if (person.description) bits.push(person.description);
  return clamp(bits.filter(Boolean).join(" — "));
}

/**
 * Every record this state could offer, unranked.
 *
 * Selection is the selector's job; this only decides what exists and who each fact is about.
 * Keeping the two apart means a change to ranking cannot accidentally change what the game
 * knows, and a new kind of fact cannot accidentally change how facts are ranked.
 *
 * @param {object} state campaign state
 * @param {{route?: string, receipt?: object, revision?: number}} context
 */
export function buildNarratorContextCandidates(state, { route = null, receipt = null, revision = 0 } = {}) {
  const records = [];
  const add = (fields) => {
    const built = contextRecord({ sourceRevision: revision, ...fields });
    if (built) records.push(built);
  };

  const character = state?.character || {};
  const world = state?.world || {};
  const playerId = character.id || "wanderer";

  // --- The frame: never ranked, never dropped --------------------------------
  add({
    id: "player",
    type: "player",
    subjectIds: [playerId],
    priority: 100,
    text: clamp([
      character.name,
      character.race && `${character.race}`,
      character.profession,
      `vitality ${character.vitality ?? "?"}/${character.vitalityMax ?? "?"}`,
      character.bond,
    ].filter(Boolean).join(" — ")),
  });

  const tile = world.currentTile || {};
  const time = state?.time || {};
  add({
    id: "place",
    type: "place",
    priority: 100,
    text: clamp([
      state?.locationName || world.placeName || `wilderness (${tile.x ?? 0},${tile.y ?? 0})`,
      `day ${time.day ?? 0}, ${String(time.hour ?? 0).padStart(2, "0")}:${String(time.minute ?? 0).padStart(2, "0")}`,
    ].join(" — "),
    ),
  });

  // --- People: one record each, so a scene can pull exactly who is in it ------
  const characters = world.codex?.characters || {};
  for (const [id, person] of Object.entries(characters)) {
    if (id === playerId) continue;
    const summary = personSummary(person);
    if (!summary) continue;
    add({
      id: `person:${id}`,
      type: "person",
      subjectIds: [id],
      // Someone travelling with the player is more likely to matter than someone met once.
      priority: (state?.party || []).includes(id) ? 80 : 40,
      text: summary,
    });
  }

  // --- What the player is in the middle of ------------------------------------
  for (const quest of world.quests || []) {
    if (quest?.status !== "active") continue;
    add({
      id: `quest:${quest.id}`,
      type: "quest",
      subjectIds: [quest.giverId, quest.targetId].filter(Boolean),
      priority: 70,
      text: clamp(`${quest.title || quest.id}${quest.giver ? ` (for ${quest.giver})` : ""}: ${quest.summary || quest.desc || "in progress"}`),
    });
  }

  // --- What is wrong with them right now --------------------------------------
  for (const name of condNames(character.conditions)) {
    add({
      id: `condition:${name}`,
      type: "condition",
      subjectIds: [playerId],
      priority: 60,
      text: clamp(name),
    });
  }

  // --- What the narrator chose to remember ------------------------------------
  (state?.memories || []).forEach((memory, index) => {
    add({
      id: `memory:${index}`,
      type: "memory",
      priority: 50,
      // Later memories are newer; the selector's recency term does the rest.
      sourceRevision: revision - ((state.memories.length - 1) - index),
      text: clamp(memory),
    });
  });

  // --- The receipt a presentation route exists to render -----------------------
  if (receipt) {
    add({
      id: `chronicle:${receipt.id || receipt.sessionId || "receipt"}`,
      type: "chronicle",
      routeTags: [route].filter(Boolean),
      // Nothing outranks the thing this route was called to narrate.
      priority: 100,
      sourceRevision: revision,
      text: clamp(receipt.text || receipt.summary || JSON.stringify(receipt)),
    });
  }

  return records;
}

/** Which candidate types this state actually produced, for a coverage check. */
export function candidateTypeCounts(records) {
  const counts = {};
  for (const record of records) counts[record.type] = (counts[record.type] || 0) + 1;
  return counts;
}
