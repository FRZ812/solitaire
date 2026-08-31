import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compileNarratorCandidate,
  NARRATOR_RESPONSE_KEYS,
} from "../src/engine/narrator-turn-compiler.js";
import { NARRATOR_CONTRACT_VERSION } from "../src/engine/narrator-projection.js";
import { NARRATOR_REFERENCE_PROMPT } from "../src/narrator-instructions.js";
import { SYSTEM_PROMPT } from "../src/system-prompt.js";
import { streamProviderToolLoop } from "../supabase/functions/narrate/provider-loop.ts";
import { buildNarratorRequest } from "../supabase/functions/narrate/routing.ts";

function neutralCandidate(story) {
  const candidate = Object.fromEntries(NARRATOR_RESPONSE_KEYS.map((key) => [key, null]));
  return {
    ...candidate,
    contract_version: NARRATOR_CONTRACT_VERSION,
    state_revision: "state-1",
    story,
    minutes_passed: 0,
    vitality_change: 0,
    resolve_change: 0,
  };
}

function compileStory(story, userMsg = "[PLAYER ACTION] where am i?") {
  return compileNarratorCandidate({
    candidate: neutralCandidate(story),
    projection: {
      contractVersion: NARRATOR_CONTRACT_VERSION,
      stateRevision: "state-1",
      playerId: "wanderer",
      characters: {},
      presentSpeakerIds: [],
      currentTile: { x: 0, y: 0, day: 1 },
    },
    turnPolicy: { id: "general-action", allowedEffects: [] },
    metadata: { userMsg, raw: "", model: "test", memoryProposals: [] },
  });
}

describe("narrator quality routing", () => {
  it("routes GLM 5.3 Flash through its official endpoint with a tool-compatible fallback", () => {
    const request = buildNarratorRequest({
      model: "z-ai/glm-5.3-flash",
      effort: "max",
      messages: [{ role: "user", content: "where am i?" }],
      tools: [{ type: "function", function: { name: "remember", parameters: { type: "object" } } }],
      toolChoice: "auto",
    });

    expect(request.provider.order).toEqual(["z-ai", "deepinfra"]);
    expect(request.provider.only).toEqual(["z-ai", "deepinfra"]);
    expect(request.provider.allow_fallbacks).toBe(true);
    expect(request.provider.require_parameters).toBe(true);
    expect(request.provider.max_price).toEqual({ prompt: 0.075, completion: 0.25 });
    expect(request.provider).not.toHaveProperty("sort");
  });

  it("emits provider milestones without logging private reasoning or answer text", async () => {
    const privateText = "PRIVATE_NARRATOR_OUTPUT";
    const upstream = [
      {
        provider: "Z.AI",
        choices: [{
          delta: { reasoning: "PRIVATE_REASONING", content: privateText },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
      },
      {
        provider: "Z.AI",
        choices: [{
          delta: { role: "assistant", content: "" },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      "[DONE]",
    ].map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`).join("");
    const trace = [];
    const stream = streamProviderToolLoop({
      requestRound: async () => new Response(upstream),
      request: { apiKey: "test-key", model: "z-ai/glm-5.3-flash", effort: "max" },
      messages: [],
      tools: [],
      maxRounds: 1,
      resolveToolCall: () => null,
      trace: (event) => trace.push(event),
    });

    await new Response(stream).text();

    expect(trace).toEqual([
      expect.objectContaining({ event: "round_start", round: 1, model: "z-ai/glm-5.3-flash" }),
      expect.objectContaining({ event: "provider_stream", round: 1, provider: "Z.AI" }),
      expect.objectContaining({ event: "round_finish", round: 1, provider: "Z.AI", finishReason: "stop" }),
    ]);
    expect(JSON.stringify(trace)).not.toContain(privateText);
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_REASONING");
    const edge = readFileSync("supabase/functions/narrate/index.ts", "utf8");
    expect(edge).toContain('console.info("narrator_trace"');
    expect(edge).toContain("trace_id: traceId");
  });

  it("collapses unknown upstream provider labels before tracing", async () => {
    const privateProvider = "PRIVATE USER FACT";
    const upstream = [
      {
        provider: privateProvider,
        choices: [{
          delta: { content: "{}" },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
      },
      {
        provider: privateProvider,
        choices: [{
          delta: { role: "assistant", content: "" },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
      "[DONE]",
    ].map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`).join("");
    const trace = [];
    const stream = streamProviderToolLoop({
      requestRound: async () => new Response(upstream),
      request: { apiKey: "test-key", model: "z-ai/glm-5.3-flash", effort: "max" },
      messages: [],
      tools: [],
      maxRounds: 1,
      resolveToolCall: () => null,
      trace: (event) => trace.push(event),
    });

    await new Response(stream).text();

    expect(trace).toContainEqual(expect.objectContaining({
      event: "provider_stream",
      provider: "other",
    }));
    expect(JSON.stringify(trace)).not.toContain(privateProvider);
  });

  it("collapses unknown finish reasons before tracing", async () => {
    const privateFinish = "PRIVATE USER FACT";
    const upstream = [
      {
        provider: "Z.AI",
        choices: [{
          delta: { content: "{}" },
          finish_reason: privateFinish,
          native_finish_reason: privateFinish,
        }],
      },
      {
        provider: "Z.AI",
        choices: [{
          delta: { role: "assistant", content: "" },
          finish_reason: privateFinish,
          native_finish_reason: privateFinish,
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
      "[DONE]",
    ].map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`).join("");
    const trace = [];
    const stream = streamProviderToolLoop({
      requestRound: async () => new Response(upstream),
      request: { apiKey: "test-key", model: "z-ai/glm-5.3-flash", effort: "max" },
      messages: [],
      tools: [],
      maxRounds: 1,
      resolveToolCall: () => null,
      trace: (event) => trace.push(event),
    });

    await expect(new Response(stream).text())
      .rejects.toThrow("Provider stream ended with a non-success finish reason.");

    expect(trace).toContainEqual(expect.objectContaining({
      event: "round_finish",
      finishReason: "other",
    }));
    expect(JSON.stringify(trace)).not.toContain(privateFinish);
  });
});

describe("informative narrator prose", () => {
  it("accepts bounded presentation-only narration in contract v3", () => {
    expect(NARRATOR_CONTRACT_VERSION).toBe(3);

    const compiled = compileStory([{
      type: "narration",
      text: "Grain Square occupies the noisy heart of Whitemarch's Grand Market.",
    }]);

    expect(compiled.ok).toBe(true);
    expect(compiled.turn.story).toEqual([{
      type: "beat",
      text: "Grain Square occupies the noisy heart of Whitemarch's Grand Market.",
    }]);
  });

  it("rejects an ambient cue as the entire answer to a player action", () => {
    const compiled = compileStory([{
      type: "beat",
      cue: { kind: "scene", event: "crowd-stirs" },
    }]);

    expect(compiled.ok).toBe(false);
    expect(compiled.violations).toContainEqual(expect.objectContaining({
      code: "UNINFORMATIVE_STORY",
      path: "/story",
    }));
  });

  it("rejects narration that directly writes for or addresses the player", () => {
    const compiled = compileStory([{
      type: "narration",
      text: "You decide to leave Grain Square and feel relieved.",
    }]);

    expect(compiled.ok).toBe(false);
    expect(compiled.violations).toContainEqual(expect.objectContaining({
      code: "PLAYER_SOVEREIGNTY",
      path: "/story/0/text",
    }));
  });

  it("still allows a closed ambient cue when the player explicitly continues in silence", () => {
    const compiled = compileStory(
      [{ type: "beat", cue: { kind: "scene", event: "crowd-stirs" } }],
      "[CONTINUE STORY] The player takes no new action and says nothing.",
    );

    expect(compiled.ok).toBe(true);
    expect(compiled.turn.story).toEqual([{
      type: "beat",
      text: "The surrounding crowd stirs.",
    }]);
  });

  it("keeps the compact and retrieved narrator doctrine coherent with the prose channel", () => {
    expect(SYSTEM_PROMPT).toContain('"type":"narration"');
    expect(SYSTEM_PROMPT).toContain("generic ambient cue alone is invalid");
    expect(NARRATOR_REFERENCE_PROMPT).toContain("Narration entries carry presentation-only world/NPC prose");
    expect(NARRATOR_REFERENCE_PROMPT).not.toContain("Dialogue entries are the only free-language presentation channel");
    expect(NARRATOR_REFERENCE_PROMPT).not.toContain('"contract_version": 2');
    expect(NARRATOR_REFERENCE_PROMPT).toContain('"contract_version": 3');
    expect(NARRATOR_REFERENCE_PROMPT).toContain('{"type":"narration","text":');
  });
});

describe("visual-novel geometry stability", () => {
  it("overlays narrator errors inside the stage and sizes portraits from the viewport", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    const css = readFileSync("src/components/chat-scene.css", "utf8");
    const characterImageRule = css.match(
      /\.visual-novel-character > img,\s*\.visual-novel-character > div\s*\{([^}]*)\}/,
    )?.[1] || "";

    expect(app).toMatch(/<VisualNovelStage[\s\S]*?\/>\s*\{\(error \|\| campaignError\)[\s\S]*?visual-novel-notices/);
    expect(app).not.toMatch(/<VisualNovelStage[\s\S]*?\/>\s*<\/div>\s*\{\(error \|\| campaignError\)/);
    expect(app).toMatch(/className="visual-novel-notices"\s+role="alert"\s+aria-live="assertive"/);
    expect(css).toMatch(/\.visual-novel-notices\s*\{[^}]*position:\s*absolute/);
    expect(characterImageRule).toMatch(/height:\s*clamp\(360px, 54dvh, 500px\)/);
    expect(css).toMatch(/@media \(max-height: 500px\)[\s\S]*?\.visual-novel-character > img,[\s\S]*?height:\s*100%/);
  });
});
