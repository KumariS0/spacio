import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireStudent } from "@/lib/data";
import { ProfileForm } from "@/components/auth/profile-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function OnboardingPage() {
  const viewer = await requireStudent({ allowIncompleteProfile: true });
  if (viewer.profile.full_name) redirect("/home");
  return (
    <AuthShell illustration="/images/campus-walk.webp">
      <h1 className="text-[32px] leading-tight text-ink">Create your account</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Your email is verified. Tell us what to call you, and you’re in.
      </p>
      <ProfileForm email={viewer.profile.email} submitLabel="Continue to SPACIO" />
    </AuthShell>
  );
}
