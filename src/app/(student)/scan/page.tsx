import type { Metadata } from "next";
import { PageHeader } from "@/components/nav/page-header";
import { Scanner } from "@/components/scan/scanner";

export const metadata: Metadata = { title: "Scan QR" };

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Scan a space QR"
        description="Point your camera at the QR code at the entrance. The same code checks you in and, later, out."
      />
      <Scanner initialToken={t ?? null} />
    </div>
  );
}
