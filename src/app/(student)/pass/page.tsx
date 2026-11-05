import type { Metadata } from "next";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { getMyReservations } from "@/lib/data";
import { PageHeader } from "@/components/nav/page-header";
import { BookingPass } from "@/components/bookings/booking-pass";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { formatDay, formatRange } from "@/lib/time";
import type { Reservation } from "@/lib/types";

export const metadata: Metadata = { title: "My pass" };

/** Bookings that still have a usable pass: checked in first, then by start time. */
function livePasses(list: Reservation[], now = Date.now()) {
  return list
    .filter((r) => (r.status === "BOOKED" || r.status === "CHECKED_IN") && new Date(r.ends_at).getTime() > now)
    .sort((a, b) => (a.status === "CHECKED_IN" ? -1 : b.status === "CHECKED_IN" ? 1 : +new Date(a.starts_at) - +new Date(b.starts_at)));
}

/** The pass for the booking you're in now, or the next one coming up. */
export default async function PassPage() {
  const [current, ...later] = livePasses(await getMyReservations({ limit: 50 }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My pass" description="Show it at the entrance. Staff scan it to check you in, and again to check you out." />
      {current ? (
        <>
          <BookingPass reservation={current} />
          <ButtonLink href={`/bookings/${current.id}`} variant="ghost" className="mt-4">
            Booking details
          </ButtonLink>
          {later.length > 0 && (
            <section aria-labelledby="later-title" className="mt-8">
              <h2 id="later-title" className="mb-3 font-serif text-xl text-ink">Later bookings</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                {later.map((r) => (
                  <li key={r.id}>
                    <Link href={`/bookings/${r.id}#pass`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-paper/70">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{r.facility?.name}</span>
                        <span className="block text-sm text-muted">
                          {formatDay(r.starts_at)}, <span className="whitespace-nowrap">{formatRange(r.starts_at, r.ends_at)}</span>
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-forest">
                        <QrCode className="size-4" aria-hidden /> Pass
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <EmptyState
          icon={<QrCode className="size-6" aria-hidden />}
          title="No upcoming bookings"
          action={<ButtonLink href="/explore">Find a space</ButtonLink>}
        >
          Each booking comes with its own QR pass. Book a space and it appears here.
        </EmptyState>
      )}
    </div>
  );
}
