import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDb, createUser, expectError, type Db } from "./harness";

type Event = {
  event_at: string;
  kind: "in" | "out" | "auto_out";
  student_name: string;
  student_email: string;
  is_demo: boolean;
  facility_name: string;
  seat_label: string | null;
};

let db: Db;
let admin: string;
let student: string;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(readFileSync(path.join(import.meta.dirname, "../../supabase/seed_demo_activity.sql"), "utf8"));
  admin = await createUser(db, "logadmin@srmist.edu.in", { name: "Log Admin" });
  await db.query(`select public.grant_admin('logadmin@srmist.edu.in')`);
  student = await createUser(db, "logstudent@srmist.edu.in", { name: "Log Student" });
});

describe("check-in / check-out activity log", () => {
  it("demo seed creates fictional, flagged students only", async () => {
    const r = await db.query<{ n: number; all_demo: boolean; real_domain: number }>(
      `select count(*)::int n, bool_and(is_demo) all_demo,
              count(*) filter (where email like '%@srmist.edu.in')::int real_domain
         from public.profiles where email like '%@demo.spacio.invalid'`,
    );
    expect(r.rows[0]).toEqual({ n: 8, all_demo: true, real_domain: 0 });
  });

  it("admins see check-ins and check-outs, newest first, with place and seat", async () => {
    const rows = await asUser<Event>(db, admin, "select * from public.admin_recent_activity(50)");
    const count = (k: Event["kind"]) => rows.filter((r) => r.kind === k).length;
    expect([count("in"), count("out"), count("auto_out")]).toEqual([10, 3, 1]);
    const times = rows.map((r) => new Date(r.event_at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(rows[0]).toMatchObject({ kind: "in", student_name: "Ananya Rao", facility_name: "Computer Lab", is_demo: true });
    expect(rows.find((r) => r.kind === "auto_out")).toMatchObject({ student_name: "Sara Thomas", seat_label: "B02" });
    expect(rows.filter((r) => r.kind === "out").map((r) => r.student_name)).toContain("Kabir Singh");
  });

  it("respects the limit", async () => {
    expect((await asUser(db, admin, "select * from public.admin_recent_activity(3)")).length).toBe(3);
  });

  it("is hidden from students and signed-out visitors", async () => {
    expect(await expectError(asUser(db, student, "select * from public.admin_recent_activity(10)"))).toMatch(/FORBIDDEN/);
    expect(await expectError(asAnon(db, "select * from public.admin_recent_activity(10)"))).toMatch(/permission denied/);
  });

  it("students can't mark themselves as demo accounts", async () => {
    expect(await expectError(asUser(db, student, "update public.profiles set is_demo = true where id = $1", [student]))).toMatch(/permission denied/);
  });

  it("demo bookings occupy their seats in live availability", async () => {
    const rows = await asUser<{ label: string; state: string }>(
      db,
      student,
      `select label, state from public.get_seat_map((select id from public.facilities where slug = 'central-library'), now(), now() + interval '1 minute')
        where label in ('A02', 'B04', 'C03') order by label`,
    );
    expect(rows).toEqual([
      { label: "A02", state: "occupied" },
      { label: "B04", state: "available" },
      { label: "C03", state: "occupied" },
    ]);
  });
});
