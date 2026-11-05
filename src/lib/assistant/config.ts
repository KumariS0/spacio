import "server-only";

/** OpenRouter's automatic model router; set OPENROUTER_MODEL to pin a model (e.g. a Google Gemini model). */
export const DEFAULT_ASSISTANT_MODEL = "openrouter/auto";

/** Server-only assistant settings. Returns null when no API key is configured. */
export function assistantConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const int = (v: string | undefined, d: number, min: number, max: number) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
  };
  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL,
    limit: int(process.env.ASSISTANT_RATE_LIMIT, 20, 1, 200),
    windowSeconds: int(process.env.ASSISTANT_RATE_WINDOW_SECONDS, 600, 10, 86_400),
    /** Visitors who aren't signed in get general help only (no live or personal data). */
    guestEnabled: (process.env.ASSISTANT_GUEST_MODE ?? "on").trim().toLowerCase() !== "off",
    guestLimit: int(process.env.ASSISTANT_GUEST_RATE_LIMIT, 8, 1, 100),
    guestGlobalPerHour: int(process.env.ASSISTANT_GUEST_GLOBAL_LIMIT, 150, 1, 10_000),
  };
}

export function isAssistantConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/** Whether Nook should appear for visitors who aren't signed in. */
export function isGuestAssistantEnabled() {
  return isAssistantConfigured() && (process.env.ASSISTANT_GUEST_MODE ?? "on").trim().toLowerCase() !== "off";
}
