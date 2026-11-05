import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { allowedEmailDomains } from "@/lib/env";
import { isAllowedEmail } from "@/lib/auth/domains";

/**
 * Fallback for email templates that send a link instead of (or as well as) a
 * code: /auth/confirm?token_hash=…&type=email. The primary flow is the code.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  if (!tokenHash) return NextResponse.redirect(new URL("/login?error=link", origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=link", origin));
  if (!isAllowedEmail(data.user.email ?? "", allowedEmailDomains())) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=domain", origin));
  }
  return NextResponse.redirect(new URL("/home", origin));
}
