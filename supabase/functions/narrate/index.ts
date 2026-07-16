import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-v4-pro";
const MAX_OUTPUT_TOKENS = 4000;
const MAX_FIELD_LENGTH = 120_000;
const MAX_SYSTEM_PROMPT_LENGTH = 200_000;

const ALLOWED_MODELS = new Set([
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash",
  "google/gemini-3.1-pro-preview",
  "z-ai/glm-5.2",
  "openai/gpt-5.6-luna",
]);

const REASONING_MODELS = new Set([
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash",
  "z-ai/glm-5.2",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function stringField(value: unknown, name: string, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  if (value.length > maxLength) throw new Error(`${name} is too large`);
  return value;
}

function asHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-24).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return [];
    return [{ role, content: content.slice(0, MAX_FIELD_LENGTH) }];
  });
}

function selectedModel(value: unknown) {
  return typeof value === "string" && ALLOWED_MODELS.has(value) ? value : DEFAULT_MODEL;
}

function selectedReasoning(model: string, effort: unknown) {
  if (!REASONING_MODELS.has(model)) return undefined;
  if (effort !== "high" && effort !== "max") return undefined;
  return { effort: effort === "max" ? "xhigh" : "high" };
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => typeof part === "object" && part && "text" in part ? String((part as { text?: unknown }).text || "") : "")
    .join("");
}

function toAnthropicEvent(type: "text_delta" | "thinking_delta", value: string) {
  if (!value) return "";
  const delta = type === "text_delta" ? { type, text: value } : { type, thinking: value };
  return `data: ${JSON.stringify({ type: "content_block_delta", delta })}\n\n`;
}

function openRouterToNarratorStream(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload);
              const delta = chunk?.choices?.[0]?.delta || {};
              const reasoning = toText(delta.reasoning ?? delta.reasoning_content);
              const content = toText(delta.content);
              const thinkingEvent = toAnthropicEvent("thinking_delta", reasoning);
              const textEvent = toAnthropicEvent("text_delta", content);
              if (thinkingEvent) controller.enqueue(encoder.encode(thinkingEvent));
              if (textEvent) controller.enqueue(encoder.encode(textEvent));
            } catch {
              // Ignore malformed provider chunks; a later valid delta may still complete the beat.
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) return json({ error: "not authenticated" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase function environment is incomplete" }, 500);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "not authenticated" }, 401);

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("is_subscribed")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (subscriptionError) return json({ error: "subscription lookup failed" }, 500);
  if (!subscription?.is_subscribed) return json({ error: "subscription required" }, 402);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  let stateContext: string;
  let userMessage: string;
  let systemPrompt: string;
  try {
    stateContext = stringField(payload.state_context, "state_context");
    userMessage = stringField(payload.user_msg, "user_msg");
    systemPrompt = stringField(payload.system_prompt, "system_prompt", MAX_SYSTEM_PROMPT_LENGTH);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "invalid request" }, 400);
  }

  const model = selectedModel(payload.model);
  const reasoning = selectedReasoning(model, payload.reasoning_effort);
  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Solitaire",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...asHistory(payload.history),
        { role: "user", content: `${stateContext}\n\n${userMessage}` },
      ],
      ...(reasoning ? { reasoning } : {}),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = (await upstream.text()).slice(0, 500);
    console.error("OpenRouter narrator request failed", upstream.status, detail);
    return json({ error: "narrator provider request failed" }, 502);
  }

  return new Response(openRouterToNarratorStream(upstream.body), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
