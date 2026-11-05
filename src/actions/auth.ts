"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowedEmailDomains, isSupabaseConfigured, publicEnv } from "@/lib/env";
import { emailSchema, isAllowedEmail, otpSchema, profileSchema } from "@/lib/auth/domains";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  cooldown?: number;
  values?: Record<string, string>;
} | null;

const OTP_COOKIE = "spacio_otp";
const COOLDOWN_SECONDS = 60;
const MAX_PER_EMAIL_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 20;

type OtpCookie = { email: string; sentAt: number; next?: string };

function sha(value: string) {
  return createHash("sha256").update(`spacio:${value}`).digest("hex");
}

function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

async function readOtpCookie(): Promise<OtpCookie | null> {
  const raw = (await cookies()).get(OTP_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OtpCookie;
    return typeof parsed.email === "string" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeOtpCookie(value: OtpCookie) {
  (await cookies()).set(OTP_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
}

/**
 * Server-side rate limiting on top of Supabase Auth's own limits:
 * 60 s cooldown and 5/hour per email, 20/hour per IP. Needs the service-role
 * key; without it we fall back to Supabase's built-in limits only.
 */
async function checkRateLimit(email: string): Promise<{ ok: true } | { ok: false; cooldown?: number; error: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: true };
  const emailHash = sha(email);
  const ip = await clientIp();
  const ipHash = ip ? sha(ip) : null;
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { data: recent } = await admin
    .from("otp_requests")
    .select("created_at")
    .eq("email_hash", emailHash)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false });

  if (recent && recent.length > 0) {
    const last = new Date(recent[0].created_at as string).getTime();
    const wait = Math.ceil((last + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
    if (wait > 0) return { ok: false, cooldown: wait, error: `Please wait ${wait} seconds before requesting another code.` };
    if (recent.length >= MAX_PER_EMAIL_PER_HOUR) return { ok: false, error: "Too many codes requested for this email. Try again in an hour." };
  }
  if (ipHash) {
    const { count } = await admin
      .from("otp_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) return { ok: false, error: "Too many sign-in attempts from this network. Try again later." };
  }
  await admin.from("otp_requests").insert({ email_hash: emailHash, ip_hash: ipHash });
  return { ok: true };
}

async function sendOtp(email: string): Promise<{ ok: true } | { ok: false; error: string; cooldown?: number }> {
  if (!isAllowedEmail(email, allowedEmailDomains())) {
    return { ok: false, error: `Use your SRM student email (${allowedEmailDomains().map((d) => "@" + d).join(" or ")}).` };
  }
  const limit = await checkRateLimit(email);
  if (!limit.ok) return limit;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm` },
  });
  if (error) {
    if (error.status === 429) return { ok: false, error: "Too many codes requested. Wait a minute and try again.", cooldown: COOLDOWN_SECONDS };
    if (error.status === 403 || /hook|domain/i.test(error.message)) {
      return { ok: false, error: "This email can't be used with SPACIO. Use your SRM student email." };
    }
    console.error("signInWithOtp failed", error.status, error.code ?? "", error.message);
    return { ok: false, error: "We couldn't send the code right now. Please try again shortly." };
  }
  return { ok: true };
}

export async function requestOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message }, values: { email: rawEmail } };
  const email = parsed.data;
  if (!isAllowedEmail(email, allowedEmailDomains())) {
    return { fieldErrors: { email: `Use your SRM student email (${allowedEmailDomains().map((d) => "@" + d).join(" or ")}).` }, values: { email } };
  }
  if (!isSupabaseConfigured()) return { error: "SPACIO isn't connected to Supabase yet. See README → Supabase setup.", values: { email } };

  const res = await sendOtp(email);
  if (!res.ok) {
    const isDomain = res.error.startsWith("Use your SRM");
    return isDomain
      ? { fieldErrors: { email: res.error }, values: { email } }
      : { error: res.error, cooldown: res.cooldown, values: { email } };
  }
  await writeOtpCookie({ email, sentAt: Date.now(), next: safeNext(String(formData.get("next") ?? "")) ?? undefined });
  redirect("/verify");
}

export async function resendOtp(): Promise<FormState> {
  const state = await readOtpCookie();
  if (!state) return { error: "Your sign-in session expired. Enter your email again." };
  const wait = Math.ceil((state.sentAt + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
  if (wait > 0) return { error: `You can request a new code in ${wait} seconds.`, cooldown: wait };
  const res = await sendOtp(state.email);
  if (!res.ok) return { error: res.error, cooldown: res.cooldown };
  await writeOtpCookie({ ...state, sentAt: Date.now() });
  return { message: "A new code is on its way. Check your inbox (and spam folder).", cooldown: COOLDOWN_SECONDS };
}

export async function verifyOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const state = await readOtpCookie();
  if (!state) return { error: "Your sign-in session expired. Enter your email again." };

  const parsed = otpSchema(publicEnv.otpLength).safeParse(String(formData.get("token") ?? ""));
  if (!parsed.success) return { fieldErrors: { token: parsed.error.issues[0].message } };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: state.email, token: parsed.data, type: "email" });
  if (error || !data.user) {
    const expired = error?.code === "otp_expired" || /expired/i.test(error?.message ?? "");
    if (error?.status === 429) return { error: "Too many attempts. Wait a minute, then request a new code." };
    return {
      fieldErrors: {
        token: expired
          ? "This code has expired or was already used. Request a new one below."
          : "That code isn't right. Check the latest email and try again.",
      },
    };
  }

  // Defence in depth: never keep a session for a non-allowed domain.
  if (!isAllowedEmail(data.user.email ?? "", allowedEmailDomains())) {
    await supabase.auth.signOut();
    return { error: "This email can't be used with SPACIO." };
  }

  (await cookies()).delete(OTP_COOKIE);
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
  if (!profile?.full_name) redirect("/onboarding");
  redirect(safeNext(state.next) ?? "/home");
}

export async function getPendingEmail() {
  const state = await readOtpCookie();
  if (!state) return null;
  return { email: state.email, secondsLeft: Math.max(0, Math.ceil((state.sentAt + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000)) };
}

export async function completeProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { full_name: String(formData.get("full_name") ?? ""), register_number: String(formData.get("register_number") ?? "") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, register_number: parsed.data.register_number ?? null })
    .eq("id", auth.user.id);
  if (error) return { error: "Couldn't save your profile. Please try again.", values };
  const redirectTo = String(formData.get("redirect_to") ?? "");
  redirect(redirectTo === "/profile" ? "/profile" : "/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/logged-out");
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { fieldErrors: { confirm: 'Type DELETE to confirm.' } };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const admin = createAdminClient();
  if (!admin) return { error: "Account deletion isn't configured on this server. Contact the SPACIO administrators." };
  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) return { error: "We couldn't delete your account. Please try again later." };
  await supabase.auth.signOut();
  redirect("/logged-out?deleted=1");
}
