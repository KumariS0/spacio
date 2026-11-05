/**
 * Minimal parser for OpenRouter's OpenAI-compatible streaming responses
 * (Server-Sent Events). Pure functions so they can be unit-tested.
 */

export type StreamEvent = { type: "text"; text: string } | { type: "error"; message: string } | { type: "done" };

/** Splits a buffer into complete SSE lines, returning the unfinished tail. */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop() ?? "";
  return { lines: parts, rest };
}

/** Interprets one SSE line. Comments (": OPENROUTER PROCESSING") and blanks are ignored. */
export function parseLine(line: string): StreamEvent | null {
  if (!line.startsWith("data:")) return null;
  const data = line.slice(5).trim();
  if (!data) return null;
  if (data === "[DONE]") return { type: "done" };
  try {
    const json = JSON.parse(data) as {
      error?: { message?: string };
      choices?: { delta?: { content?: string | null }; finish_reason?: string | null; error?: { message?: string } }[];
    };
    const err = json.error ?? json.choices?.[0]?.error;
    if (err) return { type: "error", message: err.message ?? "The AI service returned an error." };
    const text = json.choices?.[0]?.delta?.content;
    return text ? { type: "text", text } : null;
  } catch {
    return null;
  }
}

/** Reads an SSE body and yields events. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { lines, rest } = splitLines(buffer);
      buffer = rest;
      for (const line of lines) {
        const ev = parseLine(line);
        if (ev) {
          yield ev;
          if (ev.type === "done") return;
        }
      }
    }
    const ev = parseLine(buffer + decoder.decode());
    if (ev) yield ev;
  } finally {
    reader.releaseLock();
  }
}
