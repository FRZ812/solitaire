import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Web-mode narrator backend. Streams DeepSeek's response (reasoning + answer)
// and re-emits it as the minimal Anthropic-style SSE the client already parses
// (data: {"type":"content_block_delta","delta":{"type":"text_delta"|"thinking_delta",...}}),
// so src/engine/api-supabase.js stays provider-agnostic.
//
// DeepSeek's API is OpenAI-compatible: it streams chat.completion.chunk events
// whose delta carries `content` (the answer) and `reasoning_content` (the
// thinking trace, when thinking mode is enabled). The stream ends with the
// literal `data: [DONE]`.
//
// Thinking mode: deepseek-v4-pro is the reasoning-heavy model. We enable
// extended thinking ({"thinking":{"type":"enabled"}}) at max reasoning effort
// (reasoning_effort:"max"). Thinking mode does NOT support temperature/top_p/
// presence_penalty/frequency_penalty, so we don't send them.
//
// Event delimiters: handle BOTH LF (\n\n) and CRLF (\r\n\r\n) to stay tolerant.
//
// Hard-gated: every request must carry a valid Supabase auth JWT AND the
// caller must have an active row in public.subscriptions (is_subscribed =
// true). This is the real abuse barrier; the UI gate is cosmetic.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-pro";
const REASONING_EFFORT = "max"; // deepseek-v4-pro thinking effort: "high" | "max"
const HISTORY_LIMIT = 100;
const MAX_BODY_BYTES = 8_000_000;
const MAX_OUTPUT_TOKENS = 65536;

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

async function gate(req: Request): Promise<string | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "not authenticated" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return json({ error: "auth backend not configured on the edge function" }, 500);
  }

  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return json({ error: "not authenticated" }, 401);

  const { data: sub, error: subErr } = await sb
    .from("subscriptions")
    .select("is_subscribed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subErr) return json({ error: "subscription check failed", detail: subErr.message }, 502);
  if (!sub?.is_subscribed) return json({ error: "subscription required" }, 402);
  return user.id;
}

function emitFromDeepSeekPayload(dataPayload: string, controller: TransformStreamDefaultController<string>) {
  if (!dataPayload || dataPayload === "[DONE]") return;
  let evt: any;
  try { evt = JSON.parse(dataPayload); } catch { return; }
  const delta = evt?.choices?.[0]?.delta;
  if (!delta) return;
  // Reasoning trace streams first; emit it as a thinking_delta.
  if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length) {
    controller.enqueue(
      `data: ${JSON.stringify({
        type: "content_block_delta",
        delta: { type: "thinking_delta", thinking: delta.reasoning_content },
      })}\n\n`,
    );
  }
  // Answer text → text_delta.
  if (typeof delta.content === "string" && delta.content.length) {
    controller.enqueue(
      `data: ${JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: delta.content },
      })}\n\n`,
    );
  }
}

// SSE event delimiter regex — matches both \n\n and \r\n\r\n. Inside an
// event, individual lines can be separated by either \n or \r\n.
const EVENT_DELIM = /\r?\n\r?\n/;
const LINE_DELIM = /\r?\n/;

function deepseekToAnthropicSSE(): TransformStream<string, string> {
  let buffer = "";
  const drain = (controller: TransformStreamDefaultController<string>) => {
    while (true) {
      const m = buffer.match(EVENT_DELIM);
      if (!m || m.index === undefined) break;
      const rawEvent = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      const dataPayload = rawEvent
        .split(LINE_DELIM)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      emitFromDeepSeekPayload(dataPayload, controller);
    }
  };
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      drain(controller);
    },
    flush(controller) {
      const rawEvent = buffer.trim();
      if (!rawEvent) return;
      const dataPayload = rawEvent
        .split(LINE_DELIM)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      emitFromDeepSeekPayload(dataPayload, controller);
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

  const gated = await gate(req);
  if (gated instanceof Response) return gated;

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) return json({ error: "DEEPSEEK_API_KEY not configured on the edge function" }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "invalid JSON" }, 400); }

  const { state_context, user_msg, history, system_prompt } = body ?? {};
  if (typeof state_context !== "string" || typeof user_msg !== "string" || !Array.isArray(history)) {
    return json({ error: "expected { state_context, user_msg, history, system_prompt }" }, 400);
  }
  if (typeof system_prompt !== "string" || system_prompt.length === 0) {
    return json({ error: "system_prompt is required" }, 400);
  }

  const trimmedHistory = history.slice(-HISTORY_LIMIT);
  const messages = [
    { role: "system", content: system_prompt },
    ...trimmedHistory.map((m: any) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
    })),
    { role: "user", content: `${state_context}\n\n${user_msg}` },
  ];

  const upstream = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      thinking: { type: "enabled" },
      reasoning_effort: REASONING_EFFORT,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return json({ error: `deepseek ${upstream.status}`, detail: errText.slice(0, 500) }, 502);
  }

  const stream = upstream.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(deepseekToAnthropicSSE())
    .pipeThrough(new TextEncoderStream());

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
