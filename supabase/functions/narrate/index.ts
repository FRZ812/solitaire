import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Web-mode narrator backend. Routes each request to the model the client
// asked for (body.model) and re-emits the upstream stream as the minimal
// Anthropic-style SSE the client already parses (data: {"type":
// "content_block_delta","delta":{"type":"text_delta"|"thinking_delta",...}}),
// so src/engine/api-supabase.js stays provider-agnostic.
//
// Two providers are supported and switchable per request (see MODELS):
//   * Google Gemini — streams candidates[].content.parts with a `thought`
//     flag; thinking budget unlimited.
//   * DeepSeek (OpenAI-compatible chat/completions) — streams choices[].delta
//     with `content` (answer) and `reasoning_content` (thinking trace) when
//     thinking mode is enabled. deepseek-v4-pro runs at max reasoning effort.
//     Thinking mode does NOT accept temperature/top_p/penalties, so we omit
//     them. Stream ends with the literal `data: [DONE]`.
//
// Event delimiters: handle BOTH LF (\n\n) and CRLF (\r\n\r\n) to stay tolerant.
//
// Hard-gated: every request must carry a valid Supabase auth JWT AND the
// caller must have an active row in public.subscriptions (is_subscribed =
// true). This is the real abuse barrier; the UI gate is cosmetic.

type Provider = "gemini" | "deepseek";

type Effort = "high" | "max";

// The model allowlist. Keep in loose sync with src/engine/narrator-models.js;
// an unknown/missing model from the client falls back to DEFAULT_MODEL.
// `defaultEffort` is the DeepSeek thinking effort used when the client doesn't
// send a (valid) one; Gemini ignores effort (dynamic thinking budget).
const MODELS: Record<string, { provider: Provider; defaultEffort?: Effort }> = {
  "gemini-3.1-pro-preview": { provider: "gemini" },
  "deepseek-v4-pro":        { provider: "deepseek", defaultEffort: "max" },
  "deepseek-v4-flash":      { provider: "deepseek", defaultEffort: "high" },
};
const DEFAULT_MODEL = "deepseek-v4-pro";

// Thinking-effort allowlist for DeepSeek. An unknown/missing value from the
// client falls back to the model's defaultEffort.
const EFFORTS = new Set<Effort>(["high", "max"]);

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

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

// ---- SSE re-framing -----------------------------------------------------
// The upstream framing (split events on \n\n or \r\n\r\n, keep `data:` lines)
// is identical for both providers; only the per-event payload shape differs.
// `emit` turns one provider payload into zero or more Anthropic-style deltas.

type Emit = (dataPayload: string, controller: TransformStreamDefaultController<string>) => void;

const EVENT_DELIM = /\r?\n\r?\n/;
const LINE_DELIM = /\r?\n/;

const dataFrom = (rawEvent: string) =>
  rawEvent
    .split(LINE_DELIM)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trimStart())
    .join("\n");

function reframe(emit: Emit): TransformStream<string, string> {
  let buffer = "";
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      while (true) {
        const m = buffer.match(EVENT_DELIM);
        if (!m || m.index === undefined) break;
        const rawEvent = buffer.slice(0, m.index);
        buffer = buffer.slice(m.index + m[0].length);
        emit(dataFrom(rawEvent), controller);
      }
    },
    flush(controller) {
      const rawEvent = buffer.trim();
      if (rawEvent) emit(dataFrom(rawEvent), controller);
    },
  });
}

const thinkingDelta = (s: string) =>
  `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "thinking_delta", thinking: s } })}\n\n`;
const textDelta = (s: string) =>
  `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: s } })}\n\n`;

function emitFromGemini(dataPayload: string, controller: TransformStreamDefaultController<string>) {
  if (!dataPayload || dataPayload === "[DONE]") return;
  let evt: any;
  try { evt = JSON.parse(dataPayload); } catch { return; }
  const parts = evt?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (typeof p?.text !== "string" || !p.text.length) continue;
    controller.enqueue(p.thought === true ? thinkingDelta(p.text) : textDelta(p.text));
  }
}

function emitFromDeepSeek(dataPayload: string, controller: TransformStreamDefaultController<string>) {
  if (!dataPayload || dataPayload === "[DONE]") return;
  let evt: any;
  try { evt = JSON.parse(dataPayload); } catch { return; }
  const delta = evt?.choices?.[0]?.delta;
  if (!delta) return;
  // Reasoning trace streams first.
  if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length) {
    controller.enqueue(thinkingDelta(delta.reasoning_content));
  }
  if (typeof delta.content === "string" && delta.content.length) {
    controller.enqueue(textDelta(delta.content));
  }
}

// ---- Per-provider upstream calls ----------------------------------------

function callGemini(model: string, system_prompt: string, history: any[], userTurn: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY not configured on the edge function" }, 500);

  const contents = history.map((m: any) => ({
    role: m?.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m?.content === "string" ? m.content : String(m?.content ?? "") }],
  }));
  contents.push({ role: "user", parts: [{ text: userTurn }] });

  return fetch(geminiUrl(model), {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system_prompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: -1, includeThoughts: true },
      },
    }),
  });
}

function callDeepSeek(model: string, effort: "high" | "max", system_prompt: string, history: any[], userTurn: string) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) return json({ error: "DEEPSEEK_API_KEY not configured on the edge function" }, 500);

  const messages = [
    { role: "system", content: system_prompt },
    ...history.map((m: any) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
    })),
    { role: "user", content: userTurn },
  ];

  return fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      thinking: { type: "enabled" },
      reasoning_effort: effort,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

  const gated = await gate(req);
  if (gated instanceof Response) return gated;

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

  // Resolve the model: honour body.model when it's on the allowlist, else fall
  // back to the default so an out-of-date client can never wedge narration.
  const requested = typeof body.model === "string" ? body.model : DEFAULT_MODEL;
  const model = MODELS[requested] ? requested : DEFAULT_MODEL;
  const cfg = MODELS[model];

  // Honour body.reasoning_effort when it's on the allowlist, else the model's
  // default. Only consulted for DeepSeek; Gemini ignores it.
  const reqEffort = body.reasoning_effort as Effort;
  const effort: Effort = EFFORTS.has(reqEffort) ? reqEffort : (cfg.defaultEffort ?? "high");

  const trimmedHistory = history.slice(-HISTORY_LIMIT);
  const userTurn = `${state_context}\n\n${user_msg}`;

  const upstreamOrErr = cfg.provider === "gemini"
    ? callGemini(model, system_prompt, trimmedHistory, userTurn)
    : callDeepSeek(model, effort, system_prompt, trimmedHistory, userTurn);

  // The call helpers return a Response (not a Promise) only when a key is
  // missing; otherwise they return the fetch Promise.
  if (upstreamOrErr instanceof Response) return upstreamOrErr;
  const upstream = await upstreamOrErr;

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return json({ error: `${cfg.provider} ${upstream.status}`, detail: errText.slice(0, 500) }, 502);
  }

  const emit = cfg.provider === "gemini" ? emitFromGemini : emitFromDeepSeek;
  const stream = upstream.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(reframe(emit))
    .pipeThrough(new TextEncoderStream());

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
