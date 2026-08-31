import { describe, expect, it } from "vitest";
import { streamProviderToolLoop } from "../supabase/functions/narrate/provider-loop.ts";

function providerBody(events) {
  return events
    .map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`)
    .join("");
}

function providerStream(events) {
  return new Response(providerBody(events));
}

function streamOneRound(response) {
  return streamProviderToolLoop({
    requestRound: async () => response,
    request: { apiKey: "test-key", model: "test-model", effort: "max" },
    messages: [],
    tools: [],
    maxRounds: 1,
    resolveToolCall: () => null,
  });
}

describe("narrator provider stream compatibility", () => {
  it("accepts mixed LF and CRLF event delimiters across byte chunks", async () => {
    const encoder = new TextEncoder();
    const finalText = '{"story":[]}';
    const answer = `data: ${JSON.stringify({
      choices: [{ delta: { content: finalText }, finish_reason: "stop" }],
    })}`;
    const upstream = `${answer}\n\r\ndata: [DONE]\n\r\n`;
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(upstream.slice(0, answer.length + 1)));
        controller.enqueue(encoder.encode(upstream.slice(answer.length + 1)));
        controller.close();
      },
    }));

    const downstream = await new Response(streamOneRound(response)).text();

    expect(downstream).toContain(finalText.replaceAll('"', '\\"'));
  });

  it("accepts the last text delta when it also carries the stop finish reason", async () => {
    const finalText = '{"story":[]}';
    const response = providerStream([
      { choices: [{ delta: { content: finalText }, finish_reason: "stop" }] },
      "[DONE]",
    ]);

    const downstream = await new Response(streamOneRound(response)).text();

    expect(downstream).toContain(JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: finalText },
    }));
  });

  it("accepts OpenRouter's content-free usage chunk after the finish chunk", async () => {
    const finalText = '{"story":[]}';
    const response = providerStream([
      {
        choices: [{
          index: 0,
          delta: { role: "assistant", content: finalText },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
      },
      {
        choices: [{
          index: 0,
          delta: { role: "assistant", content: "" },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      "[DONE]",
    ]);

    const downstream = await new Response(streamOneRound(response)).text();

    expect(downstream).toContain(JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: finalText },
    }));
  });

  it("rejects usage before the finish chunk", async () => {
    const response = providerStream([
      {
        choices: [{ delta: { content: "first" }, finish_reason: null }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      },
      { choices: [{ delta: {}, finish_reason: "stop" }] },
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider usage appeared outside its accounting tail.");
  });

  it("rejects usage attached to the content-bearing finish chunk", async () => {
    const response = providerStream([
      {
        choices: [{ delta: { content: "first" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider usage appeared outside its accounting tail.");
  });

  it("rejects conflicting native finish metadata on the usage tail", async () => {
    const response = providerStream([
      {
        choices: [{
          delta: { content: "first" },
          finish_reason: "stop",
          native_finish_reason: "STOP",
        }],
      },
      {
        choices: [{
          delta: { role: "assistant", content: "" },
          finish_reason: "stop",
          native_finish_reason: "COMPLETE",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider usage tail did not match its finish metadata.");
  });

  it("rejects malformed native finish metadata", async () => {
    const response = providerStream([
      {
        choices: [{
          delta: { content: "first" },
          finish_reason: "stop",
          native_finish_reason: { value: "stop" },
        }],
      },
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider stream contained an invalid choice shape.");
  });

  it("turns co-terminal reasoning into safe activity without forwarding private detail", async () => {
    const response = providerStream([
      {
        choices: [{
          delta: {
            reasoning: "PRIVATE_REASONING",
            reasoning_details: [{ type: "reasoning.text", text: "PRIVATE_DETAIL" }],
          },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
      },
      {
        choices: [{
          delta: { role: "assistant", content: "" },
          finish_reason: "stop",
          native_finish_reason: "stop",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      "[DONE]",
    ]);

    const downstream = await new Response(streamOneRound(response)).text();

    expect(downstream).toContain('"thinking":"active"');
    expect(downstream).not.toContain("PRIVATE_REASONING");
    expect(downstream).not.toContain("PRIVATE_DETAIL");
  });

  it("rejects a malformed delta even when it carries a stop finish reason", async () => {
    const response = providerStream([
      { choices: [{ delta: { content: 42 }, finish_reason: "stop" }] },
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider stream contained an invalid content shape.");
  });

  it("rejects answer data after a finish reason", async () => {
    const response = providerStream([
      { choices: [{ delta: { content: "first" }, finish_reason: "stop" }] },
      { choices: [{ delta: { content: "late" }, finish_reason: null }] },
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider stream continued after its finish reason.");
  });

  it("rejects a usage tail that carries answer text", async () => {
    const response = providerStream([
      { choices: [{ delta: { content: "first" }, finish_reason: "stop" }] },
      {
        choices: [{
          delta: { role: "assistant", content: "late" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider stream continued after its finish reason.");
  });

  it("rejects a second usage tail", async () => {
    const usageTail = {
      choices: [{
        delta: { role: "assistant", content: "" },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    };
    const response = providerStream([
      { choices: [{ delta: { content: "first" }, finish_reason: "stop" }] },
      usageTail,
      usageTail,
      "[DONE]",
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider stream continued after its finish reason.");
  });

  it("rejects frames after the explicit provider terminal", async () => {
    const response = providerStream([
      { choices: [{ delta: { content: "first" }, finish_reason: "stop" }] },
      "[DONE]",
      { choices: [{ delta: { content: "late" }, finish_reason: null }] },
    ]);

    await expect(new Response(streamOneRound(response)).text())
      .rejects.toThrow("Provider stream continued after its terminal marker.");
  });

  it("accepts a complete tool-call fragment carrying its tool_calls finish reason", async () => {
    const encoder = new TextEncoder();
    const finalText = '{"story":[]}';
    let firstProviderCancelled = false;
    const firstUpstream = providerBody([
      {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: "call-1",
              type: "function",
              function: { name: "load_narrator_skills", arguments: "{}" },
            }],
          },
          finish_reason: "tool_calls",
          native_finish_reason: "tool_calls",
        }],
      },
      {
        choices: [{
          delta: { role: "assistant", content: "" },
          finish_reason: "tool_calls",
          native_finish_reason: "tool_calls",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      "[DONE]",
    ]);
    const responses = [
      new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(firstUpstream));
          // Hold the first round open so [DONE] must cancel only its reader.
        },
        cancel() {
          firstProviderCancelled = true;
        },
      })),
      providerStream([
        {
          choices: [{
            delta: { content: finalText },
            finish_reason: "stop",
            native_finish_reason: "stop",
          }],
        },
        {
          choices: [{
            delta: { role: "assistant", content: "" },
            finish_reason: "stop",
            native_finish_reason: "stop",
          }],
          usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
        },
        "[DONE]",
      ]),
    ];
    let round = 0;
    const signals = [];
    const stream = streamProviderToolLoop({
      requestRound: async (request) => {
        signals.push(request.signal);
        return responses[round++];
      },
      request: { apiKey: "test-key", model: "test-model", effort: "max" },
      messages: [],
      tools: [{ type: "function", function: { name: "load_narrator_skills" } }],
      maxRounds: 2,
      resolveToolCall: () => ({ result: "loaded" }),
    });

    const downstream = await new Response(stream).text();

    expect(round).toBe(2);
    expect(firstProviderCancelled).toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals[0]).toBe(signals[1]);
    expect(signals[0].aborted).toBe(false);
    expect(downstream).toContain('"type":"narrator_round_reset"');
    expect(downstream).toContain(finalText.replaceAll('"', '\\"'));
  });

  it("finishes at the explicit provider terminal without waiting for transport EOF", async () => {
    const encoder = new TextEncoder();
    const finalText = '{"story":[]}';
    const upstream = [
      { choices: [{ delta: { content: finalText }, finish_reason: "stop" }] },
      "[DONE]",
    ].map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`).join("");
    let providerCancelled = false;
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(upstream));
        // Intentionally hold the transport open after the explicit terminal.
      },
      cancel() {
        providerCancelled = true;
      },
    }));
    const reader = streamOneRound(response).getReader();
    const decoder = new TextDecoder();
    const completion = (async () => {
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) return text;
        text += decoder.decode(value, { stream: true });
      }
    })();

    const settled = await Promise.race([
      completion.then((text) => ({ kind: "done", text })),
      new Promise((resolve) => setTimeout(() => resolve({ kind: "timeout", text: "" }), 100)),
    ]);
    if (settled.kind === "timeout") await reader.cancel("test cleanup");

    expect(settled.kind).toBe("done");
    expect(settled.text).toContain(finalText.replaceAll('"', '\\"'));
    expect(providerCancelled).toBe(true);
  });
});
