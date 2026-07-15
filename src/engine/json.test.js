import { describe, expect, it } from "vitest";
import { extractJSON } from "./json.js";

describe("extractJSON truncated stream repair", () => {
  it("keeps an alphanumeric narration value instead of mistaking it for a key", () => {
    expect(extractJSON('{"narration":"Visible')).toMatchObject({ narration: "Visible", _truncated: true });
  });

  it("closes nested containers in their actual reverse order", () => {
    const parsed = extractJSON('{"narration":"Done","dialogues":[{"name":"Mira","line":"Do not turn');
    expect(parsed).toMatchObject({
      narration: "Done",
      dialogues: [{ name: "Mira", line: "Do not turn" }],
      _truncated: true,
    });
  });
});
