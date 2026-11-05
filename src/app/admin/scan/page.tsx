import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { PassScanner } from "@/components/admin/pass-scanner";

export const metadata: Metadata = { title: "Scan passes" };

export default async function AdminScanPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAdmin();
  const { p } = await searchParams;
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Scan passes"
        description="Scan the QR pass on a student's booking to check them in when they arrive and out when they leave. The database checks the booking window every time."
      />
      <PassScanner initialToken={p ?? null} />
    </div>
  );
}
