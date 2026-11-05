/**
 * Best-effort in-memory rate limiting for guests (visitors who aren't signed
 * in). Signed-in students use the database quota instead. Memory is per
 * server instance, so on serverless hosting each instance counts separately;
 * the global cap still bounds what any one instance can spend.
 */
export type GuestLimiter = {
  /** Returns 0 when the request may proceed, otherwise seconds to wait. */
  take(key: string, now?: number): number;
};

export function createGuestLimiter(opts: { perVisitor: number; windowSeconds: number; globalPerHour: number; maxKeys?: number }): GuestLimiter {
  const windowMs = opts.windowSeconds * 1000;
  const hourMs = 3_600_000;
  const maxKeys = opts.maxKeys ?? 5_000;
  const visitors = new Map<string, number[]>();
  let global: number[] = [];

  return {
    take(key, now = Date.now()) {
      global = global.filter((t) => now - t < hourMs);
      if (global.length >= opts.globalPerHour) return Math.max(1, Math.ceil((global[0] + hourMs - now) / 1000));

      const hits = (visitors.get(key) ?? []).filter((t) => now - t < windowMs);
      if (hits.length >= opts.perVisitor) {
        visitors.set(key, hits);
        return Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
      }

      hits.push(now);
      visitors.delete(key); // re-insert so Map order tracks recency
      visitors.set(key, hits);
      global.push(now);

      // Bound memory: drop the least recently used visitors.
      while (visitors.size > maxKeys) visitors.delete(visitors.keys().next().value as string);
      return 0;
    },
  };
}

/** The client's IP as reported by the hosting proxy, or a shared bucket. */
export function clientKey(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
