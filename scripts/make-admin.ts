/**
 * Grant or revoke the admin role.
 *
 *   npm run make-admin -- someone@srmist.edu.in
 *   npm run make-admin -- someone@srmist.edu.in --revoke
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env.local. The person must have signed
 * in to SPACIO once so their profile exists. The change is written to the
 * audit log by the database.
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const revoke = args.includes("--revoke");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run make-admin -- <email> [--revoke]");
  process.exit(1);
}
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
// Wrapped in a function: tsx compiles these scripts as CommonJS, which has no top-level await.
async function main() {
  const { error } = await supabase.rpc(revoke ? "revoke_admin" : "grant_admin", { p_email: email });
  if (error) {
    console.error(error.message === "PROFILE_NOT_FOUND" ? `No profile for ${email}. Ask them to sign in to SPACIO once, then run this again.` : `Failed: ${error.message}`);
    process.exit(1);
  }
  console.log(revoke ? `${email} is no longer an admin.` : `${email} is now an admin. They may need to refresh the page.`);
}

void main();
