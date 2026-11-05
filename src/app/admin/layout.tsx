import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/data";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · SPACIO Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The role is read server-side from the database; RLS and every admin RPC
  // enforce it again, so this redirect is not the only line of defence.
  await requireAdmin();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)] print:block">
      <aside className="border-b border-line bg-surface print:hidden md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex h-14 items-center justify-between px-4 md:h-16 md:px-5">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="rounded-md bg-forest-tint px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-forest">Admin</span>
          </Link>
        </div>
        <AdminNav />
      </aside>
      <main id="main" className="min-w-0 px-4 pb-16 pt-6 sm:px-6 md:px-8 md:pt-8 print:p-0">
        {children}
      </main>
    </div>
  );
}
