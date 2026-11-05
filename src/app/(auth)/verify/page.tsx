import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getPendingEmail } from "@/actions/auth";
import { publicEnv } from "@/lib/env";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Enter your code" };

function mask(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const shown = user.length <= 2 ? user[0] : user.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(user.length - shown.length, 1))}@${domain}`;
}

export default async function VerifyPage() {
  const pending = await getPendingEmail();
  if (!pending) redirect("/login");
  return (
    <AuthShell>
      <h1 className="text-[32px] leading-tight text-ink">Check your email</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        We sent a {publicEnv.otpLength}-digit code to <span className="font-medium text-ink">{mask(pending.email)}</span>. It expires
        shortly, so enter it soon.
      </p>
      <VerifyForm length={publicEnv.otpLength} initialCooldown={pending.secondsLeft} />
    </AuthShell>
  );
}
