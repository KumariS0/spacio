import { z } from "zod";
import { getViewer, getSupabase } from "@/lib/data";
import { assistantConfig } from "@/lib/assistant/config";
import { buildAssistantContext, buildGuestContext } from "@/lib/assistant/context";
import { clientKey, createGuestLimiter, type GuestLimiter } from "@/lib/assistant/guest-limit";
import { readEvents } from "@/lib/assistant/sse";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === "user", "The last message must be from the user."),
});

const minutes = (seconds: number) => {
  const m = Math.ceil(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
};

const json = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error, ...extra }, { status, headers: { "cache-control": "no-store" } });

// One limiter per server instance, created on first guest request.
let guestLimiter: GuestLimiter | null = null;

/**
 * Nook, the SPACIO assistant. The OpenRouter key is read here on the server
 * and never sent to the browser. The model has no tools — it can't change
 * anything.
 *
 * - Signed-in, verified students: live facility data plus their own bookings,
 *   rate-limited per student in the database.
 * - Visitors who aren't signed in (guest mode, on by default): general help
 *   only, with no live or personal data, rate-limited per IP in memory and by
 *   an hourly cap for the whole instance.
 */
export async function POST(request: Request) {
  const cfg = assistantConfig();
  if (!cfg) return json(503, "Nook (the assistant) isn't set up yet. An administrator needs to add OPENROUTER_API_KEY.");

  // Same-origin check: browsers always send Origin on POST fetches.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, "Cross-site requests aren't allowed.");

  const viewer = await getViewer();
  const isGuest = !viewer;
  if (isGuest && !cfg.guestEnabled) return json(401, "Sign in to chat with Nook.");
  if (viewer && !viewer.profile) return json(403, "Finish setting up your account to chat with Nook.");
  if (viewer && (!viewer.emailVerified || (!viewer.domainAllowed && !viewer.isAdmin))) return json(403, "Only verified SRM student accounts can chat with Nook.");

  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return json(400, "That message couldn't be sent. Keep it under 2,000 characters.");
    body = parsed.data;
  } catch {
    return json(400, "Invalid request.");
  }

  let system: string;
  if (isGuest) {
    guestLimiter ??= createGuestLimiter({ perVisitor: cfg.guestLimit, windowSeconds: cfg.windowSeconds, globalPerHour: cfg.guestGlobalPerHour });
    const wait = guestLimiter.take(clientKey(request.headers));
    if (wait > 0) return json(429, `Nook has a small limit for visitors. ${isSupabaseConfigured() ? "Sign in for more, or try" : "Try"} again in ${minutes(wait)}.`, { retryAfter: wait });
    system = buildGuestContext();
  } else {
    const supabase = await getSupabase();
    const { data: wait, error: quotaError } = await supabase.rpc("assistant_take_quota", { p_limit: cfg.limit, p_window_seconds: cfg.windowSeconds });
    if (quotaError) return json(500, "Nook is unavailable right now.");
    if (typeof wait === "number" && wait > 0) {
      return json(429, `You've sent a lot of messages. Try again in ${minutes(wait)}.`, { retryAfter: wait });
    }
    try {
      system = await buildAssistantContext({ name: viewer?.profile?.full_name ?? null });
    } catch {
      return json(500, "Nook couldn't load SPACIO data. Try again.");
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        "content-type": "application/json",
        // Optional attribution headers recommended by OpenRouter.
        "HTTP-Referer": publicEnv.siteUrl,
        "X-Title": "SPACIO",
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        temperature: 0.3,
        max_tokens: isGuest ? 400 : 600,
        messages: [{ role: "system", content: system }, ...body.messages.slice(-12)],
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
    });
  } catch {
    return json(502, "Couldn't reach the AI service. Check your connection and try again.");
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status;
    console.error("OpenRouter error", status, (await upstream.text().catch(() => "")).slice(0, 300));
    const message =
      status === 401 ? "Nook's API key was rejected. An administrator needs to check OPENROUTER_API_KEY."
      : status === 402 ? "Nook's OpenRouter account is out of credits."
      : status === 429 ? "The AI service is busy. Try again in a moment."
      : status === 400 || status === 404 ? `The configured model (${cfg.model}) isn't available. An administrator needs to check OPENROUTER_MODEL.`
      : "The AI service had a problem. Try again shortly.";
    return json(502, message);
  }

  const encoder = new TextEncoder();
  const source = upstream.body;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        for await (const ev of readEvents(source)) {
          if (ev.type === "text") {
            sent = true;
            controller.enqueue(encoder.encode(ev.text));
          } else if (ev.type === "error") {
            controller.enqueue(encoder.encode(`${sent ? "\n\n" : ""}[The AI service stopped early. Please try again.]`));
            break;
          }
        }
        if (!sent) controller.enqueue(encoder.encode("Sorry, I couldn't come up with an answer. Please try rephrasing."));
      } catch {
        controller.enqueue(encoder.encode(`${sent ? "\n\n" : ""}[Connection interrupted. Please try again.]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-nook-mode": isGuest ? "guest" : "student",
    },
  });
}
