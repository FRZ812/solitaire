import { describe, expect, it } from "vitest";
import { compactLegacyUserMessage, prepareNarratorHistory } from "./narrator-history.js";

function legacyContext(action) {
  return `[PLAYER — old state]\n[STATE — old]\n[MEMORY BANK — durable]\n- fact\n\n${action}`;
}

describe("narrator history compaction", () => {
  it("strips repeated legacy state context while preserving the complete action", () => {
    const action = "[PLAYER ACTION] Travel north.\n\n[ENCOUNTER] wolves";
    expect(compactLegacyUserMessage(legacyContext(action))).toBe(action);
  });

  it("keeps recent complete turn groups within the character budget", () => {
    const history = [
      { role: "user", content: legacyContext("[PLAYER ACTION] old") },
      { role: "assistant", content: "x".repeat(30) },
      { role: "user", content: legacyContext("[PLAYER ACTION] recent") },
      { role: "assistant", content: "y".repeat(30) },
    ];

    expect(prepareNarratorHistory(history, 24, 70)).toEqual([
      { role: "user", content: "[PLAYER ACTION] recent" },
      { role: "assistant", content: "y".repeat(30) },
    ]);
  });

  it("never starts the forwarded history with a dangling assistant response", () => {
    expect(prepareNarratorHistory([
      { role: "assistant", content: "orphaned old response" },
      { role: "user", content: "[PLAYER ACTION] recent" },
      { role: "assistant", content: "recent response" },
    ])).toEqual([
      { role: "user", content: "[PLAYER ACTION] recent" },
      { role: "assistant", content: "recent response" },
    ]);
  });
});
