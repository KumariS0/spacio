/**
 * Runs the real Supabase migrations + seed inside an embedded Postgres
 * (PGlite) with a minimal stand-in for the Supabase `auth` schema and roles.
 * Lets us exercise booking rules, the QR state machine and RLS without Docker.
 */
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = path.resolve(__dirname, "../..");

const SUPABASE_STUB = /* sql */ `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant anon, authenticated, service_role to current_user;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to public;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export type Db = PGlite;

export async function createTestDb(): Promise<Db> {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(SUPABASE_STUB);
  const dir = path.join(ROOT, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  try {
    await db.exec(readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
  } catch (e) {
    throw new Error(`Seed failed: ${(e as Error).message}`);
  }
  // Make every demo facility open around the clock so time-sensitive tests
  // (current-slot booking, check-in windows) work whatever time they run.
  await db.exec(`update public.facility_operating_hours set opens_at = '00:00', closes_at = '24:00', is_closed = false;`);
  return db;
}

export async function createUser(db: Db, email: string, opts: { confirmed?: boolean; name?: string } = {}) {
  const id = randomUUID();
  await db.query(
    `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3, $4)`,
    [id, email, opts.confirmed === false ? null : new Date().toISOString(), JSON.stringify({ full_name: opts.name ?? null })],
  );
  return id;
}

/** Run one statement as an `authenticated` user (RLS applies). */
export async function asUser<T = Record<string, unknown>>(db: Db, uid: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

/** Run as the anonymous role. */
export async function asAnon<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) {
  await db.exec(`set role anon`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role`);
  }
}

/** Expect a statement to fail with a P0001 business error; returns the code. */
export async function expectError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("Expected the statement to fail, but it succeeded");
}

export async function one<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows[0];
}

/** Start of the current campus-local hour, as an ISO string, plus offset hours. */
export async function slotStart(db: Db, offsetHours = 0, minutes = 60): Promise<string> {
  // Bookings a day or more ahead are anchored to 04:00 campus time, so every
  // offset used by the tests (and ±2 h around it) stays inside one calendar
  // day. Anchoring to the current hour made them cross midnight when the
  // suite ran late at night, which the opening-hours check rightly rejects.
  if (offsetHours >= 24) {
    const row = await one<{ e: number }>(
      db,
      `select extract(epoch from (
         (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '4 hours') at time zone 'Asia/Kolkata'
         + $1 * interval '1 hour'))::float8 as e`,
      [offsetHours],
    );
    return new Date(Number(row.e) * 1000).toISOString();
  }
  const row = await one<{ e: number }>(
    db,
    `select extract(epoch from (
       (date_trunc('hour', now() at time zone 'Asia/Kolkata')
         + (floor(extract(minute from now() at time zone 'Asia/Kolkata') / $2) * $2) * interval '1 minute'
       ) at time zone 'Asia/Kolkata' + $1 * interval '1 hour'))::float8 as e`,
    [offsetHours, minutes],
  );
  return new Date(Number(row.e) * 1000).toISOString();
}

export function addMinutes(iso: string, mins: number) {
  return new Date(new Date(iso).getTime() + mins * 60_000).toISOString();
}
