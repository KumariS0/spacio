import { describe, it, expect } from "vitest";
import { createTestDb } from "./harness";

describe("migrations", () => {
  it("apply cleanly with the seed", async () => {
    const db = await createTestDb();
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.facilities");
    expect(r.rows[0].n).toBe(6);
  });
});
