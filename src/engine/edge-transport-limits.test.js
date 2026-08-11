import { describe, expect, it } from "vitest";
import {
  finalizeBoundedNarratorSSE,
  readBoundedJsonRequest,
} from "../../supabase/functions/narrate/transport-limits.ts";

async function streamText(stream) {
  return new Response(stream).text();
}

describe("edge narrator transport limits", () => {
  it("appends exactly one successful terminal event", async () => {
    const source = new Response('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n').body;

    const output = await streamText(finalizeBoundedNarratorSSE(source, 1_000));

    expect(output).toBe('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\ndata: {"type":"message_stop"}\n\n');
  });

  it("errors instead of forwarding a response beyond the byte ceiling", async () => {
    const source = new Response("x".repeat(101)).body;

    await expect(streamText(finalizeBoundedNarratorSSE(source, 100)))
      .rejects.toThrow("Narrator response exceeded the byte limit.");
  });

  it("cancels the locked source reader when the downstream response is cancelled", async () => {
    const encoder = new TextEncoder();
    let sourceCancelled = false;
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("first"));
      },
      cancel() {
        sourceCancelled = true;
      },
    });
    const reader = finalizeBoundedNarratorSSE(source, 1_000).getReader();

    await reader.read();
    await reader.cancel("browser disconnected");

    expect(sourceCancelled).toBe(true);
  });

  it("parses a bounded JSON request", async () => {
    const request = new Request("https://example.invalid", {
      method: "POST",
      body: JSON.stringify({ user_msg: "hello" }),
    });

    await expect(readBoundedJsonRequest(request, 100)).resolves.toEqual({ user_msg: "hello" });
  });

  it("rejects a chunked request beyond the byte ceiling", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"x":"'));
        controller.enqueue(encoder.encode("y".repeat(101)));
        controller.enqueue(encoder.encode('"}'));
        controller.close();
      },
    });
    const request = new Request("https://example.invalid", { method: "POST", body, duplex: "half" });

    await expect(readBoundedJsonRequest(request, 100))
      .rejects.toThrow("Narrator request exceeded the byte limit.");
  });
});
