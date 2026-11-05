import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDb, createUser, expectError, type Db } from "./harness";

let db: Db;
let student: string;
let outsider: string;

beforeAll(async () => {
  db = await createTestDb();
  student = await createUser(db, "chat1@srmist.edu.in", { name: "Chat Student" });
  // Bypass the sign-up hook to simulate an account outside the allowed domain.
  outsider = await createUser(db, "x@gmail.com", { name: "Outsider" }).catch(async () => {
    const r = await db.query<{ id: string }>(
      "insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), 'x@gmail.com', now()) returning id",
    );
    return r.rows[0].id;
  });
});

describe("assistant rate limit", () => {
  it("allows requests up to the limit, then returns a wait time", async () => {
    const take = async () => (await asUser<{ wait: number }>(db, student, "select public.assistant_take_quota(3, 600) as wait"))[0].wait;
    expect(await take()).toBe(0);
    expect(await take()).toBe(0);
    expect(await take()).toBe(0);
    const wait = await take();
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(600);
  });

  it("is per student", async () => {
    const other = await createUser(db, "chat2@srmist.edu.in", { name: "Other" });
    const r = await asUser<{ wait: number }>(db, other, "select public.assistant_take_quota(3, 600) as wait");
    expect(r[0].wait).toBe(0);
  });

  it("rejects signed-out callers and non-student accounts", async () => {
    expect(await expectError(asAnon(db, "select public.assistant_take_quota(3, 600)"))).toMatch(/permission denied|NOT_AUTHENTICATED/);
    if (outsider) {
      expect(await expectError(asUser(db, outsider, "select public.assistant_take_quota(3, 600)"))).toMatch(/NOT_VERIFIED/);
    }
  });

  it("is not readable or writable directly by students", async () => {
    expect(await expectError(asUser(db, student, "select * from public.assistant_requests"))).toMatch(/permission denied/);
    expect(await expectError(asUser(db, student, "delete from public.assistant_requests"))).toMatch(/permission denied/);
  });
});
