const TERMINAL_EVENT = new TextEncoder().encode('data: {"type":"message_stop"}\n\n');

export async function readBoundedJsonRequest(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Narrator request exceeded the byte limit.");
  }
  if (!request.body) throw new Error("invalid JSON");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("Narrator request exceeded the byte limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("invalid JSON");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid JSON");
  }
  return parsed as Record<string, unknown>;
}

export function finalizeBoundedNarratorSSE(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  let sourceReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let downstreamCancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      sourceReader = reader;
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total + TERMINAL_EVENT.byteLength > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new Error("Narrator response exceeded the byte limit.");
          }
          controller.enqueue(value);
        }
        if (downstreamCancelled) return;
        controller.enqueue(TERMINAL_EVENT);
        controller.close();
      } catch (error) {
        if (!downstreamCancelled) controller.error(error);
      } finally {
        reader.releaseLock?.();
        if (sourceReader === reader) sourceReader = null;
      }
    },
    async cancel(reason) {
      downstreamCancelled = true;
      await sourceReader?.cancel(reason).catch(() => {});
    },
  });
}
