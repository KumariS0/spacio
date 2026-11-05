import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Admins only" };

export default function ForbiddenPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="max-w-sm text-center">
        <Logo className="mx-auto mb-8" />
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-busy-tint text-busy">
          <ShieldAlert className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl text-ink">This area is for admins</h1>
        <p className="mt-2 text-muted">
          Your account doesn’t have admin access. If you need it, ask an existing SPACIO admin to grant it.
        </p>
        <ButtonLink href="/home" size="lg" className="mt-8">Back to SPACIO</ButtonLink>
      </div>
    </main>
  );
}
