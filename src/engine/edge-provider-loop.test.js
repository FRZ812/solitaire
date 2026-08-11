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

  it("bounds provider bytes even when tool-call data is never forwarded", async () => {
    const provider = new Response(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "x".repeat(200) } }] } }] })}\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider, { maxProviderBytes: 100 }))))
      .rejects.toThrow("Provider response exceeded the byte limit.");
  });

  it("rejects provider EOF without its terminal marker", async () => {
    const provider = new Response(`data: ${JSON.stringify({
      choices: [{ delta: { content: "partial" }, finish_reason: "stop" }],
    })}\n\n`);

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
    const provider = new Response(`data: ${JSON.stringify({
      choices: [{ delta: { content: "truncated" }, finish_reason: "length" }],
    })}\n\ndata: [DONE]\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider))))
      .rejects.toThrow("Provider stream ended with a non-success finish reason.");
  });

  it("rejects unknown or unresolved provider tool calls", async () => {
    const provider = new Response(`data: ${JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call-1",
            function: { name: "unauthorized_tool", arguments: "{}" },
          }],
        },
        finish_reason: "tool_calls",
      }],
    })}\n\ndata: [DONE]\n\n`);

    await expect(collect(streamProviderToolLoop(options(provider, {
      maxRounds: 2,
      resolveToolCall: () => null,
    }))))
      .rejects.toThrow("Provider emitted an unresolved tool call.");
  });

  it("rejects tool calls during the reserved final round", async () => {
    const provider = new Response(`data: ${JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{ index: 0, id: "call-1", function: { name: "remember", arguments: "{}" } }],
        },
        finish_reason: "tool_calls",
      }],
    })}\n\ndata: [DONE]\n\n`);

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
