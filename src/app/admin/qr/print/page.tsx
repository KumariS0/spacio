import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data";
import { getFacilityQrCodes } from "@/lib/qr-codes";
import { PageHeader } from "@/components/nav/page-header";
import { PrintButton } from "@/components/admin/print-button";
import { LeafMark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Print QR codes" };

export default async function PrintQrPage() {
  await requireAdmin();
  const codes = (await getFacilityQrCodes()).filter((c) => c.svg && c.isActive);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          backHref="/admin/qr"
          backLabel="QR codes"
          title="Print sheet"
          description="One card per active facility. Print on A4, cut along the borders and place each card at the entrance."
          actions={<PrintButton />}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-0">
        {codes.map((c) => (
          <article key={c.facilityId} className="flex break-inside-avoid flex-col items-center rounded-card border border-line bg-white p-6 text-center text-ink print:rounded-none print:border-dashed print:p-8">
            <div className="mb-3 flex items-center gap-1.5 text-forest">
              <LeafMark className="size-5" />
              <span className="font-serif text-lg">SPACIO</span>
            </div>
            <h2 className="font-serif text-2xl leading-tight">{c.name}</h2>
            {c.location && <p className="mt-1 text-sm text-muted">{c.location}</p>}
            <div className="my-4 aspect-square w-56 [&>svg]:size-full" role="img" aria-label={`QR code for ${c.name}`} dangerouslySetInnerHTML={{ __html: c.svg! }} />
            <p className="text-sm font-medium">Scan when you arrive to check in.</p>
            <p className="text-sm text-muted">Scan again when you leave to check out.</p>
            {c.token && (
              <p className="mt-3 text-xs text-muted">
                Can’t scan? In SPACIO, open Scan → Enter code manually and type{" "}
                <span className="font-mono text-[13px] font-semibold tracking-wide text-ink">{c.token}</span>
              </p>
            )}
            <p className="mt-4 text-[10px] text-muted">Student project · not an official SRM service</p>
          </article>
        ))}
      </div>
      {codes.length === 0 && <p className="text-muted">No active facilities with QR codes.</p>}
    </div>
  );
}
