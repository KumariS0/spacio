import { describe, expect, it } from "vitest";
import { parseLine, readEvents, splitLines, type StreamEvent } from "@/lib/assistant/sse";

const chunk = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;

function streamOf(parts: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p));
      c.close();
    },
  });
}

async function collect(parts: string[]) {
  const out: StreamEvent[] = [];
  for await (const ev of readEvents(streamOf(parts))) out.push(ev);
  return out;
}

describe("OpenRouter stream parsing", () => {
  it("extracts text deltas and ignores comments and blanks", () => {
    expect(parseLine(chunk("Hello"))).toEqual({ type: "text", text: "Hello" });
    expect(parseLine(": OPENROUTER PROCESSING")).toBeNull();
    expect(parseLine("")).toBeNull();
    expect(parseLine("data: [DONE]")).toEqual({ type: "done" });
    expect(parseLine(`data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })}`)).toBeNull();
  });

  it("surfaces mid-stream errors", () => {
    expect(parseLine(`data: ${JSON.stringify({ error: { message: "Provider down" } })}`)).toEqual({ type: "error", message: "Provider down" });
  });

  it("keeps an unfinished line for the next chunk", () => {
    expect(splitLines("data: a\ndata: b\r\ndata: par")).toEqual({ lines: ["data: a", "data: b"], rest: "data: par" });
  });

  it("reassembles events split across network chunks", async () => {
    const full = `${chunk("Library ")}\n\n: keep-alive\n\n${chunk("is quiet.")}\n\ndata: [DONE]\n\n${chunk("ignored")}\n`;
    const parts = [full.slice(0, 17), full.slice(17, 60), full.slice(60)];
    const events = await collect(parts);
    expect(events).toEqual([
      { type: "text", text: "Library " },
      { type: "text", text: "is quiet." },
      { type: "done" },
    ]);
  });

  it("handles a final line without a trailing newline", async () => {
    expect(await collect([chunk("end")])).toEqual([{ type: "text", text: "end" }]);
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode(`${chunk("café ✓")}\n`);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, 40));
        c.enqueue(bytes.slice(40));
        c.close();
      },
    });
    const out: StreamEvent[] = [];
    for await (const ev of readEvents(stream)) out.push(ev);
    expect(out).toEqual([{ type: "text", text: "café ✓" }]);
  });
});
