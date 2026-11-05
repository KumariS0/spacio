/**
 * Concurrency check against a real Supabase project (PGlite can't run
 * parallel transactions). Creates temporary verified students, fires
 * simultaneous bookings, and checks the database let exactly the right
 * number through. Everything it creates is deleted afterwards.
 *
 *   npm run race-test
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local, the seed data applied, and the
 * Email provider's password sign-in left enabled (used only by this script).
 * Do not run against production.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const domain = (process.env.ALLOWED_EMAIL_DOMAINS ?? "srmist.edu.in").split(",")[0].trim();
const PARALLEL = Number(process.env.RACE_USERS ?? 20);

if (!url || !anon || !service) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const created: string[] = [];

async function makeStudent(i: number): Promise<SupabaseClient> {
  const email = `race-${Date.now()}-${i}@${domain}`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.push(data.user.id);
  await admin.from("profiles").update({ full_name: `Race Tester ${i}` }).eq("id", data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
  return client;
}

/** Next whole hour that is inside opening hours today or tomorrow. */
async function pickSlot(facilityId: string) {
  for (let d = 0; d < 3; d++) {
    const date = new Date(Date.now() + d * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const { data } = await admin.rpc("get_facility_slots", { p_facility_id: facilityId, p_date: date });
    const slot = ((data ?? []) as { slot_start: string; slot_end: string; is_past: boolean }[]).find(
      (s) => !s.is_past && new Date(s.slot_start).getTime() > Date.now() + 30 * 60_000,
    );
    if (slot) return slot;
  }
  throw new Error("No future slot found — check the facility's opening hours.");
}

function tally(results: { error: { message: string } | null }[]) {
  const counts: Record<string, number> = {};
  for (const r of results) {
    const key = r.error ? r.error.message : "OK";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Wrapped in a function: tsx compiles these scripts as CommonJS, which has no top-level await.
async function main() {
  let failed = false;
  try {
    console.log(`Creating ${PARALLEL} temporary students…`);
    const students = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => makeStudent(i)));

    // 1. Seat race: everyone books the same seat for the same hour.
    const { data: lib } = await admin.from("facilities").select("id").eq("slug", "central-library").single();
    const { data: seat } = await admin.from("facility_seats").select("id, label").eq("facility_id", lib!.id).eq("status", "active").limit(1).single();
    const slot = await pickSlot(lib!.id);
    console.log(`Seat race: ${PARALLEL} students → seat ${seat!.label} at ${slot.slot_start}`);
    const seatResults = await Promise.all(students.map((s) => s.rpc("book_seat", { p_seat_id: seat!.id, p_starts_at: slot.slot_start, p_ends_at: slot.slot_end })));
    const seatCounts = tally(seatResults);
    console.log("  ", seatCounts);
    if (seatCounts.OK !== 1) {
      failed = true;
      console.error(`  ✗ expected exactly 1 booking, got ${seatCounts.OK ?? 0}`);
    } else console.log("   ✓ exactly one booking succeeded");

    // 2. Capacity race: shrink a capacity space to 5 places and race everyone.
    const { data: commons } = await admin.from("facilities").select("id, capacity").eq("slug", "study-commons").single();
    const originalCapacity = commons!.capacity;
    await admin.from("facilities").update({ capacity: 5 }).eq("id", commons!.id);
    try {
      const cslot = await pickSlot(commons!.id);
      console.log(`Capacity race: ${PARALLEL} students → 5 places at ${cslot.slot_start}`);
      const capResults = await Promise.all(students.map((s) => s.rpc("book_capacity", { p_facility_id: commons!.id, p_starts_at: cslot.slot_start, p_ends_at: cslot.slot_end })));
      const capCounts = tally(capResults);
      console.log("  ", capCounts);
      if (capCounts.OK !== 5) {
        failed = true;
        console.error(`  ✗ expected exactly 5 bookings, got ${capCounts.OK ?? 0}`);
      } else console.log("   ✓ exactly five bookings succeeded");
    } finally {
      await admin.from("facilities").update({ capacity: originalCapacity }).eq("id", commons!.id);
    }
  } catch (e) {
    failed = true;
    console.error(e instanceof Error ? e.message : e);
  } finally {
    if (created.length) {
      console.log(`Cleaning up ${created.length} temporary students…`);
      await admin.from("reservations").delete().in("user_id", created);
      for (const id of created) await admin.auth.admin.deleteUser(id);
    }
  }
  process.exit(failed ? 1 : 0);
}

void main();
