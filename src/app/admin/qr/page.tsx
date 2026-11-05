import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer, ScanLine } from "lucide-react";
import { requireAdmin } from "@/lib/data";
import { getFacilityQrCodes } from "@/lib/qr-codes";
import { PageHeader } from "@/components/nav/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/misc";
import { RotateQrButton } from "@/components/admin/rotate-qr-button";
import { formatDateTime } from "@/lib/time";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "QR codes" };

export default async function AdminQrPage() {
  await requireAdmin();
  const codes = await getFacilityQrCodes();
  const localSite = /localhost|127\.0\.0\.1/.test(publicEnv.siteUrl);

  return (
    <div>
      <PageHeader
        title="QR codes"
        description="Each facility has one QR code. Students scan it to check in when they arrive and again to check out. The code only contains a link and a random token, never student data."
        actions={<ButtonLink href="/admin/qr/print" variant="secondary" icon={<Printer className="size-4.5" aria-hidden />}>Print sheet</ButtonLink>}
      />
      {localSite && (
        <Alert tone="warning" className="mb-6" title="These codes point to localhost">
          Set <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> to the deployed address before printing, otherwise phones can’t open them.
        </Alert>
      )}
      {codes.length === 0 ? (
        <EmptyState title="No facilities yet">Add a facility and its QR code is created automatically.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {codes.map((c) => (
            <li key={c.facilityId} id={c.slug} className="flex scroll-mt-6 flex-col rounded-card border border-line bg-surface p-4 shadow-card target:ring-2 target:ring-forest">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-lg text-ink">{c.name}</h2>
                  <p className="truncate text-sm text-muted">{c.location || "No location"}{!c.isActive && " · inactive"}</p>
                </div>
              </div>
              {c.svg ? (
                <div
                  className="mx-auto aspect-square w-full max-w-[220px] rounded-lg border border-line bg-white p-1 [&>svg]:size-full"
                  role="img"
                  aria-label={`QR code for ${c.name}`}
                  dangerouslySetInnerHTML={{ __html: c.svg }}
                />
              ) : (
                <div className="mx-auto grid aspect-square w-full max-w-[220px] place-items-center rounded-lg border border-dashed border-line text-center text-sm text-muted">
                  No active code
                </div>
              )}
              {c.token && (
                <p className="mt-3 text-center text-sm text-muted">
                  Entry code <span className="select-all font-mono text-[13px] font-semibold tracking-wide text-ink">{c.token}</span>
                </p>
              )}
              {c.payload && (
                <p className="mt-2 break-all rounded-md bg-sunken px-2 py-1.5 font-mono text-[11px] text-ink-soft" title="Encoded link">{c.payload}</p>
              )}
              {c.createdAt && <p className="mt-1.5 text-xs text-muted">Created {formatDateTime(c.createdAt)}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {c.png && (
                  <a href={c.png} download={`spacio-qr-${c.slug}.png`} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-line-strong">
                    <Download className="size-4" aria-hidden /> PNG
                  </a>
                )}
                {c.svg && (
                  <a href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.svg)}`} download={`spacio-qr-${c.slug}.svg`} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-line-strong">
                    <Download className="size-4" aria-hidden /> SVG
                  </a>
                )}
                {c.token && (
                  <Link
                    href={`/scan?t=${encodeURIComponent(c.token)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-line-strong"
                    title="Does exactly what scanning this code does, for your own account. Useful for testing on this device."
                  >
                    <ScanLine className="size-4" aria-hidden /> Scan as me
                  </Link>
                )}
                <RotateQrButton facilityId={c.facilityId} name={c.name} hasCode={Boolean(c.token)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
