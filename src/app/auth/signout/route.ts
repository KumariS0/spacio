import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Forced sign-out used by the server guards when a session belongs to an
 * account that may not use SPACIO (wrong domain, unconfirmed email).
 * Normal "Log out" uses the signOut server action (POST).
 */
export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason");
  const supabase = await createClient();
  await supabase.auth.signOut();
  const target = new URL("/login", request.nextUrl.origin);
  if (reason === "domain" || reason === "profile") target.searchParams.set("error", reason);
  return NextResponse.redirect(target);
}
