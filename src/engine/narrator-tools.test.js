import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const moduleUrl = new URL("../../supabase/functions/narrate/tools.ts", import.meta.url);
const rawLibrary = [
  { id: "world-and-travel", label: "World & travel", trigger: "movement", content: "Detailed movement rules." },
  { id: "combat-and-consequences", label: "Combat", trigger: "an attack", content: "Detailed combat rules." },
];

function openRouterStream(chunks) {
  return new Response([
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`),
    "data: [DONE]\n\n",
  ].join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("narrator on-demand instruction tools", () => {
  it("advertises only validated skill ids and loads requested doctrine once", async () => {
    expect(existsSync(moduleUrl), "the edge narrator tool module must exist").toBe(true);
    const {
      asInstructionLibrary,
      asOptionalInstructionLibrary,
      instructionToolFor,
      resolveInstructionToolCall,
    } = await import("../../supabase/functions/narrate/tools.ts");

    expect(asOptionalInstructionLibrary(null)).toEqual([]);
    expect(asOptionalInstructionLibrary(undefined)).toEqual([]);
    const library = asInstructionLibrary(rawLibrary);
    const tool = instructionToolFor(library);
    expect(tool.function.name).toBe("load_narrator_skills");
    expect(tool.function.parameters.properties.skill_ids.items.enum).toEqual([
      "world-and-travel",
      "combat-and-consequences",
    ]);

    const loadedSkillIds = new Set();
    const first = resolveInstructionToolCall({
      id: "call-1",
      name: "load_narrator_skills",
      arguments: JSON.stringify({ skill_ids: ["world-and-travel", "world-and-travel"] }),
    }, library, loadedSkillIds);
    expect(first.recognized).toBe(true);
    expect(first.result).toContain('<narrator-skill id="world-and-travel">');
    expect(first.result).toContain("Detailed movement rules.");
    expect(loadedSkillIds).toEqual(new Set(["world-and-travel"]));

    const second = resolveInstructionToolCall({
      id: "call-2",
      name: "load_narrator_skills",
      arguments: JSON.stringify({ skill_ids: ["world-and-travel"] }),
    }, library, loadedSkillIds);
    expect(second.result).toContain("already loaded");
    expect(second.result).not.toContain("Detailed movement rules.");
  });

  it("bounds and rejects malformed client-supplied instruction libraries", async () => {
    expect(existsSync(moduleUrl), "the edge narrator tool module must exist").toBe(true);
    const { asInstructionLibrary } = await import("../../supabase/functions/narrate/tools.ts");

    expect(() => asInstructionLibrary([{ ...rawLibrary[0], id: "BAD ID" }])).toThrow("invalid narrator skill id");
    expect(() => asInstructionLibrary([{ ...rawLibrary[0], content: "" }])).toThrow("invalid narrator skill content");
    expect(() => asInstructionLibrary([...rawLibrary, rawLibrary[0]])).toThrow("duplicate narrator skill id");
    expect(() => asInstructionLibrary(Array.from({ length: 17 }, (_, index) => ({
      ...rawLibrary[0],
      id: `skill-${index}`,
    })))).toThrow("too many narrator skills");
    expect(() => asInstructionLibrary([{ ...rawLibrary[0], content: "x".repeat(50_001) }]))
      .toThrow("narrator skill content is too large");
    expect(() => asInstructionLibrary(Array.from({ length: 4 }, (_, index) => ({
      ...rawLibrary[0],
      id: `skill-${index}`,
      content: "x".repeat(45_001),
    })))).toThrow("narrator skill library is too large");
  });

  it("bounds each tool request and rejects path-like ids without reflecting them", async () => {
    const { asInstructionLibrary, resolveInstructionToolCall } = await import("../../supabase/functions/narrate/tools.ts");
    const library = asInstructionLibrary(Array.from({ length: 6 }, (_, index) => ({
      id: `skill-${index}`,
      label: `Skill ${index}`,
      trigger: `case ${index}`,
      content: `Rules ${index}`,
    })));

    const result = resolveInstructionToolCall({
      id: "call-bounded",
      name: "load_narrator_skills",
      arguments: JSON.stringify({
        skill_ids: ["skill-0", "../secrets", "skill-1", "skill-2", "skill-3", "skill-4"],
      }),
    }, library, new Set());

    expect(result.result.match(/<narrator-skill /g)).toHaveLength(4);
    expect(result.result).not.toContain("Rules 4");
    expect(result.result).not.toContain("secrets");
  });

  it("reports unknown well-formed ids without treating them as paths", async () => {
    const { asInstructionLibrary, resolveInstructionToolCall } = await import("../../supabase/functions/narrate/tools.ts");
    const library = asInstructionLibrary(rawLibrary);

    const result = resolveInstructionToolCall({
      id: "call-unknown",
      name: "load_narrator_skills",
      arguments: JSON.stringify({ skill_ids: ["missing-skill"] }),
    }, library, new Set());

    expect(result).toEqual({
      recognized: true,
      result: "Skill missing-skill is unavailable.",
    });
  });

  it("executes streamed skill calls, appends tool results, and reserves the final round for JSON", async () => {
    const {
      asInstructionLibrary,
      instructionToolFor,
      resolveInstructionToolCall,
    } = await import("../../supabase/functions/narrate/tools.ts");
    const { streamProviderToolLoop } = await import("../../supabase/functions/narrate/provider-loop.ts");
    const library = asInstructionLibrary(rawLibrary);
    const loadedSkillIds = new Set();
    const requestRound = vi.fn()
      .mockResolvedValueOnce(openRouterStream([
        { choices: [{ delta: {
          content: "intermediate prose",
          reasoning_details: [{ type: "reasoning.summary", data: "Choose travel doctrine." }],
        } }] },
        { choices: [{ delta: { tool_calls: [{
          index: 0,
          id: "call-world",
          function: { name: "load_narrator_skills", arguments: '{"skill_ids":["world-' },
        }] } }] },
        { choices: [{ delta: { tool_calls: [{
          index: 0,
          function: { arguments: 'and-travel"]}' },
        }] } }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]))
      .mockResolvedValueOnce(openRouterStream([
        { choices: [{ delta: { content: '{"story":[{"type":"beat","text":"Final."}]}' } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]));

    const output = await new Response(streamProviderToolLoop({
      requestRound,
      request: { apiKey: "test-key", model: "test/model", effort: "high" },
      messages: [{ role: "user", content: "Travel." }],
      tools: [instructionToolFor(library)],
      maxRounds: 2,
      resolveToolCall(toolCall) {
        const resolved = resolveInstructionToolCall(toolCall, library, loadedSkillIds);
        return resolved.recognized ? { result: resolved.result } : null;
      },
    })).text();

    expect(requestRound).toHaveBeenCalledTimes(2);
    expect(requestRound.mock.calls.map(([request]) => request.toolChoice)).toEqual(["auto", "none"]);
    const secondMessages = requestRound.mock.calls[1][0].messages;
    expect(secondMessages.at(-2)).toMatchObject({
      role: "assistant",
      tool_calls: [{ id: "call-world", function: { name: "load_narrator_skills" } }],
      reasoning_details: [{ type: "reasoning.summary", data: "Choose travel doctrine." }],
    });
    expect(secondMessages.at(-1)).toMatchObject({
      role: "tool",
      tool_call_id: "call-world",
    });
    expect(secondMessages.at(-1).content).toContain("Detailed movement rules.");
    expect(output).toContain("intermediate prose");
    expect(output).toContain("narrator_round_reset");
    expect(output).toContain("Final.");
  });
});
