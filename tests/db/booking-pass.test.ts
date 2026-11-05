import { beforeAll, describe, expect, it } from "vitest";
import { addMinutes, asUser, createTestDb, createUser, expectError, one, slotStart, type Db } from "./harness";

type PassResult = {
  result: string;
  state?: string;
  reservation?: { id: string; status: string; seat_label: string | null } | null;
  student?: { name: string | null; email: string } | null;
  facility?: { slug: string; name: string; building: string | null } | null;
};

let db: Db;
let student: string;
let other: string;
let admin: string;
let library: { id: string };
let seatId: string;

async function book(uid: string, start: string, end: string) {
  const rows = await asUser<{ id: string }>(db, uid, `select public.book_seat($1, $2, $3) as id`, [seatId, start, end]);
  return rows[0].id;
}
async function passOf(uid: string, reservationId: string) {
  // Read through the owner's own session, exactly as the booking page does.
  const rows = await asUser<{ pass_token: string }>(db, uid, `select pass_token from public.reservations where id = $1`, [reservationId]);
  return rows[0]?.pass_token;
}
async function lookup(uid: string, token: string) {
  return (await asUser<{ r: PassResult }>(db, uid, `select public.staff_lookup_pass($1) as r`, [token]))[0].r;
}
async function act(uid: string, token: string, action: "check_in" | "check_out") {
  return (await asUser<{ r: PassResult }>(db, uid, `select public.staff_pass_action($1, $2) as r`, [token, action]))[0].r;
}

beforeAll(async () => {
  db = await createTestDb();
  student = await createUser(db, "pia@srmist.edu.in", { name: "Pia" });
  other = await createUser(db, "quinn@srmist.edu.in", { name: "Quinn" });
  admin = await createUser(db, "gate@srmist.edu.in", { name: "Gate Staff" });
  await db.query(`select public.grant_admin('gate@srmist.edu.in')`);
  library = await one(db, `select id from public.facilities where slug = 'central-library'`);
  seatId = (await one<{ id: string }>(db, `select id from public.facility_seats where facility_id = $1 and status = 'active' order by label desc limit 1`, [library.id])).id;
});

describe("booking passes", () => {
  let resId: string;
  let token: string;

  it("every new booking gets its own random pass, visible to its owner only", async () => {
    const start = await slotStart(db, 0);
    resId = await book(student, start, addMinutes(start, 60));
    token = (await passOf(student, resId))!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,64}$/);
    // Another student can't read the row at all (RLS).
    expect(await passOf(other, resId)).toBeUndefined();
  });

  it("students cannot use the staff functions", async () => {
    expect(await expectError(lookup(student, token))).toBe("FORBIDDEN");
    expect(await expectError(act(student, token, "check_in"))).toBe("FORBIDDEN");
    expect(await expectError(act(other, token, "check_in"))).toBe("FORBIDDEN");
  });

  it("students cannot call the internal helpers that build pass details", async () => {
    const msg = await expectError(asUser(db, other, `select public._pass_json(r, 'x') from public.reservations r limit 1`));
    expect(msg).toMatch(/permission denied/);
  });

  it("an unknown pass is rejected", async () => {
    expect((await lookup(admin, "not-a-real-pass-token-xxxxxxxx")).result).toBe("INVALID_PASS");
    expect((await act(admin, "not-a-real-pass-token-xxxxxxxx", "check_in")).result).toBe("INVALID_PASS");
  });

  it("looking up a pass shows who and where without changing anything", async () => {
    const r = await lookup(admin, token);
    expect(r.result).toBe("FOUND");
    expect(r.state).toBe("CHECK_IN");
    expect(r.student?.name).toBe("Pia");
    expect(r.facility?.slug).toBe("central-library");
    expect(r.reservation?.seat_label).toMatch(/^[A-Z]\d{2}$/);
    expect(r.reservation?.status).toBe("BOOKED");
  });

  it("check-out before check-in is refused", async () => {
    expect((await act(admin, token, "check_out")).result).toBe("NOT_CHECKED_IN");
  });

  it("an admin checks the student in and is recorded as the one who did it", async () => {
    const r = await act(admin, token, "check_in");
    expect(r.result).toBe("CHECKED_IN");
    expect(r.state).toBe("CHECK_OUT");
    const row = await one<{ status: string; checked_in_by: string; checked_in_at: string | null }>(
      db, `select status, checked_in_by, checked_in_at from public.reservations where id = $1`, [resId]);
    expect(row.status).toBe("CHECKED_IN");
    expect(row.checked_in_by).toBe(admin);
    expect(row.checked_in_at).not.toBeNull();
  });

  it("a second check-in is reported, not repeated", async () => {
    expect((await act(admin, token, "check_in")).result).toBe("ALREADY_CHECKED_IN");
  });

  it("the same pass checks the student out and frees the seat", async () => {
    const r = await act(admin, token, "check_out");
    expect(r.result).toBe("CHECKED_OUT");
    const row = await one<{ status: string; checked_out_by: string }>(db, `select status, checked_out_by from public.reservations where id = $1`, [resId]);
    expect(row).toEqual({ status: "CHECKED_OUT", checked_out_by: admin });
    expect((await act(admin, token, "check_out")).result).toBe("DONE");
    expect((await act(admin, token, "check_in")).result).toBe("DONE");
  });

  it("a pass for a later booking is too early to check in", async () => {
    const start = await slotStart(db, 30);
    const id = await book(student, start, addMinutes(start, 60));
    const t = (await passOf(student, id))!;
    expect((await lookup(admin, t)).state).toBe("TOO_EARLY");
    expect((await act(admin, t, "check_in")).result).toBe("TOO_EARLY");
    const row = await one<{ status: string }>(db, `select status from public.reservations where id = $1`, [id]);
    expect(row.status).toBe("BOOKED");
  });

  it("a cancelled booking's pass no longer works", async () => {
    const start = await slotStart(db, 32);
    const id = await book(other, start, addMinutes(start, 60));
    const t = (await passOf(other, id))!;
    await asUser(db, other, `select public.cancel_reservation($1)`, [id]);
    expect((await act(admin, t, "check_in")).result).toBe("CANCELLED");
  });

  it("pass scans are logged with the admin who scanned", async () => {
    const row = await one<{ n: number }>(
      db, `select count(*)::int as n from public.qr_scan_events where user_id = $1 and action like 'pass_%'`, [admin]);
    expect(row.n).toBeGreaterThanOrEqual(6);
  });
});
