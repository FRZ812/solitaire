import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Web-mode narrator backend. Talks to Google's Gemini API and re-emits the
// stream as the minimal Anthropic-style SSE the client already parses
// (data: {"type":"content_block_delta","delta":{"type":"text_delta",...}}),
// so src/engine/api-supabase.js stays provider-agnostic.
//
// Hard-gated: every request must carry a valid Supabase auth JWT AND the
// caller must have an active row in public.subscriptions (is_subscribed =
// true). This is the real abuse barrier; the UI gate is cosmetic.
//
// The system prompt comes IN the request body (the web client already
// bundles src/system-prompt.js — single source of truth, no mirror file).
//
// Requires GEMINI_API_KEY edge-function secret. SUPABASE_URL and
// SUPABASE_ANON_KEY are provided automatically by the edge runtime.

const MODEL = "gemini-3.1-pro-preview";
const HISTORY_LIMIT = 100;
const MAX_BODY_BYTES = 8_000_000; // bumped — request includes the system prompt
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

// Verify the caller's JWT and confirm an active subscription. Returns the
// user id on success, or a ready-to-send error Response.
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

  const gated = await gate(req);
  if (gated instanceof Response) return gated;

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY not configured on the edge function" }, 500);

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
        systemInstruction: { parts: [{ text: system_prompt }] },
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
