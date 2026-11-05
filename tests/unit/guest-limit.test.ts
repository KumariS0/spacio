import { describe, expect, it } from "vitest";
import { clientKey, createGuestLimiter } from "@/lib/assistant/guest-limit";

describe("guest limiter", () => {
  it("allows up to the per-visitor limit, then returns seconds to wait", () => {
    const l = createGuestLimiter({ perVisitor: 3, windowSeconds: 600, globalPerHour: 100 });
    const t = 1_000_000;
    expect([l.take("a", t), l.take("a", t + 1), l.take("a", t + 2)]).toEqual([0, 0, 0]);
    expect(l.take("a", t + 3)).toBe(600);
    // Another visitor is unaffected.
    expect(l.take("b", t + 3)).toBe(0);
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    const l = createGuestLimiter({ perVisitor: 2, windowSeconds: 60, globalPerHour: 100 });
    l.take("a", 0);
    l.take("a", 30_000);
    expect(l.take("a", 59_000)).toBe(1);
    expect(l.take("a", 60_000)).toBe(0);
  });

  it("enforces the hourly cap across all visitors", () => {
    const l = createGuestLimiter({ perVisitor: 10, windowSeconds: 600, globalPerHour: 3 });
    expect([l.take("a", 0), l.take("b", 0), l.take("c", 0)]).toEqual([0, 0, 0]);
    expect(l.take("d", 0)).toBe(3600);
    expect(l.take("d", 3_600_000)).toBe(0);
  });

  it("rejected requests don't count against the visitor", () => {
    const l = createGuestLimiter({ perVisitor: 1, windowSeconds: 60, globalPerHour: 100 });
    l.take("a", 0);
    for (let i = 1; i < 10; i++) l.take("a", i * 1000);
    expect(l.take("a", 60_000)).toBe(0);
  });

  it("keeps memory bounded", () => {
    const l = createGuestLimiter({ perVisitor: 1, windowSeconds: 600, globalPerHour: 10_000, maxKeys: 2 });
    l.take("a", 0);
    l.take("b", 0);
    l.take("c", 0); // evicts "a"
    expect(l.take("a", 1)).toBe(0);
    expect(l.take("c", 1)).toBeGreaterThan(0);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
