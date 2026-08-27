import { describe, expect, it } from "vitest";
import { streamProviderToolLoop } from "../../supabase/functions/narrate/provider-loop.ts";
import { requestNarratorRound } from "../../supabase/functions/narrate/routing.ts";

async function collect(stream) {
  return new Response(stream).text();
}

function options(response, overrides = {}) {
  return {
    messages: [{ role: "user", content: "hello" }],
    requestRound: async () => response,
    request: { apiKey: "test-key", model: "test-model", effort: null },
    tools: [],
    maxRounds: 1,
    resolveToolCall: () => null,
    ...overrides,
  };
}

describe("edge provider stream trust boundary", () => {
  it("fails closed on malformed provider SSE JSON", async () => {
    const provider = new Response("data: {not-json}\n\ndata: [DONE]\n\n");

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream contained malformed JSON.");
  });

  it("cancels a stalled provider body after a parser failure", async () => {
    const encoder = new TextEncoder();
    let providerCancelled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: {not-json}\n\n"));
      },
      cancel() {
        providerCancelled = true;
      },
    });
    const provider = new Response(body);

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream contained malformed JSON.");
    expect(providerCancelled).toBe(true);
  });

  it("cancels the active provider body when downstream streaming is cancelled", async () => {
    const encoder = new TextEncoder();
    let providerCancelled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          choices: [{ delta: { content: "partial" } }],
        })}\n\n`));
      },
      cancel() {
        providerCancelled = true;
      },
    });
    const reader = streamProviderToolLoop(options(new Response(body))).getReader();

    await reader.read();
    await reader.cancel("browser disconnected");

    expect(providerCancelled).toBe(true);
  });

  it("fails closed on top-level provider error events", async () => {
    const provider = new Response(`data: ${JSON.stringify({
      error: { message: "provider-controlled detail" },
    })}\n\ndata: [DONE]\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream reported an error.");
  });

  it.each([
    ["missing", undefined],
    ["empty", []],
    ["multiple", [{ delta: {} }, { delta: {} }]],
  ])("requires exactly one provider choice when choices are %s", async (_label, choices) => {
    const payload = choices === undefined ? {} : { choices };
    const provider = new Response(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream must contain exactly one choice.");
  });

  it.each([
    ["a scalar choice", { choices: [7] }],
    ["a missing delta", { choices: [{ finish_reason: "stop" }] }],
    ["an array delta", { choices: [{ delta: [] }] }],
    ["numeric content", { choices: [{ delta: { content: 7 } }] }],
    ["structured content", { choices: [{ delta: { content: [{ text: "laundered" }] } }] }],
    ["an unknown delta field", { choices: [{ delta: { surprise: "ignored" } }] }],
  ])("rejects %s instead of treating it as an empty provider delta", async (_label, payload) => {
    const provider = new Response(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow(/invalid (choice|delta|content) shape/i);
  });

  it("bounds provider bytes even when tool-call data is never forwarded", async () => {
    const provider = new Response(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "x".repeat(200) } }] } }] })}\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider, { maxProviderBytes: 100 }))))
      .rejects.toThrow("Provider response exceeded the byte limit.");
  });

  it("enforces one aggregate raw-provider byte ceiling across tool rounds", async () => {
    const firstRound = [
      `data: ${JSON.stringify({ choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call-1",
            type: "function",
            function: { name: "remember", arguments: "{}" },
          }],
        },
        finish_reason: null,
      }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");
    const finalRound = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "{}" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");
    const encoder = new TextEncoder();
    const firstBytes = encoder.encode(firstRound).byteLength;
    const finalBytes = encoder.encode(finalRound).byteLength;
    const aggregateLimit = firstBytes + finalBytes - 1;
    expect(firstBytes).toBeLessThan(aggregateLimit);
    expect(finalBytes).toBeLessThan(aggregateLimit);
    const rounds = [firstRound, finalRound];
    let round = 0;

    await expect(collect(streamProviderToolLoop(options(null, {
      maxRounds: 2,
      maxProviderBytes: aggregateLimit,
      requestRound: async () => new Response(rounds[round++]),
      resolveToolCall: () => ({ result: "recorded" }),
    }))))
      .rejects.toThrow("Provider response exceeded the byte limit.");
    expect(round).toBe(2);
  });

  it("rejects provider EOF without its terminal marker", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "partial" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream ended without a terminal marker.");
  });

  it("rejects an unterminated terminal SSE frame", async () => {
    const provider = new Response("data: [DONE]");

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream ended with an unterminated SSE frame.");
  });

  it("rejects provider frames after its terminal marker", async () => {
    const delta = JSON.stringify({ choices: [{ delta: { content: "late" } }] });
    const provider = new Response(`data: [DONE]\n\ndata: ${delta}\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream continued after its terminal marker.");
  });

  it("rejects non-success provider finish reasons", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "truncated" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream ended with a non-success finish reason.");
  });

  it("never launders a length finish into a later stop", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "late" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream continued after its finish reason.");
  });

  it("rejects content after stop before the terminal marker", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "late" }, finish_reason: null }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream continued after its finish reason.");
  });

  it("rejects tool fragments paired with a stop finish", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call-1",
            type: "function",
            function: { name: "remember", arguments: "{}" },
          }],
        },
        finish_reason: "stop",
      }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider finish event contained a non-empty delta.");
  });

  it.each([
    ["a non-array collection", {}],
    ["an empty collection", []],
    ["a scalar call", [7]],
    ["a call without an index", [{ id: "call-1", type: "function", function: { name: "remember", arguments: "{}" } }]],
    ["a negative index", [{ index: -1, id: "call-1", type: "function", function: { name: "remember", arguments: "{}" } }]],
    ["an unknown call field", [{ index: 0, id: "call-1", type: "function", surprise: true, function: { name: "remember", arguments: "{}" } }]],
    ["a non-function type", [{ index: 0, id: "call-1", type: "command", function: { name: "remember", arguments: "{}" } }]],
    ["a non-string id", [{ index: 0, id: 7, type: "function", function: { name: "remember", arguments: "{}" } }]],
    ["a scalar function", [{ index: 0, id: "call-1", type: "function", function: 7 }]],
    ["an unknown function field", [{ index: 0, id: "call-1", type: "function", function: { name: "remember", arguments: "{}", surprise: true } }]],
    ["a non-string name", [{ index: 0, id: "call-1", type: "function", function: { name: 7, arguments: "{}" } }]],
    ["non-string arguments", [{ index: 0, id: "call-1", type: "function", function: { name: "remember", arguments: {} } }]],
  ])("rejects tool_calls with %s", async (_label, toolCalls) => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: toolCalls }, finish_reason: null }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream contained an invalid tool-call shape.");
  });

  it("rejects mutable tool identity across fragments", async () => {
    const fragments = [
      { index: 0, id: "call-1", type: "function", function: { name: "remember", arguments: "{" } },
      { index: 0, id: "call-2", function: { name: "other", arguments: "}" } },
    ];
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [fragments[0]] }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [fragments[1]] }, finish_reason: null }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider tool-call identity changed during streaming.");
  });

  it("rejects incomplete tool calls instead of synthesizing protocol identity", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{
        delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] },
        finish_reason: null,
      }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider, {
      maxRounds: 2,
      resolveToolCall: () => ({ result: "ok" }),
    }))))
      .rejects.toThrow("Provider emitted an incomplete tool call.");
  });

  it("rejects unknown or unresolved provider tool calls", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call-1",
            type: "function",
            function: { name: "unauthorized_tool", arguments: "{}" },
          }],
        },
        finish_reason: null,
      }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider, {
      maxRounds: 2,
      resolveToolCall: () => null,
    }))))
      .rejects.toThrow("Provider emitted an unresolved tool call.");
  });

  it("rejects tool calls during the reserved final round", async () => {
    const provider = new Response([
      `data: ${JSON.stringify({ choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call-1",
            type: "function",
            function: { name: "remember", arguments: "{}" },
          }],
        },
        finish_reason: null,
      }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""));

    await expect(collect(streamProviderToolLoop(options(provider, {
      resolveToolCall: () => ({ result: "ok" }),
    }))))
      .rejects.toThrow("Provider emitted tool calls during the reserved final round.");
  });

  it("bounds each outbound provider request after tool-round growth", async () => {
    let requested = false;
    const providerOptions = options(new Response("data: [DONE]\n\n"), {
      messages: [{ role: "user", content: "x".repeat(200) }],
      maxProviderRequestBytes: 100,
      requestRound: async () => {
        requested = true;
        return new Response("data: [DONE]\n\n");
      },
    });

    await expect(collect(streamProviderToolLoop(providerOptions)))
      .rejects.toThrow("Provider request exceeded the byte limit.");
    expect(requested).toBe(false);
  });

  it("bounds the exact serialized OpenRouter request body", () => {
    let requested = false;
    expect(() => requestNarratorRound({
      apiKey: ["test", "key"].join("-"),
      model: "test-model",
      effort: null,
      messages: [{ role: "user", content: "x".repeat(200) }],
      tools: [],
      toolChoice: "none",
      maxRequestBytes: 100,
      fetcher: async () => {
        requested = true;
        return new Response();
      },
    })).toThrow("Provider request exceeded the byte limit.");
    expect(requested).toBe(false);
  });

  it("passes cancellation into the OpenRouter fetch", async () => {
    const controller = new AbortController();
    let receivedSignal;

    await requestNarratorRound({
      apiKey: ["not", "a", "credential"].join("-"),
      model: "test-model",
      effort: null,
      messages: [{ role: "user", content: "hello" }],
      tools: [],
      toolChoice: "none",
      signal: controller.signal,
      fetcher: async (_url, init) => {
        receivedSignal = init.signal;
        return new Response();
      },
    });

    expect(receivedSignal).toBe(controller.signal);
  });

  it("propagates an aborted edge request through an in-flight provider round", async () => {
    const requestController = new AbortController();
    let providerSignal;
    const providerOptions = options(new Response(), {
      signal: requestController.signal,
      requestRound: async (request) => {
        providerSignal = request.signal;
        return new Promise((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
        });
      },
    });
    const read = streamProviderToolLoop(providerOptions).getReader().read();

    requestController.abort(new Error("edge request aborted"));

    await expect(read).rejects.toThrow("edge request aborted");
    expect(providerSignal.aborted).toBe(true);
  });

  it("does not read or reflect an unbounded provider error body", async () => {
    const text = () => Promise.reject(new Error("reflected provider secret"));
    const provider = { ok: false, body: null, status: 502, text };

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("narrator provider request failed");
  });
});
