// Web-mode narrator call. Invokes the `narrate` Supabase Edge Function,
// which gates on auth + the manual subscription allowlist (server-side),
// calls OpenRouter, and re-emits the stream as Anthropic-style SSE. The client
// buffers answer text, requires one exact JSON document, compiles it against
// the captured turn contract, and only then returns it to the application.
//
// The system prompt is bundled in the web client (src/system-prompt.js) —
// single source of truth, no mirror file on the function side.
import { supabase } from "./supabase-client.js";
import { buildStateContext } from "./api.js";
import { selectStateContext } from "./narrator/context-sections.js";
import { SYSTEM_PROMPT } from "../system-prompt.js";
import { getNarratorModel, getNarratorEffort } from "./narrator-models.js";
import { prepareNarratorHistory } from "./narrator-history.js";
import { normalizeNarratorSettings } from "./narrator-settings.js";
import { mergeMemoryBank } from "./memory.js";
import { withAbortTimeout } from "./request-timeout.js";
import { NARRATOR_SKILLS } from "../narrator-instructions.js";
import { buildNarratorProjection, narratorTurnPolicy } from "./narrator-projection.js";
import { compileNarratorCandidate } from "./narrator-turn-compiler.js";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/narrate`;
// Only abandon a genuinely dead connection. Narrator models may reason for a
// long time, especially across on-demand skill rounds.
export const NARRATOR_TURN_TIMEOUT_MS = 1_800_000;
const NARRATOR_TIMEOUT_MESSAGE = "Narrator request timed out. Please retry.";
const MAX_NARRATOR_REQUEST_BYTES = 2_000_000;
const MAX_NARRATOR_RESPONSE_BYTES = 2_000_000;

// Retry hint prepended to userMsgRaw on attempt 1 when attempt 0's story
// arrived truncated (for example, a mid-stream provider cut). Nudges the model
// to be terser without imposing an output-token cap.
const RETRY_HINT_1 =
  "[RETRY HINT: your previous response was cut short mid-stream; deliver this story sequence more concisely (target ≤ 300 player-facing words), same intent.]";

// Stronger nudge on attempt 2: ask for a paraphrase in different words at an
// even tighter budget. The [PLAYER ACTION] input is procedurally generated
// and unlikely to be the trigger, so both retries act on the output side.
const RETRY_HINT_2 =
  "[RETRY HINT 2: previous attempt still cut short. Paraphrase your intended story sequence in different words — terse (≤ 150 player-facing words), avoid graphic embellishment, preserve the core action. Output complete, well-formed JSON.]";

// onProgress receives only non-story progress (`thinking`, `reset`, memory).
// Candidate answer text remains private until strict parsing and compilation
// succeed. Parse and contract failures receive at most two bounded repair
// attempts; no rejected prose or partial candidate is returned.
function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new Error(signal.reason == null ? "Request cancelled." : String(signal.reason));
}

function parseStrictNarratorCandidate(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function decodeNarratorBytes(decoder, value, options) {
  try {
    return decoder.decode(value, options);
  } catch {
    throw new Error("Narrator stream contained invalid UTF-8.");
  }
}

export function callNarrator(
  state,
  userMsgRaw,
  onProgress,
  {
    signal = null,
    timeoutMs = NARRATOR_TURN_TIMEOUT_MS,
    projection = buildNarratorProjection(state),
    turnPolicy = narratorTurnPolicy(userMsgRaw, state),
    canonicalUserMsg = userMsgRaw,
  } = {},
) {
  return withAbortTimeout(
    (deadlineSignal) => callNarratorWithinDeadline(
      state,
      userMsgRaw,
      onProgress,
      deadlineSignal,
      projection,
      turnPolicy,
      canonicalUserMsg,
    ),
    timeoutMs,
    NARRATOR_TIMEOUT_MESSAGE,
    signal,
  );
}

export function narratorTurnPolicyContext(turnPolicy) {
  const contract = {
    id: turnPolicy.id,
    required_skills: turnPolicy.requiredSkillIds || [],
    allowed_effects: turnPolicy.allowedEffects || [],
    ...(turnPolicy.effectConstraints ? { effect_constraints: turnPolicy.effectConstraints } : {}),
    ...(turnPolicy.continuation?.terminalEffect
      ? { terminal_effect: turnPolicy.continuation.terminalEffect }
      : {}),
    ...(turnPolicy.storyCharacterIds?.length
      ? { story_character_ids: turnPolicy.storyCharacterIds }
      : {}),
  };
  return `[TURN POLICY — ${JSON.stringify(contract)}. All other effect fields must remain neutral. If an allowed effect is materially established by the accepted scene, emit it in this same response; never hide a mechanical result only in story.]`;
}

async function callNarratorWithinDeadline(
  state,
  userMsgRaw,
  onProgress,
  signal,
  projection,
  turnPolicy,
  canonicalUserMsg,
) {
  // Context is selected rather than appended wholesale. At the default budget every section
  // fits and this is byte-identical to the old block — proven against real campaign states
  // in context-sections.test.js — so what changes today is only that a campaign which grows
  // past the budget drops whole sections by rank instead of overflowing.
  const selectedContext = selectStateContext(buildStateContext(state), {
    route: turnPolicy.id,
  });
  const state_context = [
    selectedContext.text,
    projection.context,
    narratorTurnPolicyContext(turnPolicy),
  ].join("\n");
  const trimmedHistory = prepareNarratorHistory(state.apiHistory);
  const narratorSettings = normalizeNarratorSettings(state.narratorSettings);
  const existing_memories = mergeMemoryBank([], state.memories);
  // Which model + thinking effort the edge function should use — read once so
  // all three attempts in a turn match even if the player flips them mid-stream.
  const model = getNarratorModel();
  const reasoning_effort = getNarratorEffort();

  throwIfAborted(signal);
  const { data: { session } } = await supabase.auth.getSession();
  throwIfAborted(signal);
  if (!session?.access_token) throw new Error("not authenticated");

  let violations = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const retryHint = attempt === 0 ? "" : contractRetryHint(violations, attempt);
    let response;
    try {
      response = await runOneAttempt({
        session,
        state_context,
        history: trimmedHistory,
        userMsgRaw: retryHint ? `${retryHint}\n${userMsgRaw}` : userMsgRaw,
        canonicalUserMsg,
        onProgress,
        model,
        reasoning_effort,
        memory_mode: narratorSettings.memoryMode,
        existing_memories,
        required_narrator_skills: turnPolicy.requiredSkillIds,
        allowed_narrator_skills: turnPolicy.allowedSkillIds,
      }, signal);
    } catch (error) {
      throwIfAborted(signal);
      if (attempt === 0) throw error;
      throw new Error("Narrator repair request failed; no candidate was applied.");
    }

    if (!response.candidate) {
      violations = [{ code: "PARSE_FAILED", path: "/", message: "Response was not complete JSON." }];
      continue;
    }
    if (response.candidate._truncated) {
      violations = [{ code: "TRUNCATED_RESPONSE", path: "/", message: "Response ended before the JSON contract completed." }];
      continue;
    }

    const compiled = compileNarratorCandidate({
      candidate: response.candidate,
      projection,
      turnPolicy,
      state,
      metadata: {
        raw: response.text,
        userMsg: response.userMsg,
        model,
        memories: response.memories,
        memoryProposals: response.memoryProposals,
      },
    });
    if (!compiled.ok) {
      violations = compiled.violations;
      continue;
    }
    return compiled.turn;
  }
  const detail = objectiveViolationDetails(violations);
  throw new Error(`Narrator response violated the turn contract after 3 attempts: ${detail}`);
}

function objectiveViolationDetails(violations) {
  return violations.slice(0, 8).map(({ code, path }) => {
    const safeCode = typeof code === "string" && /^[A-Z][A-Z0-9_]{0,47}$/.test(code)
      ? code
      : "CONTRACT_VIOLATION";
    const safePath = typeof path === "string"
      && path.length <= 160
      && /^\/(?:[A-Za-z0-9_~-]+(?:\/|$))*$/.test(path)
      ? path
      : "/invalid-key";
    return `${safeCode}:${safePath}`;
  }).join(", ");
}

function contractRetryHint(violations, attempt) {
  const details = objectiveViolationDetails(violations);
  const interrupted = violations.some(({ code }) => code === "PARSE_FAILED" || code === "TRUNCATED_RESPONSE");
  const brevity = interrupted
    ? (attempt === 1 ? RETRY_HINT_1 : RETRY_HINT_2)
    : "[RETRY HINT: the previous candidate failed objective schema or capability validation. Return a fresh, complete JSON document using the exact current contract.]";
  return `${brevity}\n[CONTRACT REPAIR: Return a completely new response using the exact current schema. Fix these objective violations: ${details}. Do not repeat rejected prose.]`;
}

// One round-trip to the narrate edge function. Throws on !response.ok or a
// missing body. Every retry shares the outer turn deadline and cancellation.
async function runOneAttempt(options, signal) {
  throwIfAborted(signal);
  return runOneAttemptWithinDeadline(options, signal);
}

async function runOneAttemptWithinDeadline(
  {
    session, state_context, history, userMsgRaw, canonicalUserMsg = userMsgRaw, onProgress,
    model, reasoning_effort, memory_mode, existing_memories, required_narrator_skills,
    allowed_narrator_skills,
  },
  signal,
) {
  // Mark a fresh attempt so any live-thinking UI clears the prior take.
  onProgress?.({ reset: true });
  const requestBody = JSON.stringify({
    state_context,
    user_msg: userMsgRaw,
    history,
    system_prompt: SYSTEM_PROMPT,
    narrator_skills: NARRATOR_SKILLS,
    model,
    reasoning_effort,
    memory_mode,
    existing_memories,
    required_narrator_skills,
    allowed_narrator_skills,
  });
  if (new TextEncoder().encode(requestBody).byteLength > MAX_NARRATOR_REQUEST_BYTES) {
    throw new Error("Narrator request exceeded the byte limit.");
  }
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: requestBody,
    signal,
  });

  if (!response.ok || !response.body) {
    // Surface gate states cleanly.
    if (response.status === 402) throw new Error("subscription required");
    if (response.status === 401) throw new Error("not authenticated");
    throw new Error(`narrate ${response.status}`);
  }

  const { text, memories, memoryProposals } = await accumulateAnthropicSSE(
    response.body,
    onProgress,
  );
  // Store only the action. The next request already carries a fresh state_context;
  // persisting it inside every history item multiplied payload and save size.
  const userMsg = canonicalUserMsg;
  const parsed = parseStrictNarratorCandidate(text);
  return { candidate: parsed, text, userMsg, memories, memoryProposals };
}

async function accumulateAnthropicSSE(body, onProgress) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let text = "";

  const memories = [];
  const memoryProposals = [];
  let sawSuccessfulTerminalEvent = false;
  let receivedBytes = 0;

  try {
    while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_NARRATOR_RESPONSE_BYTES) {
      throw new Error("Narrator response exceeded the byte limit.");
    }
    buffer += decodeNarratorBytes(decoder, value, { stream: true });

    // Match both LF and CRLF event delimiters — the edge function emits LF,
    // but upstream providers sometimes leak CRLF and we want to stay tolerant.
    let m;
    while ((m = buffer.match(/\r?\n\r?\n/))) {
      const rawEvent = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      const frameLines = rawEvent
        .split(String.fromCharCode(10))
        .map((line) => line.endsWith(String.fromCharCode(13)) ? line.slice(0, -1) : line);
      if (frameLines.some((line) => !line.startsWith("data:"))) {
        throw new Error("Narrator stream contained an invalid SSE frame.");
      }
      const dataPayload = frameLines
        .map(l => l.slice(5).trimStart())
        .join("\n");
      if (!dataPayload) continue;
      let evt;
      try {
        evt = JSON.parse(dataPayload);
      } catch {
        throw new Error("Narrator stream contained malformed JSON.");
      }
      if (sawSuccessfulTerminalEvent) {
        throw new Error("Narrator stream continued after its terminal event.");
      }
      if (!evt || typeof evt !== "object" || Array.isArray(evt) || typeof evt.type !== "string") {
        throw new Error("Narrator stream contained an invalid event shape.");
      }
      if (evt.type === "content_block_delta") {
        if (evt.delta?.type === "text_delta" && typeof evt.delta.text === "string") {
          text += evt.delta.text;
        } else if (evt.delta?.type === "thinking_delta" && typeof evt.delta.thinking === "string") {
          // Never retain or expose provider reasoning text; it is activity only.
          onProgress?.({ thinking: true });
        } else {
          throw new Error("Narrator stream contained an invalid event shape.");
        }
      } else if (evt.type === "memory_delta" && (evt.proposal || evt.fact)) {
        // The typed proposal is preferred; `fact` is the compatibility field a server-first
        // rollout keeps for older clients, and it is the proposal's own text, so reading
        // either gives the same sentence. Both are collected: the flat list keeps every
        // existing consumer working while the typed bank grows underneath it.
        if (evt.proposal && typeof evt.proposal === "object") memoryProposals.push(evt.proposal);
        const fact = evt.proposal?.text ?? evt.fact;
        if (typeof fact === "string" && fact) memories.push(fact);
      } else if (evt.type === "narrator_round_reset") {
        text = "";
        onProgress?.({ reset: true });
      } else if (evt.type === "message_stop") {
        sawSuccessfulTerminalEvent = true;
      } else if (evt.type === "error") {
        throw new Error("Narrator provider reported a stream error.");
      } else {
        throw new Error("Narrator stream contained an unexpected event type.");
      }
    }
  }
    buffer += decodeNarratorBytes(decoder);
    if (buffer) {
      throw new Error("Narrator stream ended with an unterminated frame.");
    }
    if (!sawSuccessfulTerminalEvent) {
      throw new Error("Narrator stream ended without a successful terminal event.");
    }
    return {
      text,
      memories: mergeMemoryBank([], memories),
      memoryProposals,
    };
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock?.();
  }
}
