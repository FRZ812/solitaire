export type ProviderToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ProviderToolResolution = {
  result: string;
  events?: string[];
};

type ProviderRoundResponse = {
  ok: boolean;
  body: ReadableStream<Uint8Array> | null;
  status: number;
  text(): Promise<string>;
};

type ProviderRequestBase = {
  apiKey: string;
  model: string;
  effort: unknown;
};

type ProviderRoundRequest = ProviderRequestBase & {
  messages: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  toolChoice: "auto" | "none";
  signal?: AbortSignal;
};

type ProviderLoopOptions = {
  requestRound: (request: ProviderRoundRequest) => Promise<ProviderRoundResponse>;
  request: ProviderRequestBase;
  messages: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  maxRounds: number;
  maxProviderBytes?: number;
  maxProviderRequestBytes?: number;
  signal?: AbortSignal;
  resolveToolCall: (toolCall: ProviderToolCall) => ProviderToolResolution | null;
};

type ProviderLoopLifecycle = {
  activeReader: ReadableStreamDefaultReader<Uint8Array> | null;
};

type ProviderByteLedger = {
  received: number;
  limit: number;
};

type ToolCallAcc = ProviderToolCall & {
  sawId: boolean;
  sawType: boolean;
  sawName: boolean;
  sawArguments: boolean;
};

type RoundResult = {
  text: string;
  toolCalls: ProviderToolCall[];
  finishReason: string | null;
  reasoningDetails: unknown[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

const PROVIDER_DELTA_KEYS = new Set([
  "role",
  "content",
  "reasoning",
  "reasoning_content",
  "reasoning_details",
  "tool_calls",
]);
const PROVIDER_TOOL_CALL_KEYS = new Set(["index", "id", "type", "function"]);
const PROVIDER_TOOL_FUNCTION_KEYS = new Set(["name", "arguments"]);

function readOptionalDeltaText(delta: Record<string, unknown>, key: string) {
  if (!hasOwn(delta, key) || delta[key] === null) return "";
  if (typeof delta[key] !== "string") {
    throw new Error(
      key === "content"
        ? "Provider stream contained an invalid content shape."
        : "Provider stream contained an invalid delta shape.",
    );
  }
  return delta[key] as string;
}

function toAnthropicEvent(type: "text_delta" | "thinking_delta", value: string) {
  if (!value) return "";
  // Reasoning content is private provider data. The browser receives only an
  // activity sentinel so it can distinguish connecting from active reasoning.
  const delta = type === "text_delta" ? { type, text: value } : { type, thinking: "active" };
  return `data: ${JSON.stringify({ type: "content_block_delta", delta })}\n\n`;
}

function toRoundResetEvent() {
  return `data: ${JSON.stringify({ type: "narrator_round_reset" })}\n\n`;
}

// Reads one OpenRouter SSE response to completion, forwarding text/thinking
// deltas live and accumulating streamed tool-call fragments by index.
async function pumpOpenRouterRound(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  providerBytes: ProviderByteLedger,
  lifecycle: ProviderLoopLifecycle,
): Promise<RoundResult> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const reader = body.getReader();
  lifecycle.activeReader = reader;
  let buffer = "";
  let text = "";

  let sawTerminalMarker = false;
  let finishReason: string | null = null;
  const reasoningDetails: unknown[] = [];
  const toolCallsByIndex = new Map<number, ToolCallAcc>();

  const consumeFrame = (frame: string) => {
    if (sawTerminalMarker) {
      throw new Error("Provider stream continued after its terminal marker.");
    }
    const lines = frame.split(/\r?\n/).filter(Boolean);
    if (lines.length !== 1) {
      throw new Error("Provider stream contained an invalid SSE frame.");
    }
    const line = lines[0];
    if (!line.startsWith("data:")) {
      throw new Error("Provider stream contained an invalid SSE frame.");
    }
    const payload = line.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      sawTerminalMarker = true;
      return;
    }
    let chunk: Record<string, unknown>;
    try {
      chunk = JSON.parse(payload);
      if (!isPlainRecord(chunk)) throw new Error();
    } catch {
      throw new Error("Provider stream contained malformed JSON.");
    }
    if (Object.prototype.hasOwnProperty.call(chunk, "error")) {
      throw new Error("Provider stream reported an error.");
    }
    if (finishReason !== null) {
      throw new Error("Provider stream continued after its finish reason.");
    }
    const choices = chunk.choices;
    if (!Array.isArray(choices) || choices.length !== 1) {
      throw new Error("Provider stream must contain exactly one choice.");
    }
    if (!isPlainRecord(choices[0])) {
      throw new Error("Provider stream contained an invalid choice shape.");
    }
    {
      const choice = choices[0];
      if (!isPlainRecord(choice.delta)) {
        throw new Error("Provider stream contained an invalid delta shape.");
      }
      const delta = choice.delta;
      if (Object.keys(delta).some((key) => !PROVIDER_DELTA_KEYS.has(key))) {
        throw new Error("Provider stream contained an invalid delta shape.");
      }
      if (hasOwn(delta, "role") && delta.role !== "assistant") {
        throw new Error("Provider stream contained an invalid delta shape.");
      }
      if (hasOwn(choice, "finish_reason")
        && choice.finish_reason !== null
        && typeof choice.finish_reason !== "string") {
        throw new Error("Provider stream contained an invalid choice shape.");
      }
      const nextFinishReason = typeof choice.finish_reason === "string"
        ? choice.finish_reason
        : null;
      if (nextFinishReason !== null && Object.keys(delta).length !== 0) {
        throw new Error("Provider finish event contained a non-empty delta.");
      }
      if (nextFinishReason !== null) finishReason = nextFinishReason;

      const reasoning = readOptionalDeltaText(
        delta,
        hasOwn(delta, "reasoning") ? "reasoning" : "reasoning_content",
      );
      const content = readOptionalDeltaText(delta, "content");
      text += content;
      if (hasOwn(delta, "reasoning_details")
        && (!Array.isArray(delta.reasoning_details)
          || delta.reasoning_details.some((detail) => !isPlainRecord(detail)))) {
        throw new Error("Provider stream contained an invalid delta shape.");
      }
      if (Array.isArray(delta.reasoning_details)) {
        reasoningDetails.push(...delta.reasoning_details);
      }
      const thinkingEvent = toAnthropicEvent("thinking_delta", reasoning);
      const textEvent = toAnthropicEvent("text_delta", content);
      if (thinkingEvent) controller.enqueue(encoder.encode(thinkingEvent));
      if (textEvent) controller.enqueue(encoder.encode(textEvent));

      if (hasOwn(delta, "tool_calls")) {
        if (!Array.isArray(delta.tool_calls) || delta.tool_calls.length === 0) {
          throw new Error("Provider stream contained an invalid tool-call shape.");
        }
        const frameIndices = new Set<number>();
        for (const toolCall of delta.tool_calls) {
          if (!isPlainRecord(toolCall)
            || Object.keys(toolCall).some((key) => !PROVIDER_TOOL_CALL_KEYS.has(key))
            || !Number.isSafeInteger(toolCall.index)
            || (toolCall.index as number) < 0
            || (toolCall.index as number) > 63
            || frameIndices.has(toolCall.index as number)) {
            throw new Error("Provider stream contained an invalid tool-call shape.");
          }
          const index = toolCall.index as number;
          frameIndices.add(index);
          if (!hasOwn(toolCall, "id") && !hasOwn(toolCall, "type") && !hasOwn(toolCall, "function")) {
            throw new Error("Provider stream contained an invalid tool-call shape.");
          }
          if (hasOwn(toolCall, "id")
            && (typeof toolCall.id !== "string" || !toolCall.id || toolCall.id.length > 128)) {
            throw new Error("Provider stream contained an invalid tool-call shape.");
          }
          if (hasOwn(toolCall, "type") && toolCall.type !== "function") {
            throw new Error("Provider stream contained an invalid tool-call shape.");
          }
          if (hasOwn(toolCall, "function")) {
            if (!isPlainRecord(toolCall.function)
              || Object.keys(toolCall.function).length === 0
              || Object.keys(toolCall.function).some((key) => !PROVIDER_TOOL_FUNCTION_KEYS.has(key))) {
              throw new Error("Provider stream contained an invalid tool-call shape.");
            }
            if (hasOwn(toolCall.function, "name")
              && (typeof toolCall.function.name !== "string"
                || !toolCall.function.name
                || toolCall.function.name.length > 128)) {
              throw new Error("Provider stream contained an invalid tool-call shape.");
            }
            if (hasOwn(toolCall.function, "arguments")
              && typeof toolCall.function.arguments !== "string") {
              throw new Error("Provider stream contained an invalid tool-call shape.");
            }
          }

          const existing = toolCallsByIndex.get(index) || {
            id: "",
            name: "",
            arguments: "",
            sawId: false,
            sawType: false,
            sawName: false,
            sawArguments: false,
          };
          if ((typeof toolCall.id === "string" && existing.sawId && existing.id !== toolCall.id)
            || (isPlainRecord(toolCall.function)
              && typeof toolCall.function.name === "string"
              && existing.sawName
              && existing.name !== toolCall.function.name)) {
            throw new Error("Provider tool-call identity changed during streaming.");
          }
          if (typeof toolCall.id === "string") {
            existing.id = toolCall.id;
            existing.sawId = true;
          }
          if (toolCall.type === "function") existing.sawType = true;
          if (isPlainRecord(toolCall.function) && typeof toolCall.function.name === "string") {
            existing.name = toolCall.function.name;
            existing.sawName = true;
          }
          if (isPlainRecord(toolCall.function) && typeof toolCall.function.arguments === "string") {
            existing.arguments += toolCall.function.arguments;
            existing.sawArguments = true;
          }
          toolCallsByIndex.set(index, existing);
        }
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      providerBytes.received += value.byteLength;
      if (providerBytes.received > providerBytes.limit) {
        await reader.cancel().catch(() => {});
        throw new Error("Provider response exceeded the byte limit.");
      }
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const separator = /\r?\n\r?\n/.exec(buffer);
        if (!separator || separator.index === undefined) break;
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        if (frame) consumeFrame(frame);
      }
    }
    buffer += decoder.decode();
    if (buffer) {
      throw new Error("Provider stream ended with an unterminated SSE frame.");
    }
    if (!sawTerminalMarker) {
      throw new Error("Provider stream ended without a terminal marker.");
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock?.();
    if (lifecycle.activeReader === reader) lifecycle.activeReader = null;
  }

  const accumulatedToolCalls = [...toolCallsByIndex.values()];
  if (finishReason === "tool_calls") {
    if (accumulatedToolCalls.some((call) => (
      !call.sawId || !call.sawType || !call.sawName || !call.sawArguments
    ))) {
      throw new Error("Provider emitted an incomplete tool call.");
    }
    const ids = new Set(accumulatedToolCalls.map((call) => call.id));
    if (ids.size !== accumulatedToolCalls.length) {
      throw new Error("Provider emitted duplicate tool-call ids.");
    }
  } else if (accumulatedToolCalls.length > 0) {
    throw new Error("Provider tool-call data did not match its finish reason.");
  }

  return {
    text,
    toolCalls: accumulatedToolCalls.map(({ id, name, arguments: args }) => ({
      id,
      name,
      arguments: args,
    })),
    finishReason,
    reasoningDetails,
  };
}

// Runs a bounded provider/tool loop. Tool calls are enabled only before the
// final round, which is always reserved for a complete structured answer.
export function streamProviderToolLoop(options: ProviderLoopOptions) {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const lifecycle: ProviderLoopLifecycle = { activeReader: null };
  let downstreamCancelled = false;
  const cancelActiveWork = async (reason: unknown) => {
    if (!abortController.signal.aborted) abortController.abort(reason);
    await lifecycle.activeReader?.cancel(reason).catch(() => {});
  };
  const onExternalAbort = () => {
    void cancelActiveWork(options.signal?.reason);
  };
  if (options.signal?.aborted) abortController.abort(options.signal.reason);
  else options.signal?.addEventListener("abort", onExternalAbort, { once: true });
  const maxRounds = Math.max(1, Math.trunc(options.maxRounds));
  const maxProviderBytes = Number.isFinite(options.maxProviderBytes)
    ? Math.max(1, Math.trunc(options.maxProviderBytes as number))
    : 2_000_000;
  const maxProviderRequestBytes = Number.isFinite(options.maxProviderRequestBytes)
    ? Math.max(1, Math.trunc(options.maxProviderRequestBytes as number))
    : 2_000_000;
  const providerBytes: ProviderByteLedger = { received: 0, limit: maxProviderBytes };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const messages = [...options.messages];
      try {
        for (let round = 0; round < maxRounds; round++) {
          const finalRound = round === maxRounds - 1;
          const roundRequest = {
            ...options.request,
            messages,
            tools: options.tools,
            toolChoice: finalRound ? "none" : "auto",
            signal: abortController.signal,
          } as ProviderRoundRequest;
          const { apiKey: _apiKey, signal: _signal, ...providerBodyInput } = roundRequest;
          void _apiKey;
          void _signal;
          if (encoder.encode(JSON.stringify(providerBodyInput)).byteLength > maxProviderRequestBytes) {
            throw new Error("Provider request exceeded the byte limit.");
          }
          const upstream = await options.requestRound(roundRequest);

          if (!upstream.ok || !upstream.body) {
            console.error("OpenRouter narrator request failed", upstream.status);
            throw new Error("narrator provider request failed");
          }

          const { text, toolCalls, finishReason, reasoningDetails } = await pumpOpenRouterRound(
            upstream.body,
            controller,
            encoder,
            providerBytes,
            lifecycle,
          );
          if (finishReason !== "tool_calls") {
            if (finishReason !== "stop") {
              throw new Error("Provider stream ended with a non-success finish reason.");
            }
            break;
          }
          if (finalRound) {
            throw new Error("Provider emitted tool calls during the reserved final round.");
          }

          if (toolCalls.length === 0) {
            throw new Error("Provider emitted an empty tool-call finish.");
          }
          const resolvedCalls = toolCalls.map((toolCall, index) => {
            const normalizedCall = {
              ...toolCall,
              id: toolCall.id || `narrator-tool-${round}-${index}`,
            };
            const resolution = options.resolveToolCall(normalizedCall);
            if (!resolution) {
              throw new Error("Provider emitted an unresolved tool call.");
            }
            return { toolCall: normalizedCall, resolution };
          });

          // Text emitted before a tool call is not the final JSON document.
          // Reset the browser accumulator before streaming the follow-up round.
          controller.enqueue(encoder.encode(toRoundResetEvent()));
          messages.push({
            role: "assistant",
            content: text || null,
            ...(reasoningDetails.length ? { reasoning_details: reasoningDetails } : {}),
            tool_calls: resolvedCalls.map(({ toolCall }) => ({
              id: toolCall.id,
              type: "function",
              function: { name: toolCall.name, arguments: toolCall.arguments },
            })),
          });
          for (const { toolCall, resolution } of resolvedCalls) {
            for (const event of resolution.events || []) {
              controller.enqueue(encoder.encode(event));
            }
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: resolution.result,
            });
          }
        }
      } catch (error) {
        if (!downstreamCancelled) {
          controller.error(abortController.signal.aborted ? abortController.signal.reason : error);
        }
        return;
      } finally {
        options.signal?.removeEventListener("abort", onExternalAbort);
      }
      if (!downstreamCancelled) controller.close();
    },
    async cancel(reason) {
      downstreamCancelled = true;
      options.signal?.removeEventListener("abort", onExternalAbort);
      await cancelActiveWork(reason);
    },
  });
}
