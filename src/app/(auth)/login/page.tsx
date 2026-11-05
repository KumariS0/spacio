import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";
import { Alert } from "@/components/ui/misc";
import { allowedEmailDomains, isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  domain: "That account isn't an SRM student account, so it was signed out. Sign in with your SRM email.",
  profile: "We couldn't load your profile. Please sign in again.",
  link: "That sign-in link is invalid or has expired. Request a new code.",
  not_configured: "SPACIO isn't connected to its Supabase project yet. See the README for setup.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const domains = allowedEmailDomains();
  const configured = isSupabaseConfigured();
  return (
    <AuthShell>
      <h1 className="text-[32px] leading-tight text-ink">Welcome to SPACIO</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Sign in with your college email. We&apos;ll send you a one-time code — no password needed.
      </p>
      {(error || !configured) && (
        <Alert tone={error === "domain" ? "warning" : "error"} className="mt-6">
          {ERRORS[error ?? "not_configured"] ?? ERRORS.not_configured}
        </Alert>
      )}
      <LoginForm next={next ?? ""} domains={domains} />
      <p className="mt-6 text-center text-[13px] leading-relaxed text-muted">
        First time here? Signing in creates your account automatically.
      </p>
    </AuthShell>
  );
}
