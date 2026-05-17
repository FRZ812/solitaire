import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";

// Web-mode narrator backend. Talks to Google's Gemini API and re-emits the
// stream as the minimal Anthropic-style SSE the client already parses
// (data: {"type":"content_block_delta","delta":{"type":"text_delta",...}}),
// so src/engine/api-supabase.js needs no knowledge of the provider.
//
// Requires the GEMINI_API_KEY edge-function secret.

const MODEL = "gemini-3.1-pro-preview";
const HISTORY_LIMIT = 100;
const MAX_BODY_BYTES = 1_000_000;
const MAX_OUTPUT_TOKENS = 4000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

// Extract the text deltas from one Gemini SSE data payload and enqueue them
// as Anthropic-style content_block_delta events.
function emitFromGeminiPayload(dataPayload: string, controller: TransformStreamDefaultController<string>) {
  if (!dataPayload || dataPayload === "[DONE]") return;
  let evt: any;
  try { evt = JSON.parse(dataPayload); } catch { return; }
  const parts = evt?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (typeof p?.text === "string" && p.text.length) {
      controller.enqueue(
        `data: ${JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: p.text },
        })}\n\n`,
      );
    }
  }
}

// Gemini `streamGenerateContent?alt=sse` → Anthropic-style SSE. Buffers
// across chunk boundaries and splits on the blank-line event delimiter.
function geminiToAnthropicSSE(): TransformStream<string, string> {
  let buffer = "";
  const drain = (controller: TransformStreamDefaultController<string>) => {
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataPayload = rawEvent
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      emitFromGeminiPayload(dataPayload, controller);
    }
  };
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      drain(controller);
    },
    flush(controller) {
      // Trailing event with no terminating blank line.
      const rawEvent = buffer.trim();
      if (!rawEvent) return;
      const dataPayload = rawEvent
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      emitFromGeminiPayload(dataPayload, controller);
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY not configured on the edge function" }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "invalid JSON" }, 400); }

  const { state_context, user_msg, history } = body ?? {};
  if (typeof state_context !== "string" || typeof user_msg !== "string" || !Array.isArray(history)) {
    return json({ error: "expected { state_context: string, user_msg: string, history: array }" }, 400);
  }

  // Map the Anthropic-style history ({role:"user"|"assistant",content}) into
  // Gemini contents ({role:"user"|"model",parts:[{text}]}).
  const trimmedHistory = history.slice(-HISTORY_LIMIT);
  const contents = trimmedHistory.map((m: any) => ({
    role: m?.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m?.content === "string" ? m.content : String(m?.content ?? "") }],
  }));
  contents.push({ role: "user", parts: [{ text: `${state_context}\n\n${user_msg}` }] });

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return json({ error: `gemini ${upstream.status}`, detail: errText.slice(0, 500) }, 502);
  }

  const stream = upstream.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(geminiToAnthropicSSE())
    .pipeThrough(new TextEncoderStream());

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
