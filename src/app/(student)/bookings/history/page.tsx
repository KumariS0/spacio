import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { getMyReservations } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { durationLabel, formatDay, formatRange, formatTime, minutesBetween } from "@/lib/time";

export const metadata: Metadata = { title: "Booking history" };

const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: process.env.NEXT_PUBLIC_CAMPUS_TZ ?? "Asia/Kolkata" });

export default async function HistoryPage() {
  const reservations = await getMyReservations({ limit: 500 });
  const months = new Map<string, typeof reservations>();
  for (const r of reservations) {
    const key = monthFmt.format(new Date(r.starts_at));
    months.set(key, [...(months.get(key) ?? []), r]);
  }

  return (
    <div>
      <PageHeader backHref="/bookings" backLabel="My bookings" title="Booking history" description={`${reservations.length} reservations in total.`} />
      {reservations.length === 0 ? (
        <EmptyState icon={<History className="size-5" aria-hidden />} title="No bookings yet" action={<ButtonLink href="/explore">Find a space</ButtonLink>}>
          Your full booking history will appear here.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {[...months.entries()].map(([month, rows]) => (
            <section key={month} aria-label={month}>
              <h2 className="mb-2 text-lg text-ink">{month}</h2>
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="hidden bg-paper/60 text-xs text-muted sm:table-header-group">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Space</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">In / out</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.id} className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-3 hover:bg-paper/50 sm:table-row sm:p-0">
                        <td className="sm:px-4 sm:py-3">
                          <Link href={`/bookings/${r.id}`} className="font-medium text-ink hover:text-forest hover:underline">
                            {r.facility?.name}
                          </Link>
                          {r.seat?.label && <span className="text-muted"> · Seat {r.seat.label}</span>}
                        </td>
                        <td className="tabular col-start-1 text-ink-soft sm:px-4 sm:py-3">
                          {formatDay(r.starts_at)}, {formatRange(r.starts_at, r.ends_at)}
                          <span className="text-muted"> · {durationLabel(minutesBetween(r.starts_at, r.ends_at))}</span>
                        </td>
                        <td className="tabular col-start-1 text-xs text-muted sm:px-4 sm:py-3 sm:text-sm">
                          {r.checked_in_at ? formatTime(r.checked_in_at) : "—"} / {r.checked_out_at ? formatTime(r.checked_out_at) : "—"}
                        </td>
                        <td className="col-start-2 row-span-3 row-start-1 self-start sm:px-4 sm:py-3">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
