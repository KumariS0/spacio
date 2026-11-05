/**
 * Creates or updates the SPACIO database on your Supabase project.
 *
 *   npm run db:push                     # apply new migrations
 *   npm run db:push -- --seed           # …then load the demo spaces (seed.sql)
 *   npm run db:push -- --demo-activity  # …then the fictional check-in log
 *   npm run db:push -- --dry-run        # list what would run, change nothing
 *
 * Reads SUPABASE_DB_URL from .env.local (Supabase → Connect → Session pooler).
 * Each migration runs in its own transaction and is recorded in
 * supabase_migrations.schema_migrations, the same table the Supabase CLI uses,
 * so `supabase db push` agrees about what has been applied.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const url = process.env.SUPABASE_DB_URL?.trim();

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!url) fail("SUPABASE_DB_URL is empty. Paste the Session pooler connection string into .env.local.");
if (url.includes("[YOUR-PASSWORD]")) fail("SUPABASE_DB_URL still contains [YOUR-PASSWORD]. Replace it with your database password (percent-encode special characters).");

let host: string;
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  if (/^(\[|%5B).*(\]|%5D)$/i.test(parsed.password)) {
    fail("The password in SUPABASE_DB_URL is still wrapped in [ ]. The brackets were part of the placeholder; remove them.");
  }
} catch {
  fail("SUPABASE_DB_URL isn't a valid connection string. If the password has special characters (@ : / ? # %), percent-encode them.");
}

const dir = join("supabase", "migrations");
const migrations = readdirSync(dir)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort()
  .map((file) => ({ file, version: file.split("_")[0], name: file.replace(/^\d+_/, "").replace(/\.sql$/, "") }));

// Supabase's pooler presents a certificate signed by Supabase's own CA. Point
// SUPABASE_DB_CA at the CA file from Database settings to verify it; without
// it the connection is still encrypted but the server certificate isn't checked.
const caPath = process.env.SUPABASE_DB_CA?.trim();
const ssl = caPath ? { ca: readFileSync(caPath, "utf8") } : { rejectUnauthorized: false };

const client = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 15_000, application_name: "spacio-db-push" });

async function runFile(label: string, path: string) {
  const sql = readFileSync(path, "utf8");
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
    console.log(`  ✓ ${label}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  }
}

async function main() {
  console.log(`Connecting to ${host}…`);
  try {
    await client.connect();
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`  (${msg})`);
    if (/password authentication failed/i.test(msg)) fail("The database password was rejected. Check SUPABASE_DB_URL (Project Settings → Database → Reset password if needed).");
    if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) fail(`Couldn't find ${host}. Check your internet connection and the host in SUPABASE_DB_URL.`);
    fail(`Couldn't connect: ${msg}`);
  }

  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
  `);
  const { rows } = await client.query<{ version: string }>("select version from supabase_migrations.schema_migrations");
  const applied = new Set(rows.map((r) => r.version));
  const pending = migrations.filter((m) => !applied.has(m.version));

  console.log(`${migrations.length - pending.length} migration(s) already applied, ${pending.length} to apply.`);
  for (const m of pending) {
    if (dryRun) {
      console.log(`  · would apply ${m.file}`);
      continue;
    }
    const sql = readFileSync(join(dir, m.file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)", [m.version, m.name, [sql]]);
      await client.query("commit");
      console.log(`  ✓ ${m.file}`);
    } catch (e) {
      await client.query("rollback").catch(() => {});
      const err = e as Error & { position?: string };
      fail(`${m.file} failed and was rolled back: ${err.message}${err.position ? ` (at character ${err.position})` : ""}`);
    }
  }

  if (!dryRun && args.has("--seed")) {
    console.log("Loading demo spaces…");
    await runFile("seed.sql (demo data, marked is_demo)", join("supabase", "seed.sql"));
  }
  if (!dryRun && args.has("--demo-activity")) {
    console.log("Loading the fictional check-in log…");
    await runFile("seed_demo_activity.sql (fictional students)", join("supabase", "seed_demo_activity.sql"));
  }

  const { rows: check } = await client.query<{ facilities: number; realtime: boolean; cron: boolean; bucket: boolean }>(`
    select
      (select count(*)::int from public.facilities) as facilities,
      exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'facility_live') as realtime,
      exists (select 1 from pg_extension where extname = 'pg_cron') as cron,
      (to_regclass('storage.buckets') is not null and exists (select 1 from storage.buckets where id = 'facility-images')) as bucket
  `).catch(() => ({ rows: [] as never[] }));
  if (check[0]) {
    const c = check[0];
    console.log(`\nFacilities: ${c.facilities} · Realtime: ${c.realtime ? "on" : "OFF"} · Storage bucket: ${c.bucket ? "ready" : "missing"} · pg_cron: ${c.cron ? "on" : "off (use the cron route instead)"}`);
  }
  console.log(dryRun ? "\nDry run: nothing was changed." : "\nDone.");
}

main()
  .catch((e) => fail((e as Error).message))
  .finally(() => client.end().catch(() => {}));
