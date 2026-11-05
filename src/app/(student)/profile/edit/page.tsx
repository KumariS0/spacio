import type { Metadata } from "next";
import { requireStudent } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { ProfileForm } from "@/components/auth/profile-form";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const viewer = await requireStudent();
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader backHref="/profile" backLabel="Account" title="Edit profile" description="Your email is verified and can't be changed here." />
      <ProfileForm
        email={viewer.profile.email}
        defaults={{ full_name: viewer.profile.full_name, register_number: viewer.profile.register_number }}
        submitLabel="Save changes"
        redirectTo="/profile"
      />
    </div>
  );
}
