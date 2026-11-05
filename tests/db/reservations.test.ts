import { beforeAll, describe, expect, it } from "vitest";
import { addMinutes, asAnon, asUser, createTestDb, createUser, expectError, one, slotStart, type Db } from "./harness";

type Seat = { id: string; label: string };
type ScanResult = {
  result: string;
  facility?: { id: string; slug: string; name: string };
  reservation?: { id: string; status: string; seat_label: string | null } | null;
  other_facility?: { name: string; slug: string } | null;
};

let db: Db;
let alice: string; // student
let bob: string; // student
let carol: string; // student
let admin: string;
let outsider: string; // non-SRM domain
let unconfirmed: string; // SRM domain but email not confirmed
let library: { id: string };
let gym: { id: string };
let auditorium: { id: string };
let libraryToken: string;
let gymToken: string;
let auditoriumToken: string;
let seats: Seat[];

const seat = (label: string) => seats.find((s) => s.label === label)!.id;

async function book(uid: string, seatId: string, start: string, end: string) {
  const rows = await asUser<{ id: string }>(db, uid, `select public.book_seat($1, $2, $3) as id`, [seatId, start, end]);
  return rows[0].id;
}
async function bookCapacity(uid: string, facilityId: string, start: string, end: string) {
  const rows = await asUser<{ id: string }>(db, uid, `select public.book_capacity($1, $2, $3) as id`, [facilityId, start, end]);
  return rows[0].id;
}
async function scan(uid: string, token: string) {
  const rows = await asUser<{ r: ScanResult }>(db, uid, `select public.scan_facility($1) as r`, [token]);
  return rows[0].r;
}
async function checkout(uid: string, reservationId: string, token: string) {
  const rows = await asUser<{ r: ScanResult }>(db, uid, `select public.confirm_checkout($1, $2) as r`, [reservationId, token]);
  return rows[0].r;
}
async function seatState(uid: string, label: string, from?: string, to?: string) {
  const rows = await asUser<{ label: string; state: string; is_mine: boolean }>(
    db, uid, `select label, state, is_mine from public.get_seat_map($1, $2, $3)`, [library.id, from ?? null, to ?? null],
  );
  return rows.find((r) => r.label === label)!;
}
/** Push a check-in back in time so the double-scan guard doesn't apply. */
async function ageCheckIn(id: string) {
  await db.query(`update public.reservations set checked_in_at = checked_in_at - interval '5 minutes' where id = $1`, [id]);
}

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, "alice@srmist.edu.in", { name: "Alice" });
  bob = await createUser(db, "bob@srmist.edu.in", { name: "Bob" });
  carol = await createUser(db, "carol@srmist.edu.in");
  admin = await createUser(db, "warden@srmist.edu.in");
  outsider = await createUser(db, "mallory@gmail.com");
  unconfirmed = await createUser(db, "dave@srmist.edu.in", { confirmed: false });
  await db.query(`select public.grant_admin('warden@srmist.edu.in')`);

  library = await one(db, `select id from public.facilities where slug = 'central-library'`);
  gym = await one(db, `select id from public.facilities where slug = 'fitness-centre'`);
  auditorium = await one(db, `select id from public.facilities where slug = 'main-auditorium'`);
  const tok = async (slug: string) =>
    (await one<{ token: string }>(db,
      `select q.token from public.facility_qr_codes q join public.facilities f on f.id = q.facility_id where f.slug = $1 and q.is_active`, [slug])).token;
  libraryToken = await tok("central-library");
  gymToken = await tok("fitness-centre");
  auditoriumToken = await tok("main-auditorium");
  seats = (await db.query<Seat>(`select id, label from public.facility_seats where facility_id = $1`, [library.id])).rows;
});

describe("profiles & auth", () => {
  it("creates a profile for every new auth user", async () => {
    const p = await one<{ full_name: string; role: string }>(db, `select full_name, role from public.profiles where id = $1`, [alice]);
    expect(p).toEqual({ full_name: "Alice", role: "student" });
  });

  it("before-user-created hook allows SRM emails and rejects other domains", async () => {
    const ok = await one<{ r: Record<string, unknown> }>(db, `select public.hook_before_user_created('{"user":{"email":"x@srmist.edu.in"}}') as r`);
    expect(ok.r).toEqual({});
    const bad = await one<{ r: { error: { http_code: number } } }>(db, `select public.hook_before_user_created('{"user":{"email":"x@gmail.com"}}') as r`);
    expect(bad.r.error.http_code).toBe(403);
    const sneaky = await one<{ r: { error?: unknown } }>(db, `select public.hook_before_user_created('{"user":{"email":"x@srmist.edu.in.evil.com"}}') as r`);
    expect(sneaky.r.error).toBeTruthy();
  });

  it("anon can check a domain but cannot read facilities", async () => {
    const r = await asAnon<{ ok: boolean }>(db, `select public.email_domain_allowed('a@SRMIST.edu.in') as ok`);
    expect(r[0].ok).toBe(true);
    await expect(asAnon(db, `select * from public.facilities`)).rejects.toThrow(/permission denied/);
  });

  it("a student cannot make themselves an admin", async () => {
    const msg = await expectError(asUser(db, alice, `update public.profiles set role = 'admin' where id = $1`, [alice]));
    expect(msg).toMatch(/permission denied/);
    const r = await asUser(db, alice, `update public.profiles set full_name = 'Alice S' where id = $1 returning full_name`, [alice]);
    expect(r).toHaveLength(1);
  });

  it("a student only sees their own profile; an admin sees all", async () => {
    expect(await asUser(db, alice, `select id from public.profiles`)).toHaveLength(1);
    expect((await asUser(db, admin, `select id from public.profiles`)).length).toBeGreaterThanOrEqual(6);
  });

  it("non-SRM and unconfirmed accounts cannot book", async () => {
    const start = await slotStart(db, 30);
    expect(await expectError(book(outsider, seat("A01"), start, addMinutes(start, 60)))).toBe("NOT_VERIFIED");
    expect(await expectError(book(unconfirmed, seat("A01"), start, addMinutes(start, 60)))).toBe("NOT_VERIFIED");
  });
});

describe("seat booking rules", () => {
  it("books an available seat and blocks an overlapping booking of the same seat", async () => {
    const start = await slotStart(db, 24);
    const id = await book(alice, seat("A02"), start, addMinutes(start, 60));
    expect(id).toMatch(/[0-9a-f-]{36}/);
    expect(await expectError(book(bob, seat("A02"), start, addMinutes(start, 60)))).toBe("SEAT_TAKEN");
    // Partial overlap is also blocked.
    expect(await expectError(book(bob, seat("A02"), addMinutes(start, -60), addMinutes(start, 60)))).toBe("SEAT_TAKEN");
    // Back-to-back is fine.
    const next = await book(bob, seat("A02"), addMinutes(start, 60), addMinutes(start, 120));
    expect(next).toBeTruthy();
  });

  it("the database constraint itself rejects overlaps, even bypassing the RPC", async () => {
    const start = await slotStart(db, 26);
    await book(alice, seat("B01"), start, addMinutes(start, 60));
    await expect(
      db.query(
        `insert into public.reservations (user_id, facility_id, seat_id, starts_at, ends_at) values ($1, $2, $3, $4, $5)`,
        [carol, library.id, seat("B01"), addMinutes(start, 30), addMinutes(start, 90)],
      ),
    ).rejects.toThrow(/reservations_no_seat_overlap/);
  });

  it("a student cannot hold two overlapping reservations", async () => {
    const start = await slotStart(db, 28);
    await book(carol, seat("C01"), start, addMinutes(start, 60));
    expect(await expectError(book(carol, seat("C02"), start, addMinutes(start, 60)))).toBe("USER_CONFLICT");
  });

  it("rejects seats under maintenance, past slots, misaligned and over-long bookings", async () => {
    const future = await slotStart(db, 30);
    expect(await expectError(book(bob, seat("D06"), future, addMinutes(future, 60)))).toBe("SEAT_UNAVAILABLE");
    const past = await slotStart(db, -3);
    expect(await expectError(book(bob, seat("D01"), past, addMinutes(past, 60)))).toBe("IN_PAST");
    expect(await expectError(book(bob, seat("D01"), addMinutes(future, 15), addMinutes(future, 75)))).toBe("INVALID_TIME");
    expect(await expectError(book(bob, seat("D01"), future, addMinutes(future, 240)))).toBe("DURATION_TOO_LONG");
    const far = await slotStart(db, 24 * 9);
    expect(await expectError(book(bob, seat("D01"), far, addMinutes(far, 60)))).toBe("TOO_FAR_AHEAD");
  });

  it("rejects bookings outside opening hours", async () => {
    await db.query(`update public.facility_operating_hours set is_closed = true where facility_id = $1`, [library.id]);
    const start = await slotStart(db, 32);
    expect(await expectError(book(bob, seat("D02"), start, addMinutes(start, 60)))).toBe("OUTSIDE_HOURS");
    await db.query(`update public.facility_operating_hours set is_closed = false where facility_id = $1`, [library.id]);
  });

  it("students cannot insert or update reservations directly", async () => {
    const start = await slotStart(db, 40);
    expect(
      await expectError(
        asUser(db, bob, `insert into public.reservations (user_id, facility_id, seat_id, starts_at, ends_at) values ($1,$2,$3,$4,$5)`,
          [bob, library.id, seat("D03"), start, addMinutes(start, 60)]),
      ),
    ).toMatch(/permission denied/);
    expect(await expectError(asUser(db, bob, `update public.reservations set status = 'CHECKED_IN'`))).toMatch(/permission denied/);
  });

  it("students can only read their own reservations", async () => {
    const mine = await asUser<{ user_id: string }>(db, bob, `select user_id from public.reservations`);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.user_id === bob)).toBe(true);
    const all = await asUser(db, admin, `select id from public.reservations`);
    expect(all.length).toBeGreaterThan(mine.length);
  });

  it("enforces the maximum number of upcoming reservations", async () => {
    // Carol has 1 upcoming already (C01). Limit is 3.
    const s1 = await slotStart(db, 50);
    const s2 = await slotStart(db, 52);
    await book(carol, seat("C03"), s1, addMinutes(s1, 60));
    await book(carol, seat("C04"), s2, addMinutes(s2, 60));
    const s3 = await slotStart(db, 54);
    expect(await expectError(book(carol, seat("C05"), s3, addMinutes(s3, 60)))).toBe("TOO_MANY_RESERVATIONS");
  });

  it("only the owner can cancel; cancelled seats are released", async () => {
    const start = await slotStart(db, 60);
    const id = await book(alice, seat("A05"), start, addMinutes(start, 60));
    expect(await expectError(asUser(db, bob, `select public.cancel_reservation($1)`, [id]))).toBe("RESERVATION_NOT_FOUND");
    await asUser(db, alice, `select public.cancel_reservation($1)`, [id]);
    expect(await expectError(asUser(db, alice, `select public.cancel_reservation($1)`, [id]))).toBe("CANNOT_CANCEL");
    expect(await book(bob, seat("A05"), start, addMinutes(start, 60))).toBeTruthy();
  });
});

describe("library check-in / check-out via QR", () => {
  let resId: string;
  let ivy: string; // fresh student with no other bookings

  it("scanning without a reservation returns NO_RESERVATION", async () => {
    ivy = await createUser(db, "ivy@srmist.edu.in");
    const r = await scan(ivy, libraryToken);
    expect(r.result).toBe("NO_RESERVATION");
  });

  it("an invalid QR is rejected", async () => {
    expect((await scan(ivy, "not-a-real-token-xxxxxxxx")).result).toBe("INVALID_QR");
  });

  it("books the current slot and the seat shows as reserved", async () => {
    const start = await slotStart(db, 0);
    resId = await book(ivy, seat("A01"), start, addMinutes(start, 60));
    expect((await seatState(bob, "A01")).state).toBe("reserved");
    expect((await seatState(ivy, "A01")).is_mine).toBe(true);
  });

  it("scanning a different facility's QR does not check in the library booking", async () => {
    const r = await scan(ivy, gymToken);
    expect(r.result).toBe("NO_RESERVATION_HERE");
    expect(r.other_facility?.slug).toBe("central-library");
    const row = await one<{ status: string }>(db, `select status from public.reservations where id = $1`, [resId]);
    expect(row.status).toBe("BOOKED");
  });

  it("location-only facilities are not bookable by QR", async () => {
    expect((await scan(ivy, auditoriumToken)).result).toBe("NOT_BOOKABLE");
  });

  it("scanning the library QR checks in; the seat becomes occupied", async () => {
    const r = await scan(ivy, libraryToken);
    expect(r.result).toBe("CHECKED_IN");
    expect(r.reservation?.id).toBe(resId);
    expect(r.reservation?.seat_label).toBe("A01");
    expect((await seatState(bob, "A01")).state).toBe("occupied");
  });

  it("an immediate repeat scan does not trigger checkout", async () => {
    expect((await scan(ivy, libraryToken)).result).toBe("JUST_CHECKED_IN");
  });

  it("scanning again later asks for checkout confirmation without releasing the seat", async () => {
    await ageCheckIn(resId);
    const r = await scan(ivy, libraryToken);
    expect(r.result).toBe("CONFIRM_CHECKOUT");
    expect(r.reservation?.id).toBe(resId);
    expect((await seatState(bob, "A01")).state).toBe("occupied");
  });

  it("another student cannot check out someone else's reservation", async () => {
    expect((await checkout(bob, resId, libraryToken)).result).toBe("RESERVATION_NOT_FOUND");
  });

  it("checkout with a different facility's QR is refused", async () => {
    expect((await checkout(ivy, resId, gymToken)).result).toBe("WRONG_FACILITY");
  });

  it("confirming checkout releases the seat immediately", async () => {
    const r = await checkout(ivy, resId, libraryToken);
    expect(r.result).toBe("CHECKED_OUT");
    const row = await one<{ status: string; checked_out_at: string | null }>(db,
      `select status, checked_out_at from public.reservations where id = $1`, [resId]);
    expect(row.status).toBe("CHECKED_OUT");
    expect(row.checked_out_at).not.toBeNull();
    expect((await seatState(bob, "A01")).state).toBe("available");
  });

  it("a duplicate checkout is reported, not repeated", async () => {
    expect((await checkout(ivy, resId, libraryToken)).result).toBe("ALREADY_CHECKED_OUT");
  });

  it("another student can now book the released seat for the same slot", async () => {
    const start = await slotStart(db, 0);
    const id = await book(bob, seat("A01"), start, addMinutes(start, 60));
    expect(id).toBeTruthy();
    await asUser(db, bob, `select public.cancel_reservation($1)`, [id]);
  });

  it("a later booking scanned too early returns TOO_EARLY", async () => {
    const start = await slotStart(db, 3);
    await book(ivy, seat("A03"), start, addMinutes(start, 60));
    expect((await scan(ivy, libraryToken)).result).toBe("TOO_EARLY");
  });
});

describe("no-shows and expiry", () => {
  it("a booking not checked in within the grace period becomes NO_SHOW and frees the seat", async () => {
    const r = await one<{ id: string }>(db,
      `insert into public.reservations (user_id, facility_id, seat_id, starts_at, ends_at, created_at)
       values ($1, $2, $3, now() - interval '20 minutes', now() + interval '40 minutes', now() - interval '1 day') returning id`,
      [carol, library.id, seat("B06")]);
    // Even before the sweep, reads treat it as released.
    expect((await seatState(bob, "B06")).state).toBe("available");
    await db.query(`select public.sweep_reservations()`);
    const row = await one<{ status: string }>(db, `select status from public.reservations where id = $1`, [r.id]);
    expect(row.status).toBe("NO_SHOW");
  });

  it("a checked-in reservation past its end becomes EXPIRED", async () => {
    const r = await one<{ id: string }>(db,
      `insert into public.reservations (user_id, facility_id, seat_id, starts_at, ends_at, status, checked_in_at)
       values ($1, $2, $3, now() - interval '3 hours', now() - interval '2 hours', 'CHECKED_IN', now() - interval '3 hours') returning id`,
      [carol, library.id, seat("B05")]);
    await db.query(`select public.sweep_reservations()`);
    const row = await one<{ status: string; checked_out_at: string }>(db,
      `select status, checked_out_at from public.reservations where id = $1`, [r.id]);
    expect(row.status).toBe("EXPIRED");
    expect(row.checked_out_at).not.toBeNull();
  });
});

describe("gym capacity bookings", () => {
  it("cannot exceed the configured capacity; checkout frees a place", async () => {
    await db.query(`update public.facilities set capacity = 2 where id = $1`, [gym.id]);
    const [g1, g2, g3] = await Promise.all([
      createUser(db, "g1@srmist.edu.in"), createUser(db, "g2@srmist.edu.in"), createUser(db, "g3@srmist.edu.in"),
    ]);
    const start = await slotStart(db, 0);
    const end = addMinutes(start, 60);
    const first = await bookCapacity(g1, gym.id, start, end);
    await bookCapacity(g2, gym.id, start, end);
    expect(await expectError(bookCapacity(g3, gym.id, start, end))).toBe("CAPACITY_FULL");

    const avail = await asUser<{ capacity: number; reserved: number; available: number }>(db, g3,
      `select capacity, reserved, available from public.get_facility_availability(array[$1]::uuid[])`, [gym.id]);
    expect(avail[0]).toMatchObject({ capacity: 2, reserved: 2, available: 0 });

    expect((await scan(g1, gymToken)).result).toBe("CHECKED_IN");
    const occ = await asUser<{ occupied: number; reserved: number }>(db, g3,
      `select occupied, reserved from public.get_facility_availability(array[$1]::uuid[])`, [gym.id]);
    expect(occ[0]).toMatchObject({ occupied: 1, reserved: 1 });

    await ageCheckIn(first);
    expect((await scan(g1, gymToken)).result).toBe("CONFIRM_CHECKOUT");
    expect((await checkout(g1, first, gymToken)).result).toBe("CHECKED_OUT");
    expect(await bookCapacity(g3, gym.id, start, end)).toBeTruthy();
    await db.query(`update public.facilities set capacity = 100 where id = $1`, [gym.id]);
  });

  it("seat booking is refused for a capacity facility and vice versa", async () => {
    const start = await slotStart(db, 70);
    const g = await createUser(db, "gina@srmist.edu.in");
    expect(await expectError(bookCapacity(g, library.id, start, addMinutes(start, 60)))).toBe("WRONG_BOOKING_MODE");
    expect(await expectError(bookCapacity(g, auditorium.id, start, addMinutes(start, 60)))).toBe("WRONG_BOOKING_MODE");
  });

  it("slot listing reports capacity and bookings", async () => {
    const rows = await asUser<{ capacity: number; booked: number; available: number }>(db, alice,
      `select capacity, booked, available from public.get_facility_slots($1, (now() at time zone 'Asia/Kolkata')::date)`, [gym.id]);
    expect(rows.length).toBe(24);
    expect(rows.every((r) => r.available === r.capacity - r.booked)).toBe(true);
  });
});

describe("favorites", () => {
  it("students manage only their own favorites", async () => {
    await asUser(db, alice, `insert into public.favorites (user_id, facility_id) values ($1, $2)`, [alice, gym.id]);
    expect(await expectError(asUser(db, alice, `insert into public.favorites (user_id, facility_id) values ($1, $2)`, [bob, gym.id])))
      .toMatch(/row-level security/);
    expect(await asUser(db, bob, `select * from public.favorites`)).toHaveLength(0);
    expect(await asUser(db, alice, `select * from public.favorites`)).toHaveLength(1);
    await asUser(db, alice, `delete from public.favorites where facility_id = $1`, [gym.id]);
    expect(await asUser(db, alice, `select * from public.favorites`)).toHaveLength(0);
  });
});

describe("admin permissions", () => {
  it("students cannot change inventory or read QR tokens", async () => {
    expect(await asUser(db, alice, `update public.facilities set capacity = 1 returning id`)).toHaveLength(0);
    expect(await expectError(asUser(db, alice, `insert into public.facilities (slug, name, category) values ('x-room', 'X Room', 'other')`)))
      .toMatch(/row-level security/);
    expect(await asUser(db, alice, `select * from public.facility_qr_codes`)).toHaveLength(0);
    expect(await expectError(asUser(db, alice, `select public.get_admin_stats()`))).toBe("FORBIDDEN");
    expect(await expectError(asUser(db, alice, `select public.admin_rotate_qr($1)`, [gym.id]))).toBe("FORBIDDEN");
    expect(await expectError(asUser(db, alice, `select * from public.admin_list_reservations()`))).toBe("FORBIDDEN");
    expect(await expectError(asUser(db, alice, `select public.grant_admin('alice@srmist.edu.in')`))).toMatch(/permission denied/);
  });

  it("admins can add and edit facilities, seats and QR codes, and every change is audited", async () => {
    const f = await asUser<{ id: string }>(db, admin,
      `insert into public.facilities (slug, name, category, booking_mode) values ('quiet-pod', 'Quiet Pod', 'study_room', 'seat') returning id`);
    const fid = f[0].id;
    await asUser(db, admin, `update public.facilities set name = 'Quiet Pods' where id = $1`, [fid]);
    const n = await asUser<{ n: number }>(db, admin, `select public.admin_generate_seats($1, 2, 3) as n`, [fid]);
    expect(n[0].n).toBe(6);
    const token = await asUser<{ t: string }>(db, admin, `select public.admin_rotate_qr($1) as t`, [fid]);
    expect(token[0].t).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const rotated = await asUser<{ t: string }>(db, admin, `select public.admin_rotate_qr($1) as t`, [fid]);
    expect((await scan(alice, token[0].t)).result).toBe("INVALID_QR");
    expect(rotated[0].t).not.toBe(token[0].t);

    const logs = await asUser<{ action: string; entity_type: string; actor_id: string }>(db, admin,
      `select action, entity_type, actor_id from public.admin_audit_logs where entity_id = $1 or (entity_type = 'facility_qr_codes' and after->>'facility_id' = $1)`, [fid]);
    expect(logs.some((l) => l.action === "insert" && l.entity_type === "facilities" && l.actor_id === admin)).toBe(true);
    expect(logs.some((l) => l.action === "update" && l.entity_type === "facilities")).toBe(true);
    expect(logs.some((l) => l.entity_type === "facility_qr_codes")).toBe(true);
    expect(await asUser(db, alice, `select * from public.admin_audit_logs`)).toHaveLength(0);
  });

  it("admin can cancel any reservation and see student details", async () => {
    const list = await asUser<{ id: string; student_email: string; status: string }>(db, admin,
      `select id, student_email, status from public.admin_list_reservations(null, 'BOOKED')`);
    expect(list.length).toBeGreaterThan(0);
    const target = list[0];
    await asUser(db, admin, `select public.admin_cancel_reservation($1, 'Maintenance')`, [target.id]);
    const row = await one<{ status: string; cancel_reason: string }>(db,
      `select status, cancel_reason from public.reservations where id = $1`, [target.id]);
    expect(row).toEqual({ status: "CANCELLED", cancel_reason: "Maintenance" });
  });

  it("campus stats come from the database", async () => {
    const s = await asUser<{ s: Record<string, number> }>(db, alice, `select public.get_campus_stats() as s`);
    expect(s[0].s.total_facilities).toBeGreaterThanOrEqual(6);
    expect(typeof s[0].s.available).toBe("number");
    const a = await asUser<{ s: Record<string, number> }>(db, admin, `select public.get_admin_stats() as s`);
    expect(a[0].s.seats_in_maintenance).toBeGreaterThanOrEqual(1);
  });
});

describe("realtime change signal", () => {
  it("bumps the facility version on every reservation change", async () => {
    const before = await one<{ v: number }>(db, `select version::int as v from public.facility_live where facility_id = $1`, [library.id]);
    const start = await slotStart(db, 80);
    const h = await createUser(db, "hari@srmist.edu.in");
    await book(h, seat("D04"), start, addMinutes(start, 60));
    const after = await one<{ v: number }>(db, `select version::int as v from public.facility_live where facility_id = $1`, [library.id]);
    expect(after.v).toBeGreaterThan(before.v);
  });
});
