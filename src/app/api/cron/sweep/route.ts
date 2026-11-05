import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Marks no-shows and expired check-ins. Called by Vercel Cron (or any
 * scheduler) with `Authorization: Bearer $CRON_SECRET`. The database also
 * sweeps lazily on every booking/scan and via pg_cron when available.
 */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 503 });
  const { data, error } = await admin.rpc("sweep_reservations");
  if (error) return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  return NextResponse.json({ updated: data ?? 0, at: new Date().toISOString() });
}
