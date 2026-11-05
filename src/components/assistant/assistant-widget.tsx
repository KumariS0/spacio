"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const STORAGE_KEY = "spacio-assistant";
const SUGGESTIONS = {
  student: ["Where can I study right now?", "Is the gym busy?", "How do I check in?", "When is my next booking?"],
  guest: ["How does booking work?", "Who can sign in?", "How does the booking pass work?", "What if I miss my booking?"],
};
const PAGE_RE = /(\/(?:spaces|bookings|explore|map|saved|pass|scan|profile|help|login)(?:\/[A-Za-z0-9_-]+)*)/g;

/** Renders assistant text with SPACIO page paths turned into links. */
function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const clean = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "");
  const parts = clean.split(PAGE_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Link key={i} href={p} onClick={onNavigate} className="font-medium text-forest underline decoration-forest/40 underline-offset-2 hover:decoration-forest">
            {p}
          </Link>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function AssistantWidget({
  configured,
  mode = "student",
  placement = "above-nav",
}: {
  configured: boolean;
  /** "guest": visitor isn't signed in, so Nook has no live or personal data. */
  mode?: "student" | "guest";
  /** "above-nav" leaves room for the student pages' mobile bottom nav. */
  placement?: "above-nav" | "corner";
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEY}-${mode}`);
      return saved ? (JSON.parse(saved) as Msg[]).slice(-30) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(`${STORAGE_KEY}-${mode}`, JSON.stringify(messages.slice(-30)));
    } catch {
      /* storage unavailable — conversation just won't persist */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, mode]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim().slice(0, 2000);
      if (!content || streaming) return;
      const history: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const update = (fn: (prev: string) => string, error = false) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: fn(last.content), error: error || last.error };
          return next;
        });
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-12).map(({ role, content }) => ({ role, content })) }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          update(() => data?.error ?? "Nook is unavailable right now.", true);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          update((prev) => prev + chunk);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") update((prev) => prev || "Stopped.");
        else update(() => "You seem to be offline. Check your connection and try again.", true);
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming],
  );

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="spacio-assistant"
        aria-label={open ? "Close Nook" : "Ask Nook, the SPACIO assistant"}
        className={cn(
          "fixed right-4 z-40 grid size-13 place-items-center rounded-full bg-forest text-white shadow-pop transition-transform duration-200 hover:bg-forest-deep active:scale-95 md:bottom-6 md:right-6",
          placement === "above-nav" ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
          open && "max-md:hidden",
        )}
      >
        {open ? <X className="size-5.5" aria-hidden /> : <MessageCircle className="size-5.5" aria-hidden />}
      </button>

      {open && (
        <section
          id="spacio-assistant"
          role="dialog"
          aria-label="Nook, the SPACIO assistant"
          className="fixed inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),3.5rem)] z-50 flex flex-col overflow-hidden rounded-t-[20px] border border-line bg-surface shadow-pop animate-rise md:inset-auto md:bottom-24 md:right-6 md:h-[min(600px,calc(100dvh-8rem))] md:w-[400px] md:rounded-card"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-forest-tint text-forest">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[17px] leading-tight text-ink">Nook</h2>
              <p className="text-xs text-muted">Your SPACIO guide · AI can make mistakes</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  setMessages([]);
                }}
                className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
                aria-label="Start a new conversation"
                title="New conversation"
              >
                <RotateCcw className="size-4" aria-hidden />
              </button>
            )}
            <button type="button" onClick={close} className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Close Nook">
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={streaming}>
            {!configured ? (
              <div className="rounded-card border border-moderate/30 bg-moderate-tint p-3.5 text-sm text-moderate-ink">
                <p className="font-semibold">Nook isn’t set up yet</p>
                <p className="mt-1 leading-relaxed">
                  Add <code className="font-mono">OPENROUTER_API_KEY</code> to <code className="font-mono">.env.local</code> and restart the server. See docs/ASSISTANT.md.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="pt-2">
                <p className="text-[15px] text-ink">
                  {mode === "guest"
                    ? "Hi, I’m Nook! Ask me how SPACIO works: signing in, booking, and checking in with your QR pass."
                    : "Hi, I’m Nook! Ask me about spaces, availability, or how booking and check-in work."}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {mode === "guest"
                    ? "Sign in to ask about specific spaces, live availability and your bookings."
                    : "I can’t make bookings for you, but I’ll point you to the right page."}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS[mode].map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => send(s)} className="rounded-full border border-line bg-paper px-3 py-1.5 text-left text-sm text-ink-soft hover:border-forest/40 hover:text-ink">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-[15px] leading-relaxed",
                      m.role === "user" ? "rounded-br-[6px] bg-forest text-white" : m.error ? "rounded-bl-[6px] border border-busy/25 bg-busy-tint text-busy-ink" : "rounded-bl-[6px] bg-sunken text-ink",
                    )}
                  >
                    {m.role === "assistant" && !m.content && streaming && i === messages.length - 1 ? (
                      <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                        <span className="size-1.5 animate-pulse rounded-full bg-muted" />
                        <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
                        <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
                      </span>
                    ) : m.role === "assistant" ? (
                      <RichText text={m.content} onNavigate={close} />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">Message</label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              value={input}
              disabled={!configured}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={!configured ? "Nook isn’t configured" : mode === "guest" ? "Ask Nook a question…" : "Ask Nook about a space…"}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-[12px] border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-forest focus:outline-none disabled:opacity-60"
            />
            {streaming ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white" aria-label="Stop answering">
                <Square className="size-4 fill-current" aria-hidden />
              </button>
            ) : (
              <button type="submit" disabled={!configured || !input.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-forest text-white disabled:opacity-40" aria-label="Send message">
                <ArrowUp className="size-5" aria-hidden />
              </button>
            )}
          </form>
        </section>
      )}
    </>
  );
}
